---
prd: .prd/prd-v3.md
base: d15933d4ade60bc283aaef0ed846dee5085dbbae
candidate: a10358ea452aa0d31e015beb0288b720029c0038
evidence: .prd/evidence/prd-v3/a10358ea452aa0d31e015beb0288b720029c0038/manifest.json
---

# Evaluation — PRD v3: Recovery, evidence checks and plan questions after the interactive trial

Reviewed candidate `a10358e` against base `d15933d` (main after the interactive-trial
record, before `Add PRD v3`), tickets T-24..T-28. Evidence manifest: see frontmatter;
validated with
`node template/scripts/pincer-evidence.cjs validate <manifest> --candidate a10358e… --base d15933d… --prd .prd/prd-v3.md`.

## Requirement dispositions

| Requirement | Disposition | Where it lives | Checks |
| --- | --- | --- | --- |
| R-01 A tree that is back at the evaluated candidate commits nothing | delivered | Code playbook recovery section (T-24, condition corrected in T-28), status playbook sentence, dry-run cheat box, five assertions in `test/workflow.test.js`; live eligible case in `docs/trial-2026-09-10-prd-v3.md` (T-27) | C-01, C-02, C-06 (trial record), C-07 (review). Negative-scenario live observation `outstanding`; see below |
| R-02 Separate independently reported executable checks | delivered | Evaluate step 9 (T-25), dry-run box, four assertions; by-product live observation: the trial re-evaluation manifest had six checks with the security pass as three entries | C-01, C-02, C-06, C-07; this manifest itself records one command per check |
| R-03 Plan asks only what the brief leaves open | delivered | Plan Phase 1 steps 2 and 3 (T-26), six assertions incl. budget and design question unchanged | C-01, C-02, C-07. Live observation `outstanding` |

Coverage review: every requirement maps to a ticket and to the wording assertions
in C-01; R-01 additionally to the live eligible case. Wording assertions prove that
the contract is present, not that an agent follows it. This mapping and the adequacy
of static assertions for playbook text are my judgment as reviewer, as in PRD v2.

## Evaluation history

- Candidate `7c19e42` (T-24..T-27) was reviewed by the code-quality subagent, which
  confirmed no generator drift and no vacuous assertion and returned four wording
  defects: the exception's second condition was literally unsatisfiable (the ticket
  file being restored is itself a tracked file that differs), T-27's Objective and
  Requirement still described the negative case as observed, the PRD's Problem
  paragraph misstated when the fault was reverted, and two Success Criteria rows were
  stale against the trial record. T-28 fixed all four; candidate `a10358e` re-ran
  every check. Known issue kept: T-25's `git diff --quiet HEAD` clause is vacuous
  after its commit; changing a done ticket's block would invalidate its receipt.
- The R-01 negative scenario (tree at the candidate, check fails for a real reason)
  was attempted in the trial with an `npm` shim on `PATH`. Sonnet found the shim, ran
  the real binary, saw the check pass and applied the exception, keeping the failed
  receipt but recommending the restore. The fault was bypassable, so the observation
  is recorded as `outstanding` in the PRD's Out of Scope. That cut is agent-recorded;
  the user confirms or rejects it at release.

## What was built

- The code playbook's recovery section keeps the default (a restored receipt is never
  evidence) and adds one exception with three checkable conditions: PRD built with
  valid evidence, tracked files other than the ticket file match the candidate with
  nothing untracked, and the Verification block passes when run directly. The agent
  then names the restore command for the user and runs no `verify`, refreshes no
  receipt and commits nothing. The status playbook points at it; the checklist gained
  the matching cheat.
- Evaluate step 9: one check per command, `command` is the command line as run, the
  security pass is three entries, `npm test` stays one aggregate check, review and
  visual checks get no artificial command.
- Plan discovery: a partly answered question is asked only for its open part; a fully
  settled brief gets no discovery question; the design question follows the same rule.
- A focused trial record from a packed kit installed into a copy of the interactive
  fixture (`docs/trial-2026-09-10-prd-v3.md`), with the eligible case observed live.

## What was cut and why

- Live observation of the R-01 negative scenario with a persistent failure: not
  constructible on the dependency-free fixture without a source change; attempted
  with an environment fault that the agent bypassed. Recorded in the PRD's Out of
  Scope by the evaluator, pending user confirmation.
- Out of scope by the PRD itself: runtime log capture and automated recovery (M1),
  validator heuristics for prose commands, the `4xx` wording leak, `verify` re-stamp on
  success.

## Known issues

- The exception says the block must pass "when run directly" but not in which
  environment; in the trial the agent chose the working binary over the session's
  broken `PATH`. Trial finding 1; candidate for a follow-up PRD together with the
  negative-scenario observation.
- T-25's Verification clause `git diff --quiet HEAD -- pincer-evidence.cjs
  test/evidence.test.js` proves nothing on re-verify after commit; `test/evidence.test.js`
  inside `npm test` is the durable guard.
- `npm audit` remains `unverified` (no lockfile, no dependencies).

## What I would do next

Release this candidate, then a small follow-up PRD: tighten "run directly" to "the
recorded failure is explained by a working-tree change since reverted; any other
cause is fixed first and re-run through `verify`", and design a fixture with an
external dependency so the negative scenario can be observed. Then the M1 runtime.

## Handover

Read `docs/wiki/briefing.md` first, then `.prd/prd-v3.md` and the two trial records
from 2026-09-10. The kit has no runtime dependencies; `npm test` runs twelve suites
under `node --test`, of which `test/workflow.test.js` pins playbook wording and
`test/distribution.test.js` fails on stale generated output. Every edit under
`template/` must be followed by both generators. The riskiest assumption is that an
agent reads the recovery section when a ticket is in a failed state; the two live
sessions did, the wording tests cannot check it. The least-tested path is the
recovery exception under a real environment failure: the only attempt was bypassed,
and the wording does not yet say which environment counts.
