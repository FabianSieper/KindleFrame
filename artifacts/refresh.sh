#!/bin/sh
# refresh.sh v4 — Kindle Voyage live dashboard via dash (static Go binary)
# 10s tick | forced re-render every 30s | download every 300s
# dash get <out> <urls...>: fetch (first URL wins), verify PNG, decode, render on change
# dash render <file>: convert cached PNG to /dev/fb0

URLS='https://automation.sieper.uk/webhook/last-rabbit-recognition-frame http://192.168.178.108:5678/webhook/last-rabbit-recognition-frame'
OUT=/tmp/dashboard.png
CACHE=/mnt/us/dashboard.png
PIDFILE=/tmp/refresh.pid
LOG=/mnt/us/refresh.log

# Orientation overrides (uncomment if the image lands flipped; no rebuild needed):
# export DASH_FLIPY=1   # flip vertically (upside-down)
# export DASH_FLIPX=1   # flip horizontally (mirrored)

if [ -f "$PIDFILE" ]; then
  OLD=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
    kill "$OLD" 2>/dev/null
    sleep 1
  fi
fi
echo $$ > "$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT

log() {
  echo "$(date) $*" >> "$LOG" 2>/dev/null
}

# --- stage binary: /mnt/us (FAT) -> /tmp (tmpfs, always exec) ---
DASH_SRC=/mnt/us/dash
DASH=/tmp/dash
# re-stage if the source binary's size changed (hot-apply future updates)
restage() {
  CS=$(wc -c < "$DASH_SRC" 2>/dev/null | tr -d ' ')
  CL=$(wc -c < "$DASH" 2>/dev/null | tr -d ' ')
  if [ -z "$CS" ] || [ "$CS" != "$CL" ]; then
    cp -f "$DASH_SRC" "$DASH" 2>/dev/null && chmod +x "$DASH" 2>/dev/null && log "staged dash size $CS"
  fi
}
restage

png_sig_ok() {
  [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]
}

png_dims_ok() {
  WH=$(od -An -tx1 -j16 -N8 "$1" 2>/dev/null | tr -d ' \n')
  [ "$WH" = "00000430000005a8" ] || [ "$WH" = "000005a800000430" ]
}

png_valid() {
  [ -s "$1" ] && png_sig_ok "$1" && png_dims_ok "$1"
}

render() {
  "$DASH" render "$OUT" >> "$LOG" 2>&1
}

do_download() {
  "$DASH" get "$OUT" $URLS >> "$LOG" 2>&1
  RC=$?
  if [ "$RC" -eq 0 ] && png_valid "$OUT"; then
    cp -f "$OUT" "$CACHE" 2>/dev/null
    log "dl ok"
  else
    log "dl rc=$RC"
  fi
}

# --- Boot: stage binary, restore cache, render ---
if [ ! -x "$DASH" ]; then
  log "FATAL: dash binary missing"
  exit 1
fi
log "v4 start pid=$$"

if [ ! -s "$OUT" ] && [ -s "$CACHE" ]; then
  cp -f "$CACHE" "$OUT"
  log "boot: restored cache"
fi

if png_valid "$OUT"; then
  log "boot render"
  render
  log "boot render rc=$?"
else
  log "boot: no valid cached image yet"
fi

lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null

tick=0
while true; do
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
  tick=$((tick + 1))
  restage

  if [ $((tick % 3)) -eq 0 ] && png_valid "$OUT"; then
    render
  fi

  if [ $((tick % 30)) -eq 0 ]; then
    do_download
  fi

  sleep 10
done
