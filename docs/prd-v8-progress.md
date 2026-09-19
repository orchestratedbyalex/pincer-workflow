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
