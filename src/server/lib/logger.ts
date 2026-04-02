/**
 * Structured logger for all server-side logging.
 *
 * Development: Human-readable, colored output with context details for
 * easy terminal debugging.
 * Production: One JSON line per log entry so log aggregators (Sentry,
 * Datadog, Logtail) can parse without extra configuration.
 *
 * Stack traces are only included in development to avoid leaking
 * internals in production.
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Logging
 */

// Old Author: jay
// New Author: samir
// Impact: added colored dev output, kept JSON for production, improved readability
// Reason: beautify server logs for development per team request

type LogLevel = "info" | "warn" | "error";

/** Context attached to every log entry for traceability */
interface LogContext {
  route?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== "production";

// ── ANSI colour codes for terminal output ────────────────────────────
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  magenta: "\x1b[35m",

  // Background
  bgCyan: "\x1b[46m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
} as const;

/** Level badge config — symbol, label colour, and badge colour */
const LEVEL_CONFIG: Record<LogLevel, { badge: string; color: string; bgColor: string }> = {
  info: { badge: " INFO  ", color: COLORS.cyan, bgColor: COLORS.bgCyan },
  warn: { badge: " WARN  ", color: COLORS.yellow, bgColor: COLORS.bgYellow },
  error: { badge: " ERROR ", color: COLORS.red, bgColor: COLORS.bgRed },
};

/**
 * Formats a timestamp for dev output: HH:MM:SS.mmm
 *
 * @param date - The date to format
 * @returns Formatted time string
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Logging
 */
function devTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

/**
 * Formats a log entry as a coloured, human-readable string for the terminal.
 * Only used in development.
 *
 * @param level - The severity level of the log entry
 * @param msg - Human-readable log message
 * @param ctx - Optional structured context (route, requestId, userId, etc.)
 * @param err - Optional error object to include stack trace
 * @returns Formatted, coloured string for stdout/stderr
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Logging
 */
function formatDev(level: LogLevel, msg: string, ctx?: LogContext, err?: unknown): string {
  const { badge, color } = LEVEL_CONFIG[level];
  const now = new Date();
  const ts = `${COLORS.dim}${devTimestamp(now)}${COLORS.reset}`;
  const levelTag = `${color}${COLORS.bold}${badge}${COLORS.reset}`;
  const message = `${COLORS.white}${msg}${COLORS.reset}`;

  // Build context parts
  const parts: string[] = [];
  if (ctx?.route) {
    parts.push(`${COLORS.magenta}${ctx.route}${COLORS.reset}`);
  }
  if (ctx?.requestId) {
    parts.push(`${COLORS.dim}req:${ctx.requestId.slice(0, 8)}${COLORS.reset}`);
  }
  if (ctx?.userId) {
    parts.push(`${COLORS.green}user:${ctx.userId.slice(0, 8)}${COLORS.reset}`);
  }

  // Extra context keys (exclude route, requestId, userId — already shown)
  const extraKeys = ctx
    ? Object.entries(ctx).filter(
        ([k]) => !["route", "requestId", "userId"].includes(k)
      )
    : [];
  for (const [key, value] of extraKeys) {
    parts.push(`${COLORS.dim}${key}=${JSON.stringify(value)}${COLORS.reset}`);
  }

  const ctxStr = parts.length > 0 ? ` ${COLORS.dim}|${COLORS.reset} ${parts.join("  ")}` : "";

  let output = `${ts}  ${levelTag}  ${message}${ctxStr}`;

  // Error details
  if (err instanceof Error) {
    output += `\n${COLORS.red}  ${COLORS.bold}${err.name}: ${err.message}${COLORS.reset}`;
    if (err.stack) {
      const stackLines = err.stack
        .split("\n")
        .slice(1, 6)
        .map((line) => `${COLORS.dim}  ${line.trim()}${COLORS.reset}`)
        .join("\n");
      output += `\n${stackLines}`;
    }
  } else if (err !== undefined) {
    output += `\n${COLORS.red}  ${String(err)}${COLORS.reset}`;
  }

  return output;
}

/**
 * Formats a log entry as a JSON string for production log aggregators.
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
function formatJson(level: LogLevel, msg: string, ctx?: LogContext, err?: unknown): string {
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
    console.log(isDev ? formatDev("info", msg, ctx) : formatJson("info", msg, ctx));
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
    console.warn(isDev ? formatDev("warn", msg, ctx) : formatJson("warn", msg, ctx));
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
    console.error(
      isDev ? formatDev("error", msg, ctx, err) : formatJson("error", msg, ctx, err)
    );
  },
};
