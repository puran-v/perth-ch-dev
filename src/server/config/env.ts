// Old Author: jay
// New Author: samir
// Impact: added JSDoc with @author, @created, @module annotations
// Reason: align with PROJECT_RULES.md §4.2 function documentation requirement

/**
 * Single source of truth for all server configuration.
 * Crashes at startup if any required variable is missing — intentional,
 * so misconfigured deploys fail immediately rather than at runtime.
 *
 * Always import from here instead of reading process.env directly.
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Configuration
 */

/**
 * Reads a required environment variable or throws immediately.
 * Intentionally fails fast so misconfigured deploys are caught at startup.
 *
 * @param key - The environment variable name
 * @returns The environment variable value
 * @throws If the variable is not set
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Configuration
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Validates and returns NODE_ENV as a strict union type.
 * Restricts to known values so the rest of the app can branch safely.
 *
 * @returns The validated NODE_ENV value
 * @throws If NODE_ENV is set to an unrecognised value
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Configuration
 */
function getNodeEnv(): "development" | "production" | "test" {
  const value = process.env.NODE_ENV ?? "development";
  if (value !== "development" && value !== "production" && value !== "test") {
    throw new Error(`Invalid NODE_ENV: "${value}". Must be development, production, or test.`);
  }
  return value;
}

export const env = {
  NODE_ENV: getNodeEnv(),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  APP_URL: requireEnv("APP_URL"),
  AUTH_SECRET: requireEnv("AUTH_SECRET"),
} as const;
