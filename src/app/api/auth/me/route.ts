import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, ok, serverError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return unauthorized();
    return ok({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    return serverError(error);
  }
}
