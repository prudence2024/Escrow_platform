/**
 * Standard API error envelope (Phase 4, §7).
 * { error: { code, message, requestId } } — stable codes, safe messages,
 * never stack traces / SQL / secrets / internal paths.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "DATABASE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "IDEMPOTENCY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "VERSION_CONFLICT"
  | "DRAFT_NOT_EDITABLE"
  | "AMOUNT_LIMIT_EXCEEDED"
  | "WRITE_NOT_ENABLED";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export const badRequest = (message = "Invalid request"): ApiError =>
  new ApiError("BAD_REQUEST", 400, message);

export const unauthenticated = (message = "Authentication required"): ApiError =>
  new ApiError("UNAUTHENTICATED", 401, message);

export const forbidden = (message = "Forbidden"): ApiError =>
  new ApiError("FORBIDDEN", 403, message);

/**
 * Existence-hiding denial for object lookups: callers cannot distinguish
 * "no such transaction" from "not yours". Prevents ID enumeration.
 */
export const notFound = (message = "Not found"): ApiError =>
  new ApiError("NOT_FOUND", 404, message);

export const serviceUnavailable = (message = "Service temporarily unavailable"): ApiError =>
  new ApiError("SERVICE_UNAVAILABLE", 503, message);

export function databaseUnavailable(): ApiError {
  return new ApiError("DATABASE_UNAVAILABLE", 503, "Service temporarily unavailable");
}

export const idempotencyRequired = (message = "Idempotency-Key header required"): ApiError =>
  new ApiError("IDEMPOTENCY_REQUIRED", 400, message);

export const idempotencyConflict = (message = "Idempotency conflict"): ApiError =>
  new ApiError("IDEMPOTENCY_CONFLICT", 409, message);

export const versionConflict = (message = "Version conflict"): ApiError =>
  new ApiError("VERSION_CONFLICT", 409, message);

export const draftNotEditable = (message = "Draft is no longer editable"): ApiError =>
  new ApiError("DRAFT_NOT_EDITABLE", 409, message);

export const amountLimitExceeded = (message = "Amount exceeds business limit"): ApiError =>
  new ApiError("AMOUNT_LIMIT_EXCEEDED", 400, message);

export const writeNotEnabled = (message = "Write operations are not enabled"): ApiError =>
  new ApiError("WRITE_NOT_ENABLED", 403, message);

export interface ErrorEnvelope {
  error: { code: ApiErrorCode; message: string; requestId: string };
}

export function toEnvelope(error: ApiError, requestId: string): ErrorEnvelope {
  return { error: { code: error.code, message: error.message, requestId } };
}

/**
 * Map unknown throws to safe envelopes. AuthzError messages are
 * pre-authored safe strings; everything else becomes generic. The caller
 * (route layer) logs the original server-side with requestId.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  // MoneyError: has .name = "MoneyError" but no .code property — check by name.
  if (error instanceof Error && error.name === "MoneyError") {
    return badRequest(error.message);
  }
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = String((error as Record<string, unknown>)["code"]);
    if (code === "UNAUTHENTICATED") return unauthenticated();
    if (code === "GUEST_BLOCKED" || code === "FORBIDDEN") return forbidden();
    if (code === "NOT_PARTICIPANT") return notFound("Not found");
    if (code === "ROLE_REQUIRED" || code === "CAPABILITY_REQUIRED") return forbidden();
    if (code === "STEP_UP_REQUIRED") {
      return new ApiError("FORBIDDEN", 403, "Step-up authentication required");
    }
  }
  const message = error instanceof Error ? error.message : "";
  // Libsql/SQLite/driver failures (including closed/unreachable connections):
  // never leak SQL or driver text to clients.
  if (
    /libsql|sqlite|SQLITE/i.test(message) ||
    /client[^a-z]*closed|connection[^a-z]*(closed|refused|failed)|connect[^a-z]*failed/i.test(message) ||
    (error !== null &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as Record<string, unknown>)["code"] === "string" &&
      String((error as Record<string, unknown>)["code"]).startsWith("SQLITE"))
  ) {
    return databaseUnavailable();
  }
  return new ApiError("INTERNAL_ERROR", 500, "Internal error");
}
