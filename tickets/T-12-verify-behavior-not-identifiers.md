---
ticket: T-12
status: open
size: M
prd: .prd/prd-v2.md
depends_on: [T-11]
---

## Objective
Require ticket verification that exercises observable behavior and disclose what each check establishes, validated by controlled faulty fixtures that identifier greps cannot catch.

## Context
- PRD: `.prd/prd-v2.md`, requirement R-02 (and its acceptance row). Implements: R-02.
- Dry-run finding 1 in `docs/dry-run-2026-09-08-sonnet.md`: T-01/T-02 checks grepped for `@media` and `Chip` while the real signal came from the test suite.
- `template/.claude/references/ticket-template.md` — Verification section rules.
- `template/.claude/commands/pincer-narrow.md` step 2 and `template/.claude/commands/pincer-code.md` step 3.
- `test/helpers.js` — `tempDir`, `write`, `run` for disposable fixtures.

## Requirements
- Ticket template: each ticket's Verification section is preceded by a one-line `Proves:` statement (what the check establishes and which regression it detects). Executable changes need checks that exercise observable behavior, including relevant rejection paths and, in brownfield work, preservation of existing behavior. Reusing adequate focused tests is preferred over new ad-hoc commands. A build, syntax check or identifier grep alone is not proof a feature works. Static assertions may be primary evidence for static contracts (generated files, adapter wording) when the ticket explains that fit.
- Narrow playbook: the same policy, plus an explicit prohibition on judging a command adequate by matching words such as `grep`, `test` or a runner name; adequacy is a judgment about what the command observes. Manual visual judgment is recorded separately from executable verification; an unavailable tool yields an explicit `unverified` result, never fabricated evidence or a silent waiver.
- Code playbook step 3: report the actual output; if the check is a syntax or build step only, say so and do not present it as behavioral proof.
- New `test/behavioral-verification.test.js`: builds a disposable fixture repository (a tiny module with a validation function and a small test file) and three controlled faults applied one at a time to a fresh copy: behavior broken while identifiers remain, invalid input incorrectly accepted, and existing behavior regressed. For each fault the behavioral check (`node --test` or a plain `node` assertion script) must fail and an identifier-grep check must still pass; on the correct implementation both pass. Each fault runs in its own fresh copy so one failure cannot mask another.
- Add the new test to the `npm test` chain in `package.json`.
- `test/workflow.test.js` asserts the new wording in the ticket template, narrow and code playbooks, and that the narrow playbook forbids word-matching adequacy.

## Acceptance Criteria
- [ ] Ticket template and narrow playbook require behavior-exercising checks with a `Proves:` disclosure, allow justified static checks for static contracts, and forbid word-matching adequacy.
- [ ] Unavailable tools produce an explicit unverified result in the narrow and code playbooks; visual judgment is recorded separately from executable checks.
- [ ] `test/behavioral-verification.test.js` shows the behavioral check failing on all three controlled faults and passing on the correct implementation, while the grep check passes on every fault, with fixtures reset between faults.
- [ ] `npm test` includes the new test file, and generated adapters and plugin match the template.

## Verification
```bash
node test/behavioral-verification.test.js && node test/workflow.test.js && grep -q 'behavioral-verification.test.js' package.json && node test/distribution.test.js
```

## Constraints
- No mutation testing framework and no claim that the acceptance set proves arbitrary agent-authored tests sufficient.
- Do not add runtime logic that inspects Verification commands for keywords.
