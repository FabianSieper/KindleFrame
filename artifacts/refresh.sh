#!/bin/sh
# refresh.sh v9 — Kindle Voyage live dashboard via dash (static Go binary)
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
# v8 (27.09 — T25, ISSUES I14): fb snapshot diff — LOG-ONLY PoC
#  An accidental tap on the capacitive touchscreen (or a button press)
#  makes the Kindle UI paint the home screen over our image; since the loop
#  renders only on content change, the overpaint persists. v8 detects
#  it: after EVERY successful render, snapshot the raw panel buffer
#  (dash fbdump -> $FB_BASE in /tmp, tmpfs — no SD wear); every 10s
#  tick, re-dump + byte-compare (cmp -s) against that baseline.
#  MATCH = the image holds; CHANGED = something painted over it
#  (logged every tick + archived to $FB_DIR on SD ONCE per transition,
#  rotated to FB_KEEP files of ~3.1 MB — the only pull path for pixel
#  data: /tmp is tmpfs and is invisible via USB). v8 NEVER re-renders
#  (zero flicker risk); v9 will re-render on CHANGED (rate-limited:
#  >=60s between restores, <=3/h, 10s check cadence -> latency ~10-20s).
# v9 (28.09 — T25 action, ISSUES I14): restore a stable overpaint
#  v8's fb snapshot diff now ACTS on its finding. Baseline = the raw
#  panel buffer after our last successful render (FB_BASE). Each tick we
#  also compare against the PREVIOUS tick's dump (FB_PREV) to detect any
#  content change (a tap / button press / navigation). A restore fires
#  only when the panel is NOT our baseline AND has stayed stable
#  (unchanged) for >= STABLE_WINDOW seconds — i.e. the user has STOPPED
#  interacting for 30s (28.09 request: "nach 30 Sekunden soll das
#  dashboard wieder ... mit dem zuletzt geladenen bild ueberlagert
#  werden"): the image returns 30s after the last tap, and every new
#  tap/navigation restarts that window. Limits: >= RESTORE_COOLDOWN
#  (60s) between restores, <= RESTORE_MAX_H (3) per rolling hour.
#  Self-healing: if the UI re-overpaints after a restore, the next 30s of
#  stability triggers another restore (bounded by the limits).
#  AUTO_RESTORE=0 reverts to the v8 log-only PoC.

# dash get <out> <urls...>: fetch (first URL wins), verify PNG, decode to
#   single-IDAT grayscale PNG — write only, NO display
# dash render <file>: display the PNG via eips (EPDC wave — the only visible path)

URLS='REPLACE_WITH_WEBHOOK_URL'
OUT=/tmp/dashboard.png
CACHE=/mnt/us/dashboard.png
PIDFILE=/tmp/refresh.pid
LOG=/mnt/us/refresh.log
# T20: downscale + black letterbox (0..1; 1.0 = full size, no margin; T21: 0.95)
export DASH_SCALE=0.95
# T25 (v8): fb snapshot diff (see the v8 header block above).
# FB_BASE = raw panel buffer dump right after our last successful
# render (the baseline); every tick re-dumps to FB_CUR and compares.
# FB_STATE = match|chg — archive only on the match->chg transition
# (a persistent overpaint must not rewrite 3.1 MB to SD every 10s).
FB_BASE=/tmp/kf_fb_base.raw
FB_CUR=/tmp/kf_fb_cur.raw
FB_DIR=/mnt/us/kf_fb
FB_KEEP=8
FB_STATE=
# v9 (T25 action): FB_PREV = previous tick's dump (content-change
# detector); FB_LAST_CHANGE = epoch when the panel content last changed
# (the stability anchor); RESTORE_LAST = epoch of the last restore;
# RESTORES_H = rolling-hour list of restore epochs (rate limit);
# STABLE_WINDOW / RESTORE_COOLDOWN / RESTORE_MAX_H = the limits;
# AUTO_RESTORE = 1 act / 0 = v8 log-only PoC.
FB_PREV=/tmp/kf_fb_prev.raw
FB_LAST_CHANGE=
RESTORE_LAST=0
RESTORES_H=
STABLE_WINDOW=30
RESTORE_COOLDOWN=60
RESTORE_MAX_H=3
AUTO_RESTORE=1
RESTORE_BLOCK_LOGGED=0

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
  # T25 (v8): after a successful render, snapshot the raw panel
  # buffer (the overpaint-diff baseline). fb_snap always returns 0,
  # so the rc a caller sees is unchanged; a failed render still
  # propagates its rc.
  [ $? -eq 0 ] && fb_snap
}
# T25 (v8): bounded SD archive of fb dumps (rotated to FB_KEEP
# files, ~3.1 MB each — ~25 MB total on SD). /tmp is tmpfs
# (invisible via USB) — this is the only pull path for pixel data.
# Best effort: always returns 0 (never fails the caller).
fb_archive() {
  mkdir -p "$FB_DIR" 2>/dev/null
  TS=$(date +%s 2>/dev/null)
  case "$TS" in ''|*[!0-9]*) TS=0 ;; esac
  F="$FB_DIR/$2_$TS.raw"
  if cp -f "$1" "$F" 2>/dev/null; then
    ls -1t "$FB_DIR"/*.raw 2>/dev/null | tail -n +$((FB_KEEP + 1)) | while IFS= read -r OLD; do
      rm -f "$OLD" 2>/dev/null
    done
    SZ=$(wc -c < "$F" 2>/dev/null | tr -d ' ')
    if command -v sha256sum >/dev/null 2>&1; then
      log "fb archive $F $SZ bytes sha256=$(sha256sum "$F" 2>/dev/null | cut -c1-12)"
    else
      log "fb archive $F $SZ bytes (no sha256sum)"
    fi
  fi
  return 0
}

# T25 (v8): snapshot the raw panel buffer into FB_BASE (the
# baseline) — called from render() after eips rc=0. Best effort:
# always returns 0. (Boot-window race: the UI could paint between
# the eips return and our dump; rare, accepted for the PoC — a v9
# restore re-render heals the steady state.)
fb_snap() {
  "$DASH" fbdump "$FB_BASE" >> "$LOG" 2>&1 || return 0
  fb_archive "$FB_BASE" base
  FB_STATE=match
  return 0
}

# T25 (v9): every 10s tick — re-dump the panel buffer into FB_CUR and
# compare it with (a) the previous tick's dump (FB_PREV: a content
# change (re)sets the stability anchor) and (b) the post-render
# baseline (FB_BASE: are we still showing our image?). v9 ACTS: a
# stable overpaint (CHANGED vs baseline for >= STABLE_WINDOW) triggers
# a rate-limited restore re-render (>= RESTORE_COOLDOWN apart, <=
# RESTORE_MAX_H per rolling hour). The baseline is NOT rotated on
# CHANGED on purpose — it keeps naming "our last rendered state" until
# the next render resets it (a persistent overpaint must keep reading
# CHANGED). A MATCH does not clear the anchor (a stable panel keeps
# growing its stability window). AUTO_RESTORE=0 reverts to the v8
# log-only PoC. Always returns 0 (a failed fbdump never kills the loop).
fb_check() {
  command -v cmp >/dev/null 2>&1 || return 0
  NOW=$(date +%s 2>/dev/null)
  case "$NOW" in ''|*[!0-9]*) NOW= ;; esac
  "$DASH" fbdump "$FB_CUR" >> "$LOG" 2>&1 || return 0
  [ -s "$FB_CUR" ] || return 0
  # (a) content change vs the previous tick's dump: (re)set the
  # stability anchor. A MATCH leaves the anchor untouched. FB_PREV
  # empty = first tick, nothing to compare yet.
  if [ -s "$FB_PREV" ] && [ -n "$NOW" ] && ! cmp -s "$FB_PREV" "$FB_CUR" 2>/dev/null; then
    FB_LAST_CHANGE=$NOW
  fi
  [ -s "$FB_BASE" ] || { mv -f "$FB_CUR" "$FB_PREV" 2>/dev/null; return 0; }
  # (b) overpaint vs the post-render baseline
  if cmp -s "$FB_BASE" "$FB_CUR" 2>/dev/null; then
    # the image holds (or a restore just painted it back)
    log "fb check MATCH"
    FB_STATE=match
    RESTORE_BLOCK_LOGGED=0
  else
    # we no longer show our image (tap / button press / boot UI)
    [ "$FB_STATE" != chg ] && fb_archive "$FB_CUR" chg
    FB_STATE=chg
    # fallback anchor: a static overpaint that produced no cur-vs-prev
    # change event still gets a stability window from now
    [ -z "$FB_LAST_CHANGE" ] && [ -n "$NOW" ] && FB_LAST_CHANGE=$NOW
    if [ -n "$NOW" ]; then
      ST=$((NOW - FB_LAST_CHANGE))
    else
      ST=0
    fi
    log "fb check CHANGED (stable ${ST}s)"
    if [ "$AUTO_RESTORE" = 1 ] && [ -n "$NOW" ] && [ "$ST" -ge "$STABLE_WINDOW" ]; then
      # prune the rolling hour of restores + count (rate limit)
      NH=""
      for T in $RESTORES_H; do
        if [ "$T" -gt $((NOW - 3600)) ]; then
          NH="$NH $T"
        fi
      done
      RESTORES_H=$NH
      NR=$(echo "$NH" | wc -w | tr -d ' ')
      [ -n "$NR" ] || NR=0
      if [ "$NOW" -le $((RESTORE_LAST + RESTORE_COOLDOWN)) ]; then
        [ "$RESTORE_BLOCK_LOGGED" != 1 ] && log "restore BLOCKED (cooldown ${RESTORE_COOLDOWN}s)"
        RESTORE_BLOCK_LOGGED=1
      elif [ "$NR" -ge "$RESTORE_MAX_H" ]; then
        [ "$RESTORE_BLOCK_LOGGED" != 1 ] && log "restore BLOCKED (rate limit ${RESTORE_MAX_H}/h)"
        RESTORE_BLOCK_LOGGED=1
      else
        log "restore: overpaint stable ${ST}s -> re-render"
        render
        RC=$?
        log "restore render rc=$RC"
        if [ "$RC" -eq 0 ]; then
          RESTORES_H="$RESTORES_H $NOW"
          RESTORE_LAST=$NOW
          RESTORE_BLOCK_LOGGED=0
          RENDERED=$(cksum "$OUT" 2>/dev/null)
        fi
      fi
    fi
  fi
  # remember this tick's dump as the previous one for the next tick
  mv -f "$FB_CUR" "$FB_PREV" 2>/dev/null
  return 0
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
log "v9 start pid=$$"
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

  # T25 (v9): overpaint check — runs every tick (10s). A stable
  # overpaint (>= STABLE_WINDOW) triggers a rate-limited restore
  # re-render (see the v9 header block); AUTO_RESTORE=0 = log-only.
  fb_check
  sleep 10
done