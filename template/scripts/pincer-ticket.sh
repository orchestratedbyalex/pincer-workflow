#!/bin/bash
# PINCER ticket state machine — the ONLY writer of a ticket's state fields
# (status / started / verified / finished). Works on every platform; on Claude
# Code a PreToolUse hook (.claude/hooks/ticket-guard.sh) blocks hand edits of
# those fields so "done" can only be reached through a passing check.
#
#   scripts/pincer-ticket.sh start  T-03   open -> in_progress; refuses while a depends_on ticket isn't done
#   scripts/pincer-ticket.sh verify T-03   runs the ticket's Verification block; exit 0 stamps a receipt
#   scripts/pincer-ticket.sh done   T-03   needs a receipt matching the current Verification block
#                                          and no unticked acceptance criteria; in_progress -> done
#
# The receipt is `verified: <UTC time> <12-hex hash of the Verification block>`.
# Change the check after it passed and `done` refuses until it passes again.
# Every attempt revokes its predecessor; done runs a fresh final check.
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pincer-ticket-lib.sh"

ROOT=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
cd "$ROOT"

die() { printf 'pincer-ticket: %b\n' "$*" >&2; exit 1; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }


fm_set() { # file key value — replace inside the frontmatter (keeping an inline comment) or add before the closing ---
  local tmp; tmp=$(mktemp)
  awk -v k="$2" -v v="$3" '
    NR == 1 { print; next }
    !closed && !done && index($0, k ":") == 1 {
      c = $0; if (sub(/^[^#]*#/, "#", c)) print k ": " v "   " c; else print k ": " v
      done = 1; next
    }
    !closed && $0 == "---" { if (!done) print k ": " v; closed = 1 }
    { print }' "$1" > "$tmp" && mv "$tmp" "$1"
}

fm_unset() {
  local tmp; tmp=$(mktemp)
  awk -v k="$2" 'NR > 1 && $0 == "---" { closed = 1 }
    !closed && index($0, k ":") == 1 { next } { print }' "$1" > "$tmp" && mv "$tmp" "$1"
}

cmd_bind() {
  local f ref existing
  f=$(ticket_file "$1"); ref=$2
  validate_prd "$ref" || exit 1
  existing=$(fm_get "$f" prd)
  [ -z "$existing" ] || [ "$existing" = "$ref" ] || die "$1 already references $existing; refusing to rebind it to $ref"
  [ "$existing" = "$ref" ] || fm_set "$f" prd "$ref"
  echo "$1 bound to PRD $ref"
}

cmd_start() {
  local f id st dep df ref dep_ref readiness
  f=$(ticket_file "$1"); id=$(normalize "$1"); st=$(fm_get "$f" status)
  ref=$(usable_ticket_prd "$f") || exit 1
  case "$st" in
    in_progress)
      [ -n "$(fm_get "$f" prd)" ] || fm_set "$f" prd "$ref"
      echo "$id already in progress (started $(fm_get "$f" started))"; return 0 ;;
    done) die "$id is already done" ;;
  esac
  for dep in $(fm_get "$f" depends_on | grep -oE 'T-[0-9]+' || true); do
    df=$(ticket_file "$dep")
    [ "$(fm_get "$df" status)" = done ] || die "$id depends on $dep, which is '$(fm_get "$df" status)' — finish $dep first (or fix depends_on in $f)"
    dep_ref=$(usable_ticket_prd "$df") || exit 1
    [ "$dep_ref" = "$ref" ] || die "$id references $ref but dependency $dep references $dep_ref"
    if ! readiness=$(ticket_readiness "$df"); then die "$id depends on $dep: $readiness"; fi
  done
  [ -n "$(fm_get "$f" prd)" ] || fm_set "$f" prd "$ref"
  fm_set "$f" status in_progress
  [ -n "$(fm_get "$f" started)" ] || fm_set "$f" started "$(now)"
  echo "▶ $id started $(fm_get "$f" started) — $f"
}

cmd_verify() {
  local f id st cmds rc hash child
  f=$(ticket_file "$1"); id=$(normalize "$1"); st=$(fm_get "$f" status)
  usable_ticket_prd "$f" >/dev/null || exit 1
  case "$st" in
    open) cmd_start "$id" ;;
    done) echo "$id is done — re-running its check and updating the latest outcome" ;;
  esac
  cmds=$(verification_cmds "$f")
  fm_unset "$f" verified
  hash=$(verify_hash "$f")
  fm_set "$f" last_check "$(now) running $hash"
  printf '%s\n' "$cmds" | grep -vE '^[[:space:]]*(#|$)' >/dev/null || die "no runnable command in the Verification block of $f"
  echo "── $id verification ──"
  printf '%s\n' "$cmds" | sed 's/^/  $ /'
  bash -eo pipefail -c "$cmds" & child=$!
  trap 'kill "$child" 2>/dev/null || true; fm_set "$f" last_check "$(now) interrupted $hash"; exit 130' INT TERM
  set +e; wait "$child"; rc=$?; set -e
  trap - INT TERM
  if [ "$rc" -ne 0 ]; then
    fm_set "$f" last_check "$(now) failed $hash"
    echo "✗ $id verification FAILED (exit $rc) — failure recorded in last_check of $f; any prior successful receipt was revoked. Fix, then re-run verify." >&2
    exit "$rc"
  fi
  if [ "$hash" != "$(verify_hash "$f")" ]; then
    fm_set "$f" last_check "$(now) failed $hash"
    die "Verification block changed during execution — re-run verify"
  fi
  if ! validate_ticket "$f" || ! usable_ticket_prd "$f" >/dev/null; then
    fm_set "$f" last_check "$(now) failed $hash"
    die "ticket became invalid during verification — fix it and re-run verify"
  fi
  fm_set "$f" last_check "$(now) passed $hash"
  fm_set "$f" verified "$(now) $hash"
  echo "✓ $id verified — receipt: $(fm_get "$f" verified)"
}

cmd_done() {
  local f id st rec cur u slug
  f=$(ticket_file "$1"); id=$(normalize "$1"); st=$(fm_get "$f" status)
  usable_ticket_prd "$f" >/dev/null || exit 1
  [ "$st" = in_progress ] || [ "$st" = done ] || die "$id is '$st' — run '$0 verify $id' first"
  rec=$(fm_get "$f" verified)
  [ -n "$rec" ] || die "no verification receipt on $id — run '$0 verify $id' and get a green check first"
  cur=$(verify_hash "$f")
  [ "${rec##* }" = "$cur" ] || die "receipt hash ${rec##* } does not match the current Verification block ($cur): the check changed after it passed — run '$0 verify $id' again"
  u=$(unticked "$f")
  [ -z "$u" ] || die "unticked acceptance criteria on $id:\n$u\nTick each verified criterion; a criterion that was cut is a scope change to record in the PRD, not a box to skip."
  cmd_verify "$id"
  u=$(unticked "$f")
  [ -z "$u" ] || die "unticked acceptance criteria on $id after verification:\n$u"
  [ "$st" = done ] && { echo "$id already done — current check passed"; return 0; }
  fm_set "$f" status done
  fm_set "$f" finished "$(now)"
  slug=$(basename "$f" .md); slug=${slug#T-[0-9][0-9]-}
  echo "✓ $id done. Inspect staged work, stage only this ticket's paths, review git diff --cached, then commit: $id: ${slug//-/ }"
}

case "${1:-}" in
  start|verify|done|bind) validate_ticket_set || exit 1 ;;
esac

case "${1:-}" in
  start)  [ $# -eq 2 ] || die "usage: $0 start T-NN";  cmd_start "$2" ;;
  verify) [ $# -eq 2 ] || die "usage: $0 verify T-NN"; cmd_verify "$2" ;;
  done)   [ $# -eq 2 ] || die "usage: $0 done T-NN";   cmd_done "$2" ;;
  bind)   [ $# -eq 3 ] || die "usage: $0 bind T-NN .prd/prd-vN.md"; cmd_bind "$2" "$3" ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
