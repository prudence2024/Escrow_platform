/**
 * Minimal structured logging seam (Phase 4, §9, §39).
 * JSON lines to stdout; no heavy platform. NEVER log secrets, tokens,
 * headers, bodies, OTP, bank/KYC content — call sites pass only the
 * allowlisted fields below.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  code?: string;
  [key: string]: unknown;
}

export interface Logger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
}

const FORBIDDEN_KEYS = [
  "password",
  "otp",
  "token",
  "authorization",
  "cookie",
  "secret",
  "bank",
  "kyc",
];

function scrub(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.some((banned) => lower.includes(banned))) {
      out[key] = "[redacted]";
    } else if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…[truncated]`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function createConsoleLogger(): Logger {
  return {
    log(level: LogLevel, message: string, fields: LogFields = {}): void {
      const record = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...scrub(fields),
      };
      const line = JSON.stringify(record);
      if (level === "error" || level === "warn") {
        console.error(line);
      } else {
        console.log(line);
      }
    },
  };
}
