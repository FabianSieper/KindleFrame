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

## I7 — dash v4 (23.09, currently live, BUT invisible)

- ✅ Implemented + deployed: `dash` (6,291,616 B static ARM-ELF, SHA-256 `e27324469c77964c761cfe0a86adb12fb60da370689cfe5f01c4dfba7a63c15d`): fetch (`http`, 15 s timeout, 3 URLs round-robin, 10 MB cap), decode (Go `image/png`: multi-IDAT + RGB **OK as input**), Floyd-Steinberg grayscale, render = **mmap framebuffer write**.
- ✅ `refresh.sh` v4 (2,720 B): 10-s tick; render 30 s; download 300 s; PID guard; hot re-stage (new `dash` on size change → `/tmp/dash`, since `/mnt/us` is no-exec).
- ❌ **Result:** `refresh.log` shows clean `dl ok 792764`/`render ok 3697` cycles, but the user sees **no change**: "nothing happens".
- `[verified]` **Root cause:** the E-Ink display updates visibly **only** through EPDC refresh waves; a raw mmap write changes framebuffer memory only and triggers no wave. `eips` is the only proven visible path. (Side finding: `dash get`'s validation is intact — the downloaded PNG is single-IDAT grayscale and matches `dashboard.png`.)
- Status: v4 keeps running (harmless, just invisible) and forms the basis for I10.

## I8 — n8n workflow end state (23.09)

- Canonical (sanitized): `n8n/rabbit-recognition-workflow.json` (dump 09:03Z: Flow A Discord→rabbit→Read File→Edit Image (resize 1448×1072)→Edit Image 2 (env probe)→Respond binary 200; Flow B cache (Read File, 5-min schedule); webhook path `last-rabbit-recognition-frame`).
- **Open:** the API key problem (401) was never solved → workflow changes afterwards only via UI or re-issued API key. `[open]`
- Sanitizing: 4 placeholders in all JSONs (credential ID/name, 2 webhook UUIDs) — procedure + fields in `docs/04`.

## I9 — Card hygiene (24.09, before repo build)

- Between the first inventory and the repo build, several files were removed from the card: `eips`/`eips-new`/`eips-symlink` (local copies), `kindle-dash.zip`, `mrpi.log`/`reboot.log`/`eips-test.log`, test `.txt` files, `watchthis/`/`kindle-fertig/`/`kual-mrpi/` directories, `watchthis-jailbreak-r03.zip`, `Update_hotfix_watchthis_custom.bin`.
- **All** of them exist as local copies and are secured in this repo (`artifacts/jailbreak/`). The **system `eips`** lives on the internal ROM partition (inaccessible) and does **not** go into the repo. `[verified]`

## I10 — FINAL ARCHITECTURE (decided, NOT implemented) ← NEXT TICKET

`dash` remains the only binary; `eips` remains the only visible path; the Mac drops out completely:

```
n8n webhook (RGB ok) ──► dash GET (300 s, wget-equivalent)
                               ├─ Go image/png decode (multi-IDAT/RGB ok as INPUT)
                               ├─ Floyd-Steinberg grayscale
                               ├─ saveKindlePNG: filter 0 + 1 zlib stream → 1 IDAT, color type 0
                               └─ /mnt/us/dashboard.png (1072×1448)
                           dash render → exec /usr/sbin/eips -g /mnt/us/dashboard.png (30 s)
```

### Implementation plan (in this order)

1. **`saveKindlePNG`** (Go): prefix every row with filter 0, **one** `compress/zlib` stream (whole image, no ~32-KB splitting like `image/png`), exactly **1 IDAT chunk**, IHDR color type `00`, correct CRCs. Reference: Python recipe + validation shell in `docs/03`.
2. `dash get <out> <urls…>`: fetch + decode + grayscale → `saveKindlePNG` → `/mnt/us/dashboard.png`.
3. `dash render <file>`: `exec /usr/sbin/eips -g <file> -x 0 -y 0` (partial region as before; full only when needed).
4. Static ARM build (Go ≤ 1.23, `GOARM=7`, `-ldflags="-s"`), keep `dash` < ~7 MB; replace `/mnt/us/dash` (size change → hot re-stage kicks in) + reboot.
5. Check `refresh.log`: `dl ok` (size ~390–420 KB expected) + `render rc=0`.
6. **User verification (mandatory, display-side):** visible? t180 orientation? flicker/interval OK?
7. Optional: switch the n8n side to grayscale (relieves the device, not needed for correctness) + open item from I8 (API key).

File-level details + open risks: `docs/03-eink-rendering.md` §Implementation plan.

### Deliberately DOCUMENTED ONLY, NOT IN THE REPO

- Go source `dash` v4 (`/Users/private/kindle-dash/`, another machine) — only the binary included.
- Mac tools (`kindle-proxy.py`, `n8n-proxy2.py` — both replaced/discarded, never used finally).
- 200-MB update bins, >3-MB BMP/PNM diagnostic derivatives, system `eips` (ROM) — reasons: `docs/05`.