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
| `dashboard.png` (792,764 B, currently visible) | 1 | 0 | ✅ |

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
                               ├─ Floyd-Steinberg grayscale
                               ├─ saveKindlePNG: filter 0 + 1 zlib stream → 1 IDAT, color type 0
                               └─ /mnt/us/dashboard.png (1072×1448)
                           dash render → exec /usr/sbin/eips -g /mnt/us/dashboard.png (30 s)
```

- **Why:** `dash` mmap (v4) is invisible; the Mac proxy (v3 era) keeps the Mac in the loop permanently; `eips` is the only visible path; grayscale + single-IDAT must therefore happen **on the device**.
- **Status:** ✅ decided · ❌ NOT implemented (I10, steps 1–7).
- **Side decisions:** n8n stays RGB (converted device-side); partial refresh via `-x/-y` for less flicker; download 300 s / render 30 s (as in v4).

### Implementation plan (file level, from the 24.09 session)

1. `convert.go`: new `saveKindlePNG()` (spec above).
2. `main.go`: `get()` — drop all rotation/mirror code (the image arrives pre-oriented from n8n); keep grayscale + downscale + quantize.
3. `fb_linux.go`: `display()` → `exec /usr/sbin/eips -g <file> -x 0 -y 0` (drop the mmap path).
4. `fb_stub.go`: PGM output (for development on the Mac).
5. `render.go`: `convertTo8bitGray()` — the existing threshold cascade is already correct; keep.
6. Build: `CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s"` (Go ≤ 1.23) → static binary, watch size (current 6.29 MB).
7. Deploy (hot re-stage, no reboot needed): copy new `dash` → `/mnt/us/dash`, `pkill -f /mnt/us/dash && nohup /tmp/dash ...`, watch `/mnt/us/diag.log`.

### Open risks (assess before coding)

- `[open]` Does a static Go binary get permission to `exec` `eips` (AppArmor/seccomp on the ROM)? Fallback: `refresh.sh` itself calls `eips` after `dash` wrote the PNG (dash stops at "write file only").
- `[open]` Boot shows a full refresh, the loop shows partial — acceptable flicker, but verify with the user.
- `[recalled]` `DASH_FLIPX`/`DASH_FLIPY` env vars become obsolete with the final architecture — remove them.

## Open (display-side)

- `[open]` Partial vs. full refresh flicker trade-off in the regime (30 s) — user feedback after I10.
- `[open]` 16/4-bit grayscale mapping of the E-Ink driver for 8-bit input (currently: the driver does it, looked ok in the v2/v3 era).
- `[open]` Whether `eips` partial regions via `-x/-y` map a 1072×1448 PNG exactly onto the 758×1024 geometry (grid reference images as check).
