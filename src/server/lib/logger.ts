/**
 * Structured JSON logger for all server-side logging.
 *
 * Outputs one JSON line per log entry so log aggregators (Sentry, Datadog,
 * Logtail) can parse without extra configuration. Stack traces are only
 * included in development to avoid leaking internals in production.
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Logging
 */

// Old Author: jay
// New Author: samir
// Impact: added JSDoc annotations to all functions and types
// Reason: align with PROJECT_RULES.md §4.2 function documentation requirement

type LogLevel = "info" | "warn" | "error";

/** Context attached to every log entry for traceability */
interface LogContext {
  route?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Formats a log entry as a JSON string with timestamp, level, message,
 * context fields, and optional error details.
 *
 * @param level - The severity level of the log entry
 * @param msg - Human-readable log message
 * @param ctx - Optional structured context (route, requestId, userId, etc.)
 * @param err - Optional error object to include stack trace (dev only)
 * @returns Serialised JSON string for stdout/stderr
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Logging
 */
function formatLog(level: LogLevel, msg: string, ctx?: LogContext, err?: unknown) {
  const entry: Record<string, unknown> = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...ctx,
  };

  if (err instanceof Error) {
    entry.err = {
      message: err.message,
      name: err.name,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    };
  } else if (err !== undefined) {
    entry.err = String(err);
  }

  return JSON.stringify(entry);
}

export const logger = {
  /**
   * Logs an informational message.
   *
   * @param msg - The log message
   * @param ctx - Optional structured context
   *
   * @author jay
   * @created 2026-04-01
   * @module Shared - Logging
   */
  info(msg: string, ctx?: LogContext) {
    console.log(formatLog("info", msg, ctx));
  },

  /**
   * Logs a warning message.
   *
   * @param msg - The log message
   * @param ctx - Optional structured context
   *
   * @author jay
   * @created 2026-04-01
   * @module Shared - Logging
   */
  warn(msg: string, ctx?: LogContext) {
    console.warn(formatLog("warn", msg, ctx));
  },

  /**
   * Logs an error message with optional error object.
   *
   * @param msg - The log message
   * @param ctx - Optional structured context
   * @param err - Optional error to extract message/stack from
   *
   * @author jay
   * @created 2026-04-01
   * @module Shared - Logging
   */
  error(msg: string, ctx?: LogContext, err?: unknown) {
    console.error(formatLog("error", msg, ctx, err));
  },
};
