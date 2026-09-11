---
ticket: T-44
status: done
size: M
prd: .prd/prd-v4.md
depends_on: [T-43]
started: 2026-09-11T12:32:29Z
last_check: 2026-09-11T12:46:57Z passed 2fdece756bf7
verified: 2026-09-11T12:46:57Z 2fdece756bf7
finished: 2026-09-11T12:46:57Z
---

## Objective
Fix the eighteen findings of the code-quality review of candidate `7b561b1` (runtime: guard scope, lock reclaim race, recover escalation, missing-record fallback, sanitizer gaps, timeout overflow, export input checks, ready codes, contract wording; docs: checklist and playbook contradictions, CI claim, obsolete file note, packet miscount, trial attribution, plugin path transform).

## Context
- Relevant files: `template/.claude/hooks/hook-policy.cjs`, `template/scripts/pincer-runtime/{state,sanitize,parse,evidence}.cjs`, `template/scripts/pincer-runtime.cjs`, `template/docs/runtime-contracts.md`, `template/docs/dry-run-checklist.md`, `template/.claude/commands/pincer-{narrow,code}.md`, `bin/pincer.js`, `scripts/build-plugin.sh`, `README.md`, `docs/prd-v4-review-packet.md`, `docs/trial-2026-09-11-prd-v4.md`, tests `test/hooks.test.js`, `test/runtime-state.test.js`, `test/runtime-runner.test.js`, `test/runtime-lifecycle.test.js`, `test/runtime-evidence.test.js`, `test/runtime-parse.test.js`, `test/contracts.test.js`, `test/workflow.test.js`.
- Source: the two reviewer reports saved as `review/code-quality.md` in the evidence directory of the next candidate.
- Implements: R-03, R-05, R-06, R-07, R-08, R-09 (fixes within the PRD's scope; no new behavior)

## Requirements
- Guard: `.pincer/runtime/` and `.pincer/backups/` are protected; `.pincer/drafts/` is writable; payloads cover both.
- Lock reclaim: a stale lock is claimed by renaming it before removal; the owner is re-read after the claim; only the claimant removes it.
- `recover`: waits up to the grace period for an orphaned group after SIGTERM and escalates to SIGKILL before exiting; the recorded limitation says what was sent.
- `latestAttempt`: no fallback when the index points at a missing record; readiness reports `EVIDENCE_MISSING`; `done` refuses.
- Contract: a partially applied migration is completed by apply (not a conflict); "Platform limits" says the CI matrix is the target and names what was run for this candidate; `timeout` is capped at 2147483 s and the parser rejects larger values.
- `ready` (candidate): unfinished tickets are `EVIDENCE_MISSING` with the lifecycle state in the detail.
- Sanitizer: `Authorization: Basic|Token|Digest <value>` redacted; quoted values redacted to the closing quote; inline-secret refusal matches assignments after a word boundary anywhere in the line and still allows `$VAR`, `"$VAR"`, `$(…)` and backtick references.
- Export: stub ids must be `C-NN`; authored artifact paths must pass `unsafePath` and live under the evidence directory before any write.
- Dry-run checklist: legacy-only code boxes labelled, migrated equivalents present; narrow and code playbooks commit `.gitignore` with the binding; `build-plugin.sh` rewrites `scripts/pincer-runtime/` too; `doctor` notes obsolete kit files (`scripts/pincer-ticket-lib.sh`) and the README update notes say it can be deleted; packet counts the contract clarifications correctly; trial record attributes operator-audit observations and records the A7 wording slip.
- Assertions for every runtime fix; wording assertions for the playbook and checklist changes; generated outputs regenerated.

## Acceptance Criteria
- [x] Every runtime finding has a failing-before, passing-after assertion.
- [x] Contract, playbooks, checklist, README, packet and trial record agree with the code.
- [x] `npm test` passes and generators produce no diff.

## Verification
Proves: the review findings are fixed and pinned; regression: a draft write blocked by the guard, a stolen lock in the reclaim race, a missing pointed-at record reported as a pass, a Basic credential leaking, or stale generated output.
```bash
node test/hooks.test.js && node test/runtime-state.test.js && node test/runtime-runner.test.js && node test/runtime-lifecycle.test.js && node test/runtime-evidence.test.js && node test/runtime-parse.test.js && node test/contracts.test.js && node test/workflow.test.js && npm test && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- No new behavior beyond the findings; the installer does not delete files.
