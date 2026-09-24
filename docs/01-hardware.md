# 01 — Hardware & device model

## Device

| Field | Value |
|---|---|
| Model | Kindle Voyage 7th gen (KV, 2014) |
| Serial | `b013 0907 5226 08b0` |
| Firmware | 5.13.6 (jailbroken via WatchThis Legacy, 21.09.2026) |
| CPU | ARM 32-bit (static Go build: `GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0`) |
| Kernel | 3.0.35-lab126 |
| Go toolchain cap | **Go 1.23** (Go 1.24+ requires Linux ≥ 3.2; device runs 3.0.35) |
| Display | 7.8" E-Ink (bistable), 300 ppi, **758×1024** portrait / 1024×758 |
| Framebuffer | `mxc_epdc_fb`: **1072×1448**, 8-bit, `line_length=1088` (20 B pad), `vres=1088×6144`, `smem=6,782,976 B`, **`rotate=3`**, `grayscale=1` |

Framebuffer geometry: the 1072×1448 buffer is padded by 20 B/row and is mapped by the driver logic for the 758×1024 display geometry with `rotate=3` (270°). → For everything image-related: think in **framebuffer space (1072×1448)**, the console shows it rotated. See `03-eink-rendering.md` §Geometry.

## Filesystem layout (relevant)

| Path | Property |
|---|---|
| `/mnt/us/` | External MicroSD (FAT), mountable from the Mac as `/Volumes/Kindle`. **Here** live: `dash`, `refresh.sh`, `dashboard.png`, `RUNME.sh`, `emergency.sh`, `.boot`, logs. No-exec mount (binaries must be staged to `/tmp` = tmpfs) — `refresh.sh` v4 does that on size change. |
| `/` (ROM) | Internal, read-only. Contains among others `/usr/sbin/eips` (133,432 B, **not** extractable/copyable from the Mac) and the framebuffer device. |
| `/dev/fb0` | Framebuffer; writable (mmap), but **visible only via EPDC refresh** (→ 03). |
| `/tmp/` | tmpfs; `dash` is staged here on deploy/update. |

## Interaction model (important for all device work)

- **There is no free terminal on the device.** All interaction happens via MRPI (`;log <file>`, `;get <file>`) and files on `/mnt/us/` (readable from the Mac). `[recalled]` from project record.
- All execution ran through script hooks: `.boot` (runs after boot, starts `refresh.sh`) and `RUNME.sh`-style test scripts.
- **Proof/debugging** therefore runs via: logs on `/mnt/us/*.log` (readable from the Mac) + test scripts that run on the next reboot.
- **No `curl`, no `python`, no `perl`, no `bash`** — only `wget` (BusyBox, WPA2-capable, ~10 s) + POSIX `sh` + coreutils (`grep`/`sed`/`awk`).
- E-Ink **stays bistable** — a dead `refresh.sh` simply leaves the last image on screen.

## Network

- WPA2 home WLAN; the `wget` PoC (21.09) showed: connect ~10 s, HTTP download works. n8n is reachable from the device (LAN).
- In the final architecture `dash` downloads directly from the n8n webhook (LAN URL); no proxy anymore.

## Reboot/deploy path

1. Mac: write `dash`/`refresh.sh`/`dashboard.png` to `/mnt/us/` (FAT write).
2. Reboot the Kindle (or `eips`/`lipc` via script hook — `.boot` starts `refresh.sh` after the system-ready wait).
3. `refresh.sh` v4 stages `dash` → `/tmp/dash` (on size change) and takes up the 10-s tick.
4. Verification: read `/mnt/us/refresh.log` from the Mac.
