/**
 * Sample payloads for the console's preview mode.
 *
 * These are invented values shaped like the documented resources. They are only
 * ever returned while "dữ liệu mẫu" is switched on, and every view that renders
 * them says so — they are never presented as data from your account.
 */
import type { CallResult, RequestSpec } from "./botkeep";

const WORKLOADS = [
  {
    id: "wk_sample_support",
    name: "support-bot",
    status: "running",
    platform: "discord",
    runtime: "nodejs",
    runtimeVersion: "22",
    domain: "support-bot.botkeep.cloud",
    region: "eu-central",
    url: "https://support-bot.botkeep.cloud",
    memoryLimitMb: 512,
    cpuLimitPercent: 50,
    storageLimitMb: 1024,
    updatedAt: "2026-10-15T09:41:02Z",
    createdAt: "2026-08-02T11:20:00Z",
    sourceType: "github",
    repository: "your-org/support-bot",
    branch: "main",
  },
  {
    id: "wk_sample_reports",
    name: "weekly-reports",
    status: "stopped",
    platform: "general",
    runtime: "python",
    runtimeVersion: "3.12",
    region: "eu-central",
    memoryLimitMb: 512,
    cpuLimitPercent: 50,
    storageLimitMb: 1024,
    updatedAt: "2026-10-14T18:05:44Z",
    createdAt: "2026-07-19T08:02:11Z",
    sourceType: "zip",
    branch: "—",
  },
  {
    id: "wk_sample_telegram",
    name: "telegram-alerts",
    status: "running",
    platform: "telegram",
    runtime: "nodejs",
    runtimeVersion: "20",
    region: "eu-central",
    memoryLimitMb: 512,
    cpuLimitPercent: 50,
    storageLimitMb: 1024,
    updatedAt: "2026-10-15T09:12:30Z",
    createdAt: "2026-09-01T14:44:09Z",
    sourceType: "github",
    repository: "your-org/telegram-alerts",
    branch: "main",
  },
];

const LOGS = {
  workloadId: "wk_sample_support",
  lines: 4,
  lines_text: [
    "2026-10-15T09:41:00Z  info   gateway ready on port 3000",
    "2026-10-15T09:41:01Z  info   discord client connected (1 shard)",
    "2026-10-15T09:41:09Z  info   slash commands registered: 14",
    "2026-10-15T09:42:37Z  warn   slow interaction response (842 ms)",
  ],
};

const NETWORK = {
  workloadId: "wk_sample_support",
  hostname: "support-bot.botkeep.cloud",
  publicPorts: [{ protocol: "https", port: 443, target: 3000 }],
  internalPorts: [3000],
  addresses: ["10.24.6.19"],
};

const STARTUP_CHECK = {
  workloadId: "wk_sample_support",
  healthy: true,
  checks: [
    { name: "đồng bộ source", state: "passed", detail: "main @ 4f2c19b" },
    { name: "cài dependency", state: "passed", detail: "bun install (3.1 s)" },
    { name: "start command", state: "passed", detail: "npm start" },
    { name: "mở cổng", state: "passed", detail: "0.0.0.0:3000" },
  ],
};

const PLAN = {
  plan: "free-founder",
  planName: "Founder Free",
  planVersion: 1,
  expiresAt: null,
  limits: { slots: 5, memory: 2048, cpu: 150, disk: 2048, backups: 1, retention: 7 },
};

const option = (command: string, minimumMemoryMb = 128, minimumStorageMb = 128) => ({
  command,
  customStartup: true,
  github: true,
  minimumMemoryMb,
  minimumStorageMb,
});

const CAPABILITIES = {
  provisioning: true,
  creationMessage: { message: "Bạn có thể tạo máy chủ mới từ gói hiện tại." },
  freeHosting: {
    planId: "free-founder",
    planName: "Founder Free",
    allowCreate: true,
    allowStart: true,
    hold: false,
    message: "Gói Founder Free: 2048 MB RAM, 150% CPU, 2048 MB storage, 5 máy chủ.",
    allowedRuntimes: {},
  },
  runtimes: {
    nodejs: ["24", "22"],
    nodemon: ["24", "22"],
    bun: ["1.4.2"],
    python: ["3.13", "3.12", "3.11"],
    php: ["8.5.10"],
    "php-site": ["8.5.10"],
    cpp: ["16.2"],
    java: ["21", "17"],
    rust: ["1.96.0"],
    static: ["1.30.5"],
  },
  runtimeOptions: {
    nodejs: { "24": option("npm start"), "22": option("npm start") },
    nodemon: { "24": option("npm run dev"), "22": option("npm run dev") },
    bun: { "1.4.2": option("bun run start") },
    python: { "3.13": option("python main.py"), "3.12": option("python main.py"), "3.11": option("python main.py") },
    php: { "8.5.10": option("php -S 0.0.0.0:8000") },
    "php-site": { "8.5.10": option("php -S 0.0.0.0:8000") },
    cpp: { "16.2": option("./app", 256, 256) },
    java: { "21": option("java -jar app.jar", 256, 256), "17": option("java -jar app.jar", 256, 256) },
    rust: { "1.96.0": option("./app", 256, 256) },
    static: { "1.30.5": option("", 64, 64) },
  },
  checkout: false,
  developerKeys: true,
  collaboration: false,
  network: true,
  sftp: true,
  key: { id: "key_sample", name: "Personal monitoring", expiresAt: "2026-11-14T00:00:00Z" },
  scopes: ["workloads:read", "plan:read"],
  quotas: { perKey: "60 units/phút", perAccount: "120 units/phút", writes: "12 lượt/phút" },
};

const OPERATION = {
  id: "op_sample_9c31",
  state: "completed",
  workloadId: "wk_sample_support",
  createdAt: "2026-10-15T09:40:58Z",
  finishedAt: "2026-10-15T09:41:02Z",
  result: { status: "running", message: "máy chủ đã khởi động lại" },
};

export const DEMO_LABEL = "Dữ liệu mẫu — không phải từ tài khoản của bạn";

/** Returns a synthetic response for a request while preview mode is on. */
export function demoCall<T>(spec: RequestSpec): CallResult<T> {
  const path = spec.path;
  const method = spec.method.toUpperCase();
  let data: unknown = { detail: "Chế độ mẫu chỉ hỗ trợ một số thao tác đã được tài liệu hoá." };
  let status = 200;

  if (method === "POST" && path === "/workloads") {
    data = { operationId: "op_sample_deploy", accepted: true, workloadId: "wk_sample_new", state: "queued" };
    status = 202;
  } else if (method === "POST" && /^\/workloads\/[^/]+\/actions$/.test(path)) {
    const action = (spec.body as { action?: string } | undefined)?.action ?? "unknown";
    data = {
      operationId: "op_sample_9c31",
      accepted: true,
      workloadId: path.split("/")[2],
      action,
      state: "queued",
    };
    status = 202;
  } else if (method === "PUT" && /^\/workloads\/[^/]+\/resources$/.test(path)) {
    data = { workloadId: path.split("/")[2], resources: spec.body, revision: "sample-revision", state: "applied" };
  } else if (path === "/capabilities") data = CAPABILITIES;
  else if (path === "/plan") data = PLAN;
  else if (path === "/workloads") data = { data: WORKLOADS, nextCursor: null };
  else if (/^\/workloads\/[^/]+$/.test(path)) {
    const id = path.split("/")[2];
    data = WORKLOADS.find((item) => item.id === id) ?? { detail: "Không tìm thấy máy chủ mẫu." };
  } else if (/^\/workloads\/[^/]+\/logs$/.test(path)) data = LOGS;
  else if (/^\/workloads\/[^/]+\/network$/.test(path)) data = NETWORK;
  else if (/^\/workloads\/[^/]+\/startup-check$/.test(path)) data = STARTUP_CHECK;
  else if (/^\/operations\/[^/]+$/.test(path)) data = OPERATION;
  else status = 404;

  if (status >= 400) {
    return {
      ok: false,
      error: {
        status,
        message: String((data as { detail?: unknown }).detail ?? "Chế độ mẫu không hỗ trợ thao tác này."),
        retryAfter: null,
        validation: null,
      },
      durationMs: 12,
    };
  }
  return { ok: true, data: data as T, status, durationMs: 12 };
}

export const DEMO_FIRST_WORKLOAD = WORKLOADS[0].id;
