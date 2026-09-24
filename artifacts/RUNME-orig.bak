#!/bin/sh

LOG=/mnt/us/http-test.log
URL='http://192.168.178.108:5678/webhook/last-rabbit-recognition-frame'
OUT=/mnt/us/dashboard.png
TMP=${OUT}.tmp

{
  echo "=== HTTP test $(date) ==="
  uname -a

  BB=''
  for CANDIDATE in /bin/busybox /usr/bin/busybox; do
    if [ -x "$CANDIDATE" ]; then
      BB="$CANDIDATE"
      break
    fi
  done

  if [ -z "$BB" ]; then
    echo "RESULT=NO_BUSYBOX"
    exit 10
  fi

  echo "BUSYBOX=$BB"
  "$BB" --list 2>&1 | grep -x wget
  if [ $? -ne 0 ]; then
    echo "RESULT=NO_WGET_APPLET"
    exit 11
  fi

  # WLAN einschalten und höchstens ca. 90 Sekunden auf Verbindung warten.
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>&1
  I=0
  while [ "$I" -lt 30 ]; do
    STATE=$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)
    echo "WIFI[$I]=$STATE"
    echo "$STATE" | grep -qi CONNECTED && break
    sleep 3
    I=$((I + 1))
  done

  rm -f "$TMP"
  "$BB" wget -O "$TMP" "$URL"
  RC=$?
  echo "WGET_RC=$RC"
  ls -l "$TMP" 2>&1

  if [ "$RC" -ne 0 ] || [ ! -s "$TMP" ]; then
    rm -f "$TMP"
    echo "RESULT=DOWNLOAD_FAILED"
    exit 12
  fi

  # PNG-Signatur: 89 50 4e 47 0d 0a 1a 0a
  SIG=$(od -An -tx1 -N8 "$TMP" 2>/dev/null | tr -d ' \n')
  echo "PNG_SIG=$SIG"
  if [ "$SIG" != "89504e470d0a1a0a" ]; then
    rm -f "$TMP"
    echo "RESULT=NOT_A_PNG"
    exit 13
  fi

  mv -f "$TMP" "$OUT"
  /usr/sbin/eips "$OUT"
  echo "RESULT=OK"
} >"$LOG" 2>&1
