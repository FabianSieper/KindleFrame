#!/bin/sh
exec >/dev/null 2>&1

# Boot launcher — triggered by hotfix kmc.conf upstart job at framework_ready.
# Double-forks refresh.sh so it survives the upstart job exiting.

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

i=0
while [ $i -lt 30 ]; do
  if [ -x /usr/sbin/eips ]; then
    break
  fi
  sleep 1
  i=$((i+1))
done

( /mnt/us/refresh.sh >/dev/null 2>&1 & ) &