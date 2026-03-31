/**
 * Singleton Prisma client.
 *
 * Prisma 7 no longer reads DATABASE_URL directly — it requires a driver adapter.
 * PrismaPg wraps node-postgres and manages the connection pool internally.
 *
 * Next.js hot reload re-executes modules on every file save, which would open
 * a new connection pool each time and exhaust the database's connection limit.
 * Storing the client on globalThis means the same instance survives reloads in dev.
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// globalThis persists across hot reloads in dev; in production this is just a typed reference.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

// Only cache on globalThis outside production — production processes don't hot reload.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
