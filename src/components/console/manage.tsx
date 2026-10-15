import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Ban,
  Boxes,
  CheckCircle2,
  CircleDashed,
  FileCode2,
  Github,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  RotateCw,
  Server,
  ShieldAlert,
  Square,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";

import { Button, Callout, Chip, Field, Input, Panel, Select, StatePill, Tabs } from "../ui/primitives";
import { ResponseCard, Stat } from "./shared";
import type { Result, RunFn } from "./panels";
import type { CallResult, RequestSpec } from "../../lib/botkeep";
import { describeOperationState, extractOperationId, extractOperationState, isTerminalState } from "../../lib/operations";
import { findRecordArray, summarizeWorkload, type WorkloadSummary } from "../../lib/shape";
import { cn } from "../../lib/utils";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 12;

/* ------------------------------------------------ dữ liệu capabilities/plan */

type RuntimeOption = {
  command: string;
  customStartup: boolean;
  github: boolean;
  minimumMemoryMb: number;
  minimumStorageMb: number;
};

type FreeHosting = {
  planName?: string;
  allowCreate?: boolean;
  allowStart?: boolean;
  hold?: boolean;
  message?: string;
  allowedRuntimes?: Record<string, boolean>;
};

const RUNTIME_LABELS: Record<string, string> = {
  nodejs: "Node.js",
  nodemon: "Node.js + Nodemon",
  bun: "Bun",
  python: "Python",
  php: "PHP",
  "php-site": "PHP (site)",
  cpp: "C++",
  java: "Java",
  rust: "Rust",
  go: "Go",
  static: "Site tĩnh",
  mysql: "MySQL (managed)",
  postgres: "PostgreSQL (managed)",
  redis: "Redis (managed)",
  mariadb: "MariaDB (managed)",
  lavalink: "Lavalink",
  "uptime-kuma": "Uptime Kuma",
};

function runtimeLabel(id: string): string {
  return RUNTIME_LABELS[id] ?? id;
}

type CapabilityView = {
  runtimeIds: string[];
  versionsFor: (runtime: string) => string[];
  optionFor: (runtime: string, version: string) => RuntimeOption | null;
  freeHosting: FreeHosting | null;
};

function readCapabilities(value: unknown): CapabilityView {
  const source = (value ?? {}) as {
    runtimes?: Record<string, unknown>;
    runtimeOptions?: Record<string, Record<string, RuntimeOption>>;
    freeHosting?: FreeHosting;
  };
  const runtimes = source.runtimes && typeof source.runtimes === "object" ? source.runtimes : {};
  const runtimeIds = Object.keys(runtimes).filter((id) => Array.isArray(runtimes[id]) && (runtimes[id] as string[]).length);

  return {
    runtimeIds,
    versionsFor: (runtime) => {
      const list = runtimes[runtime];
      return Array.isArray(list) ? (list as string[]) : [];
    },
    optionFor: (runtime, version) => source.runtimeOptions?.[runtime]?.[version] ?? null,
    freeHosting: source.freeHosting ?? null,
  };
}

type PlanLimits = {
  name: string | null;
  slots: number | null;
  memory: number | null;
  cpu: number | null;
  disk: number | null;
  backups: number | null;
};

function readPlanLimits(value: unknown): PlanLimits {
  const plan = (value ?? {}) as { plan?: string; planName?: string; limits?: Record<string, unknown> };
  const limits = plan.limits ?? {};
  const num = (key: string) => (typeof limits[key] === "number" ? (limits[key] as number) : null);
  return {
    name: plan.planName ?? plan.plan ?? null,
    slots: num("slots"),
    memory: num("memory"),
    cpu: num("cpu"),
    disk: num("disk"),
    backups: num("backups"),
  };
}

/** Fallback khi chưa đọc được capabilities, để form vẫn dùng được. */
const FALLBACK_RUNTIMES = ["nodejs", "python", "php", "java", "bun", "rust", "cpp", "static"];

/* --------------------------------------------------- theo dõi tác vụ (202) */

function useOperationTracker(run: RunFn) {
  const [operationId, setOperationId] = useState<string | null>(null);
  const [spec, setSpec] = useState<RequestSpec | null>(null);
  const [result, setResult] = useState<CallResult<unknown> | null>(null);
  const [polling, setPolling] = useState(false);
  const [polls, setPolls] = useState(0);

  const start = useCallback((id: string) => {
    setOperationId(id);
    setResult(null);
    setPolls(0);
    setPolling(true);
  }, []);

  const stop = useCallback(() => setPolling(false), []);

  useEffect(() => {
    if (!polling || !operationId) return;
    if (polls >= MAX_POLLS) {
      setPolling(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const next: RequestSpec = { method: "GET", path: `/operations/${operationId}` };
      if (cancelled) return;
      setSpec(next);
      const response = await run(next);
      if (cancelled) return;
      setResult(response);
      setPolls((count) => count + 1);
      const state = response.ok ? extractOperationState(response.data) : null;
      if (!response.ok || isTerminalState(state)) setPolling(false);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [polling, operationId, polls, run]);

  return { operationId, spec, result, polling, polls, start, stop, setPolling };
}

function OperationTracker({
  tracker,
  title,
}: {
  tracker: ReturnType<typeof useOperationTracker>;
  title: string;
}) {
  const state = tracker.result?.ok ? extractOperationState(tracker.result.data) : null;
  const verdict = describeOperationState(state);

  return (
    <Panel
      title={title}
      subtitle={tracker.operationId ? `Đang theo dõi GET /operations/${tracker.operationId}` : "Chưa có tác vụ nào"}
      actions={
        tracker.polling ? (
          <>
            <Chip className="border-warn/40 bg-warn/10 text-warn">
              <CircleDashed className="h-3 w-3 animate-spin" />
              {tracker.polls}/{MAX_POLLS}
            </Chip>
            <Button size="sm" variant="ghost" onClick={tracker.stop}>
              Dừng
            </Button>
          </>
        ) : tracker.operationId ? (
          <Button size="sm" variant="secondary" onClick={() => tracker.setPolling(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Theo dõi tiếp
          </Button>
        ) : null
      }
    >
      {tracker.operationId ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-ink-600 bg-ink-800/70 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {tracker.operationId}
          </code>
          {state ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                verdict === "success"
                  ? "border-signal/40 bg-signal/10 text-signal-soft"
                  : verdict === "failure"
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : "border-warn/40 bg-warn/10 text-warn",
              )}
            >
              {verdict === "success" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : verdict === "failure" ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <CircleDashed className="h-3 w-3 animate-spin" />
              )}
              {state}
            </span>
          ) : null}
        </div>
      ) : null}

      <ResponseCard
        spec={tracker.spec}
        result={tracker.result}
        pending={tracker.polling && !tracker.result}
        emptyTitle="Chưa có gì trong hàng đợi"
        emptyDescription="Khi bạn gửi một thao tác ghi, operation id mà Botkeep trả về sẽ được theo dõi ở đây tới khi có trạng thái kết thúc."
      />
    </Panel>
  );
}

/* -------------------------------------------------------------- tạo máy chủ */

const PLATFORMS = [
  { id: "general", label: "Ứng dụng / bot", blurb: "Code của bạn, mọi ngôn ngữ được hỗ trợ" },
  { id: "discord", label: "Bot Discord", blurb: "Thiết lập dành riêng cho discord.js / discord.py" },
  { id: "telegram", label: "Bot Telegram", blurb: "Dịch vụ Bot API kèm token" },
];

type SourceType = "blank" | "github" | "zip";

type CreateState = {
  name: string;
  platform: string;
  runtime: string;
  runtimeVersion: string;
  startCommand: string;
  sourceType: SourceType;
  repository: string;
  branch: string;
  token: string;
  archive: { name: string; base64: string } | null;
  memory: number;
  cpu: number;
  storage: number;
};

function buildCreateBody(state: CreateState): Record<string, unknown> {
  return {
    name: state.name.trim(),
    platform: state.platform,
    runtime: state.runtime,
    runtimeVersion: state.runtimeVersion,
    sourceType: state.sourceType,
    repository: state.sourceType === "github" ? state.repository.trim() : null,
    archiveName: state.sourceType === "zip" ? state.archive?.name ?? null : null,
    branch: state.sourceType === "github" ? state.branch.trim() || "main" : "main",
    startCommand: state.startCommand.trim(),
    resources: {
      memoryLimitMb: state.memory,
      cpuLimitPercent: state.cpu,
      storageLimitMb: state.storage,
    },
    tokenProvided: Boolean(state.token),
    token: state.token,
    archiveBase64: state.sourceType === "zip" ? state.archive?.base64 ?? null : null,
  };
}

function CreateServerForm({
  run,
  capabilities,
  plan,
  planError,
  pending,
  reload,
}: {
  run: RunFn;
  capabilities: Result;
  plan: Result;
  planError: string | null;
  pending: boolean;
  reload: () => void;
}) {
  const caps = useMemo(() => readCapabilities(capabilities?.ok ? capabilities.data : null), [capabilities]);
  const limits = useMemo(() => readPlanLimits(plan?.ok ? plan.data : null), [plan]);

  const runtimeIds = caps.runtimeIds.length ? caps.runtimeIds : FALLBACK_RUNTIMES;
  const [runtime, setRuntime] = useState(runtimeIds[0]);
  const versions = caps.versionsFor(runtime);
  const [runtimeVersion, setRuntimeVersion] = useState(versions[0] ?? "");
  const [platform, setPlatform] = useState("general");
  const [name, setName] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("blank");
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [archive, setArchive] = useState<{ name: string; base64: string } | null>(null);
  const [memory, setMemory] = useState(512);
  const [cpu, setCpu] = useState(50);
  const [storage, setStorage] = useState(1024);
  const [confirmed, setConfirmed] = useState(false);
  const [spec, setSpec] = useState<RequestSpec | null>(null);
  const [result, setResult] = useState<CallResult<unknown> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tracker = useOperationTracker(run);

  const option = caps.optionFor(runtime, runtimeVersion);
  const githubAllowed = option ? option.github : true;
  const minMemory = option?.minimumMemoryMb ?? 64;
  const minStorage = option?.minimumStorageMb ?? 64;
  const maxMemory = limits.memory ?? 2048;
  const maxStorage = limits.disk ?? 4096;
  const maxCpu = limits.cpu ?? 200;
  const freeHosting = caps.freeHosting;
  const blocked = freeHosting?.allowCreate === false || freeHosting?.hold === true;

  // Ngôn ngữ/phiên bản do API cung cấp: đặt lại mặc định mỗi khi đổi.
  useEffect(() => {
    if (!runtimeIds.includes(runtime)) setRuntime(runtimeIds[0]);
  }, [runtime, runtimeIds]);

  useEffect(() => {
    const list = caps.versionsFor(runtime);
    const next = list[0] ?? "";
    setRuntimeVersion((current) => (list.includes(current) ? current : next));
    const preset = caps.optionFor(runtime, list.includes(runtimeVersion) ? runtimeVersion : next);
    if (preset) {
      setStartCommand(preset.command);
      setMemory((value) => Math.max(value, preset.minimumMemoryMb));
      setStorage((value) => Math.max(value, preset.minimumStorageMb));
      if (!preset.github) setSourceType("blank");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, runtimeVersion, caps]);

  function chooseVersion(version: string) {
    setRuntimeVersion(version);
    const preset = caps.optionFor(runtime, version);
    if (preset) {
      setStartCommand(preset.command);
      setMemory((value) => Math.max(value, preset.minimumMemoryMb));
      setStorage((value) => Math.max(value, preset.minimumStorageMb));
    }
  }

  function validate(): string | null {
    if (!/^[\w .-]{2,64}$/.test(name.trim())) {
      return "Tên máy chủ phải dài 2–64 ký tự, chỉ gồm chữ, số, khoảng trắng, dấu chấm, gạch ngang hoặc gạch dưới.";
    }
    if (!startCommand.trim()) return "Cần có start command — Botkeep cần biết cách khởi động code của bạn.";
    if (sourceType === "github" && repository.trim().length < 3) return "Nguồn GitHub cần repository dạng owner/repo.";
    if (sourceType === "zip" && !archive) return "Hãy chọn một tệp .zip để tải lên trước.";
    if (memory < minMemory) return `RAM tối thiểu cho ${runtimeLabel(runtime)} là ${minMemory} MB.`;
    if (storage < minStorage) return `Storage tối thiểu cho ${runtimeLabel(runtime)} là ${minStorage} MB.`;
    if (cpu < 5 || cpu % 5 !== 0) return "CPU tối thiểu 5% và phải là bội số của 5.";
    return null;
  }

  async function submit() {
    const problem = validate();
    setError(problem);
    if (problem) return;

    const next: RequestSpec = {
      method: "POST",
      path: "/workloads",
      body: buildCreateBody({
        name,
        platform,
        runtime,
        runtimeVersion,
        startCommand,
        sourceType,
        repository,
        branch,
        token,
        archive,
        memory,
        cpu,
        storage,
      }),
    };

    setSpec(next);
    setSending(true);
    const response = await run(next);
    setResult(response);
    setSending(false);

    if (response.ok) {
      const operationId = extractOperationId(response.data);
      if (operationId) tracker.start(operationId);
      reload();
    }
  }

  function onPickArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 7_500_000) {
      setError("Tệp quá lớn: API chỉ nhận khoảng 5,3 MB base64 cho mỗi lần tải lên.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = String(reader.result);
      setArchive({ name: file.name, base64: encoded.slice(encoded.indexOf(",") + 1) });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
      <div className="min-w-0 space-y-5">
        <Panel
          title="01 · Bạn muốn triển khai gì?"
          subtitle="Tương ứng trường `platform` của POST /workloads"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {PLATFORMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlatform(item.id)}
                className={cn(
                  "focus-ring rounded-xl border px-3 py-3 text-left transition",
                  platform === item.id
                    ? "border-signal/40 bg-signal/[0.07]"
                    : "border-ink-600/70 bg-ink-900/50 hover:border-ink-600",
                )}
              >
                <span className="block text-sm font-medium text-slate-100">{item.label}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">{item.blurb}</span>
                <span className="mt-2 block font-mono text-[10px] text-slate-500">{item.id}</span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">
                Ngôn ngữ / runtime (từ GET /capabilities)
              </span>
              <Button size="sm" variant="ghost" onClick={reload} loading={pending}>
                <RefreshCw className="h-3.5 w-3.5" />
                Làm mới
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {runtimeIds.map((id) => {
                const allowed = freeHosting?.allowedRuntimes ? freeHosting.allowedRuntimes[id] !== false : true;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!allowed}
                    onClick={() => setRuntime(id)}
                    className={cn(
                      "focus-ring rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                      runtime === id
                        ? "border-signal/40 bg-signal/[0.07]"
                        : "border-ink-600/70 bg-ink-900/50 hover:border-ink-600",
                    )}
                  >
                    <span className="block text-xs font-medium text-slate-100">{runtimeLabel(id)}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                      {allowed ? id : "gói hiện tại không cho phép"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Đây là <span className="text-slate-300">runtime</span> — engine Botkeep chạy code trên máy chủ — không phải
              framework. React + Vite không nằm trong danh sách vì nó chạy <em>trên</em> Node.js: hãy{" "}
              <span className="font-mono text-slate-300">vite build</span> trước rồi chọn{" "}
              <span className="text-slate-300">Site tĩnh</span> cho phần đã build (HTML/CSS/JS), hoặc chọn{" "}
              <span className="text-slate-300">Node.js</span> / <span className="text-slate-300">Bun</span> nếu bạn cần
              server, SSR hay tự đặt start command.
            </p>
            {caps.runtimeIds.length === 0 ? (
              <Callout tone="warn" className="mt-3">
                Chưa đọc được danh sách runtime từ <span className="font-mono">GET /capabilities</span>. Đang dùng danh
                sách mặc định — hãy làm mới để lấy đúng dữ liệu từ Botkeep.
              </Callout>
            ) : null}
          </div>
        </Panel>

        <Panel title="02 · Tên và cấu hình" subtitle="name, runtimeVersion, startCommand">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên máy chủ" hint="Chữ, số, khoảng trắng, dấu chấm, gạch ngang, gạch dưới (2–64).">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="my-project" />
            </Field>
            <Field label="Phiên bản runtime" hint={`Các bản có sẵn cho ${runtimeLabel(runtime)}.`}>
              <div className="flex gap-2">
                <Select
                  value={runtimeVersion}
                  className="min-w-0 flex-1"
                  onChange={(event) => chooseVersion(event.target.value)}
                >
                  {versions.length === 0 ? <option value="">—</option> : null}
                  {versions.map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </Select>
                <Chip className="h-10 shrink-0 px-3">{runtime}</Chip>
              </div>
            </Field>
          </div>
          <Field
            label="Start command"
            className="mt-4"
            hint={
              option?.customStartup === false
                ? "Runtime này dùng lệnh cố định do Botkeep đặt."
                : "Lệnh Botkeep chạy để khởi động máy chủ."
            }
          >
            <Input
              value={startCommand}
              onChange={(event) => setStartCommand(event.target.value)}
              placeholder="npm start"
            />
          </Field>
        </Panel>

        <Panel title="03 · Nguồn code" subtitle="sourceType, repository, branch, archiveBase64">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "blank" as const, label: "Workspace trống", icon: FileCode2, blurb: "Máy chủ trống, tải code sau" },
              {
                id: "github" as const,
                label: "GitHub",
                icon: Github,
                blurb: githubAllowed ? "Clone mã nguồn từ repository" : "Runtime này không hỗ trợ GitHub",
              },
              { id: "zip" as const, label: "Tệp ZIP", icon: Upload, blurb: "Gửi dự án dạng base64" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.id === "github" && !githubAllowed}
                onClick={() => setSourceType(item.id)}
                className={cn(
                  "focus-ring flex items-start gap-2 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                  sourceType === item.id
                    ? "border-signal/40 bg-signal/[0.07]"
                    : "border-ink-600/70 bg-ink-900/50 hover:border-ink-600",
                )}
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                <span>
                  <span className="block text-xs font-medium text-slate-100">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{item.blurb}</span>
                </span>
              </button>
            ))}
          </div>

          {sourceType === "github" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Repository" hint="Dạng owner/repo">
                <Input
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  placeholder="your-org/support-bot"
                />
              </Field>
              <Field label="Nhánh">
                <Input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="main" />
              </Field>
              <Field
                label="Token repository (không bắt buộc)"
                className="sm:col-span-2"
                hint="Chỉ dùng cho repository riêng tư. Token được gửi cho Botkeep làm thông tin nguồn — bảng điều khiển này không lưu lại."
              >
                <Input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="ghp_…"
                  autoComplete="off"
                />
              </Field>
            </div>
          ) : null}

          {sourceType === "zip" ? (
            <div className="mt-4">
              <Field label="Tệp dự án" hint="Giữ trong trình duyệt cho tới khi bạn triển khai. Giới hạn base64 khoảng 5,3 MB.">
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={onPickArchive}
                  className="block w-full cursor-pointer rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-2.5 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
                />
              </Field>
              {archive ? (
                <p className="mt-2 flex items-center gap-2 font-mono text-[11px] text-signal">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {archive.name} · {Math.round(archive.base64.length / 1024)} KB sau mã hoá
                </p>
              ) : null}
            </div>
          ) : null}

          {sourceType === "blank" ? (
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Workspace trống khởi động không có tệp nào. Hãy đẩy code qua Files API (hoặc SFTP trong panel) trước lần
              chạy đầu tiên.
            </p>
          ) : null}
        </Panel>

        <Panel
          title="04 · Tài nguyên"
          subtitle="resources.memoryLimitMb / cpuLimitPercent / storageLimitMb"
          actions={<Chip>{limits.name ?? "gói hiện tại"}</Chip>}
        >
          {planError ? (
            <Callout tone="warn" className="mb-4">
              {planError} Key cần quyền <span className="font-mono">plan:read</span> để hiển thị giới hạn gói; form vẫn
              dùng được nếu thiếu.
            </Callout>
          ) : null}

          {limits.slots !== null || limits.memory !== null ? (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {limits.slots !== null ? <Stat label="Số máy chủ" value={limits.slots} hint="theo GET /plan" /> : null}
              {limits.memory !== null ? <Stat label="RAM tối đa" value={`${limits.memory} MB`} /> : null}
              {limits.cpu !== null ? <Stat label="CPU tối đa" value={`${limits.cpu}%`} /> : null}
              {limits.disk !== null ? <Stat label="Storage tối đa" value={`${limits.disk} MB`} /> : null}
            </div>
          ) : null}

          <div className="space-y-5">
            <Slider
              label="RAM"
              value={memory}
              unit="MB"
              min={minMemory}
              max={Math.max(maxMemory, minMemory)}
              step={1}
              onChange={setMemory}
              hint={`tối thiểu ${minMemory} MB cho runtime này`}
            />
            <Slider
              label="CPU"
              value={cpu}
              unit="%"
              min={5}
              max={Math.max(maxCpu, 5)}
              step={5}
              onChange={setCpu}
              hint={`${(cpu / 100).toFixed(2)} vCPU · bội số của 5`}
            />
            <Slider
              label="Storage"
              value={storage}
              unit="MB"
              min={minStorage}
              max={Math.max(maxStorage, minStorage)}
              step={1}
              onChange={setStorage}
              hint={`tối thiểu ${minStorage} MB cho runtime này`}
            />
          </div>
        </Panel>

        <Panel title="Triển khai" subtitle="POST /workloads · cần quyền workloads:create">
          {freeHosting?.message ? (
            <Callout tone={blocked ? "danger" : "info"} className="mb-3">
              {freeHosting.message}
            </Callout>
          ) : null}
          {blocked ? (
            <Callout tone="danger" className="mb-3">
              Gói hiện tại đang tạm dừng hoặc không cho tạo máy chủ mới. Hãy xử lý trong panel Botkeep trước khi triển
              khai.
            </Callout>
          ) : null}
          {error ? <Callout tone="danger">{error}</Callout> : null}

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-ink-600 bg-ink-800 accent-signal"
            />
            Tôi hiểu thao tác này tạo một máy chủ thật trên tài khoản Botkeep của tôi và chiếm tài nguyên của gói.
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => void submit()}
              loading={sending}
              disabled={!confirmed || blocked}
            >
              <Rocket className="h-4 w-4" />
              Triển khai máy chủ
            </Button>
            <span className="text-[11px] text-slate-500">Gửi kèm Idempotency-Key; operation id được theo dõi bên phải.</span>
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-5">
        <OperationTracker tracker={tracker} title="Trạng thái tác vụ" />

        <Panel title="Xác nhận triển khai" subtitle="POST /workloads" actions={<Chip>202 Accepted</Chip>}>
          <ResponseCard
            spec={spec}
            result={result}
            pending={sending}
            emptyTitle="Chưa triển khai gì"
            emptyDescription="Điền cấu hình rồi bấm Triển khai máy chủ. Tác vụ xếp hàng sẽ hiện ở khung phía trên."
          />
        </Panel>

        <Panel title="Nội dung request" subtitle="Đúng những gì sẽ gửi tới POST /workloads">
          <pre className="max-h-72 overflow-auto rounded-xl border border-ink-700/60 bg-ink-950/70 p-4 font-mono text-[11px] leading-relaxed text-slate-300">
            {JSON.stringify(
              buildCreateBody({
                name,
                platform,
                runtime,
                runtimeVersion,
                startCommand,
                sourceType,
                repository,
                branch,
                token,
                archive,
                memory,
                cpu,
                storage,
              }),
              null,
              2,
            )}
          </pre>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Token và tệp nén hiện ở đây để bạn thấy đúng những gì rời khỏi trình duyệt — cả hai chỉ đi qua relay của
            chính site này rồi tới api.botkeep.cloud.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  unit,
  min,
  max,
  step,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <span className="font-mono text-sm text-slate-100">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full cursor-pointer accent-signal"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-slate-500">
        <span>
          {min}–{max} {unit}
        </span>
        <span className="font-mono">{hint ?? `bước ${step}`}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- thao tác nguồn */

type ActionId = "start" | "stop" | "restart" | "redeploy" | "kill" | "delete" | "retry";

const ACTIONS: {
  id: ActionId;
  label: string;
  icon: typeof Play;
  tone: "safe" | "careful" | "danger";
  blurb: string;
}[] = [
  { id: "start", label: "Khởi động", icon: Play, tone: "safe", blurb: "Bật máy chủ đang dừng" },
  { id: "restart", label: "Khởi động lại", icon: RotateCw, tone: "safe", blurb: "Dừng rồi chạy lại" },
  { id: "redeploy", label: "Triển khai lại", icon: Rocket, tone: "careful", blurb: "Kéo lại source và build lại" },
  { id: "retry", label: "Thử lại", icon: RotateCcw, tone: "careful", blurb: "Xếp lại tác vụ đã lỗi" },
  { id: "stop", label: "Dừng", icon: Square, tone: "careful", blurb: "Tắt an toàn, giữ nguyên tệp" },
  { id: "kill", label: "Buộc dừng", icon: Ban, tone: "danger", blurb: "Dừng cưỡng bức khi không phản hồi" },
  { id: "delete", label: "Xoá", icon: Trash2, tone: "danger", blurb: "Xoá máy chủ và toàn bộ dữ liệu" },
];

function bodyFor(action: ActionId): Record<string, unknown> {
  if (action === "kill") return { action, confirmKill: true };
  if (action === "redeploy") return { action, confirmRedeploy: true };
  return { action };
}

function WorkloadPicker({
  fleet,
  selectedId,
  onSelect,
  loading,
}: {
  fleet: WorkloadSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading && fleet.length === 0) {
    return <p className="text-xs text-slate-500">Đang tải danh sách máy chủ…</p>;
  }
  if (fleet.length === 0) {
    return (
      <Callout tone="warn">
        Chưa có máy chủ nào được trả về. Hãy tạo mới ở mục “Tạo máy chủ”, hoặc kiểm tra lại tài nguyên mà key được phép
        truy cập.
      </Callout>
    );
  }
  return (
    <div className="max-h-72 space-y-2 overflow-auto pr-1">
      {fleet.map((item) => (
        <button
          key={item.id ?? item.name}
          type="button"
          disabled={!item.id}
          onClick={() => item.id && onSelect(item.id)}
          className={cn(
            "focus-ring flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50",
            selectedId === item.id
              ? "border-signal/40 bg-signal/[0.07]"
              : "border-ink-600/70 bg-ink-900/50 hover:border-ink-600",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm text-slate-100">{item.name}</span>
            <span className="block truncate font-mono text-[10px] text-slate-500">{item.id ?? "không có trường id"}</span>
          </span>
          <StatePill value={item.state} />
        </button>
      ))}
    </div>
  );
}

function PowerActions({
  run,
  workloads,
  pending,
  reload,
}: {
  run: RunFn;
  workloads: Result;
  pending: boolean;
  reload: () => void;
}) {
  const items = useMemo(() => findRecordArray(workloads?.ok ? workloads.data : null) ?? [], [workloads]);
  const fleet = useMemo(() => items.map(summarizeWorkload), [items]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armedAction, setArmedAction] = useState<ActionId | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState("");
  const [spec, setSpec] = useState<RequestSpec | null>(null);
  const [result, setResult] = useState<CallResult<unknown> | null>(null);
  const [sending, setSending] = useState<ActionId | null>(null);

  const tracker = useOperationTracker(run);

  useEffect(() => {
    if (selectedId && fleet.some((item) => item.id === selectedId)) return;
    setSelectedId(fleet.find((item) => item.id)?.id ?? null);
  }, [fleet, selectedId]);

  const selected = fleet.find((item) => item.id === selectedId) ?? null;

  async function send(action: ActionId) {
    if (!selected?.id) return;
    const next: RequestSpec = { method: "POST", path: `/workloads/${selected.id}/actions`, body: bodyFor(action) };
    setSpec(next);
    setSending(action);
    const response = await run(next);
    setResult(response);
    setSending(null);
    setArmedAction(null);
    setAcknowledged(false);
    setTyped("");
    if (response.ok) {
      const operationId = extractOperationId(response.data);
      if (operationId) tracker.start(operationId);
      reload();
    }
  }

  function arm(action: ActionId) {
    setArmedAction(action);
    setAcknowledged(false);
    setTyped("");
  }

  function readyToSend(action: ActionId) {
    const needsConfirmation = ACTIONS.find((item) => item.id === action)?.tone !== "safe";
    if (!needsConfirmation) return true;
    return action === "delete" ? typed.trim().toLowerCase() === "delete" : acknowledged;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="min-w-0 space-y-5">
        <Panel
          title="Máy chủ cần thao tác"
          subtitle="GET /workloads"
          actions={
            <Button size="sm" variant="secondary" onClick={reload} loading={pending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Tải lại
            </Button>
          }
        >
          <WorkloadPicker fleet={fleet} selectedId={selectedId} onSelect={setSelectedId} loading={pending} />
          {selected ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Stat label="Đang chọn" value={selected.name} hint={selected.id ?? "không có trường id"} />
              <Stat label="Trạng thái gần nhất" value={String(selected.state ?? "không rõ")} hint="từ /workloads" />
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Thao tác nguồn"
          subtitle="POST /workloads/{id}/actions · cần quyền power:write"
          actions={<Chip>Idempotency-Key tự động</Chip>}
        >
          <Callout tone="warn">
            Các request này thay đổi trạng thái thật trên tài khoản Botkeep của bạn. Mỗi thao tác được xếp hàng: phản hồi
            202 trả về operation id, và khung bên phải theo dõi tới trạng thái kết thúc.
          </Callout>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ACTIONS.map((action) => {
              const needsConfirmation = action.tone !== "safe";
              const isArmed = armedAction === action.id;
              const disabled = !selected?.id;
              return (
                <div
                  key={action.id}
                  className={cn(
                    "rounded-xl border px-3 py-3 transition",
                    action.tone === "danger"
                      ? "border-danger/25 bg-danger/[0.04]"
                      : action.tone === "careful"
                        ? "border-warn/20 bg-warn/[0.03]"
                        : "border-ink-600/70 bg-ink-900/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                      <action.icon
                        className={cn(
                          "h-4 w-4",
                          action.tone === "danger"
                            ? "text-danger"
                            : action.tone === "careful"
                              ? "text-warn"
                              : "text-signal",
                        )}
                      />
                      {action.label}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{action.id}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{action.blurb}</p>

                  {needsConfirmation && isArmed ? (
                    <div className="mt-3 space-y-2">
                      {action.id === "delete" ? (
                        <>
                          <p className="text-[11px] text-slate-300">
                            Gõ <span className="font-mono text-slate-100">delete</span> để mở khoá thao tác này.
                          </p>
                          <Input
                            value={typed}
                            onChange={(event) => setTyped(event.target.value)}
                            placeholder="delete"
                            autoComplete="off"
                          />
                        </>
                      ) : (
                        <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(event) => setAcknowledged(event.target.checked)}
                            className="mt-0.5 h-3 w-3 rounded border-ink-600 bg-ink-800 accent-signal"
                          />
                          <span>Tôi hiểu hậu quả của thao tác “{action.label}”</span>
                        </label>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {needsConfirmation && !isArmed ? (
                      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => arm(action.id)}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Chuẩn bị {action.label.toLowerCase()}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={action.tone === "danger" ? "danger" : "primary"}
                        loading={sending === action.id}
                        disabled={disabled || !readyToSend(action.id)}
                        onClick={() => void send(action.id)}
                      >
                        {action.label} ngay
                      </Button>
                    )}
                    {isArmed ? (
                      <Button size="sm" variant="ghost" onClick={() => setArmedAction(null)}>
                        Huỷ
                      </Button>
                    ) : null}
                  </div>
                  {selected ? (
                    <p className="mt-2 break-all font-mono text-[10px] text-slate-500">
                      POST /workloads/{selected.id}/actions
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <ResponseCard
              spec={spec}
              result={result}
              emptyTitle="Chưa gửi thao tác nào"
              emptyDescription="Chuẩn bị một thao tác, xác nhận rồi gửi. Phản hồi 202 và tác vụ được xếp hàng đều hiện ở đây."
            />
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-5">
        <OperationTracker tracker={tracker} title="Trạng thái tác vụ" />

        <Panel title="Kiểm tra quyền" subtitle="Vì sao một thao tác ghi có thể trả 403">
          <ul className="space-y-2 text-xs leading-relaxed text-slate-400">
            <li className="flex gap-2">
              <Zap className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
              Thao tác nguồn cần <span className="font-mono text-slate-300">power:write</span>.
            </li>
            <li className="flex gap-2">
              <Server className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
              Tạo máy chủ mới cần <span className="font-mono text-slate-300">workloads:create</span>.
            </li>
            <li className="flex gap-2">
              <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
              Đổi tài nguyên cần <span className="font-mono text-slate-300">workloads:update</span>.
            </li>
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Key tạo để theo dõi là key chỉ đọc. Hãy tạo thêm một key có quyền ghi cần thiết và đặt thời hạn ngắn.
          </p>
          <a
            className="link-underline mt-3 inline-block text-[11px] text-slate-300"
            href="https://botkeep.cloud/app/developer"
            target="_blank"
            rel="noreferrer noopener"
          >
            Tạo key có quyền ghi ↗
          </a>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- tài nguyên */

function ResourceEditor({
  run,
  workloads,
  pending,
  reload,
  plan,
}: {
  run: RunFn;
  workloads: Result;
  pending: boolean;
  reload: () => void;
  plan: Result;
}) {
  const items = useMemo(() => findRecordArray(workloads?.ok ? workloads.data : null) ?? [], [workloads]);
  const fleet = useMemo(() => items.map(summarizeWorkload), [items]);
  const limits = useMemo(() => readPlanLimits(plan?.ok ? plan.data : null), [plan]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memory, setMemory] = useState(512);
  const [cpu, setCpu] = useState(50);
  const [storage, setStorage] = useState(1024);
  const [confirmed, setConfirmed] = useState(false);
  const [spec, setSpec] = useState<RequestSpec | null>(null);
  const [result, setResult] = useState<CallResult<unknown> | null>(null);
  const [sending, setSending] = useState(false);

  const tracker = useOperationTracker(run);

  useEffect(() => {
    if (selectedId && fleet.some((item) => item.id === selectedId)) return;
    setSelectedId(fleet.find((item) => item.id)?.id ?? null);
  }, [fleet, selectedId]);

  const selected = fleet.find((item) => item.id === selectedId) ?? null;

  async function submit() {
    if (!selected?.id) return;
    const next: RequestSpec = {
      method: "PUT",
      path: `/workloads/${selected.id}/resources`,
      body: { memoryLimitMb: memory, cpuLimitPercent: cpu, storageLimitMb: storage },
    };
    setSpec(next);
    setSending(true);
    const response = await run(next);
    setResult(response);
    setSending(false);
    if (response.ok) {
      const operationId = extractOperationId(response.data);
      if (operationId) tracker.start(operationId);
      reload();
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="min-w-0 space-y-5">
        <Panel
          title="Máy chủ cần đổi"
          subtitle="GET /workloads"
          actions={
            <Button size="sm" variant="secondary" onClick={reload} loading={pending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Tải lại
            </Button>
          }
        >
          <WorkloadPicker fleet={fleet} selectedId={selectedId} onSelect={setSelectedId} loading={pending} />
        </Panel>

        <Panel title="Giới hạn tài nguyên" subtitle="PUT /workloads/{id}/resources · cần quyền workloads:update">
          {limits.memory !== null ? (
            <Callout tone="info" className="mb-4">
              Gói {limits.name ?? "hiện tại"} cho phép tối đa {limits.memory} MB RAM, {limits.cpu ?? "?"}% CPU và{" "}
              {limits.disk ?? "?"} MB storage.
            </Callout>
          ) : null}

          <div className="space-y-5">
            <Slider
              label="RAM"
              value={memory}
              unit="MB"
              min={64}
              max={limits.memory ?? 2048}
              step={1}
              onChange={setMemory}
            />
            <Slider
              label="CPU"
              value={cpu}
              unit="%"
              min={5}
              max={limits.cpu ?? 200}
              step={5}
              onChange={setCpu}
              hint={`${(cpu / 100).toFixed(2)} vCPU`}
            />
            <Slider
              label="Storage"
              value={storage}
              unit="MB"
              min={64}
              max={limits.disk ?? 4096}
              step={1}
              onChange={setStorage}
            />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-ink-600 bg-ink-800 accent-signal"
            />
            Tôi hiểu thao tác này đổi giới hạn tài nguyên đang chạy và máy chủ có thể khởi động lại.
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              className="w-full sm:w-auto"
              onClick={() => void submit()}
              loading={sending}
              disabled={!selected?.id || !confirmed}
            >
              <Zap className="h-3.5 w-3.5" />
              Áp dụng tài nguyên
            </Button>
            {!selected?.id ? <span className="text-[11px] text-slate-500">Chọn một máy chủ trước.</span> : null}
          </div>

          <div className="mt-5">
            <ResponseCard
              spec={spec}
              result={result}
              emptyTitle="Chưa gửi thay đổi nào"
              emptyDescription="Chọn máy chủ, đặt giới hạn mới rồi bấm áp dụng."
            />
          </div>
        </Panel>
      </div>

      <OperationTracker tracker={tracker} title="Trạng thái tác vụ" />
    </div>
  );
}

/* ------------------------------------------------------------------ tab gốc */

export function ManagePanel({
  run,
  workloads,
  capabilities,
  pending,
  reload,
  plan,
  planError,
}: {
  run: RunFn;
  workloads: Result;
  capabilities: Result;
  pending: boolean;
  reload: () => void;
  plan: Result;
  planError: string | null;
}) {
  const [section, setSection] = useState<"power" | "create" | "resources">("power");
  const items = useMemo(() => findRecordArray(workloads?.ok ? workloads.data : null) ?? [], [workloads]);

  return (
    <div className="space-y-5">
      <Callout tone="info">
        Tab này thực hiện <strong className="text-slate-200">thao tác ghi thật</strong> lên tài khoản Botkeep của bạn. Mỗi
        request được gắn một <span className="font-mono">Idempotency-Key</span> mới, và tác vụ đang chờ được theo dõi bằng
        operation id tới khi có trạng thái kết thúc. Key chỉ đọc sẽ nhận 403 — quyền cần cho từng thao tác được ghi ngay
        bên cạnh.
      </Callout>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Tabs
          tabs={[
            { id: "power" as const, label: "Thao tác nguồn", icon: <Zap className="h-3.5 w-3.5" /> },
            { id: "create" as const, label: "Tạo máy chủ", icon: <Server className="h-3.5 w-3.5" /> },
            { id: "resources" as const, label: "Tài nguyên", icon: <Boxes className="h-3.5 w-3.5" /> },
          ]}
          active={section}
          onChange={setSection}
          className="w-full sm:w-auto"
        />
        <Chip>{items.length} máy chủ</Chip>
      </div>

      {section === "power" ? (
        <PowerActions run={run} workloads={workloads} pending={pending} reload={reload} />
      ) : null}
      {section === "create" ? (
        <CreateServerForm
          run={run}
          capabilities={capabilities}
          plan={plan}
          planError={planError}
          pending={pending}
          reload={reload}
        />
      ) : null}
      {section === "resources" ? (
        <ResourceEditor run={run} workloads={workloads} pending={pending} reload={reload} plan={plan} />
      ) : null}
    </div>
  );
}
