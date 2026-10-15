import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Filter, Play, Search, ShieldAlert, Sliders } from "lucide-react";

import {
  Button,
  Chip,
  CodeBlock,
  CopyButton,
  EmptyState,
  Input,
  ScopeChip,
  Select,
} from "../components/ui/primitives";
import { ENDPOINT_GROUPS, ENDPOINTS, SCOPES, SPEC_INFO, type EndpointDoc } from "../lib/endpoints.generated";
import { cn, methodClass } from "../lib/utils";
import { toCurl } from "../lib/botkeep";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export default function Reference() {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? "all";
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<string>("all");
  const [scope, setScope] = useState<string>("all");
  const [writesOnly, setWritesOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ENDPOINTS.filter((endpoint) => {
      if (group !== "all" && endpoint.group !== group) return false;
      if (method !== "all" && endpoint.method !== method) return false;
      if (scope !== "all" && !endpoint.scopes.includes(scope)) return false;
      if (writesOnly && !endpoint.write) return false;
      if (!needle) return true;
      return (
        endpoint.path.toLowerCase().includes(needle) ||
        endpoint.summary.toLowerCase().includes(needle) ||
        endpoint.operationId.toLowerCase().includes(needle) ||
        endpoint.scopes.some((item) => item.includes(needle))
      );
    });
  }, [group, method, query, scope, writesOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointDoc[]>();
    for (const endpoint of filtered) {
      const list = map.get(endpoint.group) ?? [];
      list.push(endpoint);
      map.set(endpoint.group, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const activeFilters = [
    group !== "all" ? `nhóm: ${group}` : null,
    method !== "all" ? `phương thức: ${method}` : null,
    scope !== "all" ? `quyền: ${scope}` : null,
    writesOnly ? "chỉ thao tác ghi" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-5 sm:py-12">
      <header className="mb-8 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal/80">Tra cứu API</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
          {SPEC_INFO.title} · {ENDPOINTS.length} thao tác
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Sinh tự động từ đặc tả OpenAPI công khai của API. Đường dẫn, tham số, cấu trúc body và quyền yêu cầu được giữ
          nguyên; cấu trúc phản hồi là mở, nên hãy luôn xem payload thật mà key của bạn nhận được.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="đường dẫn, mô tả, quyền…"
              className="pl-9 font-sans"
              aria-label="Tìm endpoint"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-ink-700/60 bg-ink-900/50 p-4">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Bộ lọc
            </p>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">Nhóm tài nguyên</span>
              <Select
                value={group}
                className="w-full"
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  if (event.target.value === "all") next.delete("group");
                  else next.set("group", event.target.value);
                  setParams(next, { replace: true });
                }}
              >
                <option value="all">Tất cả nhóm ({ENDPOINT_GROUPS.length})</option>
                {ENDPOINT_GROUPS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">Quyền yêu cầu</span>
              <Select value={scope} className="w-full" onChange={(event) => setScope(event.target.value)}>
                <option value="all">Mọi quyền ({SCOPES.length})</option>
                {SCOPES.map((item) => (
                  <option key={item.scope} value={item.scope}>
                    {item.scope} ({item.endpoints})
                  </option>
                ))}
              </Select>
            </label>

            <div>
              <span className="mb-1 block text-[11px] text-slate-500">Phương thức</span>
              <div className="flex flex-wrap gap-1">
                <FilterPill active={method === "all"} onClick={() => setMethod("all")}>
                  tất cả
                </FilterPill>
                {METHODS.map((item) => (
                  <FilterPill key={item} active={method === item} onClick={() => setMethod(item)}>
                    {item}
                  </FilterPill>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={writesOnly}
                onChange={(event) => setWritesOnly(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-800 accent-signal"
              />
              Chỉ thao tác ghi (cần Idempotency-Key)
            </label>
          </div>

          <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-4">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
              <Sliders className="h-3.5 w-3.5" />
              Kết quả
            </p>
            <p className="mt-2 font-mono text-2xl text-slate-100">{filtered.length}</p>
            <p className="text-[11px] text-slate-500">trong {ENDPOINTS.length} thao tác</p>
            {activeFilters.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activeFilters.map((item) => (
                  <Chip key={item}>{item}</Chip>
                ))}
              </div>
            ) : null}
            {activeFilters.length || query ? (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => {
                  setQuery("");
                  setMethod("all");
                  setScope("all");
                  setWritesOnly(false);
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                Xoá toàn bộ bộ lọc
              </Button>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          {grouped.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Không có endpoint nào khớp bộ lọc"
              description="Hãy thử từ khoá rộng hơn, hoặc xoá bộ lọc theo nhóm và quyền."
            />
          ) : (
            grouped.map(([groupName, endpoints]) => (
              <section key={groupName} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 border-b border-ink-700/50 pb-2">
                  <h2 className="break-all font-mono text-sm text-slate-300">{groupName}</h2>
                  <span className="shrink-0 text-[11px] text-slate-500">{endpoints.length} thao tác</span>
                </div>

                <ul className="space-y-2">
                  {endpoints.map((endpoint) => {
                    const id = `${endpoint.method} ${endpoint.path}`;
                    const open = openId === id;
                    return (
                      <li key={id}>
                        <article
                          className={cn(
                            "panel overflow-hidden transition",
                            open ? "border-signal/25" : "hover:border-ink-600",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : id)}
                            className="focus-ring flex w-full items-start gap-3 px-3 py-3 text-left sm:px-4"
                          >
                            <span
                              className={cn(
                                "mt-px w-16 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-mono text-[11px]",
                                methodClass(endpoint.method),
                              )}
                            >
                              {endpoint.method}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block break-all font-mono text-[12px] text-slate-200">
                                {endpoint.path.replace("/api/v1/developer", "")}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-slate-400">{endpoint.summary}</span>
                                {endpoint.scopes.map((item) => (
                                  <ScopeChip key={item} scope={item} />
                                ))}
                                {endpoint.scopes.length === 0 ? <Chip>không cần quyền</Chip> : null}
                              </span>
                            </span>
                            <ChevronRight
                              className={cn("mt-1 h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-90")}
                            />
                          </button>

                          {open ? <EndpointDetail endpoint={endpoint} /> : null}
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EndpointDetail({ endpoint }: { endpoint: EndpointDoc }) {
  const curl = toCurl({ method: endpoint.method, path: endpoint.path });
  const playPath = `/console?endpoint=${encodeURIComponent(`${endpoint.method} ${endpoint.path}`)}&group=${encodeURIComponent(endpoint.group)}`;

  return (
    <div className="space-y-5 border-t border-ink-700/60 bg-ink-950/40 px-3 py-4 sm:px-4">
      {endpoint.params.length ? (
        <div>
          <h3 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Tham số</h3>
          <div className="overflow-x-auto rounded-lg border border-ink-700/60">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-ink-900/70 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Tên</th>
                  <th className="px-3 py-2 font-medium">Vị trí</th>
                  <th className="px-3 py-2 font-medium">Kiểu</th>
                  <th className="px-3 py-2 font-medium">Bắt buộc</th>
                  <th className="px-3 py-2 font-medium">Ràng buộc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40">
                {endpoint.params.map((param) => (
                  <tr key={`${param.in}-${param.name}`} className="align-top">
                    <td className="px-3 py-2 font-mono text-slate-200">{param.name}</td>
                    <td className="px-3 py-2 text-slate-400">{param.in}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-wire">{param.type}</td>
                    <td className="px-3 py-2 text-slate-400">{param.required ? "có" : "không"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{param.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {endpoint.requestSchema ? (
        <div>
          <h3 className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
            Body request · {endpoint.requestSchema.name}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-ink-700/60">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-ink-900/70 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Trường</th>
                  <th className="px-3 py-2 font-medium">Kiểu</th>
                  <th className="px-3 py-2 font-medium">Bắt buộc</th>
                  <th className="px-3 py-2 font-medium">Ràng buộc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40">
                {endpoint.requestSchema.props.map((prop) => (
                  <tr key={prop.name} className="align-top">
                    <td className="px-3 py-2 font-mono text-slate-200">{prop.name}</td>
                    <td className="px-3 py-2 break-all font-mono text-[11px] text-wire">{prop.type}</td>
                    <td className="px-3 py-2 text-slate-400">{prop.required ? "có" : "không"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{prop.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
        <Info label="Mã thành công" value={endpoint.successStatus ? String(endpoint.successStatus) : "2xx"} />
        <Info label="Idempotency-Key" value={endpoint.write ? "bắt buộc" : "không cần"} />
        <Info label="Operation id" value={endpoint.operationId} />
      </div>

      {endpoint.write ? (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
          Thao tác này thay đổi trạng thái. Cần header{" "}
          <span className="font-mono text-slate-300">Idempotency-Key</span> dài ít nhất 16 ký tự và trả về 202 khi công
          việc được xếp hàng.
        </p>
      ) : null}

      <CodeBlock code={curl} wrap actions={<CopyButton value={curl} label="Sao chép cURL" />} />

      <Link to={playPath}>
        <Button size="sm" variant="secondary">
          <Play className="h-3.5 w-3.5" />
          Thử trong bảng điều khiển
        </Button>
      </Link>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 break-all font-mono text-[11px] text-slate-300">{value}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring rounded-md border px-2 py-1 font-mono text-[11px] transition",
        active
          ? "border-signal/40 bg-signal/10 text-signal-soft"
          : "border-ink-600 bg-ink-800/60 text-slate-400 hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}
