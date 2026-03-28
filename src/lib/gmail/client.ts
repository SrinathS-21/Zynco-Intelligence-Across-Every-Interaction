export interface FetchedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  body?: string;
  date: string;
  labels: string[];
  read: boolean;
  attachments?: Array<{ filename: string; mimeType: string; size?: number }>;
}

export type GmailRequestError = Error & { code?: number; retryAfterMs?: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

export function getGmailErrorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const raw = (error as { code?: unknown }).code;
    const parsed = Number(raw);
    if (Number.isInteger(parsed)) return parsed;
  }

  if (error instanceof Error) {
    const match = error.message.match(/\((\d{3})\)/);
    if (match) return Number(match[1]);
  }

  return undefined;
}

export function isGmailRateLimitError(error: unknown): boolean {
  return getGmailErrorCode(error) === 429;
}

function getGmailBackoffMs(status: number, attempt: number, retryAfterMs?: number): number {
  if (status === 429 && retryAfterMs && retryAfterMs > 0) {
    return Math.min(10_000, retryAfterMs);
  }

  const exponential = Math.min(10_000, 500 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

async function gmailRequest<T>(accessToken: string, endpoint: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const maxRetries = method === "GET" ? 3 : 1;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    const text = await response.text();
    const retryAfterMs = getRetryAfterMs(response);
    const err = new Error(`Gmail request failed (${response.status}): ${text}`) as GmailRequestError;
    err.code = response.status;
    err.retryAfterMs = retryAfterMs;

    const retryable = response.status === 429 || response.status >= 500;
    const hasRetryAttemptsRemaining = attempt < maxRetries;
    if (retryable && hasRetryAttemptsRemaining) {
      await sleep(getGmailBackoffMs(response.status, attempt, retryAfterMs));
      continue;
    }

    throw err;
  }

  throw new Error("Unexpected Gmail request failure");
}

function decodeBase64Url(value?: string): string {
  if (!value) return "";
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return "";
}

function extractAttachments(payload: any): Array<{ filename: string; mimeType: string; size?: number }> {
  if (!payload?.parts) return [];
  const files: Array<{ filename: string; mimeType: string; size?: number }> = [];

  const walk = (part: any) => {
    if (part.filename && part.body?.attachmentId) {
      files.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body?.size,
      });
    }
    if (Array.isArray(part.parts)) {
      part.parts.forEach(walk);
    }
  };

  payload.parts.forEach(walk);
  return files;
}

function getDetailConcurrency(): number {
  const raw = Number(process.env.GMAIL_DETAIL_CONCURRENCY || "4");
  if (!Number.isFinite(raw)) return 4;
  return Math.max(1, Math.min(8, Math.floor(raw)));
}

export async function fetchGmailEmails(
  accessToken: string,
  options?: { maxResults?: number; labelIds?: string[]; query?: string }
): Promise<{ emails: FetchedEmail[] }> {
  const maxResults = options?.maxResults ?? 25;
  const search = new URLSearchParams({ maxResults: String(maxResults) });
  if (options?.query) search.set("q", options.query);
  for (const labelId of options?.labelIds || []) {
    search.append("labelIds", labelId);
  }

  const list = await gmailRequest<{ messages?: Array<{ id: string; threadId: string }> }>(
    accessToken,
    `messages?${search.toString()}`
  );

  const messages = list.messages || [];

  const detailed: any[] = [];
  const concurrency = getDetailConcurrency();
  let firstError: unknown;

  for (let i = 0; i < messages.length; i += concurrency) {
    const batch = messages.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((message) => gmailRequest<any>(accessToken, `messages/${message.id}?format=full`))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        detailed.push(result.value);
      } else if (!firstError || isGmailRateLimitError(result.reason)) {
        firstError = result.reason;
      }
    }

    if (firstError && isGmailRateLimitError(firstError)) {
      throw firstError;
    }
  }

  if (!detailed.length && firstError) {
    throw firstError;
  }

  const emails: FetchedEmail[] = detailed.map((message) => {
    const headers = message.payload?.headers || [];
    const subject = getHeader(headers, "Subject") || "(No Subject)";
    const from = getHeader(headers, "From") || "Unknown Sender";
    const date = getHeader(headers, "Date") || new Date().toISOString();

    return {
      id: message.id,
      threadId: message.threadId,
      subject,
      from,
      snippet: message.snippet || "",
      body: extractBody(message.payload),
      date,
      labels: message.labelIds || [],
      read: !(message.labelIds || []).includes("UNREAD"),
      attachments: extractAttachments(message.payload),
    };
  });

  return { emails };
}

export async function getGmailProfile(accessToken: string) {
  return gmailRequest<{ emailAddress: string; messagesTotal: number; threadsTotal: number }>(
    accessToken,
    "profile"
  );
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  return response.json() as Promise<{
    id: string;
    email: string;
    name: string;
    picture: string;
  }>;
}

export async function modifyGmailLabels(
  accessToken: string,
  messageId: string,
  payload: { addLabelIds?: string[]; removeLabelIds?: string[] }
) {
  return gmailRequest(accessToken, `messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
