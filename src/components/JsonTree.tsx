import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn, relativeTime } from "../lib/utils";
import { humanKey, kindOf } from "../lib/shape";

/**
 * Renders any JSON payload. Botkeep declares open response schemas, so the
 * console stays useful by displaying exactly what the API returned.
 */
export function JsonTree({ value, depth = 0, name }: { value: unknown; depth?: number; name?: string }) {
  const kind = kindOf(value);

  if (kind === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <Leaf name={name} display="{}" tone="muted" />;
    return (
      <Branch name={name} defaultOpen={depth < 2} summary={`${entries.length} trường`}>
        {entries.map(([key, nested]) => (
          <JsonTree key={key} name={key} value={nested} depth={depth + 1} />
        ))}
      </Branch>
    );
  }

  if (kind === "array") {
    const items = value as unknown[];
    if (items.length === 0) return <Leaf name={name} display="[]" tone="muted" />;
    return (
      <Branch name={name} defaultOpen={depth < 2} summary={`${items.length} mục`}>
        {items.map((item, index) => (
          <JsonTree key={index} name={`[${index}]`} value={item} depth={depth + 1} />
        ))}
      </Branch>
    );
  }

  return <Leaf name={name} display={formatScalar(value)} tone={scalarTone(value)} raw={value} />;
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const text = String(value);
  const stamp = typeof value === "string" && /\d{4}-\d{2}-\d{2}T/.test(value) ? relativeTime(value) : null;
  return text.length > 220 ? `${text.slice(0, 220)}…` : stamp ? `${text}  ·  ${stamp}` : text;
}

function scalarTone(value: unknown): "string" | "number" | "boolean" | "muted" {
  if (value === null || value === undefined) return "muted";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

const TONES = {
  string: "text-slate-200",
  number: "text-wire",
  boolean: "text-warn",
  muted: "text-slate-500",
};

function Leaf({
  name,
  display,
  tone,
  raw,
}: {
  name?: string;
  display: string;
  tone: keyof typeof TONES;
  raw?: unknown;
}) {
  return (
    <div className="flex gap-2 py-0.5 font-mono text-[12px] leading-relaxed">
      {name ? <span className="shrink-0 text-slate-500">{name}:</span> : null}
      <span className={cn("break-all", TONES[tone])}>{display}</span>
      {typeof raw === "string" && raw.startsWith("http") ? (
        <a
          className="link-underline shrink-0 text-wire"
          href={raw}
          target="_blank"
          rel="noreferrer noopener"
        >
          mở
        </a>
      ) : null}
    </div>
  );
}

function Branch({
  name,
  summary,
  defaultOpen,
  children,
}: {
  name?: string;
  summary: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="focus-ring group flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left font-mono text-[12px]"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition", open && "rotate-90")} />
        {name ? <span className="text-slate-300">{name}</span> : <span className="text-slate-500">gốc</span>}
        <span className="text-slate-600">{summary}</span>
      </button>
      {open ? <div className="ml-3 border-l border-ink-700/60 pl-3">{children}</div> : null}
    </div>
  );
}

/** Flat table of a record — used where a card is more readable than a tree. */
export function RecordTable({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(record).filter(([, value]) => kindOf(value) !== "object");
  if (entries.length === 0) return <JsonTree value={record} />;

  return (
    <dl className="divide-y divide-ink-700/40">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-6 py-2">
          <dt className="text-xs uppercase tracking-wider text-slate-500">{humanKey(key)}</dt>
          <dd className="max-w-[62%] break-words text-right font-mono text-[12px] text-slate-200">
            {formatScalar(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
