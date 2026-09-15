# Open threads

## Release state of 0.6.0 (2026-09-14)

**Resolved 2026-09-14:** the evaluation, the bump and the tag are all on `origin/main`
(`350823e`, `566b553`, `694241c` are ancestors; the remote tag `v0.6.0` resolves to
`694241c`). The two threads claiming they were local-only were wrong for this checkout
and are deleted rather than carried.

- [2026-09-14] `npm version minor` was run without `--no-git-tag-version` and without
  rebuilding, leaving `plugin/.claude-plugin/plugin.json` at 0.5.0 and
  `test/distribution.test.js` red. Fixed by re-running `scripts/build-plugin.sh`.
  Worth making the bump a script that cannot be run the wrong way
  ([[distribution-channels]])
- [2026-09-14] **Every release invalidates its own evaluation.** A version bump is a
  post-candidate commit, so `status` reads `stale: candidate changed after evaluation:
  package.json` from the bump onward, and so would a wiki edit. Decide whether
  `notes_current` should exempt a version-only change to `package.json`, or whether
  `stale`-after-release is simply correct and the release audit should be the thing that
  runs before the bump ([[candidate-evidence]])

## Coverage, evidence and the runtime

- [2026-09-12] No live run has ever adopted strict coverage: the v6 briefs are
  single-change tasks, so `coverage adopt`, the strict check path and evidence schema 3
  are covered only by suites and the eight replay cases ([[strict-coverage]])
- [2026-09-14] PRD v5 has an authored and reviewed disposition record and a bound review
  packet, but not a validator-checked manifest of its own — one candidate carries one
  manifest, and v6 is the selected PRD ([[candidate-evidence]])
- [2026-09-14] The stale-lock reclaim window in `state.cjs` was reported by the
  evaluation review but did not reproduce under 20×8 and 25×32 concurrent writers. It is
  carried as analysis, not as a defect; a reproduction would change that ([[runtime]])
- [2026-09-12] Generic-continue residual, re-tested by v6 S-27: across six live
  scope-revision runs no session recorded an authorization from the generic instruction
  (kit arm 3/3 surfaced the revision, plain arm 2/3). The v5 residual was not reproduced,
  but a runtime-side guard (refuse a `user` authorization whose excerpt matches no
  revised content) is still unbuilt ([[strict-coverage]])
- [2026-09-12] Review packet deviation 6 needs a reviewer's confirmation: execution
  against an unreadable selected record is refused as `SELECTION_INVALID` (exit 1) naming
  `HISTORY_INVALID`, while inspection exits 4 ([[runtime]])
- [2026-09-12] After T-64, a second change's evaluation being assembled on a shared
  candidate (artifacts written, manifest not yet exported) makes the first change's
  readiness transiently `stale: working tree has changes outside the candidate's
  evidence` until the export and commit; conservative by design, but worth a note in the
  evaluate playbook if it confuses a trial ([[runtime]])
- [2026-09-08] R-05 "new consequential decision during narrow" and the
  interrupt-and-resume scenario were never observed live (R-06 failed recheck was, on
  2026-09-10) ([[candidate-evidence]])
- [2026-09-08] The PRD v1 evaluation (legacy NOTES.md, no evidence manifest) survives
  only in git history before `6518cfb`; the v1 evidence gap is by design
  ([[candidate-evidence]])

## Benchmark

- [2026-09-12] The delivery benchmark showed no acceptance advantage and ~4.7x cost for
  the kit arm on six bounded single-change briefs (n=3 per cell). Whether the workflow
  pays off needs briefs with real multi-session continuity, which this set does not have
  ([[delivery-benchmark]])
- [2026-09-14] The freeze does not cover the benchmark's live driver (`run-live.sh`,
  `session.cjs`, `effort.cjs`), which changed mid-benchmark while `check-freeze` stayed
  green. Freezing the whole evaluation path is a change to the benchmark contract and
  belongs to a later PRD ([[delivery-benchmark]])
- [2026-09-14] `docs/delivery-benchmark.md` describes the escaped-regression measure as
  stronger than it is (only `bugfix-brownfield` has a hidden regression test). It is
  inside the freeze, so the wording waits for the next legitimate protocol revision
  ([[delivery-benchmark]])

## Tooling and platforms

- [2026-09-12] Claude Code ticket guard false positive: a compound
  `git add .prd/changes/… && git commit -m "$(cat <<'EOF' … <noreply@…> EOF)"` is refused
  (the lexer reads `<…>` in the heredoc as a redirect next to a protected path); split
  add and commit, or fix the lexer. T-81 closed the *real* redirection hole next to it,
  not this false positive ([[ticket-state-machine]])
- [2026-09-12] Trial-fixture lesson: `"test": "node --test test/"` fails on Node 22.23
  (bare directory arg); use `node --test`. Pre-authoring a later ticket's test file makes
  an earlier ticket's `npm test` check unpassable ([[runtime]])
- [2026-09-14] `npm test` is 51 suites and ~10 minutes, dominated by
  `delivery-benchmark`; `verify`/`done` on a ticket whose check is `npm test` runs it
  twice. If that becomes a problem, split the chain into a fast suite and a slow one
  rather than dropping the fault-injection coverage ([[delivery-benchmark]])
- [2026-09-11] Sandbox limit observed: `node <file> <long argv>` SIGKILLed in the Claude
  Code Bash tool; feedback drafted; CI is unaffected ([[runtime]])
- [2026-09-11] `pincer-ticket-lib.sh` is no longer shipped but `pincer update` leaves the
  old copy in installed projects; decide whether the installer should remove obsolete
  files ([[cli-installer]])
- [2026-09-11] The runtime trial covered Claude Code `-p` + Sonnet only; Codex, Copilot,
  plugin and Windows are untested for the runtime
  (`docs/trial-2026-09-11-prd-v4.md`) ([[runtime]])
- [2026-09-02] No trusted-publishing workflow (OIDC, publish on tag); CI runs tests only
  ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit copy with no
  back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local marketplace
  add path documented in README) ([[distribution-channels]])
- [2026-09-02] Codex supports hooks now; port `hook-policy.cjs` as a Codex hook adapter
  (README wording already corrected) ([[distribution-channels]])
- [2026-09-02] Codex: the `$pincer-plan` → `$pincer-release` chain is untested on Codex
  ([[cli-installer]])
- [2026-09-04] Copilot: `/pincer-*` prompt-file chain in VS Code untested end to end
  ([[distribution-channels]])
- [2026-09-14] PRD v7's live work is unstarted: three baseline pilots, two platform journeys plus a handoff, 72 benchmark runs and timed reviews by two non-implementing people. Needs project selection and access, a costed spending cap and wall-clock cap, reviewers, and reviewers. The Codex CLI is no longer among them — T-98 pinned it at 0.153.4. ([[v7-measured-friction]])
- [2026-09-14] No v7 candidate is selected and no v7 evidence exists; NOTES.md still names the v6 evaluation. Authored docs and metadata are finished, so the candidate can be chosen cleanly. ([[candidate-evidence]])
- [2026-09-14] Three v7 benchmark faults are not separable from adjacent checks; the suite asserts the intended evaluator is among the failures, not alone. The UI browser adapter is a deterministic fake proving the seam, not a browser. ([[v7-measured-friction]])
- [2026-09-14] Remote publication state of 0.6.0 is unverified: the reconciliation speaks only about this checkout, never the server.

## PRD v7 live execution (2026-09-14)

- [2026-09-14] **Nothing live has run, and four prerequisites are outstanding**: a costed
  spending cap, a wall-clock cap, three pilot projects with an access decision, and two
  non-implementing human reviewers. The reviewers are not a budget item — the implementing
  agent is `REVIEW_NOT_INDEPENDENT` by construction ([[v7-measured-friction]])
- [2026-09-14] **Browser tooling is unreachable from a driven session.** Chrome is
  installed but no binary is on PATH inside a `claude -p` run, so the `ui-states` brief's
  held-out check is `unverified`, which makes those runs `unavailable` — never accepted.
  Decide whether to configure an adapter or to record the gap ([[fix-the-driver-before-run-one]])
- [2026-09-14] **The GitHub MCP server is failing to connect** (400, badly formatted
  Authorization header). `gh` works, so nothing is blocked, but remote-state checks go
  through the CLI until it is fixed

## The 2026-09-15 assessment, verified 2026-09-15

Five findings against the v7 benchmark orchestrator, each reproduced offline with
stand-in CLIs and zero paid sessions. None touches shipped code ([[v7-execution-gaps]]).

- [2026-09-15] **Every record the orchestrator writes fails its own validator.**
  `driveRun` never fills `reported`, never observes adoption and never calls
  `effort.problems()`; `claimRerun` sets a `reason` on a `pending` record, which
  `effort.cjs:124` rejects outright.
- [2026-09-15] **The strict arm is not an arm.** `pincer` and `strict` get byte-identical
  workspaces and byte-identical argv, so a third of the schedule buys a duplicate of
  another arm, and no strict run can ever be reported.
- [2026-09-15] **The preservation check is dead in the orchestrator path.** No brief
  supplies unrelated edits, `prepare`’s return value is discarded and `effort.empty()`
  has no `workspace` key, so all 72 runs would print `0 unrelated edit(s) intact` — a
  fabricated pass. Wiring it on without reordering the kit install would instead fail 12
  of 72 cells against the kit arms.
- [2026-09-15] **A crash inside a cell repeats its paid sessions and contaminates the
  base.** Verified by kill test: six stand-in sessions billed for a three-session cell,
  and the dead attempt’s commits swept into the restarted run’s `provenance.base`.
- [2026-09-15] Execution inputs are never reconciled with the freeze: `driveRun` takes
  cohort, model and caps from its caller and compares them with nothing.
- [2026-09-15] The orchestrator has **no operator entry point** — no `require.main`, no
  npm script, no documented invocation — so an operator must hand-write exactly the
  unfrozen caller the freeze exists to eliminate.
- [2026-09-15] A cap-less dry run writes `outstanding`, which `driveRun` then skips
  forever and `claimRerun` refuses to replace. The cell is stranded and the study can
  never read `complete`.
- [2026-09-15] `ui-states` is structurally `unavailable`: `browser` defaults to `null`
  through `driveSchedule`, which has no parameter to supply an adapter, so 9 of 72 runs
  can never be accepted whatever the agent writes.
