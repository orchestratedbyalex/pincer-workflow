#!/bin/bash
# Independent replay of the eight PRD v5 review cases on a scratch project built from
# this repository's template/ (the same runtime the packed kit ships).
#
#   bash docs/prd-v5-artifacts/replay.sh <case> [scratch-dir]
#   bash docs/prd-v5-artifacts/replay.sh all
#
# cases: aba | revision | delegated | wrong-change | shared-c01 | crash | no-selection | conflict
#
# Each case builds a fresh project (two PRDs, three tickets, one commit), drives the
# runtime with the same commands a session would run, and asserts the observable
# outcome (exit code, reason code, record content). It prints "ok <case>" or fails with
# the first assertion that does not hold. Nothing outside the scratch directory is
# written. Requires git and Node >= 18.
set -euo pipefail
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CASE=${1:-all}
RT="node scripts/pincer-runtime.cjs"

fail() { echo "FAIL ${CASE}: $*" >&2; exit 1; }
expect_exit() { # expect_exit <code> <pattern-on-stderr> -- <command...>
  local want=$1 pat=$2; shift 3
  local err; set +e; err=$("$@" 2>&1 >/dev/null); local got=$?; set -e
  [ "$got" = "$want" ] || fail "expected exit $want, got $got from: $* — $err"
  [ -z "$pat" ] || grep -q -- "$pat" <<<"$err" || fail "expected '$pat' in stderr of: $* — $err"
}
json() { node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=($1);process.stdout.write(v===undefined?'':String(typeof v==='object'?JSON.stringify(v):v))"; }
digest() { $RT resume --json --change "$1" | json 'j.agreement.current'; }

setup() {
  local dir=$1
  rm -rf "$dir"; mkdir -p "$dir"; cd "$dir"
  git init -q; git config user.name replay; git config user.email replay@example.invalid
  cp -R "$REPO/template/." .
  rm -f AGENTS.md.new* 2>/dev/null || true
  mkdir -p .prd tickets
  printf -- '---\nversion: 1\nstatus: ticketed\ndate: 2026-09-12\n---\n# PRD v1: value\nThe check reads value.txt.\n' > .prd/prd-v1.md
  printf -- '---\nversion: 2\nstatus: ticketed\ndate: 2026-09-12\n---\n# PRD v2: other\nA second change.\n' > .prd/prd-v2.md
  ticket T-01 .prd/prd-v1.md 'test "$(cat value.txt)" = good'
  ticket T-02 .prd/prd-v1.md 'true' T-01
  ticket T-03 .prd/prd-v2.md 'true'
  echo good > value.txt
  git add -A; git commit -qm "replay base"
}
ticket() { # ticket <id> <prd> <command> [dep]
  printf -- '---\nticket: %s\nstatus: open\nsize: S\nprd: %s\ndepends_on: [%s]\n---\n\n## Objective\nExample\n\n## Acceptance Criteria\n- [x] expected behavior\n\n## Verification\n```bash\n%s\n```\n' "$1" "$2" "${4:-}" "$3" > "tickets/$1-example.md"
}
register_and_authorize() { # register_and_authorize <prd> <change> <words>
  $RT register --prd "$1" --change "$2" >/dev/null
  $RT change select "$2" >/dev/null
  $RT change authorize "$2" --agreement "$(digest "$2")" --reference "user message" --excerpt "$3" >/dev/null
  $RT change activate "$2" >/dev/null
}
commit_records() { git add -A .prd/changes .gitignore tickets; git commit -qm "$1"; }

case_aba() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  bash scripts/pincer-ticket.sh start T-01 >/dev/null
  bash scripts/pincer-ticket.sh verify T-01 >/dev/null
  bash scripts/pincer-ticket.sh done T-01 >/dev/null
  commit_records "A: T-01"
  $RT change pause prd-v1 --reason "switching to B" --note "T-02 is next" >/dev/null
  register_and_authorize .prd/prd-v2.md feature-b "yes, add B as specified"
  bash scripts/pincer-ticket.sh start T-03 >/dev/null; bash scripts/pincer-ticket.sh verify T-03 >/dev/null; bash scripts/pincer-ticket.sh done T-03 >/dev/null
  $RT change complete feature-b >/dev/null
  commit_records "B: complete"
  # A fresh session: select A, read the report (the authored handoff is shown while paused), resume it.
  $RT change select prd-v1 >/dev/null
  local r; r=$($RT resume --json)
  [ "$(json 'j.change.lifecycle.state' <<<"$r")" = paused ] || fail "A is not paused before resume"
  [ "$(json 'j.handoff && j.handoff.note' <<<"$r")" = "T-02 is next" ] || fail "the authored handoff note is not displayed"
  [ "$(json 'j.handoff.authored' <<<"$r")" = true ] || fail "the handoff is not labeled authored"
  grep -q "change resume prd-v1" <<<"$(json 'j.next.command' <<<"$r")" || fail "next action is not change resume: $(json 'j.next' <<<"$r")"
  $RT change resume prd-v1 >/dev/null
  r=$($RT resume --json)
  [ "$(json 'j.agreement.verdict' <<<"$r")" = current ] || fail "A's authorization was not retained"
  [ "$(json 'j.agreement.authorized.id' <<<"$r")" = A-01 ] || fail "A-01 is not the authorized record"
  [ "$(json 'j.change.lifecycle.state' <<<"$r")" = active ] || fail "A is not active after resume"
  [ "$(json 'j.next.ticket' <<<"$r")" = T-02 ] || fail "next ticket is not T-02: $(json 'j.next' <<<"$r")"
  [ "$($RT change show feature-b --json | json 'j.record.lifecycle.state')" = completed ] || fail "B is not retained as completed"
  echo "ok aba"
}

case_revision() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  printf 'R-03: also print JSON.\n' >> .prd/prd-v1.md   # same filename, revised content
  local r; r=$($RT resume --json)
  [ "$(json 'j.agreement.verdict' <<<"$r")" = AGREEMENT_CHANGED ] || fail "revision not detected: $(json 'j.agreement.verdict' <<<"$r")"
  expect_exit 1 AGREEMENT_CHANGED -- bash scripts/pincer-ticket.sh start T-01
  [ ! -d .pincer/runtime/attempts ] || [ -z "$(ls .pincer/runtime/attempts 2>/dev/null)" ] || fail "a refused start recorded an attempt"
  # An out-of-session revision is a decision to surface; execution stays blocked until it is resolved and the new agreement authorized.
  $RT change decide prd-v1 --summary "PRD revised outside the session: R-03 added" >/dev/null
  [ "$($RT resume --json | json 'j.agreement.verdict')" = DECISION_REQUIRED ] || fail "open decision does not block"
  $RT change decide prd-v1 --resolve D-01 --reference "user message" --excerpt "approved: R-03 as written" >/dev/null
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --reference "user message" --excerpt "approved: R-03 as written" --decision D-01 >/dev/null
  [ "$($RT resume --json | json 'j.agreement.verdict')" = current ] || fail "revised agreement not current after the naming approval"
  bash scripts/pincer-ticket.sh start T-01 >/dev/null || fail "start refused after the decision was recorded"
  echo "ok revision"
}

case_delegated() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  bash scripts/pincer-ticket.sh start T-01 >/dev/null; bash scripts/pincer-ticket.sh verify T-01 >/dev/null
  sed -i.bak 's/test "$(cat value.txt)" = good/test "$(cat value.txt)" = good \&\& test -f value.txt/' tickets/T-01-example.md && rm tickets/T-01-example.md.bak
  [ "$($RT resume --json | json 'j.agreement.verdict')" = AGREEMENT_CHANGED ] || fail "check edit not detected"
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --delegated --basis A-01 --explanation "stronger check, same scope" >/dev/null
  local r; r=$($RT resume --json)
  [ "$(json 'j.agreement.verdict' <<<"$r")" = current ] || fail "delegated authorization did not make the agreement current"
  [ "$(json 'j.agreement.authorized.disposition' <<<"$r")" = delegated ] || fail "disposition is not delegated"
  local t; t=$(json 'j.tickets.find(t=>t.id==="T-01").readiness' <<<"$r")
  [ "$(json 'j.ready' <<<"$t")" = false ] || fail "the earlier pass still counts after the check changed: $t"
  expect_exit 1 "" -- bash scripts/pincer-ticket.sh done T-01
  bash scripts/pincer-ticket.sh verify T-01 >/dev/null && bash scripts/pincer-ticket.sh done T-01 >/dev/null || fail "fresh verification did not close the ticket"
  echo "ok delegated"
}

case_wrong_change() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  $RT register --prd .prd/prd-v2.md --change feature-b >/dev/null
  $RT change select feature-b >/dev/null   # B selected; A stays the active change
  echo dirty >> value.txt
  expect_exit 1 "WRONG_CHANGE" -- bash scripts/pincer-ticket.sh start T-01
  expect_exit 1 "WRONG_CHANGE" -- bash scripts/pincer-ticket.sh verify T-01
  [ "$(git status --short value.txt)" = " M value.txt" ] || fail "dirty work was touched"
  grep -q '^status: open' tickets/T-01-example.md || fail "the refused start changed the ticket"
  $RT change select prd-v1 >/dev/null
  git checkout -q value.txt
  bash scripts/pincer-ticket.sh start T-01 >/dev/null || fail "start refused after selecting the owner"
  echo "ok wrong-change"
}

case_shared_c01() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  for t in T-01 T-02; do bash scripts/pincer-ticket.sh start $t >/dev/null; bash scripts/pincer-ticket.sh verify $t >/dev/null; bash scripts/pincer-ticket.sh done $t >/dev/null; done
  $RT change complete prd-v1 >/dev/null
  register_and_authorize .prd/prd-v2.md feature-b "yes, add B"
  bash scripts/pincer-ticket.sh start T-03 >/dev/null; bash scripts/pincer-ticket.sh verify T-03 >/dev/null; bash scripts/pincer-ticket.sh done T-03 >/dev/null
  $RT change complete feature-b >/dev/null
  commit_records "both complete"
  local sha; sha=$(git rev-parse HEAD)
  $RT check C-01 --candidate "$sha" -- 'test "$(cat value.txt)" = good' >/dev/null      # feature-b selected
  $RT change select prd-v1 >/dev/null
  $RT check C-01 --candidate "$sha" -- 'false' >/dev/null 2>&1 && fail "a failing check passed" || true
  local idx; idx=$(cat .pincer/runtime/index.json)
  [ -n "$(json "j.current['candidate:feature-b:$sha:C-01']" <<<"$idx")" ] || fail "feature-b's C-01 attempt is not keyed by change"
  [ -n "$(json "j.current['candidate:prd-v1:$sha:C-01']" <<<"$idx")" ] || fail "prd-v1's C-01 attempt is not keyed by change"
  [ "$(json "j.current['candidate:feature-b:$sha:C-01']" <<<"$idx")" != "$(json "j.current['candidate:prd-v1:$sha:C-01']" <<<"$idx")" ] || fail "the two changes share one attempt"
  local fb; fb=$(json "j.current['candidate:feature-b:$sha:C-01']" <<<"$idx")
  [ "$(json 'j.outcome' < ".pincer/runtime/attempts/$fb.json")" = passed ] || fail "feature-b's pass was overwritten by prd-v1's failure"
  echo "ok shared-c01"
}

case_crash() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  local op="$REPO/test/fixtures/change-op.cjs"
  # Killed after staging, before the manifest: nothing is committed; the old state is intact and
  # inspection is unaffected; the next transaction (or recover) discards the abandoned journal.
  set +e; node "$op" "$PWD" pause prd-v1 --reason "handoff" --crash staged >/dev/null 2>&1; local rc=$?; set -e
  [ "$rc" = 137 ] || fail "expected SIGKILL exit 137, got $rc"
  [ -n "$(ls .pincer/runtime/journal 2>/dev/null)" ] || fail "no journal entry left by the pre-manifest crash"
  local st0; st0=$($RT status --json) || fail "status refused after a pre-manifest crash"
  grep -q STATE_INCOMPLETE <<<"$st0" && fail "a pre-manifest crash was reported as incomplete state" || true
  $RT recover >/dev/null
  [ -z "$(ls .pincer/runtime/journal 2>/dev/null)" ] || fail "recover did not discard the abandoned journal"
  [ "$($RT change show prd-v1 --json | json 'j.record.lifecycle.state')" = active ] || fail "a pre-manifest crash changed the state"
  # Killed after the manifest, before the files are renamed into place: the transition is committed;
  # inspection refuses to interpret the half-applied state (STATE_INCOMPLETE) and recover completes it.
  set +e; node "$op" "$PWD" pause prd-v1 --reason "handoff" --crash rename:0 >/dev/null 2>&1; rc=$?; set -e
  [ "$rc" = 137 ] || fail "expected SIGKILL exit 137, got $rc"
  local st; set +e; st=$($RT status --json 2>/dev/null); local src=$?; set -e
  [ "$src" = 4 ] || fail "status interpreted half-applied state (exit $src)"
  [ "$(json 'j.reasons[0].code' <<<"$st")" = STATE_INCOMPLETE ] || fail "status did not report STATE_INCOMPLETE"
  [ "$(json 'j.mode' <<<"$st")" = changes ] || fail "status did not keep changes mode while incomplete"
  $RT recover >/dev/null
  local rec; rec=$($RT change show prd-v1 --json)
  [ "$(json 'j.record.lifecycle.state' <<<"$rec")" = paused ] || fail "a post-manifest crash lost the committed transition"
  [ "$(json 'j.record.events.length' <<<"$rec")" = "$(json 'j.record.sequence' <<<"$rec")" ] || fail "sequence and history disagree after recovery"
  [ "$(json 'j.record.events.at(-1).kind' <<<"$rec")" = pause ] || fail "the committed event is missing"
  echo "ok crash"
}

case_no_selection() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  commit_records "registered"
  local clone="$PWD-clone"; rm -rf "$clone"; git clone -q "$PWD" "$clone"; cd "$clone"
  local s; s=$($RT status --json)
  [ "$(json 'j.mode' <<<"$s")" = changes ] || fail "clone is not in changes mode"
  [ "$(json 'j.selection.problem.code' <<<"$s")" = SELECTION_REQUIRED ] || fail "clone did not require selection: $(json 'j.selection' <<<"$s")"
  expect_exit 1 "SELECTION_REQUIRED" -- bash scripts/pincer-ticket.sh start T-01
  $RT change select prd-v1 >/dev/null
  [ "$($RT resume --json | json 'j.agreement.verdict')" = current ] || fail "the committed authorization did not carry to the clone"
  [ "$($RT resume --json | json 'j.tickets.find(t=>t.id==="T-01").readiness.ready')" = false ] || fail "the clone treated T-01 as verified without a local attempt"
  echo "ok no-selection"
}

case_conflict() {
  register_and_authorize .prd/prd-v1.md prd-v1 "go ahead with both tickets"
  commit_records "registered"
  node -e "const f='.prd/changes/prd-v1.json';const fs=require('fs');const r=JSON.parse(fs.readFileSync(f,'utf8'));r.lifecycle.state='completed';fs.writeFileSync(f,JSON.stringify(r,null,2)+'\n')"
  expect_exit 4 "HISTORY_INVALID" -- $RT change show prd-v1
  expect_exit 1 "HISTORY_INVALID" -- bash scripts/pincer-ticket.sh start T-01   # SELECTION_INVALID naming the unreadable record
  local st; set +e; st=$($RT status --json 2>/dev/null); local src=$?; set -e
  [ "$src" = 4 ] || fail "status did not exit 4 on invalid state"
  [ "$(json 'j.reasons[0].code' <<<"$st")" = HISTORY_INVALID ] || fail "status fell back instead of reporting the conflict: $(json 'j.reasons' <<<"$st")"
  [ "$(json 'j.change' <<<"$st")" = null ] || fail "status interpreted the conflicting record"
  git checkout -q .prd/changes/prd-v1.json
  [ "$($RT change show prd-v1 --json | json 'j.record.lifecycle.state')" = active ] || fail "restored record is not readable"
  echo "ok conflict"
}

run_case() {
  CASE=$1
  local dir=${2:-$(mktemp -d "${TMPDIR:-/tmp}/pincer-replay-$1.XXXXXX")}
  setup "$dir"
  case "$1" in
    aba) case_aba ;; revision) case_revision ;; delegated) case_delegated ;; wrong-change) case_wrong_change ;;
    shared-c01) case_shared_c01 ;; crash) case_crash ;; no-selection) case_no_selection ;; conflict) case_conflict ;;
    *) echo "unknown case $1" >&2; exit 2 ;;
  esac
}
if [ "$CASE" = all ]; then
  for c in aba revision delegated wrong-change shared-c01 crash no-selection conflict; do run_case "$c" "${2:+$2/$c}"; done
else
  run_case "$CASE" "${2:-}"
fi
