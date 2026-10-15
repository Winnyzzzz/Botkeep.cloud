import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Boxes,
  FileCode2,
  Gauge,
  HardDriveDownload,
  KeyRound,
  Layers,
  LineChart,
  Lock,
  ServerCog,
  ShieldCheck,
  Terminal,
  Timer,
  Workflow,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button, Callout, Chip, CodeBlock, CopyButton, Panel, ScopeChip } from "../components/ui/primitives";
import { ENDPOINTS, SCOPES, SPEC_INFO } from "../lib/endpoints.generated";
import { cn } from "../lib/utils";

const HERO_CURL = `curl --fail-with-body \\
  -H "Authorization: Bearer $BOTKEEP_API_KEY" \\
  "https://api.botkeep.cloud/api/v1/developer/workloads"`;

const HERO_RESPONSE = `{
  "data": [
    {
      "id": "••••••••",
      "name": "support-bot",
      "status": "running",
      "runtime": "nodejs",
      "updatedAt": "2026-10-15T09:41:02Z"
    }
  ],
  "nextCursor": null
}`;

const FEATURES = [
  {
    icon: Boxes,
    title: "Toàn cảnh đội máy chủ",
    body: "Mỗi máy chủ kèm trạng thái gần nhất, runtime và hạn mức tài nguyên, lấy trực tiếp từ dữ liệu của Botkeep.",
    endpoint: "GET /workloads",
    scope: "workloads:read",
  },
  {
    icon: Gauge,
    title: "Gói và hạn mức",
    body: "Gói đang dùng cùng hạn mức RAM, CPU, storage và số máy chủ — biết ngay còn bao nhiêu chỗ trước khi triển khai.",
    endpoint: "GET /plan",
    scope: "plan:read",
  },
  {
    icon: Terminal,
    title: "Nhật ký theo yêu cầu",
    body: "Xem những dòng log cuối của máy chủ mà không cần mở terminal hay vào panel.",
    endpoint: "GET /workloads/{id}/logs",
    scope: "logs:read",
  },
  {
    icon: Workflow,
    title: "Theo dõi tác vụ",
    body: "Thao tác ghi được xếp hàng chứ không áp dụng ngay. Theo dõi operation id tới khi hoàn tất hoặc lỗi.",
    endpoint: "GET /operations/{id}",
    scope: "workloads:read",
  },
  {
    icon: Activity,
    title: "Mạng và kiểm tra khởi động",
    body: "Xem cổng và địa chỉ máy chủ đang mở, cùng lý do một lần khởi động thất bại.",
    endpoint: "GET /workloads/{id}/network",
    scope: "workloads:read",
  },
  {
    icon: HardDriveDownload,
    title: "Sao lưu và triển khai",
    body: "Liệt kê bản sao lưu, xem nguồn GitHub và cách một lần deploy đi qua nền tảng.",
    endpoint: "GET /workloads/{id}/backups",
    scope: "backups:read",
  },
  {
    icon: Zap,
    title: "Tạo và điều khiển",
    body: "Triển khai máy chủ mới, rồi khởi động, khởi động lại, triển khai lại, dừng hoặc xoá. Tab Quản lý thực hiện các thao tác ghi thật, mỗi thao tác có Idempotency-Key và tác vụ để theo dõi.",
    endpoint: "POST /workloads/{id}/actions",
    scope: "power:write",
  },
];

const STEPS = [
  {
    icon: KeyRound,
    title: "Tạo key có phân quyền",
    body: "Mở panel developer của Botkeep, đặt tên key, chọn thời hạn và chỉ tick những quyền thật sự cần. Key mặc định chỉ đọc cho tới khi bạn bật quyền ghi.",
    footnote: "Panel → Workspace → Developer",
  },
  {
    icon: ShieldCheck,
    title: "Đưa key vào bảng điều khiển",
    body: "Dán key vào đây, hoặc để trong biến môi trường của server. Key chỉ được dùng cho các request gửi tới api.botkeep.cloud — không tạo tài khoản, không lưu trên server.",
    footnote: "lưu cục bộ hoặc trong env",
  },
  {
    icon: LineChart,
    title: "Theo dõi và điều khiển",
    body: "Xem máy chủ, hạn mức gói và trạng thái tác vụ, rồi giữ một nhật ký hoạt động cho mọi request bảng điều khiển đã gọi thay bạn.",
    footnote: "đọc và ghi theo quyền của key",
  },
];

const FAQ = [
  {
    q: "Vì sao bảng điều khiển không gọi trực tiếp api.botkeep.cloud?",
    a: "API trả về «Disallowed CORS origin» cho mọi origin trình duyệt không phải của họ, và đây là mặc định đúng: nó ngăn một trang lạ dùng key bạn đã dán ở đâu đó. Vì vậy bảng điều khiển có một relay cùng tên miền, chuyển tiếp request của bạn tới Botkeep nguyên vẹn. Relay không lưu bản sao nào và không thêm credential nào của riêng nó.",
  },
  {
    q: "API key của tôi được lưu ở đâu?",
    a: "Nếu bạn dán key, nó nằm trong local storage của trình duyệt này và trong header Authorization của mỗi request bạn kích hoạt. Nếu bạn đặt key trong biến môi trường của server, relay giữ key ở phía server và browser không bao giờ nhìn thấy nó. Cả hai cách đều không ghi key vào cơ sở dữ liệu hay log.",
  },
  {
    q: "Cần những quyền nào?",
    a: "Theo dõi chỉ cần workloads:read và plan:read. Thêm logs:read cho nhật ký, backups:read cho bản sao lưu, settings:read cho kiểm tra khởi động. Quyền ghi chỉ cần khi bạn dùng tab Quản lý: power:write để điều khiển máy chủ, workloads:create để tạo mới, workloads:update để đổi tài nguyên.",
  },
  {
    q: "Chạm giới hạn tốc độ thì sao?",
    a: "API cho 60 request unit mỗi phút cho mỗi key và 120 mỗi tài khoản, kèm 12 lượt ghi mỗi phút. Vượt hạn mức sẽ trả HTTP 429 và header Retry-After; lệnh nặng tốn 3 unit. Bảng điều khiển hiển thị đúng mã trạng thái, thông báo và thời gian chờ cho từng request.",
  },
  {
    q: "Gửi thao tác ghi từ tab Quản lý có an toàn không?",
    a: "Mọi thao tác ghi đều mang một Idempotency-Key được tạo mới, nên request gửi lại không bị áp dụng hai lần. Thao tác được xếp hàng trả về operation id để bạn theo dõi tới trạng thái kết thúc — được chấp nhận không có nghĩa là đã xong. Những thao tác nguy hiểm như xoá phải gõ xác nhận.",
  },
];

const usageByScope = SCOPES.reduce<Record<string, number>>((acc, item) => {
  acc[item.resource] = (acc[item.resource] ?? 0) + 1;
  return acc;
}, {});

const scopeResources = Object.keys(usageByScope).sort();
const writeEndpoints = ENDPOINTS.filter((endpoint) => endpoint.write).length;

export default function Landing() {
  return (
    <div className="relative">
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-12 sm:gap-14 sm:px-5 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip className="border-signal/30 bg-signal/10 text-signal-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Botkeep Developer API {SPEC_INFO.version}
              </Chip>
              <Chip>{ENDPOINTS.length} endpoint</Chip>
              <Chip>{SCOPES.length} quyền</Chip>
            </div>

            <h1 className="mt-6 text-balance text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Mọi bot bạn host,
              <br />
              <span className="bg-gradient-to-r from-signal via-signal-soft to-wire bg-clip-text text-transparent">
                gọn trong một màn hình.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-400 sm:mt-6 sm:text-base">
              Botkeep cấp cho dự án của bạn một server chạy 24/7. Bảng điều khiển này là cửa sổ nhìn vào đó: máy chủ và
              trạng thái gần nhất, hạn mức gói, nhật ký và tác vụ đang chờ — đọc thẳng từ Botkeep Developer API công khai
              bằng key do bạn kiểm soát.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
              <Link to="/console" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Mở bảng điều khiển
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/docs" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <FileCode2 className="h-4 w-4" />
                  Đọc tài liệu
                </Button>
              </Link>
            </div>

            <ul className="mt-7 grid gap-2 text-xs text-slate-400 sm:mt-8 sm:grid-cols-3">
              {[
                { icon: Lock, text: "Key nằm trong trình duyệt hoặc env" },
                { icon: ShieldCheck, text: "Mặc định chỉ đọc" },
                { icon: ServerCog, text: "Không cần tài khoản" },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2">
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-signal" />
                  {item.text}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="relative min-w-0"
          >
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-signal/5 blur-2xl" />
            <div className="panel overflow-hidden shadow-glow">
              <div className="flex items-center gap-2 border-b border-ink-700/60 bg-ink-900/80 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-signal/70" />
                <span className="ml-2 truncate font-mono text-[11px] text-slate-500">
                  bảng điều khiển — xem trước request
                </span>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                    <span className="font-mono text-wire">GET</span>
                    <span className="break-all">/api/v1/developer/workloads</span>
                  </p>
                  <CodeBlock code={HERO_CURL} actions={<CopyButton value={HERO_CURL} />} />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="h-px flex-1 bg-ink-700/70" />
                  <span className="shrink-0">HTTP 200 · 42 ms · payload minh hoạ</span>
                  <span className="h-px flex-1 bg-ink-700/70" />
                </div>

                <CodeBlock code={HERO_RESPONSE} actions={<CopyButton value={HERO_RESPONSE} />} />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-ink-700/60 bg-ink-900/60 px-4 py-3">
                <span className="chip border-signal/30 bg-signal/10 text-signal-soft">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                  đang chạy
                </span>
                <span className="chip">nodejs</span>
                <span className="chip">512 MB · 0.5 vCPU</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-ink-700/50 bg-ink-900/40">
        <div className="mx-auto grid w-full max-w-7xl gap-px px-4 py-6 sm:grid-cols-2 sm:px-5 sm:py-8 lg:grid-cols-4">
          {[
            { label: "Số thao tác endpoint", value: String(ENDPOINTS.length), hint: "trên 20 nhóm tài nguyên" },
            { label: "Quyền (scope)", value: String(SCOPES.length), hint: `${writeEndpoints} thao tác có thể ghi` },
            { label: "Ngân sách đọc", value: "60/phút", hint: "request unit cho mỗi key" },
            { label: "Ngân sách ghi", value: "12/phút", hint: "mỗi tài khoản, có xử lý HTTP 429" },
          ].map((stat) => (
            <div key={stat.label} className="px-1 py-3 sm:px-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{stat.label}</p>
              <p className="mt-1 font-mono text-xl text-slate-100 sm:text-2xl">{stat.value}</p>
              <p className="mt-1 text-[11px] text-slate-500">{stat.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-5 sm:py-20">
        <SectionHeading
          eyebrow="Bạn theo dõi được gì"
          title="Đọc mọi thứ, chỉ thay đổi điều bạn muốn"
          body="Các khung theo dõi chỉ cần quyền đọc, nên key giám sát không thể khởi động, dừng hay xoá gì. Tab Quản lý mở thêm thao tác ghi thật — tạo máy chủ, điều khiển máy chủ, đổi tài nguyên — và mỗi thao tác đều ghi rõ quyền cần có trước khi bạn dùng."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              className="group panel flex flex-col gap-3 p-5 transition hover:border-signal/30"
            >
              <feature.icon className="h-5 w-5 text-signal" />
              <h3 className="text-sm font-semibold text-slate-100">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{feature.body}</p>
              <div className="mt-auto space-y-2 pt-2">
                <code className="block break-all font-mono text-[11px] text-slate-500">{feature.endpoint}</code>
                <ScopeChip scope={feature.scope} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-y border-ink-700/50 bg-ink-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-5 sm:py-20">
          <SectionHeading
            eyebrow="Cách hoạt động"
            title="Ba bước, không cần cài đặt"
            body="Không phải triển khai gì ở phía Botkeep — một API key là đủ."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="panel relative p-6">
                <span className="absolute right-5 top-5 font-mono text-3xl text-ink-600">0{index + 1}</span>
                <step.icon className="h-5 w-5 text-signal" />
                <h3 className="mt-4 text-sm font-semibold text-slate-100">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.body}</p>
                <p className="mt-4 break-all font-mono text-[11px] text-slate-500">{step.footnote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-5 sm:py-20">
        <SectionHeading
          eyebrow="Phân quyền"
          title="Giới hạn key đúng bằng thứ bạn cần"
          body="Key Botkeep mặc định chỉ đọc cho tới khi bạn tick quyền ghi. Đây là toàn bộ quyền được tài liệu hoá, nhóm theo tài nguyên mà chúng mở khoá."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scopeResources.map((resource) => {
            const scopes = SCOPES.filter((item) => item.resource === resource);
            return (
              <Panel key={resource} title={resource} subtitle={`${scopes.length} quyền`}>
                <div className="flex flex-wrap gap-2">
                  {scopes.map((item) => (
                    <ScopeChip key={item.scope} scope={item.scope} />
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="border-y border-ink-700/50 bg-ink-900/40">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-14 sm:px-5 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
          <SectionHeading
            eyebrow="An toàn là ưu tiên"
            title="Key của bạn không bị lộ ra ngoài"
            body="Bảng điều khiển được thiết kế quanh một nguyên tắc: credential thuộc về bạn và api.botkeep.cloud, không ai khác."
          />
          <div className="space-y-3">
            <div className="panel p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Timer className="h-4 w-4 text-signal" />
                Xử lý giới hạn tốc độ ngay từ request đầu
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Mỗi phản hồi hiển thị mã trạng thái, độ trễ và thời gian Retry-After. Lệnh nặng tốn 3 unit, nên bảng
                điều khiển giữ việc theo dõi tác vụ ở mức có chủ đích thay vì liên tục.
              </p>
            </div>
            <div className="panel p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Layers className="h-4 w-4 text-signal" />
                Thao tác ghi idempotent
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Mọi thao tác ghi đều được gắn một Idempotency-Key mới, nên gửi lại không bị áp dụng hai lần — và công việc
                đang xếp hàng được theo dõi bằng operation id.
              </p>
            </div>
            <div className="panel p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Lock className="h-4 w-4 text-signal" />
                Relay không lưu trạng thái
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Relay chuyển tiếp request và token của bạn, không cache gì và không giữ credential riêng. Xoá key khỏi
                bảng điều khiển là nó biến mất.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-5 sm:py-20">
        <SectionHeading eyebrow="Giải đáp" title="Trước khi bạn dán key" centered />
        <div className="mt-8 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className={cn(
                "group panel cursor-pointer px-5 py-4 transition open:border-signal/25",
                "[&_summary::-webkit-details-marker]:hidden",
              )}
            >
              <summary className="flex items-center justify-between gap-4 text-sm font-medium text-slate-100">
                {item.q}
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-4 sm:px-5">
        <div className="relative overflow-hidden rounded-3xl border border-signal/25 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-850 p-6 shadow-glow sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/10 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center lg:gap-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-3xl">
                Dán key, hoặc dùng key trong env. Xem cả đội máy chủ.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                Quyền chỉ đọc đủ để tải máy chủ, hạn mức gói, nhật ký và tác vụ. Thêm quyền ghi nếu bạn muốn tab Quản lý
                triển khai máy chủ mới hoặc điều khiển máy chủ đang chạy. Không có gì được tải lên server.
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-3 lg:w-auto">
              <Link to="/console" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Mở bảng điều khiển
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/reference" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Xem {ENDPOINTS.length} endpoint
                </Button>
              </Link>
            </div>
          </div>

          <Callout tone="warn" className="relative mt-6 sm:mt-8">
            <strong className="text-slate-200">Chỉ dùng key của chính bạn.</strong> Một API key Botkeep đọc được tài
            khoản hosting của bạn. Hãy tạo key giám sát riêng với thời hạn ngắn, và đừng dán key vào site bạn chưa tìm
            hiểu cách xử lý request — kể cả site này.
          </Callout>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  centered?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", centered && "mx-auto text-center")}>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal/80">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
      {body ? <p className="mt-4 text-sm leading-relaxed text-slate-400">{body}</p> : null}
    </div>
  );
}
