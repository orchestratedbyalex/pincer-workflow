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
set -euo pipefail

ROOT=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
cd "$ROOT"

die() { printf 'pincer-ticket: %b\n' "$*" >&2; exit 1; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
sha256() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi; }

normalize() { # T-3 / t-03 / 3 -> T-03
  local n=${1#T-}; n=${n#t-}
  [[ $n =~ ^[0-9]+$ ]] || die "not a ticket id: $1"
  printf 'T-%02d' "$((10#$n))"
}

ticket_file() { # id -> tickets/T-NN-*.md (exactly one)
  local id; id=$(normalize "$1")
  local matches; matches=$(ls "tickets/$id"-*.md 2>/dev/null || true)
  [ -n "$matches" ] || die "no ticket file tickets/$id-*.md"
  [ "$(printf '%s\n' "$matches" | wc -l)" -eq 1 ] || die "several files match tickets/$id-*.md"
  printf '%s' "$matches"
}

fm_get() { # file key -> value with any inline comment stripped; empty if absent
  awk -v k="$2" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, k ":") == 1 {
      v = substr($0, length(k) + 2); sub(/#.*/, "", v)
      gsub(/^[ \t]+|[ \t]+$/, "", v); print v; exit
    }' "$1"
}

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

verification_cmds() { # the fenced block under "## Verification"
  awk '
    /^## Verification/ { inv = 1; next }
    inv && /^## /      { exit }
    inv && /^```/      { if (inb) exit; inb = 1; next }
    inb                { print }' "$1"
}

verify_hash() { verification_cmds "$1" | sha256 | cut -c1-12; }

unticked() { # unticked boxes inside "## Acceptance Criteria"
  awk '
    /^## Acceptance Criteria/ { ina = 1; next }
    ina && /^## /             { exit }
    ina && /^- \[ \]/         { print }' "$1"
}

cmd_start() {
  local f id st dep df
  f=$(ticket_file "$1"); id=$(normalize "$1"); st=$(fm_get "$f" status)
  case "$st" in
    in_progress) echo "$id already in progress (started $(fm_get "$f" started))"; return 0 ;;
    done) die "$id is already done" ;;
  esac
  for dep in $(fm_get "$f" depends_on | grep -oE 'T-[0-9]+' || true); do
    df=$(ticket_file "$dep")
    [ "$(fm_get "$df" status)" = done ] || die "$id depends on $dep, which is '$(fm_get "$df" status)' — finish $dep first (or fix depends_on in $f)"
  done
  fm_set "$f" status in_progress
  [ -n "$(fm_get "$f" started)" ] || fm_set "$f" started "$(now)"
  echo "▶ $id started $(fm_get "$f" started) — $f"
}

cmd_verify() {
  local f id st cmds rc
  f=$(ticket_file "$1"); id=$(normalize "$1"); st=$(fm_get "$f" status)
  case "$st" in
    open) cmd_start "$id" ;;
    done) echo "$id is done — re-running its check (receipt left unchanged)" ;;
  esac
  cmds=$(verification_cmds "$f")
  printf '%s\n' "$cmds" | grep -vE '^[[:space:]]*(#|$)' >/dev/null || die "no runnable command in the Verification block of $f"
  echo "── $id verification ──"
  printf '%s\n' "$cmds" | sed 's/^/  $ /'
  set +e; bash -eo pipefail -c "$cmds"; rc=$?; set -e
  if [ "$rc" -ne 0 ]; then
    echo "✗ $id verification FAILED (exit $rc) — no receipt written. Fix, then re-run." >&2
    exit "$rc"
  fi
  [ "$st" = done ] || fm_set "$f" verified "$(now) $(verify_hash "$f")"
  echo "✓ $id verified — receipt: $(fm_get "$f" verified)"
}

cmd_done() {
  local f id st rec cur u slug
  f=$(ticket_file "$1"); id=$(normalize "$1"); st=$(fm_get "$f" status)
  [ "$st" = done ] && { echo "$id already done"; return 0; }
  [ "$st" = in_progress ] || die "$id is '$st' — run '$0 verify $id' first"
  rec=$(fm_get "$f" verified)
  [ -n "$rec" ] || die "no verification receipt on $id — run '$0 verify $id' and get a green check first"
  cur=$(verify_hash "$f")
  [ "${rec##* }" = "$cur" ] || die "receipt hash ${rec##* } does not match the current Verification block ($cur): the check changed after it passed — run '$0 verify $id' again"
  u=$(unticked "$f")
  [ -z "$u" ] || die "unticked acceptance criteria on $id:\n$u\nTick each verified criterion; a criterion that was cut is a scope change to record in the PRD, not a box to skip."
  fm_set "$f" status done
  fm_set "$f" finished "$(now)"
  slug=$(basename "$f" .md); slug=${slug#T-[0-9][0-9]-}
  echo "✓ $id done. Commit it with the code: git add -A && git commit -m \"$id: ${slug//-/ }\""
}

case "${1:-}" in
  start)  [ $# -eq 2 ] || die "usage: $0 start T-NN";  cmd_start "$2" ;;
  verify) [ $# -eq 2 ] || die "usage: $0 verify T-NN"; cmd_verify "$2" ;;
  done)   [ $# -eq 2 ] || die "usage: $0 done T-NN";   cmd_done "$2" ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
