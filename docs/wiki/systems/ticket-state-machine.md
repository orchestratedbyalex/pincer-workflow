# ticket-state-machine

How a ticket moves `open → in_progress → done`, why "done" is unreachable
without a passing check, and (since M0, 2026-09-05..07) why a receipt stops
counting the moment the check would fail again. Decisions: [[mechanical-done]],
[[revocable-receipts]]. Live evidence: `docs/dry-run-2026-09-08-sonnet.md`.

## Files (all in template/, generated into plugin/ by build-plugin.sh)

- `scripts/pincer-ticket-lib.sh` — shared awk-based helpers, sourced by both
  scripts (installed in `PLATFORM_ROOTS.common`). Frontmatter get/set,
  ticket validation (`status` ∈ open|in_progress|done, `size` ∈ S|M|L, `prd:`
  path exists, acceptance checkbox syntax), `latest_prd`, `ticket_prd`,
  `usable_ticket_prd`, `ticket_readiness` (a done ticket is *ready* only when
  its `last_check` is `passed` with the current block hash), `validate_prd`,
  `notes_current` (NOTES.md frontmatter `prd/base/candidate` must name the
  latest PRD and a candidate that is an ancestor of HEAD, with a clean tree).
- `scripts/pincer-ticket.sh` — the ONLY writer of the state fields.
  - `bind T-NN .prd/prd-vN.md`: sets `prd:` on a legacy ticket.
  - `start T-NN`: needs a usable `prd:` and *ready* dependencies (not merely
    `done`); sets `in_progress`, stamps `started:`.
  - `verify T-NN`: writes `last_check: <ts> running <hash>` first, runs the
    block in a background child with an INT/TERM trap (an interrupted run is
    recorded as `interrupted`, never as passed), re-hashes the block after the
    run, then writes `last_check: … passed <hash>` plus `verified: <ts> <hash>`.
    A failure writes `last_check: … failed <hash>` and **deletes `verified:`**.
  - `done T-NN`: re-runs `verify` unconditionally, then requires zero `- [ ]`
    under Acceptance Criteria; sets `done`, stamps `finished:`. Running `done`
    on an already-done ticket is the re-check: a red run revokes the receipt
    while `status`/`finished` stay as history.
- `scripts/pincer-status.sh` — read-only. Latest PRD + validation, tickets of
  that PRD only (others are counted as `History N ticket(s) associated with
  other PRDs`), readiness WARNs, `Build elapsed` (budget WARN only if
  `PINCER_BUILD_BUDGET_MIN` is set; there is no default budget any more),
  `Notes … current|stale: <reason>`, and a `Next` line: invalid input → repair;
  draft PRD → narrow; failed/stale receipt → code (re-verify); notes stale →
  evaluate; else release. Exits 1 on invalid input.
- `.claude/hooks/hook-policy.cjs` — one Node (≥18) module behind both hooks:
  a shell lexer (`lexShell`, `commandParts` strips env/sudo/command prefixes,
  `gitSubcommand`), `dangerousReason` for block-dangerous (force push in any
  arg order, `reset --hard origin/…`, `rm -rf` on absolute/`~`/`$HOME` paths,
  `chmod 777|a+rwx`, `curl|sh`, `sh -c` nesting, `--dangerously-skip-permissions`),
  and the ticket guard (`stateFields`/`sameState`: Edit/Write/MultiEdit may
  not change `status|started|last_check|verified|finished`; Bash may not write
  to ticket files unless it is an exact `pincer-ticket.sh` call). The old
  jq → python3 → grep fallback is gone; `block-dangerous.sh` and
  `ticket-guard.sh` just exec the module with `node`.
- Tickets carry `prd: .prd/prd-vN.md` and `size:`; NOTES.md frontmatter
  carries full commit IDs for `base` and `candidate`.

## Invariants and gotchas

- Trust lives in the receipt and the status script, not in `status:`. A hand
  edit made outside the editor (hooks cannot see it) is caught by validation:
  `status: pending` made `pincer-status.sh` refuse to give a next action
  (dry run 2026-09-08).
- Reverting a ticket with `git checkout -- tickets/…` from the assistant's
  shell is blocked by the guard; the user runs it in their own terminal.
  Open question whether a restore-to-HEAD should be allowed (finding 5 in the
  dry-run doc).
- Known cosmetic bugs (2026-09-08): failed-attempt WARN printed twice
  (status script line ~75 and `ticket_readiness`); verify failure says "no
  receipt written" although the failure *was* recorded; elapsed line shows on
  a built PRD days later.
- Portable across macOS/Linux as before (`shasum` fallback, two `date`
  forms, temp-file+mv). Repo root = `$CLAUDE_PROJECT_DIR` → git → pwd.
- Tests (`npm test`): `test/validation`, `verification`, `recovery`, `hooks`
  (payload-only, 100+ hook payloads incl. shell-mutation evasions),
  `workflow` (playbook contract regexes), `distribution` (generated parity +
  packed-tarball installs), plus the installer suites. CI matrix in
  `.github/workflows/ci.yml`: ubuntu/macos × Node 18/22.

Related: [[template-kit]], [[cli-installer]], [[distribution-channels]],
[[release-audit-read-only]].
