---
version: 4
status: built
date: 2026-09-11
profile: standard
---

# Record verification automatically and invalidate stale evidence

## Profile and document status

`standard`: this change affects verification, persistent state, recovery,
distribution, and compatibility. It needs failure-injection tests and migration
fixtures even if individual implementation steps are small.

This is an implementation-ready proposal against local v0.4.1, commit `1cb5ab4`.
The user requested a detailed PRD with logical implementation steps for their own
implementation and a later review. This document does not record implementation
approval, completed tickets, passing checks, or a release decision. No calendar
or token budget was supplied. Steps below are work packages, not active tickets.

## 1. Problem

Pincer already preserves installer customizations, revokes failed receipts,
carries requirement IDs, and validates saved candidate evidence. Its next weakness
is the gap between what actually executed and what the workflow can establish
without an agent interpreting or assembling the record.

- Ticket receipts identify the Verification block, but do not bind the result to
  a complete source snapshot. `done` compensates by executing the check again.
- Evaluate authors command evidence and logs. Validating their structure and
  digests does not establish that the runtime captured the execution.
- Rechecking a ticket changes tracked receipt fields. That can invalidate an
  evaluated candidate even when implementation inputs have not changed.
- Recovery can require restoring a tracked ticket. The latest trial exposed an
  ambiguity about passing a check in a different environment after failure.
- Bash helpers own parsing and readiness alongside a separate Node evidence
  validator. Extending both independently would increase policy drift.

Developers and reviewers need to answer: **what ran, against which inputs, what
happened most recently, and what action makes the work ready?** This must work for
new and existing repositories without requiring another agent session to interpret
raw files.

### Original brief and supporting records

The user asked: “can you write a new PRD in details with the next improvements
that should be there as you mentioned? make it as logical steps to implement so
i can implement it and let you check it later”.

This PRD implements the recommended next increment: a bounded recovery correction,
then runtime-owned verification with the minimum identity and reporting foundation
needed for later lifecycle work. Sources:

- [Original improvement plan](../docs/pincer-improvement-plan.md), M1.
- [PRD v2](prd-v2.md), existing requirements and candidate-evidence contracts.
- [PRD v3](prd-v3.md), recovery exception and one command per evidence check.
- [Interactive trial](../docs/trial-2026-09-10-interactive.md).
- [Recovery trial](../docs/trial-2026-09-10-prd-v3.md), especially finding 1.

## 2. Solution and intended experience

Introduce a shared, local Node runtime beneath the existing playbooks and command
wrappers. It records verification attempts automatically, compares current inputs
with verified inputs, and exports command evidence for the evaluated candidate.
Markdown continues to own requirements and authored ticket content. Operational
attempt records live separately and are never treated as implementation changes.

Example journey:

1. The developer selects the existing PRD explicitly and previews runtime migration.
2. `verify` runs the ticket check and records its outcome and source identity.
3. `done` consumes that current passing result; it does not run the same check twice
   merely to update a timestamp. Checked acceptance criteria are still required.
4. Editing source makes status report stale evidence and name the affected check.
5. A failed recheck immediately blocks readiness while retaining the earlier pass
   as history. Repair followed by a new pass restores readiness without Git restore.
6. Evaluate runs candidate command checks through the runtime and exports their
   captured evidence. Review and visual judgments remain separately identified.
7. Release reads and validates the saved record and any newer applicable local
   attempts. It never executes a check or changes a receipt as a side effect.

## 3. Scope

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| Recovery correction and observed negative scenarios | A general source rollback tool |
| Shared runtime for ticket execution, readiness, status, and evidence integration | Rewriting all playbooks or installer internals |
| Explicit change/PRD identity and revision binding | Full change switching, ownership, pause/cancel/supersede lifecycle |
| Captured attempts, source identities, safe logs, interruption and timeout handling | Remote execution or tamper-proof attestations |
| Runtime state migration and compatible command wrappers | Automatic trust in legacy receipts |
| Machine-readable status and read-only release validation | Full requirement coverage and revision-impact engine |
| Packed distribution and focused live acceptance trials | Claims of complete platform parity or competitive superiority |

## 4. Requirements

Requirement IDs are stable within this PRD. Scenario IDs identify independently
reviewable checks; tickets must cite both the requirement and relevant scenarios.

### R-01 — Correct recovery without erasing failures

Before the new runtime is active, tighten the v0.4.1 exception: restoring a ticket
is eligible only when the recorded failure is explained by a since-reverted source
change, the other candidate conditions hold, and the check passes in the same
declared execution context. A changed executable, runner, working directory, or
environment repair requires a new recorded verification. An unexplained failure
cannot be cleared by restoring a receipt.

Once a project migrates, replace that exception with normal runtime verification:
retain the failure, record the repaired pass, and derive current readiness. Never
recommend restoring a ticket or deleting runtime history to obtain green status.

- **S-01:** A reverted source regression follows the documented legacy exception
  before migration; after migration it produces a new passing attempt with the
  failed attempt retained and no receipt-only tracked edit.
- **S-02:** A required local fixture service is unavailable with unchanged source.
  The failure stays blocking until the service is repaired and verification passes.
  Choosing another binary or reporting an unrelated passing check does not clear it.
- **S-03:** Source changes remain. Recovery reports them and does not discard them
  under authorization to repair ticket state.
- Preserve existing source-protection and installer-preservation guarantees.

### R-02 — Establish one runtime and explicit evidence identity

The installed kit and plugin bundle the same versioned Node core. Shell entry
points delegate to it; they must not retain separate readiness implementations.
Preserve existing ticket command names and arguments, with documented changes to
receipt storage and `done` behavior.

Runtime verification requires a registered change ID, repository-relative PRD path,
PRD content revision digest, base commit, ticket ID, authored ticket digest, and
check-definition digest. The PRD filename version is not a content revision.
Registration records an existing authorization reference when supplied; running
registration does not prove independent human approval. It must not infer approval
from `status: ticketed` or `built`.

Support one explicitly selected change per worktree in this increment. Refuse
ambiguous associations; never select the highest PRD number for new runtime writes.
Full approval enforcement is a subsequent lifecycle requirement, not a claim here.

- **S-04:** Identical commands in two PRDs cannot share readiness accidentally.
- **S-05:** Editing PRD content under the same filename invalidates its prior
  binding; changing only its recognized lifecycle status does not alter authored
  content identity. A revision must be rebound explicitly before execution.
- **S-06:** Missing, duplicate, malformed, unsupported-schema, or ambiguous
  identifiers produce actionable diagnostics before a child process starts.
- Preserve existing supported Markdown syntax and supplied requirement IDs.

### R-03 — Record attempts from actual execution

Persist a `running` attempt before launching the command. That record supersedes
previous passing readiness for the same change/ticket/check context immediately.
Finalize the attempt as `passed`, `failed`, `interrupted`, `timed_out`, or `error`.
An inability to launch or persist evidence is an error, never a pass.

Each attempt records schema/runtime versions, unique attempt ID and sequence,
identity references from R-02, exact check-definition digest, safe command display,
runner, working directory, timestamps, exit code or signal, timeout, source
identities before and after, safe output artifacts and digests, and limitations.
Sequence allocation is authoritative; timestamps alone do not order concurrent work.

One independently assessed command has one result. An existing ticket's Bash
Verification block may remain one aggregate check; shell failure semantics must
preserve `bash -eo pipefail`. Do not split arbitrary shell syntax heuristically.
Evaluate's independently assessed scans remain separate checks.

- **S-07:** A command emitting distinct stdout/stderr markers then exiting nonzero
  produces captured markers and a failed attempt with its actual exit code.
- **S-08:** Green → running → red never reports ready between attempts or afterward.
- **S-09:** Missing executable, unwritable state, and full/truncated output paths
  produce accurate failures or explicit output limitations, with no fabricated log.
- **S-10:** Inspection and status do not execute commands, rewrite timestamps, or
  create attempts. A new explicit `verify` always creates a new attempt.

### R-04 — Bind readiness to reproducible inputs

Use a versioned SHA-256 source manifest. Include tracked files, relevant nonignored
new files, tests, configuration, lockfiles, executable modes, deletions, and path
identity. Include authored PRD/ticket content; normalize only a documented fixed
set of lifecycle fields and acceptance checkbox state. Acceptance text, dependencies,
verification commands, and scope always contribute to identity.

Freeze the exact projection in step 2: recognized PRD lifecycle status and ticket
`status`, `started`, `finished`, legacy `verified`/`last_check`, and checkbox marks
are the only initial normalization exceptions. Validate these fields separately;
normalization cannot make an invalid ticket eligible. Bind change-registration
fields separately rather than recursively hashing a record containing its own
digest. Document treatment of NOTES and exported evidence so a new evidence
artifact cannot invalidate the source snapshot that produced it; this does not
relax the separate post-candidate commit policy in R-07.

Exclude Git internals, runtime-owned local state, and narrowly declared generated
outputs. Exclusion configuration itself is an input. Refuse exclusions covering
tracked implementation, tests, or check definitions. Ignored dependencies and
external services are environment limitations, not verified source contents.

Do not read secret-file contents into source hashes or reports. A tracked secret
path must block verification with a path-only diagnostic. `.env.example` remains
ordinary input. Reject unsupported symlink or submodule inputs explicitly rather
than silently claiming to have verified their contents.

Compute inputs before and after execution. Unexpected source mutation prevents a
passing result even if the child exits zero. This detects observed mutation; it
does not promise to catch a write that is undone between snapshots.

- **S-11:** Source, test, lockfile, config, new-file, deletion, and mode changes each
  make a previously passing result stale. A changed PRD or ticket check does too.
- **S-12:** Adding an attempt or ticking acceptance boxes leaves the source digest
  stable; editing acceptance text or exclusion configuration changes it.
- **S-13:** A zero-exit check that edits source is ineligible as passing evidence.
- **S-14:** Secret, symlink, ignored dependency, and unsupported repository cases
  follow the stated policy with no silent omissions or secret values in output.

### R-05 — Make transitions durable and interruptions recoverable

Use an exclusive lock per worktree and atomic state replacement on the same
filesystem. Bound lock waits, identify the lock owner, and never steal a live lock.
Separate worktrees must not share mutable attempt state accidentally.

A timeout has a positive configured duration, with a documented default of ten
minutes and an explicit per-check override. The timeout is part of the check
definition. On supported POSIX systems, terminate the child process group, allow
a bounded grace period, and escalate termination if necessary. Host sandbox and
approval controls remain in force.

On restart, an unfinished attempt remains non-ready. Read-only status reports it;
an explicit recovery operation may finalize it as interrupted after verifying the
owner is no longer running. Never promote an unfinished record to success.

- **S-15:** Two overlapping verification writers cannot corrupt or lose records;
  the second receives a bounded busy result or starts after the first completes.
- **S-16:** SIGINT, SIGTERM, timeout, and forced parent termination leave no reusable
  prior success. Restart diagnosis and recovery are deterministic.
- **S-17:** A fixture child with a grandchild is terminated on cancellation or
  timeout; interrupted writes leave a valid prior state or a diagnosable journal.

### R-06 — Separate operational records from committed product changes

Store ongoing attempts and locks in an ignored, project-local `.pincer/runtime/`
directory, distinct from installer manifest `.pincer.json`. Keep authored changes
and a portable change binding under `.prd/`. Runtime schema numbers are independent
of package versions.

After migration, ticket `status`, `started`, and `finished` may remain tracked
lifecycle projections for compatibility. `verified` and `last_check` no longer
provide runtime authority and are removed only by explicit migration. New attempts
must not rewrite tracked ticket files. Ticket closure validates the latest passing
attempt against current inputs and checked criteria, then writes the closure once.
Calling `done` again on a current done ticket is read-only and idempotent.

- **S-18:** Two successful `verify` runs on an unchanged migrated project create two
  local attempts with no tracked diff. `done` consumes the current pass without
  launching a duplicate check.
- **S-19:** Stale inputs, a later failure, missing logs, missing local state, or
  unticked criteria block closure with an explicit next step.
- **S-20:** Deleting local state cannot revive a legacy receipt. A fresh checkout
  can inspect committed candidate evidence but must verify before new ticket closure.

### R-07 — Export candidate evidence and keep release read-only

Retain schema-1 validation for historical evidence. Introduce evidence schema 2
with runtime attempt provenance for executable checks; do not retrofit the stronger
claim onto old manifests. Runtime capture establishes local provenance and mistake
detection, not tamper-proof execution attestation.

Evaluate's executable checks use the runtime against the selected committed
candidate. Before running, require a clean source view matching that candidate;
allow only defined local runtime and candidate-evidence outputs. Reject unrelated
dirty files. Do not silently stash, reset, or create commits. Export a complete
portable evidence set under `.prd/evidence/`, including sanitized logs, identity
bindings, and digests. Candidate command outcomes are populated from attempts.

Human/agent review and visual observations remain explicitly authored evidence,
with actual saved artifacts where available. The runtime must not invent a reviewer
transcript or convert a review judgment into an executable check result.

Release validates candidate association, artifacts, required outcomes, and known
newer applicable local attempts. A newer failure/running attempt for the same check
and candidate inputs blocks local readiness until freshly resolved and evaluated.
A failure on different source inputs remains historical and does not by itself
invalidate a matching candidate result. Fresh clones can validate only the saved
record; report that limit instead of implying access to another machine's history.

Keep the existing conservative post-candidate change policy. Version bumps, wiki
edits, or authored ticket changes still require evaluation of the actual release
candidate. Do not solve candidate churn by exempting arbitrary documentation.

- **S-21:** Exported command text, outcome, log, and source identity match runtime
  attempts; tampering, wrong candidates, and missing artifacts block validation.
- **S-22:** Receipt-free verification creates no product diff; exporting a new
  evaluation uses the allowed evidence-only path without weakening source checks.
- **S-23:** A schema-1 fixture remains inspectable with a legacy-provenance label;
  it cannot satisfy a newly requested schema-2 runtime evidence requirement.
- **S-24:** A newer same-context failure blocks local release despite an older
  exported pass. A fresh clone reports saved candidate evidence separately from
  local verification availability. Release creates no attempts or tracked edits.

### R-08 — Explain current state without an LLM

Expose human-readable status and versioned JSON through the shared runtime.
Minimum output: change/PRD/revision, ticket lifecycle, verification readiness,
latest attempt, evidence provenance, candidate verdict, reason codes, and next action.
Distinguish lifecycle `done` from verification readiness. An old done ticket can
have stale or failed evidence without rewriting its historical completion date.

Suggested reason codes: `CHANGE_REQUIRED`, `REVISION_CHANGED`, `CHECK_CHANGED`,
`SOURCE_CHANGED`, `CHECK_FAILED`, `ATTEMPT_RUNNING`, `ATTEMPT_INTERRUPTED`,
`ATTEMPT_TIMED_OUT`, `EVIDENCE_MISSING`, `MIGRATION_REQUIRED`, `STATE_BUSY`.

JSON emits one parseable object on stdout; diagnostics go to stderr. Status exits
zero when inspection succeeds even if work is not ready; an explicit read-only
readiness gate exits nonzero for non-ready work. Invalid invocation or unreadable
state is an error. Document exact exit codes and wrapper mappings before coding.

- **S-25:** Every failure fixture has a stable reason and a concrete next action.
- **S-26:** Human status, JSON, closure, and release agree because they consume the
  same readiness computation. JSON contains no progress text or secret values.

### R-09 — Preserve installations and migrate explicitly

Provide read-only migration preview, explicit apply, and backups of every changed
authored file. Migration registers one chosen PRD, preserves original receipts as
legacy history, and starts new verification as unverified. It never relabels a
command-only legacy receipt as source-bound evidence. Repeated apply is idempotent.

Installation/update deploys runtime files and diagnoses migration needs; it does
not migrate active project artifacts silently. Unknown schemas, conflicts, and
partially completed migrations fail closed. A rollback guide explains how to
restore backups and that old runtimes cannot enforce new guarantees.

Pack the core with both npm kit and plugin; neither requires a global Pincer binary
or runtime dependency download. Preserve the current dependency-free distribution
using Node built-ins and a documented restricted Markdown/frontmatter grammar.
Reject unsupported syntax clearly. A parser dependency or Node support change is
a separate explicit design revision, with packaging implications recorded first.

- **S-27:** Clean, customized, ambiguous, partly migrated, and legacy project
  fixtures preserve user files and produce correct preview/apply results.
- **S-28:** Packed Claude-only, Codex-only, Copilot-only, all-platform, and plugin
  layouts contain the identical runtime and execute the compatibility commands.
- **S-29:** Existing supported syntax fixtures pass; malformed/unsupported forms
  fail before mutation. Existing installer conflict tests remain green.

### R-10 — Demonstrate behavior and record delivery friction

Add deterministic fixture tests that inject incorrect behavior, independent of
wording assertions. Run focused live trials from the packed artifact: a new CLI
project and an existing project with unrelated user edits. Observe failure/repair,
interruption/resume, and the persistent service-failure recovery scenario.

Record kit digest, platform/tool/model versions, prompts, checks, interventions,
manual evidence repairs, repeated approvals, unnecessary evaluations, and outcomes.
Run the same bounded scenarios on the v0.4.1 baseline where feasible. Report counts
and limitations; this is not yet a statistically meaningful competitive benchmark.

- **S-30:** Deterministic tests detect each injected false-ready condition.
- **S-31:** Live records demonstrate runtime use, preserved user edits, no repeated
  approval of unchanged work, and no manual receipt restoration after migration.
  Unobserved behavior is marked outstanding and cannot count as a passed gate.

## 5. Architecture and data contracts

### Proposed structure

Paths are proposed module boundaries; implementation may consolidate modules while
preserving ownership and public behavior.

```text
template/scripts/pincer-runtime.cjs       local command entry point
template/scripts/pincer-runtime/          parser, identity, state, runner,
                                         readiness, migration, evidence export
template/scripts/pincer-ticket.sh         compatibility wrapper
template/scripts/pincer-status.sh         compatibility wrapper
template/scripts/pincer-evidence.cjs      compatibility validator entry point
template/.claude/commands/                canonical playbook integration
template/.claude/hooks/hook-policy.cjs    guard integration for migrated state
bin/pincer.js                            installer inventory and diagnosis
scripts/build-plugin.sh                 bundle runtime directory and entry points
test/                                   runtime and packed migration fixtures
.prd/changes/<change-id>.json             portable identity and PRD binding
.pincer/runtime/                         ignored local attempts, index, locks
.prd/evidence/prd-vN/<candidate>/         portable evaluated evidence
```

### Ownership and minimum schemas

| Record | Owner | Minimum contract |
| --- | --- | --- |
| PRD/ticket authored content | Developer/agent under existing authorization | Supported syntax, stable IDs, requirements, acceptance text, check definition |
| Change binding | Runtime registration/migration | Schema, change ID, PRD path/revision, base, optional recorded authorization reference |
| Attempt | Runner | Identity, sequence, outcome, execution context, timestamps, input digests, artifacts, limitations |
| Local index/lock | Runtime | Atomic current pointers, owner and recovery metadata; no second editable truth |
| Candidate manifest | Exporter plus explicit review/visual inputs | Schema 2, candidate/base, requirements, runtime command provenance, artifact digests |
| Status | Computed projection | Schema, readiness, provenance, reason codes, next actions |

Local state belongs to the worktree. Registering a copied binding in another
repository must validate its base and paths. File access must remain contained in
the project, and artifact paths must retain the existing symlink/traversal defenses.

### Data flow

Authored check + registered revision → validate and lock → persist running attempt
→ snapshot inputs → run and capture safely → snapshot again → finalize attempt
→ compute readiness → optionally close ticket or export candidate evidence.

Status and release read this data flow's results; neither performs execution.

### Execution environment and output policy

Record OS, Node/runtime version, runner path/version, working directory, timeout,
and explicitly declared nonsecret check context. Never dump the environment or
persist secret command arguments. Secret-bearing inline command definitions must
be replaced by environment references before execution. Do not hash secret values
as proof of environment equality. Mutable external dependencies remain disclosed
limitations; source equality cannot prove an environment has stayed healthy.

Use bounded streaming capture, sanitize before persistence, and record truncation
or redaction. Include fixture tests with known secret markers. Do not claim that a
generic sanitizer detects every possible secret; checks must avoid printing secrets
and no raw unredacted log is exported automatically. If sanitization/capture fails,
do not produce passing evidence that claims complete captured output.

## 6. Logical implementation sequence

Finish each gate before replacing the next existing path. Each step can become
multiple dependency-ordered tickets; ticket count follows complexity, not a quota.

| Step | Work and deliverables | Requirements | Gate before continuing |
| --- | --- | --- | --- |
| **1. Close the legacy recovery gap** | Tighten code/status wording; build a harness-owned local service fixture the implementation agent cannot repair by switching binaries; add remaining-source case; regenerate adapters/plugin. | R-01 | S-01..03 demonstrated for legacy behavior; existing guard assertions pass. This correction may ship independently. |
| **2. Freeze contracts and baseline fixtures** | Document schemas, exact CLI/exit codes, parser grammar, normalized fields, snapshot exclusions, capture limits, and legacy compatibility. Preserve v0.4.1 fixtures and baseline observations. | R-02, R-04, R-08..10 | Contract examples cover valid, stale, malformed, ambiguous, and unsupported input. No unsettled state-ownership decision remains. |
| **3. Implement read-only identity and state loading** | Add shared modules, explicit PRD registration format, source manifest, parser validation, pure readiness computation, human/JSON status. Do not switch production ticket writes yet. | R-02, R-04, R-08 | Identity changes are detected; unknown/malformed state is non-ready; existing syntax and path fixtures pass. |
| **4. Implement the attempt writer and runner** | Atomic state, locking, actual command execution, bounded sanitized logs, outcomes, timeout, process termination, crash diagnosis/recovery. | R-03..05 | S-07..17 pass, including forced termination and overlapping writers; no old pass survives a newer nonpassing attempt. |
| **5. Migrate and connect ticket lifecycle** | Preview/apply/backups, legacy import, ignored local state, wrappers, guard updates, idempotent closure, runtime recovery instructions. | R-01, R-06, R-09 | S-18..20 and S-27..29 pass; no mixed Bash/Node policy writer remains; user edits preserved. |
| **6. Connect evaluation and release** | Schema-2 exporter and validator, captured command evidence, separate authored reviews, shared candidate readiness, legacy labels, read-only release. | R-07, R-08 | S-21..26 pass; failed local rechecks and candidate drift block; fresh-clone limitations are visible. |
| **7. Package, trial, and prepare review** | Update installer inventory, plugin copying/path transforms, docs and playbooks; run generators, full suite, packed installs, and live fixtures; record measurements and remaining issues. | R-09, R-10, all integration | S-28..31 observed as specified; requirement/scenario mapping and review packet complete; no unsupported parity claims. |

Steps 3–6 should land as coherent increments on the implementation branch. Do not
release an intermediate state in which new records are writable but old commands
can incorrectly report them ready. Any material contract change updates this PRD
before downstream implementation proceeds.

## 7. Success criteria and validation plan

| Release criterion | Evidence required |
| --- | --- |
| No false-ready result in required injected failures | Scenario results S-01..30 with actual failing/passing fixture outputs |
| Verification does not create receipt-only tracked changes | Before/after Git status, unchanged source identities, two retained attempt records |
| Same inputs and latest outcomes produce consistent verdicts | CLI, JSON, ticket closure, evidence validator, and release comparison tests |
| Interrupted work resumes without invented success | Child-process fixtures, persisted running record, restart diagnostic, explicit recovery and fresh pass |
| Migration preserves user work | Preview/apply/reapply/conflict/crash fixtures and backup inspection |
| Distribution remains self-contained | Packed installation matrix, plugin runtime parity, generated-output checks |
| Agent uses the intended recovery and capture paths | S-31 live trial records; wording assertions alone are insufficient |
| Claims match observations | Provenance labels, environment limitations, outstanding scenarios, baseline friction counts |

During implementation, run focused behavior tests for each step. At integration,
run both generators and `npm test`; distribution tests must detect stale generated
output. Extend the existing test command to include new runtime suites. Use the
repository's supported CI OS/Node matrix; list untested platforms explicitly.

Final packaging and authored documentation changes belong before the evaluated
candidate. After choosing that candidate, add only the permitted evidence artifacts
and NOTES reference. A later implementation/version change selects a new candidate.

## 8. Review packet for the later implementation check

Provide the following in the branch before asking for review:

1. **Implementation reference:** branch, base commit, candidate commit, and concise
   description of changed behavior and any approved PRD revisions.
2. **Traceability table:** each R-01..R-10 and S-01..S-31 mapped to implementation,
   test/trial evidence, and delivered/blocked/deferred disposition. No silent cuts.
3. **Contracts:** final schemas, supported syntax, exact commands/exit codes,
   normalized fields/exclusions, environment limits, and migration/rollback guide.
4. **Verification record:** focused failure-injection results, full suite result,
   packed distribution results, and generator parity.
5. **Representative artifacts:** successful attempt, failed attempt, interrupted
   attempt, stale-source JSON status, schema-2 candidate manifest, and sanitized logs.
6. **Live trials:** prompts, platform/model versions, package digest, observed
   outcomes, interventions, and comparison with the bounded baseline.
7. **Known limitations:** anything unobserved or incomplete, particularly process
   cleanup, external environment freshness, legacy provenance, and platform support.

The review should independently reproduce at least: green → source change → stale;
green → failed recheck → blocked; process death → restart; concurrent writer;
unchanged verify → no tracked diff; migration conflict → preserved user edit;
candidate export → fresh-clone validation; newer local failure → blocked release.

## 9. Risks, constraints, and rollback

- **Scope growth:** this is the verification slice of M1, not all of M1–M4. Keep
  follow-ups below separate unless a documented dependency makes one essential.
- **Exclusion errors:** normalize a fixed field set; arbitrary path exclusions can
  hide real regressions. Test each allowed exclusion and rejected broad exclusion.
- **Compatibility:** changed `done` semantics must appear in help, release notes,
  canonical playbooks, and tests. Legacy mode must be recognizable, not implicit.
- **Local provenance:** a user or process able to rewrite the runtime and records
  can forge them. Protected CI identities and remote attestations are out of scope.
- **Environment drift:** a local pass is evidence of one run; external services and
  ignored dependencies can change later. A same-context newer failure always wins.
- **Process portability:** Bash checks remain a POSIX contract. Do not claim native
  Windows support without its own runner and process-control acceptance suite.
- **Migration failure:** keep backups until migration is validated. Recovery must
  explain incomplete state and preserve originals. Never delete user data as repair.
- **Dogfooding:** implement and evaluate with a pinned known-working kit or isolated
  fixture until the new runtime passes its migration gates. Do not migrate this
  repository mid-step and then treat its partial runtime as independent evidence.

## 10. Follow-up PRDs after this increment

These preserve the broader improvement plan; they are not v4 acceptance criteria.

| Next increment | Scope and dependency | Exit gate |
| --- | --- | --- |
| **Explicit lifecycle and resume** | Build on v4 identities/atomic state: change selection, revision-bound authorization, pause/reopen/cancel/supersede, two-change resume, durable decision references. | Interrupted sessions select the intended change; wrong-change/revision work cannot inherit authorization or readiness; unchanged authorized work needs no repeated approval. |
| **Mechanical requirement coverage and impact** | Parse and validate required scenario → ticket → check mappings; detect cycles/gaps and identify work/evidence affected by changed requirements. | Missing coverage and undispositioned required work block readiness; semantic test adequacy remains an explicit review judgment. |
| **Platform parity and measured delivery quality** | Full supported Claude/Codex/Copilot/plugin journeys, real-project pilots, repeated comparisons with plain-agent and earlier-Pincer baselines. | Publish observed outcomes, variation, interventions, setup/review effort, and limitations for the tested versions. |

Hosted dashboards, tracker synchronization, autonomous multi-agent scheduling,
enterprise governance, a general YAML parser, and release publishing automation
remain out of scope. Publishing or merging the resulting implementation is a
separate action from satisfying this PRD.
