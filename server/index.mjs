/**
 * Preview server: serves the built SPA and exposes the same-origin Botkeep proxy.
 *
 * The Botkeep API answers `Disallowed CORS origin` for third-party origins, so
 * the browser cannot call it directly. Requests are relayed here instead: this
 * process forwards the caller's bearer token to api.botkeep.cloud and streams
 * the response back. No credential is stored or logged.
 *
 * The production build serves the identical contract from `api/botkeep.py`.
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const upstreamBase = "https://api.botkeep.cloud/api/v1/developer";
const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const maxBodyBytes = 8 * 1024 * 1024;

// A key kept in the environment lets the console run without pasting anything.
// It is read here, forwarded upstream and never returned to the browser.
const KEY_ENV_NAMES = ["BOTKEEP_API_KEY", "BOTKEEP_KEY", "APIKEY"];

function serverKey() {
  for (const name of KEY_ENV_NAMES) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        rejectBody(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectBody);
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

/** Rejects anything that could escape the fixed upstream prefix. */
function safePath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("..") || value.includes(":") || value.includes("\\")) return null;
  if (value.endsWith("/api/botkeep")) return null;
  return value;
}

async function handleProxy(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { detail: "Use POST /api/botkeep with a JSON request envelope." }, { allow: "POST" });
    return;
  }

  const header = req.headers.authorization ?? "";
  const fallback = serverKey();
  const authorization = /^Bearer\s+\S+/.test(header) ? header : fallback ? `Bearer ${fallback}` : "";
  if (!authorization) {
    sendJson(res, 401, {
      detail: `A valid Botkeep API key is required. Send one from the console or set ${KEY_ENV_NAMES[0]} in the environment.`,
    });
    return;
  }

  let envelope;
  try {
    envelope = JSON.parse(await readBody(req) || "{}");
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, { detail: `Malformed request envelope: ${error.message}` });
    return;
  }

  const method = String(envelope.method ?? "GET").toUpperCase();
  if (!allowedMethods.has(method)) {
    sendJson(res, 400, { detail: `Unsupported method "${envelope.method}".` });
    return;
  }

  const path = safePath(envelope.path);
  if (!path) {
    sendJson(res, 400, { detail: "The envelope needs a relative `path` starting with `/`." });
    return;
  }

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(envelope.query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(name, String(value));
  }
  const query = search.toString();
  const target = `${upstreamBase}${path}${query ? `?${query}` : ""}`;

  const headers = { accept: "application/json", authorization };
  if (envelope.idempotencyKey) headers["idempotency-key"] = String(envelope.idempotencyKey);
  let payload;
  if (envelope.body !== undefined && envelope.body !== null) {
    payload = JSON.stringify(envelope.body);
    headers["content-type"] = "application/json";
  }

  try {
    const upstream = await fetch(target, { method, headers, body: payload });
    const text = await upstream.text();
    const passthrough = {};
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) passthrough["retry-after"] = retryAfter;
    const requestId = upstream.headers.get("x-request-id");
    if (requestId) passthrough["x-botkeep-request-id"] = requestId;
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...passthrough,
    });
    res.end(text);
  } catch (cause) {
    sendJson(res, 502, { detail: `Upstream Botkeep request failed: ${cause.message}` });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  let relative = decodeURIComponent(url.pathname);
  if (relative.endsWith("/")) relative += "index.html";

  const candidate = normalize(join(dist, relative));
  if (candidate.startsWith(dist + sep) && existsSync(candidate)) {
    const body = await readFile(candidate);
    res.writeHead(200, {
      "content-type": MIME[extname(candidate).toLowerCase()] ?? "application/octet-stream",
      "cache-control": relative.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
    return;
  }

  const index = join(dist, "index.html");
  if (!existsSync(index)) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    res.end("Build output missing. Run `vite build` before starting the preview server.");
    return;
  }
  const body = await readFile(index);
  res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-cache" });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/botkeep" || url.pathname.startsWith("/api/botkeep/")) {
    void handleProxy(req, res);
    return;
  }
  if (url.pathname === "/api/ping") {
    sendJson(res, 200, {
      ok: true,
      upstream: upstreamBase,
      serverKey: Boolean(serverKey()),
      keyEnvNames: KEY_ENV_NAMES,
    });
    return;
  }
  void serveStatic(req, res);
});

const port = Number(process.env.PORT ?? 5173);
server.listen(port, "0.0.0.0", () => {
  console.log(`Botkeep console preview listening on http://0.0.0.0:${port} (serving ${dist})`);
});
