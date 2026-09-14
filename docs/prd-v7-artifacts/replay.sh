#!/bin/bash
# Independent replay of the PRD v7 review cases on a scratch project built from this
# repository's template/ (the same runtime the packed kit ships).
#
#   bash docs/prd-v7-artifacts/replay.sh <case> [scratch-dir]
#   bash docs/prd-v7-artifacts/replay.sh all
#
# cases: incomplete | escaping | stale | routing | frozen | substituted
#
# Each case builds a fresh project, drives the runtime with the same commands a session
# would run, and asserts the observable outcome — exit code, reason code, record
# content. It prints "ok <case>" or fails with the first assertion that does not hold.
# Nothing outside the scratch directory is written. Requires git and Node >= 22.
#
# These are the v7 additions. The v6 cases are unchanged and still replayable from
# docs/prd-v6-artifacts/replay.sh; this script neither repeats nor supersedes them.
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
expect_both() { # expect_both <code> <pattern-on-stdout-or-stderr> -- <command...>
  # `coverage adopt --preview` prints its conflicts on stdout, so a refusal check that
  # only read stderr would pass for the wrong reason.
  local want=$1 pat=$2; shift 3
  local out; set +e; out=$("$@" 2>&1); local got=$?; set -e
  [ "$got" = "$want" ] || fail "expected exit $want, got $got from: $* — $out"
  grep -q -- "$pat" <<<"$out" || fail "expected '$pat' in output of: $* — $out"
}
json() { node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=($1);process.stdout.write(v===undefined?'':String(typeof v==='object'?JSON.stringify(v):v))"; }
digest() { $RT resume --json --change "$1" | json 'j.agreement.current'; }

prd() {
  cat > .prd/prd-v1.md <<'PRDEOF'
---
version: 1
status: ticketed
date: 2026-09-14
---
# PRD v1: value

## 4. Requirements

### R-01 — Read the value

- **S-01:** `cat value.txt` prints `good`.
- **S-02:** A missing value file is reported, not ignored.

### R-02 — Report the value

- **S-03:** The value is reported to the operator.
PRDEOF
}
ticket() { # ticket <id> <command> <scenarios> [dep]
  # The Context line names the SCENARIOS the ticket claims, which is what the draft
  # reports as material. A ticket naming other tickets there is not a scenario claim,
  # and the draft deliberately does not read it as one.
  printf -- '---\nticket: %s\nstatus: open\nsize: S\nprd: .prd/prd-v1.md\ndepends_on: [%s]\n---\n\n## Objective\nExample\n\n## Context\n- Implements: %s\n\n## Acceptance Criteria\n- [x] expected behavior\n\n## Verification\n```bash\n%s\n```\n' "$1" "${4:-}" "$3" "$2" > "tickets/$1-example.md"
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

# A registered, selected project with the PRD and tickets but NO coverage map — the
# state `coverage scaffold` exists for.
setup() {
  local dir=$1
  rm -rf "$dir"; mkdir -p "$dir"; cd "$dir"
  git init -q; git config user.name replay; git config user.email replay@example.invalid
  cp -R "$REPO/template/." .
  rm -f AGENTS.md.new* 2>/dev/null || true
  mkdir -p .prd tickets
  prd
  ticket T-01 'test "$(cat value.txt)" = good' 'S-01, S-02'
  ticket T-02 'true' 'S-03' T-01
  echo good > value.txt
  git add -A; git commit -qm "replay base"
  $RT register --prd .prd/prd-v1.md --change prd-v1 >/dev/null
  $RT change select prd-v1 >/dev/null
}
adopt() { # adopt — author the map, adopt, authorize, activate
  map "$DEFAULT_SCENARIOS" '{}' "$DEFAULT_CHECKS"
  git add -A; git commit -qm "author the map"
  $RT coverage adopt --apply --change prd-v1 >/dev/null
  $RT change authorize prd-v1 --agreement "$(digest prd-v1)" --reference "user message" --excerpt "approved: the map and both tickets as written" >/dev/null
  $RT change activate prd-v1 >/dev/null
  git add -A; git commit -qm "adopt strict coverage"
}

# 1. An incomplete draft names every gap and confers nothing. Authoring from it and
#    adopting is the documented route, and the draft itself is never accepted as a map.
case_incomplete() {
  local d; d=$($RT coverage scaffold --change prd-v1 --json)
  [ "$(json 'Object.keys(j.scenarios).join(",")' <<<"$d")" = "S-01,S-02,S-03" ] || fail "the draft does not list every live scenario"
  [ "$(json 'j.draft' <<<"$d")" = 1 ] || fail "the draft envelope is not draft 1"
  [ "$(json 'j.schema === undefined' <<<"$d")" = true ] || fail "the draft carries a map schema"
  # Three unlinked scenarios and two unclassified tickets, named individually.
  [ "$(json 'j.unresolved.filter(u=>u.code==="SCENARIO_UNLINKED").map(u=>u.id).join(",")' <<<"$d")" = "S-01,S-02,S-03" ] || fail "the unmapped scenarios are not all named unresolved"
  [ "$(json 'j.unresolved.filter(u=>u.code==="TICKET_UNCLASSIFIED").map(u=>u.id).join(",")' <<<"$d")" = "T-01,T-02" ] || fail "the unclassified tickets are not named"
  [ "$(json 'Object.keys(j.checks).length' <<<"$d")" = 0 ] || fail "the draft invented a check declaration"
  [ "$(json 'j.scenarios["S-01"].tickets.length' <<<"$d")" = 0 ] || fail "the draft invented a link"
  # The ticket's own claim is reported as material, never promoted into a link.
  [ "$(json 'j.candidates.tickets["T-01"].scenarios.join(",")' <<<"$d")" = "S-01,S-02" ] || fail "the ticket's own claim is not reported"
  # Saving the draft in the map's place is refused by the adoption gate. Written via a
  # temporary file: redirecting straight onto the map would truncate it before the
  # command that reads it runs.
  mkdir -p .prd/coverage
  $RT coverage scaffold --change prd-v1 --json > draft.json
  mv draft.json .prd/coverage/prd-v1.json
  expect_both 1 COVERAGE_INVALID -- $RT coverage adopt --preview --change prd-v1
  [ "$(json 'j.schema' < .prd/changes/prd-v1.json)" = 2 ] || fail "the change became strict from a draft"
  # The authored map does adopt, through the existing gates.
  adopt
  [ "$(json 'j.schema' < .prd/changes/prd-v1.json)" = 3 ] || fail "the authored map did not adopt"
  # And the draft now reports nothing unresolved without having granted anything.
  [ "$($RT coverage scaffold --change prd-v1 --json | json 'j.unresolved.length')" = 0 ] || fail "the complete map still reads unresolved"
  echo "ok incomplete"
}

# 2. Malformed and escaping inputs are refused before any draft is printed.
case_escaping() {
  mkdir -p .prd/coverage
  printf '{ "schema": 1, ' > .prd/coverage/prd-v1.json
  expect_exit 4 COVERAGE_INVALID -- $RT coverage scaffold --change prd-v1
  [ -z "$($RT coverage scaffold --change prd-v1 2>/dev/null || true)" ] || fail "a draft was printed for an unreadable map"
  map "$DEFAULT_SCENARIOS" '{}' "$DEFAULT_CHECKS"
  sed -i.bak 's/"schema": 1/"schema": 9/' .prd/coverage/prd-v1.json && rm -f .prd/coverage/prd-v1.json.bak
  expect_exit 4 "unsupported coverage map schema 9" -- $RT coverage scaffold --change prd-v1
  # A symlinked map escapes the tree and is refused, not followed.
  mkdir -p ../outside && map "$DEFAULT_SCENARIOS" '{}' "$DEFAULT_CHECKS" && cp .prd/coverage/prd-v1.json ../outside/elsewhere.json
  rm .prd/coverage/prd-v1.json && ln -s ../../../outside/elsewhere.json .prd/coverage/prd-v1.json
  expect_exit 4 "symbolic link" -- $RT coverage scaffold --change prd-v1
  rm .prd/coverage/prd-v1.json
  # Usage errors, before anything is read.
  expect_exit 2 "coverage scaffold requires --change" -- $RT coverage scaffold
  expect_exit 2 "unknown option --apply" -- $RT coverage scaffold --change prd-v1 --apply
  echo "ok escaping"
}

# 3. Editing the authored inputs after authorization is refused, and the draft never
#    claims the new scenario is covered.
case_stale() {
  adopt
  printf -- '\n- **S-04:** A later scenario, added after the agreement was authorized.\n' >> .prd/prd-v1.md
  local r; r=$($RT resume --json)
  [ "$(json 'j.agreement.verdict' <<<"$r")" = AGREEMENT_CHANGED ] || fail "the stale agreement was not detected"
  # The brief says the same thing, with the same next action.
  local b; b=$($RT resume --brief --json)
  [ "$(json 'j.agreement.verdict' <<<"$b")" = AGREEMENT_CHANGED ] || fail "the brief disagrees on the verdict"
  [ "$(json 'j.next.command' <<<"$b")" = "$(json 'j.next.command' <<<"$r")" ] || fail "the brief recomputed the next action"
  # The draft reports S-04 as unresolved rather than covering it.
  local d; d=$($RT coverage scaffold --change prd-v1 --json)
  [ "$(json 'j.scenarios["S-04"].state' <<<"$d")" = unresolved ] || fail "the draft claims the new scenario is covered"
  expect_exit 1 AGREEMENT_CHANGED -- $RT change complete prd-v1
  echo "ok stale"
}

# 4. Brief and full agree on the verdict, the next action and every blocker category,
#    and the brief is smaller while naming the command that prints what it omitted.
case_routing() {
  adopt
  local f b
  f=$($RT resume --json); b=$($RT resume --brief --json)
  [ "$(json 'JSON.stringify(j.next)' <<<"$b")" = "$(json 'JSON.stringify(j.next)' <<<"$f")" ] || fail "the brief's next action differs from the full report's"
  [ "$(json 'j.blockers.total' <<<"$b")" = "$(json 'j.blockers.length' <<<"$f")" ] || fail "the brief lost a blocker"
  [ "$(json 'j.tickets.total' <<<"$b")" = "$(json 'j.tickets.length' <<<"$f")" ] || fail "the brief lost a ticket count"
  # Every distinct blocker code of the full report survives in the brief.
  local want got
  want=$(json '[...new Set(j.blockers.map(x=>x.code))].sort().join(",")' <<<"$f")
  got=$(json 'j.blockers.categories.map(c=>c.code).sort().join(",")' <<<"$b")
  [ "$want" = "$got" ] || fail "blocker categories differ: full [$want] brief [$got]"
  # The human brief is smaller than the full report and points at it.
  local fb bb
  fb=$($RT resume | wc -c); bb=$($RT resume --brief | wc -c)
  [ "$bb" -lt "$fb" ] || fail "the brief ($bb bytes) is not smaller than the full report ($fb bytes)"
  $RT resume --brief | grep -q "Detail" || fail "the brief does not name where the omitted detail is"
  # Reporting writes nothing.
  local before after
  before=$(git status --porcelain | sort | md5 2>/dev/null || git status --porcelain | sort | md5sum)
  $RT resume >/dev/null; $RT resume --brief >/dev/null; $RT resume --brief --json >/dev/null
  after=$(git status --porcelain | sort | md5 2>/dev/null || git status --porcelain | sort | md5sum)
  [ "$before" = "$after" ] || fail "a report changed the working tree"
  echo "ok routing"
}

# 5. Mutating a frozen execution input starts a new cohort; a record from the old one is
#    reported under its own rather than re-evaluated under the new.
case_frozen() {
  node -e '
    const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
    const R = process.env.REPO;
    const freeze = require(path.join(R, "scripts/delivery-benchmark-v7/freeze.cjs"));
    const effort = require(path.join(R, "scripts/delivery-benchmark-v7/effort.cjs"));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v7-freeze-"));
    const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
    w("protocol.md", "# p\n"); w("harness/run.cjs", "module.exports = 1;\n");
    w("collector/e.cjs", "module.exports = 1;\n"); w("driver/d.sh", "echo x\n");
    w("briefs/b/brief.md", "## Task\nx\n\n## Prompt 1\ny\n"); w("briefs/b/evaluator/e.cjs", "module.exports = 1;\n");
    const spec = { protocol: "protocol.md", harness: "harness", briefs: "briefs", collector: "collector", driver: "driver", caps: { t: 1 }, configuration: { values: { model: "m" }, env: ["PATH"] } };
    const first = freeze.compute(dir, spec);
    w("harness/run.cjs", "module.exports = 2;\n");
    const second = freeze.compute(dir, spec);
    if (first.cohort === second.cohort) { console.error("a changed harness did not change the cohort"); process.exit(1); }
    if (!freeze.difference(first, second).changed.includes("harness")) { console.error("the difference does not name the harness"); process.exit(1); }
    const belongs = freeze.belongs({ cohort: first.cohort }, second);
    if (belongs.ok) { console.error("an old record was admitted to the new cohort"); process.exit(1); }
    if (!/not re-evaluated here/.test(belongs.reason)) { console.error("the refusal does not say the record is not re-evaluated"); process.exit(1); }
    const r = { cohort: first.cohort, status: "pending" };
    const problems = effort.problems({ ...effort.empty({ run: effort.runId("b", 1, "plain"), cohort: first.cohort, brief: "b", arm: "plain", repetition: 1 }) }, { frozen: second });
    if (!problems.some(p => p.code === "COHORT_CHANGED")) { console.error("the record validator admitted a foreign cohort"); process.exit(1); }
    // A secret in an allowlisted field is refused, never hashed into the fingerprint.
    const poisoned = freeze.fingerprint({ model: "sk-ant-CANARYCANARYCANARYCANARY" }, {});
    if ("model" in poisoned.configuration) { console.error("a secret value was captured"); process.exit(1); }
    if (JSON.stringify(poisoned).includes("CANARYCANARYCANARYCANARY")) { console.error("a secret value reached the fingerprint"); process.exit(1); }
  ' || fail "the execution freeze did not hold"
  echo "ok frozen"
}

# 6. A trial record that is missing, forged or mislabelled is refused; an honestly
#    outstanding one is accepted without becoming evidence.
case_substituted() {
  node -e '
    const path = require("node:path");
    const R = process.env.REPO;
    const obs = require(path.join(R, "scripts/delivery-benchmark-v7/observations.cjs"));
    const HEX = "a".repeat(64), SHA = "b".repeat(40);
    const ref = { kind: "tracked", path: "docs/prd-v7-artifacts/pilots/x.json", digest: HEX };
    const stages = {}; for (const s of obs.STAGES) stages[s] = { state: "observed", artifacts: [ref] };
    const base = { schema: 1, kind: "pilot", id: "p", recorded: "2026-09-20T10:00:00Z", status: "complete", observed: true, fixture: false, project: "x", project_kind: "greenfield", preexisting_edits: false, provenance: { kit: HEX, kit_source: "tarball", base: SHA, tool_version: "t", model: "m" }, stages, revision_authorization: { agreement: HEX, reference: "r", excerpt: "e", generic_continue: false }, candidate: { commit: SHA, evidence_schema: 3, artifacts: [ref] }, interventions: [] };
    const has = (r, code) => obs.problems(r).some(p => p.code === code);
    const need = (cond, why) => { if (!cond) { console.error(why); process.exit(1); } };
    need(obs.problems(base).length === 0, "the complete record does not validate: " + JSON.stringify(obs.problems(base)));
    need(has({ ...base, fixture: true }, "FIXTURE_MISLABELLED"), "a fixture was admitted as a live observation");
    need(has({ ...base, observed: false }, "NOT_OBSERVED"), "an unobserved record was admitted as complete");
    const noStage = { ...base, stages: { ...stages } }; delete noStage.stages.evaluate;
    need(has(noStage, "STAGE_MISSING"), "a missing stage was admitted");
    const forged = { ...base, candidate: { ...base.candidate, commit: "HEAD" } };
    need(has(forged, "CANDIDATE_INVALID"), "a candidate that is not a commit was admitted");
    const scrubbed = { ...base, stages: { ...stages, recover: { state: "repaired", artifacts: [ref] } } };
    need(has(scrubbed, "FAILURE_DISCARDED"), "a repair that discarded its failure was admitted");
    const generic = { ...base, revision_authorization: { ...base.revision_authorization, generic_continue: true } };
    need(has(generic, "AUTHORIZATION_GENERIC"), "a generic continue was admitted as authorization");
    const escaping = { ...base, stages: { ...stages, adopt: { state: "observed", artifacts: [{ kind: "tracked", path: "../outside/x.json" }] } } };
    need(has(escaping, "REFERENCE_INVALID"), "an escaping artifact reference was admitted");
    // Packaged parity can never close a live platform criterion.
    const platform = { schema: 1, kind: "platform", id: "pl", recorded: "2026-09-20T10:00:00Z", status: "complete", observed: true, fixture: false, surface: "claude-code", provenance: base.provenance, stages, handoff: null, support: [{ surface: "claude-code", capability: "c", support: "observed", version: "v", basis: "packaged-parity", evidence: [ref] }] };
    need(has(platform, "SUPPORT_SUBSTITUTED"), "packaged parity was admitted as a live observation");
    // The verdict never claims more than record validity.
    const v = obs.verdict([base]);
    need(v.code === "RECORD_VALID", "the verdict is not RECORD_VALID");
    need(/does not establish that a session happened/.test(v.note), "the verdict does not disclaim observation");
  ' || fail "the observation validator did not hold"
  echo "ok substituted"
}

run_case() {
  local dir="${SCRATCH}/${1}"
  ( setup "$dir" >/dev/null 2>&1 || { echo "FAIL $1: setup failed" >&2; exit 1; }
    CASE=$1; REPO="$REPO" "case_${1}" )
}

SCRATCH=${2:-"${TMPDIR:-/tmp}/pincer-v7-replay-$$"}
mkdir -p "$SCRATCH"
export REPO
CASES="incomplete escaping stale routing frozen substituted"
if [ "$CASE" = all ]; then
  for c in $CASES; do run_case "$c"; done
  echo "ok all (6 cases)"
else
  grep -qw "$CASE" <<<"$CASES" || { echo "unknown case: $CASE (one of: $CASES, or all)" >&2; exit 2; }
  run_case "$CASE"
fi
