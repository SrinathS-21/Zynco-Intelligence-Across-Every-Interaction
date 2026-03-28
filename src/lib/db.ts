import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __mailAgentPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__mailAgentPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__mailAgentPrisma = prisma;
}
