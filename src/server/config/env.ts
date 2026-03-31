/**
 * Single source of truth for all server configuration.
 * Crashes at startup if any required variable is missing — intentional,
 * so misconfigured deploys fail immediately rather than at runtime.
 *
 * Always import from here instead of reading process.env directly.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Restricts NODE_ENV to known values so the rest of the app can branch safely.
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
