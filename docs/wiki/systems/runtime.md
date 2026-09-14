# runtime — template/scripts/pincer-runtime.cjs and pincer-runtime/

The Node runtime introduced by PRD v4 (2026-09-11, T-29..T-43, branch `feat/prd-v4`).
Dependency-free CommonJS, Node ≥22 (`engines` raised in `e07faca`; 18 and 20 are end of
life, and the raise did not fix the truncation it was credited with — T-79), the only
writer of ticket lifecycle state, of
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
  pinned released **v0.5.0** kit (tag `v0.5.0`) in the session scratchpad. v0.4.1 from
  `1cb5ab4` was the rule while PRD v4 was being built; PRD v5 and v6 both moved it to
  v0.5.0 and both forbid migrating this repository mid-implementation.

## PRD v5 additions (feat/prd-v5, 2026-09-11/12, T-47..T-65)

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
  For `verify`/`check` the guard runs twice: `runner.runAttempt({ revalidate, announce })`
  calls `revalidate()` under the worktree lock right before the `running` record is
  written and takes the context from it (T-63, review finding 1: a `change pause`
  committed between the pre-lock guard and the lock used to let a verification pass);
  `announce` prints the header only once the record exists so refusals stay silent.
  Race seam: `test/fixtures/attempt-race.cjs <root> <injected args> -- <command>`
  wraps `runner.runAttempt` to run an injected runtime command first.
- `locator.cjs` — `.prd/evidence/changes/<id>.json`, appended by `evidence export`;
  `current()` replaces `notesCurrent` in changes mode. `followers(root, candidate)`
  is the computed set of paths that may differ from the candidate: `NOTES.md`, valid
  locators, and the listed files of manifests that validate (with digests) for that
  candidate; never a directory or filename pattern (T-64, review finding 2: an
  unlisted `.js` under another PRD's evidence dir plus a malformed locator left
  `ready` at 0). `requireCandidateView` (check/export) adds only the PRD's own
  `.prd/evidence/prd-vN/<candidate>/` while it is assembled.
- Attempts: schema 2 in changes mode (`context.agreement`); candidate keys
  `candidate:<change>:<sha>:<C-NN>`; schema 1 records → `HISTORICAL_EVIDENCE`.
- `status.cjs` was split into `gather` + `gatherBody(ctx)` + `gatherChanges`;
  changes-mode JSON is **schema 3** (`gather()` sets it whenever the mode is changes)
  (`selection`, `changes`, `change.lifecycle/agreement/
  view`, `candidate.locator/evaluation`).
- Test fixtures: `test/fixtures/txn-writer.cjs`, `change-op.cjs` (crash/hold seams via
  `hooks`), `test/fixtures/prd-v5/` (released v0.5.0 records).
- `resume.cjs` — `resume [--change] [--json]`: the fresh-session report (change, view,
  agreement, references, tickets, attempts, candidate, authored handoff labeled
  `authored: true`, blockers, one `next` with `rule` 1–8). The handoff reason/note are
  shown while paused and cleared by `change resume`.
- `migrate.cjs` (rewritten) — sources: legacy tickets, v0.5.0 binding, an existing
  record; one transaction; backups under `.pincer/backups/<ts>/` include the binding
  and `index.json`; pointer rewrite `candidate:<sha>:C-NN` → `candidate:<id>:<sha>:C-NN`;
  the migrated change is `planned`/unauthorized; the binding's free text becomes
  `legacy.authorization_text` (unvalidated). `bin/pincer.js doctor` reports
  "migration to change records available". Rollback is one procedure per source
  (T-65, review finding 3): from a binding, restoring the backup overwrites the
  record at the same path (never delete it afterwards), restore `index.json`, remove
  the selection, keep attempts; from legacy, restore tickets/.gitignore, delete the
  record, remove `.pincer/`.
- Gate order pinned by `gates.ORDER`: `INPUT_INVALID … STATE_INCOMPLETE →
  SELECTION_REQUIRED/INVALID → WRONG_CHANGE → LIFECYCLE_BLOCKED → BASE_MISMATCH →
  DECISION_REQUIRED → AUTHORIZATION_REQUIRED → AGREEMENT_CHANGED`. An unreadable
  *selected* record refuses execution as `SELECTION_INVALID` (exit 1) naming
  `HISTORY_INVALID`; inspection of it exits 4 (review packet deviation 6).
- Crash semantics (`change-op.cjs --crash <point>`): before `manifest` the old state is
  intact and status is normal (the journal is discarded by the next transaction or
  `recover`); at `manifest`/`rename:0` status exits 4 `STATE_INCOMPLETE` and `recover`
  completes the transition; at `cleanup` nothing is pending.
- Review material: `docs/prd-v5-review-packet.md` (traceability R-01..R-10 / S-01..S-32
  with `S-NN` tags in the test sources), `docs/prd-v5-artifacts/replay.sh <case>`
  (eight executable review cases on a scratch project built from `template/`; run by
  `test/change-review-packet.test.js`), `docs/prd-v5-artifacts/records/` (sanitized
  change record, agreement snapshots, blocked/current resume JSON), `docs/trial-prd-v5.md`
  + `docs/prd-v5-artifacts/trial-logs/` (validated by `test/change-trial-record.test.js`).
- Playbook rule from the trial (T-62): an `AGREEMENT_CHANGED` the session did not cause
  is raised with `change decide` and the agent stops; a generic "continue" never
  authorizes new scope. Residual: Sonnet still recorded an A-02 from the generic
  instruction before raising the decision (runtime blocked on the open decision).

## Evaluation fixes (feat/prd-v6, 2026-09-13, T-79..T-86)

Eight tickets closing the defects the v5+v6 evaluation confirmed. They are runtime
behaviour, not v6 features — [[strict-coverage]] covers what v6 added.

- `io.cjs` (T-79) — **every CLI write goes through `io.out`/`io.err`, which write the
  file descriptor synchronously.** `process.stdout` is asynchronous when it is a pipe
  and the CLI uses `process.exit()` as its return statement, so before this any report
  larger than one pipe buffer was truncated at exactly 65,536 bytes and still exited 0
  with an empty stderr — `snapshot --json` is 237 KB here and arrived as 64 KB of
  invalid JSON. Identical on Node 18, 20, 22 and 24, so the `engines: >=22` raise in
  `e07faca` did not fix it and the contract sentence that commit added is withdrawn.
  `EAGAIN`/`EINTR` retry; `EPIPE`/`EBADF` return silently so `pincer status | head -3`
  and `… 1>&-` stay quiet and keep their own exit code. `test/runtime-output.test.js`
  asserts nothing outside `io.cjs` writes to a standard stream.
  **Do not "fix" an exit path by turning `process.exit(N)` into `process.exitCode = N`:**
  the exits are the CLI's return statements and the code below each one is the next
  branch of the same function, several of which write.
- `routing.cjs` (T-80) — rules 2 and 3 of the next-action precedence in one module;
  any new report that renders a next action must consume it. See
  [[one-next-action-precedence]].
- Ticket guard (T-81) — `isExactPincerCall()` short-circuited the shell-mutation check
  without looking at redirection operators, so
  `node scripts/pincer-runtime.cjs <allowlisted verb> > <protected path>` was allowed.
  v5 widened it by allowlisting `change` and `resume` — the two read-only reporters an
  agent naturally redirects into a file. See [[ticket-state-machine]].
- `transaction` guard in migrated mode (T-85) — `identity.loadBinding` now consults
  `transaction.pending` and `runner.runAttempt` calls `transaction.recoverPending`
  before taking the lock. Before this, a killed `migrate --apply` left execution
  unguarded and the `recover` that `status` itself recommended destroyed everything
  done since, without warning. Changes mode always had the guard; migrated mode is the
  mode `migrate --apply` runs in, so it was the only mode that could lose work.
- Schema 3 validation (T-83) — three false `ok`s closed in the independent validator:
  a scenario whose linked check is absent from the map snapshot was vacuously
  `delivered`; an unreadable PRD blob was reported "not available in this repository"
  (false when the commit is present) and took the reconciliation down with it; a
  deferred/removed row's `authorization` was shape-checked but never resolved in the
  candidate's committed change record. See [[evidence-validator]].
- `parse.cjs` scenario continuation (T-84) — a blank line inside a scenario list item
  ended its continuation, so later paragraphs were attributed to the parent
  requirement. Inverting such a paragraph left the scenario digest unchanged, and
  `impact` then reported the scenario and its linked tickets and checks as unaffected.
- Packet validators (T-86) — each packet suite had the check the other had dropped:
  the v5 ticket-commit loop asserted no minimum match count and never tied a commit to
  its ticket (rewriting all nineteen citations to the base commit still passed), and
  the v6 suite asserted a total citation count across all thirty scenario rows rather
  than one per row (so a scenario could cite no suite at all).
- Trial record (T-82) — six statements the 42 saved `record.json` files do not support
  were corrected, including the escaped-regression claim, the undisclosed ambient agent
  configuration both arms ran under, and two runs whose recorded minutes exceed the
  tool's own session duration. See [[delivery-benchmark]].
