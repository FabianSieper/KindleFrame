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
| `artifacts/jailbreak/kual-mrpi/` | ~5 MB | MRInstaller (KUAL) bundle for the device |
| `artifacts/emergency.sh` | 394 B | **Production launcher** (executed by the stock `mkk/bridge.conf` `pre-start` hook on every boot): waits for `eips` (≤30 s), double-forks `refresh.sh` (detached — survives the upstart job ending) |
| `artifacts/.boot` | 510 B | **Legacy** early-phase boot hook (waits for `eips`+`lipc-set-prop`, `nohup`s `refresh.sh`, logs to `/mnt/us/boot.log`) — **not used** by the current boot path (field: no `boot.log` after 2 reboots); kept for reference, do not deploy |

## Important properties / limitations

- **ROM partition stays read-only** — the jailbreak only modifies the runtime environment; `/usr/sbin/eips` & co. come from ROM and are **not** copyable to the card. `[verified]` (no `/mnt/us/eips*` anymore, system eips untouched)
- **No update to 5.14+** possible without losing the jailbreak — firmware pinning documented as a deliberate limitation.
- `exec` from `/mnt/us` does not work directly (FAT mount) → staging to `/tmp` (tmpfs) — built into `refresh.sh` v4 (size check → re-stage). `[verified]`
- BusyBox superset on the device: `sh`, `wget`, coreutils, `grep`/`sed`/`awk` — enough for all shell work; everything binary is an own, statically linked Go binary.
- Boot chain (field-verified): the jailbreak ships the **stock** `mkk/bridge.conf` (NiLuJe/WatchThis rev. 17398) whose `pre-start` hook natively executes `/mnt/us/emergency.sh` (detect → `chmod +x` → exec → `return 0`); the project's `emergency.sh` (in `artifacts/`) starts `refresh.sh`. No custom Upstart config is needed. The custom `.boot` from the early phase is legacy and not used (see table above).

## Recovery (if ever needed)

1. Format the card fresh (FAT) → place `watchthis-release/KV/Update_hotfix_watchthis_custom.bin` as the update bin on the card root.
2. Put the Kindle with the card inserted into update mode (hold Power+Center) → boot → hotfix installs.
3. Then redeploy `emergency.sh`/`refresh.sh`/`dash` (all in `artifacts/`).
