#!/bin/sh
# Boot hook: starts refresh.sh after system is ready
LOG=/mnt/us/boot.log
echo "$(date) boot hook triggered" > "$LOG"

# Wait for system to be ready (eips + WiFi stack)
I=0
while [ "$I" -lt 60 ]; do
  if [ -x /usr/sbin/eips ] && command -v lipc-set-prop >/dev/null 2>&1; then
    break
  fi
  sleep 2
  I=$((I + 2))
done
echo "$(date) system ready after ${I}s" >> "$LOG"

# Start refresh loop in background
nohup /mnt/us/refresh.sh >> "$LOG" 2>&1 &
echo "$(date) refresh.sh started pid=$!" >> "$LOG"
