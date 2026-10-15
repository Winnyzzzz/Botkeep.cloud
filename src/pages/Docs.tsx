import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Callout, Chip, CodeBlock, CopyButton, Panel, ScopeChip } from "../components/ui/primitives";
import { ENDPOINTS, ENDPOINT_GROUPS, SCOPES, SPEC_INFO } from "../lib/endpoints.generated";

const QUICKSTART = `export BOTKEEP_API_KEY="bk_live_…"

curl --fail-with-body \\
  -H "Authorization: Bearer $BOTKEEP_API_KEY" \\
  "https://api.botkeep.cloud/api/v1/developer/workloads?limit=50"`;

const CREATE = `curl --fail-with-body -X POST \\
  -H "Authorization: Bearer $BOTKEEP_API_KEY" \\
  -H "Idempotency-Key: 7c1d4be0a93f42d6b8e5a1c07f2d3e84" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "support-bot",
    "platform": "discord",
    "runtime": "nodejs",
    "runtimeVersion": "22",
    "sourceType": "github",
    "repository": "your-org/support-bot",
    "branch": "main",
    "startCommand": "npm start",
    "resources": { "memoryLimitMb": 512, "cpuLimitPercent": 50, "storageLimitMb": 1024 }
  }' \\
  "https://api.botkeep.cloud/api/v1/developer/workloads"`;

const CREATE_FIELDS = [
  { name: "name", notes: "2–64 ký tự, chỉ gồm chữ, số, khoảng trắng, dấu chấm, gạch ngang, gạch dưới" },
  { name: "platform", notes: "discord | telegram | general" },
  { name: "runtime", notes: "lấy từ GET /capabilities: nodejs, nodemon, bun, python, php, php-site, cpp, java, rust, static" },
  { name: "runtimeVersion", notes: "phiên bản có trong capabilities, ví dụ 22 cho Node.js, 3.12 cho Python" },
  { name: "sourceType", notes: "github | zip | blank" },
  { name: "repository / branch", notes: "owner/repo và nhánh (mặc định main) khi nguồn là GitHub" },
  { name: "archiveName / archiveBase64", notes: "tệp nén dạng base64 khi nguồn là zip" },
  { name: "startCommand", notes: "lệnh Botkeep chạy để khởi động; capabilities trả về lệnh mặc định cho từng runtime" },
  { name: "resources", notes: "{ memoryLimitMb, cpuLimitPercent, storageLimitMb } — bắt buộc đủ ba trường" },
  { name: "tokenProvided / token", notes: "thông tin nguồn cho repository riêng tư (không bắt buộc)" },
  { name: "templateId / seedFiles", notes: "template có sẵn, và các tệp ghi trước lần khởi động đầu tiên" },
];

/** Runtime nào dùng cho loại code nào — runtimes không phải framework. */
const RUNTIME_MAP: { need: string; runtime: string; notes: string }[] = [
  {
    need: "Giao diện React + Vite đã build (chỉ còn HTML/CSS/JS)",
    runtime: "static",
    notes: "nginx phục vụ thư mục tĩnh; dùng lệnh cố định và không nhận nguồn GitHub",
  },
  {
    need: "React + Vite cần dev server, SSR hoặc proxy API",
    runtime: "nodejs / bun",
    notes: "cho tự đặt startCommand và nhận nguồn GitHub; nhớ build trước khi chạy",
  },
  {
    need: "Bot Discord/Telegram bằng JavaScript hoặc Python",
    runtime: "nodejs / nodemon / bun / python",
    notes: "start command mặc định là npm start, python main.py, bun run index.ts…",
  },
  {
    need: "Cơ sở dữ liệu managed",
    runtime: "mysql / postgres / redis / mariadb",
    notes: "Botkeep tự quản lý service, không nhận nguồn code",
  },
];

const WRITE = `curl --fail-with-body -X POST \\
  -H "Authorization: Bearer $BOTKEEP_API_KEY" \\
  -H "Idempotency-Key: 3f9c1a77b2e54d0fa1c8d2e4b7f60a93" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "restart"}' \\
  "https://api.botkeep.cloud/api/v1/developer/workloads/{workload_id}/actions"

# 202 Accepted -> {"operationId": "op_…"}
# sau đó: GET /operations/op_… cho tới khi báo hoàn tất`;

const TYPESCRIPT = `const BASE = "https://api.botkeep.cloud/api/v1/developer";

async function botkeep<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(\`\${BASE}\${path}\`, {
    ...init,
    headers: {
      authorization: \`Bearer \${process.env.BOTKEEP_API_KEY}\`,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 5);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return botkeep<T>(path, init);
  }
  if (!response.ok) throw new Error(\`Botkeep \${response.status}: \${await response.text()}\`);
  return (await response.json()) as T;
}

const workloads = await botkeep("/workloads");`;

const PYTHON = `import os, requests

BASE = "https://api.botkeep.cloud/api/v1/developer"
HEADERS = {"Authorization": f"Bearer {os.environ['BOTKEEP_API_KEY']}"}

response = requests.get(f"{BASE}/plan", headers=HEADERS, timeout=20)
response.raise_for_status()
print(response.json())`;

const ERRORS = [
  { code: "200 / 202", label: "Thành công", note: "202 nghĩa là thao tác ghi đã được xếp hàng. Hãy theo dõi operation id trả về." },
  { code: "401", label: "Key bị từ chối", note: '{"detail": "…"} — key thiếu, hết hạn hoặc đã bị thu hồi.' },
  { code: "403", label: "Thiếu quyền", note: "Key không có quyền mà thao tác yêu cầu." },
  { code: "422", label: "Dữ liệu không hợp lệ", note: "Mảng detail kiểu FastAPI với loc / msg / type cho từng trường sai." },
  { code: "429", label: "Vượt giới hạn tốc độ", note: "Đọc header Retry-After và chờ; ngân sách đọc và ghi tách riêng." },
];

const SECTIONS = [
  { id: "quickstart", title: "Bắt đầu nhanh" },
  { id: "auth", title: "Xác thực" },
  { id: "create", title: "Tạo máy chủ" },
  { id: "scopes", title: "Quyền và scope" },
  { id: "relay", title: "Cách bảng điều khiển gọi API" },
  { id: "limits", title: "Giới hạn tốc độ" },
  { id: "writes", title: "Thao tác ghi và tác vụ" },
  { id: "errors", title: "Xử lý lỗi" },
  { id: "examples", title: "Ví dụ client" },
  { id: "resources", title: "Nhóm tài nguyên" },
];

export default function Docs() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-5 sm:py-12">
      <header className="mb-10 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal/80">Tài liệu</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">Gọi {SPEC_INFO.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Toàn bộ nội dung dưới đây được đọc từ chính đặc tả OpenAPI của API tại{" "}
          <a
            className="link-underline break-all font-mono text-slate-300"
            href={SPEC_INFO.source}
            target="_blank"
            rel="noreferrer noopener"
          >
            /openapi.json
          </a>
          . Đặc tả là công khai; key của bạn thì không. Có {ENDPOINTS.length} thao tác được tài liệu hoá trong{" "}
          {ENDPOINT_GROUPS.length} nhóm tài nguyên.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip>Xác thực Bearer</Chip>
          <Chip>JSON vào / JSON ra</Chip>
          <Chip>Thao tác ghi xếp hàng</Chip>
          <Chip>Bắt buộc Idempotency-Key khi ghi</Chip>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-slate-500">Trong trang này</p>
          <ul className="space-y-1 text-xs">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2 py-1.5 text-slate-400 transition hover:bg-ink-800/60 hover:text-slate-100"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-ink-700/60 bg-ink-900/50 p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <BookOpen className="h-3.5 w-3.5 text-signal" />
              Cần đặc tả?
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Bản sao của đặc tả được đóng gói cùng site này để trang tra cứu dùng được cả khi offline.
            </p>
            <a href="/openapi.json" download className="mt-3 inline-block w-full">
              <Button size="sm" variant="secondary" className="w-full">
                Tải openapi.json
              </Button>
            </a>
          </div>
        </nav>

        <div className="min-w-0 space-y-14">
          <DocSection id="quickstart" title="Bắt đầu nhanh">
            <p>
              Tạo key trong panel Botkeep ở mục <strong className="text-slate-200">Workspace → Developer</strong> (
              <a
                className="link-underline text-slate-300"
                href="https://botkeep.cloud/app/developer"
                target="_blank"
                rel="noreferrer noopener"
              >
                botkeep.cloud/app/developer
              </a>
              ). Đặt tên, chọn thời hạn và tick đúng quyền cần dùng. Key ngừng hoạt động ngay khi hết hạn hoặc bị thu hồi,
              và mỗi tài khoản giữ được tối đa năm key đang hoạt động.
            </p>
            <CodeBlock code={QUICKSTART} actions={<CopyButton value={QUICKSTART} />} />
            <Callout tone="warn">
              Đừng để key trong code front-end, repository công khai hay ảnh chụp màn hình. Hãy dùng nó từ server, từ
              runtime của bot, hoặc — như bảng điều khiển này — từ một relay không lưu key.
            </Callout>
          </DocSection>

          <DocSection id="auth" title="Xác thực">
            <p>
              Mọi thao tác xác thực bằng bearer token. Không có key trên query string, không có luồng cookie và không có
              OAuth: gửi key thô trong header, API sẽ tự suy ra khách hàng, quyền và ngân sách từ key đó.
            </p>
            <CodeBlock
              code={`Authorization: Bearer $BOTKEEP_API_KEY`}
              actions={<CopyButton value="Authorization: Bearer $BOTKEEP_API_KEY" />}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Base URL" value={SPEC_INFO.baseUrl} />
              <KeyValue label="Phiên bản spec" value={SPEC_INFO.version} />
              <KeyValue label="Cơ chế" value="HTTP Bearer (securityScheme: BotkeepKey)" />
              <KeyValue label="Kiểu nội dung" value="application/json" />
            </div>
          </DocSection>

          <DocSection id="create" title="Tạo máy chủ">
            <p>
              Một máy chủ được tạo bằng đúng một POST. Đây chính là nội dung mà mục{" "}
              <strong className="text-slate-200">Tạo máy chủ</strong> trong bảng điều khiển gửi đi: platform, runtime,
              nguồn code và hạn mức tài nguyên bạn lấy từ gói của mình.
            </p>
            <CodeBlock code={CREATE} actions={<CopyButton value={CREATE} />} />
            <p>
              Danh sách runtime, phiên bản, start command mặc định và mức RAM/Storage tối thiểu nên lấy từ{" "}
              <span className="font-mono text-slate-300">GET /capabilities</span> thay vì tự đoán — bảng điều khiển làm
              đúng như vậy.
            </p>
            <p>
              Danh sách trong <span className="font-mono text-slate-300">capabilities.runtimes</span> là{" "}
              <strong className="text-slate-200">runtime</strong> — engine Botkeep thực sự chạy — chứ không phải
              framework. React + Vite vì thế không bao giờ xuất hiện ở đó: nó là framework chạy <em>trên</em> Node.js,
              và code của nó được đóng gói lại trước khi triển khai.
            </p>
            <div className="overflow-x-auto rounded-xl border border-ink-700/60">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead className="bg-ink-900/70 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code của bạn</th>
                    <th className="px-3 py-2 font-medium">Chọn runtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40">
                  {RUNTIME_MAP.map((row) => (
                    <tr key={row.need}>
                      <td className="px-3 py-2 text-slate-300">{row.need}</td>
                      <td className="px-3 py-2 text-slate-400">
                        <span className="font-mono text-slate-200">{row.runtime}</span> — {row.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Botkeep chạy đúng một lệnh khởi động cho mỗi máy chủ, nên code cần được build sẵn (hoặc chính{" "}
              <span className="font-mono text-slate-300">startCommand</span> bạn đặt tự làm bước build). Với{" "}
              <span className="font-mono text-slate-300">static</span>, Botkeep dùng lệnh cố định và không nhận nguồn
              GitHub — hãy đưa phần đã build lên bằng workspace trống hoặc tệp ZIP.
            </p>
            <div className="overflow-x-auto rounded-xl border border-ink-700/60">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-ink-900/70 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Trường</th>
                    <th className="px-3 py-2 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40">
                  {CREATE_FIELDS.map((field) => (
                    <tr key={field.name}>
                      <td className="px-3 py-2 font-mono text-slate-200">{field.name}</td>
                      <td className="px-3 py-2 text-slate-400">{field.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Phản hồi là <span className="font-mono text-slate-300">202 Accepted</span> kèm operation id. Hãy kiểm tra{" "}
              <span className="font-mono text-slate-300">GET /operations/{"{id}"}</span> tới khi có trạng thái kết thúc
              trước khi coi máy chủ là đã chạy. Cần quyền{" "}
              <span className="font-mono text-slate-300">workloads:create</span>.
            </p>
            <Callout tone="warn">
              Tạo máy chủ sẽ chiếm tài nguyên của gói, và máy chủ đã dừng vẫn giữ nguyên tài nguyên. Hãy xem{" "}
              <span className="font-mono">GET /plan</span> trước khi triển khai.
            </Callout>
          </DocSection>

          <DocSection id="scopes" title="Quyền và scope">
            <p>
              Mỗi thao tác khai báo quyền mà nó cần. Đọc là mặc định: key mới chỉ xem được dữ liệu cho tới khi bạn bật rõ
              một quyền ghi như <span className="font-mono text-warn">power:write</span> hay{" "}
              <span className="font-mono text-warn">files:write</span>. Gọi thao tác thiếu quyền sẽ trả HTTP 403.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCOPES.map((scope) => (
                <div
                  key={scope.scope}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2"
                >
                  <ScopeChip scope={scope.scope} />
                  <span className="font-mono text-[11px] text-slate-500">{scope.endpoints} thao tác</span>
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="relay" title="Cách bảng điều khiển gọi API">
            <p>
              Botkeep chỉ nhận request từ trình duyệt khi origin thuộc về họ — preflight từ origin khác luôn bị trả{" "}
              <span className="font-mono text-slate-300">Disallowed CORS origin</span>. Đó là mặc định đúng: nó ngăn một
              trang bất kỳ dùng key bạn đã dán ở đâu đó. Vì thế bảng điều khiển không gọi thẳng{" "}
              <span className="font-mono text-slate-300">api.botkeep.cloud</span> từ trình duyệt.
            </p>
            <p>
              Thay vào đó, trang gửi một envelope nhỏ tới chính origin của nó tại{" "}
              <span className="font-mono text-slate-300">POST /api/botkeep</span>:
            </p>
            <CodeBlock
              code={`{
  "method": "GET",
  "path": "/workloads",
  "query": { "limit": 50 },
  "idempotencyKey": "…"        // chỉ với thao tác ghi
}`}
              actions={
                <CopyButton
                  value={`{
  "method": "GET",
  "path": "/workloads",
  "query": { "limit": 50 }
}`}
                />
              }
            />
            <p>
              Relay chép header <span className="font-mono text-slate-300">Authorization</span> của bạn lên request
              upstream, trả nguyên vẹn phản hồi về, và từ chối những đường dẫn cố vượt ra khỏi tiền tố cố định{" "}
              <span className="font-mono text-slate-300">/api/v1/developer</span>. Relay không lưu key, không ghi log key
              và không cần biến môi trường nào của riêng nó.
            </p>
            <Callout tone="info">
              <strong className="text-slate-200">Dùng key từ env:</strong> nếu server đặt{" "}
              <span className="font-mono">BOTKEEP_API_KEY</span> (hoặc{" "}
              <span className="font-mono">BOTKEEP_KEY</span> / <span className="font-mono">APIKEY</span>), bảng điều khiển
              có thể chạy mà không cần dán gì: relay tự dùng key đó khi request không kèm header. Key không bao giờ được
              gửi về trình duyệt. Lưu ý đây là chế độ dùng chung — hãy cân nhắc trước khi để site truy cập công khai.
            </Callout>
            <Callout tone="info">
              Muốn bỏ relay? Hãy gọi API từ backend của bạn — câu cURL hiện bên cạnh mỗi phản hồi chạy được ở bất cứ đâu
              key của bạn an toàn.
            </Callout>
          </DocSection>

          <DocSection id="limits" title="Giới hạn tốc độ">
            <p>
              Ngân sách được áp cho từng key và từng tài khoản. Vượt ngân sách sẽ bị từ chối bằng HTTP 429 kèm header{" "}
              <span className="font-mono text-slate-300">Retry-After</span>.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <LimitCard title="Mỗi key" value="60" unit="request unit / phút" />
              <LimitCard title="Mỗi tài khoản" value="120" unit="request unit / phút" />
              <LimitCard title="Thao tác ghi" value="12" unit="lượt ghi / phút" />
            </div>
            <p className="mt-4">
              Lệnh nặng tốn 3 unit thay vì 1 và chạy với số luồng giới hạn. Các endpoint danh sách nhận{" "}
              <span className="font-mono text-slate-300">limit</span> và{" "}
              <span className="font-mono text-slate-300">cursor</span>; hãy phân trang bằng cursor thay vì tăng limit.
            </p>
          </DocSection>

          <DocSection id="writes" title="Thao tác ghi và tác vụ">
            <p>
              Request ghi phải mang header{" "}
              <span className="font-mono text-slate-300">Idempotency-Key</span> dài từ 16 đến 64 ký tự (
              <span className="font-mono">A–Z a–z 0–9 _ -</span>). Gửi cùng key hai lần thì chỉ áp dụng một lần, nhờ đó
              việc thử lại là an toàn. Tác vụ được xếp hàng trả về 202 kèm operation id.
            </p>
            <CodeBlock code={WRITE} actions={<CopyButton value={WRITE} />} />
            <p>
              Được chấp nhận không phải là đã xong. Hãy kiểm tra{" "}
              <span className="font-mono text-slate-300">GET /operations/{"{id}"}</span> tới khi có trạng thái kết thúc, và
              nhớ rằng mỗi lần kiểm tra đều tiêu tốn ngân sách đọc.
            </p>
          </DocSection>

          <DocSection id="errors" title="Xử lý lỗi">
            <div className="space-y-2">
              {ERRORS.map((error) => (
                <div
                  key={error.code}
                  className="flex flex-col gap-1 rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-24 shrink-0 font-mono text-xs text-slate-200">{error.code}</span>
                  <span className="w-44 shrink-0 text-xs font-medium text-slate-300">{error.label}</span>
                  <span className="text-xs text-slate-400">{error.note}</span>
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="examples" title="Ví dụ client">
            <p>Hai client tối giản đã tự xử lý giới hạn tốc độ và lỗi.</p>
            <h3 className="text-sm font-semibold text-slate-200">TypeScript</h3>
            <CodeBlock code={TYPESCRIPT} actions={<CopyButton value={TYPESCRIPT} />} />
            <h3 className="text-sm font-semibold text-slate-200">Python</h3>
            <CodeBlock code={PYTHON} actions={<CopyButton value={PYTHON} />} />
          </DocSection>

          <DocSection id="resources" title="Nhóm tài nguyên">
            <p>Đi thẳng tới nhóm bạn cần trong trang tra cứu.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ENDPOINT_GROUPS.map((group) => {
                const count = ENDPOINTS.filter((endpoint) => endpoint.group === group).length;
                return (
                  <Link
                    key={group}
                    to={`/reference?group=${encodeURIComponent(group)}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2.5 text-xs text-slate-300 transition hover:border-signal/30 hover:text-slate-100"
                  >
                    <span className="truncate font-mono">{group}</span>
                    <span className="flex shrink-0 items-center gap-2 text-slate-500">
                      {count}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link to="/reference">
              <Button variant="secondary" size="sm" className="mt-4">
                Mở trang tra cứu đầy đủ
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </DocSection>

          <Panel title="Tích hợp không chính thức" subtitle="Tài liệu này mô tả một API công khai do Botkeep vận hành">
            <p className="text-xs leading-relaxed text-slate-400">
              Bảng điều khiển này là công cụ độc lập, không liên kết với Botkeep. Những gì mô tả ở đây lấy từ đặc tả
              OpenAPI mà Botkeep công bố và từ phản hồi thực tế; nền tảng có thể thay đổi bất cứ lúc nào. Với câu hỏi về
              tài khoản, thanh toán hay nền tảng, hãy dùng panel chính thức.
            </p>
            <a
              className="link-underline mt-3 inline-flex items-center gap-1.5 text-xs text-slate-300"
              href="https://botkeep.cloud/app/developer"
              target="_blank"
              rel="noreferrer noopener"
            >
              Mở panel developer chính thức của Botkeep
              <ExternalLink className="h-3 w-3" />
            </a>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-slate-400 [&_strong]:text-slate-200">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-[12px] text-slate-200">{value}</p>
    </div>
  );
}

function LimitCard({ title, value, unit }: { title: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 font-mono text-2xl text-signal">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{unit}</p>
    </div>
  );
}
