# KindleFrame

A 24/7 E-Ink dashboard on a jailbroken **Kindle Voyage (KV)** — driven by **n8n**.

**Goal:** The Kindle acts as a wall "frame" that permanently shows the newest rabbit-recognition frame image from n8n and keeps it up to date — in the end state completely without a Mac (no proxy, no Samba, no SSH tunnel).

This repository replaces the project's Notion page as the canonical documentation. A fresh AI should be able to read this repo and continue the work without any other context.

## Current state (2026-09-25 — final state: s=0.95 „perfekt“, no screensaver via ~ds)

| Component | Status |
|---|---|
| WatchThis jailbreak (Legacy, 21.09.2026) | ✅ `docs/02-jailbreak.md` |
| n8n webhook → PNG 1072×1448 | ✅ `docs/04-n8n-integration.md` |
| On-device daemon `refresh.sh` (v6: 10 s tick, 300 s download, render only on image change, DASH_SCALE=0.95) | ✅ `artifacts/` |
| `dash` (static Go binary, Go 1.23.12, DASH_SCALE letterbox seit T20): fetch + decode + grayscale + `eips -g` render | ✅ auf Karte: T20-Build seit 24.09 ~20:20Z (T20-Deploy); T16-Build seit 24.09 13:29Z (T17-Deploy) |
| **Visible rendering** | ✅ **via `eips -g`** (user rounds 1–3: visible + orientation OK, s=0.95 „perfekt“ 25.09; pre-T16 the mmap writes were invisible — "nothing happens") |
| Final architecture: `dash` writes single-IDAT grayscale PNG + `eips -g` displays it | ✅ **implemented (T12–T16) + deployed; T20 done (round 2, 24.09 abend); T21 done (round 3, 25.09: s=0.95 „perfekt“); T17 in progress (flicker not yet reported)** |
| Image size on display | ✅ **T21 done (25.09):** s=0.95 (≈10 % black, thinnest visible margin) — user round 3: „das Bild ist jetzt perfekt von der Größe“; fallbacks 0.9/1.0 not needed |
| Flicker | ⏳ not yet reported by user (T17 final acceptance) |

**→ Next ticket:** **T17 final acceptance** (flicker — not reported in rounds 1–3; one question to the user). Then: optional n8n grayscale (T18) blocked on T19 (API key 401). Keep-awake on the device = **~ds** (user-verified 25.09; a reboot cancels it — the user re-enters it). Exact resume in `todos.json`. Rules for continuing AIs: **`AGENTS.md`**.

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
  dashboard.png (on-card cache = last render; 25.09: s=0.95 grayscale, 463,592 B), dashboard-real.png.bak (broken test)
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