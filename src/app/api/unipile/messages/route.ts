import { NextResponse } from "next/server";
import { z } from "zod";
import { unipileMultipartRequest, unipileRequest } from "@/lib/unipile";

const schema = z.object({
  platform: z.string().min(1),
  accountId: z.string().optional(),
  recipient: z.string().min(1),
  text: z.string().min(1),
});

interface UnipileChatList {
  items?: Array<Record<string, unknown>>;
  cursor?: string;
}

interface UnipileUserSearchResult {
  provider_id?: string;
  provider_messaging_id?: string;
  public_identifier?: string;
  full_name?: string;
  id?: string;
}

function formDataFromEntries(entries: Array<[string, string]>) {
  const formData = new FormData();
  entries.forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

function normalizeString(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeLower(input: unknown) {
  return normalizeString(input).toLowerCase();
}

function normalizeAlphaNumeric(input: unknown) {
  return normalizeLower(input).replace(/[^a-z0-9]/g, "");
}

function normalizeLettersOnly(input: unknown) {
  return normalizeLower(input).replace(/[^a-z]/g, "");
}

function isLikelyHandle(recipient: string) {
  const value = recipient.trim();
  if (!value) return false;
  if (value.includes("@")) return false;
  if (/^[0-9]{8,}$/.test(value)) return false;
  return /^[A-Za-z][A-Za-z0-9._-]{2,}$/.test(value);
}

function extractUnipileErrorDetail(error: unknown) {
  if (!(error instanceof Error)) return "Message sending failed.";

  const message = error.message || "Message sending failed.";
  const jsonStart = message.indexOf("{");
  if (jsonStart < 0) return message;

  try {
    const parsed = JSON.parse(message.slice(jsonStart)) as Record<string, unknown>;
    const detail = normalizeString(parsed.detail);
    if (detail) return detail;
    const title = normalizeString(parsed.title);
    if (title) return title;
  } catch {
    // Keep original message when payload parsing fails.
  }

  return message;
}

function pickChatIdFromRecipient(
  chats: Array<Record<string, unknown>>,
  recipient: string,
  accountId?: string,
) {
  const needle = recipient.trim().toLowerCase();
  const needleAlpha = normalizeAlphaNumeric(recipient);
  const needleLetters = normalizeLettersOnly(recipient);
  const recipientTokens = recipient
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));

  const filtered = accountId
    ? chats.filter((chat) => normalizeString(chat.account_id) === accountId)
    : chats;

  const exact = filtered.find((chat) => {
    const candidates = [
      chat.id,
      chat.provider_id,
      chat.attendee_id,
      chat.attendee_provider_id,
      chat.name,
    ].map(normalizeLower);
    return candidates.includes(needle);
  });

  if (exact) return normalizeString(exact.id);

  const partial = filtered.find((chat) => {
    const name = normalizeLower(chat.name);
    return Boolean(name) && name.includes(needle);
  });

  if (partial) return normalizeString(partial.id);

  let bestChatId = "";
  let bestScore = -1;

  filtered.forEach((chat) => {
    const chatId = normalizeString(chat.id);
    if (!chatId) return;

    const nameRaw = normalizeString(chat.name);
    const nameAlpha = normalizeAlphaNumeric(nameRaw);
    const nameLetters = normalizeLettersOnly(nameRaw);

    let score = 0;

    if (needleAlpha.length >= 4 && nameAlpha.includes(needleAlpha)) {
      score += 5;
    }

    if (needleLetters.length >= 4 && nameLetters.includes(needleLetters)) {
      score += 4;
    }

    if (recipientTokens.length > 0) {
      const tokenHits = recipientTokens.filter((token) => nameAlpha.includes(token)).length;
      score += tokenHits * 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestChatId = chatId;
    }
  });

  return bestScore >= 4 ? bestChatId : "";
}

async function listChats(accountId?: string) {
  const allChats: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const payload = (await unipileRequest("/chats", {
      method: "GET",
      query: {
        account_id: accountId,
        cursor,
      },
    })) as UnipileChatList;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    allChats.push(...items);

    cursor = normalizeString(payload?.cursor);
    if (!cursor || items.length === 0) break;
  }

  return allChats;
}

function pickAttendeeIdFromSearch(
  candidate: UnipileUserSearchResult,
  recipient: string,
) {
  const needle = recipient.trim().toLowerCase();
  const publicIdentifier = normalizeLower(candidate.public_identifier);
  const fullName = normalizeLower(candidate.full_name);
  const providerId = normalizeLower(candidate.provider_id);
  const providerMessagingId = normalizeLower(candidate.provider_messaging_id);

  const strongMatch =
    publicIdentifier === needle ||
    providerId === needle ||
    providerMessagingId === needle ||
    (publicIdentifier && publicIdentifier.includes(needle)) ||
    (fullName && fullName.includes(needle));

  if (!strongMatch) return "";

  return (
    normalizeString(candidate.provider_messaging_id) ||
    normalizeString(candidate.provider_id) ||
    normalizeString(candidate.id)
  );
}

async function resolveAttendeeId(accountId: string, recipient: string) {
  const payload = (await unipileRequest("/users/search", {
    method: "GET",
    query: {
      account_id: accountId,
      query: recipient,
    },
  })) as UnipileUserSearchResult;

  return pickAttendeeIdFromSearch(payload, recipient);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const { platform, accountId, recipient, text } = parsed.data;
    const attempted: string[] = [];

    const sendInChat = async (chatId: string) => {
      const data = formDataFromEntries([["text", text]]);
      attempted.push(`/chats/${chatId}/messages`);
      return unipileMultipartRequest(`/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST",
        body: data,
      });
    };

    // First, treat recipient as a direct chat ID for fast path.
    try {
      const data = await sendInChat(recipient);
      return NextResponse.json({ success: true, data, mode: "existing-chat-id" });
    } catch {
      // Fall through to recipient resolution.
    }

    // Next, resolve recipient from chat list by chat id/name/attendee identifiers.
    let chats: Array<Record<string, unknown>> = [];
    try {
      chats = await listChats(accountId);
    } catch {
      attempted.push("/chats");
    }

    const resolvedChatId = pickChatIdFromRecipient(chats, recipient, accountId);

    if (resolvedChatId) {
      const data = await sendInChat(resolvedChatId);
      return NextResponse.json({
        success: true,
        data,
        mode: "resolved-chat",
        resolvedChatId,
        platform,
      });
    }

    // Finally, start a 1:1 chat using attendee IDs. When a handle is provided, resolve it first.
    if (accountId) {
      let attendeeId = recipient;
      const looksLikeHandle = isLikelyHandle(recipient);

      if (looksLikeHandle) {
        attempted.push("/users/search");
        try {
          const resolvedAttendeeId = await resolveAttendeeId(accountId, recipient);
          if (resolvedAttendeeId) {
            attendeeId = resolvedAttendeeId;
          } else {
            return NextResponse.json(
              {
                error:
                  "Username could not be resolved to a valid attendee ID. Open the conversation once in Instagram/LinkedIn inbox (or refresh synced chats) and then send from the resolved chat.",
                attempted,
              },
              { status: 400 },
            );
          }
        } catch {
          return NextResponse.json(
            {
              error:
                "Unable to resolve username to attendee ID right now. Try recipient chat ID, or refresh chats and retry.",
              attempted,
            },
            { status: 400 },
          );
        }
      }

      const startChatData = formDataFromEntries([
        ["account_id", accountId],
        ["text", text],
        ["attendees_ids", attendeeId],
      ]);
      attempted.push("/chats");

      try {
        const data = await unipileMultipartRequest("/chats", {
          method: "POST",
          body: startChatData,
        });

        return NextResponse.json({ success: true, data, mode: "start-chat", platform });
      } catch (error) {
        return NextResponse.json(
          {
            error: extractUnipileErrorDetail(error),
            hint:
              "If recipient is a username, ensure it resolves to a valid attendee ID first. If already chatting, use the chat ID from synced inbox.",
            attempted,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "Recipient was not found in your synced chats. Provide a valid chat ID, or include accountId with a provider attendee ID to start a new chat.",
        attempted,
      },
      { status: 400 },
    );
  } catch (error) {
    const detail = extractUnipileErrorDetail(error);
    const isUpstreamUnipileFailure =
      error instanceof Error &&
      (error.message.includes("Unipile request failed") || detail !== "Message sending failed.");

    return NextResponse.json(
      {
        error: detail,
        hint: "Use Inbox Chat Targets (chat ID) for guaranteed delivery when usernames are ambiguous.",
      },
      { status: isUpstreamUnipileFailure ? 400 : 500 },
    );
  }
}
