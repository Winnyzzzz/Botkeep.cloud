# Botkeep Console

A developer console and API portal for the public **Botkeep Developer API**
(`https://api.botkeep.cloud/api/v1/developer`).

Botkeep gives a project a server that runs 24/7. This site is the window into that
account: workloads and their last known state, plan and resource budgets, log
tails, plus queued operation and request receipts — read with a Botkeep API key
that never leaves the browser.

## Ngôn ngữ

Toàn bộ giao diện bằng tiếng Việt (`lang="vi"`). Bố cục được làm responsive cho điện thoại: menu rút gọn, tab cuộn ngang, bảng dữ liệu cuộn trong khung, form chuyển về một cột và nút bấm full-width dưới `sm`.

## API key

Hai cách dùng, chọn một:

1. **Dán trong trình duyệt** — key nằm trong `localStorage` và trong header của các request gửi tới relay.
2. **Để trong biến môi trường của server** — relay đọc `BOTKEEP_API_KEY`, hoặc `BOTKEEP_KEY`, hoặc `APIKEY`, rồi tự dùng khi request không kèm header. Key không bao giờ được trả về trình duyệt; nút “Dùng key trên server” trong tab Console sẽ kiểm tra bằng `GET /capabilities` trước khi kết nối.

> ⚠️ Chế độ key trên server là chế độ dùng chung: ai mở được URL của site cũng thao tác được bằng key đó. Chỉ dùng ở workspace riêng, hoặc thêm lớp đăng nhập trước khi chia sẻ công khai.

## Pages

| Route        | What it does                                                                        |
| ------------ | ----------------------------------------------------------------------------------- |
| `/`          | Themed landing page: capabilities, scopes, limits, safety model, FAQ                 |
| `/docs`      | Getting started, authentication, scopes, rate limits, idempotency, error handling    |
| `/reference` | All 69 operations generated from the API's OpenAPI document, filterable and copyable |
| `/console`   | Kết nối key, rồi theo dõi máy chủ, gói, tác vụ, thử request và **thao tác ghi thật** ở tab Quản lý |

Tab **Quản lý** trong `/console` làm được việc thật: điều khiển máy chủ (start / restart / redeploy /
retry / stop / kill / delete), tạo máy chủ mới (`POST /workloads`, danh sách runtime và start command
lấy từ `GET /capabilities`), và đổi tài nguyên (`PUT /workloads/{id}/resources`). Mỗi thao tác ghi mang
một `Idempotency-Key` mới và được theo dõi bằng `GET /operations/{id}` tới trạng thái kết thúc.

Danh sách đó là **runtime**, không phải framework: app React + Vite được `vite build` rồi chọn `static` (Site tĩnh),
hoặc `nodejs` / `bun` khi cần server, SSR hay tự đặt start command. `/docs` có bảng đối chiếu *code của bạn → runtime*.

`/console` cũng có **chế độ dữ liệu mẫu** được dán nhãn rõ, để xem toàn bộ giao diện khi chưa có key.

## Why requests go through a relay

The Botkeep API only accepts browser requests from its own origins — any other
preflight is answered with `Disallowed CORS origin`, which is the correct default
because it stops an unrelated page from using a key. So the SPA never calls
`api.botkeep.cloud` directly. It posts a small envelope to its own origin:

```
POST /api/botkeep
Authorization: Bearer <your key>
{ "method": "GET", "path": "/workloads", "query": { "limit": 50 },
  "idempotencyKey": "…" }
```

Two implementations of that contract exist:

- `server/index.mjs` — the preview/static server. Serves `dist/` and relays.
- `api/botkeep.py` — the production serverless function (standard library only).

Both are stateless: the caller's token is forwarded upstream verbatim, nothing is
cached, logged or stored, and paths are rejected if they try to escape the fixed
`/api/v1/developer` prefix.

## Stack

Vite 6 · React 19 · TypeScript · Tailwind CSS 3 · React Router 7 · Framer Motion ·
Express (preview server only)

## Scripts

```bash
bun install                 # dependencies
bun run dev                 # vite dev server (no relay; use the preview for the console)
bun run build               # typecheck + production build into dist/
bun run start               # build, then serve dist/ + relay on $PORT (default 5173)
bun run typecheck           # tsc -b --noEmit
bun run generate:endpoints  # refresh the OpenAPI spec + typed endpoint catalog
bun run verify:preview      # smoke-test the static server and the relay
```

## Regenerating the API catalog

`scripts/generate-endpoints.mjs` fetches the live OpenAPI document and writes:

- `public/openapi.json` — the raw spec, served same-origin and downloadable
- `src/lib/endpoints.generated.ts` — typed endpoint/scope catalog used by the UI

Run it after Botkeep changes the API.

## Security notes

- The API key lives in this browser's local storage and in the `Authorization`
  header of requests bound for the relay. It is never written to a database,
  committed to the repo or injected at build time.
- No `.env` value is required: the relay needs no credential of its own.
- Read-only scopes (`workloads:read`, `plan:read`, …) are all the console needs;
  write operations in the playground require an explicit confirmation and are
  always sent with an `Idempotency-Key`.

This project is an independent developer tool and is not affiliated with Botkeep.
