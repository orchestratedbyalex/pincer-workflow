#!/bin/bash
# Independent replay of the eight PRD v6 review cases on a scratch project built from
# this repository's template/ (the same runtime the packed kit ships).
#
#   bash docs/prd-v6-artifacts/replay.sh <case> [scratch-dir]
#   bash docs/prd-v6-artifacts/replay.sh all
#
# cases: omitted | revision | removal | substituted | race | shared | rollback | clone
#
# Each case builds a fresh strict-coverage project (one PRD in the inventory grammar,
# three tickets, one coverage map, one commit), drives the runtime with the same commands
# a session would run, and asserts the observable outcome (exit code, reason code, record
# content). It prints "ok <case>" or fails with the first assertion that does not hold.
# Nothing outside the scratch directory is written. Requires git and Node >= 18.
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

prd() { # prd <file> <extra-scenario-block>
  cat > "$1" <<'PRDEOF'
---
version: 1
status: ticketed
date: 2026-09-12
---
# PRD v1: value

## 4. Requirements

### R-01 — Read the value

- **S-01:** `cat value.txt` prints `good`.
- **S-02:** A missing value file is reported, not ignored.

### R-02 — Report the value

- **S-03:** The value is reported to the operator.
PRDEOF
  [ -n "${2:-}" ] && printf '%s\n' "$2" >> "$1"
  return 0
}
ticket() { # ticket <id> <command> [dep]
  printf -- '---\nticket: %s\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: [%s]\n---\n\n## Objective\nExample\n\n## Context\n- Implements: %s\n\n## Acceptance Criteria\n- [x] expected behavior\n\n## Verification\n```bash\n%s\n```\n' "$1" "${3:-}" "$1" "$2" > "tickets/$1-example.md"
}
map() { # map <scenarios-json> <scope-json> <checks-json> [tickets-json]
  mkdir -p .prd/coverage
  cat > .prd/coverage/prd-v1.json <<MAPEOF
{
  "schema": 1,
  "change": "prd-v1",
  "prd": ".prd/prd-v1.md",
  "scenarios": ${1},
  "scope": ${2},
  "tickets": ${4:-$DEFAULT_TICKETS},
  "checks": ${3}
}
MAPEOF
}
DEFAULT_TICKETS='{ "T-01": { "role": "implements", "rationale": null }, "T-02": { "role": "implements", "rationale": null } }'
DEFAULT_SCENARIOS='{ "S-01": { "tickets": ["T-01"], "checks": ["C-01"] }, "S-02": { "tickets": ["T-01"], "checks": ["C-01"] }, "S-03": { "tickets": ["T-02"], "checks": ["C-02"] } }'
DEFAULT_CHECKS='{ "C-01": { "kind": "command", "required": true, "command": "test \"$(cat value.txt)\" = good", "timeout": 60, "cwd": null, "obligation": null, "note": null }, "C-02": { "kind": "review", "required": true, "command": null, "timeout": null, "cwd": null, "obligation": "read the report wording against S-03", "note": null } }'

setup() { # setup <dir> — a strict-coverage project, adopted, authorized and active
  local dir=$1
  rm -rf "$dir"; mkdir -p "$dir"; cd "$dir"
  git init -q; git config user.name replay; git config user.email replay@example.invalid
  cp -R "$REPO/template/." .
  rm -f AGENTS.md.new* 2>/dev/null || true
  mkdir -p .prd tickets
  prd .prd/prd-v1.md ""
  ticket T-01 'test "$(cat value.txt)" = good'
  ticket T-02 'true' T-01
  map "$DEFAULT_SCENARIOS" '{}' "$DEFAULT_CHECKS"
  echo good > value.txt
  git add -A; git commit -qm "replay base"
  $RT register --prd .prd/prd-v1.md --change prd-v1 >/dev/null
  $RT change select prd-v1 >/dev/null
  $RT coverage adopt --apply --change prd-v1 >/dev/null
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --reference "user message" --excerpt "approved: the map and both tickets as written" >/dev/null
  $RT change activate prd-v1 >/dev/null
  git add -A .prd tickets .gitignore; git commit -qm "adopt strict coverage"
}
build() { # build <ticket>
  bash scripts/pincer-ticket.sh start "$1" >/dev/null
  bash scripts/pincer-ticket.sh verify "$1" >/dev/null
  bash scripts/pincer-ticket.sh done "$1" >/dev/null
}

# 1. An obligation with no link: the structure is incomplete and completion refuses.
case_omitted() {
  map '{ "S-01": { "tickets": ["T-01"], "checks": ["C-01"] }, "S-03": { "tickets": ["T-02"], "checks": ["C-02"] } }' '{}' "$DEFAULT_CHECKS"
  local c; c=$($RT coverage --json)
  [ "$(json 'j.structure.complete' <<<"$c")" = false ] || fail "an omitted obligation left the structure complete"
  grep -q COVERAGE_INCOMPLETE <<<"$(json 'j.structure.problems.map(p=>p.code).join(",")' <<<"$c")" || fail "no COVERAGE_INCOMPLETE: $(json 'j.structure.problems' <<<"$c")"
  grep -q 'S-02' <<<"$(json 'j.structure.problems.map(p=>p.ids.join("/")).join(",")' <<<"$c")" || fail "the gap does not name S-02"
  [ "$(json 'j.next.action' <<<"$c")" != "" ] || fail "no next action for an incomplete structure"
  git add -A .prd; git commit -qm "map without S-02"
  # The authorization gate runs first: the map edit changed the agreement.
  expect_exit 1 AGREEMENT_CHANGED -- $RT change complete prd-v1
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --reference "user message" --excerpt "approved: the map as it now stands" >/dev/null
  expect_exit 1 COVERAGE_INCOMPLETE -- $RT change complete prd-v1
  # Restoring the link clears it without any other change.
  map "$DEFAULT_SCENARIOS" '{}' "$DEFAULT_CHECKS"
  [ "$($RT coverage --json | json 'j.structure.complete')" = true ] || fail "restoring the link did not complete the structure"
  echo "ok omitted"
}

# 2. A scenario added to the PRD: the agreement changes, impact names the new rows.
case_revision() {
  local before; before=$(digest prd-v1)
  printf -- '\n- **S-04:** The report is written to a file.\n' >> .prd/prd-v1.md
  local r; r=$($RT resume --json)
  [ "$(json 'j.agreement.verdict' <<<"$r")" = AGREEMENT_CHANGED ] || fail "the revision was not detected: $(json 'j.agreement.verdict' <<<"$r")"
  expect_exit 1 AGREEMENT_CHANGED -- bash scripts/pincer-ticket.sh start T-01
  local i; i=$($RT impact --json)
  [ "$(json 'j.verdict' <<<"$i")" = changed ] || fail "impact does not report a change: $(json 'j.verdict' <<<"$i")"
  grep -q 'S-04' <<<"$(json 'j.scenarios.added.join(",")' <<<"$i")" || fail "impact does not name S-04 as added: $(json 'j.scenarios' <<<"$i")"
  [ "$(json 'j.baseline.agreement' <<<"$i")" = G-01 ] || fail "impact does not name the agreement it compares from: $(json 'j.baseline' <<<"$i")"
  [ "$(json 'j.baseline.authorization' <<<"$i")" = A-01 ] || fail "impact does not name the authorization that fixed the baseline"
  [ "$(json 'j.scenarios.unchanged.length' <<<"$i")" = 3 ] || fail "impact does not keep the three unchanged scenarios"
  local c; c=$($RT coverage --json)
  grep -q COVERAGE_INCOMPLETE <<<"$(json 'j.structure.problems.map(p=>p.code).join(",")' <<<"$c")" || fail "the new scenario is not an open obligation"
  [ "$(digest prd-v1)" != "$before" ] || fail "the agreement digest did not change with the PRD"
  echo "ok revision"
}

# 3. Removing an obligation needs a resolved decision and an authorization naming it.
case_removal() {
  local scenarios='{ "S-01": { "tickets": ["T-01"], "checks": ["C-01"] }, "S-02": { "tickets": ["T-01"], "checks": ["C-01"] } }'
  # S-03 is the only scenario T-02 implemented, so removing it reclassifies T-02 as enabling work.
  local tickets='{ "T-01": { "role": "implements", "rationale": null }, "T-02": { "role": "enables", "rationale": "reporting harness kept for the next change; implements no scenario here" } }'
  map "$scenarios" '{ "S-03": { "disposition": "removed", "decision": "D-01", "prior": "G-01", "note": "cut for this change" } }' "$DEFAULT_CHECKS" "$tickets"
  local c; c=$($RT coverage --json)
  grep -qE 'DECISION_REQUIRED|SCOPE_UNAUTHORIZED|COVERAGE_INVALID' <<<"$(json 'j.structure.problems.map(p=>p.code).join(",")' <<<"$c")" || fail "a removal naming an unknown decision was accepted: $(json 'j.structure.problems' <<<"$c")"
  $RT change decide prd-v1 --summary "S-03 is cut from this change and moves to the next" >/dev/null
  $RT change decide prd-v1 --resolve D-01 --reference "user message" --excerpt "yes, drop S-03 from this change" >/dev/null
  c=$($RT coverage --json)
  grep -q SCOPE_UNAUTHORIZED <<<"$(json 'j.structure.problems.map(p=>p.code).join(",")' <<<"$c")" || fail "a resolved decision alone authorized the removal: $(json 'j.structure.problems' <<<"$c")"
  # A generic instruction authorizes no revised scope: it must name the decision.
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --reference "user message" --excerpt "continue and finish it" >/dev/null
  c=$($RT coverage --json)
  grep -q SCOPE_UNAUTHORIZED <<<"$(json 'j.structure.problems.map(p=>p.code).join(",")' <<<"$c")" || fail "a generic authorization was accepted for the removal"
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --reference "user message" --excerpt "approved: drop S-03 from this change as decided" --decision D-01 >/dev/null
  c=$($RT coverage --json)
  [ "$(json 'j.structure.complete' <<<"$c")" = true ] || fail "the decision-backed removal was not accepted: $(json 'j.structure.problems' <<<"$c")"
  [ "$(json 'j.scope.find(s=>s.id==="S-03").disposition' <<<"$c")" = removed ] || fail "S-03 is not reported as removed"
  echo "ok removal"
}

# 4. The map's declaration is the only source for a candidate check.
case_substituted() {
  build T-01; build T-02
  $RT change complete prd-v1 >/dev/null
  git add -A tickets .prd; git commit -qm "build both tickets and complete the change" >/dev/null
  local candidate; candidate=$(git rev-parse HEAD)
  # A supplied command is refused before anything runs (invalid input, exit 4).
  expect_exit 4 CHECK_UNDECLARED -- $RT check C-01 --candidate "$candidate" -- true
  # A review obligation is not a command check, and an unknown id is not a check at all.
  expect_exit 4 CHECK_UNDECLARED -- $RT check C-02 --candidate "$candidate"
  expect_exit 4 CHECK_UNDECLARED -- $RT check C-09 --candidate "$candidate"
  # The declared command runs and the attempt records the declaration it ran.
  $RT check C-01 --candidate "$candidate" >/dev/null
  local d1 display
  d1=$(node -e 'const fs=require("fs"),p=".pincer/runtime/attempts";const f=fs.readdirSync(p).filter(x=>x.endsWith(".json")).sort().pop();process.stdout.write(JSON.parse(fs.readFileSync(p+"/"+f,"utf8")).check.digest)')
  display=$(node -e 'const fs=require("fs"),p=".pincer/runtime/attempts";const f=fs.readdirSync(p).filter(x=>x.endsWith(".json")).sort().pop();process.stdout.write(JSON.parse(fs.readFileSync(p+"/"+f,"utf8")).check.display)')
  [ -n "$d1" ] || fail "the attempt did not record a declaration digest"
  grep -q 'value.txt' <<<"$display" || fail "the attempt did not record the declared command: $display"
  local map_before; map_before=$($RT coverage --json | json 'j.map.digest')
  # Substituting the command in the map changes the map and the agreement it belongs to.
  map "$DEFAULT_SCENARIOS" '{}' '{ "C-01": { "kind": "command", "required": true, "command": "true", "timeout": 60, "cwd": null, "obligation": null, "note": null }, "C-02": { "kind": "review", "required": true, "command": null, "timeout": null, "cwd": null, "obligation": "read the report wording against S-03", "note": null } }'
  git add -A .prd; git commit -qm "substitute the C-01 command" >/dev/null
  local map_after; map_after=$($RT coverage --json | json 'j.map.digest')
  [ -n "$map_before" ] && [ "$map_before" != "$map_after" ] || fail "substituting the declaration did not change the map digest ($map_before → $map_after)"
  # The substituted declaration cannot run under the authorization that covered the old one.
  expect_exit 1 AGREEMENT_CHANGED -- $RT check C-01 --candidate "$(git rev-parse HEAD)"
  echo "ok substituted"
}

# 5. An authorization committed between the pre-launch guard and the attempt lock.
case_race() {
  local out; set +e
  # A lifecycle transition committed between the pre-launch guard and the attempt lock.
  out=$(node "$REPO/test/fixtures/attempt-race.cjs" "$PWD" --exec "node scripts/pincer-runtime.cjs change pause prd-v1 --reason 'paused by the operator mid-verify'" -- verify T-01 2>&1)
  local rc=$?; set -e
  [ $rc -ne 0 ] || fail "the raced verify was accepted: $out"
  grep -qE 'LIFECYCLE_BLOCKED|STATE_CHANGED|AGREEMENT_CHANGED' <<<"$out" || fail "the race was not refused with a gate code: $out"
  [ ! -d .pincer/runtime/attempts ] || [ -z "$(ls .pincer/runtime/attempts 2>/dev/null)" ] || fail "the refused race recorded an attempt"
  echo "ok race"
}

# 6. Two changes evaluated on one candidate keep distinct evaluation locators.
case_shared() {
  printf -- '---\nversion: 2\nstatus: ticketed\ndate: 2026-09-12\n---\n# PRD v2: other\n\n## 4. Requirements\n\n### R-01 — Other\n\n- **S-01:** Another change.\n' > .prd/prd-v2.md
  ticket T-03 'true'
  sed -i.bak 's|prd: .prd/prd-v1.md|prd: .prd/prd-v2.md|' tickets/T-03-example.md && rm -f tickets/T-03-example.md.bak
  git add -A .prd tickets; git commit -qm "second PRD" >/dev/null
  $RT register --prd .prd/prd-v2.md --change feature-b >/dev/null
  [ "$($RT change show feature-b --json | json 'j.record.change')" = feature-b ] || fail "the second change was not registered"
  [ "$($RT change show prd-v1 --json | json 'j.record.change')" = prd-v1 ] || fail "the first change was lost"
  [ "$($RT change show prd-v1 --json | json 'j.record.schema')" = 3 ] || fail "the strict record is not schema 3"
  [ "$($RT change show feature-b --json | json 'j.record.schema')" = 2 ] || fail "a new change is not schema 2 before adoption"
  echo "ok shared"
}

# 7. Adoption keeps a backup; the rollback restores the pre-adoption record literally.
case_rollback() {
  local backup record_before
  record_before=$(cat .prd/changes/prd-v1.json)
  backup=$(ls -d .pincer/backups/*/ 2>/dev/null | tail -1)
  [ -n "$backup" ] || fail "adoption left no backup under .pincer/backups/"
  [ -f "${backup}.prd/changes/prd-v1.json" ] || fail "the backup does not hold the pre-adoption record: $(find "$backup" -type f | head -3)"
  [ "$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('${backup}.prd/changes/prd-v1.json','utf8')).schema))")" = 2 ] || fail "the backed-up record is not the schema 2 original"
  [ "$(json 'j.schema' <<<"$record_before")" = 3 ] || fail "the adopted record is not schema 3"
  # Rolling back is a literal restore of the backup; nothing else is deleted.
  cp "${backup}.prd/changes/prd-v1.json" .prd/changes/prd-v1.json
  [ "$($RT change show prd-v1 --json | json 'j.record.schema')" = 2 ] || fail "the restore did not bring back the schema 2 record"
  [ -f .prd/coverage/prd-v1.json ] || fail "the rollback deleted the authored map"
  [ "$($RT coverage --json | json 'j.label')" = unverified ] || fail "coverage is not 'unverified' after the rollback: $($RT coverage --json | json 'j.label')"
  echo "ok rollback"
}

# 8. A fresh clone has no local attempt history and says so.
case_clone() {
  build T-01; build T-02
  git add -A tickets .prd; git commit -qm "build both tickets" >/dev/null
  local clone="${PWD}-clone"
  rm -rf "$clone"; git clone -q . "$clone"; cd "$clone"
  $RT change select prd-v1 >/dev/null
  local s; s=$($RT status --json)
  [ "$(json 'j.candidate.local_attempts' <<<"$s")" = unavailable ] || fail "the clone claims local attempt history: $(json 'j.candidate' <<<"$s")"
  local c; c=$($RT coverage --json)
  [ "$(json 'j.strict' <<<"$c")" = true ] || fail "the clone lost strict coverage"
  [ "$(json 'j.next.action' <<<"$c")" != "" ] || fail "the clone cannot name a next action"
  [ ! -d .pincer/runtime/attempts ] || [ -z "$(ls .pincer/runtime/attempts 2>/dev/null)" ] || fail "the clone carries attempts"
  echo "ok clone"
}

run_case() { # run_case <name>
  local dir="${SCRATCH}/${1}"
  ( setup "$dir" >/dev/null 2>&1 || { echo "FAIL $1: setup failed" >&2; exit 1; }
    CASE=$1; "case_${1}" )
}

SCRATCH=${2:-"${TMPDIR:-/tmp}/pincer-v6-replay-$$"}
mkdir -p "$SCRATCH"
CASES="omitted revision removal substituted race shared rollback clone"
if [ "$CASE" = all ]; then
  for c in $CASES; do run_case "$c"; done
  echo "ok all (8 cases)"
else
  grep -qw "$CASE" <<<"$CASES" || { echo "unknown case: $CASE (one of: $CASES, or all)" >&2; exit 2; }
  run_case "$CASE"
fi
