# PRD v6 ticket map and implementation order

[PRD v6](../.prd/prd-v6.md) is decomposed into **13 open tickets, T-66..T-78**.
The user selected this direction and requested this breakdown. This is planned
coverage, not delivered evidence. No runtime implementation, adoption, evaluation,
merge or publication is performed by creating these documents.

Start with **T-66**. Follow `depends_on`; numeric order is safe. T-71 can follow T-69
independently of T-70; T-76 can start after the contract freeze so benchmark design
precedes live delivery. This is dependency flexibility, not a requirement for agents
to run in parallel. Sizes are relative scope, not elapsed-time estimates. L tickets
may be split before execution if that improves reviewability, preserving all scenarios
and dependencies. T-77 is L because it includes 36 observed runs, not just a validator.

The repository remains in its current legacy management mode. Use an independent
pinned released v0.5.0 management kit (or an explicitly selected later release);
new runtime/adoption tests operate on disposable installed fixtures. Prior v5
release gates are independent and must not be described as passed by this plan.

Verification blocks reference new test deliverables: they intentionally do not pass
until implemented. Do not create placeholder tests or attempt/receipt metadata.
Each suite must exercise its actual failure/success behavior and join `npm test`.
Static checks are appropriate for frozen documents and generated parity, but do not
prove semantic adequacy, live observations or superiority. This map's completeness
and proposed check adequacy are the planning author's judgment, subject to review.

## Ticket order

| Ticket | Work | Size | Depends on | Main verification |
| --- | --- | --- | --- | --- |
| [T-66](../tickets/T-66-freeze-coverage-and-impact-contracts.md) | Freeze coverage, impact and compatibility contracts | M | None | `node test/coverage-contracts.test.js`; `node test/change-contracts.test.js` |
| [T-67](../tickets/T-67-parse-requirement-and-scenario-inventory.md) | Parse the complete PRD requirement and scenario inventory | M | T-66 | `node test/coverage-inventory.test.js`; `node test/runtime-parse.test.js` |
| [T-68](../tickets/T-68-validate-authored-coverage-links.md) | Validate authored coverage links and check definitions | M | T-67 | `node test/coverage-map.test.js`; `node test/change-registry.test.js` |
| [T-69](../tickets/T-69-bind-and-adopt-strict-coverage.md) | Bind strict coverage, dispositions and explicit adoption | L | T-68 | `node test/coverage-agreement.test.js`; `node test/coverage-adoption.test.js`; `node test/change-transactions.test.js`; `node test/change-migration.test.js` |
| [T-70](../tickets/T-70-compute-phase-specific-coverage.md) | Compute structural and implementation coverage | M | T-69 | `node test/coverage-readiness.test.js`; `node test/change-lifecycle.test.js` |
| [T-71](../tickets/T-71-explain-structural-requirement-impact.md) | Explain structural requirement and verification impact | M | T-69 | `node test/coverage-impact.test.js`; `node test/change-evidence-context.test.js` |
| [T-72](../tickets/T-72-execute-declared-candidate-checks.md) | Execute agreement-bound candidate check definitions | M | T-69, T-70 | `node test/coverage-checks.test.js`; `node test/change-command-gates.test.js`; `node test/runtime-runner.test.js` |
| [T-73](../tickets/T-73-enforce-complete-candidate-coverage.md) | Reconcile full candidate coverage at export and release | L | T-70, T-71, T-72 | `node test/coverage-evidence.test.js`; `node test/change-evaluations.test.js`; `node test/runtime-evidence.test.js` |
| [T-74](../tickets/T-74-integrate-coverage-impact-and-resume.md) | Expose coverage, impact and actionable resume reports | M | T-71, T-73 | `node test/coverage-reports.test.js`; `node test/change-resume.test.js`; `node test/runtime-status.test.js` |
| [T-75](../tickets/T-75-ship-coverage-workflow-and-compatibility.md) | Ship strict coverage through every layout and playbook | M | T-74 | `node test/coverage-distribution.test.js`; `node test/workflow.test.js`; `npm test` |
| [T-76](../tickets/T-76-build-independent-delivery-benchmark.md) | Build independent delivery benchmark fixtures and harness | M | T-66 | `node test/delivery-benchmark.test.js` |
| [T-77](../tickets/T-77-observe-v6-delivery-and-scope-decisions.md) | Observe paired delivery trials and revised-scope decisions | L | T-75, T-76 | `node test/coverage-trial-record.test.js`; `node test/delivery-benchmark.test.js` |
| [T-78](../tickets/T-78-assemble-v6-review-packet.md) | Assemble v6 traceability, replay cases and final gates | M | T-77 | `node test/coverage-review-packet.test.js`; `npm test` |

## Requirement and scenario ownership

The primary owner below supplies executable behavior or live evidence. T-66 enables
R-01..R-09 through the contract; T-78 consolidates all results. T-75 updates the
playbooks needed for S-27; T-77 owns its live observation. No scenario is satisfied
by merely tagging a test block with its ID.

| Requirement | Scenario | Primary ticket | Verification / review method |
| --- | --- | --- | --- |
| R-01 | S-01 | T-67 | `node test/coverage-inventory.test.js`; `node test/runtime-parse.test.js` |
| R-01 | S-02 | T-67 | `node test/coverage-inventory.test.js`; `node test/runtime-parse.test.js` |
| R-01 | S-03 | T-67 | `node test/coverage-inventory.test.js`; `node test/runtime-parse.test.js` |
| R-02 | S-04 | T-68 | `node test/coverage-map.test.js`; `node test/change-registry.test.js` |
| R-02 | S-05 | T-68 | `node test/coverage-map.test.js`; `node test/change-registry.test.js` |
| R-02 | S-06 | T-68 | `node test/coverage-map.test.js`; `node test/change-registry.test.js` |
| R-03 | S-07 | T-69 | `node test/coverage-agreement.test.js`; `node test/coverage-adoption.test.js`; `node test/change-transactions.test.js`; `node test/change-migration.test.js` |
| R-03 | S-08 | T-69 | `node test/coverage-agreement.test.js`; `node test/coverage-adoption.test.js`; `node test/change-transactions.test.js`; `node test/change-migration.test.js` |
| R-03 | S-09 | T-69 | `node test/coverage-agreement.test.js`; `node test/coverage-adoption.test.js`; `node test/change-transactions.test.js`; `node test/change-migration.test.js` |
| R-04 | S-10 | T-71 | `node test/coverage-impact.test.js`; `node test/change-evidence-context.test.js` |
| R-04 | S-11 | T-71 | `node test/coverage-impact.test.js`; `node test/change-evidence-context.test.js` |
| R-04 | S-12 | T-71 | `node test/coverage-impact.test.js`; `node test/change-evidence-context.test.js` |
| R-05 | S-13 | T-70 | `node test/coverage-readiness.test.js`; `node test/change-lifecycle.test.js` |
| R-05 | S-14 | T-70 | `node test/coverage-readiness.test.js`; `node test/change-lifecycle.test.js` |
| R-05 | S-15 | T-70 | `node test/coverage-readiness.test.js`; `node test/change-lifecycle.test.js` |
| R-06 | S-16 | T-72 | `node test/coverage-checks.test.js`; `node test/change-command-gates.test.js`; `node test/runtime-runner.test.js` |
| R-06 | S-17 | T-72 | `node test/coverage-checks.test.js`; `node test/change-command-gates.test.js`; `node test/runtime-runner.test.js` |
| R-06 | S-18 | T-72 | `node test/coverage-checks.test.js`; `node test/change-command-gates.test.js`; `node test/runtime-runner.test.js` |
| R-07 | S-19 | T-73 | `node test/coverage-evidence.test.js`; `node test/change-evaluations.test.js`; `node test/runtime-evidence.test.js` |
| R-07 | S-20 | T-73 | `node test/coverage-evidence.test.js`; `node test/change-evaluations.test.js`; `node test/runtime-evidence.test.js` |
| R-07 | S-21 | T-73 | `node test/coverage-evidence.test.js`; `node test/change-evaluations.test.js`; `node test/runtime-evidence.test.js` |
| R-08 | S-22 | T-69 | `node test/coverage-agreement.test.js`; `node test/coverage-adoption.test.js`; `node test/change-transactions.test.js`; `node test/change-migration.test.js` |
| R-08 | S-23 | T-69 | `node test/coverage-agreement.test.js`; `node test/coverage-adoption.test.js`; `node test/change-transactions.test.js`; `node test/change-migration.test.js` |
| R-08 | S-24 | T-75 | `node test/coverage-distribution.test.js`; `node test/workflow.test.js`; `npm test` |
| R-09 | S-25 | T-74 | `node test/coverage-reports.test.js`; `node test/change-resume.test.js`; `node test/runtime-status.test.js` |
| R-09 | S-26 | T-74 | `node test/coverage-reports.test.js`; `node test/change-resume.test.js`; `node test/runtime-status.test.js` |
| R-09 | S-27 | T-77 | `node test/coverage-trial-record.test.js`; `node test/delivery-benchmark.test.js`; actual trial outputs and transcript/evaluator review (validator checks structure only) |
| R-10 | S-28 | T-76 | `node test/delivery-benchmark.test.js` |
| R-10 | S-29 | T-77 | `node test/coverage-trial-record.test.js`; `node test/delivery-benchmark.test.js`; actual trial outputs and transcript/evaluator review (validator checks structure only) |
| R-10 | S-30 | T-77 | `node test/coverage-trial-record.test.js`; `node test/delivery-benchmark.test.js`; actual trial outputs and transcript/evaluator review (validator checks structure only) |

## Exit gates

1. Freeze grammar, versions, ownership, disposition semantics and phase boundaries
   before implementing persistence (T-66).
2. Inventory/map must reject omitted and malformed obligations before authorization
   binding and adoption can be trusted (T-67..T-69).
3. Coverage/impact, declared checks and export/release must independently reject the
   nominated false-ready cases while preserving all v5 gates (T-70..T-74).
4. Adoption rollback, older-runtime rejection and packed layouts must work before
   required live runs (T-75). The benchmark protocol/evaluators are frozen before
   those runs (T-76).
5. T-77 keeps every run, including failures; missing required observations keep the
   ticket open unless scope is explicitly revised. A failed generic-continue trial
   is a finding even when another runtime gate eventually blocks execution.
6. T-78 reconciles actual evidence for every scenario, runs scratch replays and
   records the full supported CI matrix on the final implementation. Final authored
   documents/completion metadata precede evaluation; release is a separate stage.

All tickets start `open`, with unchecked criteria and no lifecycle receipts. Earlier
PRDs and T-01..T-65 remain untouched. `status: ticketed` states that this breakdown
exists; it neither claims implementation nor records authenticated approval.
