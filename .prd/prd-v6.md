---
version: 6
status: ticketed
date: 2026-09-12
profile: standard
---

# Complete requirement coverage and explain change impact

## 1. Purpose and authorization

Product outcome: a developer can see every agreed requirement and acceptance
scenario, the work and checks that cover it, what is actually verified on the
candidate, and what needs attention after a revision. A missing requirement cannot
silently disappear from a successful evaluation.

The user selected this direction and requested its tickets: “go with your
implementation choice for v6 also create the tickets for it”. The selected proposal
was “Complete requirement coverage and explain change impact”, with an independent
delivery benchmark started alongside it. This task produces the concrete PRD and
breakdown; runtime implementation is the next execution stage. No new approval is
needed merely to repeat this choice. Material changes to these decisions must be
surfaced. `ticketed` describes decomposition, not delivered behavior or release.

Baseline: `00aad6d` on `feat/prd-v5`, package version 0.5.0, after v5 review fixes
T-63..T-65. Those fixes and the recorded 36-suite pass are implementation history,
not an independent verification performed during this planning task. V5 evaluation,
CI and release remain separate from this scope. Profile `standard` fits changes to
authorization digests, persisted evidence, migration and release decisions. No time
or spending budget was supplied.

References: [improvement plan](../docs/pincer-improvement-plan.md),
[PRD v5](prd-v5.md), [v5 review packet](../docs/prd-v5-review-packet.md),
[ticket map and build order](../docs/prd-v6-ticket-map.md).

## 2. Problem and solution

The current evidence validator checks each requirement supplied in an evaluation
manifest and resolves its check IDs. It does not derive the complete expected set
from the PRD; ticket references are primarily format checked. Agreement differences
identify changed PRD/ticket content but do not explain which requirement links and
checks are affected. Authored traceability tables and reviewer judgment bridge this
gap today. Passing tests and a complete-looking table can still omit behavior.

Introduce a supported Markdown requirement/scenario inventory and an authored JSON
coverage map, both bound into the reviewed agreement. Derive coverage and structural
impact from those inputs. Evaluation must reconcile its dispositions with the exact
inventory and declared checks on the committed candidate. Keep semantic adequacy a
named review judgment. Start a reproducible benchmark with independently controlled
acceptance checks to measure delivery quality and workflow overhead.

## 3. Scope and preservation

Included: changes-mode opt-in to strict coverage; requirement/scenario extraction;
validated links to tickets and declared candidate checks; explicit scope dispositions;
agreement-bound coverage; structural impact; human/JSON reports; completion/export/
release integration; explicit conversion and rollback; all shipped layouts; controlled
fault tests and a bounded live benchmark.

Excluded: semantic proof that prose is correct, automatic requirement rewriting,
LLM-based authoritative verdicts, dependency-scoped source invalidation, a product-wide
spec merge service, hosted dashboards, tracker integration, automatic Git operations,
parallel-agent scheduling, authenticated human identity, new platform support, and a
claim that Pincer is superior before repeated independent measurements support it.

Preserve v5 lifecycle, selection, worktree isolation, authorization provenance,
transaction recovery, latest-failure rules, captured-log validation, timeout handling,
and T-63 gate revalidation under the attempt lock. Preserve T-64's exact validated
post-candidate artifact allowlist. Preserve both T-65 rollback paths. Existing projects
retain their documented behavior until explicit adoption; reports must label their
coverage as unverified, never imply strict coverage was established.

## 4. Requirements and acceptance scenarios

Requirement and scenario IDs are stable within this PRD. Every scenario has exactly
one owning requirement. The ticket map records a primary implementation owner and a
verification method for each; that planned map is not delivered evidence.

### R-01 — Derive the complete authored inventory

Define a bounded, documented Markdown grammar for requirement definitions and nested
scenario definitions. PRD prose remains authoritative; the map cannot redefine the
expected set. Retain source locations and normalized content per ID. Distinguish
references in tables/examples from definitions. Every strict requirement needs at
least one scenario. Existing supplied IDs may use supported uppercase prefixes; do
not renumber a supplied PRD silently. A conversion preview must show unsupported
syntax or an explicit mapping needing review.

- **S-01:** A PRD with two requirements and three scenarios yields exactly those IDs, parent links, content digests and source locations; human references and fenced examples create no extra definitions.
- **S-02:** Duplicate IDs, an orphan scenario, an empty definition, a requirement without scenarios, malformed fences or unsupported definition syntax cause an actionable invalid-input diagnostic; no partial inventory is treated as complete.
- **S-03:** Lifecycle status and checkbox-mark edits preserve normalized identity, while changed scenario behavior changes its digest. Existing-format PRDs remain readable without claiming strict coverage.

### R-02 — Validate one explicit coverage map

The map owns links and planned dispositions, not requirement prose or observed check
outcomes. Resolve every live inventory ID exactly once, every implementation ticket
to the selected change, and every candidate check to a declared check definition.
Every in-scope scenario needs implementation work and at least one candidate check;
a shared ticket/check may cover multiple scenarios. A supporting ticket may declare
an explicit enabling rationale instead of pretending to implement a scenario. Every
ticket of the change must be classified; duplicate, dangling or cross-change links
fail. Review-only verification is supported but visibly a judgment.

- **S-04:** Removing a requirement or scenario from the map, inventing an ID, linking a missing/wrong-change ticket or an undeclared check blocks structural coverage with the exact affected IDs.
- **S-05:** Shared checks, multiple tickets per scenario, and a classified enabling ticket validate; an unclassified ticket or a scenario with no implementation/check link does not.
- **S-06:** Malformed JSON, unknown schema/keys, duplicate JSON object keys, duplicate entries and unsafe referenced paths fail before mutation or check launch.

### R-03 — Bind coverage and scope dispositions to authorization

Coverage links, candidate command definitions and planned scope dispositions are
reviewed agreement inputs, with retained snapshots. A material omission is never
converted into delivery. Deferral and removal require a resolved decision of this
change naming the affected IDs and an applicable user authorization; free text
`authorized_by` alone is insufficient in strict mode. Runtime checks reference
integrity and agreement currency; a reviewer judges whether the user's words really
support the disposition. Existing delegation can cover a check improvement with a
recorded basis, but cannot mechanically waive the user-decision requirement for
scope deferral/removal.

Removed IDs remain as tombstones referencing the prior inventory and decision;
compare against the prior agreement so deleting both prose and map rows cannot erase
an obligation. A first adoption can only establish its reviewed starting inventory;
it must not claim to discover omissions that predate available history.

- **S-07:** Editing links, scenario text, check commands/timeouts or scope dispositions invalidates authorization; status-only edits, attempts and generated reports do not. A delegated strengthening binds the new agreement and requires fresh affected verification.
- **S-08:** Deferral/removal with a missing, open, wrong-change or unreferenced decision blocks; a valid decision and current user authorization records non-delivery explicitly and preserves the earlier obligation.
- **S-09:** Deleting an old requirement and its map entry is detected from the prior snapshot; reverting to an earlier digest cannot bypass a retained open decision. A decision prepared against changed inputs refuses at commit.

### R-04 — Report structural impact without inventing semantics

Compare current authored inputs with an explicit retained agreement (default: the
latest applicable authorization, otherwise latest retained agreement). Report added,
changed, removed and unchanged IDs, changed links/check definitions, affected tickets
and candidate checks, and the reason each is included. Dependency dependents may be
reported separately from direct links. Changes outside recognized definitions are
reported as unscoped PRD changes requiring review; do not return “no impact”.

Keep v5 conservative source freshness: a narrow impact report is not permission to
reuse evidence whose source identity changed. No report mutates approval, launches
checks, rewrites tickets, or resolves decisions.

- **S-10:** Changing one scenario identifies that scenario, its requirement, linked tickets/checks and dependency dependents; unrelated authored links remain distinguishable.
- **S-11:** Adding/removing definitions, changing only links/checks, and editing constraints outside definitions each produce an explained difference; unsupported or missing history is reported as unavailable, never no impact.
- **S-12:** Returning to paused A after B changed source retains A's unchanged authorization and structural links while showing stale verification. Repeated impact inspection changes no files.

### R-05 — Derive phase-appropriate coverage

Use the same graph in planning, implementation and evaluation. Structural coverage
means all obligations have valid links or authorized non-delivery dispositions.
Implementation readiness additionally requires mapped work complete with current
passing ticket evidence. Candidate delivery additionally requires applicable passing
candidate checks/reviews and an explicit adequacy review. These are separate fields;
a linked check or a done ticket cannot imply candidate delivery.

- **S-13:** A mapped scenario with an open ticket, unchecked criteria, failed/interrupted/stale attempt or missing local evidence is visibly unfinished/unverified and prevents completion where required.
- **S-14:** Completing all mapped work permits lifecycle completion before candidate selection, without demanding candidate results early; a missing map row still blocks completion.
- **S-15:** Structural coverage can be complete while candidate evidence is missing or a reviewer finds checks inadequate; output never labels this delivered or release-ready.

### R-06 — Enforce the declared candidate verification contract

The coverage map declares stable candidate check IDs with kind and reviewable command
text plus timeout, or a review obligation. Execute strict command checks from those
definitions; an arbitrary supplied command must not become evidence for a declared
check merely by reusing C-01. Retain check definition identity, agreement, coverage
and inventory identity in attempts/exported evidence as needed. Validate all declared
required checks; an unused failing required check cannot be omitted from export.

- **S-16:** Running C-01 with a different command/timeout cannot satisfy its declared obligation; definition changes stale prior results, and another change's C-01 is never borrowed.
- **S-17:** Gate/definition changes between initial validation and attempt registration are revalidated under the shared lock; refusal launches nothing, and the attempt records the freshly validated inputs.
- **S-18:** Review obligations require a candidate-bound artifact and explicit result; missing/failed/unverified required reviews block. Passing syntax checks alone do not create an adequacy judgment.

### R-07 — Reconcile complete candidate evidence at export and release

A strict evidence format records the complete inventory, scenario dispositions,
coverage identity, declared check identity and adequacy judgment for the candidate.
Export and read-only release independently reconcile it with the committed candidate's
authored inputs and retained change identity, not just the manifest's own list.
Delivered rows require all their required checks to pass; deferred/removed rows stay
visibly non-delivered. The overall report must distinguish delivery with authorized
scope dispositions from delivery of every original obligation.

Saved evidence remains inspectable without local attempts under the v5 provenance
limit; applicable newer local failures still block. Persist inventory/coverage
snapshots as validated, explicitly listed artifacts without self-referential digests.
All authored agreement/completion metadata precedes candidate selection.

- **S-19:** Removing/inventing a requirement/scenario in an otherwise valid manifest, substituting the inventory/map or marking a failed linked check delivered causes export and independent release validation to refuse.
- **S-20:** Two changes evaluated on one candidate retain distinct identities and valid locators; arbitrary unlisted evidence and malformed locator files remain disallowed after the candidate.
- **S-21:** A fresh clone can validate complete saved evidence with its limitations; tampered logs, missing snapshots, changed source or a newer applicable local failure prevents readiness. Release inspection writes nothing.

### R-08 — Adopt and ship without silently changing old projects

Strict coverage is an explicit retained capability of a change, not a flag whose
removal disables validation. Use a new change-record schema that old runtimes reject;
freeze exact schema/projection versions before implementation. New evidence versions
must likewise be rejected by older validators. Existing schemas remain readable with
honest legacy coverage labels. Adoption preview/apply validates authored inputs,
backs up changed files and atomically records the capability and agreement inputs.
It grants no inferred approval and reuses a real existing instruction only through
an explicit applicable authorization/delegation record.

- **S-22:** Legacy, v0.5.0 and v5 fixtures preserve files/evidence until explicit adoption; preview writes nothing, apply is idempotent, and source-specific rollback literally restores backups without deleting restored bindings/indexes.
- **S-23:** Death/concurrent edits during adoption or binding recover to complete old/new state; missing strict inputs, downgraded flags, mixed/unknown schemas refuse safely. Running-attempt transitions preserve v5 rules.
- **S-24:** npm packed installs for every supported layout and plugin contain identical runtime behavior; old runtimes reject new records/evidence. Existing regressions and macOS/Linux × supported Node CI pass.

### R-09 — Make coverage and impact useful in normal sessions

Provide read-only human and versioned JSON commands and integrate concise summaries
into status/resume. Show the selected change, reviewed/current identities, missing
links, evidence freshness, non-delivery dispositions and one ordered next action.
Keep v5 blocker precedence. Explain structural completeness separately from the
adequacy judgment. Update plan/narrow/code/evaluate/release and installation guidance
so normal work authors the map once and consumes computed reports thereafter.

- **S-25:** Human/JSON coverage and impact name the same affected IDs and blockers; a fresh session can locate the next ticket/check/decision using the report and linked artifacts without prior chat.
- **S-26:** A small fix uses the same safeguards with a compact PRD/map; reports launch no checks or approval requests, and routine resume does not duplicate authorization.
- **S-27:** Playbooks expose changed-scope decisions before recording approval; a generic “continue” is never represented as approval of revised scope. Trial failures stay open rather than being hidden by a passing format validator.

### R-10 — Establish an independent, reproducible delivery benchmark

Create six bounded briefs: a greenfield CLI feature, a brownfield bugfix with unrelated
edits, an untested integration change, a UI feature with error/accessibility states,
a mid-build scope revision, and a two-change fresh-session handoff. For each, preserve
a base commit, task brief, environment and independent acceptance evaluator. Evaluator
checks are authored/frozen before implementation and held outside the implementation
agent's visible workspace. This is process separation, not a security claim against
an adversarial agent. Never use the implementation's own passing tests as the only
quality measure.

- **S-28:** The harness detects deliberately faulty implementations (omitted behavior, false-success path and stale/wrong-change evidence), records actual nonzero outcomes, and cannot turn missing tools, evaluator errors or absent trials into passes.
- **S-29:** Run at least three paired repetitions per brief for Pincer and a plain-agent baseline (36 runs total), using matched base/model/tool versions, equivalent task intent and resource caps, fresh workspaces and balanced run order. Record prompts, interventions, failures, exclusions and evaluator provenance; no post-hoc cherry-picking or silent replacement of invalid runs.
- **S-30:** Publish a local review artifact with per-run independent acceptance, escaped regressions, clarification/reapproval/repair counts, setup and review effort, active/elapsed time and tokens/cost when available. Report variation, denominators, unavailable values and limitations; no superiority threshold is required for v6 completion. Unavailable required live runs keep the trial ticket open unless scope is explicitly revised.

## 5. Architecture and contract decisions

### Ownership and data flow

1. The PRD owns requirement/scenario definitions and their prose. Parsing produces
   an inventory; it is not another editable source of requirements.
2. `.prd/coverage/<change-id>.json` owns links, scope dispositions and candidate check
   definitions. It names its change and PRD explicitly. It has versioned, strict JSON
   with bounded fields, unique entries and repository-relative validated references.
3. Existing ticket Markdown owns implementation objectives, dependencies, acceptance
   and ticket verification commands. Human `Implements:` prose is a navigation aid;
   the coverage map is the sole machine-readable link authority in this increment.
4. Agreement snapshots include normalized inventory/map/check inputs. The runtime
   owns adoption capability, lifecycle, authorization and retained snapshots using
   the shared transactional writer. A map edit is authored work; binding it is a
   runtime operation with expected-digest checks under the lock.
5. A shared coverage module computes structure, implementation coverage and candidate
   coverage. An impact module traverses the validated graph. CLI, completion, export
   and release call these modules rather than maintaining separate policy copies.
6. Candidate evidence owns observed outcomes and candidate-bound review artifacts.
   Exported snapshots and the evaluation locator obey the exact artifact allowlist.
7. The benchmark runner owns run metadata and invokes the independent evaluator on
   produced candidates. Live acceptance judgments remain distinct from metadata
   schema validation.

Contract freeze T-66 must define exact Markdown examples, JSON keys, schema versions,
normalizations and exit/reason codes before writers change. Prefer the existing Node
runtime and no new dependency; this PRD introduces no external service/API. If a new
parser dependency is necessary, surface that material architecture choice first.

Proposed commands (final spelling may change together with examples and tests):

| Command | Behavior |
| --- | --- |
| `coverage [--change <id>] [--json]` | Read-only phase-specific coverage and diagnostics |
| `impact [--change <id>] [--from <agreement-id>] [--json]` | Read-only structural differences and affected links |
| `coverage adopt --preview/--apply --change <id>` | Explicit backed-up capability conversion; authorizes nothing |
| `check C-NN --candidate <sha>` | Strict mode executes the declared command/timeout; legacy invocation stays supported in old modes |

All are under `node scripts/pincer-runtime.cjs`. Inspection preserves existing exit
conventions: readable-but-blocked is inspectable; invalid input is nonzero; readiness
is nonzero when blocked. Exact codes and deterministic next-action precedence belong
in the contract. Phase-specific gates avoid the cycle of demanding evaluated evidence
before implementation completion.

### Compatibility and risks

The distribution repository stays in its current legacy management mode while v6 is
built. Use an independent pinned released v0.5.0 management kit, or an explicitly
selected later released kit once available; never verify the runtime's own ticket
state with the code being edited. New behavior lives in disposable fixtures. Do not
migrate this repository as a side effect of planning or implementation.

The largest risks are parser ambiguity, deleting obligations during revision,
self-validating evidence, unbound command substitutions, migration damage and
benchmark contamination. Preserve adversarial examples for each. Structural linkage
cannot determine whether a test is meaningful; the adequacy review and independent
benchmark remain essential. Conservative whole-source invalidation stays in force.
The known v5 generic-prompt residual needs a live re-test in the revision brief;
lexically mentioning a requirement ID is not proof of real user approval.

### Trust boundaries

Treat PRDs, maps, drafts, references and imported evidence as untrusted inputs. Reject
unsafe traversal/symlink escapes, unknown schemas and malformed structures before
execution or mutation. Check commands run only within existing host sandbox and
approval boundaries; Pincer grants no additional permissions. Persist redacted
summaries and safe references, never secrets or raw private transcripts. Local
records provide provenance, not independently authenticated identity. Benchmark
artifacts stay local; sharing or publishing results is a separate action.

## 6. Build order and success gates

T-66 freezes contracts; T-67/T-68 establish inventory and links; T-69 binds and adopts;
T-70/T-71 compute coverage and impact; T-72 executes declared checks; T-73 reconciles
candidate evidence; T-74 integrates reports; T-75 ships the adapters and compatibility;
T-76 builds independent benchmark fixtures; T-77 observes paired runs; T-78 assembles
the final review. See the ticket map for precise dependencies and all S-01..S-30.

Success requires meaningful fault-injection checks for every mechanical guarantee,
all existing regressions, both generators without drift, packed parity and supported
CI on the final implementation candidate. The benchmark must be reproducible and
honestly reported; a result showing overhead or no quality advantage is valid data.
A metadata validator alone cannot close a live-observation requirement. The review
packet maps every R/S ID to actual evidence and disposition, lists deviations and
outstanding environments, and includes independently runnable failure reproductions.
Finalize authored completion and review material before selecting the evaluation
candidate. Evaluation, merge, version bump and publication remain separate stages.
