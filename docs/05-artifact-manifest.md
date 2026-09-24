# 05 — Artifact manifest

Snapshot: **25.09.2026, 01:15 CEST (24.09 23:15Z)** (kindle `card`, live card + local `kindle-eink/` phase + n8n API dumps). Repo total: ~205 files / ~27 MB. All `.png`/`.js`/`.sh`/`.bin`/`.log` copies are bit-identical to their card origin (SHA-256 re-verified 25.09: `refresh.sh` 514a37ac…, `dashboard.png` ce561a6c…, `refresh.log` daa8cf1f…, `diag.log` 119a6b99…, `.boot` fd4501a8…; `binaries/dash` 58f751e4… = on card since 24.09 ~20:20Z). **No repo-vs-card exceptions remain** for the active set (the old mmap build is kept in the repo as `dash`, superseded on card since 24.09 13:29Z).

## `artifacts/` — device scripts & binaries (card `/mnt/us/`)

| File | Size | Provenance / notes |
|---|---|---|
| `refresh.sh` | **3,913 B (repo == card since 25.09 00:53 CEST, Point-Write)** | **v6** (live on card). History: v4 09:26Z (render every 30 s) → 2,599 B `d8d84e99…` on card since 24.09 13:29Z (T17) → v5 3,702 B `9cb8dcfc…` deployed 24.09 ~20:20Z (T20: `DASH_SCALE=0.8` + render **only on image change** (cksum) + restage NOTE) → **v6 deployed 24.09 abend** (3,714 B `2ebe400c…`: `DASH_SCALE=0.95` + v5→v6 markers) → **NOTE updated 25.09** (comments only: `~ds` keep-awake user-verified, reboot-critical; no behavior change — comment-only ≠ restage trigger, the restage watches the dash binary size only). Core loop: 10 s tick; boot = cache restore (`/mnt/us/dashboard.png` → `/tmp`) + render; download every 300 s via `dash get` (first URL wins: live webhook → LAN n8n); hot re-stage `/mnt/us/dash` → `/tmp` on size change; wifi re-enable per tick; log → `/mnt/us/refresh.log`. SHA-256 `514a37aca4724d2d731c761e3ff6aad16821d55f844cb932772da5160cb85460` (repo == card, mode rwx------) |
| `refresh.sh.bak-v1` | 2,194 B | Card copy of v1 (wget render loop, ~1 min cycle) — superseded, kept for history |
| `refresh.sh.bak-v3` | 3,393 B | v3: Mac proxy (`192.168.178.132:8080`) + `eips -g` every cycle — superseded (keeps Mac in loop), **v4 = this with the proxy replaced by Go render** |
| `.boot` | 510 B | Active boot hook (waits for `eips`+`lipc-set-prop`, starts `refresh.sh`, logs to `/mnt/us/boot.log`) |
| `reboot.bak` | 7 B | Old reboot hook (kept) |
| `dash` | 6,291,616 B | Staging binary (v4, mmap). SHA-256 `e27324469c77964c761cfe0a86adb12fb60da370689cfe5f01c4dfba7a63c15d` — **replaced on the card 24.09 13:29Z (T17) by the T16 build (`binaries/dash`); kept in the repo for reference** |
| `binaries/dash` | 5,177,496 B | **T20 (24.09 17:42Z) build with Go 1.23.12** (DASH_SCALE letterbox; **on the card since 24.09 ~20:20Z** (Point-Write, T20-Deploy; staged at the user's 25.09 21:55:14Z reboot)). Same build recipe as T16: `CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -trimpath -ldflags="-s"` from `src/kindle-dash/` (static, stripped, ELF 32-bit ARM EABI5; Go 1.23 kernel floor 3.0 → compatible with the Voyage's 3.0.35; `get` = fetch + decode + (T20: optional bilinear downscale + black letterbox) + grayscale → single-IDAT PNG, display = `eips -g` exec, no mmap write; `-trimpath`, `strings` clean). SHA-256 `58f751e4f158fb9e97552aa186cdabb6926e3033418c2f1546a3499f03641644`. **Same size as the T16 build** (5,177,496 B) → the size-based hot re-stage will NOT detect a same-size swap; the boot re-stage (reboot) is the effective trigger — NOTE added to `refresh.sh`. On-card T16 SHA-256 `ce74c7b44fe56c1700ced93d097ff09c993956fe1172da3f6f6ad75198f3f942` (superseded the slot's first build 6,291,616 B / SHA-256 `1d5c8979e7a01033acee51d18fed8b3b59fb41688e6a89e0c197198d5e791a67` — sanitized copy of the I10-era mmap build). `dash` + `refresh.sh` remain version-locked: deploy both |
| `RUNME.sh` | 1,402 B | Card root (legacy, inert). `RUNME-orig.bak` = identical copy |
| `emergency.sh` | 394 B | Card copy (jailbreak boot hook). `emergency.sh.bak` 1,412 B (original backup on card) |
| `dashboard.png` | **463,592 B (repo re-copied 25.09 == card)** | On-card cache = last render. Lineage: 792,764 B `cbf48177…` (mtime 06:43Z, RGB ct 2 / 25 IDAT — the doc-error cache; eips-rendered at the T17 boot as zoom-crop, one-off) → 463,228 B `6cdc49d9…` (24.09 20:42:53Z, first grayscale single-IDAT render, s=0.8) → **463,592 B `ce561a6c…` (25.09 22:00:29Z, first s=0.95 render — the „perfekt“ frame; re-verified 25.09: 1072×1448, 8-bit, colortype 0, 1 IDAT)**. Bistable: the frame stays visible through sleep/wake. SHA-256 `ce561a6ca654c0dc4e21b8f8e76b1463521de04c442f81d4ca25bc15a150b68f` (repo == card) |
| `dashboard-real.png.bak` | 387,171 B | 6-IDAT grayscale — **the broken v2 era image** (kept as counter-example) |
| `test-full.png` | 3,697 B | Calibration frame (frame+cross+corner dots), 1 IDAT grayscale — the "perfect full-screen" proof |

## `artifacts/images/` — 45 PNGs, all single-IDAT grayscale test/capture material

| Group | Files | What they proved |
|---|---|---|
| eips white/gray full-frame | `eips-full-white-*` (×5, sizes), `eips-full-gray-*` (×2) | `-g` path works; color-type test inputs |
| eips 1-bit pairs | `eips-1264x800-1bit.png`, `eips-800x1264-1bit.png`, `eips-test-1bit.png` | 1-bit vs 8-bit rendering |
| Geometry grids | `eips-grid-*` (6 sizes) | Geometry calibration + orientation reference (see doc 03) |
| Dashboard sizes | `eips-dashboard-758x1024.png`, `-1024x758.png`, `-1088x768.png` | eips-rendered dashboard at candidate sizes |
| Orientation tests | `orient-test-{t,t180,ccw,cw,landscape}.png` + `orient-test-1bit-*` (×4) | Rotation semantics; `t180` = 90° CW + horizontal flip |
| t180 variants | `var_ccw90.png`, `var_cw90.png`, `var_t180_flippedH.png`, `golden_t180.png` (387,171 B) | Code-node equivalence proofs (`golden_t180.png` = the byte-exact reference) |
| Code-node experiments | `js-test-input.png`, `js-test-gt.png`, `js-test-out.png` | Sandbox test inputs/outputs of the t180 JS experiments |
| Webhook captures | `webhook-v3.png`, `webhook-v4.png` (96 B!), `webhook-v5.png`, `webhook-bmp-test.png`, `webhook-after-fix.png` | Raw webhook responses; `webhook-v4.png` = 96 B error body ("no data") |

## `artifacts/jailbreak/`

| Path | Size | Notes |
|---|---|---|
| `watchthis-jailbreak-r03.zip` | 646,247 B | Device-side archive. SHA-256 `38ed5dadd0f98b1ac846967fbde14aa0543fc824207ee1889159993c87a2bfa3` |
| `kindle-eink-artefakte.zip` | 269,748 B | Zip of the local `kindle-eink/` phase (22./23.09). SHA-256 `176ea9a3be0a7b1436ea8a60606ca5d1c12f30a1d5349799970dfdea83ab8c59` |
| `Update_hotfix_watchthis_custom.bin` | 153,817 B | **The installed hotfix** (SP01). SHA-256 `2102e30fb2fb645c32e03bda8144903484d564e6934824a8797089779c063284` |
| `watchthis/watchthis-release/` | ~1 MB | Full release tree: `KV/` (5.13.4–5.13.6 + demo.json), `KOA1–3`, `KT2–4`, `PW2–5` (zip+demo each), root hotfix bin. Reference for recovery |
| `kindle-fertig/` | 172 K | "Done package": `01-jailbreak/.demo/KV-5.13.6.zip`, `02-hotfix/` bin, `README.txt` (2,958 B) |
| `kual-mrpi/` | 5.5 MB | MRInstaller (KUAL) bundle: `PEKI.zip` (115,806 B), `kual-mrinstaller-khf.tar.xz` (2,509,468 B), `extracted/` (ChangeLog, `mrpi-*.tar.gz` per model, `bin/mrinstaller.sh`) — source of the MRPI interaction channel |

## `artifacts/logs/` (card `/mnt/us/`)

| File | Size | Notes |
|---|---|---|
| `diag.log` | 12,619 B (re-copied 25.09) | dash internal log — 322 lines (25.09): eips rc=0 entries 14:18:23Z → 22:00:29Z (last 181.67 ms), all rc=0 |
| `refresh.log` | 16,670 B (re-copied 25.09) | refresh.sh cycle log — 264 lines (25.09): v6 start 21:55:14Z, boot render rc=0, dl ok 22:00:29 / 22:05:51 / 22:11:12Z, then silent (deep-sleep freeze) |
| `http-test.log` | 506 B | HTTP PoC (21.09) |

## `n8n/`

| Path | Notes |
|---|---|
| `rabbit-recognition-workflow.json` | Canonical API dump 23.09.2026 09:03Z (13 nodes), **sanitized**. SHA-256 `556df2490936ae3685562eba3247dd4f8762678bffa50f6c7cadbcd76b1d9881` |
| `code/t180-n8n.js` | **Gold code** (14,565 B), sandbox-verified byte-exact. SHA-256 `76f8f8b2153f1398655f3a6d50b2e8a7ed986c94772deb03a6023caa08dbf9f4` |
| `code/{t180js,t180js2,test-bmp-antitranspose,test-bmp2,test-n8n-sandbox,bmp-code-node}.js` | Dev iterations (2.1 KB–9.9 KB) |
| `history/` (5 JSONs) | BEFORE/AFTER-20260923 (UI saves), `n8n-live-rotate270-0923-0840Z`, `n8n-current-codeprobe-0923-0903Z`, `n8n-put-pass` (the 401 PUT response, sanitized) — all sanitized |

## Deliberately NOT in the repo

| Item | Why |
|---|---|
| 200 MB update bin (card root) | System update, not an artifact; re-downloadable |
| `*.BMP`/`*.PNM` derivatives >3 MB (11 files, 12.8 MB) | Lossy/oversized test detritus; the PNG sources suffice |
| `FSCK*.REN`, `.Spotlight-V100/`, `.Trashes`, 0 B files | Card/system filesystem hygiene, no project value |
| System `eips` + other ROM binaries | Unreachable (ROM partition read-only); behavior documented instead (doc 03) |
| Mac proxy scripts (v3 era) | Superseded architecture; doc 03 keeps the interface description |
| Anything containing credentials/webhook UUIDs | Sanitized to placeholders (doc 04); **never commit the originals** |