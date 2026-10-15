/**
 * The Botkeep OpenAPI document declares open (`{}`) response schemas, so payload
 * shapes are discovered at runtime. These helpers keep the UI useful without
 * guessing wrongly: they only surface values that are actually present.
 */

export type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export function kindOf(value: unknown): JsonKind {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "object") return "object";
  if (type === "string") return "string";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  return "null";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return kindOf(value) === "object";
}

/** Finds the first array of objects anywhere in a payload — the common list shape. */
export function findRecordArray(value: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 3) return null;
  if (Array.isArray(value)) {
    return value.every(isRecord) && value.length > 0 ? value : null;
  }
  if (!isRecord(value)) return null;
  const preferred = ["items", "data", "results", "workloads", "servers", "bots", "list", "records", "members", "tickets"];
  for (const key of preferred) {
    const found = findRecordArray(value[key], depth + 1);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = findRecordArray(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

const ID_KEYS = ["id", "workloadId", "workload_id", "serverId", "server_id", "uid", "uuid"];
const NAME_KEYS = ["name", "title", "label", "hostname", "alias", "slug"];
const STATE_KEYS = ["status", "state", "powerState", "power_state", "lifecycle", "health", "phase"];
const RUNTIME_KEYS = ["runtime", "runtimeVersion", "runtime_version", "platform", "stack", "language"];
const DOMAIN_KEYS = ["url", "domain", "hostname", "primaryDomain", "primary_domain", "address", "endpoint"];
const REGION_KEYS = ["region", "node", "cluster", "zone", "host", "location"];
const UPDATED_KEYS = ["updatedAt", "updated_at", "lastSeen", "last_seen", "lastActivity", "last_activity", "createdAt", "created_at"];

export type PickedField = { label: string; value: string; raw?: unknown };

function firstString(record: Record<string, unknown>, keys: string[]): { key: string; value: unknown } | null {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") continue;
    return { key, value };
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): { key: string; value: number } | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return { key, value };
  }
  return null;
}

export type WorkloadSummary = {
  id: string | null;
  idKey: string | null;
  name: string;
  state: unknown;
  platform: string | null;
  runtime: string | null;
  domain: string | null;
  region: string | null;
  updatedAt: unknown;
  metrics: { label: string; value: string }[];
  raw: Record<string, unknown>;
};

const MEMORY_KEYS = ["memoryLimitMb", "memory_limit_mb", "memoryMb", "memory_mb", "memory", "ramMb", "ram"];
const CPU_KEYS = ["cpuLimitPercent", "cpu_limit_percent", "cpuPercent", "cpu_percent", "cpu", "vcores", "vCores"];
const STORAGE_KEYS = ["storageLimitMb", "storage_limit_mb", "diskMb", "storage", "disk"];

/** Normalises one workload record, tolerating whatever field names the API used. */
export function summarizeWorkload(record: Record<string, unknown>): WorkloadSummary {
  const id = firstString(record, ID_KEYS);
  const name = firstString(record, NAME_KEYS);
  const state = firstString(record, STATE_KEYS);
  const platform = firstString(record, ["platform", "type", "kind"]);
  const runtime = firstString(record, RUNTIME_KEYS);
  const domain = firstString(record, DOMAIN_KEYS);
  const region = firstString(record, REGION_KEYS);
  const updated = firstString(record, UPDATED_KEYS);

  const metrics: { label: string; value: string }[] = [];
  const memory = pickNumber(record, MEMORY_KEYS);
  if (memory) {
    metrics.push({
      label: "Memory",
      value: `${memory.value >= 1024 ? `${(memory.value / 1024).toFixed(2)} GB` : `${memory.value} MB`}`,
    });
  }
  const cpu = pickNumber(record, CPU_KEYS);
  if (cpu) metrics.push({ label: "CPU", value: cpu.value > 100 ? `${(cpu.value / 100).toFixed(2)} vCPU` : `${cpu.value}%` });
  const storage = pickNumber(record, STORAGE_KEYS);
  if (storage) {
    metrics.push({
      label: "Storage",
      value: `${storage.value >= 1024 ? `${(storage.value / 1024).toFixed(2)} GB` : `${storage.value} MB`}`,
    });
  }

  return {
    id: id ? String(id.value) : null,
    idKey: id?.key ?? null,
    name: name ? String(name.value) : "Unnamed workload",
    state: state?.value ?? null,
    platform: platform ? String(platform.value) : null,
    runtime: runtime ? String(runtime.value) : null,
    domain: domain ? String(domain.value) : null,
    region: region ? String(region.value) : null,
    updatedAt: updated?.value ?? null,
    metrics,
    raw: record,
  };
}

/** Keys worth showing first in a generic detail view. */
export const PRIORITY_KEYS = [
  ...ID_KEYS,
  ...NAME_KEYS,
  ...STATE_KEYS,
  ...RUNTIME_KEYS,
  ...DOMAIN_KEYS,
  ...REGION_KEYS,
  ...MEMORY_KEYS,
  ...CPU_KEYS,
  ...STORAGE_KEYS,
  ...UPDATED_KEYS,
];

export function orderedEntries(record: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(record);
  entries.sort((a, b) => {
    const ai = PRIORITY_KEYS.indexOf(a[0]);
    const bi = PRIORITY_KEYS.indexOf(b[0]);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });
  return entries;
}

export function humanKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Small payload summary used in the request log and connect screen. */
export function describePayload(value: unknown): string {
  const kind = kindOf(value);
  if (kind === "array") return `${(value as unknown[]).length} item${(value as unknown[]).length === 1 ? "" : "s"}`;
  if (kind === "object") return `${Object.keys(value as object).length} keys`;
  if (kind === "null") return "empty response";
  return String(value).slice(0, 60);
}
