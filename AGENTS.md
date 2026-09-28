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

## Actual state (28.09 07:00Z — v8 PoC on card since 27.09 22:35Z (SHA-verified, card == repo); running loop still v6 in memory — **no reboot yet** (pid 5699 start 15:18:00Z); overnight v6 fully healthy (81 dl ok + 27 renders rc=0, zero failures, silent since 06:34:16Z = asleep); T25 phase 1 done — awaits user reboot + ~ds + PoC data → v9 go/no-go)

- **Card (28.09 07:00Z check: v8 on card, card == repo, NO reboot yet):** `refresh.sh` = **v8** (10,333 B, SHA `1331167f…`, **deployed 27.09 22:35Z** user-authorized point-write, mode rwx------; = v7 (T22+T24) + T25 fb-Snapshot-Diff **LOG-ONLY PoC**: fb-Snapshot nach jedem Render (/tmp) + 10-s-Tick `cmp -s`, MATCH/CHANGED geloggt, SD-Archiv `kf_fb/` (KEEP=8) nur auf Transitions, kein Re-Render) = T22 (extern-only URLs — Mac voll aus dem Prozess) + T24 fix (boot-window re-renders @+20/60/150/300 s wall-clock, `BURST_DONE` dedupe; wake double-render on >120 s clock gap + 20 s + render 2; „clock check“-Line; graceful degrade if `date +%s` missing). **Achtung: der laufende Loop (pid 5699, start 15:18:00Z) läuft weiter v6 aus dem Speicher — kein Self-Hot-Reload; v8 lädt erst beim nächsten Reboot (1 Reboot = Round 6 + PoC-Start). 28.09 07:00Z: immernoch kein Reboot, kein `kf_fb/`, keine v7/v8-Loglinien → PoC noch nicht gestartet (erwartet).** `dash` = fbdump build (5,243,032 B, `b0736ae4…`, deployed 27.09 22:35Z; vorher T20: 5,177,496 B, `58f751e4…`); `.boot` = `fd4501a8…` unchanged. Logs synced 28.09 07:00Z: refresh.log **458 ln**, diag.log **358 ln** (all eips rc=0, last 186.3 ms); last event **06:34:16Z `dl ok` + image changed + render rc=0** → **silent since = device asleep** (deep-sleep freeze, resume-on-wake verified 24.09). On-card `dashboard.png` = **554,367 B (SHA `e10424df…`, frame 06:34:16Z, PNG-Spec 1072×1448/bd8/ct0/1-IDAT verifiziert)** — initial stale Read (614,672 B `9b38c5c9…`) = macOS FAT32 dir cache, per diskutil-Remount gelöst (Karte war ok). Session since 15:18:00Z: ~108 ticks, 105 dl ok + 3 dl rc=1 (alle LAN-Timeouts, self-recovered); 40 „image changed“-Renders seit 23.09 (27 overnight), all rc=0, eips 181–193 ms; 22:46:33Z v6 re-staged das neue Binary (Size-Change 5,243,032) — Prozess bleibt v6; 1 leere „staged dash size“-Zeile @01:03:57Z = one-off stat-Glitch (harmlos) → Change-Rate = n8n-Content, nicht Polling. Externes Endpoint gesund.
- **User round 5 (27.09):** (a) Reversion-Präzisierung: das Boot-Render-Bild „verschwindet“ → Home-Screen sichtbar; **NUR direkt nach Reboot** (steady state OK — Bild hält); Bild muss bis zum nächsten Bild geladen bleiben. (b) `~ds`: User gibt es manuell nach Reboots neu ein („wenn es produktionsfertig ist“) → **T23 resolved = manuelle Re-Eingabe (done)** (Automatisierung via Suchleiste unmöglich: kein Terminal/API). (c) ~5-min-Intervall akzeptiert („für den Moment ok so“). → **T24 (v7 deployed 16:58Z) + T22 schließen nach user Reboot + round 6.**
- **T25 NEW (27.09 abend, user request):** versehentlicher Button-Druck („Klick“ — Voyage hat **kein Touchscreen**) → Kindle-UI malt den Home-Screen über das Bild; das Bild ist lange weg (Loop rendert nur bei Content-Change); User wünscht: letztes Bild nach ~1 min automatisch wieder anzeigen. **Design (I14): fb-Snapshot-Diff** — neue Go-Command `dash fbdump <out>` (raw `/dev/fb0`-Read, best-effort, Fehler killt Loop nie); Script: fb-Snapshot nach jedem eigenen Render (**/tmp only** = tmpfs, keine FAT32-Wear) + periodisch Re-Dump + Byte-Vergleich (busybox `cmp -s`) → on change Re-Render (rate-limited). Immune gegen Transform-/Palette-/16px-Drift (fb-to-fb). **v8 = LOG-ONLY PoC** (0 Flicker-Risiko), gebündelt mit ausstehendem v7-Reboot (1 Reboot = round 6 + PoC-Daten); **v9 = action** (Restore, ≥60 s + ≤3/h, 10 s-Tick → Latenz ≤~10–20 s). Option A (blindes periodisches Re-Render) ABGELEHNT (sichtbarer EPDC-Flash verletzt „Bild halten“). PoC v8 **gebaut + deployed 27.09 22:35Z** (Sandbox grün: MATCH/CHANGED + Transition-Archiv wie design; Nuancen: sandbox dl rc=1, no-cache-Edge @20s rc=1) — wartet auf **User-Reboot + PoC-Daten** (→ v9 go/no-go). (T25 in progress, depends T24).
- **T21 = DONE (user-verified 25.09, round 3):** s=0.95 „perfekt“ (final size state; fallbacks 0.9/1.0 not needed).
- **T17 stays in progress** (flicker/reversion: round 4 NOT acceptable; round 5: nur nach Reboot; Fix = v7 **on card since 16:58Z**) → closure needs **Reboot + round 6** (T24 done + T22 done → T17 schließt). **T18/T19** (n8n grayscale) blocked on the user's n8n API key (401).
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

## Definition of Done — milestone ticket (todos T12–T17; items 1–5 done — T12/T13/T14 + T16 build + T17 deploy 24.09 13:29Z; item 6 partial — flicker/reversion open (Round 5: nur nach Reboot; Fix v7 **on card since 16:58Z**, wartet auf Reboot + Round 6); item 7 done 24.09 abend; T20 done (user-verified 24.09 abend); T21 done (user-verified 25.09: s=0.95 „perfekt“); T24 in progress (v7 on card 16:58Z — schließt nach Reboot + Round 6, dann T17); T25 in progress (v8 PoC on card 27.09 22:35Z — wartet Reboot + PoC-Daten → v9)

1. `saveKindlePNG`: one `compress/zlib` stream over all filter-0 rows → exactly 1 IDAT; IHDR color type 0; CRCs correct (reference implementation: Python recipe in `docs/03`). ✅ T12
2. `dash get <out> <urls...>`: fetch + Go decode + Floyd-Steinberg grayscale → `saveKindlePNG` → `/mnt/us/dashboard.png`. ✅ T13 (T14: get is write-only, no display)
3. `dash render <file>`: `exec /usr/sbin/eips -g <file> -x 0 -y 0`. ✅ T14 (rc + duration → `/mnt/us/diag.log`)
4. Static ARM build (`CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`, Go ≤ 1.23), watch size (current: 5.18 MB). ✅ T16 (Go 1.23.12, 5,177,496 B, `artifacts/binaries/dash` — the T20 rebuild, same size, is now the repo binary)
5. Deploy to `/mnt/us/dash` (size change triggers hot re-stage in `refresh.sh` v4) + reboot. ✅ T17 (deploy executed 24.09 13:29Z, point-write, repo == card SHA-verified; effective trigger = user reboot ~14:19Z)
6. **User verification:** dashboard visible? orientation (t180 reference)? flicker acceptable? ⏳ partial (rounds 1–3: visible ✅, orientation ✅, size: s=0.8 ❌ → T20 → s=0.95 ✅ „perfekt“ (25.09, T21 done); flicker question answered round 4 (reversion bug) + round 5 (nur nach Reboot) → T24 fix v7 **on card since 16:58Z** — T17 stays open until reboot + round 6)
7. Log analysis `refresh.log`: `dl ok` + `render rc=0`. ✅ 25.09: v6 boot render rc=0 (21:55:14Z) + **22:00:29Z `dl ok` + image changed + render rc=0** (diag.log: all eips rc=0, last 181.7 ms; refresh.log 264 lines / diag.log 322 lines — SHA-verified copies in `artifacts/logs/`); silent since 22:11:12Z = deep-sleep freeze

Open items: **T24 in progress** (Fix v7 **on card since 16:58Z** — wartet auf **user Reboot + `~ds` → Round 6**) + **T22 in progress** (Round 5: Entscheidung = ENTFERNEN, in v7 umgesetzt; schließt mit T24) + **T25 in progress** (Tap-Auto-Restore: v8 log-only PoC **on card 27.09 22:35Z** — wartet auf Reboot + PoC-Daten → v9 go/no-go) + **T17** (closes after T24 + Round 6) + `ISSUES.md` (n8n grayscale optional — T18/T19 blocked on API key 401). **T23 done (27.09 Round 5: manuelle `~ds`-Re-Eingabe nach Reboots).** Download interval: **closed for now (27.09, user: ~5 min „für den Moment ok so“).**