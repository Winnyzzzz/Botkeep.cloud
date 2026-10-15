import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Boxes,
  ExternalLink,
  Eye,
  EyeOff,
  FileClock,
  KeyRound,
  Link2,
  LogOut,
  Play,
  Server,
  ShieldCheck,
  Sparkles,
  Unplug,
  Zap,
} from "lucide-react";

import { Button, Callout, Chip, CopyButton, Field, Input, Panel, ScopeChip, Tabs } from "../components/ui/primitives";
import { OverviewPanel, OperationsPanel, WorkloadsPanel, type Result, type RunFn } from "../components/console/panels";
import { ActivityPanel, PlaygroundPanel } from "../components/console/playground";
import { ManagePanel } from "../components/console/manage";
import {
  buildPath,
  callBotkeep,
  clearStoredKey,
  fetchRelayStatus,
  maskKey,
  readStoredKey,
  writeStoredKey,
  type CallResult,
  type RelayStatus,
  type RequestSpec,
} from "../lib/botkeep";
import { DEMO_FIRST_WORKLOAD, demoCall } from "../lib/demo";

type LogEntry = {
  id: string;
  at: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ok: boolean;
  message?: string;
};

type TabId = "overview" | "workloads" | "manage" | "operations" | "playground" | "activity";

const RECOMMENDED_SCOPES = ["workloads:read", "plan:read", "logs:read", "backups:read", "settings:read"];

const CONNECT_BULLETS = [
  {
    icon: KeyRound,
    title: "Tạo key trong panel Botkeep",
    body: "Workspace → Developer → Create API key. Đặt tên, chọn thời hạn và tick đúng quyền cần dùng. Key mặc định chỉ đọc cho tới khi bạn bật quyền ghi.",
  },
  {
    icon: ShieldCheck,
    title: "Key không lưu trên server",
    body: "Khi bạn dán key, nó chỉ nằm trong trình duyệt này và trong header của các request gửi tới api.botkeep.cloud. Không có tài khoản, không đăng ký.",
  },
  {
    icon: Link2,
    title: "Request đi qua relay cùng tên miền",
    body: "Botkeep chặn gọi cross-origin từ trình duyệt, nên site này chuyển tiếp request — và key của bạn — tới Botkeep nguyên vẹn, rồi trả lại đúng phản hồi.",
  },
];

export default function Console() {
  const [params] = useSearchParams();
  const initialEndpoint = useMemo(() => {
    const raw = params.get("endpoint");
    if (!raw) return null;
    const [method, ...rest] = raw.split(" ");
    const path = rest.join(" ");
    return method && path ? { method, path } : null;
  }, [params]);

  const [relay, setRelay] = useState<RelayStatus | null>(null);
  const [key, setKey] = useState(() => readStoredKey());
  const [draft, setDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [useEnvKey, setUseEnvKey] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);

  const [capabilities, setCapabilities] = useState<Result>(null);
  const [workloads, setWorkloads] = useState<Result>(null);
  const [plan, setPlan] = useState<Result>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [workloadError, setWorkloadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [tab, setTab] = useState<TabId>(initialEndpoint ? "playground" : "overview");
  const [selectedWorkload, setSelectedWorkload] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    void fetchRelayStatus().then(setRelay);
  }, []);

  const run = useCallback<RunFn>(
    async <T,>(spec: RequestSpec): Promise<CallResult<T>> => {
      const result = sample ? demoCall<T>(spec) : await callBotkeep<T>(useEnvKey ? null : key, spec);
      setLog((previous) =>
        [
          {
            id: crypto.randomUUID(),
            at: Date.now(),
            method: spec.method.toUpperCase(),
            path: buildPath(spec),
            status: result.ok ? result.status : result.error.status,
            durationMs: result.durationMs,
            ok: result.ok,
            message: result.ok ? undefined : result.error.message,
          },
          ...previous,
        ].slice(0, 60),
      );
      return result;
    },
    [key, sample, useEnvKey],
  );

  const loadAll = useCallback(async () => {
    setPending(true);
    const [fleet, planResult, caps] = await Promise.all([
      run<unknown>({ method: "GET", path: "/workloads", query: { limit: 100 } }),
      run<unknown>({ method: "GET", path: "/plan" }),
      run<unknown>({ method: "GET", path: "/capabilities" }),
    ]);
    setWorkloads(fleet);
    setWorkloadError(fleet.ok ? null : fleet.error.message);
    setPlan(planResult);
    setPlanError(planResult.ok ? null : planResult.error.message);
    setCapabilities(caps);
    setPending(false);
  }, [run]);

  useEffect(() => {
    if (!connected) return;
    void loadAll();
  }, [connected, loadAll]);

  async function connectWithKey() {
    const candidate = draft.trim();
    if (!candidate) return;
    setConnecting(true);
    setConnectError(null);
    const result = await callBotkeep(candidate, { method: "GET", path: "/capabilities" });
    if (!result.ok) {
      setConnectError(result.error.message);
      setConnecting(false);
      return;
    }
    writeStoredKey(candidate);
    setKey(candidate);
    setUseEnvKey(false);
    setCapabilities(result);
    setSample(false);
    setConnected(true);
    setConnecting(false);
  }

  async function connectWithEnvKey() {
    setConnecting(true);
    setConnectError(null);
    const result = await callBotkeep(null, { method: "GET", path: "/capabilities" });
    if (!result.ok) {
      setConnectError(
        `Relay báo có key trong môi trường nhưng Botkeep từ chối: ${result.error.message} Hãy kiểm tra lại biến ${
          relay?.keyEnvNames?.[0] ?? "BOTKEEP_API_KEY"
        }.`,
      );
      setConnecting(false);
      return;
    }
    setUseEnvKey(true);
    setCapabilities(result);
    setSample(false);
    setConnected(true);
    setConnecting(false);
  }

  function disconnect() {
    clearStoredKey();
    setKey("");
    setDraft("");
    setUseEnvKey(false);
    setConnected(false);
    setSample(false);
    setCapabilities(null);
    setWorkloads(null);
    setPlan(null);
    setLog([]);
    setSelectedWorkload(null);
  }

  function exploreSample() {
    setSample(true);
    setConnected(true);
    setCapabilities(null);
    setSelectedWorkload(null);
    setTab("overview");
  }

  const tabs = [
    { id: "overview" as const, label: "Tổng quan", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "workloads" as const, label: "Máy chủ", icon: <Boxes className="h-3.5 w-3.5" /> },
    { id: "manage" as const, label: "Quản lý", icon: <Zap className="h-3.5 w-3.5" /> },
    { id: "operations" as const, label: "Tác vụ", icon: <FileClock className="h-3.5 w-3.5" /> },
    { id: "playground" as const, label: "Thử nghiệm", icon: <Play className="h-3.5 w-3.5" /> },
    { id: "activity" as const, label: "Hoạt động", icon: <Activity className="h-3.5 w-3.5" />, count: log.length },
  ];

  if (!connected) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-5 sm:py-12">
        <header className="mb-8 max-w-2xl sm:mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal/80">Bảng điều khiển</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Kết nối tới Botkeep của bạn
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Bảng điều khiển đọc và điều khiển tài khoản hosting của bạn qua Botkeep Developer API công khai. Không cần
            đăng ký tài khoản mới.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0 space-y-5">
            {relay?.serverKey ? (
              <Panel
                title="Key đã có sẵn trong môi trường"
                subtitle={`Relay đang đọc ${relay.keyEnvNames.join(" / ")}`}
                actions={<Chip className="border-signal/40 bg-signal/10 text-signal-soft">sẵn sàng</Chip>}
              >
                <p className="text-xs leading-relaxed text-slate-400">
                  Không cần dán key vào trình duyệt. Relay giữ key ở phía server và chỉ chuyển tiếp tới{" "}
                  <span className="font-mono text-slate-300">api.botkeep.cloud</span> — browser không bao giờ nhìn thấy
                  key.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={() => void connectWithEnvKey()} loading={connecting}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Dùng key trên server
                  </Button>
                  <Button variant="ghost" onClick={exploreSample}>
                    <Sparkles className="h-3.5 w-3.5 text-warn" />
                    Xem thử bằng dữ liệu mẫu
                  </Button>
                </div>
                <Callout tone="warn" className="mt-4">
                  <strong className="text-slate-200">Cân nhắc bảo mật:</strong> khi dùng key trên server, bất kỳ ai mở
                  được địa chỉ của site này đều thao tác được bằng key đó. Hãy chỉ bật ở không gian riêng của bạn, hoặc
                  thêm lớp đăng nhập trước khi chia sẻ công khai. Bạn có thể dán key riêng ở cột bên phải để ghi đè.
                </Callout>
              </Panel>
            ) : (
              <Panel title="Chưa thấy key trong môi trường" subtitle="Relay không tìm thấy biến key nào">
                <p className="text-xs leading-relaxed text-slate-400">
                  Nếu muốn dùng key ở phía server, hãy thêm một trong các biến sau vào môi trường của workspace rồi khởi
                  động lại preview:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip>BOTKEEP_API_KEY</Chip>
                  <Chip>BOTKEEP_KEY</Chip>
                  <Chip>APIKEY</Chip>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  Hoặc dán key trực tiếp bên dưới — key chỉ nằm trong trình duyệt này.
                </p>
              </Panel>
            )}

            <Panel title="Dán API key của bạn" subtitle="Lưu trong trình duyệt này">
              <div className="space-y-4">
                <Field
                  label="Botkeep API key"
                  hint={
                    <>
                      Dạng <span className="font-mono">bk_…</span>. Tạo key tại{" "}
                      <a
                        className="link-underline text-slate-300"
                        href="https://botkeep.cloud/app/developer"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        botkeep.cloud/app/developer
                      </a>
                      .
                    </>
                  }
                >
                  <div className="flex gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void connectWithKey();
                      }}
                      placeholder="bk_live_…"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setShowKey((value) => !value)}
                      aria-label="Hiện hoặc ẩn key"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </Field>

                {connectError ? <Callout tone="danger">{connectError}</Callout> : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void connectWithKey()} loading={connecting} disabled={!draft.trim()}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Kết nối
                  </Button>
                  <a href="https://botkeep.cloud/app/developer" target="_blank" rel="noreferrer noopener">
                    <Button variant="ghost">
                      Tạo key
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>

                <Callout tone="warn">
                  Chỉ dùng key của chính bạn và nên đặt thời hạn ngắn. Một API key Botkeep đọc được tài khoản hosting
                  của bạn, nên đừng dán vào site bạn chưa kiểm tra — kể cả site này.
                </Callout>
              </div>
            </Panel>
          </div>

          <div className="min-w-0 space-y-4">
            {CONNECT_BULLETS.map((bullet) => (
              <div key={bullet.title} className="panel flex gap-3 p-4">
                <bullet.icon className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">{bullet.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{bullet.body}</p>
                </div>
              </div>
            ))}

            <Panel title="Quyền nên dùng" subtitle="Đủ cho mọi thứ bảng điều khiển đọc">
              <div className="flex flex-wrap gap-2">
                {RECOMMENDED_SCOPES.map((scope) => (
                  <ScopeChip key={scope} scope={scope} />
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Key chỉ đọc thì không thể start, stop hay xoá gì — đúng nhu cầu theo dõi. Chỉ thêm{" "}
                <span className="font-mono">power:write</span>, <span className="font-mono">workloads:create</span> hoặc{" "}
                <span className="font-mono">workloads:update</span> nếu bạn muốn thao tác ở tab Quản lý.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-5 sm:py-10">
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal/80">Bảng điều khiển</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-3xl">Tài khoản hosting</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sample ? (
              <Chip className="border-warn/40 bg-warn/10 text-warn">
                <Sparkles className="h-3 w-3" />
                Dữ liệu mẫu
              </Chip>
            ) : (
              <Chip className="border-signal/40 bg-signal/10 text-signal-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Đã kết nối
              </Chip>
            )}
            {sample ? (
              <Chip>không dùng key</Chip>
            ) : useEnvKey ? (
              <Chip>
                <Server className="h-3 w-3" />
                key trên server
              </Chip>
            ) : (
              <Chip>{maskKey(key)}</Chip>
            )}
            <Chip className="hidden sm:inline-flex">api.botkeep.cloud/api/v1/developer</Chip>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sample ? (
            <Button variant="secondary" size="sm" onClick={disconnect}>
              <KeyRound className="h-3.5 w-3.5" />
              Kết nối key thật
            </Button>
          ) : (
            <>
              {useEnvKey ? null : <CopyButton value={key} label="Sao chép key" />}
              <Button variant="secondary" size="sm" onClick={exploreSample}>
                <Sparkles className="h-3.5 w-3.5 text-warn" />
                Xem dữ liệu mẫu
              </Button>
              <Button variant="ghost" size="sm" onClick={disconnect}>
                <Unplug className="h-3.5 w-3.5" />
                <LogOut className="h-3.5 w-3.5" />
                Ngắt kết nối
              </Button>
            </>
          )}
        </div>
      </header>

      {sample ? (
        <Callout tone="warn" className="mb-5">
          <strong className="text-slate-200">Chế độ xem mẫu.</strong> Mọi giá trị trên màn hình là dữ liệu mẫu được tạo
          sẵn để bạn xem thử khi chưa có key, kể cả tab Quản lý: các thao tác ghi được mô phỏng và trả về operation id
          mẫu. Không có gì được gửi tới Botkeep và không có dữ liệu tài khoản nào hiển thị.
          {DEMO_FIRST_WORKLOAD ? " Chi tiết máy chủ, nhật ký, mạng và kiểm tra khởi động dùng cùng bộ dữ liệu mẫu." : null}
        </Callout>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5 w-max flex-nowrap sm:mb-6 sm:w-auto" />
      </div>

      {tab === "overview" ? (
        <OverviewPanel
          plan={plan}
          planError={planError}
          workloads={workloads}
          capabilities={capabilities}
          reload={() => void loadAll()}
          pending={pending}
          sample={sample}
        />
      ) : null}

      {tab === "workloads" ? (
        <WorkloadsPanel
          workloads={workloads}
          pending={pending}
          reload={() => void loadAll()}
          run={run}
          sample={sample}
          selected={selectedWorkload}
          onSelect={setSelectedWorkload}
          error={workloadError}
        />
      ) : null}

      {tab === "manage" ? (
        <ManagePanel
          run={run}
          workloads={workloads}
          capabilities={capabilities}
          pending={pending}
          reload={() => void loadAll()}
          plan={plan}
          planError={planError}
        />
      ) : null}

      {tab === "operations" ? <OperationsPanel run={run} sample={sample} /> : null}

      {tab === "playground" ? <PlaygroundPanel run={run} initial={initialEndpoint} /> : null}

      {tab === "activity" ? <ActivityPanel log={log} onClear={() => setLog([])} /> : null}

      <footer className="mt-8 flex flex-col gap-2 border-t border-ink-700/50 pt-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Relay: <span className="font-mono">POST /api/botkeep</span> · không lưu trạng thái, không lưu key, chỉ chuyển
          tiếp tới api.botkeep.cloud.
        </span>
        <a className="link-underline" href="https://botkeep.cloud/app/developer" target="_blank" rel="noreferrer noopener">
          Quản lý key trong panel Botkeep ↗
        </a>
      </footer>
    </div>
  );
}
