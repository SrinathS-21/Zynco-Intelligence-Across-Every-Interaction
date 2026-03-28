import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "mail_agent_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || "30");

export async function hashPassword(rawPassword: string): Promise<string> {
  return bcrypt.hash(rawPassword, 12);
}

export async function verifyPassword(rawPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(rawPassword, passwordHash);
}

function getExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

async function createDemoUser() {
  const email = process.env.DEMO_USER_EMAIL || "demo@mailagent.local";
  const name = process.env.DEMO_USER_NAME || "Mail Agent Demo";
  const password = process.env.DEMO_USER_PASSWORD || "demo12345";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });
  }
  return user;
}

export async function getCurrentUser(request?: NextRequest) {
  if (process.env.SESSION_DEMO_BYPASS === "true") {
    return createDemoUser();
  }

  const token = request
    ? request.cookies.get(SESSION_COOKIE_NAME)?.value
    : (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function requireUser(request?: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function createSession(userId: string, response: NextResponse) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = getExpiryDate();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
