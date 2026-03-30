import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __mailAgentPrisma: PrismaClient | undefined;
}

function getPrismaClient() {
    const existing = global.__mailAgentPrisma;
    
    // In development, if we have a stale client that doesn't know about our new models,
    // we force it to recreate. This avoids "undefined" errors after schema updates.
    if (existing && process.env.NODE_ENV !== "production") {
        const hasModels = 'unifiedMessage' in existing && 'scheduledMessage' in existing;
        if (!hasModels) {
            console.log("Stale Prisma Client detected, re-initializing...");
            // @ts-ignore
            delete global.__mailAgentPrisma;
        } else {
            return existing;
        }
    }

    const client = new PrismaClient({
        log: ["error", "warn"],
    });

    if (process.env.NODE_ENV !== "production") {
        global.__mailAgentPrisma = client;
    }

    return client;
}

const client = getPrismaClient();

// Export a Proxy that always stays fresh. 
// This ensures that all components using 'import { prisma } from "@/lib/db"' 
// get the latest client if it was re-initialized.
export const prisma = new Proxy({} as PrismaClient, {
    get(target, prop) {
        const current = getPrismaClient();
        const value = (current as any)[prop];
        if (typeof value === 'function') {
            return value.bind(current);
        }
        return value;
    }
});

// Add a helper to always get the current client from global
export const getDB = () => {
    if (global.__mailAgentPrisma) return global.__mailAgentPrisma;
    return getPrismaClient();
};
