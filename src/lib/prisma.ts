/**
 * Re-exports the Prisma client singleton from the server module.
 * This file exists to match the PROJECT_RULES.md structure convention
 * (lib/prisma.ts) while the actual implementation lives in server/db/client.ts.
 *
 * @author AI-assisted
 * @created 2026-04-02
 * @module Shared
 */

export { db } from "@/server/db/client";
