# KindleFrame

A 24/7 E-Ink dashboard on a jailbroken **Kindle Voyage (KV)** — driven by **n8n**.

**Goal:** The Kindle acts as a wall "frame" that permanently shows the newest rabbit-recognition frame image from n8n and keeps it up to date — in the end state completely without a Mac (no proxy, no Samba, no SSH tunnel).

This repository replaces the project's Notion page as the canonical documentation. A fresh AI should be able to read this repo and continue the work without any other context.

## Current state (28.09 14:18Z — **Reboot 07:57:06Z → v8 läuft (pid 5927); PoC vollständig (alle Exit-Kriterien erfüllt)**: 4 Boot-Fenster-Renders rc=0+MATCH, steady MATCH 08:02:17–55, Tap 08:03:06 → Browse bis 08:13:30 → asleep, fbdump 101× ~24,5 ms, 3 dl ok, zero failures; **User 28.09: 30-s-Verhalten „passt noch nicht“ = erwartet (Karte = v8 log-only)**; **v9 BUILT + FINAL (artifacts/refresh_v9.sh; 30-s-Restore, Sandbox 29/29) — awaits user-authorized point-write + reboot + 30-s test + Round 6**; logs + frame auf Mac gesynct; T21 done; T18/T19 blocked on n8n API key

| Component | Status |
|---|---|
| WatchThis jailbreak (Legacy, 21.09.2026) | ✅ `docs/02-jailbreak.md` |
| n8n webhook → PNG 1072×1448 | ✅ `docs/04-n8n-integration.md` |
| On-device daemon `refresh.sh` (**card: v8 since 27.09 22:35Z** — running loop = **v8 since 28.09 07:57Z Reboot** (PoC läuft; Auto-Restore kommt mit v9, wartet auf Deploy); v8 = v7 (extern-only URLs T22, boot-window re-renders @+20/60/150/300 s, wake double-render, clock check) + T25 fb-snapshot-Diff **LOG-ONLY PoC** (snapshot after every render + 10-s tick cmp, MATCH/CHANGED logged, no re-render); 10 s tick, 300 s download, render only on image change, DASH_SCALE=0.95) | ✅ `artifacts/` |
| `dash` (static Go binary, Go 1.23.12, DASH_SCALE letterbox seit T20): fetch + decode + grayscale + `eips -g` render + `fbdump` (T25) | ✅ auf Karte: **fbdump-Build (5,243,032 B, `b0736ae4…`) seit 27.09 22:35Z**; vorher T20-Build (5,177,496 B, `58f751e4…`) seit 24.09 ~20:20Z |
| **Visible rendering** | ✅ **via `eips -g`** (user rounds 1–3: visible + orientation OK, s=0.95 „perfekt“ 25.09; pre-T16 the mmap writes were invisible — "nothing happens") |
| Final architecture: `dash` writes single-IDAT grayscale PNG + `eips -g` displays it | ✅ **implemented (T12–T16) + deployed; T20 done (round 2, 24.09 abend); T21 done (round 3, 25.09: s=0.95 „perfekt“); T17 in progress (round 4: reversion bug → T24; round 5: precision — only right after reboot)** |
| Image size on display | ✅ **T21 done (25.09):** s=0.95 (≈10 % black, thinnest visible margin) — user round 3: „das Bild ist jetzt perfekt von der Größe“; fallbacks 0.9/1.0 not needed |
| Flicker / reversion | ⏳ **round 4: NOT acceptable** — image must persist until the next image is loaded → **T24**. **Round 5 (27.09): PRECISION** — only right after reboot (home screen overpaints the boot render; steady state OK). Fix in v7; **v7 + v8 ON CARD since 27.09 22:35Z** — awaiting user reboot (still pending 28.09 07:00Z) + round 6 (then T17 closes) |
| Loop / network | ✅ **ALIVE 28.09** (reboots 13:37:56Z + 15:18:00Z → boot renders rc=0; running loop still **v6 in memory** — no reboot yet; dl every ~5 min; today's frames: … `9b38c5c9…` 19:09:50Z → **`e10424df…` 554,367 B 06:34:16Z** (last change; overnight 27 renders, all rc=0); silent/asleep since **06:34:16Z** (deep-sleep freeze, resumes on wake); two WiFi-down wakes on record (24.09 23:43:32Z, 27.09 13:36:28Z — pattern: WiFi not up yet at wake); LAN fallback URL: **removed in v7** (round 5: „der Mac soll mit dem Prozess gar nichts zu tun haben“, T22) |

**→ Next step (28.09 07:00Z, unchanged since 27.09):** v7 **deployed 16:58Z** + v8 PoC **deployed 22:35Z** ✅ (point-writes, SHA-verified, card == repo). **Gate A (user — still pending):** reboot (loads v7+v8) + `~ds` re-entry (manual per T23) → **round 6**: watch the boot image ~5 min (window @+23/+63/+153/+303 s — must hold afterwards), sleep + wake → image must persist, ~5-min downloads `dl ok`, „clock check“ line verifies `date +%s` → OK ⇒ **T24 done (+ T22 done) → T17 closes** (milestone T12–T17). NG ⇒ tune burst times / WAKE_GAP (edit + re-deploy + reboot, no Go rebuild) → round 7. **Gate B (agent) DONE:** v8 built (new `dash fbdump`) + log-only PoC logic, sandbox pre-test green, deployed 22:35Z. **Remaining after reboot:** PoC data pull (refresh.log MATCH/CHANGED + `kf_fb/` offline — raw dumps never committed) → **v9 go/no-go** (rate-limited auto-restore, ≥60 s + ≤3/h, latency ≤~10–20 s — needs **new user auth** + reboot #2). Then optional: n8n grayscale (T18) blocked on T19 (API key 401). **T23 resolved (round 5):** automation impossible — user re-enters `~ds` manually after reboots („wenn es produktionsfertig ist“). Exact resume in `todos.json`. Rules for continuing AIs: **`AGENTS.md`**.

## Repo structure

```
README.md               ← you are here
AGENTS.md               ← rules for (AI) continuation – READ FIRST
todos.json              ← GROUND TRUTH: todos with status; `resume` = continuation point
ISSUES.md               ← full chronology: what was tried, what held
docs/
  01-hardware.md        ← device, framebuffer, filesystem, interaction model
  02-jailbreak.md       ← WatchThis, hotfix bin, MRPI, verification
  03-eink-rendering.md  ← THE critical eips constraints + final architecture
  04-n8n-integration.md ← workflow, code nodes, sanitizing note
  05-artifact-manifest.md← what is in here, what was excluded and why
artifacts/
  refresh.sh + .bak-v1/.bak-v3, RUNME.sh, emergency.sh, .boot, dash,
  dashboard.png (on-card cache = last render; 28.09: 06:34:16Z frame, 554,367 B, `e10424df…`; macOS FAT32 dir caching caveat: card file may appear stale until remount — observed 27.09 + 28.09, card was fine), dashboard-real.png.bak (broken test)
  binaries/  images/ (all eips/orientation/webhook test images)  logs/
  jailbreak/ (watchthis-release, kindle-fertig, kual-mrpi, zips, hotfix bin)
  notes/ (user's original session notes, German, kept verbatim)
n8n/
  rabbit-recognition-workflow.json  ← canonical, sanitized (latest dump 23.09 09:03Z)
  code/    (t180-n8n.js + versions + test scripts, unmodified)
  history/ (API dumps before/after changes, sanitized)
```

## Key invariants (TL;DR)

1. **`eips -g`** (the Kindle's system PNG decoder) reads **only the FIRST IDAT chunk** and expects **8-bit grayscale (IHDR color type `00`)**. Multi-IDAT → zoomed crop; RGB/RGBA → broken. (`docs/03`) *Caveat 24.09:* one 25-IDAT RGB file was reported rendered full-screen — counterexample to "only the first chunk"; the spec stays the **verified-safe output path** (see the correction in `docs/03`).
2. **E-Ink is bistable.** A raw framebuffer write (mmap) updates memory only and **does NOT trigger the visible EPDC wave**. `eips` is the only proven visible path. (`docs/03`)
3. Go `image/png` splits IDAT into ~32 KB blocks → **48 IDAT chunks** → unusable for eips output → custom encoder `saveKindlePNG` is required. (`docs/03`)
4. **Geometry:** framebuffer 1072×1448, `rotate=3`. The correct console rotation is **t180 = transpose + 180° = 90° CW + horizontal flip**. n8n `rotate 90°` = t180 + horizontal mirror (≈ok, not exact). (`docs/03`)
5. **No secrets in the repo.** n8n JSONs are sanitized (placeholders). (`docs/04`)

## How to continue (short version)

1. Read `AGENTS.md` (mandatory), then `todos.json` → `resume` (the exact continuation point; one todo at a time, `todos.json` updated in every commit).
2. The Go source **is in the repo**: `src/kindle-dash/` (repo-relative; added T11, byte-verified vs Notion Artifacts; no user-specific absolute paths — AGENTS.md path rule). I10 plan steps 1–7: **all implemented** (T12 `saveKindlePNG` → T13 `dash get` writes single-IDAT grayscale PNG → T14 `dash render` = `exec eips -g` → T15/T16 build → T17 deployed 24.09 13:29Z → **T20 done 24.09 abend (round 2: „richtig gut“)** → **T21 done 25.09 (round 3: s=0.95 „perfekt“** — final state: image as big as possible, border as thin as possible, no screensaver via user-side `~ds`). Open: **T17 flicker** (user rounds 1–3: not reported → final question) + **T18/T19** (n8n grayscale, blocked on API key 401).
3. Verification ALWAYS goes through the user (the display is not visible to us): visibility, orientation (t180 reference), flicker.