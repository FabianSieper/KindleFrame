# KindleFrame

Ein 24/7 E-Ink-Dashboard auf einem jailbreakten **Kindle Voyage (KV)** — angetrieben durch **n8n**.

**Ziel:** Der Kindle zeigt als Wand-„Rahmen" permanent das neueste Bild einer n8n-Workflow-Pipeline (Kaninchen-Erkennung) und aktualisiert es im Hintergrund — komplett ohne Mac (kein Proxy, kein Samba, kein SSH).

## Architektur

```
n8n-Workflow (Webhook)
  → PNG (Grayscale, 1 IDAT, 1448×1072)
    → refresh.sh (wget + cksum-Prüfung)
      → dash render (eips EPDC-Update)
        → E-Ink-Display (Bistabil — Bild hält ohne Strom)
```

| Komponente | Rolle |
|---|---|
| `dash` (Go-Binary) | Fetch + Grayscale-Konvertierung + PNG-Encoding + eips-Render + fb-Snapshot-Diff |
| `refresh.sh` (v9) | POSIX-sh-Loop: 10s-Tick, Download alle 300s, Render nur bei Bildwechsel, Auto-Restore nach UI-Overpaint |
| `eips` (System) | E-Ink-Panel-Controller, EPDC-Wellen, framebuffer-Update |
| n8n-Workflow | Bildquelle: Canvas → Sharp-Resize → Grayscale → PNG → Webhook |

## Repository-Struktur

| Pfad | Inhalt |
|---|---|
| `SETUP.md` | Schritt-für-Schritt-Deployment auf einem neuen Kindle |
| `TROUBLESHOOTING.md` | Alle aufgetretenen Fehlerfälle und deren Lösungen |
| `docs/01-hardware.md` | Hardware-Specs, Framebuffer-Geometrie, Dateisystem |
| `docs/02-jailbreak.md` | WatchThis-Jailbreak-Anleitung |
| `docs/03-eink-rendering.md` | eips-Constraints, PNG-Regeln, E-Ink-Physik |
| `docs/04-n8n-integration.md` | n8n-Workflow-Einrichtung und PNG-Formatierung |
| `docs/05-building.md` | Go-Build-Anleitung für ARM-Static-Binary |
| `src/kindle-dash/` | Go-Quellcode (flat layout, Go ≤1.23) |
| `artifacts/` | Bereit-zum-Deploy-Dateien (sanitized) |
| `n8n/` | Sanitized n8n-Workflow-Export |
| `n8n/code/t180-n8n.js` | Gold-Code für t180-Bildtransformation (pure-JS PNG-Pipeline; Sandbox-Test PASS, nie live deployed — 401 API-Key) |

## Status

**Version v9 deployed und produktiv.** Alle Deployment-Schritte abgeschlossen und verifiziert.

Offen: T18/T19 (n8n-seitige Grayscale-Konvertierung) — blockiert auf n8n-API-Key (401).

## Wichtige Hinweise

- **Kein freies Terminal auf dem Device:** Alle Interaktion via MRPI (`;log`, `;get`) und Dateien auf `/mnt/us/`
- **Keine Secrets im Repo:** Alle Webhook-URLs, Hostnamen und Credential-IDs sind als Platzhalter markiert
- **Keine persönlichen Daten:** Serial-Nummern, Account-IDs und Hostnamen sind anonymisiert
- **Pfad-Regel:** Alle Pfade sind relativ (repo-relativ oder `~`-relativ). Device-interne Pfade (`/mnt/us/`, `/tmp`, `/usr/sbin/eips`) und Standard-Mounts (`/Volumes/Kindle`) sind Ausnahmen