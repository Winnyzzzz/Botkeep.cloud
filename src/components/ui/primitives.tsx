import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn, STATE_CLASS, stateKind } from "../../lib/utils";

/* ------------------------------------------------------------------ button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const BUTTON_VARIANTS = {
  primary:
    "bg-signal text-ink-950 hover:bg-signal-soft shadow-[0_10px_30px_-12px_rgba(74,222,128,0.7)] border border-signal",
  secondary: "bg-ink-800/80 text-slate-100 hover:bg-ink-700 border border-ink-600",
  ghost: "bg-transparent text-slate-300 hover:bg-ink-800/70 border border-transparent hover:border-ink-700",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/40",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------- panel */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel min-w-0 shadow-panel", className)}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="min-w-0">
            {title ? <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ inputs */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-10 w-full rounded-lg border border-ink-600 bg-ink-900/80 px-3 font-mono text-sm text-slate-100 placeholder:text-slate-500",
        className,
      )}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "focus-ring h-10 rounded-lg border border-ink-600 bg-ink-900/80 px-3 text-sm text-slate-100",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------ badges */

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("chip", className)}>{children}</span>;
}

export function StatePill({ value, className }: { value: unknown; className?: string }) {
  const label = value === null || value === undefined || value === "" ? "unknown" : String(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
        STATE_CLASS[stateKind(value)],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function ScopeChip({ scope }: { scope: string }) {
  const writable = scope.endsWith(":write") || scope === "power:write";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px]",
        writable
          ? "border-warn/30 bg-warn/10 text-warn"
          : "border-wire/25 bg-wire/10 text-wire",
      )}
    >
      {scope}
    </span>
  );
}

/* ------------------------------------------------------------------- other */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-slate-400", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-600/70 bg-ink-900/40 px-6 py-12 text-center">
      {icon ? <div className="text-slate-500">{icon}</div> : null}
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-slate-400">{description}</p> : null}
      {action}
    </div>
  );
}

export function Callout({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-wire/30 bg-wire/[0.07] text-slate-300",
    warn: "border-warn/30 bg-warn/[0.07] text-slate-300",
    danger: "border-danger/30 bg-danger/[0.07] text-slate-300",
    success: "border-signal/30 bg-signal/[0.07] text-slate-300",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-xs leading-relaxed", tones[tone], className)}>{children}</div>
  );
}

export function CopyButton({
  value,
  label = "Sao chép",
  className,
  size = "sm",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="secondary"
      size={size}
      className={className}
      onClick={() => {
        const done = () => setCopied(true);
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(value).then(done).catch(done);
        } else {
          done();
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-signal" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Đã chép" : label}
    </Button>
  );
}

export function CodeBlock({
  code,
  className,
  actions,
  wrap = false,
}: {
  code: string;
  className?: string;
  actions?: ReactNode;
  wrap?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-ink-700/70 bg-ink-950/80", className)}>
      {actions ? <div className="absolute right-2 top-2 z-10 flex gap-2">{actions}</div> : null}
      <pre
        className={cn(
          "max-h-[26rem] overflow-auto px-4 py-3.5 font-mono text-[12px] leading-relaxed text-slate-300",
          wrap && "whitespace-pre-wrap break-words",
          actions && "pt-12",
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; icon?: ReactNode; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-xl border border-ink-700/60 bg-ink-900/60 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "focus-ring inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition",
            active === tab.id
              ? "bg-ink-700/80 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "text-slate-400 hover:bg-ink-800/60 hover:text-slate-200",
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded-full bg-ink-600/70 px-1.5 py-px font-mono text-[10px] text-slate-300">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-700/40 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="max-w-[60%] break-words text-right text-sm text-slate-200">{children}</span>
    </div>
  );
}
