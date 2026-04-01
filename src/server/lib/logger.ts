type LogLevel = "info" | "warn" | "error";

interface LogContext {
  route?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

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
  info(msg: string, ctx?: LogContext) {
    console.log(formatLog("info", msg, ctx));
  },

  warn(msg: string, ctx?: LogContext) {
    console.warn(formatLog("warn", msg, ctx));
  },

  error(msg: string, ctx?: LogContext, err?: unknown) {
    console.error(formatLog("error", msg, ctx, err));
  },
};
