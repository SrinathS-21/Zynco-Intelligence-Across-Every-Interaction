import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { callRapidByEndpoint } from "@/lib/twitter/rapidapi-client";
import { getRapidTwitterPolicySummary } from "@/lib/twitter/rapidapi-policy";

type RouteContext = {
  params: Promise<{ endpoint: string }>;
};

function queryToObject(request: NextRequest) {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireUser(request);
    const { endpoint } = await context.params;

    const result = await callRapidByEndpoint("GET", `/${endpoint}`, queryToObject(request));
    if (!result.policy) {
      return NextResponse.json(
        {
          error: result.error,
          policySummary: getRapidTwitterPolicySummary(),
        },
        { status: result.status },
      );
    }

    if (!result.ok || !result.result) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          endpoint: result.policy,
          policySummary: getRapidTwitterPolicySummary(),
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      endpoint: result.policy,
      provider: result.result.provider,
      route: result.result.route,
      category: result.result.category,
      data: result.result.data,
      policySummary: getRapidTwitterPolicySummary(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Rapid Twitter endpoint request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireUser(request);
    const { endpoint } = await context.params;

    const body = await request.json().catch(() => ({}));
    const result = await callRapidByEndpoint("POST", `/${endpoint}`, queryToObject(request), body);

    if (!result.policy) {
      return NextResponse.json(
        {
          error: result.error,
          policySummary: getRapidTwitterPolicySummary(),
        },
        { status: result.status },
      );
    }

    if (!result.ok || !result.result) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          endpoint: result.policy,
          policySummary: getRapidTwitterPolicySummary(),
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      endpoint: result.policy,
      provider: result.result.provider,
      route: result.result.route,
      category: result.result.category,
      data: result.result.data,
      policySummary: getRapidTwitterPolicySummary(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Rapid Twitter endpoint request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
