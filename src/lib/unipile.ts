type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface UnipileRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: JsonValue;
  query?: Record<string, string | undefined>;
}

interface UnipileMultipartRequestOptions {
  method?: "POST" | "PUT" | "PATCH";
  body: FormData;
  query?: Record<string, string | undefined>;
}

function normalizeBaseUrl(dsn: string): string {
  const trimmed = dsn.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function getUnipileConfig() {
  const token = process.env.UNIPILE_TOKEN;
  const dsn = process.env.UNIPILE_DSN;

  if (!token || !dsn) {
    return null;
  }

  return {
    token,
    baseUrl: normalizeBaseUrl(dsn),
  };
}

function withQuery(path: string, query?: Record<string, string | undefined>) {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function unipileRequest(path: string, options: UnipileRequestOptions = {}) {
  const config = getUnipileConfig();
  if (!config) {
    throw new Error("Unipile is not configured. Set UNIPILE_TOKEN and UNIPILE_DSN.");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${config.baseUrl}/api/v1${withQuery(cleanPath, options.query)}`;
  const method = options.method || "GET";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.token,
      Authorization: `Bearer ${config.token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const errorText = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Unipile request failed (${response.status}): ${errorText}`);
  }

  return data;
}

export async function unipileFirstSuccess(
  candidates: Array<{ path: string; query?: Record<string, string | undefined> }>,
) {
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await unipileRequest(candidate.path, { method: "GET", query: candidate.query });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join(" | "));
}

export async function unipileMultipartRequest(
  path: string,
  options: UnipileMultipartRequestOptions,
) {
  const config = getUnipileConfig();
  if (!config) {
    throw new Error("Unipile is not configured. Set UNIPILE_TOKEN and UNIPILE_DSN.");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${config.baseUrl}/api/v1${withQuery(cleanPath, options.query)}`;
  const method = options.method || "POST";

  const response = await fetch(url, {
    method,
    headers: {
      "X-API-KEY": config.token,
      Authorization: `Bearer ${config.token}`,
    },
    body: options.body,
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    const errorText = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Unipile request failed (${response.status}): ${errorText}`);
  }

  return data;
}
