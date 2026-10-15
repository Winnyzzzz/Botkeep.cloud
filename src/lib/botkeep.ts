/**
 * Botkeep Developer API client.
 *
 * The Botkeep API only accepts browser requests from its own origins
 * (`Disallowed CORS origin` on every preflight from a third-party origin), so the
 * browser never calls `api.botkeep.cloud` directly. Requests are sent to this
 * app's own `/api/botkeep` endpoint, which forwards them upstream. The key is
 * either the one the user pasted here, or the one the relay reads from the
 * environment (`BOTKEEP_API_KEY` / `BOTKEEP_KEY` / `APIKEY`) when no key is sent.
 */
import { newIdempotencyKey } from "./utils";

export const SPEC_BASE_URL = "https://api.botkeep.cloud/api/v1/developer";
export const PROXY_URL = "/api/botkeep";
export const KEY_STORAGE = "botkeep.console.key";

export type RequestSpec = {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Supplied automatically for write operations when omitted. */
  idempotencyKey?: string;
};

export type BotkeepError = {
  status: number;
  message: string;
  retryAfter: number | null;
  validation: { loc: (string | number)[]; msg: string }[] | null;
};

export type CallResult<T> =
  | { ok: true; data: T; status: number; durationMs: number }
  | { ok: false; error: BotkeepError; durationMs: number };

export type RelayStatus = {
  ok: boolean;
  upstream: string;
  serverKey: boolean;
  keyEnvNames: string[];
};

export function readStoredKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredKey(key: string): void {
  try {
    window.localStorage.setItem(KEY_STORAGE, key);
  } catch {
    /* storage unavailable — the key stays in memory for this session */
  }
}

export function clearStoredKey(): void {
  try {
    window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function maskKey(key: string): string {
  if (key.length <= 10) return "••••";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/** Asks the relay whether it holds a key of its own in the environment. */
export async function fetchRelayStatus(): Promise<RelayStatus | null> {
  try {
    const response = await fetch("/api/ping", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return (await response.json()) as RelayStatus;
  } catch {
    return null;
  }
}

/** Builds the API-relative path plus query string for display and for the proxy. */
export function buildPath(spec: Pick<RequestSpec, "path" | "query">): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(spec.query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(name, String(value));
  }
  const query = search.toString();
  return query ? `${spec.path}?${query}` : spec.path;
}

function errorFrom(status: number, payload: unknown, retryAfter: number | null): BotkeepError {
  let message = `Yêu cầu thất bại với HTTP ${status}`;
  let validation: BotkeepError["validation"] = null;

  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    validation = detail.map((item) => ({
      loc: Array.isArray((item as { loc?: unknown[] }).loc) ? ((item as { loc: (string | number)[] }).loc ?? []) : [],
      msg: String((item as { msg?: unknown }).msg ?? "Giá trị không hợp lệ"),
    }));
    message = validation[0]?.msg ?? message;
  } else if (typeof (payload as { message?: unknown } | null)?.message === "string") {
    message = String((payload as { message: string }).message);
  }

  if (status === 401) {
    message = "Botkeep từ chối API key. Hãy kiểm tra key còn hiệu lực, chưa hết hạn và chưa bị thu hồi.";
  }
  if (status === 403) message = "Key này thiếu quyền (scope) mà thao tác yêu cầu.";
  if (status === 404) message = "Botkeep không tìm thấy tài nguyên hoặc đường dẫn này.";
  if (status === 429) message = "Đã chạm giới hạn tốc độ. Chờ cửa sổ làm mới rồi thử lại.";

  return { status, message, retryAfter, validation };
}

/**
 * Sends one request through the same-origin proxy.
 * Pass `null` as the key to let the relay use its environment key.
 * Never throws for API-level failures — inspect `ok` on the result.
 */
export async function callBotkeep<T = unknown>(
  key: string | null,
  spec: RequestSpec,
): Promise<CallResult<T>> {
  const started = performance.now();
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(spec.method.toUpperCase());
  const idempotencyKey = spec.idempotencyKey ?? (write ? newIdempotencyKey() : undefined);

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        method: spec.method.toUpperCase(),
        path: spec.path,
        query: spec.query ?? {},
        body: spec.body,
        idempotencyKey,
      }),
    });

    const durationMs = Math.round(performance.now() - started);
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { detail: text.slice(0, 400) };
      }
    }

    if (!response.ok) {
      const retryAfterHeader = response.headers.get("retry-after");
      const parsed = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      return {
        ok: false,
        error: errorFrom(response.status, payload, Number.isFinite(parsed) ? parsed : null),
        durationMs,
      };
    }

    return { ok: true, data: payload as T, status: response.status, durationMs };
  } catch (cause) {
    return {
      ok: false,
      error: {
        status: 0,
        message: `Không gọi được relay tại ${PROXY_URL}. ${(cause as Error).message}`,
        retryAfter: null,
        validation: null,
      },
      durationMs: Math.round(performance.now() - started),
    };
  }
}

/** Renders a request as a copy-pasteable cURL command for the real API. */
export function toCurl(spec: RequestSpec, keyPlaceholder = "$BOTKEEP_API_KEY"): string {
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(spec.method.toUpperCase());
  const lines = [
    `curl --fail-with-body -X ${spec.method.toUpperCase()} \\`,
    `  -H "Authorization: Bearer ${keyPlaceholder}" \\`,
  ];
  if (write) lines.push(`  -H "Idempotency-Key: ${spec.idempotencyKey ?? newIdempotencyKey()}" \\`);
  if (spec.body !== undefined) lines.push(`  -H "Content-Type: application/json" \\`);
  if (spec.body !== undefined) lines.push(`  -d '${JSON.stringify(spec.body)}' \\`);
  lines.push(`  "${SPEC_BASE_URL}${buildPath(spec)}"`);
  return lines.join("\n");
}
