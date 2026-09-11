---
prd: .prd/prd-v4.md
base: 6771fbcc08bcac866037a9aa45af75fc07599ce1
candidate: 1a7fb7873b14e305197fd23b17df8a39699be72a
evidence: .prd/evidence/prd-v4/1a7fb7873b14e305197fd23b17df8a39699be72a/manifest.json
---

# Evaluation — PRD v4: Record verification automatically and invalidate stale evidence

Reviewed candidate `1a7fb78` against base `6771fbc` (main after the wiki commit that
recorded the PRD draft, before `Add PRD v4`), tickets T-29..T-46 on `feat/prd-v4`.
Evidence manifest: see frontmatter (schema 1, authored with the pinned v0.4.1 kit
because this repository is deliberately not migrated, PRD v4 §9); validated with
`node <pinned kit>/scripts/pincer-evidence.cjs validate <manifest> --candidate 1a7fb78… --base 6771fbc… --prd .prd/prd-v4.md`.

## Requirement dispositions

| Requirement | Disposition | Where it lives | Checks |
| --- | --- | --- | --- |
| R-01 correct recovery without erasing failures | delivered | T-29 (legacy exception tightened, service fixture), T-36/T-39 (migrated recovery through attempts), T-41 trial scenarios (c) and (e) on both kits | C-01, C-07, C-08; remaining-source live case outstanding (deterministic in `test/recovery.test.js`) |
| R-02 one runtime, explicit identity | delivered | `identity.cjs`, `register`, wrappers (T-32, T-36), playbook steps (T-42), `.pincer/` ignored on register (T-43) | C-01, C-07 |
| R-03 attempts from actual execution | delivered | `runner.cjs`, `sanitize.cjs` (T-35, T-44), record validation before any outcome counts (T-45) | C-01, C-07 |
| R-04 readiness bound to inputs | delivered | `source.cjs`, `parse.cjs` normalizations, before/after snapshots (T-31, T-32, T-35), captured logs bound to their recorded digests (T-45) | C-01, C-07 |
| R-05 durable transitions, recoverable interruptions | delivered | `state.cjs` (rename-based lock, stale claim, recover), runner timeout and signals (T-34, T-35, T-44), group termination after the shell exits and bounded drain (T-45) | C-01, C-07 |
| R-06 operational records separate from product changes | delivered | `.pincer/runtime/`, `lifecycle.cjs` closure, guard (T-36, T-43, T-44) | C-01, C-07 |
| R-07 exported evidence, read-only release | delivered | `evidence.cjs` schema 2 + export, `check`, provenance and newer-attempt rule (T-38, T-39, T-44), export refuses malformed records and altered logs (T-45); observed live in the greenfield trial | C-01, C-07, C-08 |
| R-08 state explained without an LLM | delivered | `readiness.cjs`, `status.cjs`, `ready` (T-33, T-39, T-44); malformed records and altered logs named by reason code (T-45) | C-01, C-07 |
| R-09 installations preserved, explicit migration | delivered | `migrate.cjs`, `bin/pincer.js` doctor, packaging parity (T-30, T-37, T-40, T-43, T-44) | C-01, C-02, C-06, C-07 |
| R-10 behavior demonstrated, friction recorded | delivered | failure-injection suites (S-30); `docs/trial-2026-09-11-prd-v4.md` (S-31 on Claude Code `-p` + Sonnet; other surfaces untested) | C-01, C-07, C-08 |

Coverage review: the per-scenario table in `docs/prd-v4-review-packet.md` maps every
S-01..S-31 to a suite or the trial record; the packet and the manifest agree. Whether
the fixture suites are adequate proof of the runtime is my judgment as evaluator; the
reviewer confirmed no assertion is vacuous and every suite drives real subprocesses.

## Evaluation history

- Candidate `7b561b1` (T-29..T-43 plus `PRD v4: built`) was reviewed by two subagents
  applying the code-quality rubric: one over the runtime code and tests, one over
  docs, playbooks, installer, packaging and records. Eighteen findings
  (`review/code-quality.md` in the evidence directory): one high (the ticket guard
  blocked the documented evidence-draft location), five medium in the runtime (stale-lock
  reclaim race, `recover` never escalating to SIGKILL, a missing pointed-at record
  falling back to an older pass, a contract disagreement on partial migration, a
  sanitizer gap for `Basic`/quoted values), four low, and eight documentation and
  packaging items. T-44 fixed sixteen with assertions; the obsolete `pincer-ticket-lib.sh`
  left on disk by `update` and the README's release number are recorded as known
  issues. Candidate `77c5205` (T-44 plus the wiki commit) re-ran every check; the
  evaluator checked each finding against it rather than re-dispatching the reviewers.
- Candidate `77c5205` was then reviewed externally with a reproduction script against
  the runtime itself: a record stripped to `{id, outcome}` closed a ticket (readiness
  guarded every field), a `stdout.log` replaced after the run was exported as runtime
  evidence with readiness green (recorded digests were never compared), and
  `sleep 9 & exit 0` under a 1 s timeout ran 9.2 s (`terminate()` skipped an exited
  shell). All three reproduced here and became T-45 (`2ff2b1a`): record schema and
  context-identity validation before any outcome counts, log digests checked by
  readiness and export, `recover` recording the digests of what a dead runner
  captured, and group termination independent of the shell's exit with a 2 s drain
  bound after SIGKILL; each has a failing-before assertion. The T-45 diff was then
  sent to one reviewer subagent (section 2 of `review/code-quality.md`): five Low
  findings (a limitation naming signals never delivered, pre-T-45 `recover` records
  reported as malformed, the contract overstating validated fields, a passing record
  copied over the pointed-at failed one accepted, a group-id reuse window). T-46 fixed
  the first four with assertions and recorded the fifth as a contract limit. Candidate
  `1a7fb78` (T-46 plus the wiki commit) re-ran every check; the T-46 diff was
  checked by the evaluator against each finding, not re-sent to the reviewer.
- The live trial (T-41) itself produced T-42 and T-43 before the first candidate.

## What was built

A dependency-free Node runtime (`template/scripts/pincer-runtime.cjs` +
`template/scripts/pincer-runtime/`, Node 18+) that now owns the ticket lifecycle,
readiness and status (human and `--json`), change registration
(`.prd/changes/<id>.json` with a PRD content revision and recorded authorization), a
SHA-256 source manifest, verification attempts with sanitized captured logs under the
ignored `.pincer/runtime/`, an exclusive lock with deterministic `recover`, explicit
`migrate --preview|--apply` with backups, candidate `check`s and evidence schema 2
export. `pincer-ticket.sh` and `pincer-status.sh` are wrappers; the Bash policy
library is gone; the guard protects `.pincer/runtime/`, `.pincer/backups/` and
`.prd/changes/`. Unmigrated projects keep the v0.4.1 receipt contract. The legacy
recovery exception was tightened first (T-29) so it can ship on its own. The contract
is `template/docs/runtime-contracts.md`; the review packet for the user's later check is
`docs/prd-v4-review-packet.md` with `docs/prd-v4-artifacts/`.

## What was cut and why

Nothing from the PRD's scope. The follow-up PRDs of section 10 (lifecycle and resume,
mechanical coverage impact, platform parity and measured quality) were never in scope.

## Known issues

- `pincer update` from 0.4.x leaves `scripts/pincer-ticket-lib.sh` on disk; `doctor`
  names it as obsolete and the README says it is safe to delete; the installer never
  deletes files (open thread: decide whether it should).
- The README names the runtime release v0.5.0; the documented `npm version patch` flow
  would produce 0.4.2. The bump must be `minor` (0.5.0) with the plugin rebuilt.
- `MIGRATION_REQUIRED` is a documented reason code that status never emits (it reports
  `LEGACY_RECEIPT` instead).
- A check that writes untracked, non-ignored files ends `error` (`SOURCE_CHANGED`)
  unless those paths are ignored or listed in `.prd/source-exclude`; a kit update
  inside a migrated project makes every done ticket `SOURCE_CHANGED` until re-verified.
- Process cleanup relies on POSIX process groups; a grandchild that leaves the group
  survives. A check that exits 0 leaving a background child on its output pipes is
  `timed_out`, not `passed` (T-45); a check that starts a daemon must detach it.
  Windows is unsupported.
- Attempt records finalized by a `recover` older than T-45 carry no log digests; they
  read as `ATTEMPT_INTERRUPTED` (T-46) and `evidence export` refuses them.
- A descendant that leaves the process group (`setsid`) cannot be terminated; the run
  is abandoned 2 s after the SIGKILL point and the record says so. Between the SIGTERM
  and SIGKILL attempts an already-empty group's id could be reused by an unrelated
  process (pid wraparound within 5 s); accepted as a limit in the contract.
- Record and log validation is mistake detection: a rewrite of both a record and its
  log that keeps them consistent is undetectable, as the contract states. CI has not run on `feat/prd-v4`; Node 18 and
  ubuntu are untested for the runtime in this evaluation.
- The sanitizer covers documented patterns only; checks must avoid printing secrets.
- The trial covered Claude Code print mode with Sonnet only.

## What I would do next

Push the branch and let CI run the matrix before merging; bump to 0.5.0 and publish;
trial the runtime on Codex, Copilot and the plugin; then the section 10 follow-ups,
starting with lifecycle and resume (change selection, pause/reopen/supersede).

## Handover

Read `docs/wiki/briefing.md`, then `template/docs/runtime-contracts.md` (the contract
every runtime behavior is pinned to) and `docs/wiki/systems/runtime.md` (module map and
gotchas). The runtime has no dependencies by design: Node built-ins, `bash` for the
Verification blocks, `git` for identity; the plugin and every installer layout bundle
the same files (`test/distribution.test.js` compares their digests). What breaks first
as the code ages: the source manifest hashes every tracked and untracked non-ignored
file on each `verify`, `done` and `status` in migrated mode, so large repositories will
feel it before anything else; and the sanitizer's regexes are the one place where a
careless edit can reintroduce quadratic backtracking (the first version hung on a
64 KB line). The least-tested path is the stale-lock claim race, which is reasoned
about and covered by a static fixture rather than a reproducible concurrent race.
Readiness trusts nothing in a record it has not validated (`state.validateAttempt`,
T-45/T-46): a new field the runner writes and readiness or export reads must be added
there, every path that finalizes a record must set `finished` and the log digests, and
the record must carry the id the index points at.
This repository stays in legacy mode on purpose; its own tickets were verified with a
pinned copy of the v0.4.1 kit (`git show 1cb5ab4:template/scripts/<file>`).
