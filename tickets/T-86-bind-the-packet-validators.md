---
ticket: T-86
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T20:19:20Z
last_check: 2026-09-13T20:27:13Z passed 34a03f968c07
verified: 2026-09-13T20:27:13Z 34a03f968c07
finished: 2026-09-13T20:27:13Z
---

## Objective
The two review-packet validators do not bind the packets to reality, and two packet citations name artifacts that do not exercise what they are cited for. The v5 suite's ticket-commit loop asserts no minimum match count and never ties a commit to its ticket, so rewriting all nineteen citations to the base commit, or deleting every SHA, still passes. The v6 suite asserts a total citation count across all thirty scenario rows rather than one per row, so a scenario can cite no suite at all. Each packet suite has the check the other one dropped.

## Context
- Relevant files: test/change-review-packet.test.js (the ticket loop at 35, the per-row citation check at 58-62 that the v6 suite lacks); test/coverage-review-packet.test.js (the ticket/subject checks at 33-37 that the v5 suite lacks, the aggregate at 81, the schema section at 94); docs/prd-v5-review-packet.md; docs/prd-v6-review-packet.md (the S-20 row at 88, the section 9 preamble and race row at 220-230); docs/prd-v6-artifacts/replay.sh (the `race` and `shared` case bodies and their header comments).
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-09 and the section 6 gate ("The review packet maps every R/S ID to actual evidence and disposition"); PRD v5 section 8 ("Do not replace missing observations with wording assertions").
- Source: mutation testing during `/pincer-evaluate` of the combined v5+v6 candidate. Each defect is recorded with the mutation that survives it.
- Implements: the review-packet gate of both PRDs.

## Requirements
- Each packet validator gains the check the other already has: the v5 suite asserts the expected ticket ID list and that each cited commit's subject begins with that ticket's ID; the v6 suite asserts per scenario row that it cites at least one tagged suite, keeping the existing tag, existence and npm-test checks.
- Section 3's claim that the representative records are what the runtime writes is established by running the validator that owns each record — the change record, the coverage map, the inventory snapshot and the schema 3 manifest — not by re-reading the number each file declares about itself.
- The v6 packet cites for S-20 only artifacts that exercise S-20: the replay case either evaluates two changes on one candidate and asserts two distinct locators, or it is not cited there.
- Section 9's preamble claims a control only for the cases that have one, and the `race` row's control column says what that case establishes. The case header comments name the fault each case actually injects.
- Every mutation recorded in this ticket's source is killed by the suites after the change.

## Acceptance Criteria
- [x] Pointing every v5 ticket citation at the base commit fails the suite; so does deleting the SHAs.
- [x] A scenario row that cites no tagged suite fails the suite.
- [x] A representative record that the runtime would refuse fails the suite.
- [x] Collapsing per-change evaluation locators fails whatever the S-20 row cites.

## Verification
Proves: the packets cannot claim evidence the repository does not carry.
```bash
node test/change-review-packet.test.js
node test/coverage-review-packet.test.js
node test/coverage-trial-record.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-61 or T-78. Manage this ticket with the pinned released v0.5.0 kit.
- Strengthening a validator must not weaken another: the assertions added here are additional, and every check the suites make today is kept.
