---
ticket: T-84
status: done
size: S
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T19:26:28Z
last_check: 2026-09-13T19:28:52Z passed 24b0fe1f7b58
verified: 2026-09-13T19:28:52Z 24b0fe1f7b58
finished: 2026-09-13T19:28:52Z
---

## Objective
A blank line inside a scenario list item ends its continuation, so the item's second and later paragraphs are attributed to the parent requirement instead of the scenario. Rewriting such a paragraph — inverting what the scenario says the implementation must do — leaves the scenario's digest unchanged, so `impact` reports the scenario as unchanged and its linked tickets and checks as unaffected.

## Context
- Relevant files: template/scripts/pincer-runtime/requirements.cjs (`lastScenario` and CONTINUATION at 132); template/docs/runtime-contracts.md (the strict inventory grammar); test/coverage-inventory.test.js; test/coverage-impact.test.js.
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-01 ("Retain source locations and normalized content per ID"; S-03 "Lifecycle status and checkbox-mark edits preserve normalized identity, while changed scenario behavior changes its digest"), and R-04/S-10, whose per-scenario attribution this defeats.
- Source: the strict-coverage review run during `/pincer-evaluate` of the combined v5+v6 candidate; reproduced on a real strict change by rewriting "reject" to "ACCEPT" in a scenario's second paragraph and observing `Scenarios unchanged`.
- Implements: R-01 (the authored inventory).

## Requirements
- A blank line inside a list item does not end the item: blank lines are held while a scenario is open and folded into it when the next non-blank line is a continuation. A list item, heading, fence, table row or non-indented line ends it, as today.
- Editing any paragraph of a multi-paragraph scenario changes that scenario's digest, and `impact` names the scenario, its requirement and its linked tickets and checks.
- The grammar in the contract states what a continuation is, including the multi-paragraph case, so an author can tell from the document what belongs to a scenario.

## Acceptance Criteria
- [x] A two-paragraph scenario's second paragraph belongs to the scenario: editing it changes the scenario digest and nothing else.
- [x] The requirement's own digest no longer moves when a scenario's later paragraph is edited.
- [x] Existing single-paragraph inventories parse to identical digests — no PRD's inventory changes silently.

## Verification
Proves: every paragraph of a scenario belongs to that scenario.
```bash
node test/coverage-inventory.test.js
node test/coverage-impact.test.js
node test/coverage-contracts.test.js
node test/runtime-parse.test.js
```

## Constraints
- The inventory grammar is frozen contract: any change to what parses must be stated in `template/docs/runtime-contracts.md` in the same commit, and must not change the digest of a PRD that parses correctly today. Manage this ticket with the pinned released v0.5.0 kit.
