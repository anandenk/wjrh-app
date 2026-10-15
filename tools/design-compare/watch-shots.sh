#!/usr/bin/env bash
# Screenshots the booted iOS simulator (or, with ANDROID=1, the connected Android emulator via adb) each time the app logs "[dev-shot N]" (the dev-only route hook in
# apps/mobile/src/reminders/reminders-provider.tsx prints it once each screen has settled).
#
#   watch-shots.sh <file Metro writes its log to> <out-dir> name0 name1 name2 ...
#
# The Nth screenshot is saved as <out-dir>/<name N>.png. Prints "done" after the last one.
LOG="$1"; OUT="$2"; shift 2
NAMES=("$@")
mkdir -p "$OUT"
re='dev-shot ([0-9]+)'
tail -n0 -F "$LOG" | while read -r line; do
  if [[ $line =~ $re ]]; then
    i="${BASH_REMATCH[1]}"
    name="${NAMES[$i]:-shot-$i}"
    if [[ -n "$ANDROID" ]]; then adb exec-out screencap -p > "$OUT/$name.png"; else xcrun simctl io booted screenshot "$OUT/$name.png" >/dev/null 2>&1; fi
    echo "shot $i $name"
    if [[ $((i + 1)) -ge ${#NAMES[@]} ]]; then echo "done"; fi
  fi
done
