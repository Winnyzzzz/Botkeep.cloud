/**
 * Helpers for the queued-write flow.
 *
 * Write operations answer 202 Accepted and return an operation id; the work is
 * applied asynchronously. Response schemas are open in the OpenAPI document, so
 * these helpers read the id and state defensively and report what they found.
 */

const ID_KEYS = ["operationId", "operation_id", "operation", "requestId", "request_id", "id"];

const STATE_KEYS = ["state", "status", "phase", "stage", "outcome"];

const TERMINAL = new Set([
  "completed",
  "complete",
  "succeeded",
  "success",
  "done",
  "finished",
  "failed",
  "failure",
  "error",
  "errored",
  "rejected",
  "cancelled",
  "canceled",
  "expired",
  "rolled_back",
  "rolledback",
  "deleted",
]);

const PENDING_HINTS = /(queued|pending|accepted|running|progress|starting|working|in_progress|processing|deploying)/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Finds the queued operation id in a write acknowledgement. */
export function extractOperationId(payload: unknown, depth = 0): string | null {
  const record = asRecord(payload);
  if (!record || depth > 2) return null;

  for (const key of ID_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (asRecord(value)) {
      const nested = extractOperationId(value, depth + 1);
      if (nested) return nested;
    }
  }

  for (const value of Object.values(record)) {
    const nested = extractOperationId(value, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/** Finds the most relevant state string in an operation payload. */
export function extractOperationState(payload: unknown, depth = 0): string | null {
  const record = asRecord(payload);
  if (!record || depth > 2) return null;

  for (const key of STATE_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  for (const value of Object.values(record)) {
    const nested = extractOperationState(value, depth + 1);
    if (nested) return nested;
  }
  return null;
}

export function isTerminalState(state: string | null): boolean {
  if (!state) return false;
  const normalised = state.trim().toLowerCase().replace(/\s+/g, "_");
  if (PENDING_HINTS.test(normalised)) return false;
  return TERMINAL.has(normalised);
}

export function describeOperationState(state: string | null): "pending" | "success" | "failure" | "unknown" {
  if (!state) return "unknown";
  const normalised = state.trim().toLowerCase().replace(/\s+/g, "_");
  if (PENDING_HINTS.test(normalised)) return "pending";
  if (["failed", "failure", "error", "errored", "rejected", "cancelled", "canceled", "expired"].includes(normalised)) {
    return "failure";
  }
  if (isTerminalState(normalised)) return "success";
  return "unknown";
}
