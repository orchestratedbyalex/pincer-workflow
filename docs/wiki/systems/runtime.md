# runtime — template/scripts/pincer-runtime.cjs and pincer-runtime/

The Node runtime introduced by PRD v4 (2026-09-11, T-29..T-43, branch `feat/prd-v4`).
Dependency-free CommonJS, Node ≥18, the only writer of ticket lifecycle state, of
attempts under `.pincer/runtime/`, of change bindings under `.prd/changes/` and of
exported candidate evidence. `pincer-ticket.sh` and `pincer-status.sh` are thin
wrappers that `exec node …/pincer-runtime.cjs "$@"`; `pincer-ticket-lib.sh` is gone.
Contract: `template/docs/runtime-contracts.md` (pinned by `test/contracts.test.js`).
Decision: [[runtime-owned-verification]]. Extends [[ticket-state-machine]],
[[candidate-evidence]], [[evidence-validator]].

## Modules (template/scripts/pincer-runtime/)

- `parse.cjs` — the grammar port of the old awk validators (same diagnostics),
  `verificationCommands`, `unticked`, `legacyBlockHash` (12-hex parity with the Bash
  receipts), normalizations (`normalizeTicket` strips `status/started/finished/
  verified/last_check` and checkbox marks; `normalizePrd` strips `status`),
  `ticketDigest`, `prdDigest`, `checkDigest(text, timeout)`, optional `timeout`
  frontmatter field (default 600 s, part of the check identity).
- `identity.cjs` — `.prd/changes/<id>.json` binding (schema 1), `register`
  (`--replace`, `--rebind`, `--authorization`), `loadBinding` with codes
  `CHANGE_REQUIRED|AMBIGUOUS|MALFORMED|UNSUPPORTED_SCHEMA|REVISION_CHANGED`;
  `writeBinding` adds `.pincer/` to `.gitignore` (T-43).
- `source.cjs` — source manifest schema 1: `git ls-files --cached --others
  --exclude-standard`, modes, deletions, ticket/PRD normalization, fixed exclusions
  (`.git/ .pincer/ NOTES.md .prd/evidence/ .prd/changes/`), `.prd/source-exclude`
  (untracked paths only), `SECRET_PATH` for `.env`/`.env.*`, symlinks and submodules
  refused, content-addressed manifests under `.pincer/runtime/manifests/`.
- `state.cjs` — index (`sequence`, `current[key]`, `running[]`), attempt records,
  `mkdir` lock with owner.json (stale reclaim on dead pid, live/foreign never stolen,
  `PINCER_LOCK_WAIT_MS`), journal + rename writes, `recover` (finalizes dead-owner
  running attempts as `interrupted`, records the digests of the logs they captured,
  kills orphaned child groups, removes stray journal files; never promotes to passed),
  `validateAttempt(record, key, pointedId)` (record schema 1 + context identity +
  pointer id; T-45/T-46; `interrupted` may lack digests) and
  `inspectArtifacts(root, attempt)` (marks `missing`/`altered` logs by digest; T-45).
- `runner.cjs` — `runAttempt`: running record first (supersedes readiness), snapshot
  before/after, `bash -eo pipefail -c` in its own process group, bounded (1 MiB)
  sanitized streaming capture echoed to the terminal, timeout SIGTERM→SIGKILL after
  5 s sent to the whole group even after the shell exited, capture abandoned 2 s after
  SIGKILL (`DRAIN_MS`; T-45), SIGINT/SIGTERM → `interrupted` (130), mutation → `error`
  `SOURCE_CHANGED`.
- `sanitize.cjs` — redaction patterns (bearer first, then key/secret/password/token
  assignments with bounded quantifiers, AWS, GitHub, PEM blocks) and
  `inlineSecretLine` (refuses `TOKEN=literal` in a block).
- `readiness.cjs` — the one readiness computation: legacy rules (exact old messages)
  and migrated rules with reason codes; validates the attempt record and its context
  key before honoring any outcome (T-45).
- `status.cjs` — human report line-for-line as v0.4.1 plus `Runtime`, `Provenance`,
  `Local` lines; `notes_current` port; status JSON schema 1; newer same-source
  nonpassing candidate attempts block until re-export; fresh clone = `local
  verification history unavailable`.
- `lifecycle.cjs` — `start/verify/done/bind` in both modes (`fmSet`/`fmUnset` port);
  migrated `done` consumes the current passing attempt, never re-runs.
- `migrate.cjs` — preview/apply/backups (`.pincer/backups/<ts>/`), legacy receipts
  into `legacy_receipts`, idempotent, conflicts fail closed.
- `evidence.cjs` — schema 1 validator (moved from `pincer-evidence.cjs`) plus schema 2
  (`change`, `provenance`, `attempt`, log digest = `attempt.log_sha256`) and
  `exportEvidence` (draft + attempts → manifest); `pincer-evidence.cjs` is the CLI.
- `fsutil.cjs` — `atomicWrite`, `readJson`, `git`/`tryGit`.

## Commands and exit codes

`validate`, `register`, `snapshot`, `status [--json]`, `ready [T-NN]`, `start`,
`verify`, `done`, `bind`, `recover`, `migrate --preview|--apply`, `check C-NN
--candidate <sha> -- <cmd>`, `evidence export`. Exit 0 ok · 1 failed/not ready/refused
· 2 usage · 3 busy · 4 invalid input/state · 124 timed out · 130 interrupted.

## Gotchas

- Modes are per PRD: a binding whose `prd` names the ticket's PRD → migrated;
  otherwise legacy (receipts in the ticket, no `.pincer/` writes). Migrated
  `verify` never touches tracked files; `done` writes `status`/`finished` once.
- A check that writes untracked non-ignored files ends `error` (`SOURCE_CHANGED`)
  unless the paths are ignored or in `.prd/source-exclude` (untracked only).
- A kit update inside a migrated project is a source change: every done ticket's
  attempt becomes `SOURCE_CHANGED` until re-verified (trial finding 2).
- `check`/`evidence export` need HEAD = candidate or an evidence-only descendant, and
  a tree dirty only in `NOTES.md` / the candidate's evidence dir. The draft lives
  outside the evidence dir (`.pincer/drafts/<sha>.json`).
- The sanitizer's first version hung on a 64 KB line (quadratic regex); quantifiers
  are bounded now. Keep them bounded.
- Readiness guards used to be `attempt.x && …`, so a record stripped to
  `{id, outcome}` passed (external review of 77c5205). Every new field the runner
  writes that readiness or export reads must be added to `state.validateAttempt`;
  a finished record needs `finished` and 64-hex artifact digests (except
  `interrupted`, for records an old `recover` finalized), so any path that
  finalizes a record (runner, `recover`) must set them. The record must also carry
  the id `index.current[key]` names (a copied record is `ATTEMPT_ERROR`, T-46).
- A `setsid` descendant is unreachable: the run is abandoned 2 s after the SIGKILL
  point, `timed_out`, and the limitation says no reachable process remained (T-46).
  `test/runtime-runner.test.js` uses perl for that case; it must exist on CI.
- A check that exits 0 leaving a background child holding the pipes is `timed_out`,
  not `passed`; daemons started by a check must be detached from the group's pipes.
- Tests: `test/runtime-{parse,identity,state,status,runner,lifecycle,migrate,evidence}
  .test.js`, `test/contracts.test.js`; `test/distribution.test.js` compares runtime
  digests across layouts and the plugin and exercises the installed copies.
  `test/fixtures/`: `local-service.cjs`, `hold-lock.cjs`, `grandchild.sh`.
- The repo itself is NOT migrated (PRD v4 §9 dogfooding); its own tickets used the
  pinned v0.4.1 kit from `1cb5ab4` in the session scratchpad.

## PRD v5 additions (feat/prd-v5, 2026-09-11, T-47..T-56)

Changes mode (schema 2 records under `.prd/changes/`) sits next to legacy and migrated
(v0.5.0 schema 1 binding) modes; `identity.loadBinding` returns `CHANGES_MODE` and
callers branch. Contract: `template/docs/runtime-contracts.md` sections "Change
records" … "Worktrees", pinned by `test/change-contracts.test.js`.

- `transaction.cjs` — `run(root, {command, hooks}, fn)`: lock, `recoverPending`,
  `ctx.read/text/write/expect/idle/refuse`, staging under `journal/txn-*/` with a
  `manifest.json` commit point, idempotent redo; `pending()` for read-only
  `STATE_INCOMPLETE`; `boundedText` (2000 chars). `state.recover` calls
  `recoverPending` first.
- `changes.cjs` — record validation (`validateRecord`, projection `replay`), `scan`
  (mode), `loadRecords` (ownership, supersession chains, snapshot verification,
  pending txn), `register` (schema 2), selection (`readSelection`, `select`,
  `resolveSelected` with `--change`), `view` (HEAD/branch/base ancestry/dirty),
  `ticketOwner`, list/show rendering.
- `agreement.cjs` — projection version 1, `compute`, snapshots
  `.prd/changes/<id>/agreements/G-NN.json` (`readSnapshot` recomputes digests),
  structural `difference`, `revise`, `appendAgreement`.
- `authorization.cjs` — `verdict` (current | DECISION_REQUIRED |
  AUTHORIZATION_REQUIRED | AGREEMENT_CHANGED), `authorize` (user/delegated, idempotent,
  records G-NN in the same event), `decide` (raise/resolve).
- `transitions.cjs` — the seven lifecycle ops as single transactions; `complete`
  runs `status.render` under the lock for ticket readiness.
- `gates.cjs` — `guard` for start/done/verify/check/export (order: records →
  selection → WRONG_CHANGE → LIFECYCLE_BLOCKED → BASE_MISMATCH → verdict); returns the
  `binding` (with `agreement`, `mode: 'changes'`) that `lifecycle.cjs` and the runner use.
- `locator.cjs` — `.prd/evidence/changes/<id>.json`, appended by `evidence export`;
  `current()` replaces `notesCurrent` in changes mode (same-candidate evidence dirs
  and locators may follow the candidate).
- Attempts: schema 2 in changes mode (`context.agreement`); candidate keys
  `candidate:<change>:<sha>:<C-NN>`; schema 1 records → `HISTORICAL_EVIDENCE`.
- `status.cjs` was split into `gather` + `gatherBody(ctx)` + `gatherChanges`;
  changes-mode JSON is schema 2 (`selection`, `changes`, `change.lifecycle/agreement/
  view`, `candidate.locator/evaluation`).
- Test fixtures: `test/fixtures/txn-writer.cjs`, `change-op.cjs` (crash/hold seams via
  `hooks`), `test/fixtures/prd-v5/` (released v0.5.0 records).
