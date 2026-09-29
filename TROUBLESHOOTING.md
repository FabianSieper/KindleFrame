# TROUBLESHOOTING — Fehlerfälle und Lösungen

Alle dokumentierten Probleme, ihre Ursache und die Lösung.

---

## PNG wird als „Zoom" / vergrößertes Crop angezeigt

**Symptom:** Das Bild zeigt nur einen kleinen Ausschnitt, stark vergrößert, statt das gesamte Dashboard.

**Ursache:** `eips` liest nur den **ersten IDAT-Chunk** einer PNG-Datei. Enthält das PNG mehrere IDAT-Chunks (z. B. Go `image/png` Encoder mit ~32 KB Blöcken), wird nur der erste Teil gelesen und auf den gesamten Framebuffer skaliert.

**Lösung:** Das PNG muss **genau 1 IDAT-Chunk** enthalten. Im n8n-Workflow stellt Sharp dies standardmäßig sicher. Falls ein anderer Encoder verwendet wird:

```sh
# Prüfung auf dem Mac:
python3 -c "
import struct, sys
with open(sys.argv[1], 'rb') as f:
    chunks = []
    while True:
        h = f.read(8)
        if len(h) < 8: break
        length, type_ = struct.unpack('>I4s', h)
        type_ = type_.decode('ascii')
        chunks.append(type_)
        f.read(length + 4)  # data + CRC
    print(f'IDAT chunks: {chunks.count(\"IDAT\")}')
    print(f'Alle Chunks: {chunks}')
" dein_bild.png
```

**Erfolgreich:** `IDAT chunks: 1`

> **Detail:** `docs/03-eink-rendering.md` §Die zwei harten Anforderungen

---

## Bild zerläuft / farbig / verzerrt

**Symptom:** Das Bild ist farbig, zerläuft oder zeigt Artefakte statt ein sauberes Graustufenbild.

**Ursache:** `eips` erwartet **IHDR color type 0** (8-bit Grayscale). RGB-Bilder (color type 2) werden falsch decodiert — die Farbkanäle werden als Grauwerte interpretiert.

**Lösung:** Das PNG muss im **Grayscale-Farbraum** sein. Im n8n-Workflow:

```javascript
// Sharp-Node (Edit Image):
{
  "greyscale": true,
  "format": "png"
}
```

**Prüfung:**

```sh
# IHDR-Color-Type prüfen (Byte 25, Index 24-25 im IHDR):
python3 -c "
with open('bild.png', 'rb') as f:
    f.seek(25)
    ct = f.read(1)[0]
    print(f'Color type: {ct} (0=Grayscale, 2=RGB)')
"
```

---

## Kein Bild nach Reboot

**Symptom:** Nach einem Neustart bleibt das Display schwarz oder zeigt den Kindle-Home-Screen statt des Dashboards.

**Mögliche Ursachen und Lösungen:**

### 1. `.boot`-Trigger nicht konfiguriert

`refresh.sh` wird nicht automatisch gestartet.

**Lösung:** `.boot` auf `/mnt/us/.boot` kopieren (aus `artifacts/`).

### 2. `~ds` nicht eingegeben

Nach einem Reboot wird der Screensaver-Schalter zurückgesetzt. Das Gerät schläft ein, der Loop friert.

**Lösung:** In der Suchleiste `~ds` eingeben + Enter. Nach jedem Reboot neu.

### 3. Boot-Window-Overpaint (v9)

Die Kindle-UI malt den Home-Screen wenige Sekunden nach dem Boot über das Dashboard-Bild.

**Lösung:** `refresh.sh` v9 enthält **Boot-Window-Re-Renders** (+20s/+60s/+150s/+300s nach Boot) und **Auto-Restore** (fb-Snapshot-Diff). Beide Mechanismen heilen das Problem automatisch. In den Logs sichtbar als `boot window re-render` und `restore: overpaint stable … → re-render`.

---

## Device schläft ein / Loop friert

**Symptom:** `refresh.log` zeigt keine neuen Einträge über längere Zeit. Das Gerät ist im Deep Sleep.

**Ursache:** Der `refresh.sh`-Loop läuft nur, solange das Device wach ist. Im Deep Sleep friert er ein (resumiert beim Aufwachen).

**Lösung:**
1. `~ds` in der Suchleiste eingeben (Screensaver deaktivieren, Device wach halten)
2. Nach jedem Reboot neu eingeben
3. Alternativ: Device manuell aufwecken → Loop startet neu

> **Hinweis:** Es gibt keinen script-seitigen Keep-Awake-Mechanismus.

---

## WiFi beim Wake nicht verfügbar

**Symptom:** `refresh.log` zeigt `dl rc=1` mit `ENETUNREACH` nach einem Wake-Event.

**Ursache:** WiFi-Reconnect-Delay — beim Aufwachen ist die Netzwerkverbindung noch nicht hergestellt. Beobachtet bei mehreren Wake-Events.

**Lösung:** Kein Eingriff nötig. Der Loop versucht alle ~5 Minuten erneut. Sobald WiFi verfügbar ist, wird das nächste Bild geladen.

---

## Button-Druck malt das Bild weg (steady state)

**Symptom:** Nach Drücken einer physischen Taste verschwindet das Dashboard-Bild und der Kindle-Home-Screen erscheint.

**Ursache:** Die Kindle-UI repaintet das Framebuffer bei Button-Events. Da `refresh.sh` nur bei Content-Change rendert, bleibt das Übermalken bestehen.

**Lösung (v9):** **Auto-Restore** — nach 30 Sekunden Inaktivität (kein weiterer Button-Druck) wird das letzte Bild automatisch wiederhergestellt. Rate-Limit: max. 3 Restore pro Stunde, 60s Cooldown.

**Deaktivieren:** `AUTO_RESTORE=0` in `refresh.sh` setzen.

> **Detail:** `SETUP.md` §Schritt 7

---

## `eips -b` (BMP-Modus) funktioniert nicht

**Symptom:** Versuch, ein BMP via `eips -b` anzuzeigen, hat keine sichtbare Wirkung.

**Ursache:** `eips -b` ist auf der Voyage ein **NO-OP**. Nur `eips -g <png>` (PNG-Modus) funktioniert.

**Lösung:** Ausschließlich PNG verwenden.

---

## Orientation falsch (Bild gedreht)

**Symptom:** Das Bild ist um 90° oder 180° falsch gedreht.

**Ursache:** Der Framebuffer der Voyage verwendet `rotate=3` (270°). Die korrekte Transformation für die Anzeige ist **t180** (transpose + 180° = 90° CW + horizontal flip).

**Lösung:** Im n8n-Workflow die Bildausgabe als t180 transformieren. Die `dash`-Binary übernimmt dies automatisch beim Decodieren.

> **Detail:** `docs/03-eink-rendering.md` §Geometry

---

## Build-Fehler: Go 1.24+ auf dem Kindle

**Symptom:** Go 1.24+ Binary crasht auf dem Kindle oder lässt sich nicht bauen.

**Ursache:** Go 1.24+ erfordert Linux Kernel ≥ 3.2. Die Voyage läuft auf Kernel 3.0.35.

**Lösung:** **Go ≤ 1.23** verwenden. Build-Command:

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s" -o dash .
```

---

## `dash` Binary wird nicht ausgeführt (no-exec mount)

**Symptom:** `dash` auf `/mnt/us/` kann nicht ausgeführt werden.

**Ursache:** `/mnt/us/` (FAT32) ist **no-exec** gemountet.

**Lösung:** `refresh.sh` staged die Binary automatisch nach `/tmp/dash` (tmpfs, exec-fähig). Niemals `/mnt/us/dash` direkt ausführen.

---

## Same-Size-Build wird nicht erkannt

**Symptom:** Ein neuer `dash`-Build (gleiche Dateigröße) wird nicht auf dem Device aktualisiert.

**Ursache:** `refresh.sh`'s `restage()` prüft nur die Dateigröße. Gleiche Größe → kein Re-Stage.

**Lösung:** Reboot durchführen → Boot-Re-Stage lädt die neue Version. Oder die `dash`-Binary auf `/mnt/us/dash` manuell ersetzen und rebooten.

---

## n8n-API 401 (API-Key ungültig)

**Symptom:** Workflow-Änderungen via n8n REST API schlagen mit 401 fehl.

**Ursache:** Ungültiger oder abgelaufener API-Key.

**Lösung:** Workflow-Änderungen über die n8n-UI vornehmen. Einen neuen API-Key generieren, falls API-Zugriff nötig.

> **Hinweis:** Dies betrifft nur Workflow-Änderungen via API. Der Webhook-Endpoint funktioniert weiterhin.