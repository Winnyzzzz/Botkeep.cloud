import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Idempotency keys must match ^[A-Za-z0-9_-]{16,64}$. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 32);
}

export function formatMb(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 1024) return `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB`;
  return `${value} MB`;
}

export function formatPercent(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${(value / 100).toFixed(2)} vCPU`;
}

export function relativeTime(input: unknown): string | null {
  let ms: number | null = null;
  if (typeof input === "number") ms = input < 1e12 ? input * 1000 : input;
  if (typeof input === "string") {
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed)) ms = parsed;
  }
  if (ms === null) return null;
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [1000, "s"],
    [60_000, "m"],
    [3_600_000, "h"],
    [86_400_000, "d"],
  ];
  if (abs < 1000) return "just now";
  if (abs < 60_000) return `${Math.round(abs / units[0][0])}s ${diff >= 0 ? "ago" : "from now"}`;
  if (abs < 3_600_000) return `${Math.round(abs / units[1][0])}m ${diff >= 0 ? "ago" : "from now"}`;
  if (abs < 86_400_000) return `${Math.round(abs / units[2][0])}h ${diff >= 0 ? "ago" : "from now"}`;
  return `${Math.round(abs / units[3][0])}d ${diff >= 0 ? "ago" : "from now"}`;
}

export function formatNumber(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US").format(value);
}

const RUNNING = new Set(["running", "online", "active", "started", "healthy", "ready", "up"]);
const PENDING = new Set(["starting", "pending", "building", "deploying", "queued", "restarting", "provisioning"]);
const STOPPED = new Set(["stopped", "offline", "suspended", "halted", "idle", "exited"]);
const FAILED = new Set(["failed", "error", "errored", "crashed", "unhealthy", "dead", "killed"]);

export type StateKind = "running" | "pending" | "stopped" | "failed" | "unknown";

export function stateKind(input: unknown): StateKind {
  const value = String(input ?? "").toLowerCase();
  if (!value) return "unknown";
  if (RUNNING.has(value)) return "running";
  if (PENDING.has(value)) return "pending";
  if (STOPPED.has(value)) return "stopped";
  if (FAILED.has(value)) return "failed";
  return "unknown";
}

export const STATE_CLASS: Record<StateKind, string> = {
  running: "border-signal/40 bg-signal/10 text-signal-soft",
  pending: "border-warn/40 bg-warn/10 text-warn",
  stopped: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  failed: "border-danger/40 bg-danger/10 text-danger",
  unknown: "border-ink-600 bg-ink-800 text-slate-400",
};

export function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "text-signal";
  if (status === 429) return "text-warn";
  if (status >= 400 && status < 500) return "text-warn";
  return "text-danger";
}

export function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "border-wire/40 bg-wire/10 text-wire";
    case "POST":
      return "border-signal/40 bg-signal/10 text-signal-soft";
    case "PUT":
      return "border-warn/40 bg-warn/10 text-warn";
    case "PATCH":
      return "border-purple-400/40 bg-purple-400/10 text-purple-300";
    case "DELETE":
      return "border-danger/40 bg-danger/10 text-danger";
    default:
      return "border-ink-600 bg-ink-800 text-slate-300";
  }
}
