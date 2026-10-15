import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Send, Trash2, Wand2 } from "lucide-react";

import { Button, Callout, Chip, CodeBlock, CopyButton, Input, Panel, ScopeChip, Select } from "../ui/primitives";
import { ResponseCard } from "./shared";
import type { CallResult, RequestSpec } from "../../lib/botkeep";
import { ENDPOINTS } from "../../lib/endpoints.generated";
import { newIdempotencyKey, cn, methodClass } from "../../lib/utils";
import { toCurl } from "../../lib/botkeep";

export type RunFn = <T = unknown>(spec: RequestSpec) => Promise<CallResult<T>>;

type QueryRow = { id: string; name: string; value: string };

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const QUICK_PICKS = [
  { label: "Máy chủ", method: "GET", path: "/workloads" },
  { label: "Gói", method: "GET", path: "/plan" },
  { label: "Khả năng", method: "GET", path: "/capabilities" },
  { label: "Dự án", method: "GET", path: "/projects" },
  { label: "Thanh toán", method: "GET", path: "/billing" },
  { label: "Hỗ trợ", method: "GET", path: "/tickets" },
];

export function PlaygroundPanel({
  run,
  initial,
}: {
  run: RunFn;
  initial: { method: string; path: string } | null;
}) {
  const [method, setMethod] = useState(initial?.method ?? "GET");
  const [path, setPath] = useState(initial?.path ?? "/workloads");
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [body, setBody] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());
  const [accepted, setAccepted] = useState(false);
  const [spec, setSpec] = useState<RequestSpec | null>(null);
  const [result, setResult] = useState<CallResult<unknown> | null>(null);
  const [pending, setPending] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);

  const write = WRITE_METHODS.has(method.toUpperCase());
  const matched = useMemo(
    () => ENDPOINTS.find((item) => item.method === method && item.path === path) ?? null,
    [method, path],
  );
  const usesPathParam = useMemo(() => /\{[^}]+\}/.test(path), [path]);

  function buildSpec(): RequestSpec {
    const query: Record<string, string> = {};
    for (const row of rows) {
      if (row.name.trim()) query[row.name.trim()] = row.value;
    }
    let payload: unknown;
    if (write && body.trim()) payload = JSON.parse(body);
    return { method, path, query, body: payload, idempotencyKey: write ? idempotencyKey : undefined };
  }

  async function submit() {
    setBodyError(null);
    let next: RequestSpec;
    try {
      next = buildSpec();
    } catch (error) {
      setBodyError(`Nội dung request không phải JSON hợp lệ: ${(error as Error).message}`);
      return;
    }
    setSpec(next);
    setPending(true);
    const response = await run(next);
    setResult(response);
    setPending(false);
    if (write) setIdempotencyKey(newIdempotencyKey());
  }

  const curlPreview = toCurl(
    (() => {
      try {
        return buildSpec();
      } catch {
        return { method, path };
      }
    })(),
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      <Panel title="Yêu cầu" subtitle="Gửi qua relay cùng tên miền của site này">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="block sm:w-32">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Phương thức
              </span>
              <Select value={method} className="w-full" onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">Đường dẫn</span>
              <Input
                list="botkeep-endpoint-paths"
                value={path}
                spellCheck={false}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/workloads"
              />
            </label>
          </div>

          <datalist id="botkeep-endpoint-paths">
            {[...new Set(ENDPOINTS.map((item) => item.path))].map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PICKS.map((pick) => (
              <button
                key={pick.label}
                type="button"
                onClick={() => {
                  setMethod(pick.method);
                  setPath(pick.path);
                }}
                className="focus-ring rounded-md border border-ink-600 bg-ink-800/60 px-2 py-1 text-[11px] text-slate-400 transition hover:text-slate-100"
              >
                {pick.label}
              </button>
            ))}
          </div>

          {usesPathParam ? (
            <Callout tone="warn">
              Đường dẫn này có <span className="font-mono">{"{placeholder}"}</span>. Hãy thay bằng id thật (máy chủ, tác
              vụ, ticket…) trước khi gửi.
            </Callout>
          ) : null}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Tham số truy vấn</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRows((previous) => [...previous, { id: crypto.randomUUID(), name: "", value: "" }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink-600/70 px-3 py-2.5 text-[11px] text-slate-500">
                Chưa có. Các lệnh danh sách nhận <span className="font-mono">limit</span> và{" "}
                <span className="font-mono">cursor</span>.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={row.id} className="flex gap-2">
                    <Input
                      value={row.name}
                      placeholder="limit"
                      onChange={(event) =>
                        setRows((previous) =>
                          previous.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                        )
                      }
                    />
                    <Input
                      value={row.value}
                      placeholder="50"
                      onChange={(event) =>
                        setRows((previous) =>
                          previous.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setRows((previous) => previous.filter((_, i) => i !== index))}
                      aria-label="Xoá tham số"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {write ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Nội dung request (JSON)
                </span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder='{ "action": "restart" }'
                  className="focus-ring w-full rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-2 font-mono text-[12px] text-slate-100 placeholder:text-slate-500"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                    Idempotency-Key
                  </span>
                  <Input value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} />
                </label>
                <Button variant="secondary" onClick={() => setIdempotencyKey(newIdempotencyKey())}>
                  <Wand2 className="h-3.5 w-3.5" />
                  Tạo key mới
                </Button>
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-ink-600 bg-ink-800 accent-signal"
                />
                Tôi hiểu request này thay đổi trạng thái trên tài khoản Botkeep của tôi và cần quyền ghi.
              </label>
            </>
          ) : null}

          {bodyError ? <Callout tone="danger">{bodyError}</Callout> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void submit()} loading={pending} disabled={write && !accepted}>
              <Send className="h-3.5 w-3.5" />
              {write ? "Gửi thao tác ghi" : "Gửi request"}
            </Button>
            {write && !accepted ? (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <AlertTriangle className="h-3.5 w-3.5 text-warn" />
                Tick xác nhận để bật thao tác ghi
              </span>
            ) : null}
          </div>

          {matched ? (
            <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn("rounded-md border px-2 py-0.5 font-mono text-[11px]", methodClass(matched.method))}
                >
                  {matched.method}
                </span>
                <span className="text-xs text-slate-300">{matched.summary}</span>
                {matched.scopes.map((scope) => (
                  <ScopeChip key={scope} scope={scope} />
                ))}
              </div>
              {matched.requestSchema ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Cấu trúc body · {matched.requestSchema.name}
                  </p>
                  <ul className="space-y-0.5 font-mono text-[11px] text-slate-400">
                    {matched.requestSchema.props.map((prop) => (
                      <li key={prop.name}>
                        <span className="text-slate-200">{prop.name}</span>
                        <span className="text-wire">: {prop.type}</span>
                        {prop.required ? <span className="text-warn"> bắt buộc</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Đường dẫn này không nằm trong danh mục sinh tự động — request vẫn được chuyển tiếp, nhưng không có thông tin
              về quyền cần thiết.
            </p>
          )}
        </div>
      </Panel>

      <div className="min-w-0 space-y-4">
        <Panel
          title="Phản hồi"
          subtitle="Trạng thái, độ trễ và payload đúng như API trả về"
          actions={<Chip>POST /api/botkeep</Chip>}
        >
          <ResponseCard
            spec={spec}
            result={result}
            pending={pending}
            emptyTitle="Chưa gửi gì"
            emptyDescription="Chọn một endpoint rồi gửi. Request đọc luôn an toàn; thao tác ghi cần xác nhận và quyền ghi."
          />
        </Panel>

        <Panel title="Lệnh cURL tương đương" subtitle="Chạy đúng request này từ backend của bạn">
          <CodeBlock code={curlPreview} wrap actions={<CopyButton value={curlPreview} label="Sao chép cURL" />} />
        </Panel>
      </div>
    </div>
  );
}

export function ActivityPanel({
  log,
  onClear,
}: {
  log: {
    id: string;
    at: number;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    ok: boolean;
    message?: string;
  }[];
  onClear: () => void;
}) {
  return (
    <Panel
      title="Nhật ký hoạt động"
      subtitle="Mọi request bảng điều khiển đã gọi trong phiên này — không có gì rời khỏi trình duyệt của bạn"
      actions={
        <Button size="sm" variant="ghost" onClick={onClear} disabled={log.length === 0}>
          <Trash2 className="h-3.5 w-3.5" />
          Xoá
        </Button>
      }
      bodyClassName="p-0"
    >
      {log.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-slate-500">
          Chưa có request nào. Hãy tải danh sách máy chủ hoặc gửi thử một request ở tab Thử nghiệm.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-ink-900/70 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2 font-medium">Thời gian</th>
                <th className="px-3 py-2 font-medium">Phương thức</th>
                <th className="px-3 py-2 font-medium">Đường dẫn</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Độ trễ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40">
              {log.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-2 font-mono text-[11px] text-slate-500">
                    {new Date(entry.at).toLocaleTimeString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", methodClass(entry.method))}
                    >
                      {entry.method}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-3 py-2">
                    <code className="block truncate font-mono text-[11px] text-slate-300">{entry.path}</code>
                    {entry.message ? (
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">{entry.message}</span>
                    ) : null}
                  </td>
                  <td className={cn("px-3 py-2 font-mono text-[11px]", entry.ok ? "text-signal" : "text-warn")}>
                    {entry.status || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{entry.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
