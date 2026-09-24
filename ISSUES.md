# ISSUES.md — Chronology: what was tried, what held

Legend: ✅ held · ❌ discarded/failed · ⏳ open. All entries compiled from project sessions + Notion pages; `[verified]` = checked against artifact/log, `[recalled]` = from session record, not checked against artifact, `[open]` = never confirmed.

## I1 — PoC: "Can the Kindle fetch from the network?" (21.09)

- `[verified]` BusyBox `wget` works over WPA2 (10 s). → Basis for everything else.
- `/dev/fb0` is writable, but **no userland write tool on the device** (no `fbset`/eips-BMP path) → own binary `dash` needed.
- Shell on device: only `sh` (BusyBox) + `wget`; no bash/python/curl. Scripts stay POSIX-sh.

## I2 — n8n delivers frames, but orientation was 3 days of chaos (21.–23.09)

- n8n `Edit Image` (Sharp) rotates only in 90° steps; `rotate: 90` performs **transpose + 180° = 90° CW + horizontal flip** (t180-equivalent), NOT a clean 90° turn. `[verified]` against `var_*.png` captures.
- Gold code `t180-n8n.js` (14,565 B) writes PNG manually (transposed, no 90° flip) + 180° flip. Sandbox test (Node vm, n8n `items` format): **PASS, 28,052,160 pixels byte-exact vs `golden_t180.png`**. `[verified]` (`n8n/code/test-n8n-sandbox.js`).
- **Never deployed:** n8n REST API returned 401 (API key invalid) → `n8n-put-*.json` exist only locally. `[verified]` against dumps `n8n/history/`.
- Intermediates on the live workflow (dumps): `rotate 90` → `rotate 270` (08:40Z) → env probe (450 chars, 09:03Z, last dump). Webhook delivered RGB 1072×1448 (19 IDAT, 585 KB/601 KB) in this phase.

## I3 — eips: 4 hours of diagnosis (22.09)

- First attempt with a 1-bit PNG → apparently only an edge render. Root-cause chain:
  - ❌ `-b` (BMP path): **NO-OP** on this device. `[verified]`
  - `[verified]` **`rotate=3`** in the framebuffer → all "twisted" findings were console rotation, not PNG errors.
  - `[verified]` **eips reads only the FIRST IDAT chunk**: multi-IDAT PNGs (Go encoder: 48 chunks) → zoomed crop. 1-IDAT PNGs (Python `zlib`) → exact.
  - `[verified]` **IHDR color type**: `00` (grayscale) required; `02` (RGB) → broken.
  - `[verified]` 8×8 and 32×32 minimal tests: `00` + 1 IDAT → **perfect** (images `artifacts/images/test-*`).
  - `[verified]` 3,697-B test image (`test-full.png`: frame + cross + corner points, 1 IDAT) renders **pixel-exact full-screen** → requirement finally confirmed.
  - `[verified]` Working-buffer analysis (fb0 dump, 2 planes, 16-bit LE, 3,104,512 B): pre-FLASH dump holds only 4 distinct values {0x3de, 0x3c0, 0x1e, 0x0}, pixel agreement ~0.86; ~16 px/row drift (1072 vs 1088 stride) forms diagonal bands; shear simulation gives no improvement → **no shear in the production path**.
  - `[verified]` eips flag behavior mapped: `-s` = full/FLASH (~3 s white–black–white), `-g` PNG, `-c` clear, `-v` invert, `-a` grid overlay, `-r` barcode, `-k` working-buffer dump to /tmp, `-p` partial, `-x/-y` region, `-i` device info.
- All orientation grids in `artifacts/images/eips-*.png`, `orient-test-*.png`.

## I4 — Mac proxy (23.09) — interim, later replaced

- `[verified]` `kindle-proxy.py` (Mac, `:9999`, 30 s cache) converted webhook RGB → single-IDAT grayscale (411 KB) and the `eips` display ran through (PASS log).
- ❌ End state unacceptable (Mac in the loop). → replaced by the final architecture (I10). The proxy script itself was local (`~/bin/kindle-proxy.py`), **not in the repo** (Mac tool, deliberately excluded).

## I5 — n8n grayscale: never landed (23.09)

- n8n `Edit Image` (Sharp) has **no** grayscale operation (`grayscale`/`greyscale` in `allowedOperations` = no, `grayscale()` via `image` op = no) → grayscale only via code node.
- ❌ Code node path got stuck: 401 API key (I2) → workflow ran to the end in RGB (19 IDAT). `[verified]` against `n8n-current.json`.
- **Consequence for the final architecture:** n8n may keep delivering RGB if needed — `dash` does grayscale + single-IDAT **on the device**. n8n grayscale stays **optional/nice-to-have** (I10 step 7).

## I6 — v1/v2/v3 era (21.–23.09)

- v1 (2,053/2,194 B): 10-min loop, `wget` → `eips`. `[verified]` `artifacts/refresh.sh.bak-v1`.
- v2 (2,499 B): + webhook URL, `refresh.log`, PID guard, sig+IHDR validity gate, cksum change detection; partial re-render every 30 s, full re-render every 300 s **only on cksum change**; boot fallback PNG. First visible dashboards (bistably retained).
- v3 (3,393 B, on card as `refresh.sh.bak-v3`): + `png_valid()` gate (sig/ihdr-color/IDAT count) + emergency re-show. `[verified]`
- All 3 versions in `artifacts/` — versions with timestamps in the header.

## I7 — dash v4 (23.09; the v4 render was invisible — replaced on card 24.09 13:29Z by the T16 build, T17 deploy)

- ✅ Implemented + deployed: `dash` (6,291,616 B static ARM-ELF, SHA-256 `e27324469c77964c761cfe0a86adb12fb60da370689cfe5f01c4dfba7a63c15d`): fetch (`http`, 15 s timeout, 3 URLs round-robin, 10 MB cap), decode (Go `image/png`: multi-IDAT + RGB **OK as input**), Floyd-Steinberg grayscale, render = **mmap framebuffer write**.
- ✅ `refresh.sh` v4 (2,720 B): 10-s tick; render 30 s; download 300 s; PID guard; hot re-stage (new `dash` on size change → `/tmp/dash`, since `/mnt/us` is no-exec).
- ❌ **Result:** `refresh.log` shows clean `dl ok 792764`/`render ok 3697` cycles, but the user sees **no change**: "nothing happens".
- `[verified]` **Root cause:** the E-Ink display updates visibly **only** through EPDC refresh waves; a raw mmap write changes framebuffer memory only and triggers no wave. `eips` is the only proven visible path. (Side finding: `dash get`'s validation is intact — the downloaded PNG is single-IDAT grayscale and matches `dashboard.png`.)
- Status (24.09): the old v4 `dash` mmap build was **replaced on the card 24.09 13:29Z** by the T16 build (T17 deploy, `/mnt/us/dash` SHA `ce74c7b4…`); the I10 binary is the on-card production path.
- **CORRECTED 24.09 (card-file measurement 14:57Z):** the card's `dashboard.png` (SHA `cbf48177…`, 792,764 B) is actually **RGB (IHDR colortype 2) with 25 IDAT chunks** — the "single-IDAT grayscale" above (and the same wording in `docs/05`, `AGENTS.md`) was a **doc error**. It was **never eips-rendered pre-T16** (mmap writes invisible anyway); it **was** eips-rendered at the T17 boot (~14:19Z, rc=0) — whether that render was faithful or the classic first-IDAT zoom-crop is **[open]** (user 24.09: visible, edge-to-edge, "too big" → T20).

## I8 — n8n workflow end state (23.09)

- Canonical (sanitized): `n8n/rabbit-recognition-workflow.json` (dump 09:03Z: Flow A Discord→rabbit→Read File→Edit Image (resize 1448×1072)→Edit Image 2 (env probe)→Respond binary 200; Flow B cache (Read File, 5-min schedule); webhook path `last-rabbit-recognition-frame`).
- **Open:** the API key problem (401) was never solved → workflow changes afterwards only via UI or re-issued API key. `[open]`
- Sanitizing: 4 placeholders in all JSONs (credential ID/name, 2 webhook UUIDs) — procedure + fields in `docs/04`.

## I9 — Card hygiene (24.09, before repo build)

- Between the first inventory and the repo build, several files were removed from the card: `eips`/`eips-new`/`eips-symlink` (local copies), `kindle-dash.zip`, `mrpi.log`/`reboot.log`/`eips-test.log`, test `.txt` files, `watchthis/`/`kindle-fertig/`/`kual-mrpi/` directories, `watchthis-jailbreak-r03.zip`, `Update_hotfix_watchthis_custom.bin`.
- **All** of them exist as local copies and are secured in this repo (`artifacts/jailbreak/`). The **system `eips`** lives on the internal ROM partition (inaccessible) and does **not** go into the repo. `[verified]`

## I10 — FINAL ARCHITECTURE (T12–T16 done; T17 in progress — flicker open; T20 done 24.09 abend; T21 done 25.09, user-verified → I11)

`dash` remains the only binary; `eips` remains the only visible path; the Mac drops out completely:

```
n8n webhook (RGB ok) ──► dash GET (300 s, wget-equivalent)
                               ├─ Go image/png decode (multi-IDAT/RGB ok as INPUT)
                               ├─ (T20, DASH_SCALE<1) manual-bilinear downscale + black letterbox
                               ├─ Floyd-Steinberg grayscale
                               ├─ saveKindlePNG: filter 0 + 1 zlib stream → 1 IDAT, color type 0
                               └─ /mnt/us/dashboard.png (1072×1448)
                           dash render → exec /usr/sbin/eips -g /mnt/us/dashboard.png (30 s)
```

### Implementation plan (in this order)

1. **`saveKindlePNG`** (Go): prefix every row with filter 0, **one** `compress/zlib` stream (whole image, no ~32-KB splitting like `image/png`), exactly **1 IDAT chunk**, IHDR color type `00`, correct CRCs. Reference: Python recipe + validation shell in `docs/03`. **[done T12]**
2. `dash get <out> <urls…>`: fetch + decode + grayscale → `saveKindlePNG` → `/mnt/us/dashboard.png`. **[done T13]** (T14: `get` no longer displays — the render step is the single EPDC wave per cycle.)
3. `dash render <file>`: `exec /usr/sbin/eips -g <file> -x 0 -y 0` (partial region as before; full only when needed). **[done T14]** (rc + duration → `/mnt/us/diag.log`; exec-permission risk stays open until T17.)
4. Static ARM build (Go ≤ 1.23, `GOARM=7`, `-ldflags="-s"`), keep `dash` < ~7 MB; replace `/mnt/us/dash` (size change → hot re-stage kicks in) + reboot. **[done T16 — Go 1.23.12, 5,177,496 B, `artifacts/binaries/dash` (repo == card); deployed on card 24.09 13:29Z]**
5. Check `refresh.log`: `dl ok` (size ~390–420 KB expected) + `render rc=0`. **[partly done T17 — boot render `render rc=0` (14:19:50Z) + eips rc=0 with durations 3.244 s / 2.636 s / 395.8 ms @14:20:14Z; first `dl ok` unobserved — card log gap after ~14:20Z, device likely sleeping [open]]**
6. **User verification (mandatory, display-side):** visible? t180 orientation? flicker/interval OK? **[in progress T17 — visible ✅, orientation ✅ (rounds 1–3); size: s=0.8 ❌ → T20 → s=0.95 ✅ „perfekt“ (25.09, T21 done); flicker/interval NOT yet reported (rounds 1–3)]**
7. Optional: switch the n8n side to grayscale (relieves the device, not needed for correctness) + open item from I8 (API key). **[open — T18/T19 blocked on the user's n8n API key (401, I2/I8)]**

File-level details + open risks: `docs/03-eink-rendering.md` §Implementation plan.

### Status 24.09 (T16 build deployed 13:29Z — user verification round 1 → T20 in progress: code + rebuild done 17:42Z, deploy pending)

- **Deploy** (13:29Z, point-write, announced + user-authorized): `/mnt/us/dash` = repo `artifacts/binaries/dash` (SHA `ce74c7b4…`), `/mnt/us/refresh.sh` = repo `artifacts/refresh.sh` (SHA `d8d84e99…`); repo == card re-verified after the write.
- **Effective trigger:** user reboot ~14:19Z. `refresh.log`: staged new dash, v4 start pid=6026, boot render rc=0 (14:19:50Z). `diag.log`: eips rc=0, durations 3.244 s / 2.636 s / 395.8 ms @14:20:14Z → **exec-permission risk resolved** (pre-T14 risk).
- **Card log gap** after 14:19:50Z (`refresh.log`) / 14:20:14Z (`diag.log`); first download ~300 s later unobserved — device likely sleeping, no error indication [open].
- **User verification round 1 (24.09):** dashboard **visible** ✅, **orientation** ✅ (t180 reference), **size ❌** ("füllt den ganzen screen aus, ist aber zu groß" = edge-to-edge, no margin) → **T20** (DASH_SCALE letterbox). Flicker: not reported.
- **Card-file measurement (14:57Z, PNG chunk walk):** card `dashboard.png` (SHA `cbf48177…`, 792,764 B) = 1072×1448, 8-bit, **colortype 2 (RGB), 25 IDAT** → the "single-IDAT grayscale, currently visible" wording in this repo was a **doc error** (corrected here + in `docs/03`, `docs/05`, `AGENTS.md`). The 1-IDAT + colortype 0 rule stays the **verified-safe output spec / reliability heuristic** (all ✅ rows + failing 6/19-IDAT rows in the `docs/03` proof table); it is NOT a verified complete description of eips's parser. The frame the user actually sees is the v2/v3-era eips-rendered grayscale, bistably retained.
- **T20 in progress (repo, 17:42Z):** code + tests done in `src/kindle-dash/` (`DASH_SCALE` env read in `get()`; < 1 → **manual clamped bilinear downscale** — the hash-verified go1.23.12 tree ships a pre-1.12-era `image/draw` without scaling ops — + black letterbox of the input's original dims; all 6 tests pass, vet clean); T20 rebuild 5,177,496 B / SHA `58f751e4…` in `artifacts/binaries/dash` (**same size as T16** → size-based hot re-stage blind; boot re-stage after reboot is the effective path, NOTE added to `refresh.sh`); `refresh.sh` 2,900 B / `b7e31438…` (`export DASH_SCALE=0.8`). **Deployed 24.09 ~20:20Z** (see below). **REMAINING:** user reboot + Stay Awake + verification round 2.

### Status 24.09 pm (card-log diagnosis + refresh.sh v5 — deploy still pending the user's explicit OK)

- **Log analysis (card, ~19:3xZ):** `diag.log` holds exactly **6 `eips rc=` lines, all 24.09** — 14:18:23 (3.244 s; **first-ever T16 eips call** — the still-running 22:14-boot loop hot-re-staged after resuming from deep sleep), 14:19:50 (2.636 s; boot), 14:20:14 (395.8 ms; forced 30 s tick re-render), 18:11:26 (501 ms; frozen loop resumed on wake), 18:13:12 (2.227 s; boot), 18:13:35 (403 ms; tick re-render). **Zero renders overnight** (the old pre-T14 script + 6.29 MB mmap dash ran — mmap writes are invisible, no eips).
- **What the user sees:** the eips **zoom-crop (docs/03 row 2) of the stale 06:43 RGB/25-IDAT cache** (user: „bild nur teilweise zu sehen“, „kleiner Ausschnitt … untere linke Ecke“). The round-1 „edge-to-edge, too big“ referred to the older full-size v2/v3-era grayscale frame (still on screen pre-reboot). **No grayscale single-IDAT image has ever been eips-rendered on the device** — the first grayscale render happens after the T20 deploy + first re-download.
- **Deep-sleep finding (verified from logs):** the refresh loop **freezes while the device deep-sleeps** (ticks advance only while awake; the frozen loop resumes on wake — 14:17/18:11 log lines). Overnight 22:14→06:43 it ran ~8.5 h continuously (device awake all night). Consequence: with normal sleep/wake use, tick 30 (300 s accumulated awake) is rarely reached → effectively no downloads.
- **Decision → refresh.sh v5 (repo, 24.09 pm, 3,702 B / SHA `9cb8dcfc…`):** render **only on image change** (cksum compare, v2-proven pattern) + **forced 30 s tick re-render removed** (it was the only post-boot render source → idle flicker, and it re-showed the zoom-crop); `DASH_SCALE=0.8` export + restage NOTE kept; + keep-awake NOTE (user setting only — no verified script-level keep-awake mechanism, do not invent one). **Deploy executed 24.09 ~20:20Z** (Point-Write, announced + User-OK „dann los“): on card `dash` = T20 (5,177,496 B / `58f751e4…`) + `refresh.sh` = v5 (3,702 B / `9cb8dcfc…`); SHA Repo == Karte verifiziert, Modus rwx------ unverändert. Effective trigger = user reboot (or wake → hot re-stage; boot render still shows the zoom-crop, first scaled render at the first re-download). **REMAINING:** user reboot + Stay Awake + ~10 min awake + verification round 2.

### Deliberately DOCUMENTED ONLY, NOT IN THE REPO

- Go source `dash` v4 — **[resolved T11]** in `src/kindle-dash/` (repo-relative, byte-verified vs Notion Artifacts; AGENTS.md path rule — no machine-specific origin path recorded).
- 24.09 (path rule): all user-specific absolute paths removed from docs/configs; the reference binary's embedded build-dir debug strings sanitized in place to a generic path (same size; a `-trimpath` rebuild after T11 is the clean fix).
- Mac tools (`kindle-proxy.py`, `n8n-proxy2.py` — both replaced/discarded, never used finally).
- 200-MB update bins, >3-MB BMP/PNM diagnostic derivatives, system `eips` (ROM) — reasons: `docs/05`.


## I11 — 24.09 abend: T20 verifiziert (Round 2) + T21 (Bild maximieren / Rand minimieren) + Screensaver-Wunsch (T21 done 25.09, user-verified; Screensaver gelöst via ~ds)

- **Round 2 (User, 24.09 abend, nach T20-Deploy + Reboot ~20:37Z):** Boot-Bild = alter Cache (Zoom-Crop des stale 06:43-RGB; Einmaler — Cache hält jetzt das Grayscale-Bild, Boot-Render zeigt das letzte Frame); **erstes Grayscale-Single-IDAT-Render 20:42:53Z** (dl ok + image changed + render rc=0, eips 181 ms) = ganzes Bild + schwarzer Rahmen — User: **„richtig gut!“** → **T20 done** (Safe-Spec end-to-end bestätigt; on-card PNG: 1072×1448, 8-bit, ct 0, 1 IDAT, 463,228 B, SHA 6cdc49d9…). Rand bei s=0.8: „viel zu groß“ → T21. Gerät ging danach in Deep Sleep → **Screensaver erschien** (Wunsch: nie wieder).
- **Geometrie-Befund:** n8n-Canvas = **1072×1448 = exakt Panel-Größe** → eips rendert 1:1 (kein zweites Letterbox/Crop) → sichtbarer Rand = 100 % dash-DASH_SCALE (s=0.8 → ≈36 % Schwarz; s=1.0 → edge-to-edge = Round-1-„zu groß“-Zustand).
- **Wunsch 1 (T21):** „das bild soll so groß wie möglich … und so wenig schwarzer rand wie möglich“ → **s=0.95** (≈10 % Schwarz; dünnster noch sichtbarer Rand ≈27 px seitlich / ≈36 px oben-unten; Bild ~19 % größer als bei 0.8). Deployed 24.09 abend (refresh.sh v6 = 3,714 B, SHA 2ebe400c…, Point-Write /Volumes/Kindle/refresh.sh, SHA Repo == Karte, rwx------; sicherer Trigger = Reboot). Fallbacks ohne Rebuild: 0.9 (≈18 % Schwarz) / 1.0 (kein Rand).
- **Wunsch 2 (Screensaver nie) → gelöst 25.09 (User-verifiziert auf dem Gerät):** ins Suchfeld `~ds` tippen + Enter → der Screensaver aktiviert sich nie, das Gerät bleibt wach. **Ein Reboot hebt `~ds` auf** → nach jedem Reboot neu eintippen (User-Job: „das übernehme ich, du musst hier nichts mehr machen“). Side-Effect: kurzes Drücken (Bildschirm aus) funktioniert damit nicht. Quellen: the-ebook-reader.com (2017-12-31), martin-prochnow.de, tipps-tricks-kniffe.de. Im refresh.sh-Header NOTE dokumentiert (25.09 aktualisiert); der frühere „Wach bleiben“-Menüpfad (Settings → Device) = sekundär [assumed].
- **Round 3 (25.09, User):** nach User-Reboot 21:55:14Z (v6 start pid=5700 + Boot-Render, eips 1.63 s) → **22:00:29Z dl ok + image changed + render rc=0 (eips 181.7 ms) = erstes s=0.95-Bild** (on-card PNG: 1072×1448, 8-bit, ct 0, 1 IDAT, 463,592 B, SHA ce561a6c…; Repo-Copy aktualisiert, bit-identisch); 22:05:51Z + 22:11:12Z dl ok, kein Change → kein Render; danach Silentium (22:33:32Z-Check) = Gerät im Deep Sleep (Loop-Freeze; Wake-Resume verifiziert 24.09). User 25.09: **„das Bild ist jetzt perfekt von der Größe“** → **T21 done**. ~ds: User-verifiziert (s. Wunsch 2). Logs: refresh.log 264 Zeilen (SHA daa8cf1f…), diag.log 322 Zeilen (SHA 119a6b99…), alle eips rc=0.
- **Status:** T21 done (user-verified 25.09). T17 offen (Flackern nie gemeldet, Rounds 1–3 → finale Frage beim User).
