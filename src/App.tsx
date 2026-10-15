import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";

import { SiteFooter, SiteHeader } from "./components/site-chrome";
import { Button, Spinner } from "./components/ui/primitives";

const Landing = lazy(() => import("./pages/Landing"));
const Docs = lazy(() => import("./pages/Docs"));
const Reference = lazy(() => import("./pages/Reference"));
const Console = lazy(() => import("./pages/Console"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center gap-3 py-32 text-sm text-slate-500">
      <Spinner />
      Đang tải…
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-5 sm:py-32">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal/80">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Đường dẫn này không thuộc API</h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-400">
        Trang bạn tìm không tồn tại. Quay về trang tổng quan, hoặc vào thẳng bảng điều khiển.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link to="/">
          <Button variant="secondary">Về trang tổng quan</Button>
        </Link>
        <Link to="/console">
          <Button>Mở bảng điều khiển</Button>
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/reference" element={<Reference />} />
            <Route path="/console" element={<Console />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
