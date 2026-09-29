# SETUP — Deployment auf einem neuen Kindle Voyage

Diese Anleitung beschreibt den kompletten Weg von einem sauberen Kindle Voyage bis zum laufenden Dashboard.

## Voraussetzungen

- Kindle Voyage (KV, 7th gen, 2014)
- Firmware **5.13.6** (nicht 5.14+ — dort bricht die Legacy-Jailbreak-Kette)
- Mac oder Linux-Rechner mit USB-Anschluss
- n8n-Instanz (lokal oder gehostet) mit aktivem Workflow
- Go 1.23.x (für eigenen Build) — **nicht** 1.24+ (erfordert Linux ≥3.2, Kindle-Kernel ist 3.0.35)

---

## Schritt 1: Jailbreak (WatchThis Legacy)

**Dauer:** ~15 Minuten

1. WatchThis Legacy herunterladen (Release-Tree mit Hotfix-Bins pro Modellcode)
2. Modellcode für Voyage: **`KV`**
3. Hotfix-Binary (`Update_hotfix_watchthis_custom.bin`) auf die SD-Karte kopieren:
   ```
   /mnt/us/Update/Update_hotfix_watchthis_custom.bin
   ```
4. Kindle über `Einstellungen → Update` starten
5. Nach dem Neustart sollte der Jailbreak aktiv sein:
   - `/mnt/us/` voll beschreibbar und executable
   - `busybox`, `wget` verfügbar
   - `/dev/fb0` mmap-fähig
   - `eips`-Binary verfügbar

**Verifikation:** KUAL/MRPI über USB verbinden → `;log` und `;get` funktionieren.

> **Detail:** `docs/02-jailbreak.md`

---

## Schritt 2: Dateisystem vorbereiten

Auf dem Kindle (über USB-Mount `/Volumes/Kindle` oder direkt `/mnt/us/`):

```sh
# Verzeichnis für Logs anlegen (tmpfs, keine FAT32-Wear)
mkdir -p /tmp/kindle-dash

# Arbeitsverzeichnis auf FAT-Partition
mkdir -p /mnt/us/.kindle-dash
```

---

## Schritt 3: `dash`-Binary deployen

### Option A: Vorgebautes Binary verwenden

Das Binary `artifacts/binaries/dash` (Go 1.23.12, ARM static, ~5 MB) ist bereit:

```sh
# Auf die SD-Karte kopieren
cp artifacts/binaries/dash /Volumes/Kindle/dash
chmod 755 /Volumes/Kindle/dash
```

### Option B: Eigenen Build erstellen

```sh
cd src/kindle-dash/
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s" -o dash .
```

Ergebnis: Statische ARM-Binary, ~5 MB, keine Abhängigkeiten.

> **Build-Regel:** Go ≤1.23 zwingend. Go 1.24+ linkt gegen neuere glibc und crasht auf Kernel 3.0.35.

> **Detail:** `docs/05-building.md`

---

## Schritt 4: `refresh.sh` konfigurieren und deployen

### 4a. Platzhalter ersetzen

Datei `artifacts/refresh.sh` — folgende Platzhalter mit eigenen Werten ersetzen:

| Platzhalter | Wert |
|---|---|
| `REPLACE_WITH_WEBHOOK_URL` | Vollständige n8n-Webhook-URL (z. B. `https://dein-n8n.host/webhook/...`) |

### 4b. Auf die Karte kopieren

```sh
cp artifacts/refresh.sh /Volumes/Kindle/refresh.sh
chmod 700 /Volumes/Kindle/refresh.sh
```

### 4c. Boot-Trigger einrichten

Die Datei `.boot` auf `/mnt/us/.boot` triggert `refresh.sh` beim Neustart:

```sh
cp artifacts/.boot /Volumes/Kindle/.boot
```

> **Achtung:** Der Inhalt von `.boot` muss den Pfad zu `refresh.sh` enthalten und vom Kindle-Boot-Prozess ausgeführt werden können. Den genauen Mechanismus über KUAL/MRPI konfigurieren.

---

## Schritt 5: n8n-Workflow einrichten

### 5a. Workflow importieren

`n8n/rabbit-recognition-workflow.json` in die n8n-Instanz importieren.

### 5b. Platzhalter ersetzen

Im Workflow folgende Werte anpassen:

| Platzhalter | Wert |
|---|---|
| `REPLACE_WITH_WEBHOOK_UUID_1` | Webhook-UUID für Discord-Ausgang |
| `REPLACE_WITH_YOUR_DISCORD_CREDENTIAL_ID` | Discord-Bot-API-Credential-ID |
| `REPLACE_WITH_YOUR_CREDENTIAL_NAME` | Credential-Name |

### 5c. PNG-Formatierung im Workflow

**Hinweis:** `dash` konvertiert das vom Webhook gelieferte PNG **auf dem Device** in das korrekte Format (Grayscale, 1 IDAT). Der n8n-Workflow **darf** RGB mit mehreren IDAT-Chunks senden — die Konvertierung übernimmt `dash`.

**Empfehlung:** n8n sollte trotzdem folgende Empfehlungen beachten (reduziert Dateigröße, entlastet das Device):

| Empfehlung | Wert | Grund |
|---|---|---|
| **Farbraum** | Grayscale (IHDR color type `00`) | Reduziert Dateigröße; ohne Grayscale rendert `dash` korrekt, aber die Datei ist größer |
| **IDAT-Chunks** | Genau **1** IDAT | Sharp macht das standardmäßig; ohne 1 IDAT rendert `dash` korrekt, aber die Datei ist größer |
| **Auflösung** | 1448×1072 Pixel (Framebuffer-Rotation) | Passt exakt auf den E-Ink-Framebuffer |
| **Bit-Tiefe** | 8-bit | E-Ink-Display unterstützt 256 Graustufen |
| **Interlace** | 0 (keine) | Nicht erforderlich, vereinfacht Decodierung |

**n8n-Implementierung (Sharp-Bildverarbeitung):**

```javascript
// Im n8n „Edit Image"-Node (Sharp):
{
  "resize": {
    "width": 1448,
    "height": 1072
  },
  "greyscale": true,
  "format": "png",
  "png": {
    "compressionLevel": 9  // Maximale Kompression → kleinere Datei
  }
}
```

**Wichtig:** Sharp schreibt standardmäßig Grayscale-PNGs mit 1 IDAT — das passt. Falls du einen anderen Encoder verwendest, die Empfehlungen oben als Richtwert nehmen; `dash` korrigiert Formatabweichungen device-seitig.

> **Detail:** `docs/04-n8n-integration.md` §PNG-Formatierung

### 5d. Workflow aktivieren

Workflow in n8n aktivieren und den Webhook-Endpoint testen:

```sh
# Vom Kindle aus (über MRPI oder .boot):
wget -O /tmp/test.png "REPLACE_WITH_WEBHOOK_URL"
# Prüfen: Datei existiert, Größe > 0
```

---

## Schritt 6: Erstes Deployment testen

### 6a. Manuelles Starten

```sh
# Auf dem Kindle (über MRPI oder SSH, falls verfügbar):
sh /mnt/us/refresh.sh &
```

### 6b. Logs überprüfen

```sh
# refresh.log — Download- und Render-Status
cat /mnt/us/refresh.log

# diag.log — eips-Return-Codes und Dauer
cat /mnt/us/diag.log
```

**Erwartete Ausgabe:**
- `dl ok ...` — Download erfolgreich
- `render rc=0` — eips-Render erfolgreich
- `image changed` — Bildwechsel erkannt

### 6c. Display überprüfen

- Bild sollte vollständig sichtbar sein (kein Zoom, keine Verzerrung)
- Orientierung: Landschaftsmodus, Text lesbar
- Kein Flicker beim Render

---

## Schritt 7: Auto-Restore konfigurieren (v9)

Die v9 von `refresh.sh` enthält einen **Auto-Restore-Mechanismus** gegen UI-Overpaint (Kindle-UI malt nach dem Boot oder bei Button-Druck über das Dashboard-Bild).

### Konfiguration (in `refresh.sh`)

| Variable | Standard | Wirkung |
|---|---|---|
| `AUTO_RESTORE` | `1` | `0` = Auto-Restore deaktivieren |
| `RESTORE_COOLDOWN` | `60` | Sekunden zwischen zwei Restore-Versuchen |
| `RESTORE_MAX_PER_HOUR` | `3` | Max. Restore-Versuche pro Stunde |
| `RESTORE_SETTLE` | `30` | Sekunden Wartezeit nach Change-Detektion vor Restore |

### Verhalten

1. Nach jedem eigenen Render wird ein Framebuffer-Snapshot gespeichert (`/tmp/kindle-dash/fb-snapshot`)
2. Alle 10 Sekunden wird ein neuer Snapshot gemacht und mit dem Baseline verglichen
3. Bei Unterschied (UI-Overpaint) wird nach `RESTORE_SETTLE` Sekunden (Stabilitäts-Check) das Bild neu gerendert
4. Rate-Limiting: Max. 3 Restore pro Stunde, 60s Cooldown zwischen Versuchen

> **Hinweis:** Der Auto-Restore verbraucht bei aktivem Overpaint ~3 Render pro 10 Minuten. Im Normalbetrieb (kein Overpaint) ist der Overhead minimal (~25ms pro fb-Read).

---

## Schritt 8: Device wach halten

**Das Dashboard funktioniert nur, wenn das Device wach bleibt.** Im Deep-Sleep friert der `refresh.sh`-Loop ein (resumiert beim Aufwachen).

### KEEP AWAKE (manuell, nach jedem Reboot neu)

1. Auf dem Kindle die **Suchleiste** öffnen
2. `~ds` eingeben und Enter drücken
3. Der Screensaver aktiviert sich nicht mehr, das Device bleibt wach

**Nebenwirkung:** Manueller Short-Press-Bildschirm-Schaltungs-Stopp funktioniert nicht mehr.

> **Wichtig:** `~ds` wird nach einem Reboot zurückgesetzt — nach jedem Neustart neu eingeben. Es gibt keinen script-seitigen Keep-Awake-Mechanismus.

---

## Schritt 9: Neustart testen

1. Kindle neu starten
2. Warten bis `refresh.sh` über `.boot` gestartet wird
3. Nach ~5-10 Sekunden sollte das erste Bild erscheinen
4. Nach ~20-60 Sekunden kann ein zweites Render erfolgen (Boot-Window-Re-Render, v9)
5. Auto-Restore übernimmt falls UI-Overpaint auftritt

---

## Fehlerbehebung

Alle dokumentierten Fehlerfälle und Lösungen: **`TROUBLESHOOTING.md`**

Häufigste Probleme:
- **Bild zeigt Zoom/Vergrößerung** → PNG hat mehrere IDAT-Chunks (Regel 2 verletzt)
- **Bild zerläuft/farbig** → PNG ist RGB statt Grayscale (Regel 1 verletzt)
- **Kein Bild nach Reboot** → `.boot`-Trigger nicht konfiguriert oder `~ds` nicht eingegeben
- **Deep-Sleep-Probleme** → Device schläft ein → Loop friert ein → `~ds` neu eingeben