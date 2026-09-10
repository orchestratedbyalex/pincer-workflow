---
ticket: T-26
status: open
size: S
prd: .prd/prd-v3.md
depends_on: []
---

## Objective
Tell the plan playbook to ask a partly answered discovery question only for its open part, and to ask nothing when the brief settles every material decision.

## Context
- Relevant files: `template/.claude/commands/pincer-plan.md` (Phase 1, step 2 "Ask only the questions whose answers would change the architecture or scope" and step 3 design question), `test/workflow.test.js` (plan assertions at the top of the file).
- PRD section: R-03; trial finding 4 (the "done" question overlapped a brief that named `npm test`) in `docs/trial-2026-09-10-interactive.md`.
- Implements: R-03
- Generated outputs (`template/.agents/skills/pincer-plan/SKILL.md`, `template/.github/prompts/pincer-plan.prompt.md`, `plugin/commands/plan.md`) come from the two generators; never hand-edit them.

## Requirements
- Step 2 adds, after "Batch them (max 3–4 at once).", wording that a question the brief partly answers is asked only for its open part, naming the settled part; when the brief settles every material decision, including acceptance behavior, ask no discovery question and record the brief's answers; do not add a question to fill the budget. The literal phrases `asked only for its open part` and `Do not add a question to fill the budget` appear.
- The example "What does "done" look like" stays, with a note that a named test runner settles the verification choice but not every acceptance behavior.
- Step 3 says the design question follows the same rule when design direction was already supplied; the design question itself and the four-question budget stay.
- "Never ask a question the brief already answers." in step 1 is unchanged.
- `test/workflow.test.js` asserts the two new phrases and that step 1's sentence is still present.
- The dry-run checklist box "Discovery asked ≤4 questions and none were already answered by the brief" is unchanged.

## Acceptance Criteria
- [ ] Step 2 and step 3 carry the rule; the budget, batching and design question are unchanged.
- [ ] Wording assertions pass; generated outputs current.

## Verification
Proves: the rule is present in the source playbook and the generated plugin, the existing plan assertions and the budget wording survive, and the suite passes; regression: a phrase missing, the budget or "Never ask a question the brief already answers" removed, or stale generated output. Static assertions are primary evidence for this playbook-text contract.
```bash
npm test && grep -q 'asked only for its open part' template/.claude/commands/pincer-plan.md && grep -q 'Do not add a question to fill the budget' template/.claude/commands/pincer-plan.md && grep -q 'Never ask a question the brief already answers' template/.claude/commands/pincer-plan.md && grep -q 'max 3–4 at once' template/.claude/commands/pincer-plan.md && grep -q 'asked only for its open part' plugin/commands/plan.md && grep -q 'asked only for its open part' test/workflow.test.js && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && git diff --quiet -- template/.agents template/.github plugin
```

## Constraints
- Do not raise or lower the question budget or remove the frontend design question.
- Do not hand-edit generated outputs.
