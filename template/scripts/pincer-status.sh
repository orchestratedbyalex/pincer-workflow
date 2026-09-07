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

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pincer-ticket-lib.sh"
ROOT=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
cd "$ROOT"
BUDGET=${PINCER_BUILD_BUDGET_MIN:-75}
NOW=$(date -u +%s)

to_epoch() { # ISO-8601 UTC -> seconds (GNU date, then BSD date)
  date -u -d "$1" +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null || echo 0
}
mins() { echo "$(( ($2 - $1) / 60 ))m"; }
hhmm() { [ -n "$1" ] && printf '%s' "$1" | cut -c12-16 || printf '—'; }

echo "PINCER status · $(date -u +%Y-%m-%dT%H:%MZ) · $ROOT"

# ── PRD ──
if ! prd=$(latest_prd 2>&1); then
  printf 'WARN     invalid PRD: %s\n' "$prd"
  echo 'Next     repair PRD input before continuing'
  exit 1
fi
prd_status=""
if [ -z "$prd" ]; then
  echo "PRD      none"
else
  prd_status=$(fm_get "$prd" status)
  echo "PRD      $prd · status: ${prd_status:-?} · date: $(fm_get "$prd" date)"
fi

# Reject malformed/ambiguous tickets instead of treating unknown states as open.
if ! errors=$(validate_ticket_set 2>&1); then
  printf 'WARN     invalid tickets: %s\n' "$errors"
  echo "Next     repair ticket input before continuing"
  exit 1
fi

# ── Tickets ──
n_open=0; n_prog=0; n_done=0; first_start=""; in_prog=""; next_open=""; warn=""; reverify=""
files=""; historical=0; unresolved=0
for f in tickets/T-*.md; do
  [ -e "$f" ] || continue
  if ! associated=$(ticket_prd "$f" 2>&1); then
    printf 'WARN     unresolved ticket PRD: %s\n' "$associated"
    unresolved=$((unresolved + 1)); continue
  fi
  if [ "$associated" = "$prd" ]; then
    files="$files$f
"
  else
    historical=$((historical + 1))
  fi
done
[ "$historical" -eq 0 ] || echo "History  $historical ticket(s) associated with other PRDs"
if [ -z "$files" ]; then
  echo "Tickets  none"
else
  rows=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    id=$(fm_get "$f" ticket); [ -n "$id" ] || id=$(basename "$f" | cut -c1-4)
    st=$(fm_get "$f" status); size=$(fm_get "$f" size)
    started=$(fm_get "$f" started); verified=$(fm_get "$f" verified); finished=$(fm_get "$f" finished)
    attempt=$(fm_get "$f" last_check)
    if [ -n "$attempt" ] && ! printf '%s' "$attempt" | grep -q ' passed '; then
      warn="$warn  WARN $id latest verification: $attempt — re-run verify\n"
    fi
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
        if ! readiness=$(ticket_readiness "$f"); then
          warn="$warn  WARN $id $readiness\n"
          reverify="$reverify $id"
        fi
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
          df=$(ticket_file "$d" 2>/dev/null || true)
          if [ -z "$df" ] || [ "$(fm_get "$df" status)" != done ] ||
             ! usable_ticket_prd "$df" >/dev/null 2>&1 || ! ticket_readiness "$df" >/dev/null; then
            blocked="$blocked $d"
          fi
        done
        if [ -n "$blocked" ]; then detail="blocked by${blocked}"; else detail="ready"; [ -n "$next_open" ] || next_open=$id; fi
        ;;
    esac
    rows="$rows$(printf '  %-5s %-12s %-2s %s' "$id" "$st" "${size:-?}" "$detail")\n"
  done <<< "$files"
  echo "Tickets  $((n_open + n_prog + n_done)) total · $n_done done · $n_prog in progress · $n_open open"
  printf '%b' "$rows"
  printf '%b' "$warn"
  if [ -n "$first_start" ]; then
    echo "Build    elapsed $(mins "$first_start" "$NOW") since the first ticket started · budget ${BUDGET}m"
  fi
fi

notes_valid=no
if notes=$(notes_current "$prd"); then notes_valid=yes; fi
echo "Notes    NOTES.md: $notes"

# ── Next action ──
if [ -z "$prd" ]; then
  next="/pincer-plan <brief> — no PRD yet"
elif [ "$unresolved" -gt 0 ]; then
  next="resolve PRD association with pincer-ticket.sh bind T-NN .prd/prd-vN.md before continuing"
elif [ "$prd_status" = draft ]; then
  next="/pincer-narrow — current PRD is draft; earlier tickets and notes do not complete it"
elif [ -z "$files" ]; then
  next="/pincer-narrow — PRD exists, no tickets yet"
elif [ -n "$in_prog" ]; then
  next="resume${in_prog}: /pincer-code${in_prog} (check git status for uncommitted work; then verify → done)"
elif [ "$n_open" -gt 0 ]; then
  next="/pincer-code — next ready ticket: ${next_open:-none (all remaining are blocked — check depends_on)}"
elif [ -n "$reverify" ]; then
  next="/pincer-code — re-run verify for${reverify}; resolve readiness warnings before evaluation or release"
elif [ "$notes_valid" = no ] || [ "$prd_status" != built ]; then
  next="/pincer-evaluate — all tickets done"
  [ "$prd_status" = built ] || next="$next (PRD status is '${prd_status:-?}', expected 'built')"
else
  next="/pincer-release — evaluation matches the current PRD and candidate; audit the artifacts"
fi
echo "Next     $next"
[ "$unresolved" -eq 0 ] || exit 1
