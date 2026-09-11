---
version: 5
status: ticketed
date: 2026-09-11
profile: standard
---

# Preserve changes, authorization, and resume context

## 1. Purpose and status

**Product outcome:** a developer can pause change A, work on change B, and return
to A in a fresh session with the correct scope, decisions, authorization, evidence
status, and next action preserved.

This PRD is proposed against local v0.5.0, with repository HEAD `9bcf8df` when
drafted. It is the lifecycle/resume follow-up to [PRD v4](prd-v4.md), not a rewrite
of its verification runtime. The user requested a clear PRD for the next changes,
continuing the implementation-and-later-review workflow. This document authorizes
no implementation, migration, merge, version bump, or publication by itself.

Profile: `standard`. Persistent identity, authorization, state transitions,
migration, and worktree behavior require explicit contracts and failure tests.
No implementation timebox was supplied.

### Implementation breakdown

The user subsequently requested ticket creation. The [ticket map and build order](../docs/prd-v5-ticket-map.md)
lists T-47..T-61 and maps every requirement/scenario to its implementation owner and
verification. All tickets are open; no implementation or runtime migration has
started. `ticketed` records completion of decomposition, not execution approval.

### Original brief

The user asked: “ok write a clear prd for this new changes”, following the proposal
to implement change identities and lifecycle transitions, preserve multiple
bindings, record revision-specific authorization, provide a compact resume report,
and test two-change interruptions, revised scope, fresh sessions, and worktrees.

References:

- [Improvement plan](../docs/pincer-improvement-plan.md), M1–M3.
- [PRD v4](prd-v4.md), section 10 follow-ups.
- [Current runtime contract](../template/docs/runtime-contracts.md).
- [PRD v4 review packet](../docs/prd-v4-review-packet.md).

## 2. Problem

v0.5.0 records verification attempts and invalidates stale evidence. It still
permits only one change binding per worktree; replacing it removes the previous
binding. Registration stores authorization text but does not enforce an agreement
against a specific PRD and breakdown. A fresh session has status output, but no
complete lifecycle model for paused, cancelled, superseded, or reopened work.

This leaves avoidable decisions to the agent: which change is intended, whether
authorization still applies, whether an interruption means cancellation, and what
must be rechecked after other work changed the repository.

The next improvement is reliable continuity. New sessions should recover these
facts from validated artifacts instead of reconstructing them from conversation.

## 3. Scope and principles

| Included in v5 | Excluded from v5 |
| --- | --- |
| Multiple retained changes and one selected change per worktree | Automatic branch checkout, stash, reset, merge, or worktree creation |
| Planned, active, paused, completed, cancelled, and superseded lifecycle states | Distributed ownership, cross-machine locks, multi-agent scheduling |
| Revision-bound local authorization records and consequential decisions | Independent human identity verification or protected CI approvals |
| Deterministic human/JSON resume reports | General conversational memory or an LLM-generated authoritative summary |
| Explicit migration from v0.5.0 with backups and preserved evidence | Silent migration or automatic approval of historical work |
| Focused two-change, revision, interruption, and handoff trials | Complete platform parity or competitive superiority claims |

Three facts must remain separate:

1. **Selection:** which change commands target in this worktree.
2. **Lifecycle:** whether its work is planned, active, paused, or historical.
3. **Readiness:** whether authorization, inputs, checks, and candidate evidence
   currently satisfy the requested operation.

Selecting a change never grants approval. A historical completion never overrides
failed or stale evidence. Pausing never erases a verification attempt.

## 4. User journey and lifecycle

### Primary journey

1. Plan and narrow A; register it without replacing another change.
2. Record the user's existing authorization against A's concrete PRD and breakdown.
3. Select and activate A; implement a ticket and record verification normally.
4. Pause A with a short reason and any useful handoff note.
5. Register/select/authorize B and complete its implementation.
6. In a fresh session, explicitly select A and inspect its resume report.
7. Resume A under its existing authorization if the agreement is unchanged. If B
   changed verification inputs, A's evidence is stale and must be refreshed.
8. Complete A, then evaluate and audit the resulting candidate normally.

Selection changes metadata only. The developer arranges the desired Git branch or
worktree explicitly. Pincer reports a mismatched repository view rather than
silently changing it.

### Lifecycle contract

| Current state | Operation | Result and preconditions |
| --- | --- | --- |
| No record | Register | `planned`; unique change ID and valid PRD association; no inferred authorization |
| `planned` | Activate | `active`; selected, current authorization, valid breakdown, compatible repository view |
| `active` | Pause | `paused`; record reason; no running verification attempt for this change |
| `paused` | Resume | `active`; same activation checks; stale verification may remain visibly stale |
| `active` | Complete | `completed`; all associated tickets done, checked criteria, and current passing verification; no unresolved consequential decision |
| `completed` | Reopen | `active`; record reason and satisfy activation checks; retain historical completion |
| `planned`, `active`, `paused` | Cancel | `cancelled`; record explicit user decision/reference; no running attempt |
| `planned`, `active`, `paused`, `completed` | Supersede | `superseded`; record explicit decision and existing replacement change ID; refuse cycles and self-reference |
| `cancelled`, `superseded` | Execute/reopen | Refuse; register a new change and reference the historical one |

**Completed means implementation complete and ready for evaluation.** It does not
mean evaluated, release-ready, merged, or published. Write completion metadata
before choosing the candidate. Evaluation and release remain separate verdicts.
A failed recheck can make a completed change non-ready without rewriting history;
reopen it when implementation must change.

Repeated operations that request an already-achieved state are idempotent and
produce no new event. Invalid transitions preserve all existing files. At most one
change is `active` in a worktree; pause or complete it before activating another.

## 5. Requirements and acceptance scenarios

Keep R-NN and S-NN IDs stable through revisions. Implementation tickets cite the
requirements and scenarios they cover. Semantic judgments remain identified as
judgments; a valid record is not proof that a decision was wise.

### R-01 — Retain multiple changes with explicit identity

Retain a distinct record per change ID, including its PRD path, authored revision,
base commit, lifecycle history, decisions, and authorization references. Keep
`.prd/prd-vN.md` and `tickets/` paths compatible. Ticket IDs remain unique across
the repository in this increment; do not introduce per-change ticket numbering.
Each ticket resolves to exactly one change through its PRD binding. Reject duplicate
PRD associations and ambiguous ticket ownership.

- **S-01:** Register A then B. Both records and histories remain inspectable; A's
  tickets, attempts, and evidence still resolve to A.
- **S-02:** Duplicate IDs, duplicate PRD ownership, invalid references, malformed
  records, and unknown schemas fail before mutation or check execution.
- **S-03:** Migrated `register --replace` cannot delete history. Refuse the old
  destructive meaning with a concrete select/supersede migration hint.

### R-02 — Select work explicitly without changing source

Persist the selected change in ignored local state for each worktree. Commands
that inspect another change may use an explicit ID without changing selection.
Execution requires the selected change; refuse a ticket from another change.
No selection means a selection diagnostic, never the highest PRD or newest record.

Selection may succeed on a dirty tree and must preserve it byte for byte. Activation
and execution require the selected PRD/revision to exist and its recorded base to
be an ancestor of HEAD. A branch name is a hint, not identity or authorization.
Where that test cannot distinguish two branches, show HEAD, the recorded reference,
and dirty paths; do not claim that Pincer proved the developer chose the right branch.

- **S-04:** Select A with unrelated edits present. HEAD, index, and source files are
  unchanged. Starting B's ticket refuses until B is selected and active.
- **S-05:** A fresh clone without a local pointer requests selection even when only
  one change exists. A missing/deleted selected record is diagnosed without fallback.
- **S-06:** Separate worktrees retain independent selection and runtime attempts.
  Selecting A in one does not select it or change files in the other.

### R-03 — Enforce the lifecycle and preserve history

Implement the transition table in section 4 through one shared runtime writer.
Record event ID, sequence, previous/resulting state, timestamp, reason, relevant
revision, and decision reference where required. Derive the current state from
validated history or validate any stored projection against it.

Pause is an execution hold, not cancellation. Resume/reopen revalidate inputs and
authorization but do not silently execute checks. Cancellation and supersession
preserve artifacts and historical evidence; they grant no permission to discard
source or mark unfinished requirements delivered.

- **S-07:** Pause/resume A retains ticket progress, every attempt, authorization,
  and the reason for pausing. Repeat pause/resume at the resulting state is a no-op.
- **S-08:** Complete refuses unfinished tickets, unchecked criteria, stale/red
  verification, or unresolved consequential decisions. Completed does not display
  a release PASS without valid evaluated candidate evidence.
- **S-09:** Cancelled/superseded changes remain inspectable but cannot execute;
  self-supersession and A → B → A supersession are refused.
- **S-10:** Reopen preserves completion history. Editing source makes evidence
  stale; history cannot manufacture a new passing attempt.

### R-04 — Bind authorization to the reviewed agreement

Define an agreement digest from the selected change ID, PRD authored revision,
authored breakdown, and applicable consequential decisions. The breakdown covers
ticket IDs, associations, dependencies, scope/acceptance text, and check definitions.
Exclude lifecycle fields and checkbox marks using a fixed, versioned projection.
Source implementation edits and attempt records are not agreement changes.

An authorization record references that digest, the concrete reviewed artifacts,
the user's actual instruction or durable reference with a short faithful excerpt,
any constraints/delegation, and when it was recorded. It cannot be created by
inferring approval from PRD/ticket status, a passing check, or the act of registration.
It records local provenance, not authenticated independent human identity.

`activate`, `resume`, `reopen`, ticket `start`/`done`, and candidate checks/export
must require applicable authorization. Ticket `verify` may run for an authorized
active or completed change; planned, paused, cancelled, or superseded execution
is refused. Read-only inspection, registration, revision preparation, and crash
recovery remain available without execution authorization.

Read-only readiness and release gates also report non-ready when the selected
agreement lacks applicable authorization. Historical evidence remains inspectable
without asserting that it authorizes present execution or release. All authorization
and transition refusals happen before any check is launched or lifecycle file written.

- **S-11:** The user authorized the exact agreement in an earlier session. Recording
  that existing instruction enables execution; resume and routine checks ask no
  repeat approval and create no duplicate authorization event.
- **S-12:** Missing authorization, authorization for another change, or an unmatched
  agreement digest blocks execution with a reason and the unresolved decision.
- **S-13:** Starting/closing tickets, ticking criteria, and recording attempts do
  not invalidate authorization. Changing acceptance text, dependencies, or a check
  definition creates an agreement difference requiring explicit disposition.

### R-05 — Handle revisions and decisions without unnecessary questions

Retain historical revision references when a PRD or breakdown changes. Status
reports the old/current agreement and the changed authored artifacts. Do not copy
an authorization string onto a new revision and imply approval carried forward.

Provide two explicit dispositions for an agreement change:

- **New authorization:** a new material scope, behavior, architecture, migration,
  or other consequential decision requires a reference to the user's decision.
- **Within existing delegation:** a recorded, reviewable explanation links the
  adjustment to the original instruction and its permitted scope. This creates a
  new agreement binding without asking the user again. The runtime validates the
  reference chain; an agent/reviewer judges whether the delegation really covers it.

Example: adding a focused regression check for already-approved behavior may fit
existing delegation; weakening acceptance to pass a failing implementation does
not. Ambiguity is reported as an unresolved decision, never silently approved.

This PRD requires structural agreement diffs, not semantic requirement-impact
analysis. Conservatively invalidate prior verification when its v4 input bindings
change. Preserve all earlier results as history.

- **S-14:** Editing a PRD under the same filename marks the agreement changed and
  blocks execution until its disposition is recorded. Lifecycle-only edits do not.
- **S-15:** A delegated check improvement records its basis against the new digest
  without another user approval; the changed check still requires fresh verification.
- **S-16:** A changed behavior or unresolved consequential decision remains blocked
  until the user decision is recorded. A deferral is not reported as delivery.

### R-06 — Produce a deterministic resume report

Expose read-only `resume` inspection in human and versioned JSON form; distinguish
it from the lifecycle operation that resumes execution. The report contains:

- Selected change, PRD/revision, lifecycle, HEAD/base compatibility, and dirty paths.
- The agreed outcome and constraints from authored artifacts, with references.
- Current authorization and decision status, including agreement differences.
- Ticket progress, latest attempt outcomes, evidence freshness, and candidate verdict.
- Pause/reopen reason, optional handoff note, blockers, and an ordered next action.

Authored notes are labeled as such and cannot override computed state. Do not require
an LLM to inspect, validate, or render this report. Preserve the raw diagnostics
behind any concise human summary; JSON never mixes in progress prose.

Next-action precedence: invalid/missing state or selection → unresolved running
attempt → lifecycle/repository mismatch → agreement/decision gap → failed/stale
verification or unfinished work → completion → evaluation → read-only release audit.
Name the affected ticket/check when routing verification. Historical changes route
to inspection or a replacement change, never to execution.

- **S-17:** A fresh agent session can state A's agreement, current blocker, and next
  command using only the report and referenced artifacts; no previous chat is needed.
- **S-18:** Contradictory handoff prose cannot make red evidence green or mark
  authorization current. Human output, JSON, and command gates agree.
- **S-19:** Repeated inspection leaves tracked and runtime records unchanged and
  launches no verification or approval request.

### R-07 — Preserve verification and candidate identity across changes

Namespace attempt pointers, candidate checks, exported evidence, and evaluation
references by change and revision as well as ticket/check identity. Two changes
may use check ID C-01 and the same candidate commit without borrowing outcomes.
Keep the v4 attempt-schema validation, captured-log digest checks, bounded timeout,
and latest-failure rules; lifecycle metadata cannot weaken them.

Replace root NOTES as the sole locator with an explicit per-change evaluation
reference. Root `NOTES.md` may remain the human-facing compatibility summary, but
overwriting it for B must not lose A's evaluation identity. Saved evidence can be
inspected without local attempts, with the same provenance limitation as v4.

Keep conservative source invalidation: B may change A's verification inputs even
when A's agreement is unchanged. Resume preserves A's authorization while reporting
stale evidence. Do not introduce a dependency-scoped source hash in this PRD.

Do not relax post-candidate commit checks for entire directories. Completion,
agreement, and authored lifecycle changes belong before candidate selection.
Candidate evaluation references must avoid self-referential digests and be saved
as validated, listed evaluation artifacts. Selection and read-only inspection are
local operations and create no candidate-changing tracked diff.

- **S-20:** A and B sharing C-01 and a candidate have distinct contexts and verdicts;
  a pass or failure cannot be attributed to the wrong change.
- **S-21:** B changes source while A is paused. Returning to A retains authorization
  but shows stale verification; a fresh pass is required before closure.
- **S-22:** Evaluate A, then B. Both saved evaluations remain addressable. A's old
  candidate is historical if source has since changed; selection does not revive it.
- **S-23:** Completing then evaluating a change works without a lifecycle commit
  after evaluation. Read-only release never marks completed, changes selection,
  runs checks, merges, or publishes.

### R-08 — Make all lifecycle mutations atomic and recoverable

Use the shared worktree lock and atomic/journaled state writes for registration,
selection, authorization, revision binding, transitions, and evaluation-reference
updates. Protect the entire validate-and-transition operation, not only its final
write. Check for relevant running attempts under the lock before transitions.

Do not hold a lock across a user conversation. Revision/digest comparison at commit
time must reject a decision prepared against an agreement that changed meanwhile.
Pause/cancel/supersede refuse while a check is running; they do not kill it silently.
Existing explicit cancellation and recovery handle the attempt first.

On interruption, recover either the prior complete state or the committed transition
with its matching event; never a projection without its history. A read-only status
may diagnose incomplete state but cannot repair it. Git-merge conflicts in change
records are explicit invalid state, not last-writer-wins history.

- **S-24:** Concurrent selection/transition writers cannot create two active changes,
  lose an event, or overwrite a newer authorization. A check/transition race refuses
  or serializes according to a documented order.
- **S-25:** Forced termination at each transition boundary is recoverable without
  invented authorization or success. Inspection itself writes nothing.
- **S-26:** A running attempt blocks pause/cancel/supersede. After explicit recovery
  of a dead owner, the interrupted result remains visible and the transition works.

### R-09 — Migrate explicitly and preserve distribution compatibility

Provide preview/apply for v0.5.0 bindings, a backup of each changed tracked file,
idempotent application, and a rollback guide. Preserve old attempt and evaluation
files as historical evidence. Do not delete or silently reinterpret them as evidence
with the new change/authorization context.

Migration registers the existing change conservatively: infer no active execution
authorization from its status or old free-text field. Import the old authorization
as an unvalidated historical reference. An existing genuine user instruction can be
recorded against the current agreement without asking the user again. New verification
is required where old evidence cannot satisfy the new identity contract.

For a single valid old binding, migration may set that change as the local selection
when shown explicitly in the preview. A fresh clone still follows S-05. Projects
without runtime bindings retain their documented legacy behavior until migration;
new-schema records must never fall back to legacy when unreadable.

Bundle the same dependency-free runtime in all existing layouts and the plugin.
Update wrappers, canonical playbooks, guards, installer diagnosis, and generated
adapters together. Older runtimes must reject new schemas instead of interpreting
multiple bindings through old single-binding logic.

- **S-27:** Clean, customized, legacy, single-binding v0.5.0, and interrupted
  migration fixtures preserve user work and evidence. Reapply changes nothing.
- **S-28:** Old free-text authorization cannot enable execution by itself; an
  explicit matching prior instruction can, without repeated user approval.
- **S-29:** Every packed layout includes identical runtime files and command
  behavior. Unknown schema and conflicting migration state block safely.

### R-10 — Observe the complete journey and start a delivery baseline

Use packed artifacts in a greenfield fixture and a brownfield fixture containing
unrelated edits. Record the A → pause → B → complete → A journey across fresh agent
sessions, plus changed-scope and interruption cases. Record kit/model/tool versions,
prompts, artifact references, results, failures, and operator interventions.

Measure repeated approvals of unchanged work, wrong-change actions, manual state
repairs, time to identify the correct next action, and unnecessary evaluations.
Use the same brief and fixture on v0.5.0 where supported; record unsupported baseline
steps honestly rather than inventing a numeric comparison. No universal performance
or platform-parity claim follows from this small trial.

- **S-30:** Live fresh-session handoff resumes the intended change with no repeated
  approval of unchanged scope and no lost unrelated edits. Test both project types.
- **S-31:** Live changed-scope and interrupted-check cases show the correct block
  and recovery; deterministic tests independently inject wrong-state conditions.
- **S-32:** The trial report contains baseline/support limitations and intervention
  counts, with unobserved behavior labeled outstanding rather than passed.

## 6. Architecture and implementation decisions

### Ownership

| Artifact | Responsibility |
| --- | --- |
| `.prd/prd-vN.md`, `tickets/` | Authored requirements, breakdown, acceptance, checks |
| `.prd/changes/<id>.json` and versioned companion records if needed | Portable identity, revision/decision/authorization references, lifecycle history |
| `.pincer/runtime/` | Worktree-local selection, attempts, locks, transaction recovery |
| `.prd/evidence/` | Portable evaluated candidate records and per-change evaluation references |
| `NOTES.md` | Compatibility summary; not the sole per-change evaluation locator |
| Human/JSON status and resume | Computed projections, never independently editable truth |

Retain one authoritative owner for each field. Freeze exact schemas and canonical
digest projections in the runtime contract before writing transitions. History must
be complete enough to inspect old agreements, either by retained authored snapshots
or resolvable committed artifact references; a digest with no recoverable input is
insufficient for review. Stored summaries must not embed secrets or whole transcripts.

Portable lifecycle records are versioned by Git. Local selection is not copied
between worktrees. This version guarantees serialization inside one worktree; it
does not provide a cross-worktree ownership service. Divergent portable histories
must be reconciled explicitly before execution after a merge.

### Proposed command surface

These are user-facing contracts to finalize in step 1; exact spelling may change
together with examples/tests, without changing semantics.

| Operation | Proposed form | Writes? |
| --- | --- | --- |
| List retained changes | `change list [--json]` | No |
| Inspect one change | `change show <id> [--json]` | No |
| Select locally | `change select <id>` | Local pointer only |
| Activate | `change activate <id>` | Validated lifecycle event |
| Lifecycle operation | `change pause/resume/complete/reopen/cancel <id> --reason …` | Validated lifecycle event; decision reference where required |
| Supersede | `change supersede <id> --with <replacement> --decision <ref>` | Linked lifecycle event |
| Record agreement authorization | `change authorize <id> --agreement <digest> --decision <ref>` | Authorization event |
| Inspect resume context | `resume [--change <id>] [--json]` | No |

All are invoked through `node scripts/pincer-runtime.cjs …`. Existing registration,
ticket, snapshot, status, check, export, and recover commands remain supported with
the new selection/authorization guards. Document revision-disposition commands and
exact reason codes in step 1. Preserve the existing status exit convention:
successful inspection exits zero even when blocked; readiness gates exit nonzero.

No command name should ambiguously mean both “show where to resume” and “activate
execution”. Human help must make this distinction clear.

## 7. Ordered implementation plan

Each step is a work package to decompose into tickets. Finish its gate before
depending on it. Use a pinned released kit to manage this repository during the
implementation until migration fixtures establish that the new runtime is usable.

| Step | Deliverable | Requirements | Gate |
| --- | --- | --- | --- |
| **1. Freeze contracts and fixtures** | Schemas, states, exact commands/exit codes, agreement projection, per-change evaluation locator, migration policy; save v0.5.0 fixtures. | R-01..09 | No unresolved ownership, identity, or candidate-ordering decision; valid/invalid examples for each record. |
| **2. Retain changes and select explicitly** | Multi-record loader/validator, register/list/show/select, worktree-local pointer, unambiguous ticket association, legacy compatibility. | R-01, R-02 | S-01..06 pass; no source/Git mutation on selection. |
| **3. Record agreements and decisions** | Authored agreement digest, recoverable revision history, explicit authorization records, delegation dispositions, structural agreement diff. | R-04, R-05 | S-11..16 pass; old free text cannot become approval; unchanged work preserves authorization. |
| **4. Implement lifecycle transactions** | All transitions, journal/lock integration, current-state projection validation, conflict/recovery handling, command execution guards. | R-03, R-08 | S-07..10 and S-24..26 pass under subprocess failure and concurrency injection. |
| **5. Integrate resume and evidence** | Human/JSON report, next-action routing, change-scoped attempt/candidate identities, retained evaluation references, unchanged verification safeguards. | R-06, R-07 | S-17..23 pass, including A/B sharing a check ID and candidate; no false readiness from history. |
| **6. Migrate and distribute** | Preview/apply/backups/rollback, old-schema behavior, installer diagnosis, wrappers/playbooks/guards, generated adapters and plugin. | R-09 | S-27..29 pass from packed artifacts; repeated migration preserves user files. |
| **7. Run journeys and prepare review** | Deterministic suite, greenfield/brownfield live handoffs, changed-scope and interruption trials, baseline counts, review packet. | R-10; all integration | S-30..32 observed; every required scenario mapped to inspectable evidence. |

Do not publish an intermediate release that writes new records while old paths can
misinterpret them. Keep implementation details in tickets; update this PRD before
changing its material scope or guarantees.

## 8. Success criteria and review packet

The implementation is ready for review when:

- Every R-01..R-10 and S-01..S-32 maps to code, a meaningful test or live observation,
  and an explicit delivered/blocked/deferred disposition.
- No injected wrong-change, missing-authorization, stale-evidence, malformed-state,
  or interruption case produces a false-ready result.
- The full test suite, both generators, packed-install parity, and supported CI
  matrix pass. Reuse v4 regression cases, including incomplete attempts, edited
  captured logs, and background-child timeout handling.
- Migration/rollback instructions are verified on fixtures, with original files
  and history preserved.
- Live trial records demonstrate the primary journey and disclose limitations.

Provide a review packet containing base/candidate commits, final runtime contracts,
requirement/scenario mapping, test/CI results, migration previews and backup examples,
agreement/decision/lifecycle records, representative blocked/current resume JSON,
and live trial records with intervention counts. Include approved deviations and
known limitations. Do not replace missing observations with wording assertions.

The later review should independently replay: A → B → A; changed acceptance under
the same PRD filename; delegated check improvement; wrong-change execution;
same-candidate C-01 isolation; process death during a transition; a fresh clone with
no selection; and a conflicting portable history. Final authored documentation and
lifecycle changes precede the evaluated candidate, as in v4.

## 9. Risks and follow-ups

- **Approval friction:** conservative digest changes can create unnecessary prompts.
  Explicit delegation dispositions preserve existing authorization without pretending
  that the runtime can judge natural-language intent automatically.
- **Source freshness cost:** another change may invalidate many checks under the
  current whole-workspace digest. Report that honestly; dependency-scoped optimization
  requires a separate correctness argument and performance measurements.
- **Metadata/candidate churn:** lifecycle completion happens before evaluation;
  subsequent authored changes require a new candidate. Never exempt all control files.
- **Shared repositories:** per-worktree locking is not distributed ownership. Do not
  claim prevention of two developers independently working on the same change.
- **Schema upgrades:** old bindings/attempts remain inspectable history, but unreadable
  new state cannot downgrade to a permissive legacy mode.
- **Local trust:** authorization records are local provenance and consistency checks,
  not cryptographic proof of a human decision or sandbox enforcement.

After v5: mechanical requirement-to-ticket-to-check coverage and revision impact;
full Codex/Copilot/plugin trials; repeated independent delivery benchmarks. Hosted
dashboards, tracker integration, and autonomous scheduling remain deferred.
