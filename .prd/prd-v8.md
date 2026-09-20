---
version: 8
status: ticketed
date: 2026-09-15
profile: standard
---

# Prove reliable delivery with less effort

## Scope amendment — native tool login, 20 September 2026

The user requested: “pincer should only be used with a cli or github copilot and not api key based”. This authorizes revising the plan and ticket breakdown around that boundary; it supplies no study allocation, account access, or live-run authorization.

Pincer is a workflow installed into Claude Code, Codex CLI, or GitHub Copilot. The host tool owns model execution and account authentication. Pincer must not require a provider API key, collect or transport login tokens, implement direct model API calls, or silently switch a signed-in tool to API billing. This applies to the representative evaluation path as well as the product. The host may use remote services internally; this is not an offline-model requirement. Authentication for an application being developed is a separate concern.

The former API-key study profile and smoke proposal are superseded for future execution, not evidence of native-login support. They remain historical implementation artifacts until replaced. The installed product already uses host tools; the adaptation is primarily in study execution, isolation, usage measurement, and documentation.

Read [the revised execution plan](../docs/prd-v8-native-tool-plan.md). T-120 defines the replacement contracts; T-121 implements and verifies them offline. They precede T-109's smoke and T-102's remaining native observations. T-110 onward retain their product objectives and evidence obligations. Copilot remains a supported installation target with live behavior unobserved until demonstrated; this amendment does not claim parity or add Copilot CLI as an observed surface.

Subscription runs report elapsed time, operations, interventions, available usage and account-limit events. Unavailable marginal dollar cost is explicitly unavailable, never zero or a fabricated API-price estimate. Expected unavailable subscription billing is distinct from missing required capture and must not automatically make every subscription run invalid. API-dollar cost targets become conditional on genuinely comparable observed billing; unavailable data cannot support a cost-superiority claim. Existing sample sizes remain planned, pending tool feasibility and separately agreed allocations; they are not launch commitments.

This amendment takes precedence over earlier API-key prerequisites and API-dollar-only execution assumptions below and in linked packages. It is a planning revision, not a claim that the existing runner now supports account login. Historical receipts remain intact; revised verification must be run through the pinned management kit before any new completion claim.

## 1. Problem and authorization

Pincer has a substantial runtime foundation but its operational evidence remains incomplete.
The assessment of main at `380555449df504e9a1b6a44a2df3624710600ccf` reproduced three
remaining study defects after T-99: effective configuration escapes cohort identity,
checkpointed restarts duplicate events, and incomplete usage is presented as a total.
Live strict journeys, platform handoffs and independent review measurements are outstanding.
The historical v6 study accepted 17/18 changes in both arms while the Pincer arm cost
approximately 4.7 times more on its bounded tasks. Neither that study nor passing CI
establishes a best-in-class product.

Original brief: **“ok make a new prd and tickets of all this improvements you just mentioned”**,
following the [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
This instruction authorizes this new planning document and breakdown. It does not by
itself execute product changes, authorize model spending or third-party project access,
select reviewers, migrate this checkout, register runtime approval, merge or publish.
Concrete execution decisions reuse actual session authorization and are requested only
when missing, after the bounded proposal is prepared. No budget or deadline is supplied.

This is a follow-on improvement programme with explicit carry-forward of v7 observations,
not a retroactive rewrite of v7's implemented history. New tickets start at T-100.
Existing PRDs, dependencies, statuses, receipts and evidence remain intact. Standard
profile is appropriate because provenance, recovery, experimental design, user guidance
and release ordering are load-bearing, even where individual patches are small.

Evidence at planning: exact-head CI passed all 63 suites across Ubuntu/macOS and Node
22/24; the local chain reached nine passing suites before a sandbox HTTP-listener refusal,
and the affected recovery suite then passed outside the sandbox. The three readiness
probes are offline reproductions, not live trials. No feature changes have occurred since
that assessment in this session. Registry version was verified as 0.6.0; main includes
additional scaffold/brief changes. Recheck mutable facts at execution time.

## 2. Solution

Repair the study execution and measurement boundaries, prove them offline and with a
bounded operational smoke, then complete real baseline journeys before designing the
next usability changes. Add deterministic, read-only guided coverage proposal review and
proportionate small-change guidance, preserving existing authorization and evidence
semantics. Measure actual benefit through paired pilots, the already planned 72-cell
comparison, independent human review and a later bounded comparison with alternatives.
Make release preparation reproducible and exercise Pincer on genuine maintenance work
using an independent pinned management kit.

## 3. Scope

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| Effective execution identity, isolated configuration, exclusive run ownership and attempt recovery | A new hosted orchestration service or weakening host permissions |
| Complete usage, terminal records, a real browser evaluator and readiness gates | Automated billing integration or a promise of an enforceable provider cost cap |
| Carried v7 pilots, platform observations and 72-cell comparison | Fabricated completion of historical temporal requirements or a duplicate 72-cell study |
| Guided map proposal review and minimal small/default/strict journeys | Automatic semantic mapping, speculative check execution, approval or adoption |
| Release preparation, current documentation and disposable strict dogfooding | Publication, live-checkout migration or retroactive receipt backfill |
| Independent timed reviews and a separately budgeted 27-cell competitive study | Guaranteed favorable results, statistical superiority or broad platform expansion |
| Evidence-based triage of secondary maintenance concerns | Speculative repair of an unreproduced race, dashboards, new lifecycle states or more agent personas |

Preserve all supported legacy/migrated/changes/strict behavior, authored map ownership,
current agreement-bound decisions, worktree selection, source freshness, latest-failure
precedence, transaction recovery, installed attempt locking, secret handling and exact
post-candidate artifact containment. Keep installed code dependency-free. Schema changes
are confined to versioned measurement records where needed; old raw records remain readable.

### Carried obligations and study identities

T-100 owns the detailed obligation map. T-110/T-111/T-115/T-116 provide the previously
unobserved work described by v7 T-89/T-93/T-95; T-119 links the final disposition.
Implemented-but-open v7 T-90/T-91/T-92/T-96/T-97 are not recreated or auto-closed.
V7's requirement that observations precede already-written code cannot be satisfied by
backdating a later run. Record that deviation and obtain any necessary scope disposition
when executing, rather than rewriting history. New tickets depend on v8 predecessor IDs
so the successor work does not form a dependency cycle with v7's unfinished sequencing.

- **K0:** released v0.6.0, pinned by commit and artifact digest.
- **K1:** evaluated/pinned pre-v8-usability kit containing existing scaffold/brief behavior.
- **K2:** prepared/pinned kit after guided authoring and proportionate guidance.
- T-110 plans three K0/K1 pairs (six journeys). T-114 plans three K1/K2 pairs (six
  journeys). Reuse is permitted only under predeclared matching/exposure rules; otherwise
  budget fresh controls. This preserves the existing v7 before/after question and tests
  the new v8 improvement separately.
- T-115 continues the existing eight briefs × three arms × three repetitions = 72 cells.
- T-118 is a separate later three tasks × three tools × three repetitions = 27 cells.
- Operational smoke, platform/handoff and dogfood sessions have explicit manifest
  allocations. Reuse only genuine equivalent stages with references; never count a
  fixture, smoke or unrelated study cell as a missing measured observation.

## 4. Requirements and acceptance scenarios

IDs are scoped to this PRD and stable. Each scenario is owned by one new ticket in
[the ticket map](../docs/prd-v8-ticket-map.md); links are planned traceability, not evidence.

### R-01 — Reconcile delivery obligations and freeze the v8 contracts

Create one current account of delivered code, unfinished observations and the contracts this increment must preserve.

- **S-01:** Current-state documentation identifies the reviewed SHA, published versus main versions, evidence candidate and open tickets; every carried v7 obligation has an explicit v8 owner without editing historical receipts or pretending later observations preceded earlier code.
- **S-02:** A preservation and contract document specifies effective execution identity, attempt ownership, complete measurements, guided-authoring grammar and release ordering; mutation cases identify how each guarantee can fail.
- **S-03:** Stale wiki recommendations and live-support claims are reconciled; the unproven runtime lock race, hook false positives and obsolete installed-file cleanup receive evidence-based reproduce/fix/defer dispositions with rationale and follow-up ownership, without asserting an unproven defect is fixed.

### R-02 — Bind effective execution inputs to the cohort

Prevent different executed configurations from masquerading as one frozen experiment.

- **S-04:** Planning and execution derive a canonical effective manifest containing resolved model identity, tool version, caps, kit digest, browser/evaluator implementation and all execution helpers; changing any relevant input changes cohort identity or is refused before preparation and launch.
- **S-05:** The model-A/10-turn versus model-B/20-turn reproduction cannot produce the same runnable cohort; resuming an existing plan with changed kit, browser adapter or configuration is refused without workspace, record or session mutation.
- **S-06:** Historical cohorts remain readable with their original inputs; malformed flags, missing values, nonpositive or nonfinite caps, escaping inputs and unknown provenance are rejected explicitly, and secrets are neither recorded nor hashed.

### R-03 — Isolate and record agent execution configuration

Make the plain baseline and kit arms reproducible under an explicit, observed host configuration.

- **S-07:** A controlled host containing synthetic personal instructions, hooks, plugins and environment settings launches each arm without those settings leaking into the measured session; intended arm instructions and required authentication remain functional.
- **S-08:** Every launched record captures actual model/tool/version, OS/platform, Node, effective permission posture and allowlisted configuration; missing required metadata or an unverifiable isolation boundary prevents a reportable launch.
- **S-09:** Secret canaries, unrelated environment values and private instruction text appear in neither records nor fingerprints; fresh sessions and handoffs preserve the host approval/sandbox policy and never use disabled approvals to overcome isolation failures.

### R-04 — Claim study runs exclusively

Prevent two operators or processes from launching or rewriting the same measured cell.

- **S-10:** Two simultaneous attempts to execute one cell produce exactly one launch and one explicit busy refusal; separate cells can proceed without sharing mutable workspaces or event files.
- **S-11:** Run ownership, rerun-slot allocation and record publication survive injected crashes before and after claim/write boundaries; live ownership cannot be reclaimed as stale and an abandoned claim has an explicit recoverable disposition.
- **S-12:** A losing claimant or malformed/escaping run identity changes no workspace or artifacts; recovery preserves original logs and completed records and creates no duplicate paid work silently.

### R-05 — Preserve checkpointed attempts through interruption

Recover interrupted study work without duplicate event IDs, overwritten evidence or a contaminated candidate base.

- **S-13:** Restarting at persisted setup, session-start, session-end and pre-evaluation boundaries yields validator-valid records with unique attempt/session/event identities, including the reproduced duplicate setup/S1 case.
- **S-14:** Real stand-in process kill/restart tests preserve completed session payloads and clearly label missing in-flight data; restart uses a clean disposable workspace and excludes the interrupted attempt commit from the new base.
- **S-15:** Every discarded attempt remains linked with immutable logs and effort; terminal cells are not rerun, concurrent recovery is refused, and a new attempt cannot overwrite or silently drop prior history.

### R-06 — Account for incomplete and repeated usage honestly

Ensure cost, tokens and provider time include all attempts and never disguise partial observations as totals.

- **S-16:** One complete payload plus one missing, malformed or metric-incomplete payload produces a null aggregate with a specific reason, while retaining any clearly labelled measured subtotal; the $1.25/120-token reproduction no longer reports a complete total.
- **S-17:** Usage across all completed, failed and discarded attempts is counted once with provider duration distinct from wall-clock/active intervals; all-null, explicitly reported zero and missing values remain distinguishable.
- **S-18:** Negative, nonfinite, inconsistent or unsupported provider fields are rejected or labelled unavailable; report regeneration from stored payloads needs no model call and never silently omits an attempt or double-counts cache usage.

### R-07 — Finalize every terminal outcome into a valid record

Give success, rejection, limits and errors one complete recording path without conflating candidate quality and experiment validity.

- **S-19:** Actual orchestrator output validates for accepted and rejected candidates, account limits, capped sessions, ambiguous exits, evaluator exceptions, missing browser capability and unavailable results; every terminal record includes reasons for missing metrics.
- **S-20:** A usable capped candidate receives the predeclared independent evaluation, account limits stop the schedule, refusal before launch leaves a cell runnable, and session/provider error payloads cannot masquerade as normal completion.
- **S-21:** Injected finalization/write failures retain recoverable raw artifacts and report failure; reruns preserve original terminal outcomes, and missing evidence never yields acceptance or a fabricated zero.

### R-08 — Supply and prove the real browser evaluator

Make UI acceptance depend on actual browser behavior through the existing evaluator seam.

- **S-22:** A pinned real browser/adapter observes the working UI control and rejects deliberately broken loading, empty, error or interaction behavior that markup-only checks miss; screenshots and observation artifacts identify the tested candidate.
- **S-23:** Missing browser tooling, launch failure, timeout or absent observations yields unavailable/error with reasons and never acceptance; the preflight refuses a full UI study schedule when required browser capability is absent.
- **S-24:** Browser/adapter version and implementation digests participate in execution provenance; candidate servers use disposable local workspaces and are stopped after success, failure and interruption without accessing production data.

### R-09 — Make release preparation reproducible

Prepare consistent versioned distribution artifacts before evaluation without publishing or weakening evidence freshness.

- **S-25:** A maintainer preparation command supports preview and explicit apply for a supplied version, regenerates adapters/plugin and verifies package/plugin/version agreement and packed layout before reporting a candidate eligible for selection.
- **S-26:** Repeated preparation is idempotent; invalid versions, unexpected staged work, unrelated modifications or generator failure produce actionable refusal without absorbing user files or creating a tag, commit, publication or false success.
- **S-27:** An integration fixture prepares metadata, commits/selects the candidate and evaluates it without self-invalidating version drift; later source/version changes still stale the evidence under the existing exact artifact allowlist.

### R-10 — Gate live work on offline integrity and concrete prerequisites

Provide a single auditable readiness decision before the study incurs cost.

- **S-28:** The repaired runner passes offline end-to-end controls and fault injections, the real-browser fixture gate, packed parity and full CI; the amended cohort manifest is minted before the first measured run and lists the complete execution path.
- **S-29:** A study manifest names projects/access, immutable kits and bases, exact task schedule, independent reviewers, numeric spending/wall-clock caps and stop/resume rules; missing decisions produce specific pending reasons and launch nothing.
- **S-30:** A controlled short live smoke, once separately authorized and capped, proves actual payload capture, isolation, browser access, stop behavior and report regeneration before the full schedule; smoke artifacts remain labelled operational and never silently replace scheduled study cells.

### R-11 — Observe the baseline strict journeys and rank friction

Complete genuine strict-coverage pilots and measure the friction that should drive the next product design.

- **S-31:** One greenfield and two brownfield projects complete pinned K0 and K1 journeys on matched disposable tasks, including adoption, actual revised-scope authorization, pause/recovery and candidate/schema 3 evaluation; one brownfield project preserves tracked and untracked unrelated work.
- **S-32:** All six baseline journey records retain real session/candidate evidence, failures, repairs, unavailable stages and interventions; generic continue never stands in for revised approval and fixtures cannot close the observations.
- **S-33:** A report ranks map authoring, repeated commands/reads/approvals, recovery and human effort, and makes an evidence-backed proceed/revise decision for guided authoring and the small-change path before their implementation.

### R-12 — Observe platform journeys and a file-only handoff

Prove that a real strict change can move between Claude Code and Codex using the shipped artifacts.

- **S-34:** Each platform completes an actual strict journey with install, revision, pause/resume and evaluated candidate under recorded exact versions/configuration; overlapping T-110 sessions may be reused with explicit stage references.
- **S-35:** A change begun on Claude Code resumes on Codex from files without conversational recap, preserving current authorization and requiring fresh verification when worktree-local attempt evidence is unavailable.
- **S-36:** Wrong selection, changed agreement and unavailable tools remain explicit blockers; support documentation distinguishes installed, observed and unobserved surfaces and retains failures before repairs.

### R-13 — Guide coverage authoring with reviewable proposals

Reduce mapping effort by showing one unresolved decision and validating an authored proposal without taking over approval.

- **S-37:** coverage guide --change <id> [--scenario <id>] [--proposal <path>] [--json] presents deterministic unresolved scenario context, relevant authored ticket/check text and an exact proposed map diff; no proposal is represented as reviewed coverage.
- **S-38:** Malformed/unsupported proposals, wrong-change references, duplicate or missing mappings, undeclared checks and traversal/symlink escapes produce actionable nonzero diagnostics; source changes while reviewing invalidate the proposal context.
- **S-39:** Whole-tree snapshots show guide writes no map, selection, authorization, attempt or lifecycle state and executes no proposed check; an authored accepted map still goes through the existing adoption/agreement gates and default/scaffold/brief contracts remain compatible.

### R-14 — Simplify small-change onboarding and recovery

Make routine work use the least necessary workflow operations while preserving the same trust boundaries.

- **S-40:** A documented small-change/default journey and a strict journey use the pilot-ranked minimal reads and existing brief/guide reports; matched fixture walkthroughs record operation counts and reach verified evaluation.
- **S-41:** Repeated continuation of unchanged authorized work asks no duplicate decision, while revised scope, invalid selection and stale checks still surface the exact required next action; small profile never waives evidence or authorization.
- **S-42:** Packed installs and repeated updates preserve user rules, canonical and generated guidance agree, and a fresh agent can discover detailed recovery information from the concise output without guessing missing history.

### R-15 — Measure usability on matched improved pilots

Compare the pre-v8-usability kit with the final improved kit on real matched work.

- **S-43:** Three paired K1-versus-K2 pilot comparisons record task equivalence, arm order, prior exposure and all session/candidate evidence; unrelated behavior and authorization/evidence invariants are preserved.
- **S-44:** The report measures avoidable operations, map-authoring and recovery time, repeated approvals, active/provider time and total cost including retries; incomplete measurements remain explicitly unavailable and all failures stay in the denominator accounting.
- **S-45:** The predeclared target of halving avoidable operations and reducing authoring/recovery effort is reported as met or missed with spread and limitations; missed targets produce an explicit product disposition and cannot be hidden by selecting only favorable pairs.

### R-16 — Complete the corrected 72-cell comparison

Complete the already planned three-arm experiment with honest accounting of acceptance, preservation and total effort.

- **S-46:** Eight briefs times plain/default-Pincer/strict-Pincer times three matched repetitions produce 72 accounted scheduled cells under a frozen K2 cohort, with balanced order and observed strict adoption; reruns are separately linked and never replace originals invisibly.
- **S-47:** Held-out acceptance/preservation/browser checks judge exported candidates independently of candidate-authored tests; cost, time, tokens, interventions, retry burden, exclusions, spread and per-brief/arm denominators recompute from retained records.
- **S-48:** Account limits, missing capability, incomplete required observations and configuration drift stop or disposition work under the frozen rules; missing required cells keep measurement unfinished, and adverse outcomes are reported without a superiority or equivalence claim from three repetitions.

### R-17 — Measure independent human review effort

Establish whether Pincer helps people make accurate review decisions with less effort.

- **S-49:** At least two non-implementing human reviewers inspect matched tasks under a predeclared rubric, with arm blinding where feasible and recorded order, exposure, decision, confidence, elapsed minutes and missed seeded faults.
- **S-50:** Missing/zero-as-placeholder review time, implementing reviewers, fabricated identities or absent candidate links cannot satisfy completion; actual review records and inspected artifacts support each observation.
- **S-51:** Results compare review accuracy and effort with denominators and limitations alongside total delivery cost; automation-only validation never stands in for human judgment and unfavorable results remain visible.

### R-18 — Dogfood strict multi-change delivery with a pinned kit

Observe Pincer maintaining Pincer through a supported strict/multi-change journey without trusting the runtime under modification.

- **S-52:** A genuine bounded future maintenance change in a disposable checkout is managed with a recorded independent released or evaluated kit outside the edited tree, using explicit change selection, reviewed strict adoption and retained history for two changes.
- **S-53:** Pause, revised scope, new-session continuation and candidate evaluation preserve unrelated files and old authorization/history; stale or absent local attempts require explicit fresh verification.
- **S-54:** The report distinguishes a successful disposable trial from migration of the live distribution checkout; rollback restores the disposable setup and leaves historical tickets, receipts and the current repository management mode unchanged.

### R-19 — Compare pinned alternatives on bounded matched work

Test competitive value against relevant specification workflows before making a class-leading claim.

- **S-55:** A separately frozen competitive protocol pins Pincer and two relevant alternatives, provisionally Spec Kit and OpenSpec, on three representative task types with three repetitions per tool (27 cells), matched model/caps, fair documented setup and held-out acceptance.
- **S-56:** After separate concrete access/spending approval, all scheduled cells retain actual outcomes, failures, setup/recovery/review effort and total cost; unavailable capabilities or changed versions remain explicit and cannot silently shrink the denominator.
- **S-57:** A comparative report cites exact versions and limitations, reports negative results and distinguishes exploratory differences from established superiority; a best-in-class claim is withheld when the measured evidence does not support it.

### R-20 — Assemble the evidence packet and release decision

Give reviewers a reproducible, candidate-bound account of every requirement and the evidence for the next product decision.

- **S-58:** Every v8 scenario and carried v7 obligation maps to implementation plus actual evidence or an explicit unfinished disposition; absent sessions/reviews, forged links and wrong candidates fail the completion gate, and historical build-order deviations are never rewritten as success.
- **S-59:** Final version metadata, authored docs and generated outputs precede candidate selection; full regression, real-browser gate, generator/packed parity and Ubuntu/macOS by Node 22/24 CI pass for the selected implementation candidate.
- **S-60:** Evaluation and a read-only release audit bind the selected candidate with the unchanged evidence allowlist; later changes stale it normally, measured targets have honest met/missed dispositions, and merging/tagging/publishing remain separate authorized actions.

### R-21 — Define evaluation through native tool authentication

- **S-61:** Product and study contracts require host-managed sign-in, exclude Pincer-owned provider keys/direct model API execution, and identify exact platform/version capabilities and unobserved limits.
- **S-62:** The revised isolation design uses a supported host login without copying credentials or personal configuration; unsupported separation is an explicit blocker or a declared controlled-host baseline, never a hidden relaxation.
- **S-63:** Subscription measurement distinguishes actual billing, estimates, unavailable billing, missing capture and account limits; revised execution prerequisites preserve explicit authorization and honest comparison boundaries.

### R-22 — Implement the native-login study path

- **S-64:** The real study entry point uses the supported logged-in tool, refuses provider-key fallback or missing login before a task, and captures no credentials or credential hashes.
- **S-65:** Offline entry-point regressions cover clean login, missing login, API override, unavailable subscription cost, missing required evidence, account limits, restart and capture/retention failures; prior stop and freshness protections remain effective.
- **S-66:** The regenerated package and frozen cohort describe the new execution path, retain historical records, pass relevant regression/packed/CI gates, and clearly leave actual login/isolation behavior pending T-102/T-109 native observations.

## 5. Architecture and interface decisions

| Component | Ownership / approach |
| --- | --- |
| Resolved execution manifest | Existing `scripts/delivery-benchmark-v7/` tooling; canonical effective inputs hashed before planning and rechecked before launch |
| Claims and attempts | Maintainer-only atomic ownership, unique attempt/event identity, append-preserved artifacts; no second installed runtime lifecycle |
| Measurement | Existing effort collector and validator; every terminal path finalizes, partial aggregates explicit, original payloads retained securely |
| Browser | Existing evaluator seam with a pinned real adapter; maintainer-only dependencies/tool provisioning settled before implementation |
| Guided authoring | New `template/scripts/pincer-runtime/guide.cjs`, reusing inventory, coverage and scaffold; stdout through `io.cjs`, routing through existing shared computation |
| Release preparation | New maintainer `scripts/prepare-release.cjs`, scratch validation and exact declared apply paths; no tag/commit/publish side effects |
| Observation gates | Extend existing observation machinery with read-only `validate-study.cjs` and `readiness.cjs`; reject missing real artifacts, never launch sessions during verification |
| Documentation | Current v8 protocol/contracts/reports and obligation overlay; immutable historical assets retained |

Guided authoring grammar: `coverage guide --change <id> [--scenario <id>]
[--proposal <path>] [--json]`. Without a proposal, show unresolved authored context;
with a complete authored map proposal, validate and show the exact diff against the
current map, including additions/removals. A context digest identifies stale inputs.
The command writes nothing and grants nothing. The existing agent playbook guides the
conversation and authors the map; existing adoption and authorization remain separate.
Freeze output schema and exit behavior in T-100 before implementation.

Release grammar: `node scripts/prepare-release.cjs --version <semver> --preview|--apply`.
A preview writes nothing. Apply changes only declared version/generated files after
scratch validation, identifies failure/partial effects and never stages unrelated work.

Data flow: effective manifest → validated claim → immutable attempt events/payloads →
independent candidate evaluation → complete terminal record → read-only report.
Authored PRD/tickets/map → deterministic guide/proposal diff → reviewed authored map →
existing adoption/authorization → normal implementation/evaluation.

Preserve v6 directories byte-for-byte. Continue the existing v7 engine with explicit new
cohort manifests when execution changes; use `docs/prd-v8-artifacts/` for new records.
Do not fork another measurement engine merely because the PRD version increased.
Every helper that affects execution/scoring must be covered by provenance, including
new sibling modules and browser dependencies. Versioned data readers preserve history.

## 6. Build order, verification and success

1. T-100 defines contracts and reconciles obligations.
2. T-101–T-108 repair execution, provenance, browser and release preparation in dependency order.
3. T-120 defines native-login and subscription measurement contracts; T-121 implements the replacement execution path. Then T-109 establishes the offline integrity gate and concrete live prerequisites.
4. T-110–T-111 observe baseline journeys and handoff; findings gate product design.
5. T-112–T-113 implement the bounded usability hypothesis only after supporting observations.
6. T-114 measures before/after benefit; T-115–T-116 complete delivery and human review studies.
7. T-117 exercises genuine strict maintenance; T-118 performs the separately gated competitive study.
8. T-119 assembles requirement dispositions and candidate-bound evaluation/release decision.

Dependencies permit independent preparation but do not authorize parallel agent execution
or reorder observational prerequisites. The map gives each ticket its exact predecessors.
A disproved usability hypothesis yields an explicit proposed PRD revision before substitution,
not a checkbox tick. Missing access/reviewers/budgets leave dependent live work unfinished;
independent authorized offline work can proceed. No default spending allocation is inferred.

Scheduling correction — 19 September 2026: T-102 combines offline implementation
with native observations supplied by T-109's operational smoke. Requiring its closure
before T-106 created a cycle. T-106 therefore depends on T-105, using the verified
T-102 implementation; T-110 depends on both T-102 and T-109. A separately authorized,
capped operational smoke may collect the outstanding T-102 observations after all
offline infrastructure checks pass. Measured work requires both tickets complete.
All original scenarios remain required; synthetic checks cannot close native observations.

| Success criterion | Evidence / interpretation |
| --- | --- |
| All three reproduced defects prevented | Real orchestrator failure/control cases and actual output-validator assertions |
| No unrecorded duplicate execution or hidden usage | Concurrent writers, killed processes, all terminal branches and partial payload cases |
| Reproducible execution and release preparation | Effective input mutation checks, real-browser controls, packed parity and prepared candidate checks |
| Observable user benefit | Paired pilots: target halve avoidable operations and reduce authoring/recovery effort without weaker invariants |
| Delivery cost and accuracy understood | 72 accounted cells, retries/failed costs retained, stage distributions and independent review minutes/accuracy |
| Competitive claims supported or withheld | Separate pinned 27-cell study, methodology and limitations, honest negative results |
| Reviewable completion | All 66 scenarios mapped and dispositioned with actual candidate/observation evidence; full CI and normal release audit |

Improvement targets are objectives, not guaranteed acceptance thresholds for the measurement
tickets. A valid negative study can complete measurement; it must not become an improvement
or superiority claim. Missing required observations cannot complete a measurement ticket.

Checks named in tickets are implementation deliverables where files do not yet exist.
They must fail for missing outputs and cannot be stubbed with `true` or passing fixtures.
Live-ticket checks are offline validators of retained actual records with
`--require-observed`, plus human inspection of compliance and review quality. They never
launch paid sessions. Focused checks run per implementation ticket; full regression and
browser integration gates run at the candidate boundary. Pin actual suite counts only in
current summaries, preserving frozen historical counts.

## 7. Risks, dependencies and execution decisions

- Exact pilot projects, genuine intended changes, access, budgets, wall-clock caps,
  reviewers and host/tool versions are unchosen. T-109 prepares one concrete manifest
  and requests only missing decisions before any dependent launch.
- Browser isolation/automation may require a maintainer-only dependency. Select, verify
  from official sources and pin it in its own tooling configuration before installing;
  no dependency is added to the distributed kit by this PRD.
- Guided authoring is a hypothesis. T-110 can overturn it; scope revision preserves the
  observation instead of optimizing an unobserved friction point.
- Long studies and retries can exceed anticipated spend. Record numeric allocations,
  check remaining capacity before each launch and stop when accounting is incomplete.
- Semantic approval and test adequacy remain review judgments. Local authorization
  records are provenance, not authenticated human identity.
- Changes to frozen execution inputs or study kits require distinct identities. Reports
  may compare compatible cohorts under declared rules, never merge them silently.
- Current untracked guide/diagrams are user work: preserve them, and decide their candidate
  inclusion explicitly during preparation. Planning does not absorb them.

## 8. Trust boundaries and rollback

Treat task content, proposed maps, provider payloads, filesystem paths and browser results
as untrusted data. Validate schemas, sizes, identifiers, reference containment and numeric
bounds before use. No unrestricted environment dumps, secret-value hashes or executable
LLM output. Execute declared checks only through the existing reviewed runtime boundary.
Keep authentication in the host's protected mechanism, outside sanitized captures. Never
turn off approvals to overcome an execution limitation.

Develop and manage tickets using an independent pinned released kit outside the edited
working tree, as this distribution repository currently does. This planning change leaves
legacy management mode in place; it creates no selection, migration or authorization
record. T-117 is a disposable observed trial, not permission to migrate the live checkout.
For installed guidance changes, edit template and regenerate both outputs. Rollback uses
normal reviewed commits; measurement history and failed attempt logs remain immutable.
Release preparation previews changes, validates in a scratch copy and reports exact touched
paths; evaluation never broadens its post-candidate allowlist to hide a version bump.

## 9. Out of scope and later decisions

No production project changes without access approval; no external messages/invitations;
no automatic publication, tagging, merging, remote telemetry, dashboard, additional agent
roles, native Windows rollout, Copilot/plugin live-support claims, new lifecycle state or
automatic map/check/approval inference. Secondary findings are triaged in T-100; a new
reproduced product defect receives a linked fix ticket before implementation. A release
subset may be proposed with an explicit scope disposition; it does not silently remove
required studies or label this whole programme complete.
