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

// Old Author: (initial)
// New Author: samir
// Impact: the cached singleton is now invalidated whenever `prisma generate` produces a new PrismaClient class — the stale cache used to silently swallow newly-added models and throw opaque "Cannot read properties of undefined (reading 'findUnique')" errors after a migration
// Reason: globalThis.prisma outlives Turbopack hot reloads on purpose, but when the generated client changes (new model added), the cached instance belongs to the *old* class and is missing the new model delegate. Detect that explicitly so the dev server self-heals without a manual restart.

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// globalThis persists across hot reloads in dev; in production this is just a typed reference.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Builds a new PrismaClient bound to the PrismaPg adapter. Log level is
 * kept at error+warn in dev because query logging adds 5–20ms per call
 * — enable temporarily when actively debugging SQL.
 *
 * @returns A fresh PrismaClient instance connected to DATABASE_URL
 *
 * @author samir
 * @created 2026-04-06
 * @module Shared - DB Client
 */
function createClient(): PrismaClient {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

/**
 * Returns true when the cached client is still compatible with the
 * currently-imported PrismaClient class.
 *
 * When `prisma generate` re-emits the client (e.g. after adding a new
 * model), the freshly-imported `PrismaClient` symbol is a *different
 * class* from the one that constructed the cached instance. `instanceof`
 * against the new class returns false for the old instance, which is
 * exactly the signal we need to rebuild.
 *
 * Returning false here triggers a fresh instantiation — the old
 * instance is disconnected on a best-effort basis to release its
 * connection pool.
 *
 * @param client - The possibly-stale cached client from globalThis
 * @returns Whether `client` can be safely reused
 *
 * @author samir
 * @created 2026-04-06
 * @module Shared - DB Client
 */
function isCachedClientCurrent(client: PrismaClient | undefined): client is PrismaClient {
  return client instanceof PrismaClient;
}

const cachedClient = globalForPrisma.prisma;

if (cachedClient !== undefined && !isCachedClientCurrent(cachedClient)) {
  // Schema changed under us — drop the old client and release its pool.
  // We fire-and-forget $disconnect so this module initialisation stays
  // synchronous; a leaked connection or two in dev is acceptable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disconnect = (cachedClient as any)?.$disconnect;
  if (typeof disconnect === "function") {
    void disconnect.call(cachedClient).catch(() => {});
  }
}

export const db: PrismaClient = isCachedClientCurrent(cachedClient)
  ? cachedClient
  : createClient();

// Only cache on globalThis outside production — production processes don't hot reload.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
