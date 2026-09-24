# 02 — Jailbreak (WatchThis)

## What & when

- **Tool:** WatchThis (Legacy/Nosebleed), release tree `watchthis-release` with one hotfix bin per model code (KOA1–3, KT2–4, KV, PW2–5).
- **Model code:** `KV` (Kindle Voyage).
- **Firmware:** 5.13.6 (jailbreaks without updating to 5.14+, where the legacy chain breaks).
- **Performed:** 21.09.2026 (hotfix phase) — result: estimated "100 %" capability, i.e. full userland writable + executable on `/mnt/us` (via staging), `busybox`, `wget`, `/dev/fb0` mmap, `eips`.
- **On-device verification** (21.09): hotfix bin present, `refresh.sh` runs after reboot, `wget` PoC green, `dash` staged + executable. `[verified]` (logs + card inventory)

## Artifacts (in repo)

| Path | Size | Purpose |
|---|---|---|
| `artifacts/jailbreak/watchthis/watchthis-release/` | ~1 MB | Full WatchThis release tree (all model bins + README) — reference |
| `artifacts/jailbreak/watchthis-jailbreak-r03.zip` | 646,247 B | Original jailbreak archive from the device (card copy) |
| `artifacts/jailbreak/kindle-fertig/` | 172 K | "Done package" of the 21.09 session: `01-jailbreak/` + `02-hotfix/Update_hotfix_watchthis_custom.bin` + `README.txt` |
| `artifacts/jailbreak/kual-mrpi/` | 5.5 MB | MRInstaller (KUAL) bundle for the device |
| `artifacts/jailbreak/Update_hotfix_watchthis_custom.bin` | 153,817 B | **The** installed custom hotfix (SHA-256 `2102e30fb2fb645c32e03bda8144903484d564e6934824a8797089779c063284`), SP01 signature |
| `artifacts/jailbreak/kindle-eink-artefakte.zip` | 269,748 B | Zip of the local `kindle-eink/` test phase (22./23.09) |
| `artifacts/.boot` | 510 B | Boot hook: waits for `eips`+`lipc-set-prop` (max ~120 s), starts `refresh.sh` via `nohup`, logs to `/mnt/us/boot.log` |

## Important properties / limitations

- **ROM partition stays read-only** — the jailbreak only modifies the runtime environment; `/usr/sbin/eips` & co. come from ROM and are **not** copyable to the card. `[verified]` (no `/mnt/us/eips*` anymore, system eips untouched)
- **No update to 5.14+** possible without losing the jailbreak — firmware pinning documented as a deliberate limitation.
- `exec` from `/mnt/us` does not work directly (FAT mount) → staging to `/tmp` (tmpfs) — built into `refresh.sh` v4 (size check → re-stage). `[verified]`
- BusyBox superset on the device: `sh`, `wget`, coreutils, `grep`/`sed`/`awk` — enough for all shell work; everything binary is an own, statically linked Go binary.
- Boot-hook history: the jailbreak ships `emergency.sh` + `mkk/bridge.conf` (Upstart config for the emergency boot hook) `[recalled]`; the project's active hook is the custom `.boot` (see table above).

## Recovery (if ever needed)

1. Format the card fresh (FAT) → place `watchthis-release/KV/Update_hotfix_watchthis_custom.bin` as the update bin on the card root.
2. Put the Kindle with the card inserted into update mode (hold Power+Center) → boot → hotfix installs.
3. Then redeploy `refresh.sh`/`dash`/`.boot` (all in `artifacts/`).
