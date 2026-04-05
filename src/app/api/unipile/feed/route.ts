import { NextResponse } from "next/server";
import { unipileFirstSuccess } from "@/lib/unipile";

function providerAliases(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized === "twitter") return ["twitter", "x", "x_twitter"];
  if (normalized === "linkedin") return ["linkedin"];
  if (normalized === "instagram") return ["instagram"];
  return [normalized];
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    if (Array.isArray(objectValue.items)) return objectValue.items;
    if (Array.isArray(objectValue.data)) return objectValue.data;
    if (Array.isArray(objectValue.results)) return objectValue.results;
  }
  return [];
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readStringCandidates(item: Record<string, unknown>, keys: string[]) {
  const values: string[] = [];
  keys.forEach((key) => {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
    }
  });
  return values;
}

function readAccountCandidates(item: Record<string, unknown>) {
  const values = readStringCandidates(item, [
    "account_id",
    "accountId",
    "account",
    "account_uuid",
    "owner_account_id",
    "sender_account_id",
  ]);

  const nestedAccount = item.account;
  if (nestedAccount && typeof nestedAccount === "object") {
    values.push(
      ...readStringCandidates(nestedAccount as Record<string, unknown>, [
        "id",
        "account_id",
        "accountId",
        "uuid",
      ]),
    );
  }

  return values;
}

function readProviderCandidates(item: Record<string, unknown>) {
  const values = readStringCandidates(item, [
    "provider",
    "provider_name",
    "platform",
    "channel",
    "network",
    "source",
    "source_provider",
  ]);

  const nestedAccount = item.account;
  if (nestedAccount && typeof nestedAccount === "object") {
    values.push(
      ...readStringCandidates(nestedAccount as Record<string, unknown>, [
        "provider",
        "provider_name",
        "platform",
        "channel",
      ]),
    );
  }

  return values;
}

function tokenMatchesAlias(token: string, aliases: string[]) {
  return aliases.some((alias) => token === alias || token.includes(alias) || alias.includes(token));
}

function filterInboxItems(items: unknown[], platform: string, accountId?: string) {
  const aliases = providerAliases(platform).map((alias) => normalizeToken(alias));
  let scoped = items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");

  if (accountId) {
    const normalizedAccountId = normalizeToken(accountId);
    const withAccountMetadata = scoped.filter((item) => readAccountCandidates(item).length > 0);

    // Prefer strict account scoping whenever the upstream payload includes account identifiers.
    if (withAccountMetadata.length > 0) {
      scoped = withAccountMetadata.filter((item) => {
        return readAccountCandidates(item).some((candidate) => normalizeToken(candidate) === normalizedAccountId);
      });
    }
  }

  const withProviderMetadata = scoped.filter((item) => readProviderCandidates(item).length > 0);
  if (withProviderMetadata.length > 0) {
    scoped = withProviderMetadata.filter((item) => {
      return readProviderCandidates(item)
        .map((candidate) => normalizeToken(candidate))
        .some((token) => tokenMatchesAlias(token, aliases));
    });
  }

  return scoped;
}

async function fetchCollection(type: "posts" | "inbox" | "comments", platform: string, accountId?: string) {
  const aliases = providerAliases(platform);
  const pathsByType: Record<typeof type, string[]> = {
    posts: ["/posts", "/social/posts", "/social/post"],
    inbox: ["/chats", "/messages", "/chat/list"],
    comments: ["/comments", "/social/comments", "/social/post/comments"],
  };

  const candidates = pathsByType[type].flatMap((path) => {
    return aliases.map((provider) => ({
      path,
      query: {
        provider,
        account_id: accountId,
      },
    }));
  });

  try {
    const response = await unipileFirstSuccess(candidates);
    const items = asArray(response);

    if (type === "inbox") {
      return filterInboxItems(items, platform, accountId);
    }

    return items;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "";
    const accountId = searchParams.get("accountId") || undefined;

    if (!platform) {
      return NextResponse.json({ error: "platform is required" }, { status: 400 });
    }

    const [posts, inbox, comments] = await Promise.all([
      fetchCollection("posts", platform, accountId),
      fetchCollection("inbox", platform, accountId),
      fetchCollection("comments", platform, accountId),
    ]);

    return NextResponse.json({ posts, inbox, comments, source: "unipile" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Unipile feed" },
      { status: 500 },
    );
  }
}
