#!/bin/sh
# refresh.sh v6 — Kindle Voyage live dashboard via dash (static Go binary)
# 10s tick | download every 300s | render ONLY on image change (cksum)
# NOTE: ticks advance only while the device is AWAKE — in deep sleep the loop
# freezes between wakes (resumes on wake). For a fresh dashboard keep the
# device awake: Settings -> Device -> Stay Awake. (User setting only — no
# verified script-level keep-awake mechanism exists.)
# dash get <out> <urls...>: fetch (first URL wins), verify PNG, decode to
#   single-IDAT grayscale PNG — write only, NO display
# dash render <file>: display the PNG via eips (EPDC wave — the only visible path)

URLS='https://automation.sieper.uk/webhook/last-rabbit-recognition-frame http://192.168.178.108:5678/webhook/last-rabbit-recognition-frame'
OUT=/tmp/dashboard.png
CACHE=/mnt/us/dashboard.png
PIDFILE=/tmp/refresh.pid
LOG=/mnt/us/refresh.log
# T20: downscale + black letterbox (0..1; 1.0 = full size, no margin; T21: 0.95)
export DASH_SCALE=0.95

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
# re-stage if the source binary's size changed (hot-apply future updates).
# NOTE: a same-SIZE replacement is not detected (T20 build == T16 size). At
# boot /tmp is empty, so the staged copy always equals /mnt/us/dash after a
# reboot — and every deploy includes a reboot anyway.
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
log "v6 start pid=$$"

if [ ! -s "$OUT" ] && [ -s "$CACHE" ]; then
  cp -f "$CACHE" "$OUT"
  log "boot: restored cache"
fi

RENDERED=
if png_valid "$OUT"; then
  log "boot render"
  render
  RC=$?
  log "boot render rc=$RC"
  [ "$RC" -eq 0 ] && RENDERED=$(cksum "$OUT" 2>/dev/null)
else
  log "boot: no valid cached image yet"
fi

lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null

tick=0
while true; do
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
  tick=$((tick + 1))
  restage

  if [ $((tick % 30)) -eq 0 ]; then
    do_download
    # v5: render only on image change (cksum, v2-proven pattern) — no forced
    # 30s re-render, so the screen stays still while the feed is unchanged
    # (no idle flicker). get() writes atomically (tmp+rename), so a changed
    # $OUT is always complete.
    NEW=$(cksum "$OUT" 2>/dev/null)
    if [ -n "$NEW" ] && [ "$NEW" != "$RENDERED" ] && png_valid "$OUT"; then
      log "image changed, render"
      render
      RC=$?
      log "render rc=$RC"
      [ "$RC" -eq 0 ] && RENDERED=$NEW
    fi
  fi

  sleep 10
done
