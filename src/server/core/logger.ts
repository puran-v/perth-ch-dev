/**
 * Thin logger wrapper around console.
 *
 * All non-error output is silenced in test to keep test output clean.
 * To swap in Pino or another library later, only this file needs to change.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV === "development";

function formatMessage(level: LogLevel, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    if (isTest) return;
    console.log(formatMessage("info", message), ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    if (isTest) return;
    console.warn(formatMessage("warn", message), ...args);
  },

  error(message: string, ...args: unknown[]): void {
    // Errors are always logged — suppressing them in tests would hide real failures.
    console.error(formatMessage("error", message), ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.debug(formatMessage("debug", message), ...args);
  },
};
