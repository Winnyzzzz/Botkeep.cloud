/**
 * Smoke-tests the preview server and the /api/botkeep relay.
 *
 *   bun run verify:preview
 *
 * Builds nothing: run `bun run build` first so dist/ exists. The script starts
 * the server on a private port, exercises the static routes, the relay's input
 * guards and real upstream passthrough, then shuts the server down again.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.VERIFY_PORT ?? 5199);
const base = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, ["server/index.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (chunk) => (serverLog += chunk));
child.stderr.on("data", (chunk) => (serverLog += chunk));

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/ping`);
      if (response.ok) return true;
    } catch {
      /* still starting */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  return false;
}

function post(payload) {
  return fetch(`${base}/api/botkeep`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(payload.auth ? { authorization: payload.auth } : {}),
    },
    body: JSON.stringify(payload.body ?? {}),
  });
}

const results = [];
async function check(name, fn) {
  try {
    results.push([name, String(await fn()).replace(/\s+/g, " ").slice(0, 78)]);
  } catch (error) {
    results.push([name, `THREW ${error.message}`]);
  }
}

if (!(await waitForReady())) {
  console.error("Server never became ready:\n", serverLog);
  child.kill();
  process.exit(1);
}

await check("static index served", async () => {
  const response = await fetch(`${base}/`);
  const html = await response.text();
  return `${response.status} root=${html.includes('id="root"')}`;
});

await check("SPA fallback for /console", async () => {
  const response = await fetch(`${base}/console`);
  const html = await response.text();
  return `${response.status} hasBundle=${/assets\/index-.*\.js/.test(html)}`;
});

await check("bundled OpenAPI spec", async () => {
  const response = await fetch(`${base}/openapi.json`);
  const spec = await response.json();
  return `${response.status} operations=${Object.keys(spec.paths).length}`;
});

const ping = await (await fetch(`${base}/api/ping`)).json();
console.log(`relay mode: serverKey=${ping.serverKey} envNames=${(ping.keyEnvNames ?? []).join("/")}\n`);

await check("relay without key", async () => {
  const response = await post({ body: { method: "GET", path: "/workloads" } });
  const text = await response.text();
  if (ping.serverKey) {
    // The relay fell back to the environment key, so this is a live read.
    return `env key used -> ${response.status} (expected 200 or an upstream error) ${text.slice(0, 40)}`;
  }
  return `${response.status} ${text}`;
});

// Only key names and status codes are reported here — never response values.
await check("LIVE env key capabilities (no header sent)", async () => {
  const response = await post({ body: { method: "GET", path: "/capabilities" } });
  if (!response.ok) return `HTTP ${response.status} ${(await response.text()).slice(0, 80)}`;
  const data = await response.json();
  const keys = data && typeof data === "object" ? Object.keys(data).slice(0, 8).join(",") : typeof data;
  return `HTTP ${response.status} topLevelKeys=[${keys}]`;
});

await check("relay rejects path traversal", async () => {
  const response = await post({ auth: "Bearer x", body: { method: "GET", path: "/../health" } });
  return `${response.status} ${await response.text()}`;
});

await check("relay rejects absolute URLs", async () => {
  const response = await post({ auth: "Bearer x", body: { method: "GET", path: "https://evil.example.com" } });
  return `${response.status} ${await response.text()}`;
});

await check("relay rejects unsupported verbs", async () => {
  const response = await post({ auth: "Bearer x", body: { method: "TRACE", path: "/workloads" } });
  return `${response.status} ${await response.text()}`;
});

await check("relay rejects non-POST envelope", async () => {
  const response = await fetch(`${base}/api/botkeep`);
  return `${response.status} ${await response.text()}`;
});

await check("LIVE upstream 401 passthrough (/workloads)", async () => {
  const response = await post({
    auth: "Bearer invalid-key-verification",
    body: { method: "GET", path: "/workloads", query: { limit: 1 } },
  });
  return `${response.status} ct=${response.headers.get("content-type")} ${await response.text()}`;
});

await check("LIVE upstream 401 passthrough (/plan)", async () => {
  const response = await post({ auth: "Bearer invalid-key-verification", body: { method: "GET", path: "/plan" } });
  return `${response.status} ${await response.text()}`;
});

await check("LIVE create-workload envelope reaches upstream", async () => {
  const response = await post({
    auth: "Bearer invalid-key-verification",
    body: {
      method: "POST",
      path: "/workloads",
      idempotencyKey: "verifycreate123456789",
      body: {
        name: "verify-probe",
        platform: "general",
        runtime: "node",
        runtimeVersion: "22",
        sourceType: "blank",
        repository: null,
        branch: "main",
        startCommand: "npm start",
        resources: { memoryLimitMb: 512, cpuLimitPercent: 50, storageLimitMb: 1024 },
      },
    },
  });
  return `${response.status} ${await response.text()}`;
});

await check("LIVE write envelope reaches upstream", async () => {
  const response = await post({
    auth: "Bearer invalid-key-verification",
    body: {
      method: "POST",
      path: "/workloads/wk_sample/actions",
      body: { action: "restart" },
      idempotencyKey: "abcdefghij123456",
    },
  });
  return `${response.status} ${await response.text()}`;
});

for (const [name, value] of results) console.log(`${name.padEnd(42)} | ${value}`);
child.kill();
process.exit(0);
