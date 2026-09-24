# 05 — Artifact manifest

Snapshot: **24.09.2026, 17:02** (kindle `card`, live card + local `kindle-eink/` phase + n8n API dumps). Repo total: ~205 files / ~27 MB. All `.png`/`.js`/`.sh`/`.bin`/`.log` copies are bit-identical to their card origin (sizes verified at copy time).

## `artifacts/` — device scripts & binaries (card `/mnt/us/`)

| File | Size | Provenance / notes |
|---|---|---|
| `refresh.sh` | 2,720 B | **v4 live** (09:26Z): staging to `/tmp`, wget 300 s, Go render (mmap), render `eips` 30 s, `reboot -f` on render fail, partial refresh on file unchanged. SHA-256 `b1c06190d58e8ac7f0c28bb1a086f85f1826417c520afb1b4dcdc43b0bee2a4a` |
| `refresh.sh.bak-v1` | 2,194 B | Card copy of v1 (wget render loop, ~1 min cycle) — superseded, kept for history |
| `refresh.sh.bak-v3` | 3,393 B | v3: Mac proxy (`192.168.178.132:8080`) + `eips -g` every cycle — superseded (keeps Mac in loop), **v4 = this with the proxy replaced by Go render** |
| `.boot` | 510 B | Active boot hook (waits for `eips`+`lipc-set-prop`, starts `refresh.sh`, logs to `/mnt/us/boot.log`) |
| `reboot.bak` | 7 B | Old reboot hook (kept) |
| `dash` | 6,291,616 B | Staging binary (v4, mmap). SHA-256 `e27324469c77964c761cfe0a86adb12fb60da370689cfe5f01c4dfba7a63c15d` — **replaced by the I10 build; kept for reference** |
| `binaries/dash` | 6,291,616 B | Same binary (kept as the canonical slot for the **next** build — I10 step 7) |
| `RUNME.sh` | 1,402 B | Card root (legacy, inert). `RUNME-orig.bak` = identical copy |
| `emergency.sh` | 394 B | Card copy (jailbreak boot hook). `emergency.sh.bak` 1,412 B (original backup on card) |
| `dashboard.png` | 792,764 B | **Current live bistable display**: single-IDAT 8-bit grayscale 1072×1448. SHA-256 `cbf48177d8aa4b86016d4f03656d784646a25250fbed5d9dab01cd4f7952f4ce` |
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
| `diag.log` | 12,113 B | dash internal log (v4 era) |
| `refresh.log` | 15,340 B | refresh.sh cycle log |
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
| Go source (`/Users/private/kindle-dash/`: `go.mod`, `main.go`, `render.go`, `convert.go`, `fb_linux.go`, `fb_stub.go`) | On another machine; **copy it in when I10 work starts** (AGENTS.md gap note) |
| Mac proxy scripts (v3 era) | Superseded architecture; doc 03 keeps the interface description |
| Anything containing credentials/webhook UUIDs | Sanitized to placeholders (doc 04); **never commit the originals** |