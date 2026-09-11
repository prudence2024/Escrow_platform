/**
 * Shared API middleware (Phase 4, §8–§9, §30–§32).
 * Request IDs are always server-generated (incoming values ignored —
 * the safest §8 option). Logging carries safe fields only.
 */
import type { Context, Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Logger } from "../observability/logger.js";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const MAX_BODY_BYTES = 100 * 1024;

/** Shared Hono environment: every handler can read c.get("requestId"). */
export interface ApiEnv {
  Variables: {
    requestId: string;
  };
}

export function requestId() {
  return async (c: Context, next: Next): Promise<void> => {
    const id = crypto.randomUUID();
    c.set("requestId", id);
    await next();
    c.header(REQUEST_ID_HEADER, id);
  };
}

export function requestLogger(logger: Logger) {
  return async (c: Context, next: Next): Promise<void> => {
    const started = Date.now();
    await next();
    logger.log("info", "request", {
      requestId: String(c.get("requestId") ?? ""),
      route: c.req.routePath,
      method: c.req.method,
      status: c.res.status,
      durationMs: Date.now() - started,
    });
  };
}

/**
 * Baseline headers for the JSON API (same in dev and production).
 * A stricter deployment CSP lives on the hosting layer; the API serves no
 * HTML so framing/scripting surfaces are denied here directly.
 */
export function apiSecurityHeaders() {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: "same-origin",
  });
}

/**
 * CORS: same-origin by default (no middleware). When an explicit allowlist
 * is configured, reflect exactly those origins — never '*'. No credentials:
 * Phase 4 has no cookie sessions (Authorization-style bearer only later).
 */
export function apiCors(allowedOrigins: string[]) {
  if (allowedOrigins.length === 0) {
    return async (_c: Context, next: Next): Promise<void> => {
      await next();
    };
  }
  return cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 600,
    credentials: false,
  });
}

export function apiBodyLimit() {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => {
      const requestId = String(c.get("requestId") ?? "");
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Request body too large",
            requestId,
          },
        },
        413,
      );
    },
  });
}
