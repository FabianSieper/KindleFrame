#!/bin/sh
# refresh.sh v7 — Kindle Voyage live dashboard via dash (static Go binary)
# 10s tick | download every 300s | render ONLY on image change (cksum)
# NOTE: ticks advance only while the device is AWAKE — in deep sleep the loop
# freezes (resumes on wake; verified 24.09). KEEP AWAKE — user-verified on
# this device (25.09): tap the SEARCH BAR, type  ~ds  and press Enter -> the
# screensaver never activates, the device stays awake. A REBOOT CANCELS ~ds
# -> re-enter it after every reboot. Side effect: the manual short-press
# screen lock stops working. (No script-level keep-awake mechanism exists —
# do not invent one.)
# v7 (27.09 — T22 + T24):
#  URLS: external endpoint ONLY — the LAN fallback (Mac DHCP IP) is REMOVED
#  (user 27.09: "der Mac soll mit dem Prozess gar nichts zu tun haben").
#  Boot window (T24): the Kindle UI paints the home screen onto the panel a
#  few seconds after boot, overwriting our boot render (user 27.09 round 5:
#  the image simply disappears -> home screen visible; ONLY right after a
#  reboot — steady state is fine). Forced re-renders at +20s/+60s/+150s/
#  +300s after the boot render land AFTER the UI settles; then the image
#  stays until the next image is loaded.
#  Wake re-render (T24): a wall-clock gap > 120s between two ticks = deep-
#  sleep thaw (the thawed process sees the advanced system clock — proven in
#  the wake log lines 24.09 23:43:32Z and 27.09 13:36:28Z). The UI redraws
#  (home screen / screensaver) around a wake (I11) -> re-render now + once
#  after 20s so at least one render lands AFTER the UI paint. (Normal
#  worst-case tick = 45s download timeout [main.go] + 10s sleep < 120s.)
#  NOTE: a same-SIZE binary replacement is not detected (see restage below);
#  every refresh.sh deploy includes a reboot anyway.
# dash get <out> <urls...>: fetch (first URL wins), verify PNG, decode to
#   single-IDAT grayscale PNG — write only, NO display
# dash render <file>: display the PNG via eips (EPDC wave — the only visible path)

URLS='https://automation.sieper.uk/webhook/last-rabbit-recognition-frame'
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
log "v7 start pid=$$"
log "clock check $(date +%s)"

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

# --- v7: wake detection + boot window (see header) ---
NOW0=$(date +%s 2>/dev/null)
BOOT_TS=$NOW0
LAST_TS=$NOW0
WAKE_GAP=120
BURST_DONE=

tick=0
while true; do
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
  tick=$((tick + 1))
  restage

  NOW=$(date +%s 2>/dev/null)
  case "$NOW" in
    ''|*[!0-9]*)
      # date lacks %s support — wake/boot-window timing unavailable;
      # degrade gracefully (main loop + change-only render keep working)
      LAST_TS=
      ;;
    *)
      if [ -n "$LAST_TS" ]; then
        GAP=$((NOW - LAST_TS))
        if [ "$GAP" -gt "$WAKE_GAP" ]; then
          log "wake detected (gap ${GAP}s), re-render"
          render
          RC=$?
          log "wake render rc=$RC"
          [ "$RC" -eq 0 ] && RENDERED=$(cksum "$OUT" 2>/dev/null)
          sleep 20
          render
          RC=$?
          log "wake render 2 rc=$RC"
          [ "$RC" -eq 0 ] && RENDERED=$(cksum "$OUT" 2>/dev/null)
        fi
      fi
      LAST_TS=$NOW

      AGE=$((NOW - BOOT_TS))
      for B in 20 60 150 300; do
        case " $BURST_DONE " in
          *" $B "*) ;;
          *)
            if [ "$AGE" -ge "$B" ]; then
              BURST_DONE="$BURST_DONE $B"
              log "boot window re-render @${B}s"
              render
              RC=$?
              log "boot window render rc=$RC"
              [ "$RC" -eq 0 ] && RENDERED=$(cksum "$OUT" 2>/dev/null)
            fi
            ;;
        esac
      done
      ;;
  esac

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