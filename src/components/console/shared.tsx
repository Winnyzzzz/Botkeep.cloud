import type { ReactNode } from "react";
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";

import { Callout, CodeBlock, CopyButton, EmptyState } from "../ui/primitives";
import { JsonTree } from "../JsonTree";
import { buildPath, toCurl, type CallResult, type RequestSpec } from "../../lib/botkeep";
import { cn, methodClass, statusClass } from "../../lib/utils";

/** Khung hiển thị chuẩn cho một phản hồi API đã đi qua relay. */
export function ResponseCard({
  spec,
  result,
  pending,
  emptyTitle = "Chưa có request nào",
  emptyDescription,
}: {
  spec: RequestSpec | null;
  result: CallResult<unknown> | null;
  pending?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
}) {
  if (pending) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-8 text-sm text-slate-400">
        <Clock className="h-4 w-4 animate-pulse text-signal" />
        Đang chờ api.botkeep.cloud…
      </div>
    );
  }

  if (!result || !spec) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(spec.method.toUpperCase());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[11px]", methodClass(spec.method))}>
          {spec.method.toUpperCase()}
        </span>
        <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-slate-300">{buildPath(spec)}</code>
        {result.ok ? (
          <span className={cn("font-mono text-xs", statusClass(result.status))}>HTTP {result.status}</span>
        ) : (
          <span className={cn("font-mono text-xs", statusClass(result.error.status))}>
            HTTP {result.error.status || "lỗi kết nối"}
          </span>
        )}
        <span className="font-mono text-xs text-slate-500">{result.durationMs} ms</span>
      </div>

      {!result.ok ? (
        <div className="space-y-2">
          <Callout tone={result.error.status === 429 ? "warn" : "danger"}>
            <p className="flex items-start gap-2 font-medium text-slate-200">
              <ShieldAlert className="mt-px h-4 w-4 shrink-0" />
              {result.error.message}
            </p>
            {result.error.retryAfter !== null ? (
              <p className="mt-2 text-slate-400">
                API yêu cầu thử lại sau <span className="font-mono">{result.error.retryAfter}s</span> (HTTP 429).
              </p>
            ) : null}
            {result.error.validation?.length ? (
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
                {result.error.validation.map((item, index) => (
                  <li key={index}>
                    {item.loc.join(".") || "body"}: {item.msg}
                  </li>
                ))}
              </ul>
            ) : null}
          </Callout>
          {result.error.status === 403 ? (
            <p className="text-xs leading-relaxed text-slate-500">
              Hãy sửa quyền của key trong{" "}
              <a
                className="link-underline text-slate-300"
                href="https://botkeep.cloud/app/developer"
                target="_blank"
                rel="noreferrer noopener"
              >
                panel developer của Botkeep
              </a>{" "}
              rồi tạo một key thay thế có quyền mà request này cần.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-ink-700/60 bg-ink-950/60 p-4">
          <JsonTree value={result.data} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={toCurl(spec)} label="Sao chép cURL" />
        {write ? (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5 text-warn" />
            Thao tác ghi — gửi kèm Idempotency-Key
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words font-mono text-lg text-slate-100">{value}</p>
      {hint ? <p className="mt-1 break-words text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function JsonBlock({ value, label }: { value: unknown; label?: string }) {
  const code = JSON.stringify(value, null, 2) ?? "null";
  return <CodeBlock code={code} wrap actions={<CopyButton value={code} label={label ?? "Sao chép JSON"} />} />;
}
