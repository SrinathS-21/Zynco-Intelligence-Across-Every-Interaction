import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { badRequest, unauthorized, serverError } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid request payload");
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return unauthorized("Invalid email or password");

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return unauthorized("Invalid email or password");

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });

    await createSession(user.id, response);
    return response;
  } catch (error) {
    return serverError(error, "Login failed");
  }
}
