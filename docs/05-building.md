# 05 — Go-Build-Anleitung für ARM-Static-Binary

Dieses Dokument beschreibt, wie die `dash`-Binary für das Kindle Voyage gebaut wird.

## Voraussetzungen

- **Go ≤ 1.23** (zwingend — Go 1.24+ erfordert Linux Kernel ≥ 3.2, Kindle-Kernel ist 3.0.35)
- Mac oder Linux als Build-Host
- `src/kindle-dash/` als Arbeitsverzeichnis

## Build

```sh
cd src/kindle-dash/

# Toolchain erzwingen (verhindert, dass Homebrew GOROOT shadowt)
export GOTOOLCHAIN=local
env -u GOROOT

# Statische ARM-Binary bauen
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s" -o dash .
```

## Ergebnis

- **Dateiname:** `dash`
- **Größe:** ~5,18 MB (5,177,496 B)
- **Format:** Statische ARM-ELF-Binary, keine dynamischen Abhängigkeiten
- **Toolchain:** Go 1.23.12

## Deployment

```sh
# Binary auf die SD-Karte kopieren
cp dash /Volumes/Kindle/dash
chmod 755 /Volumes/Kindle/dash
```

> **Hinweis:** `/mnt/us/` ist **no-exec** gemountet. `refresh.sh` staged die Binary automatisch nach `/tmp/dash` (tmpfs, exec-fähig). Niemals `/mnt/us/dash` direkt ausführen.

## Same-Size-Builds

Wenn ein neuer Build die **gleiche Dateigröße** hat wie die vorhandene Binary, erkennt `refresh.sh`'s `restage()`-Funktion den Wechsel nicht (Größenbasiert).

**Lösung:** Reboot durchführen → Boot-Re-Stage lädt die neue Version.

## Projektstruktur

```
src/kindle-dash/
├── go.mod          # Modul-Definition (Go 1.23)
├── main.go         # Hauptprogramm: GET + Render-Commands
├── convert.go      # saveKindlePNG, Floyd-Steinberg Grayscale, bilinear Downscale
├── render.go       # eips-Ausführung (EPDC-Wave)
├── fb_linux.go     # Linux-FB-Implementierung (eips exec)
├── fb_stub.go      # Mac-Stub (PGM-Output für Entwicklung)
├── fbdump_linux.go # Framebuffer-Read (Auto-Restore, v9)
├── fbdump_stub.go  # Mac-Stub für fbdump
├── convert_test.go # Tests für Konvertierungsfunktionen
├── main_test.go    # Tests für Hauptprogramm
└── fbdump_test.go  # Tests für fbdump
```

**Flat layout:** Alle Dateien im root des Moduls, kein `cmd/`-Unterverzeichnis.

## Wichtige Implementierungsdetails

### `saveKindlePNG`

Schreibt ein PNG mit exakt **1 IDAT-Chunk** und **color type 0** (Grayscale). Verwendet `compress/zlib` über den gesamten Rohpuffer — nicht `image/png` (blockiert bei ~32 KB → 48 IDAT-Chunks).

### `bilinearGray`

Manueller clamped bilinear Downscale. Die Go 1.23.12-Toolchain (hash-verifiziert) shippt ein pre-1.12-era `image/draw` ohne Scaling-Operationen (`draw.ApproxBiLinear` nicht verfügbar).

### `DASH_SCALE`

Umgebungsvariable (float 0…1, Standard 1.0). Bei Wert < 1: bilinear Downscale + schwarzer Letterbox. Finaler Wert: **0.95** (~10% schwarzer Rand).

## Tests

```sh
cd src/kindle-dash/
go test -v ./...
```

Alle Tests müssen auf dem Build-Host (Mac/Linux) bestehen. Die Binary läuft nur auf dem Kindle (ARM-Linux).