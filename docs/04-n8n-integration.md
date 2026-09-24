# 04 — n8n integration

## Access

- **n8n instance:** Docker on host `automation.sieper.uk` (LAN IP 192.168.178.108, container 172.20.0.3). Mac: 192.168.178.132.
- **Workflow:** `Rabbit Recognition (Discord)` · ID `Y6YLPaL7w3XFX4-RlygeH` · active (13 nodes in the canonical dump).
- **Webhook endpoint:** `/webhook/last-rabbit-recognition-frame` (the second webhook node for Flow B serves the same path; its UUID is the secondary one).
- **Canonical export (sanitized):** `n8n/rabbit-recognition-workflow.json` (API dump 23.09.2026 09:03Z)
- **History:** `n8n/history/` (BEFORE/AFTER-20260923, live-current 08:40Z, current 09:03Z, put-pass) — all sanitized.

### Flows

**Flow A (Discord → frame):**
```
Discord (webhook, "Hase erkannt" message)
  → Hase erkannt (IF: message contains "Hase erkannt")
  → Read File ($json['output-file'] from the Discord node)
  → Edit Image (Sharp): resize 1448×1072
  → Edit Image 2  ← in the 09:03Z state: env probe (450 chars)
  → Respond to Webhook (200, binary "image", Content-Type image/png, no-store)
```

**Flow B (cache):** `Schedule Trigger (5 min)` → `Read File` (second, older frame) → `Respond to Webhook` (same webhook, then serves the cache).

## Node detail (relevant parameters)

- `Edit Image`: `operation=resize`, `width=1448`, `height=1072`, `inputFieldName=image`, `outputFieldName=image`.
- `Edit Image 2` **chronology** (this is the 3-day chaos node, → `ISSUES.md` I2/I5):
  1. `rotate: 90` (Sharp) = t180 (transpose+180° = 90° CW + horizontal flip)
  2. **Gold code** `t180-n8n.js` (14,565 B, `n8n/code/`): manual PNG writer (transposed pixels + 180° flip), sandbox-verified byte-exact vs `golden_t180.png` (28,052,160 pixels, PASS) — **never deployed** (API key 401)
  3. `rotate: 270` (dump 08:40Z)
  4. Env probe (450 chars, dump 09:03Z = last state in the repo) — inserted because **code nodes do not run at all on this n8n instance** (execution error, 0 node executions).
- `Respond to Webhook`: `respondWith=binary`, `inputFieldName=image`, `responseCode=200`, header `Cache-Control: no-store`, `Content-Type: image/png`.

## What the webhook does **not** do (and why that's ok)

- **No grayscale, no single-IDAT** — n8n `Edit Image` (Sharp) has no grayscale operation; the code-node path got stuck (401). The webhook delivers RGB 1072×1448 (19 IDAT, 585–601 KB).
- **That is ok in the final architecture:** `dash` converts on the device (I10). n8n grayscale stays optional (I10 step 7).

## Sanitizing note (mandatory for every future n8n change)

All JSONs in the repo have the originals replaced by placeholders:

| Original (abridged) | Placeholder |
|---|---|
| Discord credential ID (`p6Ke…`) | `REPLACE_WITH_YOUR_DISCORD_CREDENTIAL_ID` |
| Credential display name ("Hasi…") | `REPLACE_WITH_YOUR_CREDENTIAL_NAME` |
| Webhook UUID primary (`2f87…`) | `REPLACE_WITH_WEBHOOK_UUID_1` |
| Webhook UUID secondary (`8458…`) | `REPLACE_WITH_WEBHOOK_UUID_2` |

**Before commit** always grep for the full original strings (credential ID, both webhook UUIDs, credential name) — the result must be empty. New dumps must be sanitized **before** storage (same 4 replacements). LAN IPs in shell scripts/logs are infrastructure, not secrets — leave them.

## Open (n8n-side)

- `[open]` **API key (401)** never solved → workflow changes via API blocked; the user's UI changes are the path. Until then `Edit Image 2` stays in probe state (harmless: delivers JSON instead of binary → Flow A no longer answers correctly; Flow B/cache + the device path keep running).
- `[open]` Code nodes do not run on this instance (execution error) — investigate if grayscale-per-n8n (I10-7) is wanted.
- `[open]` Optional: deploy `t180-n8n.js` via UI (pixel-exact, but still RGB/multi-IDAT → only for orientation, not for eips compatibility).
- `[open]` Optional (I10-7): grayscale code node (replaces `t180`, delivers 1-IDAT grayscale → relieves `dash`).
