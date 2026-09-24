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

- **On the card since 24.09 abend:** `dash` = T20 build (5,177,496 B, SHA `58f751e4…`, static Go 1.23.12, render = `exec /usr/sbin/eips -g`, unchanged since ~20:20Z) + `refresh.sh` = **v6** (3,714 B, SHA `2ebe400c…`; Point-Write deployed 24.09 abend, SHA Repo == Karte verifiziert, Modus rwx------ unverändert; only diff vs v5 (3,702 B, `9cb8dcfc…`): `export DASH_SCALE=0.8` → `0.95` + v5→v6 markers). **User verification round 2 (24.09 abend) → T20 = DONE:** after the first re-download (20:42:53Z: `dl ok` + image changed + render rc=0, eips 181 ms) the whole new image was visible with a black frame (user: „richtig gut!“), orientation ✅ (round 1) → **first grayscale single-IDAT eips render works end-to-end** (on-card PNG measured: 1072×1448, 8-bit, colortype 0, **1 IDAT**, 463,228 B, SHA `6cdc49d9…` = the safe output spec is confirmed on device). Logs: v5 start 20:37:37Z, boot render rc=0, 20:42:53Z dl ok + render rc=0 (refresh.log 254 lines, SHA `eee7bf4b…`; diag.log 320 lines, SHA `134c35f5…`; all eips rc=0). The device then went to deep sleep → **screensaver appeared (user: must never happen)** → „Wach bleiben“ / Stay Awake user setting (EN path in the refresh.sh header NOTE; exact German label [assumed]). The loop freezes in deep sleep; the script restage check runs at script start → **reboot is the sure trigger for the v6 restage** (plain wake may resume the frozen v5 loop without restaging).
- **T21 (new 24.09 abend): maximize image, minimize border** (user: „das bild soll so groß wie möglich … und so wenig schwarzer rand wie möglich“). Measured: the n8n canvas = **1072×1448 = exactly panel size** → eips maps 1:1 (no second letterbox/crop) → the visible border is **purely dash's DASH_SCALE letterbox** (s=0.8 → ≈36 % black = „viel zu groß“; s=1.0 → edge-to-edge = the round-1 „zu groß“ state). → **s=0.95** (≈10 % black; thinnest still-visible margin ≈27 px sides / ≈36 px top-bottom; image ~19 % bigger than at 0.8; 0.9 or 1.0 = trivial one-line script-only follow-up, no rebuild). **Awaiting user round 3:** reboot + „Wach bleiben“ ON + ~10 min awake → verify (big enough? thin margin ok? flicker? screensaver gone?) → then close T21 (+ T17 if flicker acceptable).
- **T17 stays in progress** (flicker not yet reported — asked again in round 3). T18/T19 (n8n grayscale) blocked on the user's n8n API key (401). See `ISSUES.md` I10/I11 + `todos.json` (next ticket = T21).
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
6. **User verification:** dashboard visible? orientation (t180 reference)? flicker acceptable? ⏳ partial (24.09: visible ✅, orientation ✅, size ❌ → T20; **24.09 abend round 2: visible ✅, whole image ✅, orientation ✅** — border at s=0.8 „viel zu groß“ → T21; **flicker not yet reported** — T17 stays open)
7. Log analysis `refresh.log`: `dl ok` + `render rc=0`. ✅ 24.09 abend: boot render rc=0 (20:37:37Z) + **20:42:53Z `dl ok` + image changed + render rc=0** (diag.log: all eips rc=0, last 181 ms; refresh.log 254 lines / diag.log 320 lines)

Only after that: open items from `ISSUES.md` (n8n grayscale optional, home-screen persistence of `refresh.sh`, download interval / flicker trade-off).