#!/bin/bash
# PINCER status — where the workflow stands, read from the artifacts on disk.
# Read-only. Every playbook runs this first; /pincer-status wraps it.
#
#   scripts/pincer-status.sh
#
# Elapsed times come from the `started` / `finished` stamps that
# scripts/pincer-ticket.sh writes, i.e. from the clock — never estimated.
# Build budget: PINCER_BUILD_BUDGET_MIN (default 75).
set -uo pipefail

ROOT=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
cd "$ROOT"
BUDGET=${PINCER_BUILD_BUDGET_MIN:-75}
NOW=$(date -u +%s)

fm_get() { # file key -> value with any inline comment stripped; empty if absent
  awk -v k="$2" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, k ":") == 1 {
      v = substr($0, length(k) + 2); sub(/#.*/, "", v)
      gsub(/^[ \t]+|[ \t]+$/, "", v); print v; exit
    }' "$1"
}
to_epoch() { # ISO-8601 UTC -> seconds (GNU date, then BSD date)
  date -u -d "$1" +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null || echo 0
}
mins() { echo "$(( ($2 - $1) / 60 ))m"; }
hhmm() { [ -n "$1" ] && printf '%s' "$1" | cut -c12-16 || printf '—'; }

echo "PINCER status · $(date -u +%Y-%m-%dT%H:%MZ) · $ROOT"

# ── PRD ──
prd=$(ls .prd/prd-v*.md 2>/dev/null | sort -V | tail -1 || true)
prd_status=""
if [ -z "$prd" ]; then
  echo "PRD      none"
else
  prd_status=$(fm_get "$prd" status)
  echo "PRD      $prd · status: ${prd_status:-?} · date: $(fm_get "$prd" date)"
fi

# ── Tickets ──
n_open=0; n_prog=0; n_done=0; first_start=""; in_prog=""; next_open=""; warn=""
files=$(ls tickets/T-[0-9]*.md 2>/dev/null | sort || true)
if [ -z "$files" ]; then
  echo "Tickets  none"
else
  rows=""
  for f in $files; do
    id=$(fm_get "$f" ticket); [ -n "$id" ] || id=$(basename "$f" | cut -c1-4)
    st=$(fm_get "$f" status); size=$(fm_get "$f" size)
    started=$(fm_get "$f" started); verified=$(fm_get "$f" verified); finished=$(fm_get "$f" finished)
    deps=$(fm_get "$f" depends_on | grep -oE 'T-[0-9]+' | tr '\n' ' ' || true)
    if [ -n "$started" ]; then
      se=$(to_epoch "$started")
      [ -z "$first_start" ] || [ "$se" -lt "$first_start" ] && first_start=$se
    fi
    case "$st" in
      done)
        n_done=$((n_done + 1))
        detail="started $(hhmm "$started") · finished $(hhmm "$finished")"
        [ -n "$started" ] && [ -n "$finished" ] && detail="$detail ($(mins "$(to_epoch "$started")" "$(to_epoch "$finished")"))"
        [ -n "$verified" ] || warn="$warn  WARN $id is done without a verification receipt — was it marked done by hand?\n"
        ;;
      in_progress)
        n_prog=$((n_prog + 1)); in_prog="$in_prog $id"
        detail="started $(hhmm "$started")"
        [ -n "$started" ] && detail="$detail · elapsed $(mins "$(to_epoch "$started")" "$NOW")"
        if [ -n "$verified" ]; then detail="$detail · receipt ✓"; else detail="$detail · no receipt yet"; fi
        ;;
      *)
        n_open=$((n_open + 1)); st=${st:-open}
        blocked=""
        for d in $deps; do
          df=$(ls "tickets/$d"-*.md 2>/dev/null | head -1 || true)
          [ -n "$df" ] && [ "$(fm_get "$df" status)" = done ] || blocked="$blocked $d"
        done
        if [ -n "$blocked" ]; then detail="blocked by${blocked}"; else detail="ready"; [ -n "$next_open" ] || next_open=$id; fi
        ;;
    esac
    rows="$rows$(printf '  %-5s %-12s %-2s %s' "$id" "$st" "${size:-?}" "$detail")\n"
  done
  echo "Tickets  $((n_open + n_prog + n_done)) total · $n_done done · $n_prog in progress · $n_open open"
  printf '%b' "$rows"
  printf '%b' "$warn"
  if [ -n "$first_start" ]; then
    echo "Build    elapsed $(mins "$first_start" "$NOW") since the first ticket started · budget ${BUDGET}m"
  fi
fi

[ -f NOTES.md ] && notes=yes || notes=no
echo "Notes    NOTES.md: $notes"

# ── Next action ──
if [ -z "$prd" ]; then
  next="/pincer-plan <brief> — no PRD yet"
elif [ -z "$files" ]; then
  next="/pincer-narrow — PRD exists, no tickets yet"
elif [ -n "$in_prog" ]; then
  next="resume${in_prog}: /pincer-code${in_prog} (check git status for uncommitted work; then verify → done)"
elif [ "$n_open" -gt 0 ]; then
  next="/pincer-code — next ready ticket: ${next_open:-none (all remaining are blocked — check depends_on)}"
elif [ "$notes" = no ]; then
  next="/pincer-evaluate — all tickets done"
  [ "$prd_status" = built ] || next="$next (PRD status is '${prd_status:-?}', expected 'built')"
else
  next="/pincer-release — evaluate has run (NOTES.md exists); audit the artifacts"
fi
echo "Next     $next"
