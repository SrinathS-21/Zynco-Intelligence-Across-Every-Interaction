import { NextResponse } from "next/server";
import { getUnipileConfig, unipileRequest } from "@/lib/unipile";

type SocialPlatform = "instagram" | "linkedin" | "twitter";

function normalizePlatform(platform: string): SocialPlatform | null {
  const normalized = platform.toLowerCase();
  if (normalized === "instagram" || normalized === "linkedin" || normalized === "twitter") {
    return normalized;
  }
  return null;
}

function providerForHostedAuth(platform: SocialPlatform) {
  if (platform === "instagram") return "INSTAGRAM";
  if (platform === "linkedin") return "LINKEDIN";
  return "TWITTER";
}

function resolveAppBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = normalizePlatform(searchParams.get("platform") || "");

    if (!platform) {
      return NextResponse.json(
        { error: "platform must be instagram, linkedin, or twitter" },
        {
          status: 400,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
        },
      );
    }

    const config = getUnipileConfig();

    if (!config) {
      return NextResponse.json(
        {
          error: "Unipile is not configured. Set UNIPILE_DSN and UNIPILE_TOKEN.",
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
        },
      );
    }

    const appBaseUrl = resolveAppBaseUrl(request);
    const successRedirect = `${appBaseUrl}/dashboard/unified?connect=success&platform=${platform}`;
    const failureRedirect = `${appBaseUrl}/dashboard/unified?connect=failure&platform=${platform}`;

    const payload = await unipileRequest("/hosted/accounts/link", {
      method: "POST",
      body: {
        expiresOn: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        type: "create",
        providers: [providerForHostedAuth(platform)],
        api_url: config.baseUrl,
        success_redirect_url: successRedirect,
        failure_redirect_url: failureRedirect,
        bypass_success_screen: true,
        name: `zynco-${platform}-${Date.now()}`,
      },
    });

    const connectUrl =
      payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).url === "string"
        ? String((payload as Record<string, unknown>).url)
        : "";

    if (!connectUrl) {
      return NextResponse.json(
        { error: "Hosted auth did not return a URL." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
        },
      );
    }

    return NextResponse.json(
      { connectUrl, source: "unipile-hosted-dynamic" },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate connect URL" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      },
    );
  }
}
