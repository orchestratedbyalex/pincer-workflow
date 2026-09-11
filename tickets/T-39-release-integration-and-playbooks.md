---
ticket: T-39
status: open
size: M
prd: .prd/prd-v4.md
depends_on: [T-37, T-38]
---

## Objective
Make status and release consume runtime provenance and newer local attempts, keep release read-only, and update the playbooks, templates and checklists to the runtime's `verify`/`done` semantics, evaluate through `check`/`export`, and post-migration recovery.

## Context
- Relevant files: `template/scripts/pincer-runtime/readiness.cjs` and `status.cjs` (candidate readiness with local attempts), `template/.claude/commands/pincer-code.md` (loop steps 3 and 5, recovery after migration), `pincer-evaluate.md` (step 9 through `check` and `evidence export`), `pincer-release.md` (reads `status`/`ready`, never `verify`), `pincer-status.md`, `pincer-narrow.md` (optional `timeout`), `template/.claude/references/ticket-template.md`, `template/AGENTS.md` (rules paragraph), `template/docs/release-checklist.md`, `template/docs/dry-run-checklist.md`, `test/workflow.test.js`, new assertions in `test/runtime-status.test.js`.
- PRD section: R-07 (release read-only, newer attempts, fresh clones), R-08 (S-25, S-26), R-01 (after migration: never recommend restoring a ticket or deleting runtime history).
- Implements: R-07 (S-24), R-08 (S-25, S-26), R-01

## Requirements
- Candidate readiness in migrated mode: notes current and evidence ok as today; additionally, for every runtime command check in the schema-2 manifest, the latest local attempt with the same `candidate` and `check` and the same source digest must not be newer than the exported one with a nonpassing outcome (`CHECK_FAILED`/`ATTEMPT_RUNNING`/`ATTEMPT_TIMED_OUT`/`ATTEMPT_INTERRUPTED` block; a failure on a different source digest is reported as historical and does not block). When `.pincer/runtime` is absent (fresh clone), status says `local verification history unavailable; saved candidate evidence validated only` and does not claim readiness of local verification. Legacy manifests report `provenance: legacy`. `ready` with no ticket applies the same computation. Release never creates attempts or tracked edits: the playbook runs `status`, `ready` and the project gate only.
- Playbooks: code step 3 says `verify` records an attempt and, after migration, writes no receipt into the ticket; step 5 says `done` consumes the current passing attempt and does not re-run the check; the recovery section gains a migrated paragraph: retain the failure, repair, `verify` again, readiness derives from the latest attempt; never restore a ticket file or delete `.pincer/runtime` to obtain green status; the legacy exception applies only before migration. Evaluate step 9: each executable check is `node scripts/pincer-runtime.cjs check C-NN --candidate <sha> -- <command>`, review and visual checks are authored in a draft, and `evidence export` writes the manifest; `unverified` remains the honest record for a tool that cannot run. Release reads the `Runtime`, `Notes`, `Evidence` and `Provenance` lines and `ready`. Status playbook: the JSON form, and the migrated recovery rule. Narrow and ticket template: the optional `timeout: <seconds>` field and that changing it changes the check. AGENTS.md rules: the runtime commands, `.pincer/` is local state that is never edited or deleted by hand, and `.prd/changes/` is written only by the runtime. Checklists: release reads provenance and newer attempts; dry-run gains migrated cheat boxes (source change → stale; failed recheck → blocked; process death → restart; unchanged verify → no tracked diff; migration conflict → preserved edit; candidate export → fresh-clone validation; newer local failure → blocked release).
- `test/workflow.test.js` pins the new sentences; the shared authorization block stays byte-identical across the four playbooks; generated adapters and plugin regenerate with no diff.
- Tests (in `test/runtime-status.test.js`): S-24 a newer same-context failing `check` after export blocks `ready` and status names the check; a failing attempt with a different source digest does not block; a fresh clone reports the availability limit and still validates the saved manifest; S-25 every failure fixture from the runtime suites maps to a stable reason code and a concrete next action (table-driven); S-26 the human `Next`/`WARN` lines, the JSON reasons, `done`'s refusal codes and `ready` agree on the same fixtures; JSON contains no secret marker from a fixture log.

## Acceptance Criteria
- [ ] A newer same-context failure blocks local release despite an older exported pass; fresh clones report the limitation; release creates nothing.
- [ ] Playbooks, templates, checklists and AGENTS.md describe the runtime semantics and are pinned by wording assertions; generated outputs are current.
- [ ] `npm test` passes.

## Verification
Proves: release readiness consumes the shared computation with local attempt history, and the authored guidance matches the runtime; regression: an old exported pass surviving a newer failure, a fresh clone claiming local readiness, or a playbook still describing receipt rewrites.
```bash
node test/runtime-status.test.js && node test/workflow.test.js && npm test && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- Keep the post-candidate change policy: only NOTES.md and listed evidence may follow the candidate.
