# PRD v5 ticket map and implementation order

[PRD v5](../.prd/prd-v5.md) is decomposed into **15 open tickets, T-47..T-61**.
This is planned coverage, not delivered evidence. The user authorized ticket creation;
implementation, migration, merging, and publishing have not started in this task.
Completeness and check adequacy are the breakdown author's judgment, subject to later
implementation review. All 32 PRD scenarios have a primary owner below.

## How to implement

Start at **T-47**. Follow `depends_on`; numerical order is a safe default.
T-50 and T-51 have the same prerequisite and may be completed independently, but no
parallel-agent execution is required. Sizes are relative scope, not time estimates.
L tickets need careful transaction/migration failure testing and may be split if it
improves verification, preserving this map and their downstream dependencies.

Use a pinned released v0.5.0 kit to drive this repository's ticket lifecycle. Do not
register/migrate this distribution repository into the partially built v5 runtime.
Use disposable installed fixtures for all new-state behavior, worktree, and migration
tests. The current template runtime already provides the released legacy mode here;
keep the management copy independent while editing it.

The new test paths in ticket Verification blocks are implementation deliverables.
They intentionally fail to run until created; no placeholder tests or receipts were
written during breakdown. Each owner adds its meaningful suite to `npm test`.
Run focused tests during implementation and both generators after template edits.
T-59/T-61 run the full suite and distribution gates. Code and evidence changes found
by live trials or review go through follow-up tickets, not falsified completion.

## Ticket order

| Ticket | Work | Size | Depends on | Verification |
| --- | --- | --- | --- | --- |
| [T-47](../tickets/T-47-freeze-change-lifecycle-contracts.md) | Freeze lifecycle, agreement, and migration contracts | M | None | `node test/change-contracts.test.js` |
| [T-48](../tickets/T-48-atomic-change-transactions.md) | Add atomic change transactions and recovery | L | T-47 | `node test/change-transactions.test.js`; `node test/runtime-state.test.js` |
| [T-49](../tickets/T-49-retain-multiple-change-records.md) | Retain and validate multiple change records | M | T-48 | `node test/change-registry.test.js`; `node test/runtime-identity.test.js` |
| [T-50](../tickets/T-50-explicit-worktree-change-selection.md) | Select changes explicitly per worktree | M | T-49 | `node test/change-selection.test.js` |
| [T-51](../tickets/T-51-agreement-digests-and-revision-history.md) | Identify agreements and retain their authored revisions | M | T-49 | `node test/change-agreement.test.js`; `node test/runtime-parse.test.js` |
| [T-52](../tickets/T-52-authorization-and-decision-dispositions.md) | Record authorization and disposition agreement changes | M | T-51 | `node test/change-authorization.test.js` |
| [T-53](../tickets/T-53-change-lifecycle-transitions.md) | Implement the change lifecycle and preserve event history | L | T-50, T-52 | `node test/change-lifecycle.test.js`; `node test/change-transactions.test.js` |
| [T-54](../tickets/T-54-enforce-change-and-authorization-gates.md) | Apply selection, lifecycle, and authorization gates to commands | M | T-53 | `node test/change-command-gates.test.js`; `node test/ticket.test.js`; `node test/verification.test.js` |
| [T-55](../tickets/T-55-isolate-change-verification-contexts.md) | Isolate attempts and candidate checks by change and revision | M | T-54 | `node test/change-evidence-context.test.js`; `node test/runtime-runner.test.js` |
| [T-56](../tickets/T-56-retain-per-change-evaluations.md) | Retain per-change evaluation references and release verdicts | M | T-55 | `node test/change-evaluations.test.js`; `node test/runtime-evidence.test.js` |
| [T-57](../tickets/T-57-deterministic-resume-report.md) | Render deterministic resume context and next actions | M | T-56 | `node test/change-resume.test.js`; `node test/change-command-gates.test.js` |
| [T-58](../tickets/T-58-migrate-v05-change-state.md) | Migrate v0.5.0 change state explicitly with backups | L | T-57 | `node test/change-migration.test.js`; `node test/runtime-migrate.test.js`; `node test/installer.test.js` |
| [T-59](../tickets/T-59-ship-change-workflow-adapters.md) | Ship the change workflow in every layout and adapter | M | T-58 | `node test/change-distribution.test.js`; `npm test` |
| [T-60](../tickets/T-60-observe-change-handoffs-and-baseline.md) | Observe live change handoffs and record the baseline | M | T-59 | `node test/change-trial-record.test.js`; `node test/change-resume.test.js`; `node test/change-command-gates.test.js` |
| [T-61](../tickets/T-61-assemble-v5-review-packet.md) | Assemble the implementation review packet and final gates | M | T-60 | `node test/change-review-packet.test.js`; `npm test` |

## Requirement and scenario coverage

The primary owner supplies the scenario's executable test or live evidence. Supporting
tickets supply shared mechanisms; T-61 assembles final dispositions for all rows.
The contract freeze T-47 enables all requirements without claiming runtime behavior.

| Requirement | Scenario | Acceptance focus | Primary ticket | Check or review method |
| --- | --- | --- | --- | --- |
| R-01 | S-01 | Retain A when registering B | T-49 | `node test/change-registry.test.js` |
| R-01 | S-02 | Reject duplicate/malformed identities | T-49 | `node test/change-registry.test.js` |
| R-01 | S-03 | Refuse destructive replacement | T-49 | `node test/change-registry.test.js` |
| R-02 | S-04 | Preserve dirty work; reject wrong-change execution | T-54 | `node test/change-command-gates.test.js` |
| R-02 | S-05 | Require explicit selection in fresh/missing state | T-50 | `node test/change-selection.test.js` |
| R-02 | S-06 | Independent linked worktrees | T-50 | `node test/change-selection.test.js` |
| R-03 | S-07 | Pause/resume with retained history | T-53 | `node test/change-lifecycle.test.js` |
| R-03 | S-08 | Complete only on current verified work | T-53 | `node test/change-lifecycle.test.js` |
| R-03 | S-09 | Preserve terminal histories; reject supersession cycles | T-53 | `node test/change-lifecycle.test.js` |
| R-03 | S-10 | Reopen without reviving evidence | T-53 | `node test/change-lifecycle.test.js` |
| R-04 | S-11 | Reuse exact prior authorization | T-54 | `node test/change-command-gates.test.js` |
| R-04 | S-12 | Block missing/wrong/unmatched authorization | T-54 | `node test/change-command-gates.test.js` |
| R-04 | S-13 | Normalize lifecycle; detect authored agreement changes | T-51 | `node test/change-agreement.test.js` |
| R-05 | S-14 | Block same-filename PRD revision until disposition | T-54 | `node test/change-command-gates.test.js` |
| R-05 | S-15 | Delegate check improvements; require fresh verification | T-54 | `node test/change-command-gates.test.js` |
| R-05 | S-16 | Require consequential scope decisions | T-54 | `node test/change-command-gates.test.js` |
| R-06 | S-17 | Fresh-session report is sufficient | T-57 | `node test/change-resume.test.js` |
| R-06 | S-18 | Notes cannot override computed state | T-57 | `node test/change-resume.test.js` |
| R-06 | S-19 | Inspection has no side effects | T-57 | `node test/change-resume.test.js` |
| R-07 | S-20 | Isolate shared candidate/check IDs | T-55 | `node test/change-evidence-context.test.js` |
| R-07 | S-21 | B changes source; A retains approval but becomes stale | T-55 | `node test/change-evidence-context.test.js` |
| R-07 | S-22 | Retain per-change evaluations | T-56 | `node test/change-evaluations.test.js` |
| R-07 | S-23 | Complete before evaluation; release is read-only | T-56 | `node test/change-evaluations.test.js` |
| R-08 | S-24 | Serialize actual contested mutations | T-53 | `node test/change-lifecycle.test.js` |
| R-08 | S-25 | Recover process death at transaction boundaries | T-53 | `node test/change-lifecycle.test.js` |
| R-08 | S-26 | Running attempt blocks transition; explicit recovery | T-53 | `node test/change-lifecycle.test.js` |
| R-09 | S-27 | Preserve files through migration/reapply/rollback | T-58 | `node test/change-migration.test.js` |
| R-09 | S-28 | Do not promote legacy authorization text | T-58 | `node test/change-migration.test.js` |
| R-09 | S-29 | Packed parity and schema/migration rejection | T-59 | `node test/change-distribution.test.js` |
| R-10 | S-30 | Observe A/B/A in both project types | T-60 | Live trial artifacts + transcript review; `node test/change-trial-record.test.js` checks completeness, not truth |
| R-10 | S-31 | Observe scope decision and interruption | T-60 | Live trial artifacts + transcript review; `node test/change-trial-record.test.js` checks completeness, not truth |
| R-10 | S-32 | Record honest baseline and limitations | T-60 | Live trial artifacts + transcript review; `node test/change-trial-record.test.js` checks completeness, not truth |

Supporting verification: T-48 supplies concurrent-writer/crash tests for T-53;
T-50 supplies selection mechanics for T-54; T-51/T-52 supply agreement and decision
validation for T-54; T-58 supplies migration/schema rejection for T-59. Existing
v4 failure-injection suites remain required throughout integration.

## Gates for handing back the implementation

1. Complete contract/examples before implementing new state writes.
2. Complete transaction, registry, selection, agreement and authorization mechanisms
   before exposing executable lifecycle transitions.
3. Finish command guards and change-scoped evidence before declaring resume usable.
4. Pass migration/rollback and packed layouts before running live handoff trials.
5. Record the required live observations; unavailable required trials keep T-60 open
   unless the user explicitly changes scope. A format checker cannot establish agent compliance.
6. Prepare T-61's review packet and required CI results. Missing CI is outstanding,
   not a pass. Final authored documents and completion metadata precede the evaluated
   candidate; evaluation and release remain separate actions.

All tickets start `open` with unchecked acceptance criteria and no attempt/receipt
fields. Prior tickets T-01..T-46 remain untouched. PRD `status: ticketed` records
that this breakdown exists; it does not assert authorization to execute or release.

