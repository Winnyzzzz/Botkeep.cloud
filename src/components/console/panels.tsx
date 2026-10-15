import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  FileClock,
  Gauge,
  KeyRound,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  TerminalSquare,
  Wifi,
} from "lucide-react";

import {
  Button,
  Callout,
  Chip,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Panel,
  Spinner,
  StatePill,
  Tabs,
} from "../ui/primitives";
import { JsonTree, RecordTable } from "../JsonTree";
import { ResponseCard, Stat } from "./shared";
import type { CallResult, RequestSpec } from "../../lib/botkeep";
import { findRecordArray, humanKey, summarizeWorkload, type WorkloadSummary } from "../../lib/shape";
import { relativeTime } from "../../lib/utils";

export type RunFn = <T = unknown>(spec: RequestSpec) => Promise<CallResult<T>>;
export type Result = CallResult<unknown> | null;

/* ---------------------------------------------------------------- tổng quan */

/** Rút các con số dễ đọc từ payload dạng plan mà không giả định schema. */
export function planStats(value: unknown, depth = 0, out: { label: string; value: string }[] = []) {
  if (depth > 3 || value === null || typeof value !== "object") return out;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (typeof nested === "number") {
      const label = humanKey(key);
      const isCpu = /cpu|vcpu/i.test(key);
      const isSize = /memory|storage|disk|ram|size/i.test(key);
      out.push({
        label,
        value: isCpu ? `${(nested / 100).toFixed(2)} vCPU` : isSize ? `${nested} MB` : String(nested),
      });
    } else if (/plan|limit|usage|quota|resource/i.test(key)) {
      planStats(nested, depth + 1, out);
    }
  }
  return out.slice(0, 12);
}

function planSummary(value: unknown): { name: string | null; expiresAt: unknown } {
  const plan = (value ?? {}) as { plan?: string; planName?: string; expiresAt?: unknown };
  return { name: plan.planName ?? plan.plan ?? null, expiresAt: plan.expiresAt ?? null };
}

export function OverviewPanel({
  plan,
  planError,
  workloads,
  capabilities,
  reload,
  pending,
  sample,
}: {
  plan: Result;
  planError: string | null;
  workloads: Result;
  capabilities: Result;
  reload: () => void;
  pending: boolean;
  sample: boolean;
}) {
  const items = useMemo(() => findRecordArray(workloads?.ok ? workloads.data : null) ?? [], [workloads]);
  const summaries = useMemo(() => items.map(summarizeWorkload), [items]);
  const counts = summaries.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.state ?? "unknown").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const stats = plan?.ok ? planStats(plan.data) : [];
  const summary = plan?.ok ? planSummary(plan.data) : null;
  const expiry = summary ? relativeTime(summary.expiresAt) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Máy chủ" value={pending ? "…" : summaries.length} hint="từ GET /workloads" />
        <Stat
          label="Đang chạy"
          value={pending ? "…" : (counts.running ?? 0)}
          hint={summaries.length ? `${Math.round(((counts.running ?? 0) / summaries.length) * 100)}% tổng số` : "—"}
        />
        <Stat label="Đã dừng" value={pending ? "…" : (counts.stopped ?? 0)} hint="đã tắt nhưng vẫn giữ tệp" />
        <Stat
          label="Trạng thái khác"
          value={pending ? "…" : summaries.length - (counts.running ?? 0) - (counts.stopped ?? 0)}
          hint="đang khởi động, lỗi hoặc không rõ"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Gói và hạn mức tài nguyên"
          subtitle="GET /plan · cần quyền plan:read"
          actions={
            <Button size="sm" variant="secondary" onClick={reload} loading={pending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới
            </Button>
          }
        >
          {planError ? <Callout tone="warn">{planError}</Callout> : null}
          {plan?.ok ? (
            <>
              {summary?.name ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Chip className="border-signal/40 bg-signal/10 text-signal-soft">{summary.name}</Chip>
                  {expiry ? <Chip>hết hạn {expiry}</Chip> : null}
                </div>
              ) : null}
              {stats.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {stats.map((item) => (
                    <div key={item.label} className="rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">{item.label}</p>
                      <p className="mt-0.5 font-mono text-sm text-slate-100">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-ink-700/60 bg-ink-950/60 p-4">
                  <JsonTree value={plan.data} />
                </div>
              )}
            </>
          ) : planError ? null : (
            <p className="text-xs text-slate-500">Đang tải gói hiện tại…</p>
          )}
        </Panel>

        <Panel title="Khả năng của key" subtitle="GET /capabilities · cần quyền workloads:read">
          {capabilities?.ok ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {["developerKeys", "collaboration", "network", "sftp", "checkout"].map((feature) => {
                  const enabled = (capabilities.data as Record<string, unknown> | null)?.[feature];
                  if (typeof enabled !== "boolean") return null;
                  return (
                    <Chip
                      key={feature}
                      className={enabled ? "border-signal/40 bg-signal/10 text-signal-soft" : undefined}
                    >
                      {feature}: {enabled ? "có" : "không"}
                    </Chip>
                  );
                })}
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-slate-400">Xem toàn bộ dữ liệu capabilities</summary>
                <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-950/60 p-4">
                  <JsonTree value={capabilities.data} />
                </div>
              </details>
            </div>
          ) : capabilities && !capabilities.ok ? (
            <Callout tone="warn">{capabilities.error.message}</Callout>
          ) : (
            <p className="text-xs text-slate-500">Chưa tải.</p>
          )}
          <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-400">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-signal" />
              Relay không thêm credential nào của riêng nó — mọi request chỉ dùng key của bạn.
            </p>
            <p className="flex items-start gap-2">
              <Gauge className="mt-px h-3.5 w-3.5 shrink-0 text-signal" />
              Đọc tốn 1 request unit (lệnh nặng tốn 3). Ghi có ngân sách riêng: 12 lượt/phút.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Máy chủ gần đây"
        subtitle={sample ? "Dữ liệu mẫu — không phải từ tài khoản của bạn" : "Trạng thái gần nhất do API báo về"}
        actions={
          <Button size="sm" variant="secondary" onClick={reload} loading={pending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tải lại
          </Button>
        }
      >
        {summaries.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title={pending ? "Đang tải máy chủ…" : "Chưa có máy chủ nào được trả về"}
            description={
              pending
                ? "Đang hỏi Botkeep về danh sách máy chủ của bạn."
                : "API không trả về bản ghi nào cho key này. Hãy kiểm tra xem key có được phép truy cập các tài nguyên đó không."
            }
          />
        ) : (
          <ul className="divide-y divide-ink-700/40">
            {summaries.slice(0, 5).map((item) => (
              <li key={item.id ?? item.name} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <ServerCog className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate text-sm text-slate-200">{item.name}</span>
                  <code className="hidden truncate font-mono text-[11px] text-slate-500 sm:inline">
                    {item.id ?? "không có trường id"}
                  </code>
                </span>
                <span className="flex items-center gap-3">
                  {item.runtime ? <Chip>{item.runtime}</Chip> : null}
                  <StatePill value={item.state} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* --------------------------------------------------------------- máy chủ */

export function WorkloadsPanel({
  workloads,
  pending,
  reload,
  run,
  sample,
  selected,
  onSelect,
  error,
}: {
  workloads: Result;
  pending: boolean;
  reload: () => void;
  run: RunFn;
  sample: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => findRecordArray(workloads?.ok ? workloads.data : null) ?? [], [workloads]);
  const summaries = useMemo(() => items.map(summarizeWorkload), [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((item) =>
      [item.name, item.id, item.state, item.runtime, item.platform, item.domain, item.region]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, summaries]);

  if (selected) {
    return <WorkloadDetail id={selected} run={run} onBack={() => onSelect(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lọc theo tên, id, trạng thái, runtime…"
            className="pl-9 font-sans"
            aria-label="Lọc máy chủ"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={reload} loading={pending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tải lại
          </Button>
          <Chip className="hidden sm:inline-flex">GET /workloads?limit=100</Chip>
        </div>
      </div>

      {error ? <Callout tone="warn">{error}</Callout> : null}

      {pending && summaries.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-10 text-sm text-slate-400">
          <Spinner />
          Đang tải danh sách máy chủ…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title={summaries.length ? "Không có máy chủ nào khớp bộ lọc" : "Chưa có máy chủ nào được trả về"}
          description={
            summaries.length
              ? "Xoá bộ lọc để xem toàn bộ danh sách."
              : "Nếu điều này không đúng, hãy kiểm tra tài nguyên mà key được phép truy cập trong panel Botkeep."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <WorkloadCard key={item.id ?? item.name} item={item} onOpen={() => onSelect(item.id)} />
          ))}
        </div>
      )}

      {workloads?.ok && summaries.length > 0 ? (
        <details className="panel px-4 py-3">
          <summary className="cursor-pointer text-xs text-slate-400">Xem payload thô của GET /workloads</summary>
          <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-950/60 p-4">
            <JsonTree value={workloads.data} />
          </div>
        </details>
      ) : null}

      {sample ? <p className="text-[11px] text-slate-500">Dữ liệu mẫu — không phải từ tài khoản của bạn.</p> : null}
    </div>
  );
}

function WorkloadCard({ item, onOpen }: { item: WorkloadSummary; onOpen: () => void }) {
  const updated = relativeTime(item.updatedAt);
  const hasIdentity = item.id !== null;
  return (
    <article className="panel flex min-w-0 flex-col gap-3 p-4 transition hover:border-signal/30">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-100">{item.name}</h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{item.id ?? "không báo id"}</p>
        </div>
        <StatePill value={item.state} />
      </header>

      <div className="flex flex-wrap gap-1.5">
        {item.platform ? <Chip>{item.platform}</Chip> : null}
        {item.runtime ? <Chip>{item.runtime}</Chip> : null}
        {item.region ? <Chip>{item.region}</Chip> : null}
      </div>

      {item.metrics.length ? (
        <dl className="grid grid-cols-3 gap-2">
          {item.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-ink-700/50 bg-ink-900/40 px-2.5 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">{metric.label}</dt>
              <dd className="mt-0.5 font-mono text-[11px] text-slate-200">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {item.domain ? (
        <a
          href={item.domain.startsWith("http") ? item.domain : `https://${item.domain}`}
          target="_blank"
          rel="noreferrer noopener"
          className="link-underline truncate font-mono text-[11px] text-wire"
        >
          {item.domain}
        </a>
      ) : null}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-slate-500">{updated ? `cập nhật ${updated}` : "không có mốc thời gian"}</span>
        <Button size="sm" variant="secondary" disabled={!hasIdentity} onClick={onOpen}>
          {hasIdentity ? "Mở" : "Không có id"}
        </Button>
      </footer>
    </article>
  );
}

const DETAIL_TABS = [
  { id: "overview", label: "Tổng quan", icon: <ServerCog className="h-3.5 w-3.5" /> },
  { id: "logs", label: "Nhật ký", icon: <TerminalSquare className="h-3.5 w-3.5" /> },
  { id: "network", label: "Mạng", icon: <Wifi className="h-3.5 w-3.5" /> },
  { id: "startup", label: "Kiểm tra khởi động", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
] as const;

type DetailTab = (typeof DETAIL_TABS)[number]["id"];

function specFor(id: string, tab: DetailTab): RequestSpec {
  if (tab === "logs") return { method: "GET", path: `/workloads/${id}/logs`, query: { lines: 100 } };
  if (tab === "network") return { method: "GET", path: `/workloads/${id}/network` };
  if (tab === "startup") return { method: "GET", path: `/workloads/${id}/startup-check` };
  return { method: "GET", path: `/workloads/${id}` };
}

function WorkloadDetail({ id, run, onBack }: { id: string; run: RunFn; onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [results, setResults] = useState<Partial<Record<DetailTab, CallResult<unknown>>>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (target: DetailTab, force = false) => {
      if (!force && results[target]) return;
      setLoading(true);
      const result = await run(specFor(id, target));
      setResults((previous) => ({ ...previous, [target]: result }));
      setLoading(false);
    },
    [id, results, run],
  );

  useEffect(() => {
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  const result = results[tab] ?? null;
  const record =
    tab === "overview" && result?.ok && result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Về danh sách
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <code className="max-w-[10rem] truncate font-mono text-[11px] text-slate-500">{id}</code>
          <CopyButton value={id} />
          <Button size="sm" variant="secondary" onClick={() => void load(tab, true)} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tải lại
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Tabs
          tabs={DETAIL_TABS.map((item) => ({ ...item }))}
          active={tab}
          onChange={setTab}
          className="w-max flex-nowrap sm:w-auto"
        />
      </div>

      <Panel
        title={DETAIL_TABS.find((item) => item.id === tab)?.label}
        subtitle={`GET ${specFor(id, tab).path}${tab === "logs" ? "?lines=100" : ""}`}
      >
        {record && tab === "overview" ? (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatePill value={record.status ?? record.state} />
              {summarizeWorkload(record).metrics.map((metric) => (
                <Chip key={metric.label}>
                  {metric.label}: {metric.value}
                </Chip>
              ))}
            </div>
            <RecordTable record={record} />
          </div>
        ) : null}

        <ResponseCard
          spec={specFor(id, tab)}
          result={result}
          pending={loading && !result}
          emptyTitle="Chưa tải"
          emptyDescription="Chọn một tab để lấy tài nguyên tương ứng."
        />

        {result?.ok && record ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-slate-400">Xem JSON thô</summary>
            <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-950/60 p-4">
              <JsonTree value={result.data} />
            </div>
          </details>
        ) : null}
      </Panel>

      <Callout tone="info">
        Nhật ký cần quyền <span className="font-mono">logs:read</span> và kiểm tra khởi động cần{" "}
        <span className="font-mono">settings:read</span>. Nhận 403 nghĩa là key chưa có quyền đó.
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------------ tác vụ */

export function OperationsPanel({ run, sample }: { run: RunFn; sample: boolean }) {
  const [operationId, setOperationId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [operationSpec, setOperationSpec] = useState<RequestSpec | null>(null);
  const [operationResult, setOperationResult] = useState<Result>(null);
  const [requestSpec, setRequestSpec] = useState<RequestSpec | null>(null);
  const [requestResult, setRequestResult] = useState<Result>(null);
  const [pending, setPending] = useState<"op" | "req" | null>(null);

  async function lookupOperation() {
    const id = operationId.trim();
    if (!id) return;
    const spec: RequestSpec = { method: "GET", path: `/operations/${id}` };
    setOperationSpec(spec);
    setPending("op");
    setOperationResult(await run(spec));
    setPending(null);
  }

  async function lookupRequest() {
    const id = requestId.trim();
    if (!id) return;
    const spec: RequestSpec = { method: "GET", path: `/requests/${id}` };
    setRequestSpec(spec);
    setPending("req");
    setRequestResult(await run(spec));
    setPending(null);
  }

  return (
    <div className="space-y-5">
      <Callout tone="info">
        Thao tác ghi được xếp hàng, không áp dụng ngay. Phản hồi 202 kèm một operation id — hãy theo dõi ở đây tới khi có
        trạng thái kết thúc. Được chấp nhận không có nghĩa là đã xong.
      </Callout>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Trạng thái tác vụ" subtitle="GET /operations/{operation_id} · cần quyền workloads:read">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Operation id" className="min-w-0 flex-1">
              <Input
                value={operationId}
                onChange={(event) => setOperationId(event.target.value)}
                placeholder="op_…"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void lookupOperation();
                }}
              />
            </Field>
            <Button onClick={() => void lookupOperation()} loading={pending === "op"} disabled={!operationId.trim()}>
              <FileClock className="h-3.5 w-3.5" />
              Kiểm tra
            </Button>
          </div>
          <div className="mt-4">
            <ResponseCard
              spec={operationSpec}
              result={operationResult}
              pending={pending === "op"}
              emptyTitle="Chưa kiểm tra tác vụ nào"
              emptyDescription="Dán operation id mà một thao tác ghi trả về."
            />
          </div>
        </Panel>

        <Panel title="Biên lai request" subtitle="GET /requests/{request_id} · không cần quyền đặc biệt">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Request id" className="min-w-0 flex-1">
              <Input
                value={requestId}
                onChange={(event) => setRequestId(event.target.value)}
                placeholder="req_…"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void lookupRequest();
                }}
              />
            </Field>
            <Button
              variant="secondary"
              onClick={() => void lookupRequest()}
              loading={pending === "req"}
              disabled={!requestId.trim()}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Kiểm tra
            </Button>
          </div>
          <div className="mt-4">
            <ResponseCard
              spec={requestSpec}
              result={requestResult}
              pending={pending === "req"}
              emptyTitle="Chưa kiểm tra biên lai nào"
              emptyDescription="Request id được trả về kèm phản hồi cho thao tác ghi, như một biên lai lâu dài."
            />
          </div>
        </Panel>
      </div>

      {sample ? (
        <p className="text-[11px] text-slate-500">
          Ở chế độ mẫu, mọi operation id bắt đầu bằng <span className="font-mono">op_sample</span> đều trả về kết quả mẫu.
        </p>
      ) : null}
    </div>
  );
}
