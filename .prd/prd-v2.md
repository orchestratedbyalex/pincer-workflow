---
version: 2
status: built
date: 2026-09-08
profile: standard
---

# Make requirements and release evidence reviewable

## Problem

M0 repaired preservation and ticket lifecycle failures. The next weakness is the
meaning of completion: a successful command can check the wrong thing, requirements
can disappear between planning and evaluation, and screenshots mentioned in chat
cannot be inspected at release.

The [Sonnet dry run](../docs/dry-run-2026-09-08-sonnet.md) demonstrated weak checks
and missing saved evidence on brownfield UI changes, alongside excessive planning
weight and unclear approval behavior. One trial does not establish platform-wide
behavior. The original v2 draft relied mainly on wording assertions, proposed ticket
restoration that could revive stale success, and omitted the interaction between
evidence files and the current candidate check.

## Product outcome and scope

A developer or reviewer can answer: what behavior was agreed, which work implements
it, what evidence supports it on this candidate, and what remains unverified. Support
new and existing projects, individuals and teams using their existing Git review
process. Preserve Markdown, local operation, existing commands and M0 guarantees.

This increment is a bounded bridge toward M1/M2 in the
[improvement plan](../docs/pincer-improvement-plan.md), not completion of those
milestones. It adds requirement/check contracts and mechanically validated candidate
evidence, alongside proportionate planning. A full runtime migration remains separate.

## Requirements

### R-01 — Carry observable requirements through delivery

Plan preserves or links the original brief, records the desired outcome, assumptions
and exclusions, and assigns stable requirement IDs within the selected PRD. Each
requirement has observable acceptance scenarios, relevant failure paths and existing
behavior to preserve. Review supplied PRDs without silently replacing their meaning
or existing IDs; record a mapping where their structure needs adaptation.

Narrow records a readable requirement-to-ticket-to-check map. Every required scenario
has an implementation owner and an identified executable check or explicit review
method. Enabling work without a direct requirement needs a stated purpose. Resolve
missing coverage and conflicting criteria before implementation.

Evaluate accounts for every requirement as delivered, blocked, or deferred with
explicit user authorization. Required failed or unverified behavior blocks PASS;
an agent cannot relabel it a limitation to pass. Deferral records the scope decision
and requires evaluation of the revised candidate.

In this increment, completeness and semantic adequacy of authored mappings are
agent/reviewer judgments, recorded in evaluation. Do not claim a general mechanical
traceability engine. Full dependency and requirement-revision impact validation stays
in M2.

### R-02 — Verify behavior and disclose what checks establish

Each ticket explains what its verification proves and which regression it detects.
Executable changes require checks exercising observable behavior, including relevant
rejection paths and brownfield preservation. Reuse adequate focused tests. A build
or identifier grep alone does not prove a feature works. Static assertions can be
primary evidence for static contracts such as generated files; explain that fit.

Do not determine arbitrary shell-command adequacy by matching words such as grep,
test or a runner name. Syntax validation proves syntax only. Manual visual judgment
is separate from executable verification; unavailable tools produce an explicit
unverified result, never fabricated evidence or a silent waiver.

Validate this policy with controlled faulty implementations in disposable fixtures:
behavior broken while identifiers remain, invalid input incorrectly accepted, and
existing behavior regressed. The chosen checks must fail on those faults and pass
on correct implementations. This small acceptance set is not automatic mutation
testing or a guarantee that arbitrary agent-authored tests are sufficient.

### R-03 — Persist and validate candidate evidence

Evaluate saves a versioned JSON manifest and supporting files under
`.prd/evidence/prd-vN/<candidate>/`; NOTES.md references the manifest. Record:

- Selected PRD, full base/candidate commit IDs and evidence schema version.
- Requirement dispositions, check IDs, results and the coverage review.
- Commands where applicable, timestamps, environment and tool limitations.
- Repository-relative artifact paths and full SHA-256 digests.
- For visual evidence: scenario, viewport, observed result and saved image.
  Non-UI changes state why visual review is not applicable.

Persist redacted summaries or safe logs, never secrets or entire environment dumps.
A shared read-only validator checks schema, duplicate/dangling manifest references,
candidate association, required results, artifact existence and digests. Missing,
malformed, tampered, wrong-candidate or failed required evidence blocks release
readiness with an actionable diagnostic. Unknown schema versions fail explicitly.
Require repository-contained regular files; reject absolute paths, traversal and
symlink escapes.

Status and release use the same validator. Merely adding a directory convention
or checking path existence is insufficient. Validation establishes consistency of
locally authored records, not independent attestation that commands ran or images
depict the stated application. Release also reruns the candidate-wide project gate.

### R-04 — Preserve candidate identity and a read-only release audit

Finalize implementation, tickets and the PRD built transition before selecting
the clean committed candidate. Evaluate that candidate, then save NOTES.md and
evidence in a subsequent scoped commit. Review fixes go through tickets, produce
a new candidate and require reevaluation. Do not move PRD state changes into a
later evidence-only commit just to save a commit.

Extend `notes_current` deliberately: after the candidate, allow only NOTES.md and
the exact manifest/artifact files for that evaluation. Do not exempt all of
`.prd/` or the evidence tree. Changes to source, tests, configuration, PRD,
tickets, other evaluations or unlisted files invalidate readiness. Current evidence
must validate; ticket receipts retain M0 checks. Required evidence is tracked and
the release working tree is clean. Preserve existing ancestry and dirty-tree checks.

Release validates and runs checks, then reports PASS/FAIL with the candidate and
reasons. It does not repair tickets, rewrite evidence, change PRD state or publish.
Checks that mutate the candidate invalidate the audit. The release verdict is
reported to the user; a durable runtime-owned release record remains later work.

### R-05 — Scale planning by risk and reuse authorization

Support `profile: small|standard`, defaulting to standard for older PRDs. Small
means bounded scope, low risk, known behavior and straightforward verification.
Few changed lines alone do not qualify. Migrations, authorization boundaries,
uncertain requirements and broad effects need appropriate investigation even for
tiny patches. Record why the profile fits.

Small PRDs retain problem/outcome, scope, requirement scenarios, verification,
risks and exclusions; omit empty sections and repetition. Ticket count follows
cohesion and dependencies, without a hard one-to-two-ticket cap. Interface examples
may clarify contracts; implementation code must not substitute for requirements.
Honor explicit budgets without a default timebox or silently cutting requirements.

Plan, narrow, code and evaluate use one rule: reuse explicit authorization for
the same scope and decisions; ask only about a material choice not already
authorized. Prepare the concrete proposal first. New architecture does not
automatically require another approval when the user delegated that decision;
narrow must still surface newly discovered consequential choices. Record the
authorization basis and covered scope in the PRD/handover. An agent-written record
or status field is not authenticated human approval. Do not invent authorization
when resuming without the necessary context.

### R-06 — Improve recovery and status without restoring stale success

Keep raw ticket checkout/restore guarded: restoring HEAD can erase a newer failure
and revive an old passing receipt. Document preserving malformed contents,
identifying the validation error, and returning through the existing lifecycle
with fresh verification after a user-performed repair. Do not recommend restoring
source or unrelated edits as routine ticket repair. Automated recovery that
preserves attempt history belongs in M1.

Failed verification says the failure was recorded and prior successful receipt
revoked. Status emits each readiness problem once without dropping distinct
problems. Show overall elapsed time only for active work or an explicit budget;
label it wall-clock elapsed, not active execution time. Remove fixed-timebox prose
where the user supplied no budget.

## Architecture and compatibility

`template/` remains canonical. Update the plan/narrow/code/evaluate/release
playbooks, PRD/ticket templates, release and dry-run checklists and shared status
logic. Add a small dependency-free Node helper under `template/scripts/` for
manifest validation, callable from Bash and packaged with all channels. Use JSON
parsing and explicit validation, not a general Markdown/YAML parser.

Define the exact evidence schema and validator CLI in its implementation ticket
before coding; the fields and failure behavior above are mandatory. Reuse this
helper at status/release rather than duplicating validation policy in playbooks.
Regenerate both adapters and plugin; verify all installations include the helper.

New evaluations use evidence schema 1. Preserve old PRDs, tickets and NOTES.md:
legacy evaluations stay readable, but status explains that reevaluation is needed
for the new evidence contract. Do not silently grant the stronger guarantee or
bulk-rewrite history. Installer manifest and ticket receipt formats remain unchanged.
An older runtime does not enforce the new contract; document that limitation.

## Acceptance and validation

| Requirement | Required acceptance evidence |
| --- | --- |
| R-01 | Greenfield and brownfield examples map each scenario through tickets to evaluation. Recorded review identifies deliberately omitted coverage and unauthorized deferral. A supplied PRD retains its meaning and IDs. |
| R-02 | Checks fail on each controlled faulty implementation despite retained identifiers, and pass on corrected versions. A static-only change has justified static checks; unavailable visual review stays unverified. |
| R-03 | Automated temporary-repository cases reject missing/tampered artifacts, invalid schema/references, wrong candidate, escaping paths and failed required results. A complete manifest passes the same validator used by status/release. |
| R-04 | A candidate plus valid evidence-only commit is current. Source, PRD, ticket, unlisted-file and unrelated-evidence changes are stale. Audit leaves tracked/untracked state unchanged. Review fixes require a new candidate/evaluation. |
| R-05 | Recorded workflow scenarios cover a small CSS fix, tiny high-risk change, supplied PRD, authorized resume and new consequential decision during narrow. Repeated approval is avoided, unresolved decisions are surfaced, and no arbitrary ticket cap/default budget appears. |
| R-06 | Regression tests cover accurate failure text, distinct nonduplicated warnings, active/finished elapsed display, and continued blocking of ticket restoration after failed rechecks. Recovery instructions require fresh verification. |

Wording tests protect adapter contracts; they do not establish agent behavior.
Record trial briefs, bases, model/tool versions, artifacts, results and human
interventions. Use single-line dry-run instructions where required by the client.
Test hooks with direct JSON payloads separately from model refusals. Reset disposable
fixtures between injected faults so another validation failure cannot mask the check.

Run all M0 regressions, generated parity and packed-install checks with new targeted
tests on supported CI environments. Complete one greenfield and one brownfield live
trial on an available agent surface; label other surfaces untested. Required
unavailable evidence remains outstanding. Do not claim cross-platform behavior
or superiority from one agent's trial.

## Delivery boundaries and subsequent work

Narrow into dependency-ordered tickets: requirement/check contracts, manifest
validation, candidate/status/release integration, planning and recovery, then
acceptance trials. Determine ticket count during decomposition. The current user
request authorizes review and rewriting of this PRD; implementation has not begun.

Defer the shared state-machine migration, source-bound ticket attempts, atomic
transitions, explicit concurrent change identity, authenticated approvals, complete
requirement-impact validation, automated repair, new platform hooks, native Windows
validation, hosted services and broad benchmarking. M1 remains the next runtime
investment. Do not describe command-hash receipts as source-bound proof. Publishing
and merging remain separate actions.
