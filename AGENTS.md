# AGENTS.md — Rules for AI agents in this repo

This repo is the complete working documentation of the KindleFrame project (E-Ink dashboard on a jailbroken Kindle Voyage, driven by n8n). It is built so a fresh agent with no chat history can continue the work.

## Reading order (mandatory)

1. `README.md` (state + structure)
2. This file
3. `todos.json` → its `resume` block is the exact continuation point (ground truth)
4. `ISSUES.md` (chronology — referenced from todos via `issue`)
5. `docs/03-eink-rendering.md` (critical constraints + final architecture + implementation plan)
6. As needed: `docs/01-hardware.md`, `docs/02-jailbreak.md`, `docs/04-n8n-integration.md`, `docs/05-artifact-manifest.md`

## TODO workflow — `todos.json` is the ground truth

`todos.json` (repo root) is the machine-readable source of truth for the work: what is done, what is open, where to continue. It is written **for agents**; human-oriented detail lives in `docs/` and `ISSUES.md` and is only referenced from it (`refs`, `issue`), never duplicated.

**"Continue" protocol** — when the user types `continue` (or similar):

1. Read the `resume` block in `todos.json` — it is the exact continuation point. No other context is needed.
2. Work on **exactly one todo at a time**, respecting `depends_on` and `block_on`.
3. After **every** state change (start, partial result, done, blocked, direction change) update `todos.json` in the **same commit** as the work itself: `status`, `resume`, `updated_at`. Never commit work with a stale `todos.json` — at any moment the work can be interrupted, and the next agent must be able to resume from `resume` alone.
4. `done` requires a `verification` note (how it was checked; display-related items: "user verified …").
5. **Never delete or renumber todos.** Finished entries stay checked off forever (traceability); abandoned work becomes `dropped` with `reason`. New work gets the next free `Tnn` id.
6. If a todo changes the plan in a way that contradicts a doc, update that doc in the same commit (this repo wins over Notion).

## Actual state (2026-09-24) — align to THIS, not to older doc descriptions

- On the card since 24.09 13:29Z (T17 deploy, point-write, announced + authorized): **`refresh.sh` v4** (SHA `d8d84e99…`) + **`dash`** = the T16 build (SHA `ce74c7b4…`, static Go 1.23.12, render = `exec /usr/sbin/eips -g`). User reboot ~14:19Z = effective trigger; logs green (boot render rc=0, eips rc=0 with durations). User verification 24.09: **visible ✅, orientation ✅ (t180 reference), size ❌**; flicker not yet reported. **24.09 pm (card-log diagnosis):** `diag.log` holds exactly **6 `eips rc=` lines, all 24.09** (14:18:23 / 14:19:50 / 14:20:14 / 18:11:26 / 18:13:12 / 18:13:35), **zero overnight** (old pre-T14 script + 6.29 MB mmap dash → invisible writes). The frame the user now sees is the eips **zoom-crop (docs/03 row 2) of the stale 06:43 RGB/25-IDAT cache** (user: „bild nur teilweise zu sehen“, „kleiner Ausschnitt … untere linke Ecke“; the round-1 „edge-to-edge, too big“ was the older full-size v2/v3-era grayscale frame still on screen pre-reboot) → the T17-boot render's faithful-vs-zoom-crop question is **[resolved: zoom-crop]**. **No grayscale single-IDAT image has ever been eips-rendered on the device** (first one = post-T20-deploy, at the first re-download). The refresh loop **freezes in device deep sleep** (ticks advance only while awake; resumes on wake). **Repo since 24.09 pm (T20 in progress):** `artifacts/binaries/dash` = T20 build (5,177,496 B, SHA `58f751e4…`, DASH_SCALE letterbox) + `artifacts/refresh.sh` = **v5** (3,702 B, SHA `9cb8dcfc…`; render **only on image change** — cksum compare, forced 30 s re-render removed; `export DASH_SCALE=0.8` + restage + keep-awake NOTE) — **deploy to the card pending the user's explicit OK** (on card still `refresh.sh` `d8d84e99…` / 2,599 B + T16 dash `ce74c7b4…`); v5's size change → script hot re-stage fires, same-size dash swap → blind, **reboot is the effective deploy trigger**.
- The final architecture is **implemented (T12–T16) and on the card** (deployed 24.09 13:29Z, T17): `dash` = fetch + decode + grayscale + **`saveKindlePNG`** (single IDAT); display = **`eips -g`** (`display()` exec, rc + duration → `/mnt/us/diag.log`). T17 stays **in progress** until final acceptance (size → T20, flicker); **T20 in progress** (code + rebuild done 17:42Z, deploy + user verification pending); T18/T19 (n8n grayscale) are blocked on the user's n8n API key (401). See `ISSUES.md` I10 + `todos.json` (next ticket = T20).
- The project's Notion pages partly describe older states (v2/v3); this repo is newer. In case of conflict: **this repo wins**.
- The **Go source** (`go.mod`, `main.go`, `render.go`, `convert.go`, `fb_linux.go`, `fb_stub.go`, `convert_test.go`, `main_test.go`, flat layout, no `cmd/dash/`) **is in the repo**: `src/kindle-dash/` (repo-relative; added T11, byte-verified vs Notion Artifacts). Its machine-specific origin location is deliberately **not recorded** in this repo (path rule below). The binary in `artifacts/binaries/dash` is the **T20 build** (Go 1.23.12, 5,177,496 B, SHA-256 `58f751e4…`, **not yet on the card** — on card = T16 build `ce74c7b4…`, deployed 24.09 13:29Z; same size → size-based hot re-stage blind, reboot is the effective deploy trigger); the old mmap build is kept in the repo as `artifacts/dash`. The source must **not be invented**.

## Hard technical rules (from `docs/03`)

- eips output PNG: **exactly 1 IDAT chunk**, **IHDR color type 0** (8-bit grayscale), 1072×1448 (or 1448×1072), bit depth 8, interlace 0. **Caveat 24.09:** the on-card `dashboard.png` was measured as RGB colortype 2 / 25 IDAT (doc error, corrected) and was eips-rendered at the T17 boot — the rule therefore stays the **verified-safe output spec / reliability heuristic**, not a verified complete description of eips's parser (see `docs/03` correction note).
- eips `-b` (BMP) is a **NO-OP** on this device. BMP paths: forgotten.
- Visible E-Ink updates **only** via `eips` (EPDC wave). mmap write alone = invisible.
- Console geometry: `rotate=3` (270°), correct display = **t180** (transpose + 180° = 90° CW + horizontal flip).
- **Go toolchain cap: Go 1.23.** Go 1.24+ requires Linux ≥ 3.2; the Voyage runs kernel 3.0.35. Build: `CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s"`.

## Prohibitions

- **No free terminal on the device.** All interaction is via MRPI (`;log`, `;get`) and files on `/mnt/us/`. Do not plan on an interactive shell.
- **No secrets in the repo** (API keys, credential IDs, webhook UUIDs, hostnames beyond the documented endpoint). n8n JSONs stay with placeholders; for any new dump: sanitize first (procedure: `docs/04` §Sanitizing).
- **No user-specific/personal information in the repo:** no personal names, e-mail addresses, personal hostnames, home-directory paths, account/user IDs. n8n dumps are scrubbed accordingly (procedure: `docs/04` §Sanitizing). LAN IPs are infrastructure and allowed. Documented exceptions (kept as-is by user decision): `artifacts/notes/notizen.md` (user's own session notes) and functional device scripts (e.g. `artifacts/refresh.sh` needs its live endpoint to keep working).
- **Path rule (24.09, user request):** the user works across machines, so **all path references in this repo must be relative** — repo-relative (`src/kindle-dash/`, `artifacts/...`) or at most `~`-relative to the current user. **No user- or machine-specific absolute paths** (no `/Users/<name>/…`, no `/home/<name>/…`). Exempt: device-internal paths (`/mnt/us/`, `/tmp`, `/usr/sbin/eips`) and standard mounts (macOS `/Volumes/Kindle`).
- **No new large binaries committed:** Kindle update bins (~200 MB each), >3 MB BMP/PNM diagnostic derivatives, test BMPs (4.6 MB). List + reasons: `docs/05-artifact-manifest.md`.
- **Do not break the card:** `/Volumes/Kindle` is the user's live card. Only point writes for deploys (replace a file), never bulk delete/format — and announce every such action to the user beforehand.
- **No git on the device.** Device files are managed via the USB card only; this repo is documentation, not a deploy mechanism.
- **Do not invent results:** display checks can only be done by the user. Mark everything unverified as `open/assumed` (Notion discipline: `[verified]` / `[recalled]` / `[assumption]` / `[open]`).

## Definition of Done — milestone ticket (todos T12–T17; items 1–5 done — T12/T13/T14 + T16 build + T17 deploy 24.09 13:29Z; items 6–7 in progress; T20 open)

1. `saveKindlePNG`: one `compress/zlib` stream over all filter-0 rows → exactly 1 IDAT; IHDR color type 0; CRCs correct (reference implementation: Python recipe in `docs/03`). ✅ T12
2. `dash get <out> <urls...>`: fetch + Go decode + Floyd-Steinberg grayscale → `saveKindlePNG` → `/mnt/us/dashboard.png`. ✅ T13 (T14: get is write-only, no display)
3. `dash render <file>`: `exec /usr/sbin/eips -g <file> -x 0 -y 0`. ✅ T14 (rc + duration → `/mnt/us/diag.log`)
4. Static ARM build (`CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`, Go ≤ 1.23), watch size (current: 5.18 MB). ✅ T16 (Go 1.23.12, 5,177,496 B, `artifacts/binaries/dash` — the T20 rebuild, same size, is now the repo binary)
5. Deploy to `/mnt/us/dash` (size change triggers hot re-stage in `refresh.sh` v4) + reboot. ✅ T17 (deploy executed 24.09 13:29Z, point-write, repo == card SHA-verified; effective trigger = user reboot ~14:19Z)
6. **User verification:** dashboard visible? orientation (t180 reference)? flicker acceptable? ⏳ in progress (user 24.09: visible ✅, orientation ✅, size ❌ → **T20**; flicker not yet reported)
7. Log analysis `refresh.log`: `dl ok` + `render rc=0`. ⏳ partial (boot render `render rc=0` 14:19:50Z + eips rc=0 @14:20:14Z; first `dl ok` unobserved — card log gap after ~14:20Z, device likely sleeping [open])

Only after that: open items from `ISSUES.md` (n8n grayscale optional, home-screen persistence of `refresh.sh`, download interval / flicker trade-off).