---
ticket: T-25
status: done
size: S
prd: .prd/prd-v3.md
depends_on: []
started: 2026-09-10T19:46:45Z
last_check: 2026-09-10T19:50:06Z passed 4d31eb5ee1ca
verified: 2026-09-10T19:50:06Z 4d31eb5ee1ca
finished: 2026-09-10T19:50:06Z
---

## Objective
Make evaluate's evidence step record one executable check per command, with the command line as run, so independently assessed commands do not share one verdict.

## Context
- Relevant files: `template/.claude/commands/pincer-evaluate.md` (step 9, the `checks/C-NN.log` bullet and the `manifest.json` bullet's "one `checks` entry per check"), `template/docs/dry-run-checklist.md` (the `## After /pincer-evaluate` boxes near the manifest box), `test/workflow.test.js` (add assertions near the evaluate assertions).
- PRD section: R-02; trial finding 3 (C-03 bundled three commands under one `unverified`) and finding 2 (prose in `command`) in `docs/trial-2026-09-10-interactive.md`.
- Implements: R-02
- Generated outputs (`template/.agents/skills/pincer-evaluate/SKILL.md`, `template/.github/prompts/pincer-evaluate.prompt.md`, `plugin/commands/evaluate.md`, `plugin/docs/dry-run-checklist.md`) come from the two generators; never hand-edit them.

## Requirements
- Step 9 states: one check per command; `command` holds the command line as run, never prose describing a session; independently assessed commands (the tracked `.env` check, the secret scan, the dependency audit) are separate `checks` entries with their own `result` and log, and only the tool that could not run is `unverified`. The literal phrases `one check per command` and `the command line as run` appear.
- Step 9 states the boundary: a test runner such as `npm test` stays one aggregate check; do not split every subprocess or assertion; visual and review checks keep their kinds and get no artificial shell command; an unavailable tool gets a reason, not a fabricated log.
- A manual smoke run is recorded with the command lines that were run, as separate entries when they establish independent outcomes; redaction is noted rather than replaced by an invented command.
- The dry-run checklist gains one box under `## After /pincer-evaluate`: each executable check in the manifest holds one command line as run, the security pass is separate entries, and only the tool that could not run is `unverified`. The box contains the literal phrase `one command line as run`.
- `test/workflow.test.js` asserts the two evaluate phrases and the checklist phrase.
- `template/scripts/pincer-evidence.cjs` and evidence schema 1 are unchanged; `test/evidence.test.js` passes as it is.

## Acceptance Criteria
- [x] Step 9 carries the rule, the security-pass example and the `npm test` aggregate boundary.
- [x] The checklist box exists and the wording assertions pass.
- [x] Validator and evidence tests unchanged and passing; generated outputs current.

## Verification
Proves: the rule is present in the source playbook, checklist and generated plugin and the suite passes with the validator untouched; regression: a phrase missing, stale generated output, or an evidence test failing. Static assertions are primary evidence for this playbook-text contract.
```bash
npm test && grep -q 'one check per command' template/.claude/commands/pincer-evaluate.md && grep -q 'the command line as run' template/.claude/commands/pincer-evaluate.md && grep -q 'one command line as run' template/docs/dry-run-checklist.md && grep -q 'one check per command' plugin/commands/evaluate.md && grep -q 'one check per command' test/workflow.test.js && git diff --quiet HEAD -- template/scripts/pincer-evidence.cjs test/evidence.test.js && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- No validator heuristics for prose in `command`; the validator keeps accepting any non-empty string.
- No change to `required`/`unverified` semantics or to the manifest field list.
- Do not hand-edit generated outputs.
