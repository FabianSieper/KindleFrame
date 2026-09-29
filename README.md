# KindleFrame

A 24/7 E-Ink dashboard on a jailbroken **Kindle Voyage (KV)** — driven by **n8n**.

**Goal:** The Kindle acts as a wall "frame" that permanently shows the newest rabbit-recognition frame image from n8n and keeps it up to date — in the end state completely without a Mac (no proxy, no Samba, no SSH tunnel).

This repository replaces the project's Notion page as the canonical documentation. A fresh AI should be able to read this repo and continue the work without any other context.

## Current state (29.09 19:48Z — **V9 deployed + getestet (S1 12:50:11Z, S2 14:55:32Z)**: 12 restores rc=0, 10 BLOCKED (7 cooldown + 3 rate), 8 boot-window re-renders, dl ok 15/0 failures, eips 88x rc=0, fb MATCH 26/CHANGED 464; Overpaint-Befund: kleines UI-Element Delta 2,517 B (0.081 %), redrawn ~53-64 s, persistiert ueber Sleep/Wake + neues n8n-Bild [assumption: Kindle UI clock/status-bar]; Budget-Burn: ~60 s-Overpainting verbrennt 3/h in ~10 min; device asleep seit 16:18:09Z; Fallback: AUTO_RESTORE=0; **T25 closure wartet auf User-Fragen a-f**; T18/T19 blocked on n8n API key)

| Component | Status |
|---|---|
| WatchThis jailbreak (Legacy, 21.09.2026) | ✅ `docs/02-jailbreak.md` |
| n8n webhook → PNG 1072×1448 | ✅ `docs/04-n8n-integration.md` |
| On-device daemon `refresh.sh` (**card: v9 since 29.09 11:58:08Z** — user-authorized point-write, .bak = v8 1331167f…; v9 = v8 + T25 Auto-Restore ACTION (Restore-Gate: panel ≠ Baseline + stabil ≥30 s + Cooldown 60 s + ≤3/h; Baseline nur bei rc=0; `AUTO_RESTORE` kill-switch; 10 s tick, 300 s download, render only on image change, DASH_SCALE=0.95)) | ✅ `artifacts/` |
| `dash` (static Go binary, Go 1.23.12, DASH_SCALE letterbox seit T20): fetch + decode + grayscale + `eips -g` render + `fbdump` (T25) | ✅ auf Karte: **fbdump-Build (5,243,032 B, `b0736ae4…`) seit 27.09 22:35Z**; vorher T20-Build (5,177,496 B, `58f751e4…`) seit 24.09 ~20:20Z |
| **Visible rendering** | ✅ **via `eips -g`** (user rounds 1–3: visible + orientation OK, s=0.95 „perfekt“ 25.09; pre-T16 the mmap writes were invisible — "nothing happens") |
| Final architecture: `dash` writes single-IDAT grayscale PNG + `eips -g` displays it | ✅ **implemented (T12–T16) + deployed; T20 done (round 2, 24.09 abend); T21 done (round 3, 25.09: s=0.95 „perfekt“); T17 in progress (round 4: reversion bug → T24; round 5: precision — only right after reboot)** |
| Image size on display | ✅ **T21 done (25.09):** s=0.95 (≈10 % black, thinnest visible margin) — user round 3: „das Bild ist jetzt perfekt von der Größe“; fallbacks 0.9/1.0 not needed |
| Flicker / reversion | ⏳ **round 4: NOT acceptable** — image must persist until the next image is loaded → **T24**. **Round 5 (27.09): PRECISION** — only right after reboot (home screen overpaints the boot render; steady state OK). Fix in v7. **V9 ON CARD since 29.09 11:58:08Z** — tested S1+S2 (12 restores rc=0, 10 BLOCKED; overpaint = small UI element ~53-64 s cycle, not user buttons [assumption]). **Closure wartet auf user-Bestaetigung (Round 6)** |
| Loop / network | ✅ **ALIVE 29.09** (v9 deployed + getestet S1 12:50:11Z + S2 14:55:32Z; dl ok 15/0 failures; eips 88x rc=0; fb MATCH 26/CHANGED 464; last event 16:18:09Z asleep; LAN fallback URL: **removed in v7** (T22)) |

**→ Next step (29.09 19:48Z):** v9 **deployed + getestet** (S1+S2; 12 restores rc=0, 10 BLOCKED, 8 boot-window re-renders, dl ok 15/0, eips 88x rc=0). **T25 closure wartet auf User-Fragen a-f:** (a) 30-s-Test nach welchem Session? (b) Kleines UI-Element ueber Dashboard — wo, aendert sich jede Minute? (c) 3/h Budget-Burn akzeptabel oder Tune? (d) Round 6: Boot-Bild haelt, Sleep/Wake, Frame sichtbar, dl ok? (e) `~ds` nach zwei 29.09 Reboots neu eingegeben? (f) Panel clean oder uebermalt direkt nach 16:08Z Wake? **T24/T22/T17 closure** mit user-Bestaetigung Round 6. **T18/T19 blocked** on n8n API key. Fallback bei v9-Missverhalten: Redeploy mit AUTO_RESTORE=0 (= v8 log-only). Exact resume in `todos.json`. Rules for continuing AIs: **`AGENTS.md`**.

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
  dashboard.png (on-card cache = last render; 29.09: 16:13:20Z frame, 557,731 B, `01d8a8df…`; uebermalt mit UI-Element seit 16:14:04Z, rate-limited seit 16:14:36Z; device asleep seit 16:18:09Z), dashboard-real.png.bak (broken test)
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