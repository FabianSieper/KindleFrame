# 04 — n8n Integration

Dieses Dokument beschreibt, wie ein n8n-Workflow so konfiguriert wird, dass er ein PNG liefert, das auf dem Kindle Voyage E-Ink-Display korrekt angezeigt wird.

## Architektur

```
n8n Webhook ──► dash GET (auf dem Kindle, alle 300 s)
                      ├─ Go image/png decode (RGB + multi-IDAT als INPUT ok)
                      ├─ Floyd-Steinberg Grayscale
                      ├─ saveKindlePNG (1 IDAT, color type 0)
                      └─ /mnt/us/dashboard.png
                  dash render → eips -g (EPDC-Wave, sichtbar)
```

**Wichtig:** `dash` konvertiert das vom Webhook gelieferte PNG **auf dem Device** in das korrekte Format. Der n8n-Workflow muss **nicht** Grayscale oder 1-IDAT liefern — er darf RGB mit mehreren IDAT-Chunks senden. Die Konvertierung übernimmt `dash`.

**Empfehlung:** n8n sollte trotzdem Grayscale liefern (reduziert Dateigröße, entlastet das Device). Siehe unten.

---

## Workflow-Struktur

Der Workflow `Rabbit Recognition (Discord)` hat zwei Flows:

### Flow A (Discord → Frame)

```
Discord Webhook (Nachricht "Hase erkannt")
  → IF: Nachricht enthält "Hase erkannt"
  → Read File (Datei aus Discord-Nachricht)
  → Edit Image (Sharp): Resize auf 1448×1072
  → [optional] Edit Image 2: Grayscale
  → Respond to Webhook (200, binary, image/png)
```

### Flow B (Cache)

```
Schedule Trigger (alle 5 min)
  → Read File (älteres Frame)
  → Respond to Webhook (gleicher Webhook-Pfad)
```

---

## PNG-Formatierung für das Kindle-Display

### Regel 1: Grayscale (IHDR color type 0)

`eips` decodiert nur **8-bit Grayscale**. RGB-Bilder (color type 2) führen zu zerlaufenem Bild.

**Sharp-Konfiguration (n8n Edit Image Node):**

```javascript
{
  "operation": "resize",
  "width": 1448,
  "height": 1072,
  "options": {
    "greyscale": true
  }
}
```

**Ohne Grayscale (akzeptabel, aber größer):** `dash` konvertiert auf dem Device. Das PNG ist größer (RGB = 3× Daten), aber `dash` decodiert RGB korrekt und wandelt in Grayscale um.

### Regel 2: Genau 1 IDAT-Chunk

`eips` liest nur den **ersten IDAT-Chunk**. Mehrere Chunks → „Zoom"-Effekt (nur erster Teil wird gelesen und skaliert).

**Sharp-Konfiguration:** Sharp schreibt standardmäßig **1 IDAT-Chunk** bei PNG-Export. Keine zusätzliche Konfiguration nötig.

**Verifikation (Mac/Linux):**

```sh
python3 -c "
import struct, sys
with open(sys.argv[1], 'rb') as f:
    chunks = []
    while True:
        h = f.read(8)
        if len(h) < 8: break
        length, type_ = struct.unpack('>I4s', h)
        chunks.append(type_.decode('ascii'))
        f.read(length + 4)
    idat = chunks.count('IDAT')
    print(f'IDAT: {idat} (muss 1 sein)')
    if idat != 1: print('FEHLER: Bild wird als Zoom-Crop angezeigt!')
" dein_bild.png
```

### Regel 3: Auflösung 1448×1072 Pixel

Das Framebuffer der Voyage ist **1072×1448** (bei `rotate=3` = 270°). Für die korrekte Anzeige muss das PNG **1448×1072** sein (Breite × Höhe).

**Sharp-Konfiguration:**

```javascript
{
  "operation": "resize",
  "width": 1448,
  "height": 1072
}
```

### Regel 4: 8-bit Farbtiefe

E-Ink-Display unterstützt 256 Graustufen.

**Sharp:** Standardmäßig 8-bit bei PNG-Export.

### Regel 5: Kein Interlace

Interlaced PNGs sind nicht erforderlich und vereinfachen die Decodierung.

**Sharp:** Standardmäßig nicht interlaced.

---

## Komplette Sharp-Konfiguration (Empfehlung)

Im n8n `Edit Image`-Node:

```javascript
{
  "operation": "resize",
  "width": 1448,
  "height": 1072,
  "options": {
    "greyscale": true,
    "format": "png",
    "compressionLevel": 9
  }
}
```

Dies liefert ein PNG, das:
- Grayscale ist (color type 0)
- Genau 1 IDAT-Chunk hat
- 1448×1072 Pixel misst
- 8-bit Farbtiefe hat
- Maximal komprimiert ist (kleinste Dateigröße)

---

## Respond to Webhook Node

```
respondWith: binary
inputFieldName: image
responseCode: 200
headers:
  Cache-Control: no-store
  Content-Type: image/png
```

---

## Workflow importieren und konfigurieren

### 1. Workflow importieren

`n8n/rabbit-recognition-workflow.json` in die n8n-Instanz importieren (Setup → Workflows → Import).

### 2. Platzhalter ersetzen

| Platzhalter | Wert |
|---|---|
| `REPLACE_WITH_WEBHOOK_UUID_1` | Webhook-UUID für Discord-Ausgang |
| `REPLACE_WITH_YOUR_DISCORD_CREDENTIAL_ID` | Discord-Bot-API-Credential-ID |
| `REPLACE_WITH_YOUR_CREDENTIAL_NAME` | Credential-Name |

### 3. Webhook-URL notieren

Die Webhook-URL (z. B. `https://dein-n8n.host/webhook/last-rabbit-recognition-frame`) in `artifacts/refresh.sh` eintragen (Platzhalter `REPLACE_WITH_WEBHOOK_URL`).

### 4. Workflow aktivieren

Workflow in n8n aktivieren und testen:

```sh
curl -s "https://dein-n8n.host/webhook/last-rabbit-recognition-frame" -o test.png
# Prüfen: Datei existiert, Größe > 0, PNG-Format
```

---

## Sanitizing (bei Workflow-Exports)

Beim Exportieren von Workflows für das Repository:

1. **Secrets** durch Platzhalter ersetzen (Credential-IDs, Webhook-UUIDs)
2. **Persönliche Daten** entfernen (`shared[]`, `authors`, `personalizationAnswers`)
3. Vor Commit suchen nach Original-Credential-IDs, UUIDs, persönlichen Hostnamen

Siehe `SETUP.md` für Platzhalter-Übersicht.