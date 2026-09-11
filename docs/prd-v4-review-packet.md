# PRD v4 review packet — record verification automatically and invalidate stale evidence

Prepared for the later implementation check requested in `.prd/prd-v4.md` section 8.
Everything here is reproducible from the branch; nothing below claims an observation
that was not made. Rows marked `outstanding` are not passed gates.

## 1. Implementation reference

- Branch: `feat/prd-v4`, base `1cb5ab4` (v0.4.1, the commit the PRD names). The PRD was
  committed as `4369af5` and decomposed into T-29..T-41 (`6604241`), with T-42 and T-43 added from trial findings.
- Candidate commit: recorded in `NOTES.md` by `/pincer-evaluate` once T-41 is closed and
  the PRD is `built`; this packet is finalized before that candidate is chosen.
- Changed behavior, in one paragraph: a dependency-free Node runtime
  (`template/scripts/pincer-runtime.cjs` + `template/scripts/pincer-runtime/`) now
  implements the ticket lifecycle, readiness, status (human and JSON), change
  registration, source identity, verification attempts with sanitized captured logs,
  locking and crash recovery, explicit migration with backups, candidate checks and
  evidence schema 2 export. `pincer-ticket.sh` and `pincer-status.sh` delegate to it and
  the Bash policy library is gone. Unmigrated projects keep the v0.4.1 receipt contract
  byte for byte where tests pinned it. The legacy recovery exception is tightened
  (since-reverted source change, same execution context, unexplained failures stay).
- PRD revisions during implementation: none. Two contract clarifications were made in
  `template/docs/runtime-contracts.md` in the same commits as the code: the lock wait
  bound is overridable (`PINCER_LOCK_WAIT_MS`), a `check` accepts an evidence-only
  descendant of the candidate as a clean view, `change.base` in a schema 2 manifest is
  the registration base and may precede the evaluation base, and the validator keeps
  printing `ok <candidate>` for schema 1 (appending `schema 2` only for schema 2).

## 2. Traceability

Deterministic suites run under `npm test`; "trial" means a live agent observation
recorded in `docs/trial-*-prd-v4.md` (T-41).

| Requirement | Scenarios | Implementation | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| R-01 correct recovery without erasing failures | S-01, S-02, S-03 | T-29 wording in `pincer-code.md`, `pincer-status.md`, dry-run checklist; T-36/T-39 migrated lifecycle and recovery paragraph | `test/recovery.test.js` (service fixture, remaining-source case, guard), `test/runtime-lifecycle.test.js` (S-01 after migration), `test/workflow.test.js` wording; live (c) and (e) on both kits in the trial record | delivered |
| R-02 one runtime and explicit evidence identity | S-04, S-05, S-06 | `identity.cjs`, `register`, wrappers (T-32, T-36) | `test/runtime-identity.test.js`, `test/runtime-lifecycle.test.js` (legacy parity) | delivered |
| R-03 record attempts from actual execution | S-07, S-08, S-09, S-10 | `runner.cjs`, `sanitize.cjs` (T-35) | `test/runtime-runner.test.js` | delivered |
| R-04 bind readiness to reproducible inputs | S-11, S-12, S-13, S-14 | `source.cjs`, `parse.cjs` normalizations, runner before/after snapshots (T-31, T-32, T-35) | `test/runtime-parse.test.js`, `test/runtime-identity.test.js`, `test/runtime-runner.test.js` | delivered |
| R-05 durable transitions, recoverable interruptions | S-15, S-16, S-17 | `state.cjs` lock/index/journal/recover, runner timeout and signals (T-34, T-35) | `test/runtime-state.test.js`, `test/runtime-runner.test.js` | delivered |
| R-06 operational records separate from product changes | S-18, S-19, S-20 | `.pincer/runtime/`, `lifecycle.cjs` done semantics, guard (T-36) | `test/runtime-lifecycle.test.js`, `test/hooks.test.js` | delivered |
| R-07 export candidate evidence, keep release read-only | S-21, S-22, S-23, S-24 | `evidence.cjs` schema 2 + export, `check`, status provenance and newer-attempt rule, release playbook (T-38, T-39) | `test/runtime-evidence.test.js`, `test/evidence.test.js`, `test/runtime-status.test.js` | delivered |
| R-08 explain current state without an LLM | S-25, S-26 | `readiness.cjs`, `status.cjs`, `ready` (T-33, T-39) | `test/runtime-status.test.js` (legacy and migrated tables, human/JSON/done/ready agreement) | delivered |
| R-09 preserve installations, migrate explicitly | S-27, S-28, S-29 | `migrate.cjs`, `bin/pincer.js` doctor, packaging (T-37, T-40) | `test/runtime-migrate.test.js`, `test/installer.test.js`, `test/smoke.test.js`, `test/distribution.test.js` | delivered |
| R-10 demonstrate behavior, record friction | S-30, S-31 | every runtime suite injects incorrect behavior; T-41 live trials | all suites above; `docs/trial-2026-09-11-prd-v4.md` | delivered (S-31 observed on Claude Code `-p`, Sonnet; other surfaces untested) |

Scenario table (one row per S-NN):

| Scenario | Where it is exercised | Disposition |
| --- | --- | --- |
| S-01 reverted regression: legacy exception before migration, retained failure plus new pass after | `test/recovery.test.js` guard block (legacy), `test/runtime-lifecycle.test.js` "S-01 after migration" | delivered |
| S-02 required service unavailable, unchanged source | `test/recovery.test.js` local-service block (`test/fixtures/local-service.cjs`); live scenario (e) in `docs/trial-2026-09-11-prd-v4.md` on both kits | delivered |
| S-03 remaining source changes are reported, never discarded | `test/recovery.test.js` remaining-source block | delivered |
| S-04 identical commands in two PRDs do not share readiness | `test/runtime-identity.test.js` | delivered |
| S-05 PRD content edit invalidates the binding; status change does not; explicit rebind | `test/runtime-identity.test.js`, `test/runtime-status.test.js` | delivered |
| S-06 missing, duplicate, malformed, unsupported, ambiguous identifiers diagnosed before launch | `test/runtime-identity.test.js`, `test/runtime-runner.test.js` (REVISION_CHANGED refuses before a child starts) | delivered |
| S-07 stdout/stderr markers and nonzero exit captured | `test/runtime-runner.test.js` | delivered |
| S-08 green → running → red never ready | `test/runtime-runner.test.js` | delivered |
| S-09 missing executable, unwritable state, capped output | `test/runtime-runner.test.js` | delivered |
| S-10 inspection creates nothing; verify always creates an attempt | `test/runtime-runner.test.js` | delivered |
| S-11 every source change class makes a pass stale | `test/runtime-identity.test.js` (static), `test/runtime-runner.test.js` (dynamic) | delivered |
| S-12 attempts and checkbox ticks keep the digest; text and exclusions change it | `test/runtime-identity.test.js`, `test/runtime-parse.test.js` | delivered |
| S-13 zero-exit check that mutates source is not evidence | `test/runtime-runner.test.js` | delivered |
| S-14 secret, symlink, ignored dependency, unsupported repository | `test/runtime-identity.test.js` | delivered |
| S-15 overlapping writers | `test/runtime-state.test.js` | delivered |
| S-16 SIGINT, SIGTERM, timeout, forced termination | `test/runtime-runner.test.js` | delivered |
| S-17 grandchild terminated; interrupted writes diagnosable | `test/runtime-runner.test.js`, `test/runtime-state.test.js` | delivered |
| S-18 two verifies, no tracked diff; done without a duplicate run | `test/runtime-lifecycle.test.js` | delivered |
| S-19 stale inputs, later failure, missing log, missing state, unticked criteria block closure | `test/runtime-lifecycle.test.js` | delivered |
| S-20 deleted state cannot revive a receipt; fresh clone must verify | `test/runtime-lifecycle.test.js` | delivered |
| S-21 exported evidence matches attempts; tamper, wrong candidate, missing artifact block | `test/runtime-evidence.test.js` | delivered |
| S-22 receipt-free verification creates no product diff; evidence-only path keeps the candidate current | `test/runtime-evidence.test.js`, `test/runtime-lifecycle.test.js` | delivered |
| S-23 schema 1 inspectable with a legacy label, cannot satisfy a runtime requirement | `test/runtime-evidence.test.js`, `test/runtime-status.test.js` | delivered |
| S-24 newer same-context failure blocks release; fresh clone reports the limit; release creates nothing | `test/runtime-status.test.js` | delivered |
| S-25 stable reason code and next action per failure fixture | `test/runtime-status.test.js` | delivered |
| S-26 human, JSON, closure and release agree; no secret values in JSON | `test/runtime-status.test.js` | delivered |
| S-27 clean, customized, ambiguous, partly migrated, legacy fixtures | `test/runtime-migrate.test.js` | delivered |
| S-28 packed layouts and plugin carry the identical runtime and execute the compatibility commands | `test/distribution.test.js` | delivered |
| S-29 supported syntax passes, malformed forms fail before mutation, installer conflicts stay green | `test/runtime-parse.test.js`, `test/validation.test.js`, `test/installer.test.js` | delivered |
| S-30 deterministic tests detect each injected false-ready condition | all runtime suites | delivered |
| S-31 live trials: runtime use, preserved edits, no repeated approval, no manual receipt restoration | `docs/trial-2026-09-11-prd-v4.md` scenarios (a)–(e), baseline (c) and (e) | delivered on one surface (Claude Code `-p`, Sonnet, macOS); other surfaces untested |

## 3. Contracts

`template/docs/runtime-contracts.md` (shipped with every layout and the plugin) is the
final contract: modes, commands and exit codes, supported grammar, change binding,
content revisions, source manifest and exclusions, attempts and locking, capture and
sanitization limits, reason codes and status JSON, evidence schema 2, migration and
rollback, legacy compatibility, platform limits. `test/contracts.test.js` pins it.

## 4. Verification record

Run at the candidate and recorded by `/pincer-evaluate` as evidence; the commands are:

- `npm test` — the full suite: smoke, installer, ticket, validation, verification,
  behavioral-verification, evidence, candidate, recovery, hooks, runtime-parse,
  runtime-identity, runtime-state, runtime-status, runtime-runner, runtime-lifecycle,
  runtime-migrate, runtime-evidence, workflow, contracts, distribution.
- `node test/distribution.test.js` — packed tarball installs for Claude-only,
  Codex-only, Copilot-only and all-platform layouts plus the plugin, runtime digests
  compared, compatibility commands executed from each installed copy.
- `bash template/scripts/sync-prompts.sh && bash scripts/build-plugin.sh` followed by
  `git status --short -- template plugin` — generator parity.

## 5. Representative artifacts

Copied from a fixture run of the runtime at T-40 into `docs/prd-v4-artifacts/`
(hostnames and temporary paths replaced):

- `attempt-passed.json`, `attempt-failed.json`, `attempt-interrupted.json` — attempt
  schema 1 records (the interrupted one from SIGINT during a `sleep`).
- `status-stale-source.json` and `.txt` — status after a source edit following a pass
  (`SOURCE_CHANGED` naming the path, next action `verify`).
- `manifest-schema-2.json` and `exported-C-01.log` — an exported candidate manifest with
  a runtime command check and an authored review check.
- `sanitized-stdout.log` — captured output with an API key and a bearer token redacted.

## 6. Live trials

`docs/trial-2026-09-11-prd-v4.md` records the prompts, Claude Code and model versions,
tarball digests, the greenfield chain (plan → narrow → code → evaluate → release on the
runtime, schema 2 evidence, release PASS), the existing-project migration with
preserved user edits, failure/repair, interruption/resume and the persistent
service-failure scenario, plus the bounded v0.4.1 baseline comparison for (c) and (e):
the runtime needed no receipt-refresh commit and left no tracked diff where the
baseline did. Session outputs are in `docs/prd-v4-artifacts/trial-logs/`. Two tickets
came out of the trial: T-42 (register/migrate steps in the playbooks) and T-43
(`register` ignores `.pincer/`).

## 7. Known limitations

- Process cleanup uses POSIX process groups: a grandchild that calls `setsid` or
  otherwise leaves the group is not terminated. Native Windows is unsupported.
- Source equality does not prove environment freshness; external services and ignored
  dependencies are recorded as limitations, not verified inputs.
- A check that writes untracked, non-ignored files (build outputs, coverage) makes its
  attempt `error` (`SOURCE_CHANGED`) unless those paths are ignored or declared in
  `.prd/source-exclude`; that is the contract, and it costs a setup step in projects
  that do not ignore their outputs.
- The sanitizer covers the documented patterns only; checks must avoid printing secrets.
- The source snapshot hashes every tracked and untracked non-ignored file on each
  `verify`, `done` and `status` in migrated mode; large repositories pay that cost.
- Legacy provenance: schema 1 manifests remain authored records; migration never
  relabels a legacy receipt as runtime evidence.
- A fresh clone validates the saved candidate record only; done tickets need a local
  `verify` before dependents can start there.
- A kit update inside an evaluated project is a source change: every done ticket's
  attempt becomes `SOURCE_CHANGED` until re-verified (trial finding 2).
- Dogfooding: this repository was not migrated during the work (PRD section 9), so its
  own evaluation of PRD v4 uses the pinned v0.4.1 kit and schema 1 evidence; the
  runtime's behavior is demonstrated in fixtures and in the T-41 trial repositories.
