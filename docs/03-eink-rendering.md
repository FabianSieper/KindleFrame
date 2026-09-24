# 03 — E-Ink rendering & eips constraints (THE core documentation)

This page contains the hard, artifact-verified rules for everything that lands on the E-Ink display.

## The two hard requirements for `eips -g <png>`

| # | Requirement | Proof | Failure mode |
|---|---|---|---|
| 1 | **IHDR color type = `00`** (8-bit grayscale) | 8×8/32×32 tests: `00` ✅ / `02` (RGB) ❌; webhook RGB (19 IDAT, color `02`) → broken | Decoder misreads colors, image smears/partially broken |
| 2 | **Exactly 1 IDAT chunk** | 1-IDAT PNG → pixel-exact; 6-IDAT → broken; Go `image/png` (48 IDAT à ~32 KB) → zoomed crop (only first chunk read); 3,697-B test image (1 IDAT) → perfect full-screen | **First IDAT chunk is read, the rest discarded** → the image crop is scaled to the full framebuffer (the classic "zoom" artifact) |

**Practical consequence:** every PNG destined for eips must be produced by an encoder that (a) writes grayscale and (b) packs the whole image into **one** `zlib` stream. Go standard `image/png` satisfies (a) with `color.GrayModel` **but not** (b) (blocks at ~32 KB) → `saveKindlePNG` (I10 step 1).

> **Superseded belief:** an afternoon finding claimed "eips -g accepts 8-bit RGB". It was wrong — a controlled 32×32 experiment (single IDAT, vary color type only) settled it on 22.09 night: color type must be `00`. The controlled experiment is the source of truth; do not re-litigate.

### Proof table (excerpt, images in `artifacts/images/`)

| Image | IDATs | Color | Result |
|---|---|---|---|
| `test-8x8-result.png` / `test-32x32-result.png` | 1 | 0 | ✅ pixel-exact |
| `test-full.png` (3,697 B: frame + cross + corner points) | 1 | 0 | ✅ perfect full-screen |
| `eips-grid-*.png` (custom-built) | 1 | 0 | ✅ (geometry calibration) |
| `orient-test-t180.png` | 1 | 0 | ✅ (orientation reference) |
| `dashboard-real.png.bak` (387,171 B) | **6** | 0 | ❌ broken (IDAT #2+ discarded) |
| Webhook capture `wh2.png` (585,463 B) | **19** | 2 (RGB) | ❌ (both violations) |
| `dashboard.png` (792,764 B, on card) | **25** | **2 (RGB)** | ⚠️ **doc error corrected 24.09 (measured 14:57Z)** — see note below the table |

> **Correction 24.09 (PNG chunk walk of the card file, SHA `cbf48177…`, 14:57Z):** the row above previously read "1 IDAT / color type 0 / ✅ currently visible" — **wrong**: the card's `dashboard.png` is 1072×1448, 8-bit, **colortype 2 (RGB), 25 IDAT** (792,764 B). The same erroneous wording existed in `docs/05` and `AGENTS.md` (both corrected in the same commit). Context, honest version: (a) **pre-T16 the file was never eips-rendered** (mmap writes are invisible) — the frame the user saw was the v2/v3-era eips-rendered grayscale, bistably retained; (b) it **was** eips-rendered at the T17 boot (~14:19Z, rc=0, ~3.2 s) — whether that render was faithful or the classic first-IDAT zoom-crop: **[resolved 24.09 pm: it was the zoom-crop]** (user post-reboot: „bild nur teilweise zu sehen“, „kleiner Ausschnitt … untere linke Ecke“ = the row-2 failure mode on a 25-IDAT file; the round-1 „edge-to-edge, too big“ referred to the older full-size v2/v3-era grayscale frame still on screen pre-reboot). **[superseded 24.09 abend:]** the first grayscale single-IDAT eips render happened at **20:42:53Z** (eips rc=0, 181 ms); user round 2: whole image visible + black frame („richtig gut“) → the safe output spec (1 IDAT, colortype 0, filter 0) is confirmed to display faithfully end-to-end (see „Verified on device“ below). Interpretation: the "1 IDAT + colortype 0" rule stays as the **verified-safe output spec / reliability heuristic** (all ✅ rows above + the failing 6-/19-IDAT rows) — it is **not** a verified complete description of eips's parser. Untested: whether eips renders this 792 KB RGB/25-IDAT file faithfully. The question becomes moot after T20's first re-download (output spec-compliant grayscale again).

## Framebuffer & geometry reference

```
/dev/fb0 (mxc_epdc_fb):
  xres=1072  yres=1448   visible=1088×6144
  bit count=8  line_length=1088 (=1072+20 pad)  smem=6,782,976 B
  rotate=3  grayscale=1
Display geometry: 758×1024 (portrait) / 1024×758 (landscape)
```

- **`rotate=3`** (270°) is the active console rotation. All "image is twisted" phenomena were attributed to it on 22.09 — **not** to PNG errors.
- **t180 equality (n8n `rotate: 90`)**: `rotate: 90` = **transpose + 180° = 90° CW + horizontal flip**. For our purposes (1072×1448 square-equivalent) t180 is the correct console correction; a clean 90° turn would be t180 **without** the horizontal flip. `[verified]` against `var_ccw90/cw90/t180_flippedH.png`.
- **Orientation reference images** (1-IDAT grids): `artifacts/images/eips-grid-*.png`, `orient-test-*.png` — compare against these before any orientation change (user check).
- **Working buffer analysis** `[verified]`: the fb0 buffer is actually 2 planes (3,104,512 B = 1072×2896, 16-bit LE). A pre-FLASH dump holds only 4 distinct values {0x3de, 0x3c0, 0x1e, 0x0}; pixel agreement ~0.86; a ~16 px/row drift (1072 vs 1088 stride) forms diagonal bands; shear simulation gives no improvement → **no shear in the production path**. Consequence: do not chase shear/offset "fixes" — go through `eips`.

## `eips` flag behavior (this device)

| Flag | Behavior |
|---|---|
| `-g <file>` | PNG render (grayscale expectation as above) |
| `-b <file>` | **NO-OP** — the BMP path does not exist on the KV. `[verified]` |
| `-s` | Full/FLASH refresh (~3 s white–black–white) — never in the unattended loop |
| `-x <x> -y <y>` | Partial region refresh; `-x 0 -y 0` = "from origin" (we use it for full-758×1024 in buffer sense) |
| `-p` | Partial refresh |
| (no `-x/-y`) | Full refresh (more flicker) |
| `-c` | Clear |
| `-v` | Invert |
| `-a` | Grid overlay (diagnostics) |
| `-r` | Barcode (diagnostics) |
| `-k` | Working-buffer dump to /tmp (diagnostics, see above) |
| `-i` | Prints device/framebuffer info (calibration basis) |

**EPDC rule:** `eips` triggers a visible EPDC refresh wave. A pure framebuffer write (mmap, `dash` v4) **triggers no wave** → invisible. `[verified]` (24.09, user: "nothing happens", logs show clean cycles). → **`eips` is the only proven visible path.**

## Reference implementation `saveKindlePNG` (Python, as specification)

```python
import zlib, struct

def save_kindle_png(path, w, h, gray):
    # gray: bytes, w*h, row-major, each row w bytes (grayscale)
    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0)  # bitdepth=8, colortype=0 (grayscale)
    raw  = b''.join(b'\x00' + gray[y*w:(y+1)*w] for y in range(h))  # filter 0 per row
    idat = zlib.compress(raw)                                      # ONE stream -> 1 IDAT
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))
```

**Go counterpart (I10 step 1):** same structure; `compress/zlib` writer over the whole `raw` buffer; **not** `image/png` (blocks at ~32 KB → 48 IDAT). CRC via `hash/crc32` (IEEE).

## Validation (Mac, shell) — before EVERY deploy

```sh
validate_png() {  # $1=file; expects: 1 IDAT + color type 0
  python3 - "$1" <<'EOF'
import sys,struct,zlib
d=open(sys.argv[1],'rb').read()
assert d[:8]==b'\x89PNG\r\n\x1a\n','bad sig'
i=8; idat=0; ct=None
while i<len(d):
    l,=struct.unpack('>I',d[i:i+4]); t=d[i+4:i+8]; b=d[i+8:i+8+l]
    if t==b'IHDR':
        w,h,bd,ct,f,cf,il=struct.unpack('>IIBBBBB',b)
        print('size',w,h,'bitdepth',bd,'colortype',ct)
        assert ct==0 and bd==8,'FAIL: not 8-bit grayscale'
    if t==b'IDAT': idat+=1
    i+=12+l
print('IDAT count:',idat)
assert idat==1,'FAIL: %d IDAT (must be 1)'%idat
print('OK')
EOF
}
```

## Final architecture (decided 24.09.2026)

```
n8n webhook (RGB ok) ──► dash GET (300 s, wget-equivalent)
                               ├─ Go image/png decode (multi-IDAT/RGB ok as INPUT)
                               ├─ (T20, DASH_SCALE<1) manual-bilinear downscale + black letterbox
                               ├─ Floyd-Steinberg grayscale
                               ├─ saveKindlePNG: filter 0 + 1 zlib stream → 1 IDAT, color type 0
                               └─ /mnt/us/dashboard.png (1072×1448)
                           dash render → exec /usr/sbin/eips -g /mnt/us/dashboard.png (only on image change — v5)
```

- **Why:** `dash` mmap (v4) is invisible; the Mac proxy (v3 era) keeps the Mac in the loop permanently; `eips` is the only visible path; grayscale + single-IDAT must therefore happen **on the device**.
- **Status:** ✅ implemented in `src/kindle-dash/` (T12–T16: `saveKindlePNG`, `get`, `render` = `eips -g` exec, stub cleanup, Go 1.23.12 static build 5,177,496 B) + **deployed to the card 24.09 13:29Z (T17)** — user 24.09: visible ✅, orientation ✅, size ❌ (edge-to-edge, "too big") → **T20**; flicker not reported; T17 stays in progress until final acceptance (size + flicker). **T20 in progress (repo, 24.09 17:42Z):** code + tests + rebuild done (T20 build: same 5,177,496 B, SHA `58f751e4…`). **24.09 pm (card-log diagnosis):** `diag.log` holds exactly **6 `eips rc=` lines, all 24.09** (14:18:23 / 14:19:50 / 14:20:14 / 18:11:26 / 18:13:12 / 18:13:35), **zero overnight** (old pre-T14 script + 6.29 MB mmap dash → invisible writes); the frame the user now sees = **eips zoom-crop of the stale 06:43 RGB/25-IDAT cache** (row 2 above; user: „bild nur teilweise zu sehen“, „kleiner Ausschnitt … untere linke Ecke“) — **no grayscale single-IDAT image has ever been eips-rendered on this device** (first one = post-T20-deploy, at the first re-download). **Deep-sleep finding (verified from logs):** the refresh loop **freezes while the device deep-sleeps** (ticks advance only while awake; the frozen loop resumes on wake — 14:17/18:11 log lines) → with normal sleep/wake use tick 30 (300 s) is rarely reached → effectively no downloads. **refresh.sh v5 (24.09 pm, 3,702 B / SHA `9cb8dcfc…`):** render **only on image change** (cksum, v2-proven) + forced 30 s tick re-render removed (was the only post-boot render source → idle flicker, re-showed the zoom-crop); `DASH_SCALE=0.8` + restage NOTE kept, + keep-awake NOTE (user setting only — no verified script-level keep-awake mechanism). **Deploy executed 24.09 ~20:20Z (Point-Write, announced + User-OK „dann los“):** on card `dash` = T20 (5,177,496 B / `58f751e4…`) + `refresh.sh` v5 (3,702 B / `9cb8dcfc…`), SHA Repo == Karte verifiziert. Effective trigger = user reboot (or wake → size-change hot re-stage); boot render still shows the zoom-crop of the stale cache, **first scaled grayscale render at the first re-download (~5 min awake)**. **REMAINING:** user reboot + Stay Awake + ~10 min awake + verification round 2 (whole image? black frame? orientation? flicker?) → then close T20 + T17.
- **Side decisions:** n8n stays RGB (converted device-side); partial refresh via `-x/-y` for less flicker; download 300 s / render **only on image change** (v5, cksum — the forced 30 s re-render caused idle flicker, removed; note the loop freezes in device deep sleep — ticks advance only while awake).

### Implementation plan (file level, from the 24.09 session)

1. `convert.go`: new `saveKindlePNG()` (spec above). ✅ T12
2. `main.go`: `get()` — drop all rotation/mirror code (the image arrives pre-oriented from n8n); keep grayscale + downscale + quantize. ✅ T13 — note: T13's `get()` still called `render()`; T14 removes that call, so `get` = steps 1–3 of the diagram and `render` = the single EPDC wave per cycle.
3. `fb_linux.go`: `display()` → `exec /usr/sbin/eips -g <file> -x 0 -y 0` (drop the mmap path). ✅ T14 — rc + duration always logged to `/mnt/us/diag.log` (new); the byte-buffer `transpose` and `DASH_FLIPX/Y` go away with the mmap path.
4. `fb_stub.go`: PGM output (for development on the Mac). ✅ T14 (`DASH_FB` override; minor cleanup = T15).
5. `render.go`: `render()` = thin `display()` wrapper (T14); the grayscale cascade (`toGray`) is unchanged.
6. Build: `CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -trimpath -ldflags="-s"` (Go ≤ 1.23) → static binary, watch size (current 5.18 MB). ✅ T16 (Go 1.23.12, 5,177,496 B, `artifacts/binaries/dash`). **T20 rebuild (24.09 17:42Z):** same toolchain; **same size** (5,177,496 B — the size-based hot re-stage will therefore NOT detect a same-size live swap; boot re-stage after reboot is the effective path, NOTE added to `refresh.sh`); SHA-256 `58f751e4f158fb9e97552aa186cdabb6926e3033418c2f1546a3499f03641644`. **Toolchain forensics:** the official hash-verified go1.23.12 tarball (SHA-256 `5bfa117e401ae64e7ffb960243c448b535fe007e682a13ff6c7371f4a6f0ccaa` per go.dev; tree == GitHub tag) ships a **pre-1.12-era `image/draw`** (no scaling ops, 5-arg `Draw`, no `Clear`) while having modern stdlib markers (`errors.Join`, generic `min`/`max`) → `scaleLetterbox` is a manual clamped bilinear (`bilinearGray`), no `image/draw` import; code against the verified tree's actual API, not remembered Go; build with `GOTOOLCHAIN=local` + `env -u GOROOT` (an ambient Homebrew `GOROOT` would shadow the pinned toolchain).
7. Deploy (hot re-stage, no reboot needed): copy new `dash` → `/mnt/us/dash`, `pkill -f /mnt/us/dash && nohup /tmp/dash ...`, watch `/mnt/us/diag.log`. ✅ T17 (executed 24.09 13:29Z, point-write; SHAs verified: `dash` = `ce74c7b4…`, `refresh.sh` = `d8d84e99…`, repo == card; effective trigger = user reboot ~14:19Z)

### Open risks (assess before coding)

- `[open → resolved T17]` Does a static Go binary get permission to `exec` `eips` (AppArmor/seccomp on the ROM)? Fallback: `refresh.sh` itself calls `eips` after `dash` wrote the PNG (dash stops at "write file only"). **Resolved:** post-deploy `diag.log` shows eips rc=0 with durations 3.244 s / 2.636 s / 395.8 ms @14:20:14Z (after user reboot ~14:19Z) — no seccomp/permission failure.
- `[open]` Boot shows a full refresh, the loop shows partial — acceptable flicker, but verify with the user. (User has NOT reported yet — verification round 1 on 24.09 covered visibility/orientation/size only.)
- `[done T14]` `DASH_FLIPX`/`DASH_FLIPY` env vars (and the byte-buffer `transpose`) removed with the mmap path — orientation is now n8n's job (t180 pre-rotation, `docs/04`) + eips display. If the T17 user check shows the image landed rotated, re-add the documented t180 (transpose + 180°) on the dash side. **T17 user check 24.09: orientation ✅ — no re-add needed.**

## Open (display-side)

- `[done T20 (24.09 abend); final s=0.95 via T21 (25.09)]` **T20 (new 24.09, from user verification round 1):** image size on display — "füllt den ganzen screen aus, ist aber zu groß" (edge-to-edge, no margin). Fix: `DASH_SCALE` env var (float 0..1, default 1.0) read in `get()`; if < 1 → **manual clamped bilinear downscale** (`bilinearGray` — the hash-verified go1.23.12 tree ships a pre-1.12-era `image/draw` with no scaling ops, so `draw.ApproxBiLinear` is unavailable) to s·w × s·h → center on a black `image.NewGray` letterbox of the input's **original** dims → existing `*image.Gray` fast path in `toGray` → `saveKindlePNG` (output spec unchanged: 1072×1448, 1 IDAT, ct 0, filter 0). Start at 0.8; later retune = edit `refresh.sh` (`export DASH_SCALE=0.8`) + redeploy only. **AS BUILT 24.09 17:42Z:** code + tests done in `src/kindle-dash/` (all 6 tests pass, vet clean, verified toolchain); T20 rebuild 5,177,496 B / SHA `58f751e4…` in `artifacts/binaries/dash` (**same size as T16** → size-based hot re-stage blind; reboot is the effective deploy trigger). **24.09 pm:** `refresh.sh` → **v5** (3,702 B / SHA `9cb8dcfc…`): render **only on image change** (cksum; forced 30 s re-render removed), `export DASH_SCALE=0.8` + restage + keep-awake NOTE. Card-log diagnosis: the frame the user sees is the **zoom-crop of the stale 06:43 RGB/25-IDAT cache** (6 eips lines, all 24.09, zero overnight; no grayscale render ever) — the first faithful grayscale render happens post-deploy at the first re-download. **Deployed 24.09 ~20:20Z** (Point-Write, announced + User-OK „dann los“; SHA Repo == Karte verifiziert). **REMAINING:** user reboot + device kept awake (Stay Awake) + ~10 min awake + verification round 2 (first scaled image appears at the FIRST re-download — the boot render still shows the zoom-crop of the stale cache). Clarify with user: (a) wants a margin/letterbox (→ this) vs (b) wants the n8n canvas zoomed out (→ I8, n8n side).
- `[open]` Partial vs. full refresh flicker trade-off in the regime (30 s) — user feedback after I10.
- `[open]` 16/4-bit grayscale mapping of the E-Ink driver for 8-bit input (currently: the driver does it, looked ok in the v2/v3 era).
- `[open]` Whether `eips` partial regions via `-x/-y` map a 1072×1448 PNG exactly onto the 758×1024 geometry (grid reference images as check).


## Verified on device (24.09 abend, post T20-Deploy)

- **First grayscale single-IDAT eips render: 20:42:53Z** (eips rc=0, 181 ms) → user round 2: whole image visible + black frame, „richtig gut!“ (orientation: round 1). On-card PNG measured: 1072×1448, 8-bit, colortype 0, **1 IDAT**, 463,228 B, SHA 6cdc49d9… → the safe output spec (row 1) is confirmed to display faithfully end-to-end. The stale 06:43 RGB/25-IDAT zoom-crop was a one-off (cache now holds the grayscale image; boot renders show the last cached frame, bistable).
- **n8n canvas = 1072×1448 = exactly panel size** (measured on the 20:42Z output) → eips maps it 1:1 (no fit-scale, no crop) → the visible border is 100 % the dash DASH_SCALE letterbox: s=0.8 → ≈36 % black (user: „viel zu groß“); T21 s=0.95 → ≈10 % black (≈27 px sides / ≈36 px top-bottom); s=1.0 = edge-to-edge (round-1 „zu groß“ state).
- Caveat: dash output dimensions follow the input dimensions. If the n8n canvas ever becomes **larger than the panel**, eips's mapping behavior (fit vs center-crop) is unverified — keep the n8n canvas at 1072×1448 or below.
- Deep sleep: the refresh loop freezes (verified from logs; resumes on wake — 24.09 18:11:26Z line; 25.09: silent since 22:11:12Z = frozen again); the screensaver appears while asleep — the user wants it never → **solved 25.09 by user-verified `~ds`** (search bar + `~ds` + Enter; a reboot cancels it — the user re-enters it; no script-level keep-awake mechanism exists).
- **25.09 (T21 done):** first s=0.95 render 22:00:29Z (eips rc=0, 181.7 ms); on-card PNG re-verified 25.09: 1072×1448, 8-bit, colortype 0, **1 IDAT**, 463,592 B, SHA ce561a6c… (repo copy updated, bit-identical). User round 3 (25.09): „das Bild ist jetzt perfekt von der Größe“ → **s=0.95 = final** (fallbacks 0.9/1.0 not needed).
