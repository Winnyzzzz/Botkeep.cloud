import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ExternalLink, Menu, Radio, X } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./ui/primitives";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-signal/30 bg-signal/10">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
          <path
            d="M8 21.5v-10l8 4.6 8-4.6v10"
            fill="none"
            stroke="#4ade80"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute inset-0 rounded-lg border border-signal/40 animate-pulseRing" />
      </span>
      <span className="leading-none">
        <span className="block text-sm font-semibold tracking-tight text-slate-100">Botkeep</span>
        <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-signal/80">bảng điều khiển</span>
      </span>
    </span>
  );
}

const NAV = [
  { to: "/", label: "Tổng quan", end: true },
  { to: "/docs", label: "Tài liệu" },
  { to: "/reference", label: "Tra cứu API" },
  { to: "/console", label: "Bảng điều khiển" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link to="/" className="focus-ring shrink-0 rounded-lg" aria-label="Trang chủ Botkeep Console">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "focus-ring rounded-lg px-3 py-2 text-sm transition",
                  isActive ? "bg-ink-800/80 text-slate-100" : "text-slate-400 hover:bg-ink-800/50 hover:text-slate-200",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href="https://botkeep.cloud/app/developer"
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:text-slate-200"
          >
            <Radio className="h-3.5 w-3.5 text-signal" />
            Tạo API key
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link to="/console">
            <Button size="sm">Mở bảng điều khiển</Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="focus-ring rounded-lg border border-ink-700 p-2 text-slate-300 md:hidden"
          aria-label="Mở menu"
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-ink-700/60 bg-ink-950/95 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn("rounded-lg px-3 py-2.5 text-sm", isActive ? "bg-ink-800 text-slate-100" : "text-slate-400")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <a
              href="https://botkeep.cloud/app/developer"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg px-3 py-2.5 text-sm text-slate-400"
            >
              Tạo API key ↗
            </a>
            <Link to="/console" className="mt-1">
              <Button className="w-full">Mở bảng điều khiển</Button>
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-700/60 bg-ink-950/60 sm:mt-24">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-5 sm:py-12 md:grid-cols-4 md:gap-10">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-400">
            Bảng điều khiển độc lập cho nền tảng hosting Botkeep: theo dõi máy chủ, giới hạn gói và các tác vụ đang chờ
            trực tiếp qua Botkeep Developer API công khai.
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-500">
            Không liên kết và không được Botkeep bảo trợ. API key chỉ được gửi tới{" "}
            <span className="font-mono text-slate-400">api.botkeep.cloud</span>.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Bảng điều khiển</h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            <li>
              <Link to="/console" className="hover:text-slate-200">
                Kết nối API key
              </Link>
            </li>
            <li>
              <Link to="/docs" className="hover:text-slate-200">
                Bắt đầu sử dụng
              </Link>
            </li>
            <li>
              <Link to="/reference" className="hover:text-slate-200">
                Danh mục endpoint
              </Link>
            </li>
            <li>
              <a href="/openapi.json" className="hover:text-slate-200" download>
                Tải đặc tả OpenAPI
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">API</h2>
          <ul className="mt-3 space-y-2 font-mono text-[11px] text-slate-400">
            <li className="break-all">api.botkeep.cloud/api/v1/developer</li>
            <li>60 units/phút mỗi key</li>
            <li>120 units/phút mỗi tài khoản</li>
            <li>12 lượt ghi/phút</li>
            <li className="break-all">
              <a
                href="https://botkeep.cloud/app/developer"
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-slate-200"
              >
                botkeep.cloud/app/developer ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-700/40 px-4 py-5 text-center text-[11px] leading-relaxed text-slate-500 sm:px-5">
        Xây dựng trên Botkeep Developer API công khai. Dùng đúng mức: quyền chỉ đọc là đủ cho việc theo dõi.
      </div>
    </footer>
  );
}
