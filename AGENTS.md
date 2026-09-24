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

- **On the card since 25.09 (final state, user: „perfekt“):** `dash` = T20 build (5,177,496 B, SHA `58f751e4…`, static Go 1.23.12, render = `exec /usr/sbin/eips -g`, unchanged since ~20:20Z 24.09) + `refresh.sh` = **v6** (3,913 B, SHA `514a37ac…`; v6 deployed 24.09 abend, NOTE updated 25.09 — comments only, behavior unchanged; SHA Repo == Karte re-verified 25.09, Modus rwx------ unverändert; v6 vs v5 (3,702 B, `9cb8dcfc…`): `export DASH_SCALE=0.8` → `0.95` + v5→v6 markers; the NOTE now documents the user-verified `~ds` keep-awake instead of the assumed „Wach bleiben“ menu path). **Timeline 25.09:** user reboot 21:55:14Z → v6 start (pid 5700) + boot render (eips 1.63 s); **22:00:29Z first s=0.95 render** (dl ok + image changed + render rc=0, eips 181.7 ms; on-card PNG 1072×1448 / 8-bit / ct 0 / **1 IDAT** / 463,592 B, SHA `ce561a6c…`, re-verified 25.09); 22:05:51Z + 22:11:12Z dl ok, no change → no render; **silent since 22:11:12Z** (22:33Z check) = device asleep → loop frozen in deep sleep (resume-on-wake verified 24.09). **User round 3 (25.09): „das Bild ist jetzt perfekt von der Größe“ → T21 = DONE** (s=0.95 final; fallbacks 0.9/1.0 not needed). **Keep-awake (user, 25.09):** type `~ds` in the search bar + Enter → the screensaver never activates; **a reboot cancels `~ds`** (user re-enters it after reboots — „das übernehme ich“ — agent documents only); side effect: the short-press screen lock stops working. Sources: the-ebook-reader.com (2017-12-31), martin-prochnow.de, tipps-tricks-kniffe.de. Logs: refresh.log 264 lines (SHA `daa8cf1f…`), diag.log 322 lines (SHA `119a6b99…`), all eips rc=0.
- **T21 = DONE (user-verified 25.09, round 3):** maximize image, minimize border (user: „das bild soll so groß wie möglich … und so wenig schwarzer rand wie möglich“) → **s=0.95** (≈10 % black; thinnest visible margin ≈27 px sides / ≈36 px top-bottom; image ~19 % bigger than at 0.8) → user 25.09: „das Bild ist jetzt perfekt von der Größe“ (whole image, one eips render 22:00:29Z, 181.7 ms). Basis: n8n canvas = 1072×1448 = exactly panel size → eips maps 1:1 → visible border = 100 % dash DASH_SCALE. On-card PNG re-verified 25.09: 463,592 B, SHA `ce561a6c…`, ct 0, 1 IDAT. Fallbacks 0.9/1.0 not needed.
- **T17 stays in progress** (flicker not yet reported — rounds 1–3; final question pending with the user). T18/T19 (n8n grayscale) blocked on the user's n8n API key (401). See `ISSUES.md` I10/I11 + `todos.json` (next ticket = T17).
- The project's Notion pages partly describe older states (v2/v3); this repo is newer. In case of conflict: **this repo wins**.
- The **Go source** (`go.mod`, `main.go`, `render.go`, `convert.go`, `fb_linux.go`, `fb_stub.go`, `convert_test.go`, `main_test.go`, flat layout, no `cmd/dash/`) **is in the repo**: `src/kindle-dash/` (repo-relative; added T11, byte-verified vs Notion Artifacts). Its machine-specific origin location is deliberately **not recorded** in this repo (path rule below). The binary in `artifacts/binaries/dash` is the **T20 build** (Go 1.23.12, 5,177,496 B, SHA-256 `58f751e4…`), **on the card since 24.09 ~20:20Z, unchanged since**. The source must **not be invented**.

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

## Definition of Done — milestone ticket (todos T12–T17; items 1–5 done — T12/T13/T14 + T16 build + T17 deploy 24.09 13:29Z; item 6 partial — flicker open; item 7 done 24.09 abend; T20 done (user-verified 24.09 abend); T21 in progress — v6 deployed, awaiting round 3)

1. `saveKindlePNG`: one `compress/zlib` stream over all filter-0 rows → exactly 1 IDAT; IHDR color type 0; CRCs correct (reference implementation: Python recipe in `docs/03`). ✅ T12
2. `dash get <out> <urls...>`: fetch + Go decode + Floyd-Steinberg grayscale → `saveKindlePNG` → `/mnt/us/dashboard.png`. ✅ T13 (T14: get is write-only, no display)
3. `dash render <file>`: `exec /usr/sbin/eips -g <file> -x 0 -y 0`. ✅ T14 (rc + duration → `/mnt/us/diag.log`)
4. Static ARM build (`CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`, Go ≤ 1.23), watch size (current: 5.18 MB). ✅ T16 (Go 1.23.12, 5,177,496 B, `artifacts/binaries/dash` — the T20 rebuild, same size, is now the repo binary)
5. Deploy to `/mnt/us/dash` (size change triggers hot re-stage in `refresh.sh` v4) + reboot. ✅ T17 (deploy executed 24.09 13:29Z, point-write, repo == card SHA-verified; effective trigger = user reboot ~14:19Z)
6. **User verification:** dashboard visible? orientation (t180 reference)? flicker acceptable? ⏳ partial (rounds 1–3: visible ✅, orientation ✅, size: s=0.8 ❌ → T20 → s=0.95 ✅ „perfekt“ (25.09, T21 done); **flicker still not reported** — T17 stays open)
7. Log analysis `refresh.log`: `dl ok` + `render rc=0`. ✅ 25.09: v6 boot render rc=0 (21:55:14Z) + **22:00:29Z `dl ok` + image changed + render rc=0** (diag.log: all eips rc=0, last 181.7 ms; refresh.log 264 lines / diag.log 322 lines — SHA-verified copies in `artifacts/logs/`); silent since 22:11:12Z = deep-sleep freeze

Open items: **T17 flicker** (one user question) + `ISSUES.md` (n8n grayscale optional — T18/T19 blocked on API key 401, home-screen persistence of `refresh.sh`, download interval / flicker trade-off).