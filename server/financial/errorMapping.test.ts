/**
 * Error Mapping Tests
 *
 * Validates that financial error codes are correctly mapped through the Hono API
 * handler to appropriate HTTP status codes.
 */
import { describe, it, expect } from "vitest";
import { FINANCIAL_ERRORS } from "../../src/convex/config";

/**
 * Simulates the error mapping that the Hono API handler performs.
 * Maps Convex error names to HTTP status codes.
 */
function mapFinancialErrorToHttp(error: Error): { status: number; code: string } {
  const msg = error.message;

  if (msg.includes("exceeds remaining refundable")) {
    return { status: 422, code: FINANCIAL_ERRORS.REFUND_EXCEEDS_CAP };
  }
  if (msg.includes("Payment not in SECURED status")) {
    return { status: 409, code: FINANCIAL_ERRORS.PAYMENT_NOT_INTENT };
  }
  if (msg.includes("Invalid state transition")) {
    return { status: 409, code: FINANCIAL_ERRORS.INVALID_STATE_TRANSITION };
  }
  if (msg.includes("Transaction not found")) {
    return { status: 404, code: FINANCIAL_ERRORS.TRANSACTION_NOT_FOUND };
  }
  if (msg.includes("Dispute not in OPEN status")) {
    return { status: 409, code: FINANCIAL_ERRORS.DISPUTE_NOT_OPEN };
  }
  if (msg.includes("Delivery fee must be non-negative")) {
    return { status: 422, code: FINANCIAL_ERRORS.DELIVERY_FEE_NEGATIVE };
  }
  if (msg.includes("Amount below minimum")) {
    return { status: 422, code: FINANCIAL_ERRORS.AMOUNT_BELOW_MINIMUM };
  }
  if (msg.includes("Amount exceeds limit")) {
    return { status: 422, code: FINANCIAL_ERRORS.AMOUNT_EXCEEDS_LIMIT };
  }

  return { status: 500, code: "UNKNOWN" };
}

describe("error mapping: financial errors to HTTP", () => {
  it("refund exceeds cap → 422", () => {
    const err = new Error("Refund amount 100000 exceeds remaining refundable 50000");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(422);
    expect(result.code).toBe(FINANCIAL_ERRORS.REFUND_EXCEEDS_CAP);
  });

  it("payment not secured → 409", () => {
    const err = new Error("Payment not in SECURED status");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(409);
    expect(result.code).toBe(FINANCIAL_ERRORS.PAYMENT_NOT_INTENT);
  });

  it("invalid state transition → 409", () => {
    const err = new Error("Invalid state transition: DRAFT -> SETTLED");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(409);
    expect(result.code).toBe(FINANCIAL_ERRORS.INVALID_STATE_TRANSITION);
  });

  it("transaction not found → 404", () => {
    const err = new Error("Transaction not found");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(404);
    expect(result.code).toBe(FINANCIAL_ERRORS.TRANSACTION_NOT_FOUND);
  });

  it("dispute not open → 409", () => {
    const err = new Error("Dispute not in OPEN status");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(409);
    expect(result.code).toBe(FINANCIAL_ERRORS.DISPUTE_NOT_OPEN);
  });

  it("negative delivery fee → 422", () => {
    const err = new Error("Delivery fee must be non-negative");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(422);
    expect(result.code).toBe(FINANCIAL_ERRORS.DELIVERY_FEE_NEGATIVE);
  });

  it("amount below minimum → 422", () => {
    const err = new Error("Amount below minimum");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(422);
    expect(result.code).toBe(FINANCIAL_ERRORS.AMOUNT_BELOW_MINIMUM);
  });

  it("amount exceeds limit → 422", () => {
    const err = new Error("Amount exceeds limit");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(422);
    expect(result.code).toBe(FINANCIAL_ERRORS.AMOUNT_EXCEEDS_LIMIT);
  });

  it("unknown error → 500", () => {
    const err = new Error("Something unexpected happened");
    const result = mapFinancialErrorToHttp(err);
    expect(result.status).toBe(500);
    expect(result.code).toBe("UNKNOWN");
  });
});

describe("error codes: consistency", () => {
  it("all error codes are defined", () => {
    expect(FINANCIAL_ERRORS.REFUND_EXCEEDS_CAP).toBeDefined();
    expect(FINANCIAL_ERRORS.PAYMENT_NOT_INTENT).toBeDefined();
    expect(FINANCIAL_ERRORS.INVALID_STATE_TRANSITION).toBeDefined();
    expect(FINANCIAL_ERRORS.TRANSACTION_NOT_FOUND).toBeDefined();
    expect(FINANCIAL_ERRORS.DISPUTE_NOT_OPEN).toBeDefined();
    expect(FINANCIAL_ERRORS.DELIVERY_FEE_NEGATIVE).toBeDefined();
    expect(FINANCIAL_ERRORS.AMOUNT_BELOW_MINIMUM).toBeDefined();
    expect(FINANCIAL_ERRORS.AMOUNT_EXCEEDS_LIMIT).toBeDefined();
  });

  it("error codes are strings", () => {
    Object.values(FINANCIAL_ERRORS).forEach((code) => {
      expect(typeof code).toBe("string");
    });
  });

  it("error codes have consistent prefix", () => {
    Object.values(FINANCIAL_ERRORS).forEach((code) => {
      expect(code).toMatch(/^FINANCIAL_/);
    });
  });

  it("no duplicate error codes", () => {
    const codes = Object.values(FINANCIAL_ERRORS);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
