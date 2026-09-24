# AGENTS.md — Rules for AI agents in this repo

This repo is the complete working documentation of the KindleFrame project (E-Ink dashboard on a jailbroken Kindle Voyage, driven by n8n). It is built so a fresh agent with no chat history can continue the work.

## Reading order (mandatory)

1. `README.md` (state + structure)
2. This file
3. `ISSUES.md` (chronology — especially the last 3 entries)
4. `docs/03-eink-rendering.md` (critical constraints + final architecture + implementation plan)
5. As needed: `docs/01-hardware.md`, `docs/02-jailbreak.md`, `docs/04-n8n-integration.md`, `docs/05-artifact-manifest.md`

## Actual state (2026-09-24) — align to THIS, not to older doc descriptions

- On the card, **`refresh.sh` v4** + **`dash`** (static Go binary, mmap framebuffer writes) are running. The `dash` render is **not visible** (no EPDC refresh triggered — confirmed by user: "nothing happens"). The currently visible image is the **bistably retained** `dashboard.png` (single-IDAT grayscale, from the `eips` path of the v2/v3 era).
- The final architecture is **decided but NOT implemented**: `dash` = fetch + decode + grayscale + **`saveKindlePNG`** (single IDAT); display = **`eips -g`**. See `ISSUES.md` I10.
- The project's Notion pages partly describe older states (v2/v3); this repo is newer. In case of conflict: **this repo wins**.
- The **Go source** (`go.mod`, `main.go`, `render.go`, `convert.go`, `fb_linux.go`, `fb_stub.go`) lives in `/Users/private/kindle-dash/` on **another machine** — `/Users/private` on this machine is **empty**. The source is **not** in the repo and must **not be invented**. To build: use the binary in `artifacts/binaries/dash` as reference + re-implement per plan, or obtain the source from the user.

## Hard technical rules (from `docs/03`)

- eips output PNG: **exactly 1 IDAT chunk**, **IHDR color type 0** (8-bit grayscale), 1072×1448 (or 1448×1072), bit depth 8, interlace 0.
- eips `-b` (BMP) is a **NO-OP** on this device. BMP paths: forgotten.
- Visible E-Ink updates **only** via `eips` (EPDC wave). mmap write alone = invisible.
- Console geometry: `rotate=3` (270°), correct display = **t180** (transpose + 180° = 90° CW + horizontal flip).
- **Go toolchain cap: Go 1.23.** Go 1.24+ requires Linux ≥ 3.2; the Voyage runs kernel 3.0.35. Build: `CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s"`.

## Prohibitions

- **No free terminal on the device.** All interaction is via MRPI (`;log`, `;get`) and files on `/mnt/us/`. Do not plan on an interactive shell.
- **No secrets in the repo** (API keys, credential IDs, webhook UUIDs, hostnames beyond the documented endpoint). n8n JSONs stay with placeholders; for any new dump: sanitize first (procedure: `docs/04` §Sanitizing).
- **No new large binaries committed:** Kindle update bins (~200 MB each), >3 MB BMP/PNM diagnostic derivatives, test BMPs (4.6 MB). List + reasons: `docs/05-artifact-manifest.md`.
- **Do not break the card:** `/Volumes/Kindle` is the user's live card. Only point writes for deploys (replace a file), never bulk delete/format — and announce every such action to the user beforehand.
- **No git on the device.** Device files are managed via the USB card only; this repo is documentation, not a deploy mechanism.
- **Do not invent results:** display checks can only be done by the user. Mark everything unverified as `open/assumed` (Notion discipline: `[verified]` / `[recalled]` / `[assumption]` / `[open]`).

## Definition of Done — next milestone ticket (saveKindlePNG)

1. `saveKindlePNG`: one `compress/zlib` stream over all filter-0 rows → exactly 1 IDAT; IHDR color type 0; CRCs correct (reference implementation: Python recipe in `docs/03`).
2. `dash get <out> <urls...>`: fetch + Go decode + Floyd-Steinberg grayscale → `saveKindlePNG` → `/mnt/us/dashboard.png`.
3. `dash render <file>`: `exec /usr/sbin/eips -g <file> -x 0 -y 0`.
4. Static ARM build (`CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`, Go ≤ 1.23), watch size (current: 6.29 MB).
5. Deploy to `/mnt/us/dash` (size change triggers hot re-stage in `refresh.sh` v4) + reboot.
6. **User verification:** dashboard visible? orientation (t180 reference)? flicker acceptable?
7. Log analysis `refresh.log`: `dl ok` + `render rc=0`.

Only after that: open items from `ISSUES.md` (n8n grayscale optional, home-screen persistence of `refresh.sh`, download interval / flicker trade-off).