---
ticket: T-83
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T19:29:15Z
last_check: 2026-09-13T19:46:08Z passed daef46e8ca10
verified: 2026-09-13T19:46:08Z daef46e8ca10
finished: 2026-09-13T19:46:08Z
---

## Objective
Close three paths by which `pincer-evidence.cjs validate` certifies a schema 3 manifest it should refuse. A scenario whose linked check is not declared in the map snapshot is treated as vacuously satisfied and derived `delivered`; a candidate whose PRD blob cannot be read is reported as "not available in this repository" — which is false when the commit is present — and the map and change-record reconciliation is abandoned with it; and a deferred or removed row's `authorization` is shape-checked but never resolved in the candidate's committed change record. The independent validator is the artifact the contract offers a reviewer for evidence they did not generate, so each of these is a false `ok`.

## Context
- Relevant files: template/scripts/pincer-runtime/evidence.cjs (`validateStrict` derive at 356, the candidate reconciliation at 406, the dispositioned-row rule at 382, `exportEvidence` at 623); template/scripts/pincer-runtime/dispositions.cjs (the rules the local report already applies); template/scripts/pincer-runtime/coverage.cjs (`resolve`); test/coverage-evidence.test.js.
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-07 ("Export and read-only release independently reconcile it with the committed candidate's authored inputs and retained change identity, not just the manifest's own list"; S-19 "Removing/inventing a requirement/scenario in an otherwise valid manifest, substituting the inventory/map or marking a failed linked check delivered causes export and independent release validation to refuse").
- Source: the strict-coverage review run during `/pincer-evaluate` of the combined v5+v6 candidate; all three reproduced against real exported evidence in a fixture.
- Implements: R-07.

## Requirements
- An unknown check link fails closed: a scenario derives `delivered` only when it links at least one check and every required check it links is declared and passed. A link to an undeclared check is a problem on the snapshot itself, beside the existing declared-versus-manifest rules, so the map that produced it is refused rather than silently tolerated. `exportEvidence` refuses the same input instead of throwing.
- "The candidate is not available in this repository" is said only when the commit does not resolve. When the commit resolves but a blob does not, that is its own problem, and the map and change-record reconciliation still run.
- A deferred or removed row is resolved against the candidate's committed change record with the rule `dispositions.cjs` already implements locally: the named decision exists and is resolved, it names the affected ID, and an applicable user authorization reaches it. The independent validator and the local report cannot disagree about the same evidence.
- Each path has a fault-injection case: the undeclared link, the unreadable PRD blob with a mutated map snapshot, and the invented authorization each make `validate` exit non-zero with a named reason.

## Acceptance Criteria
- [x] Each of the three manifests that validates today is refused, with a reason naming the row or snapshot at fault.
- [x] Evidence that `evidence export` produces still validates unchanged.
- [x] `validate` and the local `ready` report reach the same verdict on the same tree.

## Verification
Proves: a manifest cannot certify an obligation the candidate does not support.
```bash
node test/coverage-evidence.test.js
node test/coverage-contracts.test.js
node test/evidence.test.js
node test/runtime-evidence.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-73. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
- Validation stays read-only and dependency-free; it establishes the record's consistency with the committed candidate, never that the recorded commands ran.
