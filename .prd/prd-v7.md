---
version: 7
status: ticketed
date: 2026-09-14
profile: standard
---

# Make trusted delivery easier and cheaper

## 1. Problem and authorization

Pincer now has explicit change identity, agreement-bound authorization, recoverable
transitions and candidate-bound strict coverage. Developers still have to assemble
maps and navigate a long command sequence, and no recorded live session has carried
strict coverage through its complete journey. The v6 benchmark reports 17/18 accepted
runs in each arm with approximately 4.7 times the cost and 3.85 times the active
session time for Pincer. It does not measure human review effort, isolates neither
the complete agent configuration nor the live driver, and does not establish an
acceptance advantage. The next increment must test and improve practical value.

Original brief: after the current-state assessment recommended strict pilots,
lower workflow overhead, real platform handoffs and controlled comparisons, the
user requested **“create the next prd and tickets”**. This authorizes preparing this
scope and breakdown. This planning task does not execute implementation or trials,
incur trial spending, register runtime authorization, migrate the distribution repo,
merge, or publish. Future execution reuses actual session authorization for the
same scope; a missing project-access decision or trial spending cap must be settled
before dependent live runs. No spending or wall-clock budget has been supplied.

Baseline: local `main` at `715853d`, package 0.6.0. The preceding assessment in this
session ran all 51 suites successfully on Node 22.23.1/macOS and validated the saved
`ce98abd` manifest. That manifest describes its historical candidate, not this PRD
or the current HEAD. Profile `standard` fits changes to shipped workflow guidance,
authored coverage tooling, context reporting and experimental methodology.

References: [original roadmap](../docs/pincer-improvement-plan.md),
[v6 evaluation](../NOTES.md), [assessment disposition](evidence/prd-v6/ce98abdbc6edd4e8d4f5736fee35dd765b930452/review/assessment-disposition.md),
[v6 trial and limitations](../docs/trial-prd-v6.md),
[ticket map and build order](../docs/prd-v7-ticket-map.md).

## 2. Solution

Establish a reproducible effort baseline, observe three real strict-coverage pilots,
then reduce the manual work of building coverage maps and recovering context.
Ship a read-only coverage scaffold, a concise resume view and a coherent first-use
journey through the existing runtime. Observe the resulting journey on Claude Code
and Codex, including a handoff, and compare plain, default-Pincer and strict-Pincer
delivery under a fully recorded configuration. Measure human effort separately
from agent usage. Evidence and decisions remain explicit throughout.

Pilot findings determine the details of the two bounded product improvements,
not an unlimited optimization backlog. If observations show a proposed improvement
does not address the friction, record the evidence and revise this PRD and its
mapping before substituting work. Never implement unrelated features merely to
fill a ticket, or mark a required pilot complete from synthetic records.

## 3. Scope and preservation

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| Three baseline strict pilots: one new project and two existing projects | Arbitrary changes to third-party or production projects |
| Local measurement records, complete protocol/configuration freeze, explicit human review timing | Hosted telemetry, private transcript publication or model billing integration |
| Coverage draft scaffolding, concise resume, guided first use and recovery | Automatic approval, automatic map adoption or speculative test-command execution |
| Live Claude Code and Codex journeys and a cross-agent handoff | New hooks, native Windows support, or unobserved Copilot/plugin parity claims |
| Eight-brief, three-arm comparison and paired product-efficiency measurements | A promise of statistical superiority or a requirement to report favorable results |
| Final regressions, packaged parity, candidate review and current support documentation | Merge, version bump, npm publication or a release-policy redesign |

Preserve agreement identity, explicit decisions, selection/worktree isolation,
latest-failure precedence, source mutation detection, conservative source freshness,
attempt locking, transaction recovery and the exact post-candidate artifact
allowlist. Preserve legacy, migrated, changes and strict modes. Keep schemas and
default CLI output compatible; new draft/brief output is opt-in. A requirement-body
edit remains governed by the existing structural-impact contract and freshness
gates; this PRD does not reclassify the earlier F-02 finding as a release bypass.

## 4. Requirements and acceptance scenarios

IDs are stable within this PRD. The ticket map is planned traceability, not evidence.

### R-01 — Freeze the improvement protocol and preservation contract

Write a versioned v7 protocol before collecting data. Define cohorts, measurements,
run exclusions, validity versus acceptance, configuration isolation, review tasks,
resource caps, artifact redaction and the product contracts below. Preserve the
v6 frozen protocol, records and historical conclusions. Reconcile stale handover
claims against repository evidence, marking unverified remote state explicitly.

- **S-01:** The protocol identifies immutable baseline kit/source digests, pilot selection rules, run order, review rubric, metrics and caps before the first observed run; absent access or spending decisions leave execution pending.
- **S-02:** A reviewable preservation matrix maps the current authorization, evidence, recovery and compatibility guarantees to existing regression suites; no efficiency target changes those gates.
- **S-03:** Handover documentation reflects the evaluation/version commits actually present in this checkout, distinguishes historical candidate validation from current readiness, and retains v6 artifacts byte-for-byte.

### R-02 — Measure real effort with complete execution provenance

Build local collection and reporting around a versioned run record. Capture kit and
base digests, prompts, model/tool/OS versions, driver/evaluator digests, configuration
inventory, session boundaries and actual intervention events. Time setup, authoring,
verification, recovery and human review separately; distinguish elapsed time,
active session time and provider-reported duration. Record tokens/cost when available.

- **S-04:** A controlled multi-session run produces linked records for commands, stage timings, interventions, candidate and evaluator result; totals recompute from raw events without counting overlapping intervals twice.
- **S-05:** Unknown measurements remain null with a reason; missing required provenance, tools or acceptance results make a run invalid or outstanding, never accepted or zero-cost by default. Partially completed or cap-terminated work is evaluated when a usable candidate exists under the predeclared rule.
- **S-06:** Changing a prompt, live driver, effort collector, evaluator, cap or configuration fingerprint breaks the frozen run identity; replaying reports needs no model calls, and persisted summaries contain no secret values or unrestricted environment dumps.

### R-03 — Observe strict coverage before optimizing it

Select one greenfield and two brownfield projects with genuine intended work, known
base revisions, existing-behavior checks and independent acceptance criteria. At
least one brownfield project has pre-existing user edits whose preservation is
recorded. Agents follow the pinned baseline kit's shipped instructions; every
operator intervention is visible. Deliberate failure probes run in disposable copies.

- **S-07:** Each of the three projects records actual install/adoption, an authorized scope revision, pause and fresh-session resume, candidate checks and schema 3 evaluation evidence; unrelated edits survive and no generic continue is represented as approval of revised scope.
- **S-08:** Failed, repaired and unavailable stages remain in the record. A pilot cannot be closed by a metadata validator or a fixture replay; real candidate artifacts and session/evaluator review establish the observation.
- **S-09:** A baseline report ranks observed friction by measured commands, context reads, map-authoring effort, repeated approvals and human review time; it ties the scaffold and brief-resume design to concrete observations before their implementation begins.

### R-04 — Scaffold coverage without inventing agreement or proof

Add `coverage scaffold --change <id> [--json]` under the existing runtime entry point.
It reads the current validated PRD inventory, associated tickets and any authored map,
and emits a reviewable draft to stdout. It preserves existing explicit links/checks/
scope entries, lists every inventory scenario and identifies unresolved decisions.
It can list candidate tickets and their existing verification text with provenance,
but cannot infer semantic adequacy or manufacture complete links or executable checks.

- **S-10:** On a partially mapped change, the scaffold lists every expected scenario, preserves explicit authored content, and distinguishes unresolved mappings from reviewed links; repeated calls with identical authored inputs produce identical draft content.
- **S-11:** Invalid input, a wrong-change ticket, unsupported schema or escaping path produces a nonzero actionable diagnostic without writes. Scaffolding neither launches checks nor writes maps, lifecycle, authorization, attempts or selection.
- **S-12:** The draft is visibly incomplete until its unresolved entries are authored and reviewed; it cannot masquerade as a valid coverage map or grant readiness. A completed map uses the existing validator and explicit adoption/authorization flow, including stale-agreement refusal after edits.

### R-05 — Give fresh sessions a concise, faithful resume view

Add opt-in `resume --brief [--change <id>] [--json]`, derived from the same computed
resume report and shared routing as the full view. Show selected/viewed identity,
lifecycle, authorization and evidence verdicts, the next action and the minimal
artifact references needed to act. Group repetitive ticket detail, retaining exact
counts and a way to inspect every omitted row. Do not implement another policy engine.

- **S-13:** Across active, paused, planned, terminal, wrong-selection, running/interrupted-attempt, invalid-state, stale-authorization and stale-evidence fixtures, brief and full output give the same verdict and next action and retain every blocking reason category.
- **S-14:** A large-change fixture produces fewer output bytes than the full report while retaining blocker counts and resolvable detail references; piped JSON stays complete, invalid inputs remain nonzero, and reports change no files.
- **S-15:** A fresh session can identify the next ticket/check/decision from brief output and referenced artifacts; existing default human output and JSON contracts remain compatible, and missing history is explicit rather than replaced by a guessed next action.

### R-06 — Ship one understandable first-use and recovery journey

Update canonical playbooks and the README around install, default versus strict
coverage, reviewed map authoring, authorization, implementation, recovery and
evaluation. Use baseline observations to remove redundant reads and instructions
without collapsing material decisions. Generate adapters and plugin from the template.

- **S-16:** A packed-install walkthrough on a disposable project reaches strict adoption using the documented scaffold/review flow, then resumes through the brief view; unresolved mappings and stale authorization explain a usable next step without falsely claiming coverage.
- **S-17:** Repeated continuation of unchanged authorized work prompts for no duplicate decision; changed scope still requires its actual authorization. Canonical and generated instructions agree and preserve existing project rules on repeated install/update.
- **S-18:** Onboarding presents the first successful journey before historical migration detail, documents baseline-mode preservation and the independently pinned management kit, and labels installation checks separately from observed end-to-end platform support.

### R-07 — Observe platform journeys and a real agent handoff

Use Claude Code and Codex as the initial observed surfaces because they are the
platforms used in this collaboration; this is a scoped choice, not market research.
Record exact versions and configuration. Verify current platform invocation and
permissions against the installed tools and official documentation during execution.

- **S-19:** Each surface completes a live strict journey including a scope revision, pause, fresh-session recovery and candidate evaluation using the shipped instructions; session records identify repairs and required stages that remain outstanding.
- **S-20:** A real change started on one surface is resumed on the other from files without a conversational recap; it preserves existing authorization, respects revised-scope decisions and produces valid candidate evidence. Missing worktree-local attempts trigger the existing explicit re-verification behavior.
- **S-21:** A support matrix links each observed claim to versioned evidence and labels unobserved combinations, including Copilot and plugin-only use; missing tools or accounts leave required trials open rather than counting packaged parity as live success.

### R-08 — Build a corrected three-arm comparison

Create a new benchmark edition, preserving the v6 study. Keep its six bounded briefs
and add two briefs lasting at least three sessions across at least two changes:
one revision/recovery task and one brownfield maintenance/review task. Freeze the
entire execution/evaluation path before runs. Compare a plain workspace, default
Pincer without strict adoption, and Pincer with strict adoption required and observed.

- **S-22:** Every brief has held-out acceptance and preservation checks with working controls and deliberately faulty candidates; stale/wrong-change evidence and unlisted post-candidate artifacts are rejected where evidence is claimed. UI requirements include actual browser observations, not only markup inspection.
- **S-23:** The schedule contains three matched repetitions of each of eight briefs for each of three arms (72 runs), with balanced arm order, equivalent task intent/base/model/tool/caps and isolated recorded configuration. Strict runs lacking actual adoption are protocol failures, not evidence for strict Pincer.
- **S-24:** Frozen driver/configuration/evaluator changes start a new identified cohort; errors, exclusions and partial runs follow predeclared rules. Historical raw records are immutable, and reports distinguish independent preservation checks from the candidate's own tests.

### R-09 — Measure improvement and report unfavorable results honestly

Run the frozen comparison after the shipped improvements. Repeat the three pilot
journeys on matched disposable snapshots with equivalent tasks and controlled order,
identifying learning effects. Compare baseline 0.6.0 strict versus improved strict
for efficiency; use the three-arm experiment for workflow tradeoffs, not as a
substitute for the before/after comparison. Human review uses at least two reviewers
who did not implement the candidates, blinded to arm where feasible, with order and
prior exposure recorded. Reviewers decide acceptance/readiness from code and evidence.

- **S-25:** All 72 scheduled benchmark runs and three paired pilot comparisons have actual results or explicit outstanding dispositions; reports show per-brief and per-arm acceptance, independent regressions, interventions, stage time, tokens/cost, spread and denominators. Missing required runs keep this requirement unfinished.
- **S-26:** Timed reviews of matched candidate tasks record reviewer conclusions, missed faults, confidence and minutes using a frozen rubric; missing review time is not reported as zero, and automated record checks cannot stand in for these reviews.
- **S-27:** The report evaluates the target of halving avoidable workflow operations on paired pilots and reducing median short-task cost/time without lower observed acceptance or weakened invariants. It publishes unfavorable results and uncertainty; missing the improvement target is a product finding, not permission to relabel runs or suppress failures.

### R-10 — Deliver a reproducible review and preserve the release boundary

Assemble a scenario-by-scenario review packet linking implementation, controls,
observations, limitations and dispositions. Keep routine focused checks fast enough
for ticket use; the complete existing suite and all new executable suites remain
required at integration. Do not run paid live sessions inside `npm test`.

- **S-28:** Every requirement/scenario resolves to real candidate-bound evidence or an explicit unfinished disposition; deleted artifacts, substituted candidates, fabricated run references and vacuous citations fail packet validation.
- **S-29:** Full regression, generator parity, packed-install checks and the existing Ubuntu/macOS by Node 22/24 CI matrix pass on the identified implementation candidate; required missing checks prevent completion claims.
- **S-30:** Final authored documentation and metadata precede candidate selection; evaluation refers to that immutable source and records remaining limitations. Subsequent changes retain normal stale-evidence behavior; merge, bump and publication are separate actions.

## 5. Architecture and data flow

Use the dependency-free Node runtime and existing bounded parsers. Introduce no
external service, new runtime state store or changes to agreement/evidence schemas.
T-87 freezes exact command grammar, draft and brief schema shapes, exit behavior and
compatibility examples before implementation. A draft envelope has its own version
and explicit unresolved items; it is not a map schema accepted by `coverage adopt`.

| Area | Location / ownership |
| --- | --- |
| Scaffold | New `template/scripts/pincer-runtime/scaffold.cjs`; reuse `requirements.cjs`, `coverage.cjs` and ticket parsing; stdout through `io.cjs` |
| Brief resume | `resume.cjs`, `routing.cjs` and CLI dispatch; pure projection of full computed state |
| Installed guidance | `template/.claude/commands/`, references and `template/docs/runtime-contracts.md`; both generators own derived adapters/plugin |
| Measurement and comparison | Versioned additions under `scripts/delivery-benchmark/` and `test/fixtures/delivery-benchmark-v7/`; preserve old fixture root and v6 driver |
| Observations | `docs/prd-v7-artifacts/` with protocol, sanitized run records, immutable cohort manifests and review materials; raw private capture outside the tracked tree |
| Product/report docs | `docs/prd-v7-protocol.md`, pilot report, platform matrix, comparison report and review packet; README links the journey |

Authored PRD/tickets/map → existing validators → scaffold draft → human/agent
authorship and actual user decisions → existing adoption and agreement gates.
Runtime state → full resume computation → optional brief projection.
Frozen task/configuration → observed execution → independent candidate evaluation
and human review → immutable record → reproducible report. Reporting grants no
runtime authorization and creates no passing verification attempt.

## 6. Build order and success criteria

T-87 freezes scope, protocol and compatibility. T-88 builds measurement; T-89 observes
baseline pilots before T-90/T-91 implement the bounded improvements. T-92 integrates
their shipped journey. T-93 observes platform use and handoff. T-94 builds the new
benchmark after T-87/T-88 and may proceed before product work; its evaluators must
be frozen before measured candidate implementation. T-95 performs comparisons;
T-96 consolidates review and integration gates. Numeric order is safe; dependencies
are authoritative. See the ticket map for every scenario and verification command.

| Success criterion | Evidence |
| --- | --- |
| Safety and compatibility preserved | Existing suites plus failure controls for scaffold, brief reports and generated guidance |
| Strict coverage works in actual use | Three baseline pilots, paired improved runs, both platform journeys and handoff artifacts |
| Human value and overhead are measurable | Recomputable event records, timed independent reviews and predeclared comparisons |
| Results are trustworthy even if negative | Full freeze/configuration identity, all failed/invalid records, real held-out checks and denominators |
| Product improvement target assessed | Half the avoidable workflow operations on paired pilots; lower median short-task cost/time, with quality and uncertainty reported separately |

The improvement target is an engineering objective, not a release-truth shortcut or
a promised experimental result. Required observed journeys must work, or remain open
with fix tickets and retained failures. A valid negative comparison can satisfy the
measurement requirement but cannot support a performance claim. Sample size is for
detecting gross friction, not establishing superiority. Neither a mapped scenario nor
a green record validator establishes semantic correctness or live observation.

## 7. Out of scope

Dashboards, automatic worktree orchestration, additional agent personas, tracker
integrations, new approval machinery, semantic requirement inference, narrower
source hashing, release exceptions for version/wiki edits, automatic project migration,
and platform hook expansion are deferred. New functionality beyond the two bounded
product improvements requires a recorded scope revision rather than being absorbed
into a pilot ticket. No public sharing of private project/session data is included.

## 8. Trust boundaries, risks and execution prerequisites

PRDs, maps, tickets and supplied run artifacts are untrusted. Existing containment,
symlink, schema and size validation applies before rendering or accepting them;
draft suggestions never authorize execution. Host sandbox and approval controls
remain the permission boundary. Configuration capture uses an explicit allowlist of
non-secret settings and tool identities; record presence or redacted references for
credentials, never values or secret-value hashes. Reject malformed/out-of-root
artifact references and do not execute commands embedded in imported records.

Before live collection, select the three projects, exact model/tool configurations,
available reviewers and a concrete spending/time cap. The implementation agent should
prepare that bounded run schedule using available access, then obtain only missing
access or spending decisions. These prerequisites do not block the protocol/tooling
tickets. Missing infrastructure keeps live tickets open; never bypass host approvals
to satisfy the experiment. The full 72-run schedule is substantive work, and must be
costed before execution; a smaller study requires an explicit scope revision.

Pilot selection and learning effects, reviewers recognizing workflow artifacts,
incomplete provider usage data, and constrained platform access limit inference.
Record each explicitly. Reusing the six historical briefs permits comparison of task
types, not direct causal comparison to v6's differently configured recorded costs.

The distribution repository remains in legacy management mode, as in v6. Manage
implementation tickets with an independently pinned released 0.6.0 kit outside this
tree, recording its source/package digest; do not manage state using runtime code
under modification. New behavior is exercised in disposable installed projects.
Rollback the additive scaffold/brief implementation and regenerate outputs if needed;
no project data migration is introduced. Preserve authored user maps and historical
records. Material design changes follow the existing scope/authorization rules.
