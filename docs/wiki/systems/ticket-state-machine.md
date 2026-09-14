# ticket-state-machine

How a ticket moves `open → in_progress → done`, why "done" is unreachable
without a passing check, and (since M0, 2026-09-05..07) why a receipt stops
counting the moment the check would fail again. Decisions: [[mechanical-done]],
[[revocable-receipts]]. Live evidence: `docs/dry-run-2026-09-08-sonnet.md`.

## Files (all in template/, generated into plugin/ by build-plugin.sh)

- `scripts/pincer-ticket-lib.sh` — **deleted by T-36** (`203a71a`) when PRD v4 moved
  the lifecycle onto the Node runtime; `bin/pincer.js` now lists it in `OBSOLETE`.
  Everything below describes what it did and where that logic now lives
  (`pincer-runtime/{parse,lifecycle,status,readiness}.cjs` — see [[runtime]]).
  It was the shared awk-based helpers, sourced by both
  scripts (installed in `PLATFORM_ROOTS.common`). Frontmatter get/set,
  ticket validation (`status` ∈ open|in_progress|done, `size` ∈ S|M|L, `prd:`
  path exists, acceptance checkbox syntax), `latest_prd`, `ticket_prd`,
  `usable_ticket_prd`, `ticket_readiness` (a done ticket is *ready* only when
  its `last_check` is `passed` with the current block hash), `validate_prd`
  (status draft|ticketed|built, optional `profile: small|standard`, since v2),
  `prd_profile`, `evidence_validate`/`evidence_reason` (wrap
  [[evidence-validator]]), and `notes_current` (NOTES.md `prd/base/candidate`
  must name the latest PRD and a candidate that is an ancestor of HEAD, plus —
  since PRD v2 — an `evidence:` manifest that validates for that candidate,
  all listed files tracked, and only NOTES.md + listed files changed after the
  candidate; see [[candidate-evidence]]).
- `scripts/pincer-ticket.sh` — the ONLY writer of the state fields.
  - `bind T-NN .prd/prd-vN.md`: sets `prd:` on a legacy ticket.
  - `start T-NN`: needs a usable `prd:` and *ready* dependencies (not merely
    `done`); sets `in_progress`, stamps `started:`.
  - `verify T-NN`: writes `last_check: <ts> running <hash>` first, runs the
    block in a background child with an INT/TERM trap (an interrupted run is
    recorded as `interrupted`, never as passed), re-hashes the block after the
    run, then writes `last_check: … passed <hash>` plus `verified: <ts> <hash>`.
    A failure writes `last_check: … failed <hash>` and **deletes `verified:`**.
  - `done T-NN` (**legacy mode only** — migrated and changes modes consume the
    current passing attempt and never re-run, see [[runtime-owned-verification]]):
    re-runs the check, then requires zero `- [ ]`
    under Acceptance Criteria; sets `done`, stamps `finished:`. Not unconditional
    and not in that order — `doneLegacy` refuses before running anything when there
    is no `verified:` receipt or when the receipt hash does not match the current
    check block. Running `done`
    on an already-done ticket is the re-check: a red run revokes the receipt
    while `status`/`finished` stay as history.
- `scripts/pincer-status.sh` — read-only. Latest PRD + validation, tickets of
  that PRD only (others are counted as `History N ticket(s) associated with
  other PRDs`), the PRD line with `profile:`, readiness WARNs (one per
  distinct problem: done tickets report only via `ticket_readiness`),
  `Build wall-clock elapsed …` only while a ticket is in progress or
  `PINCER_BUILD_BUDGET_MIN` is set (no default budget), `Notes … current|stale:
  <reason>`, `Evidence <manifest> · ok|<reason>` when NOTES.md names one, and a
  `Next` line: invalid input → repair; draft PRD → narrow; failed/stale receipt
  → code (re-verify); notes stale → evaluate; else release. **Exits 4 on invalid
  input** (0 when inspection succeeded); `ready` is the one that exits 1, for
  non-ready work.
- `.claude/hooks/hook-policy.cjs` — one Node module behind both hooks (the kit's
  floor is Node 22+; README says so for the plugin's structured hook parser):
  a shell lexer (`lexShell`, `commandParts` strips env/sudo/command prefixes,
  `gitSubcommand`), `dangerousReason` for block-dangerous (force push in any
  arg order, `reset --hard origin/…`, `rm -rf` on absolute/`~`/`$HOME` paths,
  `chmod 777|a+rwx`, `curl|sh`, `sh -c` nesting, `--dangerously-skip-permissions`),
  and the ticket guard (`stateFields`/`sameState`: Edit/Write/MultiEdit may
  not change `status|started|last_check|verified|finished`; Bash may not write
  to ticket files unless it is an exact `pincer-ticket.sh` **or
  `pincer-runtime.cjs`** call — `isExactPincerCall` allows the verbs start, verify,
  done, bind, register, migrate, recover, check and evidence, which is why T-81's
  redirection hole mattered, see below). The old
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
  shell is blocked by the guard on purpose (decided in PRD v2, R-06): restoring
  HEAD would erase a newer failed attempt and revive an old passing receipt.
  The code playbook's "Recovering a ticket file" section says: preserve the
  malformed contents, report the error, the user repairs in their own
  terminal, then fresh `verify`. `test/recovery.test.js` covers the guard
  after a failed recheck.
- The 2026-09-08 cosmetic bugs are fixed (T-17): one WARN per problem; verify
  failure says "failure recorded in last_check … prior successful receipt was
  revoked"; elapsed line only while active or budgeted.
- `test/behavioral-verification.test.js` (T-12) is the R-02 acceptance set:
  three controlled faults keep every identifier and must fail a behavioral
  check while an identifier grep still passes; each in a fresh fixture.
- Portability is now the Node runtime's problem: the `shasum` fallback and the two
  `date` invocation forms went with the Bash library in T-36 (neither appears under
  `template/` any more). Repo root = `$CLAUDE_PROJECT_DIR` → git → pwd.
- Tests (`npm test`): `test/validation`, `verification`,
  `behavioral-verification`, `evidence` (validator failure classes),
  `candidate` (notes_current change classes, read-only audit), `recovery`,
  `hooks` (payload-only, 100+ hook payloads incl. shell-mutation evasions),
  `workflow` (playbook contract regexes, incl. the byte-identical shared
  authorization block), `distribution` (generated parity + packed-tarball
  installs), plus the installer suites. `test/helpers.js` has `writeEvidence`
  and `writeNotes` fixtures. CI matrix in `.github/workflows/ci.yml`:
  ubuntu-latest/macos-latest × Node 22/24.
- **The guard ignored redirection until T-81** (2026-09-13). `isExactPincerCall()`
  decided a single runtime command with no separator was trusted and short-circuited
  the shell-mutation check *without looking at the command's redirection operators*,
  so `node scripts/pincer-runtime.cjs <allowlisted verb> > <protected path>` was
  allowed — `evidence export > tickets/T-01.md` and `register >
  .prd/changes/<id>.json` among them. PRD v5 widened the hole twice by allowlisting
  `change` and `resume`, the two read-only reporters an agent naturally redirects into
  a file. Any future allowlist addition has to be considered together with what a
  redirect of it could overwrite.
- Guard false positive to know about: a compound
  `git add <protected path> && git commit -m "$(cat <<'EOF' … <email> EOF)"` is refused
  because the lexer reads the `<…>` inside the heredoc as a redirect next to a
  protected path. Split the add and the commit.

Related: [[template-kit]], [[cli-installer]], [[distribution-channels]],
[[release-audit-read-only]].
