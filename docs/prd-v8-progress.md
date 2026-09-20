# PRD v8 implementation progress

## Execution basis — 19 September 2026

User instruction: “can you make sure the PRD v8 and its tickets get implemented? you
might use other agents to work on the tasks so that context gets managed properly
and you Astra check their work so that we stay efficients in tokens”. This authorizes
implementation and bounded delegation within PRD v8. The primary agent reviews work,
verifies tickets and owns commits. Live spending, project access and independent human
reviewer selection remain concrete execution inputs, not inferred allocations.

- Branch: `feat/prd-v8`, based on planning commit `c7cb6bc`.
- Management: legacy mode retained as specified by the PRD.
- Independent management kit: `v0.6.0` (`694241c`), `template/scripts/` extracted to
  `/tmp/pincer-v8-management-694241c/scripts/`. Aggregate SHA-256 over sorted
  relative-path + NUL + content is
  `c0354c6452d0f5605a7d5a28c385321df4fc7fe7b5fe46fd7d6284cfc1d35cb9`.
  This algorithm differs from earlier tree-digest algorithms; it identifies this extraction.
- User-owned untracked `docs/diagrams/` and `docs/pincer-workflow-guide.md` are preserved.
- Runtime status, ticket receipts and individual commits are authoritative for completion.

## Observational prerequisites

Project selection and two independent reviewers were requested while implementation
continues. No paid session has been launched. T-109 will prepare the numeric allocation,
wall-clock limits and exact launch manifest before any spending request. Implementation
checks cannot substitute for T-110 onward's live observations.

## Review and continuation

Start with this file, `docs/prd-v8-contracts.md`, the ticket map and runtime status.
Run ticket lifecycle commands through the pinned kit from the repository working
directory. Never edit lifecycle fields or close an observation with synthetic evidence.
Record completed tickets, review findings and current blockers below as work proceeds.

### T-100

Contracts and all 30 v7 scenario obligations reconciled. Static contract verification
includes 15 negative document mutations and a frozen-content mutation. Parent reviewed
the historical sequencing disposition, preservation boundaries and deferred findings.
Runtime readiness remains independent from authored documentation.

### T-101

Effective manifests now bind resolved tool/model/caps, kit bytes, browser closure and
all execution helpers. Existing-plan validation precedes writes. Parent reviewed the
secret/path boundaries and fixture-only session seam; focused suites passed. The static
v7 manifest was explicitly regenerated for the changed execution code. Historical cohorts
remain readable. Real orchestration refuses until T-102 supplies isolation; the old direct
shell entry is a known remaining boundary assigned to T-102, not live readiness.

### T-108

Release preparation is verified in disposable fixtures: preview/apply, packed layout,
idempotency, unrelated-work refusal, truncated writes and candidate freshness. Parent
review found and corrected API-only validation and partial-effects/idempotency gaps.
Distribution and historical-contract suites pass. No repository version was changed;
no candidate was selected, tagged or published.

### T-103

Independent-process controls prove one launch per cell, separate-cell concurrency,
exclusive rerun allocation, complete atomic checkpoints, and explicit dead-owner recovery.
Surviving inherited or registered detached children prevent reclaim. Parent review added
complete recovery-receipt publication and retry validation. The sandbox denies the process
group inspection needed by these tests; verification passed outside it. Ambiguous hosts
remain blocked rather than assumed dead. T-104 still owns checkpoint replay and attempts.

### T-102 — implementation verified, observation pending

Native and fixture sessions share explicit environment construction, a custody-registered
supervisor, incremental protected captures and bounded teardown. Parent review added
pre-workspace gating, preservation of kit discovery without duplicate hook registration,
and capture-I/O failure termination. The legacy bypass launch is disabled. Offline
verification passes; no native session occurred. Acceptance remains open for real CLI
authentication, kit discovery and managed policy. No API key is available in this session;
the user was asked whether to provide one through the environment.

### T-107

Real Chrome 153.0.8010.48 accepted the working UI and rejected five broken controls,
including transparent ancestors that pass markup checks. Observed timeouts with an active
server and SIGTERM clean up browser, profile and server; forbidden resource requests
remain blocked. Parent reviewed a retained screenshot and artifact bindings. Final runtime
provenance includes the full app bundle (674 files, seven confined internal links);
external/broken/cyclic links are refused. Preflight probes version, native input and
screenshot capability before measured UI preparation. No model session was used.
Latest runtime verification artifacts: `/var/folders/yc/tz09y39n7t7_h5wm36tdcgbh0000gn/T/pincer-browser-gate-zNm3ni`.

### T-104

Schema 8 records every attempt and durable session intent while preserving schema 7
readability. Real process kills exercise setup, session start/end, pre-evaluation and
streaming capture boundaries. Restart retains prior artifacts and reconstructs the exact
original base from verified Git objects in a sterile repository; interrupted commits,
hooks and replacement refs are excluded. Original unrelated file bytes have protected,
hash-bound recipes. Native legacy history without an original base is refused. Parent
and independent agent review added reverse session-ledger checks, safe recipe paths and
malformed-record handling. Measurement completeness remains T-105's next obligation.

The T-102 review also moved task text to stdin so flag-shaped prompts cannot change
launcher options. Its focused verification passed again; native observation remains open.

### Scheduling correction

Commit `c6090aa` repairs the smoke/observation dependency cycle without changing scope.
T-106 can proceed after T-105 using the verified T-102 implementation. T-110 now requires
both T-102 and T-109 complete. The separately authorized operational smoke may supply
T-102's native observations; offline fixtures cannot close them. Static graph checks cover
both the removed cycle and the retained measured-run gate.

### T-105

Versioned measurement blocks collect all recorded sessions across attempts. Each metric
has independent completeness and a measured subtotal; whole-tree tokens include cache
counts once, and provider/API duration remains distinct from wall time. Parent review
added pending-checkpoint refresh, contradictory provider-envelope refusal and explicit
unknown coverage for imported legacy attempts. Missing legacy attempts cannot become a
complete total. Invalid-run spend remains in accounting while acceptance denominators
remain separate. Provider semantics are in `docs/prd-v8-usage-semantics.md`; native payload
validation remains part of the operational smoke, not an offline claim.

### T-106

All launched terminal paths use the same accounting, protocol observation, validation
and atomic publication path. Actual persisted outputs validate for success, rejection,
unavailable evaluation, caps, account/provider errors and evaluator exceptions. Clean
prelaunch refusals remain pending and resumable. A capped candidate is independently
evaluated; a coincident execution error remains an invalid experiment and stops further
prompts. Accounting, validation and write faults retain private raw evidence with a
separately validated diagnostic and block retries until explicit operator disposition.
Diagnostic-storage failure retains ownership. No automatic diagnostic repair is provided.

### T-109 — offline implementation, execution decisions pending

The read-only manifest inspector binds actual decisions, project bases, complete
execution inputs and retained evidence. Missing inputs produce specific pending reasons
before any execution side effect. Evidence freshness includes the complete execution
identity, with only the native-observation reference excluded to avoid self-reference.
Prepared brief and kit-install commits now use a fixed preparation date so the approved
base is reproducible across machines; candidate commits retain their normal behavior.

The allocation ledger reserves one session at a time, requires cell custody and a
durable launch intent, consumes once in the registered supervisor, and reconciles
retained usage before further admission. It rechecks prior accounting before launch;
unknown spend, orphaned payloads, changed records, unresolved custody, quota limits or
overspending stop admission. Measured launch requires completed T-102 and T-109 receipts.
Offline tests cannot supply those observation receipts. Expired authorization permits
accounting-only settlement with a separate validated grant; all launch paths remain
blocked. Current empty capture files are allowed only for the exact reserved intent.
Parent review also bound every later session to the prepared project base and retained
independent capped-candidate evaluation when accounting stops the allocation.

The checked-in study manifest stays pending: no final execution candidate, project
access/bases, reviewers, user-approved allocation or native smoke evidence is invented.
T-110 onward remain gated on actual observations and their prescribed order.

## Integration verification

All 76 normal suites passed locally on 19 September 2026, including packed parity,
controlled process-custody and kill/restart faults, partial accounting, expiry settlement
and native-boundary cap evaluation. Review also added generic errors for malformed
private allocation metadata, with canary tests preventing content in error messages.
The actual Chrome fixture gate passed during T-107 verification. No paid model was used.

The T-109 runtime verification intentionally remains failed at `--require-ready`: its
offline suites pass, but actual study decisions and native observations are still absent.
T-102 retains its successful implementation receipt and unchecked native criteria.
Draft PR [#6](https://github.com/orchestratedbyalex/pincer-workflow/pull/6) tracks the
Ubuntu/macOS × Node 22/24 CI results for the final branch commit; do not infer a CI pass
from this journal entry.

### T-109 — execution package for the first operational smoke (19 September 2026)

Package: `docs/prd-v8-artifacts/execution/T-109-smoke-execution-package.md`, with the
proposed execution inputs beside it. No paid session, launch, external message, merge,
publication or new project access occurred; the pinned management kit was used for ticket
operations; `docs/diagrams/` and `docs/pincer-workflow-guide.md` are untouched.

Verified this session: the pinned kit extraction is byte-identical to `v0.6.0:template/scripts`
and its recorded digest reproduces; the installed Claude Code is 2.1.273 (sha256
`953e9880…`) and parses the profile's full argument vector; K0's registry tarball
(sha256 `cb6c63f9…`, sha1 equal to the registry `dist.shasum`) has `bin/`, `template/`
and `package.json` identical to commit `694241cc…`; the `ui-states` prepared base
`e5931061…` and K0 install commit `4cbde166…` reproduce offline; PR #6's eight CI checks
passed on `48df59c` (runs `35447528639`, `35447527131`); the real-browser gate passed
against a pinned Chrome for Testing 148.0.7778.97 copy (artifacts in the study root).
T-107's earlier browser pass used Google Chrome 153.0.8010.48 and does not transfer.

Defects fixed because they prevented an executable package (commit `d43a6ce`, focused
verification in `test/benchmark-study-launch.test.js`, frozen cohort regenerated
`4113e10b…` → `f09e4312…` with only `harness` moving): the orchestrator accepted only a
measured purpose, so no in-tree command could launch the smoke; planning a brief always
materialised three repetitions, which the allocation's unlisted-run guard would refuse;
and an operational session was finalized with a false attestation reason and, when
uncapped, without independent evaluation. `--study-purpose operational-smoke` and
`--repetitions 1` now drive the smoke through the same loop; an operational record is
invalid with an explicit operational reason, evaluated, and stops the schedule.

Layout finding: the launcher refuses workspaces under any `CLAUDE.md`/`.claude` ancestor,
so the study root is `/Users/Shared/pincer-v8-study` (detached worktree at the candidate,
copied CLI, K0 and browser runtime, 543 MB). Every manifest reference is relative to that
root; the inspector must run with `--input-root`. The tracked manifest now names K0 and
records the remaining gaps in `pending_notes`; `execution`, `projects`, `schedule`,
`reviewers`, `authorization` and `allocation` stay null. The proposed inputs resolve from
the study root (dry-run cohort `976db3ee…`, not retained as evidence); the inspector on an
honest draft reports only decision and evidence gaps.

Pending user decisions (bundled in the package §10): model, browser runtime, caps and
allocation with expiry, project-access decision, two independent reviewers, the
`study-authorization` document, K0 artifact acceptance, study root, capture format,
candidate pin with CI, and the T-109 verification command's input root. Reviewer
attention: smoke evidence is kit-bound, so K1 and K2 need their own smokes (package §8 a);
the protocol's two time deadlines map to one allocation field (§8 c); `json` output
captures only the final result (§8 e). The branch is not pushed; CI has not run on the
new commits. T-109 and T-102 remain in progress; nothing was closed on fixtures.

Integration verification after the harness change: the full `npm test` chain (76 suites)
passed locally on 19 September 2026 (started 14:58Z, finished 15:14Z, exit 0), including
the regenerated frozen cohort, the operational-smoke and repetition-prefix cases, and the
packed-distribution and release-preparation suites. T-109 was re-verified through the
pinned kit: its four suites pass and the readiness command still exits 2 by design
(`last_check … failed 9f673d51f3aa`). No CI run exists for these commits.

### T-109 — review corrections to the smoke package (19 September 2026)

An independent review of the execution package found three defects (package §12). No paid
session, launch, push, merge, publication or new project access occurred; no decision was
inferred. Commit `bffcfc8` (harness) plus this documentation commit.

1. The documented launch command planned 24 cells: `orchestrator.cjs main()` never passed
   a brief list, so `--repetitions 1` applied to all eight briefs and the allocation's
   unlisted-run guard would have refused every launch. The suites missed it because they
   supplied `ids` to the internal API. `--briefs <id,...>` now selects briefs in schedule
   order and is required for `--study-purpose operational-smoke`; the launch suite spawns
   the documented command through the actual CLI and asserts exactly `ui-states/rep-1`
   pincer, strict, plain in `order` 1–3, idempotent replanning, and refusal without a
   brief list or with an unknown brief. Reproduced against the real study root into
   `drafts/plan-dry-run/` (draft, not evidence): three records, `runs/smoke` still empty.
2. The proposed verification-command correction still failed (`PATH_INVALID`): the manifest
   must lie inside the declared input root. The package now names the study checkout's
   manifest; exercised through it, the inspector reports the ten actual gaps and no longer
   the `REQUIRED_ARTIFACT_UNAVAILABLE` for `kits`. The ticket's block is unchanged pending
   the reviewer's decision.
3. `cleanup_complete` was returned by the launcher but never retained. It is now written
   into `record.environment` beside `host_policy_observed`; the ledger's
   `ALLOCATION_CLEANUP_UNKNOWN` stop is the second durable source. The evidence table
   separates configured from observed evidence for each native observation and states what
   `--output-format json` cannot show: with it, the smoke can establish that kit hooks were
   installed and registered, not that they fired (capture-format decision, package §8 e).

Frozen cohort `f09e4312…` → `d1e57a17…` (harness digest only). The study worktree was moved
to `bffcfc8`; the dry-run effective manifest and honest draft were regenerated there
(effective cohort `976db3ee…` → `64325207…`, observation target unchanged `8af4d99d…`).
Focused suites passed after the change. The full `npm test` chain (76 suites) passed
locally on 19 September 2026 (started 17:38Z, finished 17:53Z, exit 0) on the tree at
`bffcfc8` plus the documentation edits. T-109 was re-verified through the pinned kit at
17:53Z: its four suites pass and the readiness command still exits 2 by design
(`last_check … failed 9f673d51f3aa`). No CI run exists for these commits; the branch is
not pushed. T-109 and T-102 remain in progress.

### T-109 — native-observation preparation (19 September 2026)

Follow-up to the review corrections. No paid session, launch, push, merge, publication or
new project access; no decision inferred. Commits `f504c80` (harness), `07af4be` (ticket
verification path) and this documentation commit.

- **Real personal configuration is out.** The package's earlier proposal to digest the
  operator's `~/.claude` before and after the smoke, and to compare captures against
  private instruction text, is withdrawn. Nothing personal is read, hashed or compared.
- **Synthetic isolation canary.** The launcher plants user-level `settings.json` (a
  `SessionStart` hook that touches a marker) and a `CLAUDE.md` with a random per-session
  phrase in the per-session `HOME/.claude` and `CLAUDE_CONFIG_DIR`, where a CLI ignoring
  `--setting-sources project` would read them, and records
  `environment.isolation_canary { ok, user_hook_ran, phrase_in_captures }`. A tripped
  canary is unreportable; the phrase is never retained. Profile `home` is now
  `per-session-synthetic-canary`.
- **Hook capture.** The argv adds `--debug hooks --debug-file <session>/debug.log`; the
  launcher retains a redacted copy as `logs/S1.debug.log` (0600, append-preserved) and
  records `environment.hook_capture { present, file, bytes }`. Absence is recorded, not
  read as "no hooks". The result object on stdout, accounting, redaction and interruption
  handling are unchanged. Profile field `hook_capture: debug-hooks-file`.
- **Suites.** `test/benchmark-environment.test.js` covers a compliant tool (canary clean),
  a leaking tool that reads the planted settings (canary tripped, unreportable), debug
  redaction and mode, and a recorded absence. Fifteen focused suites passed after the
  change. Cohort `d1e57a17…` → `b0299e7e…` (harness only); observation target
  `8af4d99d…` → `d53ff6f0…`; dry-run effective cohort `64325207…` → `141a70da…` (worktree
  moved to `f504c80`, drafts regenerated, `runs/smoke` untouched).
- **Ticket verification path.** T-109's block now runs the inspector against the study
  checkout's manifest with `--input-root /Users/Shared/pincer-v8-study` and keeps the
  measured `--require-ready` gate: exercised from the repository, exit 2 with 14 pending
  reasons including the native, smoke and report evidence, so the ticket cannot close
  before those exist.
- **Open smoke findings, not preparation facts:** whether the pinned CLI's `hooks` debug
  category writes each executed hook command and status to the debug file, and whether
  `--debug-file` keeps stdout clean. Both are documented behavior; a failure would surface
  as `hook_capture.present: false` or an invalid record, never as a silent pass.

The full `npm test` chain (76 suites) passed locally on 19 September 2026 (started 20:02Z,
finished 20:17Z, exit 0) on the tree at `f504c80`/`07af4be` plus the documentation edits.
T-109 was re-verified through the pinned kit at 20:17Z with the corrected block: its four
suites pass and the measured readiness gate exits 2 by design with 14 pending reasons
(`last_check … failed c936a9b60fc5`; the block hash changed with the edit). No CI run
exists for these commits; the branch is not pushed. T-109 and T-102 remain in progress.

### T-109 — observation issues fixed (19 September 2026)

Two remaining observation defects, fixed in `499fb6b` without widening scope. No paid
session, launch, push, merge or publication; no decision inferred.

- **Canary versus demonstration.** `isolation_canary` no longer says `ok`. It records
  `leak_detected`, `user_hook_ran`, and `user_settings_loaded` / `user_instructions_loaded`,
  which are `true` only on positive evidence and otherwise `unknown`: settings can load
  without their `SessionStart` hook running and instructions can load without being echoed.
  An untriggered canary refutes nothing and demonstrates nothing by itself. The package's
  "the phrase is never retained" was wrong and is corrected: the launcher writes no phrase
  into the record, but captures keep what the tool emitted, so a leak leaves it there.
- **Hook evidence gates measured reportability.** `hook_evidence.status` is `missing`,
  `unreadable`, `unretained`, `insufficient` (a kit arm's retained log must name both hook
  scripts) or `sufficient`. One `reportability()` gate turns every deficiency, plus model
  attestation, cleanup, capture failure and a tripped canary, into a named reason; the
  orchestrator writes the reasons into `record.reason` and stops the schedule.
- **Retention failure.** The launcher preserves a redacted copy in the attempt's scratch
  or, failing that, the raw file renamed there and flagged unredacted; the result carries
  `evidence_retention_failed` and `review_required`, and the allocator stops the
  allocation (`ALLOCATION_EVIDENCE_UNRETAINED`) so no paid session follows before an
  explicit recovery decision.
- **Tests through the orchestration path.** The study-launch native-boundary block drives
  `hook-evidence-missing` (record reason names it, cell invalid, schedule stops, no
  evaluation) and `retention-failed` (the allocator receives the flag and stops). The
  environment suite tests the gate directly with a measured preflight and the fixture tool
  in compliant, leaking, partial-log and retention-fault runs; the allocation suite tests
  the new stop code. Sixteen focused suites passed. Cohort `b0299e7e…` → `fef7ffdc…`
  (harness only); dry-run effective cohort `141a70da…` → `12535053…`; worktree moved to
  `499fb6b`, drafts regenerated, `runs/smoke` untouched.

The full `npm test` chain (76 suites) passed locally on 19 September 2026 (started 20:38Z,
finished 20:54Z, exit 0) on the tree at `499fb6b` plus the documentation edits. T-109 was
re-verified through the pinned kit at 20:54Z: its four suites pass and the measured
readiness gate exits 2 by design with 14 pending reasons (`last_check … failed
c936a9b60fc5`). No CI run exists for these commits; the branch is not pushed. T-109 and
T-102 remain in progress.

### Direct review correction — 19 September 2026

User authorized the reviewing agent to fix the remaining defects directly. Changes over
`5bbde21` reject registration-only hook logs and preserve the last copy of hook evidence
on failed reads or exhausted copy recovery. The completion parser accepts only recognized
command-completion records with numeric exit outcomes for both kit hooks; unknown native
formats remain insufficient pending actual smoke inspection. A completed denial is hook
execution evidence, not task acceptance.

Retention first tries the normal redacted capture and a redacted scratch recovery copy.
If neither works, or the original cannot be read, the protected original session directory
survives byte-for-byte. The record carries a relative recovery reference,
`original_preserved: true`, `redacted: false`, and the existing retention-failure/review
flags. The allocator's stop remains unchanged. Fixture-only I/O injection cannot affect
native execution. Regression tests cover registration-only text reaching an invalid run,
missing/malformed outcomes, read faults, both copy writes failing, successful redacted
recovery, protected directory permissions and preserved original bytes.

Eight focused suites pass: benchmark-environment, benchmark-study-launch,
benchmark-terminal-records, benchmark-usage-completeness, readiness-contracts,
execution-freeze, study-readiness and benchmark-effective-inputs. Frozen inputs match
`1027f120893440680170df9d942855ae3c062a27af98c22b5dd77eceaf168ca9`.

Full `npm test` was attempted: the first nine suites passed, then recovery.test.js stopped
because this sandbox refuses a local server bind (`listen EPERM 127.0.0.1`). Separately,
benchmark-allocation fails with `CUSTODY_INVALID`: `ps` is denied by this sandbox, so it
cannot establish supervisor identity. The pinned v0.6.0 kit re-verified T-109 and recorded
that actual failure (exit 1, block digest `c936a9b60fc5`), not a successful receipt or an
observation. Standalone measured readiness still exits 2 with 14 pending reasons.
Logs: `/tmp/pincer-review-full-test.log`, `/tmp/pincer-review-t109-verify.log`, and
`/tmp/pincer-review-readiness.json`. Full verification needs a host allowing local sockets
and process inspection; no checks were weakened to bypass those restrictions.

No template changes, paid sessions, external actions or project access occurred. Existing
untracked guide/diagrams were preserved. The external study checkout remains at
`499fb6b`; its drafts are explicitly stale and must be refreshed for this code and a
CI-verified candidate before launch. No runtime readiness or live observation is claimed.

### Requested commit, push and npm upgrade — 19 September 2026

The user explicitly authorized committing all changes (including the previously untracked
guide and diagrams), pushing and upgrading npm. Git staging was attempted and refused by
the session filesystem policy: `.git/index.lock` cannot be created (`Operation not
permitted`). No commit or push occurred; HEAD remains `5bbde21`.

Prepared package version `0.7.0` for the added coverage-scaffold and brief-resume features,
using `npm version minor --no-git-tag-version --ignore-scripts`, then regenerated adapters
and plugin. Distribution parity, packed-install and release-preparation tests pass. The package is built at
`/tmp/pincer-release-0.7.0/pincer-workflow-0.7.0.tgz` (72 files; SHA-1
`566bbde47225d346c09b89ce46dd640a4a5101d7`). npm cache is confined to that temporary
release directory. Registry inspection returned `0.6.0`; no package was published.

Commit all pending files in a Git-writable session, push the updated branch and obtain
candidate-wide CI before publication. Current PR #6 checks cover the older remote source,
not these local corrections or the version bump. Version preparation does not close the
remaining v8 observational tickets or claim measured delivery superiority.


## 20 September 2026 — native-tool scope amendment

User requires CLI/Copilot operation without provider API keys. Revised PRD v8 with R-21/R-22 (S-61–S-66), added T-120/T-121, and made T-121 a predecessor of T-109. The prior API-key smoke package is explicitly superseded; the pending manifest records that boundary. Product documentation distinguishes host login from the historical maintainer runner. No launcher conversion, live login, study session, new receipt, commit or publication occurred in this planning revision. Next: T-120 contracts, T-121 implementation, then native T-102/T-109 observations.

## 20 September 2026 — T-120: native-tool study contracts authored

T-120 was started through the pinned v0.6.0 kit at 08:01Z. Deliverable:
`docs/prd-v8-native-tool-contracts.md`, checked by the new
`test/native-tool-contracts.test.js` (77th suite in `npm test`). What was checked against
official contracts on 20 September 2026: Claude Code 2.1.278 installed help
(`claude auth status --json` keys, `--permission-prompts`, `--max-budget-usd`, `--bare`,
`--restricted`) plus the authentication, costs, CLI-reference and programmatic-use pages;
Codex CLI 0.155.1 installed help (`codex login`, `login status`, `doctor --json`,
`exec --json`) plus the authentication and non-interactive pages; GitHub Copilot CLI
documentation only (install, about, programmatic reference, billing). Copilot CLI is not
installed here and stays unobserved; the `openai-docs` skill named by the ticket is not
installed, so the official pages were read directly.

Design decisions recorded in the contract: `claude-project-isolated-v1` (API key) is
historical; the replacement `claude-project-native-login-v1` signs in through the user's
own `claude auth login` inside a study `CLAUDE_CONFIG_DIR`, retains only four sanitized
status fields, refuses every credential/billing override by name without printing a value,
blocks on a dirty login directory, and never falls back to a key. Whether the pinned
2.1.273 CLI preserves that login under a fresh HOME is the first T-109 observation;
failure is a named blocker, and the only alternative is a user-approved controlled-host
baseline. Usage profile `claude-code-result-native-usage-v1` keeps tokens and provider
time mandatory, renames the cost metric to `estimate_usd`, and adds a billing block in
which unavailable subscription billing is an expected valid outcome while a missing
mandatory capture is not; dollar-superiority claims need evidenced API billing on every
cell. Schema/profile migration and rollback are tabulated; study manifest schema 2 and
the `--i-agreed-the-usage-envelope` launch flag are specified for T-121.

Frozen inputs changed (protocol, isolation and usage documents; the contract document is
appended to `SPEC.harness`), so the cohort moved from `1027f120…` to `a6a6d474…`. The
external study checkout, its `1c91c6ef…` effective manifest and the 20 September
API-key settlement under `/Users/Shared/pincer-v8-study/{decisions,evidence}` are now
superseded history, not inputs to the next smoke; `runs/smoke` is still empty and no
session has run. Protocol corrections (a) kit-bound smoke and (c) single elapsed-time
window from the superseded package §8 were applied in the amendment section. Affected
tickets (T-102, T-105, T-109, T-110, T-111, T-114, T-115, T-116, T-118) carry a scope
amendment paragraph; their receipts are unchanged. Acceptance criteria S-61–S-63 are
ticked as authored-contract deliverables; the design still needs the user's review for
feasibility and honesty, and nothing native has been observed.

The full `npm test` chain (77 suites) passed locally on 20 September 2026 (started 08:10Z,
finished 08:25Z, exit 0) after the frozen-input change. T-120 was verified and closed
through the pinned kit (receipt `5ed85d4c3f23`, 08:12Z). Not pushed; no CI run exists for
this commit yet.


## 20 September 2026 — T-120 technical review corrections

Corrected four issues from review: Claude-only record schemas now reject Codex/Copilot relabelling; Codex evidence follows its shipped skills/runtime/platform controls without an invented hook adapter; Copilot VS Code is distinguished from CLI research; shared login-directory canaries require exclusive canonical-directory custody, durable ownership records and explicit interruption recovery preserving changed files. T-121 now names the runtime failure/concurrency tests. No launcher implementation, account login or live study was performed. Historical T-120 lifecycle fields are preserved; the pinned kit has no legacy ticket-reopen operation, so corrected contracts are reverified using its supported verify path.

Validation: pinned-kit `verify T-120` passed all three suites (native-tool contracts, readiness contracts, execution freeze) and wrote receipt `2026-09-20T09:17:26Z 5ed85d4c3f23`. An initial check exposed a stale text assertion after the Copilot wording correction; that assertion was corrected and the kit rerun successfully. New frozen cohort: `3284061a67bd06536d4f88f25017573881e767e178a53619197a5c798d034721`. Full npm test was not rerun for this contract/test-only correction. No changes were committed or pushed.


## 20 September 2026 — T-121: native-login study path implemented

Implemented the T-120 contracts in the runner. `isolated-launch.cjs` gains the
`claude-project-native-login-v1` profile: the launching environment is refused by name when
any of the nine credential/provider variables is present (`BILLING_OVERRIDE_PRESENT`, value
never read), the historical `claude-project-isolated-v1` is refused (`PROFILE_HISTORICAL`),
`<tool> auth status --json` runs in the constructed environment before any workspace and
again before the tool starts (`LOGIN_REQUIRED` with the tool's own login instruction and no
fallback; `LOGIN_STATUS_INVALID`; `PROFILE_INCOMPATIBLE`; `BILLING_MODE_MISMATCH`), and the
record retains exactly five sanitized status fields plus a billing block, a classified
account limit and the custody summary. New `login-custody.cjs` gives the shared login
directory one exclusive lock keyed by its canonical path, a durable journal outside the
credential directory, exclusive-creation canaries journaled before and after each write,
custody-safe cleanup that preserves anything changed, a recovery marker written before
release, and `recover()` as an explicit recorded decision that removes only verified
unchanged owned files. `usage.cjs` adds the `claude-code-result-native-usage-v1` reader
(`estimate_usd` plus `billing`; `cost_usd` stays null with the billing reason; profiles never
pooled). `allocation.cjs` reads schema-2 grants (`limits()`), counts `max_sessions`, and
stops on `ALLOCATION_LOGIN_DIR_RECOVERY`, `ALLOCATION_CAPTURE_INCOMPLETE`,
`ALLOCATION_ACCOUNT_LIMIT` and `BILLING_MODE_MISMATCH`; T-121 joins the lifecycle
prerequisites. `readiness.cjs` reads manifest schema 2 with the pending reasons
`BILLING_MODE_PENDING`, `ACCOUNT_USAGE_PENDING`, `LOGIN_STATUS_CONTRACT_PENDING`,
`SURFACE_UNSUPPORTED`, `LEGACY_FIELD_REFUSED`, `PROFILE_INCOMPATIBLE`; schema 1 validates
exactly as before. `orchestrator.cjs` takes `--i-agreed-the-usage-envelope` (the old flag is
refused by name), refuses to run while a credential variable is set, holds login custody
from the pre-workspace gate through the session, and names the account-limit kind in the
record reason. `effort.cjs` reports `estimate_usd` and `billing` and refuses mixed-profile
aggregates.

New suite `test/native-login-study.test.js` (78th) runs fixture executables through the real
entry points: clean session, sanitized status, logged-out and session-lost refusals, billing
mismatch, malformed status, all nine override names, dirty/symlinked/missing/in-home login
directories, replaced canary, deletion fault, recovery then a clean next session, competing
invocations on aliased roots, crashes before and after the canary receipt, an unknown-host
owner, the orchestrator CLI refusing a synthetic key before planning, a native-profile plan,
orchestration scenarios (subscription-complete versus missing-capture, api charge
unavailable, account limit, login lost, custody recovery) and the schema-2 ledger.
`benchmark-environment`, `study-readiness`, `benchmark-restart` and `benchmark-allocation`
were updated for the profile, schema 2 and the T-121 prerequisite. Replacement package:
`docs/prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md`; `study.json` is
schema 2 and pending; the proposed inputs name the native profile. The frozen cohort was
re-minted (harness, collector and frozen documents changed).

Not done and not claimed: no account login, live session or spending occurred; the pinned
CLI has never run under this profile, so login preservation, the CLI's own login-directory
entry names and the hook-log format remain T-102/T-109 observations. The external study
checkout is stale until refreshed to this commit. CI has not run on it.

Verification: `node test/native-login-study.test.js`, environment, allocation, study-launch
and execution-freeze passed through the pinned v0.6.0 kit; T-121 was started at 10:22Z,
verified (receipt `826a1616422f`) and closed at 10:39Z. The full `npm test` chain (78 suites)
passed twice on 20 September 2026: 10:22Z–10:38Z (an `effort.cjs` validator edit and a cohort
re-mint landed at 10:25Z, before the benchmark suites ran) and again on the final tree,
10:39Z–10:54Z, exit 0. Final frozen cohort `99368435…`. Not pushed; no CI run exists for
this commit; the packed-parity and exact-candidate CI requirement therefore waits for a push.


## 20 September 2026 — T-121 custody race corrections

Fixed three review findings: cleanup now atomically retires canaries to private journaled holding paths and retains bytes instead of unlinking checked mutable paths; recovery keeps a guard through inspection, cleanup and durable receipts; detached session groups are registered with the login claim before task startup as well as with the run claim. Recovery-in-progress markers survive failures. Added regressions for replacement after content checking, rename-before-receipt interruption, competing recovery/acquisition, group registration before startup, and owner death with a surviving detached child. The home-directory rejection test uses a synthetic home rather than writing into the operator's real home.

Pinned-kit `verify T-121` passed all five required suites on the final test tree: receipt `2026-09-20T11:06:40Z 826a1616422f`. Native-tool/readiness contract and execution-freeze suites passed separately. Distribution parity and packed-install tests passed. Full `npm test` was attempted: first nine suites passed, then recovery.test.js stopped at sandbox-denied `listen EPERM 127.0.0.1`; retained output is `/tmp/pincer-t121-custody-full-test.log`. This is not a full-regression pass. Exact-candidate CI remains pending. Frozen cohort: `725f586d06d1a7d75241d706bd36b43bfdc8d2aa0fdb12370d86e36ab247b847`. No native session, login, commit or push occurred.

A separate direct invocation of `test/benchmark-run-claims.test.js` timed out waiting for `owner reaped` (the transition to proven-dead custody). This environment also denies direct `ps` execution; the standalone claims suite therefore remains unverified here and must be rerun on the permitted host. The final pinned-kit T-121 suite did pass its detached-child custody regressions.

Candidate preparation: corrected the native-tool plan's stale pre-implementation status and the replacement smoke package's cleanup and sanitized-field descriptions. Added `docs/prd-v8-artifacts/execution/T-121-candidate-validation.md` with the host regression, pinned-kit verification, scoped commit, push and exact-SHA CI procedure. Native-tool contracts, readiness contracts and execution-freeze checks passed after these documentation edits; `git diff --check` passed. Full regression and CI remain pending. No commit, push, login or study session occurred.


## 20 September 2026 — macOS CI control-directory race

The supplied macOS Node 22 log for candidate `18596656` reaches the native-login concurrency test and returns `EEXIST` instead of `LOGIN_DIR_BUSY`. `controlArea()` used an existence check before mkdir, allowing simultaneous first acquisitions to race before reaching the exclusive claim. It now attempts mkdir, tolerates only EEXIST, then rejects symlinks and non-directories before proceeding to the unchanged claim mechanism. Deterministic tests inject a competing directory, file, symlink and permission denial; the existing two-process alias test still requires exactly one winner. Frozen cohort: `0e9d1a18e2d805e47fe4296ca53103ef5494dac2fe4fcca02753060ffdd78209`.

The new race tests and custody filesystem tests passed during pinned-kit verification. Verification subsequently failed at `CUSTODY_REGISTRATION_FAILED` in this restricted environment; the kit recorded the failure and revoked the prior receipt. Host re-verification and CI remain required. Native-tool contracts, readiness contracts, execution-freeze and diff whitespace checks passed. No commit, push or live session occurred. The macOS Node 24 failure log has not been inspected.
