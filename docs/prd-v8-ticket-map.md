# PRD v8 ticket map — reliable delivery with less effort

[PRD v8](../.prd/prd-v8.md) follows the [readiness assessment](pincer-readiness-2026-09-15.md).
The 22-ticket plan is tracked through ticket runtime receipts. This map is not execution evidence,
measured observations or runtime authorization. Scenario coverage and verification
adequacy are the author's planning judgment; structural checks do not establish adequacy.

The [20 September native-tool amendment](prd-v8-native-tool-plan.md) adds T-120/T-121 before T-109. Earlier API-key execution assumptions are superseded; existing observation obligations remain open.

## Tickets and dependencies

| Ticket | Title | Size | Depends on | Execution |
| --- | --- | --- | --- | --- |
| [T-100](../tickets/T-100-reconcile-v8-scope-and-contracts.md) | Reconcile delivery obligations and freeze the v8 contracts | M | — | Offline implementation/review |
| [T-101](../tickets/T-101-bind-effective-study-inputs.md) | Bind effective execution inputs to the cohort | M | T-100 | Offline implementation/review |
| [T-102](../tickets/T-102-isolate-study-agent-configuration.md) | Isolate and record agent execution configuration | M | T-101 | Offline implementation plus native observation |
| [T-103](../tickets/T-103-claim-study-runs-exclusively.md) | Claim study runs exclusively | M | T-101 | Offline implementation/review |
| [T-104](../tickets/T-104-preserve-study-attempts-on-restart.md) | Preserve checkpointed attempts through interruption | M | T-103 | Offline implementation/review |
| [T-105](../tickets/T-105-account-for-partial-study-usage.md) | Account for incomplete and repeated usage honestly | M | T-104 | Offline implementation/review |
| [T-106](../tickets/T-106-finalize-all-study-outcomes.md) | Finalize every terminal outcome into a valid record | M | T-105 | Offline implementation/review |
| [T-107](../tickets/T-107-supply-real-browser-evaluation.md) | Supply and prove the real browser evaluator | M | T-101 | Offline implementation/review |
| [T-108](../tickets/T-108-prepare-release-before-candidate-selection.md) | Make release preparation reproducible | M | T-100 | Offline implementation/review |
| [T-109](../tickets/T-109-gate-study-execution-readiness.md) | Gate live work on offline integrity and concrete prerequisites | M | T-106, T-107, T-108, T-121 | Live evidence required |
| [T-110](../tickets/T-110-observe-baseline-strict-journeys.md) | Observe the baseline strict journeys and rank friction | L | T-102, T-109 | Live evidence required |
| [T-111](../tickets/T-111-observe-file-only-agent-handoff.md) | Observe platform journeys and a file-only handoff | L | T-110 | Live evidence required |
| [T-112](../tickets/T-112-guide-coverage-authoring.md) | Guide coverage authoring with reviewable proposals | L | T-110 | Offline implementation/review |
| [T-113](../tickets/T-113-simplify-proportionate-workflow.md) | Simplify small-change onboarding and recovery | M | T-110, T-112 | Offline implementation/review |
| [T-114](../tickets/T-114-measure-guided-workflow-benefit.md) | Measure usability on matched improved pilots | L | T-111, T-113 | Live evidence required |
| [T-115](../tickets/T-115-complete-three-arm-delivery-study.md) | Complete the corrected 72-cell comparison | L | T-114 | Live evidence required |
| [T-116](../tickets/T-116-measure-independent-review-effort.md) | Measure independent human review effort | L | T-115 | Live evidence required |
| [T-117](../tickets/T-117-dogfood-pinned-strict-management.md) | Dogfood strict multi-change delivery with a pinned kit | M | T-114 | Live evidence required |
| [T-118](../tickets/T-118-compare-pinned-workflow-alternatives.md) | Compare pinned alternatives on bounded matched work | L | T-116 | Live evidence required |
| [T-119](../tickets/T-119-assemble-v8-evidence-and-release-decision.md) | Assemble the evidence packet and release decision | M | T-116, T-117, T-118 | Offline implementation/review |

## Requirement and scenario coverage

Each scenario has exactly one primary owner below. For executable requirements, the
listed command is the planned behavioral check. For observations, the command validates
actual retained records; the separate review method is required for completion. A newly
named check must be implemented, not treated as a currently passing gate.

| Requirement | Scenario | Owner | Check / review method |
| --- | --- | --- | --- |
| R-01 | S-01 | T-100 | `node test/readiness-contracts.test.js`; review historical dispositions and evidence adequacy |
| R-01 | S-02 | T-100 | `node test/readiness-contracts.test.js`; review historical dispositions and evidence adequacy |
| R-01 | S-03 | T-100 | `node test/readiness-contracts.test.js`; review historical dispositions and evidence adequacy |
| R-02 | S-04 | T-101 | `node test/execution-freeze.test.js`; `node test/benchmark-effective-inputs.test.js` |
| R-02 | S-05 | T-101 | `node test/execution-freeze.test.js`; `node test/benchmark-effective-inputs.test.js` |
| R-02 | S-06 | T-101 | `node test/execution-freeze.test.js`; `node test/benchmark-effective-inputs.test.js` |
| R-03 | S-07 | T-102 | `node test/benchmark-environment.test.js` |
| R-03 | S-08 | T-102 | `node test/benchmark-environment.test.js` |
| R-03 | S-09 | T-102 | `node test/benchmark-environment.test.js` |
| R-04 | S-10 | T-103 | `node test/benchmark-run-claims.test.js` |
| R-04 | S-11 | T-103 | `node test/benchmark-run-claims.test.js` |
| R-04 | S-12 | T-103 | `node test/benchmark-run-claims.test.js` |
| R-05 | S-13 | T-104 | `node test/benchmark-restart.test.js`; `node test/benchmark-run-claims.test.js` |
| R-05 | S-14 | T-104 | `node test/benchmark-restart.test.js`; `node test/benchmark-run-claims.test.js` |
| R-05 | S-15 | T-104 | `node test/benchmark-restart.test.js`; `node test/benchmark-run-claims.test.js` |
| R-06 | S-16 | T-105 | `node test/benchmark-usage-completeness.test.js`; `node test/effort-records.test.js` |
| R-06 | S-17 | T-105 | `node test/benchmark-usage-completeness.test.js`; `node test/effort-records.test.js` |
| R-06 | S-18 | T-105 | `node test/benchmark-usage-completeness.test.js`; `node test/effort-records.test.js` |
| R-07 | S-19 | T-106 | `node test/benchmark-terminal-records.test.js`; `node test/benchmark-orchestrator.test.js` |
| R-07 | S-20 | T-106 | `node test/benchmark-terminal-records.test.js`; `node test/benchmark-orchestrator.test.js` |
| R-07 | S-21 | T-106 | `node test/benchmark-terminal-records.test.js`; `node test/benchmark-orchestrator.test.js` |
| R-08 | S-22 | T-107 | `node test/benchmark-browser.test.js`; `node test/benchmark-browser-live.test.js` |
| R-08 | S-23 | T-107 | `node test/benchmark-browser.test.js`; `node test/benchmark-browser-live.test.js` |
| R-08 | S-24 | T-107 | `node test/benchmark-browser.test.js`; `node test/benchmark-browser-live.test.js` |
| R-09 | S-25 | T-108 | `node test/release-preparation.test.js`; `node test/distribution.test.js` |
| R-09 | S-26 | T-108 | `node test/release-preparation.test.js`; `node test/distribution.test.js` |
| R-09 | S-27 | T-108 | `node test/release-preparation.test.js`; `node test/distribution.test.js` |
| R-10 | S-28 | T-109 | `node test/study-readiness.test.js`; `node scripts/delivery-benchmark-v7/readiness.cjs --manifest docs/prd-v8-artifacts/execution/study.json --require-ready`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-10 | S-29 | T-109 | `node test/study-readiness.test.js`; `node scripts/delivery-benchmark-v7/readiness.cjs --manifest docs/prd-v8-artifacts/execution/study.json --require-ready`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-10 | S-30 | T-109 | `node test/study-readiness.test.js`; `node scripts/delivery-benchmark-v7/readiness.cjs --manifest docs/prd-v8-artifacts/execution/study.json --require-ready`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-11 | S-31 | T-110 | `node test/strict-pilot-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section baseline --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-11 | S-32 | T-110 | `node test/strict-pilot-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section baseline --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-11 | S-33 | T-110 | `node test/strict-pilot-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section baseline --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-12 | S-34 | T-111 | `node test/platform-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section platforms --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-12 | S-35 | T-111 | `node test/platform-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section platforms --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-12 | S-36 | T-111 | `node test/platform-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section platforms --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-13 | S-37 | T-112 | `node test/coverage-guide.test.js`; `node test/coverage-map.test.js`; `node test/coverage-adoption.test.js`; `node test/coverage-agreement.test.js` |
| R-13 | S-38 | T-112 | `node test/coverage-guide.test.js`; `node test/coverage-map.test.js`; `node test/coverage-adoption.test.js`; `node test/coverage-agreement.test.js` |
| R-13 | S-39 | T-112 | `node test/coverage-guide.test.js`; `node test/coverage-map.test.js`; `node test/coverage-adoption.test.js`; `node test/coverage-agreement.test.js` |
| R-14 | S-40 | T-113 | `node test/proportionate-workflow.test.js`; `node test/strict-onboarding.test.js`; `node test/workflow.test.js`; `node test/distribution.test.js` |
| R-14 | S-41 | T-113 | `node test/proportionate-workflow.test.js`; `node test/strict-onboarding.test.js`; `node test/workflow.test.js`; `node test/distribution.test.js` |
| R-14 | S-42 | T-113 | `node test/proportionate-workflow.test.js`; `node test/strict-onboarding.test.js`; `node test/workflow.test.js`; `node test/distribution.test.js` |
| R-15 | S-43 | T-114 | `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section improved-pilots --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-15 | S-44 | T-114 | `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section improved-pilots --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-15 | S-45 | T-114 | `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section improved-pilots --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-16 | S-46 | T-115 | `node test/delivery-benchmark-v7.test.js`; `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section three-arm --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-16 | S-47 | T-115 | `node test/delivery-benchmark-v7.test.js`; `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section three-arm --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-16 | S-48 | T-115 | `node test/delivery-benchmark-v7.test.js`; `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section three-arm --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-17 | S-49 | T-116 | `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section reviews --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-17 | S-50 | T-116 | `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section reviews --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-17 | S-51 | T-116 | `node test/improvement-trial-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section reviews --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-18 | S-52 | T-117 | `node test/dogfood-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section dogfood --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-18 | S-53 | T-117 | `node test/dogfood-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section dogfood --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-18 | S-54 | T-117 | `node test/dogfood-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section dogfood --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-19 | S-55 | T-118 | `node test/competitive-study-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-19 | S-56 | T-118 | `node test/competitive-study-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-19 | S-57 | T-118 | `node test/competitive-study-records.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed`; inspect actual session/candidate/reviewer artifacts against the scenario |
| R-20 | S-58 | T-119 | `npm test`; `node test/benchmark-browser-live.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section all --require-observed`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed` |
| R-20 | S-59 | T-119 | `npm test`; `node test/benchmark-browser-live.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section all --require-observed`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed` |
| R-20 | S-60 | T-119 | `npm test`; `node test/benchmark-browser-live.test.js`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section all --require-observed`; `node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed` |

## Carry-forward from v7

| Existing obligation | New execution owner | Completion rule |
| --- | --- | --- |
| T-89 real baseline pilots | T-110 | Actual K0/K1 records, historical sequencing deviation explicit |
| T-90/T-91/T-92/T-97 implemented but dependency-blocked | T-100 obligation reconciliation; T-110 observations | No reimplementation or automatic ticket closure; use real evidence and explicit dispositions |
| T-93 platforms/handoff | T-111 | Exact-version live stages; packaged parity is insufficient |
| T-95 paired comparison | T-110 K0/K1 and T-114 K1/K2 | Distinct questions and kit identities; reuse only declared compatible observations |
| T-95 72 cells and independent reviews | T-115/T-116 | One continued 72-cell obligation, not 144 cells; reviewers remain independent |
| T-96 final packet / v7 unfinished dispositions | T-119 | Link candidate-bound evidence and honest historical deviations |
| T-98/T-99 remaining execution gaps | T-101–T-107 | Prevent the post-T-99 reproductions and validate actual terminal/restart outputs |

Old tickets and PRDs remain untouched. This successor plan cannot make an impossible
historical ordering true or close a v7 ticket merely because a v8 fixture passes.
T-100 prepares the detailed disposition; necessary scope decisions are recorded when made.
No dependencies on unfinished old tickets are inserted that would form a circular gate.

## Gates and execution limits

- **First ready ticket:** T-100. Authoring the plan does not start it.
- **Before operational smoke:** T-101, T-103–T-108 complete, T-102 implementation verified,
  T-109 offline integrity passes and the
  actual numeric budgets, wall-clock caps, projects/access, reviewers and version pins
  are recorded. T-109 itself stays open until its capped operational smoke is observed.
- **Before measured sessions:** T-102 and T-109 both complete with reviewed native
  observations. The 19 September scheduling correction moves the T-102 completion
  dependency from T-106 to T-110; it removes the smoke/observation cycle without
  closing T-102 on fixtures or relaxing any acceptance scenario.
- **Before usability implementation:** T-110's evidence supports the hypothesis. A
  contrary result requires a concrete revision before replacing the feature.
- **Before the main comparison:** K2 and all effective inputs are pinned; T-114 results
  are recorded, including misses, and remaining spend is known. Keep 72 scheduled cells.
- **Before the later competitive study:** a separate 27-cell protocol/budget is approved;
  comparator versions and task/model/cap fairness are checked. It cannot replace 72 cells.
- **Before programme completion:** all required observation sections, independent reviews,
  actual candidate evidence, full CI, browser integration and release audit are present.
  A missing study is unfinished scope, not a waived check.

Use focused tests for ticket iteration, including missing/invalid/forged cases. The full
suite is required at integration. Never invoke paid models in npm test or a Verification
block. A live ticket's --require-observed command reads retained artifacts and exits
nonzero for missing, outstanding, synthetic or incompatible evidence; semantic review
remains a separately recorded judgment. No reusable test can authenticate human intent.

Existing untracked guide/diagrams remain outside the planning commit. This repository
stays in legacy management mode, with a pinned external management kit for later work.
No change record, strict adoption or authorization is manufactured by this breakdown.

## Native-tool amendment tickets

| Ticket | Requirement/scenarios | Depends on | Verification |
| --- | --- | --- | --- |
| [T-120](../tickets/T-120-define-native-tool-study-contracts.md) | R-21 / S-61, S-62, S-63 | — | `test/native-tool-contracts.test.js` over [the authored contracts](prd-v8-native-tool-contracts.md), plus human review of feasibility and honesty |
| [T-121](../tickets/T-121-implement-native-login-study.md) | R-22 / S-64, S-65, S-66 | T-120 | Native-login entry-point suite, environment, allocation and launch suites; candidate CI |

Native observation remains owned by T-102/T-109; these new tickets cannot replace it with fixtures.
