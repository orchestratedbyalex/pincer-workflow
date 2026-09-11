---
ticket: T-36
status: open
size: L
prd: .prd/prd-v4.md
depends_on: [T-33, T-35]
---

## Objective
Move `start`, `verify`, `done` and `bind` onto the runtime for both modes, make `pincer-ticket.sh` a compatibility wrapper, retire the Bash policy library, and teach the guard the runtime's paths, so closure consumes a current passing attempt without rewriting receipts.

## Context
- Relevant files: `template/scripts/pincer-runtime.cjs` (`start`, `verify`, `done`, `bind`), new `template/scripts/pincer-runtime/lifecycle.cjs`, `template/scripts/pincer-ticket.sh` (wrapper), `template/scripts/pincer-ticket-lib.sh` (deleted), `template/.claude/hooks/hook-policy.cjs` (`isExactPincerCall` accepts exact `pincer-runtime.cjs` lifecycle and migration calls; shell writes under `.pincer/` and `.prd/changes/` are blocked; Edit/Write to `.prd/changes/*.json` is blocked), `scripts/build-plugin.sh` and `bin/pincer.js` (file lists; T-40 finishes packaging), tests `test/ticket.test.js`, `test/validation.test.js`, `test/verification.test.js`, `test/recovery.test.js`, `test/candidate.test.js`, `test/hooks.test.js` (all must pass), new `test/runtime-lifecycle.test.js`.
- PRD section: R-06, R-02 (wrappers, no separate readiness), R-01 (migrated behavior: retain failure, record repaired pass), 6 step 5.
- Implements: R-06 (S-18, S-19, S-20), R-02, R-01 (S-01 after migration)

## Requirements
- Legacy mode (no binding for the ticket's PRD) reproduces today's behavior byte for byte where tests pin it: `start` dependency checks and `prd:` association, `verify` writes `last_check … running`, then `passed`/`failed`/`interrupted` and `verified`, `done` re-runs the check and stamps `finished`, `bind` sets `prd:`; diagnostics keep their wording. Execution goes through the runner (capture in memory, no `.pincer/` writes in legacy mode).
- Migrated mode: `start` writes `status: in_progress` and `started` (once) after the same dependency and readiness checks, where a dependency is ready when its latest attempt passed against current inputs. `verify` creates an attempt and touches no tracked file. `done` requires `in_progress` or `done`, a latest attempt for the ticket that `passed`, whose `ticket_digest`, check digest and source digest equal the current ones, no unticked criteria, and a validated ticket; it then writes `status: done` and `finished` once and prints the commit hint. On a current done ticket, `done` is read-only and idempotent. Every refusal names the reason code and the next step (`verify`, tick criteria, `migrate`, `recover`). Legacy `verified`/`last_check` fields present on a migrated ticket are ignored for readiness, reported as `LEGACY_RECEIPT`, and never consulted by `done`.
- `pincer-ticket.sh` delegates every call to `node <dir>/pincer-runtime.cjs "$@"` with the usage text preserved and a Node 18+ requirement message; `pincer-ticket-lib.sh` is removed from the template, the installer list and the plugin build.
- Guard: exact `node scripts/pincer-runtime.cjs <start|verify|done|bind|register|migrate|recover|check> …` calls (also `pincer-runtime.cjs` invoked directly) are allowed as writers; any other shell form writing, deleting or restoring under `.pincer/` or `.prd/changes/` is blocked with a message naming the runtime; Edit/Write/MultiEdit on `.prd/changes/*.json` is blocked. Existing 233 payload expectations stay green; new payloads cover the additions.
- Tests (`test/runtime-lifecycle.test.js`, added to `npm test`): S-18 on a registered fixture, two successful `verify` runs create two attempts and `git status --porcelain` shows nothing; `done` closes without launching the check again (a counter file written by the check proves the run count); S-19 stale inputs, a later failure, a missing log file, a deleted `.pincer/runtime`, and an unticked criterion each block `done` with the code and next step; S-20 deleting `.pincer/runtime` on a ticket that still carries a legacy `verified` line does not make it ready, and a fresh clone (`git clone` of the fixture) reports the candidate evidence separately and requires `verify` before `done`; S-01 migrated: inject a source regression, `verify` fails, revert the source, `verify` passes, both attempts are retained, and no tracked file changed.

## Acceptance Criteria
- [ ] Every existing lifecycle, validation, verification, recovery, candidate and hook test passes through the wrapper with the Bash library deleted.
- [ ] Migrated closure consumes the current pass without a duplicate run, refuses every S-19 case with a next step, and repeated `done` is idempotent; S-20 holds.
- [ ] `npm test` passes with the new suite.

## Verification
Proves: one policy implementation serves both modes, receipts stop rewriting tracked files after migration, and closure is bound to current inputs; regression: a tracked diff after `verify`, a duplicate run on `done`, a legacy receipt revived by deleting local state, or a Bash policy path left behind.
```bash
node test/runtime-lifecycle.test.js && npm test && ! test -e template/scripts/pincer-ticket-lib.sh && grep -q 'pincer-runtime.cjs' template/scripts/pincer-ticket.sh
```

## Constraints
- Do not migrate this repository; its own tickets keep using the pinned v0.4.1 kit.
- Keep the diagnostics that tests match verbatim.
