# Open threads

## Release state of 0.6.0 (2026-09-14)

- [2026-09-14] **The evaluation is not on main.** PR #1 merged `feat/prd-v6` at the
  candidate `ce98abd` — main's tree is byte-identical to it — but the evaluate commit
  `350823e` had not been pushed, so `main` carries the v5+v6 code under **PRD v4's**
  NOTES.md and evidence. `NOTES.md` and `.prd/evidence/prd-v6/ce98abd…/` exist only in
  the local branch ([[candidate-evidence]])
- [2026-09-14] **npm has 0.6.0; no public ref does.** The bump commit `566b553` and the
  tag `v0.6.0` are local-only, and `main`'s `package.json` still says 0.5.0. The
  published tarball is reproducible from main — unpacking `pincer-workflow@0.6.0` and
  diffing against `git archive origin/main` shows `bin/`, `template/`, README and LICENSE
  byte-identical, `version` the only difference — but nobody can find the commit it was
  cut from ([[distribution-channels]])
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
