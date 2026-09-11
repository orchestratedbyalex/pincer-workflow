# Code-quality review — PRD v4 candidate 7b561b1 (base 6771fbc)

Two general-purpose subagents applied `template/.claude/agents/code-quality-reviewer.md`
in parallel: one over the runtime code and tests, one over docs, playbooks, installer,
packaging and records. Both ran `npm test` read-only (21 suites green) and modified
nothing. Findings are numbered as reported; dispositions were assigned by the evaluator
and every fix went through T-44 into candidate 2 (see NOTES.md).

## Runtime code and tests

1. `template/.claude/hooks/hook-policy.cjs` — `RUNTIME_PATH` matched every path under `.pincer/`, so the guard blocked writing the evidence draft at the documented `.pincer/drafts/<sha>.json` (Write payload exit 2, `>` redirect exit 2). High. **Fixed in T-44:** the guard now protects `.pincer/runtime/` and `.pincer/backups/` only; hook payloads added.
2. `state.cjs` — stale-lock reclaim was a check-then-remove race: two waiters reading the same dead owner could both remove and re-create the lock. Medium. **Fixed in T-44:** the reclaimer first renames the stale directory to a private name (atomic claim) and only the renamer removes it after re-reading the owner.
3. `state.cjs` / `pincer-runtime.cjs` — `recover` scheduled SIGKILL on an unref'd timer and exited first, while the record claimed "SIGKILL after 5 s". Medium. **Fixed in T-44:** `recover` waits up to the grace period for the orphaned group to die and escalates synchronously; the limitation text states what was sent.
4. `state.cjs` — `latestAttempt` fell back to the highest sequence on disk when the record the index pointed at was missing, which could turn a failed pointer into an older pass. Medium. **Fixed in T-44:** a missing pointed-at record is reported as `EVIDENCE_MISSING` (no fallback when the pointer exists); test added.
5. `migrate.cjs` vs contract — the contract listed a partially applied migration as a conflict while the code completes it. Medium (contract disagreement). **Fixed in T-44:** the contract now says apply completes a partial migration; the fixture test already pinned that behavior.
6. `pincer-runtime.cjs` `ready` (candidate) — `in_progress` was reported as `ATTEMPT_RUNNING` and `open` as `DEPENDENCY_BLOCKED`. Low. **Fixed in T-44:** unfinished tickets are reported as `EVIDENCE_MISSING` with the lifecycle state in the detail.
7. `sanitize.cjs` — `Authorization: Basic …` and quoted values with spaces leaked past the first whitespace. Medium. **Fixed in T-44:** `basic|token|digest` schemes join the bearer rule and quoted values are redacted to the closing quote; tests added.
8. `sanitize.cjs` — the inline-secret refusal was anchored at line start, so `env TOKEN=x cmd` passed. Low. **Fixed in T-44:** the pattern matches an assignment after a word boundary anywhere in the line; `$(…)` and backtick references are allowed.
9. `runner.cjs` — a `timeout` above 2,147,483 s overflowed `setTimeout`. Low. **Fixed in T-44:** the grammar caps `timeout` at 2147483 seconds (contract updated).
10. `evidence.cjs` export — draft check ids and authored artifact paths were used before validation. Low. **Fixed in T-44:** stub ids must match `C-NN` and artifact paths pass `unsafePath` and evidence-directory containment before any file is written.

Verified by the reviewer (unchanged): exit codes, reason codes, fixed exclusions and secret rule, capture cap, lock semantics apart from finding 2, `recover` never promotes, legacy mode writes nothing under `.pincer/`, no vacuous assertions, argv-array spawning. Noted, not flagged: `MIGRATION_REQUIRED` is documented but never emitted (status reports `LEGACY_RECEIPT`); recorded as a known issue.

## Docs, playbooks, installer, packaging, records

1. `template/docs/dry-run-checklist.md` — the code-stage boxes assumed legacy receipts although narrow now registers every fresh project. Medium. **Fixed in T-44:** legacy-only boxes are labelled, migrated equivalents added.
2. `pincer-narrow.md`, `pincer-code.md` — the `Register PRD vN` commit omitted the `.gitignore` write `register` performs. Medium. **Fixed in T-44.**
3. `runtime-contracts.md` — "Tested platforms are the CI matrix" was not yet true for this branch. Medium. **Fixed in T-44:** worded as the matrix CI targets; the packet states CI has not run on the branch.
4. `bin/pincer.js` — `update` from 0.4.1 leaves `scripts/pincer-ticket-lib.sh` on disk, unmanaged and invisible to `doctor`. Low. **Fixed in T-44:** `doctor` notes obsolete kit files; README update notes say the file can be deleted; removal by the installer stays a known issue (open thread).
5. `README.md` — named the release v0.5.0 while the documented flow is `npm version patch`. Low. **Disposition:** the runtime is a minor bump; NOTES.md records that the bump must be `minor` (0.5.0). Wording kept.
6. `docs/prd-v4-review-packet.md` — "Two contract clarifications" listed four. Low. **Fixed in T-44.**
7. `docs/trial-2026-09-11-prd-v4.md` — some observations rest on the operator's on-disk audit rather than the session logs; the A7 log's "stamped a fresh receipt" wording slip was not noted. Low. **Fixed in T-44:** rows attributed; the slip recorded as finding 5.
8. `scripts/build-plugin.sh` — the transform rewrote `scripts/pincer-runtime.cjs` but not `scripts/pincer-runtime/`. Low. **Fixed in T-44.**

Verified by the reviewer (unchanged): traceability rows resolve to real files and labels; trial claims are supported by the logs where logs exist; playbook commands match the CLI usage; installer, plugin build and distribution test agree on the runtime file set; generators produce no diff; README and site limit claims to the tested surface.
