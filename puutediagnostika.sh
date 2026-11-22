#!/usr/bin/env bash
set -euo pipefail

repo='nullyks/puutetundliku-ekraani-mangud'
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/puutetundliku-ekraani-mangud"
report="$state_dir/puutediagnostika.md"

send_report() {
  if [[ ! -s "$report" ]]; then
    printf 'Raport puudub. Käivita esmalt bash puutediagnostika.sh.\n' >&2
    return 1
  fi
  if ! command -v gh >/dev/null; then
    printf 'Paigalda GitHub CLI käsuga sudo apt install gh.\n' >&2
    return 1
  fi

  local note=''
  if [[ -t 0 ]]; then
    printf 'Raport lisatakse avalikku GitHubi issue’sse.\n'
    read -r -p 'Mida Chromium näitas? (Enter jätab vahele) ' note
  fi

  {
    if [[ -n "$note" ]]; then
      printf '## Tulemus Chromiumis\n\n%s\n\n' "$note"
    fi
    cat -- "$report"
  } | gh issue create --repo "$repo" --title 'Pi 400 puutediagnostika' --body-file -
}

case "${1:-}" in
  --saada) send_report; exit ;;
  '') ;;
  *) printf 'Kasutus: bash puutediagnostika.sh [--saada]\n' >&2; exit 2 ;;
esac

if ! command -v libinput >/dev/null; then
  printf 'Paigalda libinput käsuga sudo apt install libinput-tools.\n' >&2
  exit 1
fi

sudo -v
mkdir -p -- "$state_dir"
work_dir=$(mktemp -d "$state_dir/.puutediagnostika.XXXXXX")
trap 'rm -f -- "$work_dir/libinput.log" "$work_dir/report.md"; rmdir -- "$work_dir"' EXIT

printf '%s\n' \
  'Sul on 15 sekundit. Jäta hiir paigale.' \
  'Hoia üht sõrme vasakul, lisa teine paremal ja liiguta mõlemat.' \
  'Tõsta parem sõrm üles, siis vasak. Korda katset.'

if sudo timeout --signal=INT --kill-after=2s 15s stdbuf -oL libinput debug-events >"$work_dir/libinput.log"; then
  :
else
  capture_status=$?
  if [[ "$capture_status" -ne 124 ]]; then
    printf 'Puutelogimine ebaõnnestus (väljumiskood %s).\n' "$capture_status" >&2
    exit "$capture_status"
  fi
fi

{
  printf '## Süsteem\n\n```text\n'
  if [[ -r /etc/os-release ]]; then
    sed -n 's/^PRETTY_NAME=//p' /etc/os-release
  fi
  printf 'Linuxi tuum: %s\nTöölauaseanss: %s\n' "$(uname -r)" "${XDG_SESSION_TYPE:-teadmata}"
  if command -v chromium >/dev/null; then
    chromium --version || true
  elif command -v chromium-browser >/dev/null; then
    chromium-browser --version || true
  fi
  printf '```\n\n## Puutelogimise tulemus\n\n```text\n'
  awk '
    $1 ~ /^[-+]?event[0-9]+$/ {
      device = $1
      sub(/^[-+]/, "", device)
      if ($2 == "DEVICE_ADDED") metadata[device] = $0
      button_or_touch = $2 ~ /^(TOUCH_DOWN|TOUCH_UP|POINTER_BUTTON)$/
      first_motion = $2 ~ /^POINTER_MOTION(_ABSOLUTE)?$/ && !motion[device]++
      if (button_or_touch || first_motion) {
        if (!shown[device]++ && device in metadata) print metadata[device]
        print
        count++
      }
    }
    END { if (!count) print "Puutepunkte ega hiirevajutusi ei tuvastatud." }
  ' "$work_dir/libinput.log"
  printf '```\n'
} >"$work_dir/report.md"

mv -f -- "$work_dir/report.md" "$report"
cat -- "$report"
printf '\nRaport salvestati faili %s\nSaatmiseks: bash puutediagnostika.sh --saada\n' "$report"
