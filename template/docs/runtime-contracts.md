# PINCER Runtime Contracts

The runtime is `scripts/pincer-runtime.cjs` with its modules under
`scripts/pincer-runtime/`. It is dependency-free CommonJS for Node.js 22+ and is the
only writer of ticket lifecycle state, verification attempts, change records and
their lifecycle, the local selection, evaluation locators and exported candidate
evidence. The shell entry points `scripts/pincer-ticket.sh` and
`scripts/pincer-status.sh` are compatibility wrappers that delegate to it. This
document is the contract the runtime implements; tests pin it, and a change to a
contract updates this file in the same commit as the code.

Schema numbers in this document are independent of the package version. The v0.5.0
records are `schema: 1` (bindings, attempts, manifests, index, status) with evidence
`schema: 2`; the runtime recorded its contract version as `runtime: 1`. The change
lifecycle introduced by PRD v5 uses change records `schema: 2`, attempts `schema: 2`,
status JSON `schema: 2`, and the runtime records its contract version as `runtime: 2`.
Selection, agreement snapshot, evaluation locator, transaction manifest and resume
JSON records start at `schema: 1`. A record whose schema this runtime does not read is
refused as `UNSUPPORTED_SCHEMA`; an older runtime refuses the newer schemas the same
way and never interprets several change records through its single-binding logic.
Strict coverage (PRD v6, "Strict coverage") adds change records `schema: 3`, attempts
`schema: 3`, evidence `schema: 3`, status JSON `schema: 3`, resume JSON `schema: 2`,
agreement projection version 2 with snapshots `schema: 2`, the coverage map `schema: 1`
and the runtime contract version `runtime: 3`; a v0.5.0 or PRD v5 runtime refuses every
one of them, and this runtime keeps reading the older schemas unchanged.

## Modes

A project is in exactly one of three modes, decided by the files under
`.prd/changes/`. Nothing switches modes implicitly; `migrate --apply` is the only
transition (legacy → changes, migrated → changes).

| | Legacy (no record) | Migrated (one schema 1 binding) | Changes (schema 2 records) |
| --- | --- | --- | --- |
| How recognized | no `.prd/changes/*.json` | exactly one `.prd/changes/<id>.json` with `schema: 1` | every `.prd/changes/*.json` has `schema: 2` |
| Selected PRD for status | the highest-numbered valid `.prd/prd-vN.md` | the binding's PRD; a newer unregistered PRD is reported, never selected | the PRD of the locally selected change; without a selection, none is selected |
| `start` | as v0.4.1: dependency and readiness checks, writes `status: in_progress` and `started` | same checks; a dependency is ready when its latest attempt passed against current inputs | additionally requires the ticket's change to be selected, `active` and authorized (see "Command gates") |
| `verify` | runs the block, writes `last_check` and `verified` into the ticket | runs the block as an attempt under `.pincer/runtime/`; writes nothing to tracked files | as migrated, for a selected, authorized `active` or `completed` change; the attempt records the agreement |
| `done` | re-runs the check, then writes `status: done` and `finished` | consumes the latest passing attempt whose inputs are current; writes `status: done` and `finished` once; read-only and idempotent afterwards | as migrated, gated like `start` |
| Readiness authority | `last_check`/`verified` receipts in the ticket | attempt records; `verified`/`last_check` are ignored and reported as `LEGACY_RECEIPT` | schema 2 attempt records of the same change; a schema 1 attempt is `HISTORICAL_EVIDENCE` |
| Local state | none; `.pincer/` is never written | `.pincer/runtime/` (ignored) | `.pincer/runtime/` plus `selection.json` and transaction journal |
| Evidence | schema 1, authored | schema 2, exported from attempts (schema 1 still validates with a legacy label) | schema 2 plus the per-change evaluation locator |
| Candidate locator | `NOTES.md` | `NOTES.md` | `.prd/evidence/changes/<id>.json`; `NOTES.md` is a compatibility summary |
| Status line | `Runtime  legacy · no change binding · migrate with node scripts/pincer-runtime.cjs migrate --preview --prd <prd>` | `Runtime  change <id> · revision <12 hex> · base <short sha>` | `Runtime  changes · selected <id> · <state> · agreement <12 hex> · authorization <current \| code> · base <short sha>`, or `Runtime  changes · no selection · change select <id>` |

Migrated mode keeps the v0.5.0 contract word for word; the v5 sections below apply to
changes mode only. A `.prd/changes/` directory that mixes schema 1 and schema 2
files, or holds a file this runtime cannot read, is `INPUT_INVALID` for every command
except `migrate --preview` (which names the conflict) and `recover`; an unreadable
schema 2 record never makes the project legacy or migrated.

## Commands and exit codes

All commands: `node scripts/pincer-runtime.cjs <command> [arguments]`. The project
root is `CLAUDE_PROJECT_DIR`, else `git rev-parse --show-toplevel`, else the working
directory. Diagnostics go to stderr, prefixed `pincer-ticket: ` for ticket input,
`pincer: ` for PRD, NOTES, change and runtime state, `evidence: ` for manifests.

| Command | Arguments | Writes | Notes |
| --- | --- | --- | --- |
| `validate` | `<file>... [--digests]` | nothing | validates tickets, PRDs and NOTES; `--digests` prints `ticket`, `check` and `prd` digests |
| `register` | `--prd .prd/prd-vN.md [--change <id>] [--authorization <text>] [--replace] [--rebind]` | legacy/changes: `.prd/changes/<id>.json` (schema 2), `.gitignore`; migrated: as v0.5.0 | changes mode: a new `planned` record; `--replace`, `--rebind` and `--authorization` are refused with the replacing command named (`change select`/`supersede`, `change revise`, `change authorize`); migrated mode: `MIGRATION_REQUIRED` for a second PRD |
| `snapshot` | `[--json] [--store]` | `.pincer/runtime/manifests/<digest>.json` only with `--store` | prints the source digest and file count, or the manifest |
| `status` | `[--json] [--change <id>]` | nothing | human report, or one status JSON object on stdout; `--change` inspects another record without selecting it |
| `ready` | `[T-NN] [--change <id>]` | nothing | read-only gate: exit 0 when ready, 1 when not, with reason codes; without a ticket, the release gate of the selected change |
| `start` | `T-NN` | ticket `status`, `started`, `prd` | all modes; changes mode gated |
| `verify` | `T-NN` | legacy: ticket receipts; migrated/changes: an attempt | always creates a new attempt outside legacy mode |
| `done` | `T-NN` | ticket `status`, `finished` (once) | legacy re-runs the check; migrated/changes consume the current pass |
| `bind` | `T-NN .prd/prd-vN.md` | ticket `prd` | legacy association repair |
| `recover` | | attempts, lock, journal, incomplete transactions | finalizes dead-owner `running` attempts as `interrupted`; completes committed transactions and discards uncommitted staging; never promotes to `passed`, never writes a lifecycle event |
| `migrate` | `--preview \| --apply --prd .prd/prd-vN.md [--change <id>] [--authorization <text>]` | apply: backups, ticket receipt lines, `.gitignore`, the schema 2 record, `selection.json`, index pointers | preview writes nothing; from legacy or from a schema 1 binding |
| `check` | `C-NN --candidate <sha> [--timeout <seconds>] -- <command...>` | an attempt | candidate-context check on a clean view of the committed candidate; changes mode: selected `completed` change with current authorization |
| `evidence export` | `--candidate <sha> --base <sha> --prd .prd/prd-vN.md --draft <file>` | `.prd/evidence/prd-vN/<candidate>/`; changes mode also `.prd/evidence/changes/<id>.json` | schema 2 manifest and logs populated from attempts |
| `change list` | `[--json]` | nothing | every retained record with lifecycle state, selection mark and authorization verdict |
| `change show` | `<id> [--json]` | nothing | one record: agreements, authorizations, decisions, events, evaluations, the structural difference between the authorized and current agreement; never changes the selection |
| `change select` | `<id>` | `.pincer/runtime/selection.json` | local pointer only; refuses an unknown or unreadable record; never touches HEAD, the index or files |
| `change activate` | `<id>` | the record (event) | `planned` → `active`; preconditions in "Lifecycle" |
| `change pause` | `<id> --reason <text> [--note <text>]` | the record (event) | `active` → `paused`; `--note` is the handoff note |
| `change resume` | `<id>` | the record (event) | `paused` → `active`; the lifecycle operation, distinct from the `resume` report |
| `change complete` | `<id>` | the record (event) | `active` → `completed`; requires every ticket done and ready, no open decision, current authorization |
| `change reopen` | `<id> --reason <text>` | the record (event) | `completed` → `active`; history retained |
| `change cancel` | `<id> --decision D-NN --reason <text>` | the record (event) | `planned`/`active`/`paused` → `cancelled` |
| `change supersede` | `<id> --with <replacement id> --decision D-NN` | the record (event) | `planned`/`active`/`paused`/`completed` → `superseded`; the replacement must exist and must not be superseded by `<id>` transitively |
| `change revise` | `<id>` | the record (agreement entry, event) and `.prd/changes/<id>/agreements/G-NN.json` | records the current agreement when it differs from the latest recorded one; no-op otherwise; authorizes nothing |
| `change authorize` | `<id> --agreement <digest> --reference <text> --excerpt <text> [--constraints <text>] [--decision D-NN]...` | the record (authorization, event) and the agreement snapshot when not yet recorded | the "user" disposition; `<digest>` must equal the agreement computed now |
| `change authorize` | `<id> --agreement <digest> --delegated --basis A-NN --explanation <text> [--decision D-NN]...` | as above | the "delegated" disposition; `A-NN` must be an existing authorization of the same change |
| `change decide` | `<id> --summary <text> [--id D-NN]` | the record (decision, event) | raises an open consequential decision; blocks execution until resolved |
| `change decide` | `<id> --resolve D-NN --reference <text> --excerpt <text>` | the record (decision, event) | records the user's decision; the agreement digest changes and needs authorization |
| `resume` | `[--change <id>] [--json]` | nothing | the read-only resume report ("Resume report"); `--change` inspects without selecting |
| `coverage` | `[--change <id>] [--json]` | nothing | the phase-specific coverage report ("Strict coverage"); read-only |
| `impact` | `[--change <id>] [--from G-NN \| A-NN] [--json]` | nothing | structural differences against a retained agreement ("Strict coverage"); read-only |
| `coverage adopt` | `--preview \| --apply --change <id> [--agreement <digest>]` | apply: a backup, the schema 3 record, the adoption snapshot | the explicit entry into strict coverage ("Adoption and rollback"); authorizes nothing |

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | success; for `status`, `resume`, `change list` and `change show`, inspection succeeded even when work is not ready |
| 1 | the check failed, the readiness gate is not ready, or a transition was refused |
| 2 | usage error (unknown command or option, missing argument) |
| 3 | state busy: the lock is held by a live owner after the bounded wait |
| 4 | invalid input or unreadable state (malformed ticket, PRD, record, index, manifest; incomplete transaction) |
| 124 | the check timed out |
| 130 | the check was interrupted (SIGINT or SIGTERM received by the runtime) |

Wrapper mappings: `scripts/pincer-ticket.sh <start|verify|done|bind> …` calls the
command of the same name and returns its exit code; `scripts/pincer-status.sh` calls
`status` (reading `PINCER_BUILD_BUDGET_MIN` from the environment) and returns its exit
code. Both print a Node.js 22+ requirement message and exit 4 when `node` is absent.

Argument grammar: `<id>` is a change ID; `D-NN`, `A-NN`, `G-NN` and `E-NN` are
two-to-six-digit decision, authorization, agreement and event IDs; `--reason`,
`--note`, `--summary`, `--reference`, `--excerpt`, `--explanation` and
`--constraints` take one string of at most 2000 characters that is stored verbatim
(never a transcript; the sanitizer's inline-secret rule applies and refuses a
secret-like literal). Every mutating `change` command takes the lock, validates
inputs and preconditions, and refuses before any file is written; refusals exit 1
with a reason code, invalid state exits 4.

## Supported grammar

The grammar is deliberately restricted; unsupported syntax is rejected before any
mutation, with the diagnostics listed in `scripts/pincer-runtime/parse.cjs`.

- **Frontmatter:** the file begins with `---`; each field is an unindented
  `key: value` line (`[a-z_][a-z0-9_]*`), unique, optionally followed by a `#` comment;
  blank and comment lines are allowed; a `---` line closes it. Tilde fences are
  unsupported everywhere.
- **Ticket:** required `ticket` (`T-01`..`T-999999`, matching the filename
  `T-NN-slug.md`), `status` (`open|in_progress|done`), `size` (`S|M|L`),
  `depends_on` (inline list `[T-01, T-02]`, no duplicates, no self reference). Optional
  `prd` (`.prd/prd-vN.md`), `started`/`finished` (ISO UTC `YYYY-MM-DDTHH:MM:SSZ`),
  legacy `verified` (`<timestamp> <12 hex>`), legacy `last_check`
  (`<timestamp> running|passed|failed|interrupted <12 hex>`), and `timeout` (a positive
  integer number of seconds, at most 2147483; default 600). Exactly one `## Acceptance Criteria` section
  with at least one checkbox (`- [ ] text`, `- [x] text`, `- [X] text`; `-`, `+`, `*`
  or numbered markers, indentation allowed; no fences inside). Exactly one
  `## Verification` section containing exactly one closed fenced `bash` block with at
  least one runnable line and valid Bash syntax (`bash -n`). Headings inside other
  fenced blocks are ignored.
- **PRD:** frontmatter `version` equal to the filename number, `status`
  (`draft|ticketed|built`), optional `profile` (`small|standard`).
- **NOTES.md:** frontmatter `prd`, `base` and `candidate` (full 40-hex commit IDs),
  `evidence` (manifest path); NOTES without `evidence` is a legacy evaluation.
- **Change ID:** `[a-z0-9][a-z0-9-]{0,63}`.
- **Ticket association:** a ticket belongs to the PRD its `prd` field names, or to
  the only PRD in `.prd/` when the field is absent. Ticket IDs are unique across the
  repository; a ticket resolves to exactly one change through its PRD, and a PRD is
  owned by exactly one change record.

## Change binding

`.prd/changes/<change-id>.json` with `schema: 1` is the v0.5.0 binding. It is read
and written unchanged in migrated mode, written only by `register` (migrated mode)
and never by the changes-mode commands:

| Field | Value |
| --- | --- |
| `schema` | `1` |
| `change` | the change ID (default `prd-vN`) |
| `prd` | `.prd/prd-vN.md` |
| `prd_revision` | the PRD content digest (below) |
| `base` | HEAD at registration, 40 hex |
| `registered` | ISO UTC timestamp |
| `authorization` | the recorded authorization reference when supplied, else `null`; registration never infers approval from PRD status |
| `runtime` | `1` |
| `legacy_receipts` | `{ "T-NN": { "verified": "...", "last_check": "..." } }` imported by migration, else `{}` |

Registration (and migration) adds `.pincer/` to `.gitignore` before writing the
record, and the installer adds it on `init` and `update`, so local runtime state is
never an untracked change. In migrated mode exactly one binding may exist per worktree. A second file, a file
for another PRD, malformed JSON, an unsupported `schema`, or a
`prd_revision` that no longer matches the PRD content are diagnosed before any child
process starts (`AMBIGUOUS`, `CHANGE_REQUIRED`, `MALFORMED`, `UNSUPPORTED_SCHEMA`,
`REVISION_CHANGED`). The v0.5.0 `register --replace` (delete the other PRD's binding)
is refused in migrated mode with `MIGRATION_REQUIRED`: migrate to changes mode, then
`change select` the change to work on or `change supersede` the one being replaced.
Copying a binding into another repository requires its `base`
to exist there and its `prd` path to resolve; otherwise it is `UNSUPPORTED_INPUT`.
Binding fields are recorded on every attempt separately; a binding is never hashed
into the source manifest.

## Change records

`.prd/changes/<change-id>.json` with `schema: 2` is a change record: the portable
identity, agreement history, authorization and decision records, lifecycle history and
evaluation references of one change. It is tracked in git and is
written only by `register` and `migrate --apply` (which create it) and the mutating
`change` commands (which append its history), always through a transaction
("Transactions and recovery"). Several records may coexist; each PRD is
owned by exactly one record and each record owns exactly one PRD.

| Field | Owner | Value |
| --- | --- | --- |
| `schema`, `runtime` | register/migrate | `2`, `2` |
| `change` | register/migrate | the change ID; equals the filename |
| `prd` | register/migrate | `.prd/prd-vN.md`; unique across records |
| `base` | register/migrate | HEAD at registration, 40 hex |
| `registered` | register/migrate | ISO UTC timestamp |
| `sequence` | every transaction | the record revision: the number of events; each committed transaction appends exactly one event and increments it |
| `lifecycle` | lifecycle transactions | the projection `{ state, since, reason, note, superseded_by }`; validated against `events` on every read |
| `agreements` | `change revise`, `change authorize`, migrate | `[{ id: "G-NN", digest, prd_revision, breakdown, tickets: ["T-NN"], decisions: ["D-NN"], snapshot, recorded }]` |
| `authorizations` | `change authorize`, migrate | `[{ id: "A-NN", agreement: "G-NN", digest, disposition: "user" \| "delegated", reference, excerpt, constraints, basis, explanation, decisions: ["D-NN"], recorded }]` |
| `decisions` | `change decide` | `[{ id: "D-NN", status: "open" \| "resolved", summary, reference, excerpt, raised, resolved }]` |
| `events` | every transaction | `[{ sequence, kind, from, to, at, reason, agreement, authorization, decision, replacement, note }]` |
| `evaluations` | nobody in this schema | always `[]`; evaluation references live in the evaluation locator so that recording one does not change the candidate's source view |
| `legacy` | migrate | `{ receipts: { "T-NN": { verified, last_check } }, authorization_text: string \| null, migrated_from: "legacy" \| "binding" \| null, migrated: timestamp \| null }`; `authorization_text` is the v0.5.0 free-text `authorization`, retained as an unvalidated historical reference that never satisfies the authorization gate |

Every key above is required and no other key is allowed (`MALFORMED`). IDs `G-NN`,
`A-NN`, `D-NN` are allocated sequentially per record starting at `01`; `events[i].sequence`
is `i + 1`, contiguous, and `sequence` equals `events.length` (`HISTORY_INVALID`
otherwise). Event `kind` is one of `register`, `activate`, `pause`, `resume`,
`complete`, `reopen`, `cancel`, `supersede`, `agreement`, `authorize`, `decide`,
`resolve`, `migrate`; lifecycle kinds carry `from` and `to` as in the transition
table, the others carry `from = to =` the state at the time. Unused fields are `null`.
The lifecycle projection is recomputed by replaying the lifecycle events from
`planned`; a projection that disagrees, a `superseded_by` that names a missing record
or a supersession chain that returns to the record itself is `HISTORY_INVALID`. A file
that fails to parse (including git conflict markers) is `MALFORMED`; a git merge that
interleaves two histories is caught by the sequence rule and is repaired by hand, never
by last-writer-wins.

Example of a valid record (`prd-v2` registered, revised once, authorized, activated,
paused with a handoff note):

```json
{
  "schema": 2,
  "runtime": 2,
  "change": "prd-v2",
  "prd": ".prd/prd-v2.md",
  "base": "3f2a1c9d5b7e4a6f8c0d2e1b9a7c5e3d1f0b8a6c",
  "registered": "2026-09-12T08:00:00Z",
  "sequence": 4,
  "lifecycle": { "state": "paused", "since": "2026-09-12T10:30:00Z", "reason": "waiting for the API contract", "note": "T-03 is half done; the failing case is in test/api.test.js", "superseded_by": null },
  "agreements": [
    { "id": "G-01", "digest": "5a1e0c9d3b7f2e4a6c8d0b1f3e5a7c9d1b3f5e7a9c1d3f5b7e9a1c3d5f7b9e1a", "prd_revision": "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00", "breakdown": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "tickets": ["T-03", "T-04"], "decisions": [], "snapshot": ".prd/changes/prd-v2/agreements/G-01.json", "recorded": "2026-09-12T08:05:00Z" }
  ],
  "authorizations": [
    { "id": "A-01", "agreement": "G-01", "digest": "5a1e0c9d3b7f2e4a6c8d0b1f3e5a7c9d1b3f5e7a9c1d3f5b7e9a1c3d5f7b9e1a", "disposition": "user", "reference": "session 2026-09-12 09:58, user message after /pincer-narrow", "excerpt": "go ahead with both tickets as written", "constraints": null, "basis": null, "explanation": null, "decisions": [], "recorded": "2026-09-12T10:00:00Z" }
  ],
  "decisions": [],
  "events": [
    { "sequence": 1, "kind": "register", "from": null, "to": "planned", "at": "2026-09-12T08:00:00Z", "reason": null, "agreement": null, "authorization": null, "decision": null, "replacement": null, "note": null },
    { "sequence": 2, "kind": "authorize", "from": "planned", "to": "planned", "at": "2026-09-12T10:00:00Z", "reason": null, "agreement": "G-01", "authorization": "A-01", "decision": null, "replacement": null, "note": null },
    { "sequence": 3, "kind": "activate", "from": "planned", "to": "active", "at": "2026-09-12T10:01:00Z", "reason": null, "agreement": "G-01", "authorization": "A-01", "decision": null, "replacement": null, "note": null },
    { "sequence": 4, "kind": "pause", "from": "active", "to": "paused", "at": "2026-09-12T10:30:00Z", "reason": "waiting for the API contract", "agreement": "G-01", "authorization": null, "decision": null, "replacement": null, "note": "T-03 is half done; the failing case is in test/api.test.js" }
  ],
  "evaluations": [],
  "legacy": { "receipts": {}, "authorization_text": null, "migrated_from": null, "migrated": null }
}
```

(`change authorize` records the agreement entry `G-01` in the same transaction as
`A-01` when it was not recorded by an earlier `change revise`; that is why the example
carries no separate `agreement` event.)

Invalid, unknown-schema and conflicting records, all refused before any write and
never treated as legacy:

```json
{ "schema": 2, "runtime": 2, "change": "prd-v2", "prd": ".prd/prd-v2.md", "base": "3f2a1c9d5b7e4a6f8c0d2e1b9a7c5e3d1f0b8a6c", "registered": "2026-09-12T08:00:00Z", "sequence": 2, "lifecycle": { "state": "active", "since": "2026-09-12T08:00:00Z", "reason": null, "note": null, "superseded_by": null }, "agreements": [], "authorizations": [], "decisions": [], "events": [ { "sequence": 1, "kind": "register", "from": null, "to": "planned", "at": "2026-09-12T08:00:00Z", "reason": null, "agreement": null, "authorization": null, "decision": null, "replacement": null, "note": null } ], "evaluations": [], "legacy": { "receipts": {}, "authorization_text": null, "migrated_from": null, "migrated": null } }
```

is `HISTORY_INVALID` twice over: `sequence` is 2 with one event, and the projection
says `active` while the history ends at `planned`.

```json
{ "schema": 3, "change": "prd-v2", "prd": ".prd/prd-v2.md" }
```

is `UNSUPPORTED_SCHEMA` (schema 3 is unknown; the file is left untouched and the
project is neither legacy nor migrated).

```json
{ "schema": 2, "runtime": 2, "change": "feature-x", "prd": ".prd/prd-v2.md", "base": "3f2a1c9d5b7e4a6f8c0d2e1b9a7c5e3d1f0b8a6c", "registered": "2026-09-12T09:00:00Z", "sequence": 1, "lifecycle": { "state": "planned", "since": "2026-09-12T09:00:00Z", "reason": null, "note": null, "superseded_by": null }, "agreements": [], "authorizations": [], "decisions": [], "events": [ { "sequence": 1, "kind": "register", "from": null, "to": "planned", "at": "2026-09-12T09:00:00Z", "reason": null, "agreement": null, "authorization": null, "decision": null, "replacement": null, "note": null } ], "evaluations": [], "legacy": { "receipts": {}, "authorization_text": null, "migrated_from": null, "migrated": null } }
```

is a conflicting record next to the valid example above (`.prd/changes/feature-x.json`
also owns `.prd/prd-v2.md`): `INPUT_INVALID` "duplicate PRD ownership" for the whole
directory until one of them is removed by hand.

```text
{ "schema": 2, "change": "prd-v2", "prd": ".prd/prd-v2.md", "sequence": 
```

is `MALFORMED` (truncated JSON); so is a file carrying `<<<<<<<` conflict markers.

## Selection

The selected change of a worktree is `.pincer/runtime/selection.json`:

```json
{ "schema": 1, "change": "prd-v2", "selected": "2026-09-12T10:00:00Z" }
```

written only by `change select` and `migrate --apply`, through the transaction
journal, and never copied between worktrees. Selection is metadata: it never checks
out, stashes, resets, commits or creates a worktree, and it succeeds on a dirty tree,
leaving HEAD, the index, tracked files and untracked files byte for byte unchanged.
Selecting a change grants no approval and activates nothing.

Resolution rules (changes mode): no file → `SELECTION_REQUIRED` even when only one
record exists (a fresh clone always selects explicitly); a file naming a record that is
missing or unreadable → `SELECTION_INVALID` (no fallback to another record, the
highest PRD or the newest record); a valid file → the selected change. Inspection
commands accept `--change <id>` to read another record without changing the file.
Execution commands ("Command gates") use the selection only: a ticket whose PRD belongs
to another record is `WRONG_CHANGE`.

Repository view: a selected change is compatible with the working tree when its PRD
exists and validates, its recorded `base` is an ancestor of HEAD (`git merge-base
--is-ancestor`), and HEAD exists. Anything else is `BASE_MISMATCH`, reported with HEAD,
the recorded base, the current branch name and the dirty paths. The branch name is a
hint printed for the developer; it is never identity, authorization or proof that the
right branch is checked out, and the runtime never claims otherwise.

## Lifecycle

States: `planned`, `active`, `paused`, `completed`, `cancelled`, `superseded`. At most
one record among the records in the tree may be `active` at a time. Every transition
is one transaction that validates the whole precondition set under the lock, appends
one event and rewrites the projection; an invalid transition writes nothing.

| From | Operation | To | Preconditions (all checked under the lock, before any write) |
| --- | --- | --- | --- |
| (none) | `register` | `planned` | unique change ID; PRD valid and owned by no record; HEAD exists |
| `planned` | `change activate` | `active` | selected; repository view compatible; agreement computable; authorization `current`; no open decision; no other record `active` |
| `active` | `change pause --reason` | `paused` | selected; no `running` attempt of this change |
| `paused` | `change resume` | `active` | as `activate` |
| `active` | `change complete` | `completed` | selected; authorization `current`; no open decision; every ticket of the PRD is `done` and ready (checked criteria, current passing attempt of this change, no `SOURCE_CHANGED`/`CHECK_CHANGED`/`REVISION_CHANGED`); no `running` attempt of this change |
| `completed` | `change reopen --reason` | `active` | as `activate`; completion events stay in the history |
| `planned`, `active`, `paused` | `change cancel --decision D-NN --reason` | `cancelled` | selected or `--change`; `D-NN` resolved; no `running` attempt of this change |
| `planned`, `active`, `paused`, `completed` | `change supersede --with <id> --decision D-NN` | `superseded` | `D-NN` resolved; the replacement exists, is not this record, and is not (transitively) superseded by this record; no `running` attempt of this change |
| `cancelled`, `superseded` | any execution, `activate`, `resume`, `reopen`, `revise`, `authorize`, `decide` | refused | `LIFECYCLE_BLOCKED`; register a new change and reference the historical one |

Idempotence: requesting the state a record already has (`pause` when `paused`,
`resume`/`activate`/`reopen` when `active`, `complete` when `completed`, `cancel` when
`cancelled`, `supersede` when `superseded` by the same replacement) exits 0, prints the
current state and writes no event. Every other pair not in the table is
`LIFECYCLE_BLOCKED` with the current state and the permitted operations named.

`completed` means implementation complete and ready for evaluation. It is not
evaluated, release-ready, merged or published, and it is written before the candidate
is chosen: the `complete` transaction, the last authored documentation changes and any
lifecycle or agreement change are committed, and the resulting commit is the candidate.
A later failing recheck makes a completed change non-ready in status and release
without rewriting history; `reopen` when the implementation must change.

Pause is an execution hold: ticket state, every attempt, every authorization and the
reason are kept. Cancellation and supersession preserve artifacts and evidence as
inspectable history; they grant no permission to discard source or to mark unfinished
requirements delivered.

## Agreements and authorization

An agreement is the reviewed content a user authorized: the change, the PRD's authored
revision, the breakdown, and the resolved consequential decisions. Its digest is
SHA-256 over the agreement projection, version 1, an exact text:

```
pincer agreement 1
change <change id>
prd <.prd/prd-vN.md> <prd_revision>
ticket <T-NN> <ticket_digest>          (one line per ticket of the PRD, ascending numeric ID)
decision <D-NN> <decision digest>      (one line per resolved decision, ascending ID)
```

each line terminated by `\n`. `prd_revision` and `ticket_digest` are the digests of
"Content revisions": lifecycle fields (`status`, `started`, `finished`, `verified`,
`last_check`) and checkbox marks are the only exclusions, so ticking a criterion,
starting or closing a ticket, recording an attempt or editing implementation source
never changes the agreement, while a change to a ticket's acceptance text,
`depends_on`, `size`, `timeout`, `prd` association or Verification block, a ticket
added to or removed from the PRD, and any PRD body edit under the same filename each
change it. The decision digest is SHA-256 over `<id>\n<summary>\n<reference>\n<excerpt>\n`
of a resolved decision; open decisions are not agreement inputs (they gate
execution instead). The breakdown digest recorded on an agreement entry is SHA-256
over the `ticket` lines alone. Authorizations, lifecycle events, evaluations, attempts,
the selection and the change record itself are never inputs.

Agreement entries `G-NN` are recorded by `change revise` (explicitly) and by
`change authorize` (when the digest it binds is not yet recorded), with a snapshot
`.prd/changes/<id>/agreements/G-NN.json`, tracked in git:

```json
{ "schema": 1, "change": "prd-v2", "agreement": "G-01", "digest": "<64 hex>", "projection": "pincer agreement 1\nchange prd-v2\n…", "prd": { "path": ".prd/prd-v2.md", "revision": "<64 hex>", "text": "<normalized PRD text>" }, "tickets": { "T-03": { "file": "tickets/T-03-slug.md", "digest": "<64 hex>", "text": "<normalized ticket text>" } }, "decisions": { "D-01": { "summary": "…", "reference": "…", "excerpt": "…" } }, "recorded": "2026-09-12T08:05:00Z" }
```

The snapshot holds the normalized inputs, so an old agreement can be reviewed and its
digest recomputed from the file alone; a record whose snapshot is missing or whose
recomputed digest differs is `HISTORY_INVALID` for that agreement, and the runtime
refuses to present a digest-only history as reviewable. The structural difference
shown by `change show` and `resume` compares the latest authorized snapshot with the
current inputs: PRD changed or not, tickets added, removed and changed, and for each
changed ticket which parts differ (`frontmatter`, `acceptance`, `verification`,
`other`). It is a structural diff, never a semantic impact judgment.

Authorization records `A-NN` bind one agreement digest. Two dispositions:

- `user`: `--reference` names where the user's instruction lives (a session, a date, a
  document, a ticket comment) and `--excerpt` is a short faithful quotation of it;
  `--constraints` records limits or delegations the user stated. It records local
  provenance and consistency, not authenticated identity, and it cannot be created by
  the runtime from a PRD status, a ticket status, a passing check, a registration or
  the v0.5.0 free text.
- `delegated`: `--basis A-NN` names an earlier authorization of the same record
  (transitively ending in a `user` one) and `--explanation` says why the new agreement
  stays within the delegation that authorization granted. The runtime validates the
  chain; whether the delegation really covers the change is a reviewer's judgment and
  is presented as such.

Both require `--agreement <digest>` equal to the agreement digest computed from the
current inputs at commit time (`AGREEMENT_CHANGED` when a prepared digest no longer
matches), refuse when the record is `cancelled` or `superseded`, and are idempotent: a
second identical record (same digest, disposition, reference, excerpt, constraints,
basis, explanation and decisions) writes nothing and exits 0. Every `--decision` named
must exist and be resolved.

The authorization verdict is one pure computation shared by gates, status and resume:

| Verdict | Condition |
| --- | --- |
| `current` | some authorization's `digest` equals the agreement digest computed now, and no decision is `open` |
| `AUTHORIZATION_REQUIRED` | the record has no authorization at all |
| `AGREEMENT_CHANGED` | authorizations exist but none matches the current digest (detail names the latest authorized agreement, the current digest and the structural difference) |
| `DECISION_REQUIRED` | a decision is `open` (detail names it) |

Decisions `D-NN` are the consequential choices that need the user: `change decide
--summary` raises one as `open` (any agent may do this when it discovers such a
choice), and `change decide --resolve D-NN --reference --excerpt` records the user's
actual decision. Resolving changes the agreement digest, so the next `change authorize`
names the decision and binds the new digest. A deferral is a resolved decision whose
excerpt says so; it is reported as a decision, never as delivery.

## Command gates

Execution and mutation in changes mode pass one shared guard before any child process
is spawned or any lifecycle file written. The guard resolves the selection, loads and
validates the record, checks the lifecycle state, the repository view and the
authorization verdict, and refuses with the first failing code in this order:
`INPUT_INVALID`/`MALFORMED`/`UNSUPPORTED_SCHEMA`/`HISTORY_INVALID`/`STATE_INCOMPLETE`
→ `SELECTION_REQUIRED`/`SELECTION_INVALID` → `WRONG_CHANGE` → `LIFECYCLE_BLOCKED` →
`BASE_MISMATCH` → `DECISION_REQUIRED` → `AUTHORIZATION_REQUIRED`/`AGREEMENT_CHANGED`.

| Command | Requires |
| --- | --- |
| `start`, `done` | selected change owns the ticket; state `active`; view compatible; authorization `current` |
| `verify` | selected change owns the ticket; state `active` or `completed`; view compatible; authorization `current` |
| `check`, `evidence export` | selected change owns the PRD; state `completed`; clean candidate view; authorization `current` |
| `change activate`, `change resume`, `change reopen` | as "Lifecycle" |
| `status`, `ready`, `resume`, `change list`, `change show`, `validate`, `snapshot` | nothing; read-only, and they report the same codes the gates would |
| `register`, `change select`, `change revise`, `change decide`, `change authorize`, `recover`, `migrate` | no execution authorization; each validates its own inputs |

Read-only readiness (`ready`, status, resume, release) reports `AUTHORIZATION_REQUIRED`,
`AGREEMENT_CHANGED` or `DECISION_REQUIRED` as non-ready reasons of the selected change
while still showing historical attempts and evaluations; history never asserts present
authorization. Refused executions print nothing on stdout, launch nothing and leave
every ticket, record, index and selection file unchanged.

For `verify` and `check` the guard runs twice: once before anything is prepared, and
again under the worktree lock immediately before the `running` attempt record is
written. The second evaluation is the one that counts: a transition, revision or
authorization committed between the first evaluation and the lock is seen there, so
the attempt is refused with that gate's code (nothing written, nothing launched) or
recorded against the agreement current under the lock. An attempt therefore never
runs for a change whose state or authorization no longer permits it.

## Content revisions

Digests are SHA-256, hex, shown shortened to 12 characters in human output and in
full in records. Line endings are not normalized.

| Digest | Input |
| --- | --- |
| PRD revision (`prd_revision`, `prdDigest`) | the PRD file with the frontmatter `status` line removed |
| Ticket authored digest (`ticket_digest`) | the ticket file with the frontmatter `status`, `started`, `finished`, `verified` and `last_check` lines removed and every Acceptance Criteria checkbox mark normalized to `[ ]` |
| Check digest (`check_digest`) | the Verification block text (the lines between the fences) followed by `\ntimeout=<effective seconds>` |
| Source digest | the source manifest (next section) |
| Agreement digest | the agreement projection ("Agreements and authorization") |

These are the only normalization exceptions. Acceptance text, `depends_on`, `size`,
`timeout`, the Verification block and the PRD body always contribute. Validation of
the normalized fields is separate: normalization never makes an invalid ticket
eligible.

## Source manifest

Source manifest schema 1 is a JSON object `{ schema: 1, digest, files: [], excluded: [],
limitations: [] }`. Each `files` entry is `{ path, sha256, mode }` or
`{ path, deleted: true }`; `mode` is `100644` or `100755` (the executable bit is part
of identity). The digest is SHA-256 over the lines `<mode or deleted> <sha256 or ->
<path>\n` sorted by path in byte order.

Inclusion: every path from `git ls-files -z --cached --others --exclude-standard`
relative to the project root (tracked files, plus untracked files that are not
ignored), so tests, configuration, lockfiles and new files all count. A tracked file
missing from the working tree is a `deleted` entry. Ticket files (`tickets/T-*.md`) and
PRDs (`.prd/prd-v*.md`) are hashed after the normalization above, so ticking a box or
a lifecycle transition does not change the digest.

Fixed exclusions (never inputs): `.git/`, `.pincer/`, `NOTES.md`, `.prd/evidence/`,
`.prd/changes/`. This is why a new evidence artifact, a NOTES edit, a lifecycle event,
an agreement snapshot or an evaluation reference cannot invalidate the snapshot that
produced it. The separate post-candidate commit policy is unchanged in substance: only
`NOTES.md`, the listed files of validated manifests for that candidate and (changes
mode) valid evaluation locators may follow the candidate ("Evaluation locator"); a
change record edit after the candidate is a candidate change, which is why completion
precedes the candidate.

Configured exclusions: the optional tracked file `.prd/source-exclude`, one pattern
per line (`#` comments; `dir/` prefixes; `*`, `**` and `?` globs; a pattern without
`/` matches a basename anywhere). The file is itself an input. A pattern may exclude
only untracked paths; a pattern that matches any tracked file, anything under
`tickets/`, any `.prd/prd-v*.md` or the exclude file itself is refused
(`UNSUPPORTED_INPUT`) with the offending pattern and path named.

Secret paths: a path whose basename is `.env` or starts with `.env.` (except
`.env.example`) blocks with `SECRET_PATH` naming only the path; its contents are never
read or hashed. `.env.example` is ordinary input.

Unsupported inputs, refused explicitly rather than silently omitted: symbolic links
(git mode `120000` or a symlink on disk), submodules (mode `160000`), and a project
that is not inside a git repository.

Limitations recorded on every manifest and attempt: ignored paths (for example
`node_modules/`, `dist/`) are listed by name as not part of the identity; external
services and installed toolchains are not part of the identity; source equality does
not prove the environment stayed healthy. Whole-workspace identity is deliberately
conservative: another change's edits invalidate this change's passing attempts, which
status and resume report as `SOURCE_CHANGED`; no dependency-scoped digest exists.

## Attempts

Local state lives under `<root>/.pincer/runtime/` and belongs to the worktree; it is
ignored by git (`.pincer/` in `.gitignore`, added by migration) and never edited by
hand.

| Path | Content |
| --- | --- |
| `index.json` | `{ schema: 1, sequence: <last allocated>, current: { "<context key>": "<attempt id>" }, running: ["<attempt id>"] }` |
| `attempts/<attempt id>.json` | one attempt record |
| `attempts/<attempt id>/stdout.log`, `stderr.log` | sanitized captured output |
| `manifests/<digest>.json` | content-addressed source manifests |
| `selection.json` | the selected change ("Selection"; changes mode) |
| `lock/` | the exclusive lock directory; `lock/owner.json` is `{ pid, ppid, host, started, command }` |
| `journal/` | temporary files for atomic replacement and transaction staging ("Transactions and recovery") |

Context keys: `ticket:<change>:<T-NN>` and `candidate:<40 hex>:<C-NN>` in migrated
mode; `ticket:<change>:<T-NN>` and `candidate:<change>:<40 hex>:<C-NN>` in changes
mode, so two changes that share a check ID and a candidate commit never share a
pointer. Attempt IDs
are `<sequence, 6 digits>-<UTC compact timestamp>-<6 hex>`; the `sequence` in
`index.json` is the authority for ordering (timestamps alone never order attempts), and
`index.current[key]` is the authority for the latest attempt: when the record it names
is missing or unreadable, readiness is `EVIDENCE_MISSING`, never an older record.

Attempt record schema 1 (migrated mode) and schema 2 (changes mode; the same fields
plus `context.agreement`):

| Field | Value |
| --- | --- |
| `schema`, `runtime` | `1`, `1` (migrated) or `2`, `2` (changes) |
| `id`, `sequence` | as above |
| `context` | `{ kind: "ticket" \| "candidate", change, prd, prd_revision, base, ticket?, ticket_digest?, candidate?, check?, agreement? }`; `agreement` is the agreement digest at launch, required in schema 2 and absent in schema 1 |
| `check` | `{ digest, display, timeout_seconds }` (display is the sanitized command text) |
| `outcome` | `running \| passed \| failed \| interrupted \| timed_out \| error` |
| `exit_code`, `signal` | the child's exit code or signal, else `null` |
| `runner` | `{ shell: "<bash path>", args: ["-eo", "pipefail", "-c"], version: "<first line of bash --version>" }` |
| `cwd` | the working directory relative to the root (`.`) |
| `environment` | `{ os, node, declared: {} }`; declared nonsecret context only, never a dump |
| `started`, `finished` | ISO UTC; `finished` is `null` while running |
| `source` | `{ before: <digest>, after: <digest or null>, files: <count>, limitations: [] }` |
| `artifacts` | `{ stdout: { path, sha256, bytes, truncated, redactions }, stderr: { ... } }` |
| `owner` | `{ pid, ppid, host }` (the runtime process) |
| `child` | `{ pid }` of the launched process group, else `null` |
| `limitations` | strings |
| `error` | message when `outcome` is `error`, else absent |

Rules: the `running` record is written and `index.current[key]` points at it before
the child starts, so prior readiness for the context is superseded immediately; the
outcome is `passed` only when the exit code is 0, the check digest is unchanged, and
`source.before` equals `source.after`; a nonzero exit is `failed`; exceeding the
timeout is `timed_out` (exit 124); SIGINT/SIGTERM to the runtime is `interrupted`
(exit 130); a launch failure, an unwritable state directory, a sanitizer failure or a
source mutation during the run is `error` (a mutation names the first changed path in
`error`). An attempt is never left `running` on an exit path the runtime controls; a
forced kill leaves `running`, which status reports as non-ready and `recover`
finalizes as `interrupted` after verifying the owner pid is dead on this host,
terminating the orphaned child process group when it is still alive (SIGTERM, then
SIGKILL when it is still running after the 5 s grace period; `recover` waits for that
before returning, records what it sent, and records the digests of the logs the dead
runner captured).

A record is evidence only when it is complete and was written for the context it is
read for: readiness validates the record against this schema (every field above
through `artifacts`; `owner`, `child`, `limitations` and `error` are not checked; `finished`
and the artifact digests must be present once the outcome is not `running`, except
that an `interrupted` record may carry `null` digests when a `recover` older than their
recording finalized it), that its context key equals the key the index was read for,
and that its `id` is the one `index.current[key]` names. A record that is incomplete,
malformed, written for another ticket or check, or copied over the pointed-at record
is `ATTEMPT_ERROR` (never ready) and `evidence export` refuses it; export also refuses
an `interrupted` record without log digests. Readiness and export
also compare each captured log with the digest the record carries: a log that was
altered after the run is `EVIDENCE_MISSING` (the reason names the stream) and export
refuses it; a missing log is `EVIDENCE_MISSING` as before. This detects mistakes and
stale copies, not a deliberate rewrite of both the log and its record. In changes
mode a pointed-at record with `schema: 1` (recorded before migration) is
`HISTORICAL_EVIDENCE`: it stays inspectable with its original identity, never becomes
current evidence, and the next action is `verify`. A schema 2 record whose
`context.change` is not the change it is read for is `ATTEMPT_ERROR`; one whose
`context.prd_revision` differs from the current PRD revision is `REVISION_CHANGED`;
its `context.agreement` is recorded and exported but is not a readiness input, because
the conservative whole-source, ticket and check digests already invalidate what a
changed agreement can change.

Lock: acquired by building `lock/` with its `owner.json` in a staging directory and
renaming it into place (atomic; a waiter never sees an owner-less lock); waiters poll
every 100 ms for up to 10 s (`PINCER_LOCK_WAIT_MS` overrides the bound), then fail with
exit 3 naming the owner. A lock whose owner pid is on this host and no longer alive is
reclaimed with a diagnostic: the waiter renames the stale directory to a private name
first, re-reads its owner, and only the process that won the rename removes it, so two
waiters cannot both acquire; a live owner is never stolen; a foreign host is never
reclaimed automatically. The lock is held while records are written and
released while the child runs. Every write goes to `journal/` on the same filesystem
and is renamed into place; a stray journal file is ignored on read and reported by
`recover`. A malformed `index.json` is exit 4 and is never overwritten by inspection.

Timeout: the effective timeout is the ticket's `timeout` field or 600 s, or `--timeout`
for `check`; it is part of the check digest. On expiry (and on SIGINT/SIGTERM) the
runtime sends SIGTERM to the child's process group, waits 5 s, then sends SIGKILL,
whether or not the shell itself has already exited: a background child that inherited
the output pipes keeps the attempt open and is terminated the same way, so a check that
exits 0 leaving one behind is `timed_out`. If the pipes are still open 2 s after
SIGKILL, capture is abandoned and the record's limitation says a descendant may still
be running; the attempt never waits for a descendant's own schedule. The limitation
names the signals a kill call delivered, or says that no reachable process remained
in the group (a descendant that left the group with `setsid` holds the pipes and
survives; see "Platform limits"). Signalling the group after the shell was reaped
relies on the group id not being reused while any member is alive; between the
SIGTERM and SIGKILL attempts an empty group's id could in principle be reused by an
unrelated process, which is accepted as a limit.

## Transactions and recovery

Every write of a change record, an agreement snapshot, the selection, the evaluation
locator, a migration and a lifecycle event goes through one transaction API
(`scripts/pincer-runtime/transaction.cjs`), which callers use instead of writing the
files themselves:

1. Acquire the worktree lock (bounded; `STATE_BUSY` after the wait).
2. Read and validate every input the operation depends on: the records under
   `.prd/changes/`, the selection, the index (for `running` attempts of the change),
   the PRD and tickets when the agreement is needed. Compare the record's `sequence`
   with the one the caller expects when it prepared the operation; a difference is
   `STATE_CHANGED` and the operation is refused (a decision prepared against an
   agreement that changed meanwhile is never applied).
3. Compute the outcome in memory. A refusal returns here; nothing has been written.
4. Stage every new file under `journal/txn-<UTC compact timestamp>-<6 hex>/` on
   the same filesystem, then write the transaction manifest
   `journal/txn-<UTC compact timestamp>-<6 hex>/manifest.json` last, atomically:

   ```json
   { "schema": 1, "id": "txn-20260912T100100Z-a1b2c3", "command": "change activate prd-v2", "started": "2026-09-12T10:01:00Z", "writes": [ { "target": ".prd/changes/prd-v2.json", "staged": "01-prd-v2.json" }, { "target": ".pincer/runtime/selection.json", "staged": "02-selection.json" } ] }
   ```

5. Rename each staged file onto its target in the listed order, remove the manifest,
   remove the staging directory, release the lock.

The manifest is the commit point. A process killed before it exists leaves the old
state; the staging directory is discarded by the next transaction or `recover`.
A process killed after it exists leaves a committed transaction whose renames are
completed (each rename is idempotent: a staged file that is already gone was
renamed) by the next transaction or `recover` before anything else runs; a manifest
that cannot be read is left in place and named, never guessed at.
Read-only commands that find a manifest report `STATE_INCOMPLETE` with the command
named and refuse to interpret the half-applied files; they never repair. A record is
therefore always the state before a transition or the state after it with its event;
a projection without its event cannot be observed.

Running attempts: transitions that need the change idle (`pause`, `complete`,
`cancel`, `supersede`) read `index.running` under the lock and refuse with
`ATTEMPT_RUNNING` naming the attempt when one belongs to the change. They never
terminate it; `recover` finalizes a dead owner's attempt first, after which the
transition succeeds and the `interrupted` result stays visible.

Contention order: writers serialize on the lock in acquisition order; a `verify`
holds the lock only while it evaluates the gates a second time and writes its
`running` record, and again while it finalizes, so a transition can be refused
between them by the running check, never the other way round, and a transition
committed before the check's lock refuses the check (see "Command gates"). Two concurrent activations of different changes: the first commits, the
second reads the committed record and is refused (`LIFECYCLE_BLOCKED`: another change is
active). Two concurrent selections: the later one wins and the earlier is overwritten;
selection carries no history. No lock is held across user interaction: a command that
needs the user's answer refuses and exits; the answer arrives as a new command.

## Capture and sanitization

stdout and stderr are captured separately as streams, each stored up to 1 MiB
(1,048,576 bytes); beyond that the runtime keeps counting and appends
`[pincer: truncated, <N> more bytes not stored]` and records `truncated: true`. Each
line is sanitized before it is persisted: values matched by the documented patterns
are replaced with `[redacted]` and counted in `redactions`. Patterns: assignments or
JSON fields whose key contains `key`, `secret`, `password`, `passwd`, `token` or
`authorization` (case-insensitive) followed by `:` or `=`; `Bearer <token>`; PEM
private key blocks; AWS access key IDs (`AKIA` + 16 characters); GitHub tokens
(`gh[pousr]_` + 20 or more characters). The sanitizer is a safety net, not a
guarantee: checks must avoid printing secrets, no raw unredacted log is exported, and
the runtime never persists the environment. A Verification block that assigns a
secret-like variable inline (`TOKEN=literal`, not a `$reference`) is refused before
launch with the line number. If capture or sanitization fails, the attempt is `error`,
never a pass claiming complete output. The `change` command texts (`--reason`,
`--note`, `--summary`, `--reference`, `--excerpt`, `--explanation`, `--constraints`)
pass the same inline-secret rule and are refused, not redacted, when they carry a
secret-like literal.

## Readiness and reason codes

Readiness is one pure computation (`scripts/pincer-runtime/readiness.cjs`) consumed
by the human status, the JSON status, `ready`, `done`, `start` (for dependencies),
`resume`, `change complete` and release. Lifecycle `done` and verification readiness
are distinct: an old done ticket can be stale or failed without its `finished` date
changing, and a `completed` change can be non-ready without its history changing.

| Code | Meaning | Next action |
| --- | --- | --- |
| `CHANGE_REQUIRED` | no change record names this PRD | `register` or `migrate` |
| `MIGRATION_REQUIRED` | legacy receipts or a schema 1 binding exist and the command needs changes-mode state | `migrate --preview` |
| `REVISION_CHANGED` | PRD content differs from the bound revision (migrated), or from the passing attempt's (changes) | `register --rebind` (migrated); `change revise`, then `verify` (changes) |
| `CHECK_CHANGED` | the Verification block or timeout changed since the latest pass | `verify` |
| `SOURCE_CHANGED` | the source digest differs from the verified one (paths named) | `verify` |
| `CHECK_FAILED` | the latest attempt failed | fix, then `verify` |
| `ATTEMPT_RUNNING` | an attempt is `running` | wait, or `recover` if its owner died |
| `ATTEMPT_INTERRUPTED` | the latest attempt was interrupted | `verify` |
| `ATTEMPT_TIMED_OUT` | the latest attempt timed out | fix or raise `timeout`, then `verify` |
| `ATTEMPT_ERROR` | the latest attempt could not be recorded, is incomplete or malformed, belongs to another context or change, or mutated source | inspect the record, then `verify` |
| `EVIDENCE_MISSING` | no attempt, missing or altered log, or missing local state | `verify` |
| `LEGACY_RECEIPT` | only a migrated legacy receipt exists | `verify` |
| `HISTORICAL_EVIDENCE` | the latest attempt or evaluation predates migration to changes mode (schema 1) | `verify` |
| `CRITERIA_UNTICKED` | unticked acceptance criteria | tick verified criteria |
| `DEPENDENCY_BLOCKED` | a `depends_on` ticket is not ready | finish the dependency |
| `INPUT_INVALID` | malformed ticket, PRD, NOTES, or conflicting change records | repair the input |
| `MALFORMED` | a record, snapshot, selection, locator or manifest cannot be parsed or has the wrong shape | repair or remove the file by hand |
| `UNSUPPORTED_SCHEMA` | a record carries a schema this runtime does not read | update the kit, or restore the record |
| `HISTORY_INVALID` | a record's projection, event sequence, supersession chain or agreement snapshot disagrees with its history | repair the record by hand from its events and snapshots |
| `STATE_INCOMPLETE` | a committed transaction was not fully applied | `recover` |
| `STATE_CHANGED` | the record changed between preparing and committing an operation | inspect, then repeat the command against the current state |
| `SELECTION_REQUIRED` | no change is selected in this worktree | `change select <id>` |
| `SELECTION_INVALID` | the selected record is missing or unreadable | `change select <id>` or repair the record |
| `WRONG_CHANGE` | the ticket or PRD belongs to a change other than the selected one | `change select <id>` |
| `LIFECYCLE_BLOCKED` | the change's state does not permit the operation, or another change is active | the permitted operation is named |
| `BASE_MISMATCH` | the PRD is missing or the recorded base is not an ancestor of HEAD | check out the branch that carries the change, or register a new change |
| `AUTHORIZATION_REQUIRED` | the change has no authorization record | `change authorize` with the user's instruction |
| `AGREEMENT_CHANGED` | no authorization matches the current agreement | record the disposition: `change authorize` (user or `--delegated`) |
| `DECISION_REQUIRED` | a consequential decision is open | `change decide --resolve` with the user's decision |
| `CANDIDATE_STALE` | NOTES/evidence/locator do not describe HEAD (reason quoted) | `/pincer-evaluate` |
| `STATE_BUSY` | the lock is held | retry, or `recover` |
| `SECRET_PATH` | a secret file is in the source view | remove or ignore it |
| `UNSUPPORTED_INPUT` | symlink, submodule, no git, or a refused exclusion | remove the input or change the configuration |
| `INVENTORY_INVALID` | the PRD's requirement and scenario definitions violate the inventory grammar (line named) | repair the PRD definitions |
| `COVERAGE_INVALID` | the coverage map cannot be interpreted: missing file, malformed or duplicate-key JSON, unknown or missing keys, wrong types or IDs, duplicate entries, unsafe path, wrong change or PRD | repair `.prd/coverage/<id>.json` |
| `COVERAGE_INCOMPLETE` | the map is readable but its graph is incomplete: a live scenario without a row, an invented or stale row, a scenario without work or checks, an unclassified or wrong-change ticket, an undeclared check | author the missing rows, then `change authorize` |
| `OBLIGATION_MISSING` | a scenario of the baseline inventory is defined neither in the PRD nor as a `removed` tombstone in the map | restore it, or record the decision and the tombstone |
| `SCOPE_UNAUTHORIZED` | a deferral or removal has no resolved decision naming the ID, or no applicable user authorization covers that decision | `change decide`, then `change authorize` |
| `CHECK_UNDECLARED` | the check is not declared in the map, the supplied command or timeout differs from the declaration, the declaration changed since the command was prepared, or a review obligation was invoked as a command | declare it in the map, or run the declared form |
| `REVIEW_MISSING` | a required review obligation has no candidate-bound artifact with a passed result | perform the review and record it in the evaluation draft |
| `ADEQUACY_REQUIRED` | the adequacy judgment is missing or `inadequate` | record the reviewer's judgment in the evaluation draft |
| `HISTORY_UNAVAILABLE` | impact has no baseline agreement with an inventory snapshot | authorize the adoption agreement, then compare |
| `COVERAGE_UNVERIFIED` | label only, never a blocker: strict coverage is not adopted (legacy, migrated or schema 2) | `coverage adopt --preview --change <id>` when strict coverage is wanted |

Status JSON schema 1 (legacy and migrated modes; one object on stdout; diagnostics on
stderr; no progress text, no secret values):

```
{ schema: 1, runtime: 1, generated, root, mode: "legacy" | "migrated" | "invalid",
  change: { id, prd, prd_revision, base } | null,
  prd: { path, status, profile, date } | null,
  tickets: [ { id, file, status, size, depends_on, started, finished,
               readiness: { ready, reasons: [ { code, detail } ], next },
               latest_attempt: { id, sequence, outcome, started, finished } | null,
               legacy_receipt: { verified, last_check } | null } ],
  history: <tickets of other PRDs>,
  candidate: { notes: "current" | "stale" | "missing", reason, candidate, base,
               evidence: { manifest, schema, provenance: "runtime" | "legacy" | null, verdict },
               local_attempts: "available" | "unavailable",
               reasons: [ { code, detail } ] },
  reasons: [ { code, detail } ], next }
```

Status JSON schema 2 (changes mode) keeps every schema 1 field with `mode: "changes"`
and `runtime: 2`, and adds:

```
{ schema: 2, …,
  selection: { change | null, problem: { code, detail } | null },
  changes: [ { id, prd, state, since, selected, authorization: "current" | code, agreement: <digest or null> } ],
  change: { id, prd, prd_revision, base, sequence,
            lifecycle: { state, since, reason, note, superseded_by },
            agreement: { current, authorized: { id, agreement, digest, disposition, recorded } | null, verdict, open_decisions: [ "D-NN" ] },
            view: { head, branch, base_is_ancestor, dirty: [ paths ] } } | null,
  candidate: { …, locator: ".prd/evidence/changes/<id>.json" | null, evaluation: { candidate, base, manifest, recorded } | null } }
```

`tickets` are the selected change's; without a selection `tickets` is `[]`, `change`
is `null` and `reasons` starts with `SELECTION_REQUIRED`. `mode: "invalid"` (with the
problem in `reasons`) is reported when `.prd/changes/` mixes schemas or holds a file
the runtime cannot read: such a project is never reported as legacy or migrated.
`status` exits 0 when inspection succeeded; `ready` exits 1 for non-ready work; both
exit 4 on invalid input.

## Evidence schema 2

Schema 2 keeps every schema 1 field and rule and adds:

- top-level `change`: `{ id, prd_revision, base }` copied from the change record; its `base`
  is HEAD at registration and may precede the evaluation `base` the manifest records;
- `provenance` on every check: `runtime` for command checks populated from attempts,
  `authored` for review and visual checks and for a command check recorded as
  `unverified` because its tool could not run; a `passed` or `failed` command check
  must be `runtime`;
- `attempt` on runtime command checks: `{ id, sequence, outcome, exit_code, started,
  finished, source_before, source_after, check_digest, runner, cwd, log_sha256,
  truncated }`; the check's log artifact digest must equal `log_sha256`, `result` must
  agree with `outcome` (`passed` → `passed`; `failed`, `timed_out`, `interrupted` →
  `failed`; `error` → `unverified`), and `command` is the attempt's display text.

`evidence export` reads a draft JSON containing the authored fields (`environment.tools`,
`environment.limitations`, `coverage_review`, `requirements`, review and visual checks
with artifact paths, `visual_review`, and command check stubs `{ id, kind: "command",
required }`), refuses when any command stub has no attempt for the candidate, writes
`checks/C-NN.log` (the command line, then stdout, then stderr, with truncation notes),
fills the runtime fields, computes `artifacts` digests, writes `manifest.json` and
validates it. It never invents a review transcript or converts a review judgment into a
command result. In changes mode the attempts it consumes must be schema 2 records of
the selected change (a schema 1 record or another change's record is refused), and the
manifest's `change.prd_revision` is the PRD revision the attempts recorded.

`check` refuses unless HEAD is `--candidate` (or a descendant that differs from it
only in `NOTES.md`, evidence directories of that candidate commit
(`.prd/evidence/prd-v*/<candidate>/`) and evaluation locators, such as the evaluate
commit of this or another change of the same candidate), the record is current, and
`git status --porcelain --untracked-files=all` lists nothing outside those same paths;
it never stashes, resets or commits.

Validation: `node scripts/pincer-evidence.cjs validate <manifest> …` accepts schema 1
and 2 and prints `ok <candidate>` for schema 1 (unchanged) and `ok <candidate>
schema 2` for schema 2. The draft for `evidence export` should live outside the
evidence directory and the source view, for example `.pincer/drafts/<candidate>.json`. Status labels schema 1 `provenance:
legacy (schema 1, authored command results)` and schema 2 `provenance: runtime`. A
schema 1 manifest cannot satisfy a requirement for runtime evidence. Release
readiness additionally requires that no newer local attempt for the same candidate and
check with the same source digest is nonpassing; a fresh clone without
local attempt history (no `.pincer/runtime/index.json`; a selection alone is not
history) reports `local verification history unavailable; saved candidate
evidence validated only`. Local capture establishes provenance and mistake detection,
not tamper-proof attestation.

## Evaluation locator

In changes mode the evaluations of a change are located by
`.prd/evidence/changes/<change-id>.json`, tracked in git, written only by
`evidence export` (appending) through a transaction:

```json
{ "schema": 1, "change": "prd-v2", "evaluations": [ { "candidate": "9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d", "base": "3f2a1c9d5b7e4a6f8c0d2e1b9a7c5e3d1f0b8a6c", "prd": ".prd/prd-v2.md", "prd_revision": "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00", "agreement": "5a1e0c9d3b7f2e4a6c8d0b1f3e5a7c9d1b3f5e7a9c1d3f5b7e9a1c3d5f7b9e1a", "manifest": ".prd/evidence/prd-v2/9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d/manifest.json", "recorded": "2026-09-12T12:00:00Z" } ] }
```

The latest entry is the change's evaluation. The locator lives under the fixed source
exclusion `.prd/evidence/`, is not listed in any manifest (so no digest refers to
itself), and is one of the paths allowed to differ from the candidate. The
candidate of a change is "current" when the latest entry's manifest validates for its
candidate, base and PRD and records this change, the candidate is an ancestor of HEAD,
and the diff from the candidate to HEAD plus the dirty tree contain nothing but the
candidate's followers; otherwise `CANDIDATE_STALE` with the reason quoted. The
followers are computed from validated content, never from a directory or filename
pattern: `NOTES.md`; every locator under `.prd/evidence/changes/` that parses and
validates for its own id; and, for each locator entry naming this candidate whose
manifest validates with file digests for its candidate, base and PRD, that manifest
and the files it lists (so two changes can evaluate one candidate in turn). Every
other path is a candidate change: an unlisted file inside an evidence directory, a
listed artifact whose digest no longer matches, a locator that does not parse or
names another id, and directories of other candidates. `check` and `evidence export`
additionally allow the PRD's own `.prd/evidence/prd-vN/<candidate>/` directory while
the evaluation is being assembled. An entry whose manifest is missing, whose `change`
differs from the locator's, or that names another change's candidate is `MALFORMED`
and never revives readiness. Root
`NOTES.md` remains the human summary of whichever change was evaluated last;
overwriting it for another change loses nothing. Release (`ready` without a ticket,
`/pincer-release`) reads the selected change's lifecycle (`completed` required), its
authorization verdict, the locator, the manifest and the latest applicable attempts;
it selects nothing, completes nothing, runs nothing and writes nothing.

## Resume report

`resume [--change <id>] [--json]` is read-only inspection of the selected (or named)
change for a fresh session; it is distinct from `change resume`, the lifecycle
operation. It launches no check, records no approval, changes no selection and writes
no file; repeated runs are byte-identical apart from `generated`. Resume JSON schema 1:

```
{ schema: 1, runtime: 2, generated, root, mode,
  selection: { change | null, problem: { code, detail } | null },
  change: { id, prd, prd_revision, base, registered, sequence,
            lifecycle: { state, since, reason, note, superseded_by },
            view: { head, branch, base_is_ancestor, dirty: [ paths ] } } | null,
  agreement: { current: <digest> | null, authorized: { id, agreement, digest, disposition, reference, excerpt, constraints, recorded } | null,
               verdict: "current" | code, difference: { prd_changed, tickets_added: [], tickets_removed: [], tickets_changed: [ { id, parts: [] } ] } | null,
               decisions: { open: [ { id, summary, raised } ], resolved: [ { id, summary, reference, resolved } ] } },
  references: { prd: { path, title }, snapshot: path | null, tickets: [ { id, file, objective } ] },
  tickets: [ <status ticket entries> ],
  attempts: [ { ticket | check, id, outcome, started, finished, current: boolean } ],
  candidate: <status candidate object>,
  handoff: { kind: "pause" | "reopen" | null, reason, note, since, authored: true } | null,
  blockers: [ { code, detail } ],
  next: { action, command, ticket | check | null } }
```

`references` quotes only titles, paths and the first line of each ticket's Objective:
the agreed outcome and constraints are read from the authored artifacts the report
names (the PRD, the tickets, the agreement snapshot), not paraphrased by the runtime.
`handoff` is the authored pause or reopen reason and note, labeled `authored: true`; it
is displayed and never used as an input to `blockers`, `next` or any readiness value,
so a note claiming approval or success changes nothing computed. Human output prints
the same fields as labeled lines (`Change`, `Lifecycle`, `View`, `Agreement`,
`Authorization`, `Decisions`, `Tickets`, `Candidate`, `Handoff (authored)`,
`Blockers`, `Next`) with the raw reason codes and details kept verbatim.

Next-action precedence (the first matching rule wins; `next.command` is the exact
command to run):

1. invalid or missing state (`INPUT_INVALID`, `MALFORMED`, `UNSUPPORTED_SCHEMA`, `HISTORY_INVALID`, `STATE_INCOMPLETE`) or no selection (`SELECTION_REQUIRED`, `SELECTION_INVALID`) → repair, `recover` or `change select`;
2. an unresolved `running` attempt of the change → wait or `recover`;
3. lifecycle or repository mismatch (`cancelled`/`superseded` → inspect or register a replacement, never execute; `BASE_MISMATCH` → check out the branch; `planned`/`paused` → `change activate`/`change resume` once 4 is satisfied);
4. agreement, decision or coverage gap (`DECISION_REQUIRED`, `AUTHORIZATION_REQUIRED`, `AGREEMENT_CHANGED`; in a strict change also `COVERAGE_INVALID`, `COVERAGE_INCOMPLETE`, `OBLIGATION_MISSING`, `SCOPE_UNAUTHORIZED` — "Strict coverage") → `change decide --resolve` / `change authorize` / repair the map;
5. failed or stale verification or unfinished work → `verify T-NN` naming the ticket (or `check C-NN`), or `start T-NN` for the next ready ticket;
6. everything done and ready but not `completed` → `change complete`;
7. `completed` without a current evaluation → `/pincer-evaluate`;
8. evaluated and current → `/pincer-release` (read-only audit).

## Migration and rollback

`migrate --preview --prd .prd/prd-vN.md` prints the plan and writes nothing. It exits 0
when apply would proceed and 1 when a conflict would stop it. Conflicts (all fail
closed, before the first write): malformed or unsupported records, records mixing
schemas, a ticket of another PRD with the same ID, a PRD owned by another schema 2
record, an incomplete transaction. Two sources are migrated:

- from legacy: each ticket of that PRD whose `verified`/`last_check` lines would be
  removed and recorded as `legacy.receipts`, the `.gitignore` line, the schema 2
  record (`planned`, event 1 `migrate`, `legacy.migrated_from: "legacy"`), the local
  selection it sets in this worktree;
- from a schema 1 binding: the record it becomes (same change ID, `prd`, `base` and
  `registered`; `legacy.receipts` carried over; the binding's free-text `authorization`
  stored as `legacy.authorization_text`; `migrated_from: "binding"`), the local index
  pointers rewritten from `candidate:<sha>:<C-NN>` to `candidate:<id>:<sha>:<C-NN>`,
  and the selection it sets.

In both cases the preview states that the migrated change is `planned` with no
authorization, that its existing attempts and evaluations stay as history
(`HISTORICAL_EVIDENCE`) until verified again, and that `--authorization <text>` is
retained as unvalidated text only. An actual earlier instruction of the user is recorded
afterwards with `change authorize`, without asking the user again. A project without
receipts or binding needs no migration: `register` writes a schema 2 record directly.

`migrate --apply` is one transaction: it backs up every authored file it changes
(tickets, `.gitignore`, the schema 1 binding) under
`.pincer/backups/<UTC timestamp>/<original path>`, stages the rewritten tickets,
`.gitignore`, the record, the selection and the index, and commits them together, so
an interruption leaves either the unmigrated project or the migrated one (`recover`
completes a committed apply). Repeated apply reports `already migrated` and changes
nothing; a partially applied v0.5.0 migration (binding present, receipts remaining)
is completed in the same apply. Imported receipts are history: a migrated done ticket
reports `HISTORICAL_EVIDENCE` or `LEGACY_RECEIPT` until a runtime attempt exists,
without changing `finished`. Installation and update deploy the runtime files and
`doctor` reports when a migration is available; neither migrates.

Rollback is one procedure per migration source; the backups are byte-identical
originals, and neither procedure deletes a file it has just restored.

- Rollback from legacy: restore the backed-up tickets and `.gitignore` from
  `.pincer/backups/<timestamp>/`; delete the schema 2 record `.prd/changes/<id>.json`
  and, if present, its snapshot directory `.prd/changes/<id>/`; remove `.pincer/` (a
  legacy project has no runtime state to keep). The project is legacy again with its
  original receipts.
- Rollback from a v0.5.0 binding: restore the backed-up binding to
  `.prd/changes/<id>.json` — it overwrites the schema 2 record, which lives at the same
  path, so nothing under `.prd/changes/` is deleted except, if present, the snapshot
  directory `.prd/changes/<id>/`; restore the backed-up `.pincer/runtime/index.json`
  (the migration rewrote its candidate pointers) and remove
  `.pincer/runtime/selection.json`; keep the rest of `.pincer/runtime/` so the old
  attempts and stored manifests remain. The project is migrated (v0.5.0) again with
  its original binding and history.

The backup directory can be removed afterwards. An older runtime does not enforce the
runtime guarantees: it will accept the restored receipts as it did before.

## Strict coverage

Strict coverage (PRD v6) is an explicit, retained capability of one change: the
runtime derives the complete requirement and scenario inventory from the change's
PRD, validates one authored coverage map against it, binds both into the reviewed
agreement, derives structural, implementation and candidate coverage from that graph,
explains structural impact, executes candidate checks from their declarations, and
reconciles the exported evidence with the committed candidate's authored inputs.
Nothing switches a change into strict coverage implicitly: `coverage adopt --apply`
is the only entry, it is recorded in the change record (schema 3), and a project or
change without it keeps the documented behavior above with its coverage labeled
`unverified`. A report never implies that strict coverage was established where it
was not adopted. Semantic adequacy — whether a check really establishes its scenario —
remains a named reviewer judgment (`adequacy`) and is never computed.

Versions frozen by this section: change records `schema: 3` (`runtime: 3`), attempts
`schema: 3` (`runtime: 3`), evidence manifests `schema: 3`, status JSON `schema: 3`
(changes mode), resume JSON `schema: 2`, agreement projection `pincer agreement 2`,
agreement snapshots `schema: 2`, coverage map `schema: 1`, inventory projection
`pincer inventory 1`, evidence snapshots (`coverage/inventory.json`,
`coverage/map.json`) `schema: 1`, coverage JSON `schema: 1`, impact JSON `schema: 1`.
A v0.5.0 runtime (reads change binding schema 1) and a PRD v5 runtime (reads change
records schema 2 and attempts schema 1 and 2, validates evidence schema 1 and 2)
refuse every new schema as `UNSUPPORTED_SCHEMA` (records, evidence) or as an
incomplete record (`ATTEMPT_ERROR` for attempts); neither ever interprets a strict
change through the older logic. This runtime keeps reading schema 2 records, schema 2
attempts and schema 2 evidence exactly as documented above.

### Requirement inventory

The PRD of a strict change is parsed into an inventory: the complete set of
requirement and scenario definitions. The PRD prose is authoritative — the coverage
map cannot add, rename or remove a definition — and parsing produces a computed view,
never a second editable source. The grammar is bounded on purpose; syntax outside it
is either ignored as prose or refused as unsupported, and no partial inventory is
ever treated as complete.

- **Identifiers:** `<PREFIX>-<digits>` matching `[A-Z][A-Z0-9]{0,7}-[0-9]{1,6}` (the
  template's `R-01`/`S-01`, or a supplied PRD's `REQ-1`/`AC-12`). Requirement and
  scenario IDs share one namespace within the PRD. IDs are kept verbatim: nothing is
  renumbered, padded or generated. What makes an ID a requirement or a scenario is
  the definition form, not the prefix.
- **Fenced code:** a line whose first non-blank characters are three or more
  backticks opens a fence; the next such line closes it; every line in between is
  ignored (no definition, no reference). A fence still open at the end of the file is
  `INVENTORY_INVALID` (`unclosed fence opened at line N`). A tilde fence line is
  `INVENTORY_INVALID` (`tilde fences are unsupported (line N)`).
- **Tables and quotes:** a line whose first non-blank character is `|` or `>` is a
  reference context: it is prose and defines nothing.
- **Requirement definition:** an ATX heading of level 2, 3 or 4 whose text is an ID,
  a separator (` — `, ` – `, ` - ` or `: `) and a nonempty title:
  `### R-01 — Derive the complete authored inventory`. Its section runs to the next
  requirement definition, or to the next heading whose level is less than or equal
  to its own, whichever comes first. A heading whose text starts with an ID in any
  other shape (no separator, no title, a separator with nothing after it) is
  `INVENTORY_INVALID` (`unsupported requirement definition syntax at line N; use
  "### R-NN — Title"`).
- **Scenario definition:** a list item inside a requirement section whose text is a
  bold ID, optionally followed by a colon inside or after the bold, then nonempty
  text: `- **S-01:** A PRD with two requirements …`. Markers `-`, `+`, `*` and
  indentation are supported; an optional checkbox mark (`[ ]`, `[x]`, `[X]`) may
  precede the bold ID. Lines that follow the item, are indented by at least two
  spaces or a tab, and are not themselves list items, headings, fences or table rows
  are the item's continuation lines. A list item whose text begins with an ID
  followed by `:` or `.` without the bold form, or a bold ID with nothing after it,
  is `INVENTORY_INVALID` (`unsupported scenario definition syntax at line N; use
  "- **S-NN:** text"` / `empty definition S-NN at line N`).
- **References:** an ID anywhere else — in prose, in a list item that does not start
  with the ID, in a table row, inside a fence, in a heading that is not a definition
  form because the ID is not first — defines nothing and creates no error.
- **Membership rules, each `INVENTORY_INVALID` with the line named:** a duplicate
  definition of an ID (requirement or scenario, in any combination); a scenario
  definition outside every requirement section (`orphan scenario S-NN at line N`);
  a requirement with no scenario (`requirement R-NN at line N has no scenario`);
  an empty requirement title; a PRD with no requirement definition at all (`no
  requirement definitions`). Every scenario therefore has exactly one owning
  requirement: the section it appears in.
- **Source locations:** each definition records `{ line, end }` (1-based, inclusive):
  the section for a requirement, the item and its continuation lines for a scenario.
- **Normalized content:** a requirement's text is its title, then the lines of its
  section outside scenario definitions and their continuations, each right-trimmed,
  with leading and trailing blank lines removed and runs of blank lines collapsed to
  one; a scenario's text is the item text after the bold ID (marker, checkbox mark
  and bold ID removed) followed by its continuation lines with their indentation
  removed, joined by `\n`, right-trimmed. The frontmatter is not part of any
  definition, so the PRD `status` line (already excluded from `prd_revision`) never
  reaches a definition either. Checkbox marks and whitespace-only edits therefore
  preserve identity; any change to a scenario's wording changes its digest.
- **Digests:** requirement `SHA-256("requirement <ID>\n<text>\n")`, scenario
  `SHA-256("scenario <ID>\n<text>\n")`. The inventory projection is the exact text

  ```
  pincer inventory 1
  prd <.prd/prd-vN.md>
  requirement <ID> <digest>              (one line per requirement)
  scenario <ID> <owner ID> <digest>      (one line per scenario)
  ```

  each line terminated by `\n`, requirements and scenarios each sorted by ID (prefix
  in byte order, then numerically), and the inventory digest is SHA-256 over it.
  Reordering sections changes `prd_revision` but not the inventory digest; moving a
  scenario to another requirement changes the inventory digest (the owner line) but
  not the scenario digest.

Example of a valid PRD body (two requirements, three scenarios; the table row, the
prose mention and the fenced block create no definitions; the checkbox mark on
`S-02` is normalized away):

````markdown
### R-01 — Parse the inventory

Every definition is derived from the PRD prose. S-01 and S-02 belong here.

- **S-01:** A PRD with two requirements and three scenarios yields exactly those
  IDs, parent links, content digests and source locations.
- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.

| Scenario | Ticket |
| --- | --- |
| S-01 | T-01 |

```markdown
- **S-99:** an example inside a fence is not a definition
```

### R-02: Report impact

- **S-03** — Changing one scenario names that scenario and its requirement.
````

Its projection is `pincer inventory 1`, `prd .prd/prd-v1.md`, `requirement R-01 …`,
`requirement R-02 …`, `scenario S-01 R-01 …`, `scenario S-02 R-01 …`,
`scenario S-03 R-02 …`. The same body with `### R-01 — Parse the inventory` repeated
is `INVENTORY_INVALID: duplicate definition R-01 at line N`; with `- **S-03** —`
moved above the first heading, `orphan scenario S-03 at line N`; with `- S-04: text`
under R-02, `unsupported scenario definition syntax at line N`; with `### R-03 —`
and no scenario, `requirement R-03 at line N has no scenario`; with the closing
fence deleted, `unclosed fence opened at line N`.

A PRD that is not a strict change's PRD (legacy or migrated mode, or a schema 2
record) is never parsed for a verdict: status, resume and `coverage` label such a
change `coverage: unverified`, and inventory diagnostics for it are informational,
never blockers. Old PRDs stay readable by `validate` exactly as before.

### Coverage map

`.prd/coverage/<change-id>.json` is the authored coverage map of a strict change,
tracked in git and edited by hand. It owns links and planned scope dispositions and
declares the candidate checks; it never owns requirement prose or observed outcomes.
Coverage map schema 1, with every key required and no other key allowed:

```json
{
  "schema": 1,
  "change": "prd-v2",
  "prd": ".prd/prd-v2.md",
  "scenarios": {
    "S-01": { "tickets": ["T-03"], "checks": ["C-01"] },
    "S-02": { "tickets": ["T-03", "T-04"], "checks": ["C-01", "C-02"] }
  },
  "scope": {
    "S-03": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": "deferred to the next change; see D-01" },
    "S-04": { "disposition": "removed", "decision": "D-02", "prior": "G-02", "note": null }
  },
  "tickets": {
    "T-03": { "role": "implements", "rationale": null },
    "T-04": { "role": "implements", "rationale": null },
    "T-05": { "role": "enables", "rationale": "shared fixture harness used by C-01 and C-02; implements no scenario" }
  },
  "checks": {
    "C-01": { "kind": "command", "required": true, "command": "npm test", "timeout": 600, "cwd": null, "obligation": null, "note": null },
    "C-02": { "kind": "review", "required": true, "command": null, "timeout": null, "cwd": null, "obligation": "read the error-state rendering of S-02 against the mock-ups", "note": null }
  }
}
```

The map is parsed strictly: a JSON object with a duplicate key anywhere, a file
larger than 1 MiB, a value of the wrong type, an unknown key, a missing key, an ID
that does not match its grammar, a string longer than 2000 characters, an array
with a duplicate entry, `schema` other than 1, `change` other than the record's ID
(and the filename), `prd` other than the record's PRD, or an unsafe path is
`COVERAGE_INVALID` (exit 4) before any mutation or launch. Paths (`prd`, `cwd`) are
repository-relative POSIX paths without `..`, `.` or empty segments; the map file,
the PRD and a `cwd` must be regular files or directories inside the repository, not
symbolic links and not reached through one. Whole-file rules:

- `scenarios` keys and `scope` keys are scenario IDs. Every scenario of the live
  inventory appears exactly once, in `scenarios` or in `scope`. A `scenarios` key that
  is not a live scenario (an invented ID, a requirement ID, a scenario that the PRD no
  longer defines) and a `scope` key that is neither a live scenario nor a `removed`
  tombstone are `COVERAGE_INCOMPLETE`, as is a live scenario missing from both.
- A `scenarios` entry has `tickets` (nonempty array of ticket IDs) and `checks`
  (nonempty array of check IDs); every ticket named must be a ticket of this change
  with role `implements`, every check named must be declared. A ticket that does not
  exist, belongs to another PRD (`WRONG_CHANGE` is reported inside the
  `COVERAGE_INCOMPLETE` detail), is listed as `enables`, or is unlisted, and a check
  that is not declared, are `COVERAGE_INCOMPLETE` naming the scenario and the ID.
- `tickets` lists every ticket of the change (every valid ticket whose PRD is the
  record's PRD) exactly once with `role` `implements` (referenced by at least one
  `scenarios` entry) or `enables` (referenced by none, with a nonempty `rationale`).
  An unlisted ticket, a listed ID that is not a ticket of this change, an
  `implements` ticket no scenario references and an `enables` ticket some scenario
  references are `COVERAGE_INCOMPLETE`. `rationale` is `null` for `implements`.
- `scope` entries carry `disposition` (`deferred` or `removed`), `decision` (`D-NN`),
  `prior` (`null` for `deferred`; for `removed` the agreement ID `G-NN` of this change
  whose inventory snapshot defines the ID — the tombstone's reference to the prior
  inventory) and `note` (`null` or text). Whether the decision exists, is resolved,
  names the ID and is covered by an applicable user authorization is decided by
  "Scope dispositions", not by the map syntax.
- `checks` declares candidate checks by stable ID `C-NN`. `kind` is `command`,
  `review` or `visual`; `required` is a boolean. A `command` check has `command`
  (nonempty, at most 2000 characters, valid Bash syntax under `bash -n`, no inline
  secret-like literal — the sanitizer's rule), `timeout` (a positive integer number of
  seconds, at most 2147483), `cwd` (`null` or a safe directory path) and `obligation`
  `null`. A `review` or `visual` check has `obligation` (nonempty text: what the
  reviewer must establish) and `command`, `timeout`, `cwd` `null`. `note` is `null`
  or text. A declared check may be referenced by several scenarios or by none; a check
  referenced by a scenario must be declared. A declaration is never an observed
  result.
- Definition digests: a `command` check's is `SHA-256("<command>\ntimeout=<timeout>\n")`
  — exactly the check digest an attempt records, so an attempt satisfies a declaration
  only when its `check.digest` equals it; a `review`/`visual` check's is
  `SHA-256("<kind>\n<obligation>\n")`.
- The map digest is SHA-256 over the normalized map text: the parsed object
  serialized as JSON with object keys sorted, the ID arrays (`tickets`, `checks`)
  sorted in the inventory's ID order, no insignificant whitespace, one trailing
  newline. Reformatting or reordering the file changes nothing; every value edit
  changes the digest.

`COVERAGE_INVALID` means the file cannot be interpreted; `COVERAGE_INCOMPLETE` means
it is interpretable but the graph it describes is incomplete or disagrees with the
inventory and the tickets. Both refuse execution and export; the detail names every
affected ID. The map module exposes one validated graph (inventory, links,
declarations, dispositions) that every consumer — coverage, impact, gates,
completion, `check`, export, release, status and resume — reads; no consumer keeps a
policy copy, and validation writes no file.

### Strict change records

A strict change's record is `.prd/changes/<id>.json` with `schema: 3` and
`runtime: 3`: every schema 2 key with the same owners and rules, plus:

| Field | Owner | Value |
| --- | --- | --- |
| `coverage` | `coverage adopt --apply` | `{ map: ".prd/coverage/<id>.json", adopted: <timestamp>, agreement: "G-NN" }` — the capability, when it was recorded, and the adoption agreement (the reviewed starting inventory) |

Event kind `adopt` is added: it carries `from = to =` the state at the time and
`agreement: "G-NN"`. Exactly one `adopt` event exists in a schema 3 record, its
`agreement` equals `coverage.agreement`, and that agreement entry carries the
projection version 2 digests. Agreement entries in a schema 3 record carry two
more fields, `inventory` and `coverage` (the inventory and map digests, 64 hex;
`null` on entries recorded before adoption, which are projection version 1). A
schema 3 record without `coverage`, with `coverage: null`, or with no `adopt` event
is `MALFORMED` (`the strict coverage capability cannot be removed by editing the
record; restore the backed-up schema 2 record instead`); a schema 2 record carrying a
`coverage` key or an `adopt` event is `MALFORMED` under this runtime and under the
PRD v5 runtime alike. Schema 2 and schema 3 records coexist in one `.prd/changes/`
directory (each change adopts on its own); a schema 1 binding next to either is
`INPUT_INVALID` as before. A schema 3 record read by a v0.5.0 or PRD v5 runtime is
`UNSUPPORTED_SCHEMA`.

Agreement projection version 2, computed for strict changes only (schema 2 records
keep version 1):

```
pincer agreement 2
change <change id>
prd <.prd/prd-vN.md> <prd_revision>
inventory <inventory digest>
coverage <.prd/coverage/<id>.json> <map digest>
ticket <T-NN> <ticket_digest>          (one line per ticket of the PRD, ascending numeric ID)
decision <D-NN> <decision digest>      (one line per resolved decision, ascending ID)
```

each line terminated by `\n`. The inventory digest and the map digest are agreement
inputs, so editing a scenario's text, a link, a declared command or timeout, a
scope disposition or a tombstone changes the agreement and invalidates the
authorization (`AGREEMENT_CHANGED`), while the PRD `status` line, ticket lifecycle
fields and ticket checkbox marks, attempts, generated reports and evidence do not. A
checkbox mark on a scenario line keeps the inventory digest but is a PRD body edit
("Content revisions"), so it changes `prd_revision` and with it the agreement. When the
inventory or the map cannot be read the agreement cannot be computed:
`INVENTORY_INVALID` or `COVERAGE_INVALID` replaces `INPUT_INVALID` in every place
the contract says the agreement is computed (a missing map is `COVERAGE_INVALID`:
`author .prd/coverage/<id>.json first`). An incomplete map still yields an agreement:
completeness is a coverage gate ("Phase-specific coverage"), not an input error, so a
user may authorize an incomplete map and strengthen it later.

Agreement snapshot schema 2 (strict changes; `.prd/changes/<id>/agreements/G-NN.json`)
keeps every schema 1 key and adds:

```json
{ "schema": 2, "change": "prd-v2", "agreement": "G-03", "digest": "<64 hex>", "projection": "pincer agreement 2\nchange prd-v2\n…", "prd": { "path": ".prd/prd-v2.md", "revision": "<64 hex>", "text": "<normalized PRD text>" }, "inventory": { "digest": "<64 hex>", "projection": "pincer inventory 1\nprd .prd/prd-v2.md\n…", "requirements": { "R-01": { "title": "Parse the inventory", "text": "<normalized text>", "digest": "<64 hex>", "line": 40, "end": 58, "scenarios": ["S-01", "S-02"] } }, "scenarios": { "S-01": { "requirement": "R-01", "text": "<normalized text>", "digest": "<64 hex>", "line": 44, "end": 45 } } }, "coverage": { "path": ".prd/coverage/prd-v2.json", "digest": "<64 hex>", "text": "<normalized map text>" }, "tickets": { "T-03": { "file": "tickets/T-03-slug.md", "digest": "<64 hex>", "text": "<normalized ticket text>" } }, "decisions": { "D-01": { "summary": "…", "reference": "…", "excerpt": "…" } }, "recorded": "2026-09-12T08:05:00Z" }
```

`readSnapshot` recomputes the inventory projection from the snapshot's own
requirement and scenario digests, the map digest from the normalized map text, and
the agreement digest from the projection; any disagreement with the record entry is
`HISTORY_INVALID`, so an old agreement's inventory and map can always be reviewed
from the file alone. Snapshot schema 1 entries (recorded before adoption) stay valid
in a schema 3 record and are compared as "history unavailable" for inventory purposes.

Attempt schema 3 (strict changes): every schema 2 field, plus `context.inventory`
and `context.coverage`, the inventory and map digests at launch (64 hex, required).
The runtime writes schema 3 attempts for a strict change and reads schema 1, 2 and 3
records; readiness validates the context fields as it validates `agreement`. In a
strict change a pointed-at schema 2 record (recorded before adoption) is
`HISTORICAL_EVIDENCE`: it stays inspectable, never becomes current evidence, and the
next action is `verify`. A schema 3 record read for a schema 2 change is
`ATTEMPT_ERROR`. Context keys are unchanged. For a candidate attempt of a strict
change the recorded `check.digest` is the declaration's digest by construction (the
runtime builds the command from the map), and export compares it with the
declaration current on the candidate.

### Scope dispositions

A scope disposition records that an obligation is not delivered by this change. It
is never inferred from a failing check, a missing ticket, a `blocked` requirement or
free text. Two dispositions exist, both authored in the map's `scope`:

- `deferred`: the scenario stays defined in the PRD and is not implemented by this
  change. Requires a resolved decision `D-NN` of this change whose `summary` or
  `excerpt` names the scenario ID as a whole token.
- `removed`: the obligation is withdrawn. The entry is a tombstone: `decision` as
  above and `prior: "G-NN"`, an agreement entry of this change whose inventory
  snapshot defines the ID. The ID may still be defined in the PRD (withdrawn but
  documented) or absent from it; in both cases the tombstone is the only way an ID
  that was once reviewed can stop being an obligation.

A disposition is *authorized* when its decision exists on this record, is
`resolved`, names the ID, and an applicable user authorization covers it: an
authorization `A-NN` of this record with disposition `user` that lists the decision
in its `decisions`, such that an authorization binding the current agreement (any
one the `current` verdict accepts) is `A-NN` itself or a `delegated` authorization
whose `basis` chain reaches `A-NN`. Anything else is `SCOPE_UNAUTHORIZED` naming the ID
and the missing element (`no decision`, `decision D-NN is open`, `decision D-NN does
not name S-03`, `no user authorization names D-NN`, `the current authorization A-04
does not descend from A-02`). A delegated authorization can therefore bind a
strengthened map (a stricter command, an added check, a new link) without a new
user instruction, and can carry a user's earlier scope decision forward through its
basis chain, but it can never create the scope decision: `authorized_by` free text
and `--constraints` text are never consulted. The runtime checks reference
integrity and agreement currency; whether the user's words really support the
disposition is a reviewer's judgment, which status and coverage label as such
(`decision D-01 "…" (reviewer judgment: the excerpt must support the deferral)`).

Deleted obligations are detected against the retained history, never against the
current files alone. The *baseline* of a strict change is the union of the
inventories of its retained agreement snapshots — the adoption agreement and every
agreement recorded after it, authorized or not — so an obligation that was ever
reviewed stays one. Every scenario of the baseline that is neither defined in the
live inventory nor a `removed` tombstone in the map is `OBLIGATION_MISSING` naming the
IDs and the latest agreement that defined each: deleting the prose and the map row
together erases nothing, and neither does authorizing the reduced agreement (a user
or delegated authorization records approval of the inputs; only a decision with its
tombstone withdraws an obligation). A first adoption can only establish its reviewed
starting inventory: no baseline exists before the adoption agreement, so nothing
predating it is ever reported as an omission. An
open decision blocks execution (`DECISION_REQUIRED`) whatever the current digest is,
so reverting the PRD and the map to an earlier authorized digest cannot bypass a
retained open decision; and `change authorize`, `change decide --resolve` and
`coverage adopt --apply` refuse with `AGREEMENT_CHANGED`/`STATE_CHANGED` when the
inputs or the record changed after the operation was prepared.

### Phase-specific coverage

Coverage is one pure computation over the validated graph (the inventory, the map,
the record, the tickets and their readiness, the evaluation), consumed by `coverage`,
`change complete`, `evidence export`, `ready`, status and resume. It has three
separate fields; none implies another, and a linked check, a passing syntax check
or a done ticket never implies candidate delivery:

| Field | Complete when | Blocking codes |
| --- | --- | --- |
| `structure` | the inventory and the map are valid; every live scenario is linked (tickets and checks) or dispositioned; every ticket is classified; every disposition is authorized; no baseline obligation is missing | `INVENTORY_INVALID`, `COVERAGE_INVALID`, `COVERAGE_INCOMPLETE`, `SCOPE_UNAUTHORIZED`, `OBLIGATION_MISSING` |
| `implementation` | `structure` is complete and every ticket of the change is `done` and ready under the v5 rules (checked criteria; current passing schema 3 attempt of this change; no `SOURCE_CHANGED`, `CHECK_CHANGED`, `REVISION_CHANGED`, `HISTORICAL_EVIDENCE`) | the structure codes, then the ticket's readiness code prefixed by its scenario (`S-02: T-03 CHECK_FAILED …`) |
| `candidate` | the change's latest evaluation is schema 3 evidence that validates and reconciles with the candidate; every in-scope scenario is `delivered`; `adequacy.verdict` is `adequate` | the structure codes, `EVIDENCE_MISSING`, `CANDIDATE_STALE`, `CHECK_FAILED`/`ATTEMPT_*` (a check), `REVIEW_MISSING`, `ADEQUACY_REQUIRED`, plus the v5 candidate reasons |

Per scenario the report carries `scope` (`in-scope`, `deferred`, `removed`),
`implementation` (`complete`, `unfinished` — a linked ticket is not `done`,
`unverified` — a linked ticket is done but not ready, with the code, `not applicable`
for dispositioned scenarios) and `candidate` (`delivered`, `blocked` with the failing
check or review, `deferred`, `removed`, `not evaluated`). `change complete` of a
strict change requires `structure` and `implementation` complete and refuses,
writing nothing, with the first blocking code in the table order; it never demands
candidate evidence, which cannot exist before the candidate. `evidence export`
requires `structure` complete. Release (`ready` without a ticket) requires
`candidate` complete. Coverage output labels the absence of candidate evidence and
the absence of an adequacy judgment explicitly (`candidate: not evaluated`,
`adequacy: not recorded`) and never prints `delivered` or `release-ready` for a
change whose evidence is missing, stale or judged inadequate.

### Declared candidate checks

In a strict change `check C-NN --candidate <sha>` runs the declaration: the map's
`command`, `timeout` and `cwd` for `C-NN`. A `--timeout` or a `-- <command>` on the
command line, an ID that is not declared, and a `review`/`visual` declaration
(recorded in the evidence draft, never run) are refused with `CHECK_UNDECLARED`
(exit 4) before anything is prepared; an arbitrary supplied command therefore cannot
become evidence for a declared check by reusing its ID. The old forms stay supported
unchanged in legacy, migrated and schema 2 changes mode. The guard for strict `check`
and `evidence export` is the v5 guard plus a valid inventory and map (gate order:
`INPUT_INVALID`/`INVENTORY_INVALID`/`COVERAGE_INVALID`/`MALFORMED`/… first, the rest
as documented). Under the attempt lock the guard runs again as for every attempt,
the map is re-read and re-validated, and the declaration of `C-NN` is recomputed: a
map or agreement change committed since the pre-launch evaluation refuses the
attempt with that gate's code, and a changed declaration whose agreement was
re-authorized meanwhile refuses with `CHECK_UNDECLARED` (`the declaration of C-NN
changed since the command was prepared`) — the attempt either launches the command
it validated against the inputs it recorded, or launches nothing and writes nothing.
The attempt's `context.agreement`, `context.inventory` and `context.coverage` are the
values validated under the lock. Changing a declaration stales every prior attempt
for that check (their `check.digest` no longer equals the declaration), and a
declaration's results are keyed by change and candidate (`candidate:<change>:<40
hex>:<C-NN>`), so another change's `C-01` is never borrowed.

Review obligations (`review` and `visual` declarations) are recorded in the
evaluation draft with an explicit `result` and at least one artifact saved under the
candidate's evidence directory (a passed `visual` check needs an image, as in schema
1). A required review obligation that is missing from the draft, `unverified`,
`failed` or without an artifact is `REVIEW_MISSING` and blocks export and release.
Passing every command check creates no review result and no adequacy judgment.

### Evidence schema 3

Schema 3 keeps every schema 2 field and rule and adds the complete reconciled
coverage of the candidate:

- `coverage`: `{ agreement, authorization, inventory, map, snapshots: { inventory, map } }`
  — the agreement digest (projection 2) the evaluation ran under, the ID of the
  authorization that covered it (`A-NN`), the inventory and map digests, and the two
  snapshot artifacts `<evidence dir>/coverage/inventory.json` (`{ schema: 1, prd,
  digest, projection, requirements, scenarios }`, the inventory computed from the
  candidate's PRD, in the snapshot schema 2 shape) and `<evidence dir>/coverage/map.json`
  (`{ schema: 1, path, digest, map }`, the parsed map). Both are listed in
  `artifacts` with their file digests like every artifact; neither carries a digest
  of the manifest, so no digest refers to itself.
- `scenarios`: one row per scenario of the inventory snapshot plus one per `removed`
  tombstone, `{ id, requirement, disposition, tickets, checks, decision, authorization,
  note }` with disposition `delivered`, `deferred`, `removed` or `blocked`.
- `requirements` rows are `{ id, disposition, tickets, checks, scenarios, decision,
  authorization, note }` (`authorized_by` is gone): one per requirement of the
  inventory snapshot; `delivered` when every scenario is delivered, `deferred` or
  `removed` when every non-delivered scenario carries that disposition (`removed`
  only when all do), `blocked` otherwise.
- `adequacy`: `{ verdict: "adequate" | "inadequate", note }`, authored in the draft:
  the reviewer's judgment that the delivered checks establish their scenarios.
  `note` is nonempty.
- `delivery`: `{ original, agreed }` — `original` is true when every scenario of the
  inventory snapshot is `delivered`; `agreed` when every scenario is `delivered`,
  `deferred` or `removed` with an authorized disposition. A report shows both, so
  delivery with authorized scope dispositions is never presented as delivery of
  every original obligation.
- each check row carries `declared` (the definition digest from the map snapshot).

Dispositions are derived, never authored: a scenario is `delivered` when every
required check it links passed (command checks with `runtime` provenance and
`attempt.check_digest` equal to `declared`; review checks with a passed result and a
candidate-bound artifact), `deferred`/`removed` when its map disposition is
authorized (the row names the decision and the user authorization), `blocked`
otherwise. Validation of a schema 3 manifest establishes, in addition to the schema
2 rules: the snapshots are listed artifacts whose content recomputes to
`coverage.inventory` and `coverage.map`; the scenario and requirement rows are
exactly the inventory snapshot's set plus tombstones, each once, with the links the
map snapshot gives; every check the map declares appears in `checks`, every check in
`checks` is declared with the same kind and `required`, and `declared` equals the
declaration; every disposition follows the rule above; `delivery` recomputes; a
required check that did not pass, a required review obligation that is not passed
with an artifact, a `blocked` row and an `inadequate` adequacy each make the manifest
invalid with the reason named. When the repository is available (export, status,
release, and `validate` run inside the repository) validation also reconciles
independently with the committed candidate: the inventory recomputed from `git show
<candidate>:<prd>` and the map digest from `git show <candidate>:.prd/coverage/<id>.json`
must equal `coverage.inventory` and `coverage.map`, and `git show
<candidate>:.prd/changes/<id>.json` must be a schema 3 record whose agreement entry
with digest `coverage.agreement` exists and is bound by authorization
`coverage.authorization`; a manifest whose own lists are consistent but disagree with
the candidate is invalid (`the candidate's PRD defines S-05, which the manifest omits`).
Outside a repository (`pincer-evidence.cjs validate` on copied files) that
reconciliation is skipped and printed as a limitation, never claimed. A schema 3
manifest is `UNSUPPORTED_SCHEMA`-refused by the v0.5.0 and PRD v5 validators
(`unknown evidence schema 3`).

`evidence export` of a strict change reads a draft with the keys `environment`,
`coverage_review`, `adequacy`, `checks` and `visual_review`; a draft `requirements`
key is refused (`dispositions are derived from the map and the outcomes`). Every
declared check appears in `checks` exactly once: a `command` entry is `{ id }` (a
`kind`, `required` or `command` given must equal the declaration), a `review` or
`visual` entry carries `result`, `artifacts` and the schema 1 fields; a declared
check missing from the draft (`an unused failing required check cannot be omitted`)
and an undeclared entry are refused naming the ID. Export requires `structure`
complete, populates command checks from the attempts as in schema 2, writes the two
snapshots and `checks/C-NN.log`, computes every row and `delivery`, writes
`manifest.json`, validates it with the reconciliation above, and appends the
locator entry (schema 1, unchanged; its `agreement` is the projection 2 digest).
Release reads the selected strict change's lifecycle (`completed`), its verdict, the
locator, the schema 3 manifest with reconciliation and the latest applicable
attempts (a newer nonpassing local attempt on the same source blocks, as in schema
2); a fresh clone validates the saved record with the v5 provenance limit; release
writes nothing. The post-candidate allowlist is unchanged: the snapshots are listed
artifacts of a validated manifest and therefore followers; an unlisted file under
the evidence directory, an altered snapshot and a malformed locator remain
candidate changes. Two changes evaluated on one candidate keep distinct locators,
manifests and attempt keys.

### Adoption and rollback

`coverage adopt --preview --change <id>` prints the plan and writes nothing; it exits 0
when apply would proceed (or when the change is already strict: `already adopted`)
and 1 when a conflict stops it. Conflicts, all before the first write: not changes
mode (`CHANGE_REQUIRED`/`MIGRATION_REQUIRED` — migrate first; migration never
adopts), an unreadable record or directory, a `cancelled`/`superseded` change
(`LIFECYCLE_BLOCKED`), a `running` attempt of the change (`ATTEMPT_RUNNING`), an
incomplete transaction (`STATE_INCOMPLETE`), a PRD that does not parse strictly
(`INVENTORY_INVALID`), a missing or invalid map (`COVERAGE_INVALID`), a map whose
graph is incomplete (`COVERAGE_INCOMPLETE`: membership, classification and links must
be complete before adoption; scope authorization is reported, not required, because
the authorization that covers the map is recorded after adoption). The preview shows
the inventory (counts, digest), the map digest, the agreement `G-NN` and digest apply
would record, the attempts that become `HISTORICAL_EVIDENCE`, the backup path, and
that adoption grants no authorization.

`coverage adopt --apply --change <id> [--agreement <digest>]` is one transaction:
it recomputes the plan under the lock (refusing with the same codes), compares the
agreement digest with `--agreement` when given (`AGREEMENT_CHANGED` when the inputs
changed since the preview), backs up `.prd/changes/<id>.json` under
`.pincer/backups/<UTC timestamp>/.prd/changes/<id>.json`, and stages the record as
schema 3 (`runtime: 3`, `coverage: { map, adopted, agreement }`, the agreement entry
`G-NN` with `inventory` and `coverage` digests, the `adopt` event) together with the
snapshot `.prd/changes/<id>/agreements/G-NN.json` (schema 2). Nothing else changes:
tickets, attempts, the index, the selection, the locator and the map are untouched;
no authorization is created, inferred from the record's history, or copied from an
earlier one — the user's instruction covering the new agreement is recorded
afterwards with `change authorize` (user) or `--delegated --basis A-NN`, and until
then the verdict is `AGREEMENT_CHANGED` (or `AUTHORIZATION_REQUIRED`). Repeated apply
reports `already adopted` and writes nothing. A process killed during apply leaves
the schema 2 record or the schema 3 record with its event and snapshot (`recover`
completes a committed apply). Existing attempts of the change are history after
adoption (`HISTORICAL_EVIDENCE`) until verified again.

Rollback from adoption restores the backed-up `.prd/changes/<id>.json` — it
overwrites the schema 3 record at the same path, so nothing under `.prd/changes/` is
deleted; the adoption snapshot `.prd/changes/<id>/agreements/G-NN.json` is no longer
referenced by the restored record and may be removed or left in place. The map
(authored), `.pincer/runtime/` (attempts, index, selection) and the evidence are kept.
The change is a schema 2 record again with its history through the last
pre-adoption event; attempts recorded as schema 3 during the strict period are then
`ATTEMPT_ERROR` for that change until verified again. The migration rollbacks above
are unchanged.

### Coverage and impact commands

| Command | Arguments | Writes | Notes |
| --- | --- | --- | --- |
| `coverage` | `[--change <id>] [--json]` | nothing | the phase-specific coverage report of the selected (or named) change; exit 0 when the report was computed (complete or not), 4 when the inputs cannot be read |
| `impact` | `[--change <id>] [--from G-NN \| A-NN] [--json]` | nothing | structural differences between the current authored inputs and a retained agreement; exit 0 when computed (`unchanged`, `changed` or `unavailable`), 4 on invalid input |
| `coverage adopt` | `--preview \| --apply --change <id> [--agreement <digest>]` | apply: the backup, the schema 3 record, the adoption snapshot | preview writes nothing; exit 0 / 1 (conflict) / 4 (invalid state) |
| `check` | `C-NN --candidate <sha>` (strict) | an attempt | the declared command; `--timeout` and `-- <command>` are `CHECK_UNDECLARED` in a strict change |

`coverage` and `impact` launch no check, record no approval, change no selection and
write no file; repeated runs are byte-identical apart from `generated`. Their human
output and their JSON name the same IDs, codes and next action.

Coverage JSON schema 1:

```
{ schema: 1, runtime: 3, generated, root, mode, change: <id> | null,
  strict: boolean, label: "strict" | "unverified", reason: <why unverified> | null,
  inventory: { digest, requirements: [ { id, title, line, end, scenarios: [ids] } ], scenarios: [ { id, requirement, line, end } ] } | null,
  map: { path, digest, checks: [ { id, kind, required, declared } ] } | null,
  agreement: { current, reviewed: { agreement: "G-NN", authorization: "A-NN" | null, digest } | null, verdict },
  baseline: { agreement: "G-NN", authorization: "A-NN" | null, inventory: <digest> } | null,
  structure: { complete, problems: [ { code, detail, ids: [] } ] },
  implementation: { complete, scenarios: { "<id>": { scope, implementation, tickets: [ { id, status, ready, code } ], detail } } },
  candidate: { evaluated, candidate, manifest, delivery: { original, agreed } | null, adequacy: { verdict, note } | null,
               scenarios: { "<id>": { disposition, checks: [ { id, kind, required, result } ], detail } } } | null,
  blockers: [ { code, detail } ], next: { action, command, ticket | check | decision | null } }
```

Impact JSON schema 1 (the baseline is `--from`, else the latest authorization's
agreement, else the latest retained agreement with an inventory snapshot):

```
{ schema: 1, runtime: 3, generated, root, change,
  baseline: { agreement: "G-NN", authorization: "A-NN" | null, recorded, digest } | null,
  current: { digest, inventory, coverage },
  verdict: "unchanged" | "changed" | "unavailable", reason: <text> | null,
  requirements: { added: [ids], removed: [ids], changed: [ { id, parts: ["title" | "text" | "scenarios"] } ], unchanged: [ids] },
  scenarios: { added: [ids], removed: [ { id, tombstone: boolean } ], changed: [ { id, parts: ["text" | "requirement"] } ], unchanged: [ids] },
  links: { added: [ids], removed: [ids], changed: [ { id, tickets: { added, removed }, checks: { added, removed } } ] },
  scope: { added: [ { id, disposition } ], removed: [ids], changed: [ { id, from, to } ] },
  checks: { added: [ids], removed: [ids], changed: [ { id, parts: ["kind" | "command" | "timeout" | "cwd" | "obligation" | "required"] } ] },
  tickets: { added, removed, changed: [ { id, parts } ] },
  affected: { scenarios: [ { id, because: [reasons] } ], tickets: [ { id, because: [reasons] } ], checks: [ { id, because: [reasons] } ],
              dependents: [ { id, via: "T-NN", because: "depends_on" } ] },
  unscoped: { prd: boolean, detail } ,
  freshness: { note: "a narrow impact is not permission to reuse evidence whose source identity changed" } }
```

`affected` names every scenario whose text, owner, links or linked declarations
changed, and every ticket and check linked from one of them, with the reason each is
included; `dependents` lists tickets that `depends_on` an affected ticket, separately
from direct links. `unscoped.prd` is true when `prd_revision` changed while every
definition is unchanged (a constraint, the scope table, an architecture note): the
verdict is then `changed` with the detail `unscoped PRD change requiring review`,
never `unchanged`. `unavailable` is reported with its reason when the baseline
agreement has no inventory snapshot (a pre-adoption or schema 1 snapshot, or none at
all), when `--from` names a missing entry, or when the snapshot is `HISTORY_INVALID`;
the runtime never reports "no impact" for history it cannot read. Impact is
structural: it never judges semantics, and it does not touch evidence freshness —
`SOURCE_CHANGED` keeps invalidating attempts by whole-source identity regardless of
how narrow the report is.

Status JSON schema 3 (changes mode) keeps every schema 2 field and adds
`coverage`: `{ strict, label, reason, structure: { complete, problems }, implementation:
{ complete, scenarios: { total, complete, unfinished, unverified, dispositioned } },
candidate: { evaluated, delivery, adequacy } | null, next }`; legacy and migrated
mode status JSON stays schema 1 with `coverage: { strict: false, label: "unverified",
reason }`. The human status prints one `Coverage` line: `Coverage strict · agreement
G-03 (A-02) · structure complete · implementation 4/6 scenarios · candidate not
evaluated` or `Coverage unverified · strict coverage not adopted (node
scripts/pincer-runtime.cjs coverage adopt --preview --change <id>)`. Resume JSON
schema 2 keeps every schema 1 field and adds the same `coverage` object; its
next-action precedence gains the coverage codes inside rule 4 ("agreement, decision
or coverage gap": `COVERAGE_INVALID` → repair the map, `COVERAGE_INCOMPLETE` → author
the missing rows, `OBLIGATION_MISSING` → restore the obligation or record the decision
and tombstone, `SCOPE_UNAUTHORIZED` → `change decide --resolve` / `change authorize`),
and rules 7 and 8 read the candidate coverage (`REVIEW_MISSING`, `ADEQUACY_REQUIRED`
→ `/pincer-evaluate`). The v5 blocker precedence is otherwise unchanged. Routine
resume never records or requests authorization: it prints the exact `change
authorize` command when and only when the verdict is not `current`.

A compact PRD (one requirement, one or two scenarios) with a map of one or two
declarations passes the same validation; nothing requires an authored traceability
table beyond the map. Playbooks author the map once (during `/pincer-narrow`) and
read `coverage`/`impact` afterwards; a changed scope is dispositioned (decision,
tombstone, authorization) before approval is recorded, and a generic "continue" is
never an authorization of revised scope.

## Legacy compatibility

For an unmigrated project nothing changes: the ticket and status commands keep their
names, arguments, output lines and diagnostics; receipts stay in the ticket; `done`
re-runs the check; `.pincer/` is never created; schema 1 evidence validates. The only
additions are the `Runtime  legacy …` status line, the exit code 4 for invalid input,
and the `--json` form of status. A migrated (schema 1 binding) project keeps the
v0.5.0 behavior in full until `migrate --apply`; its `register --replace` is the one
command that now refuses, with `MIGRATION_REQUIRED`. A project that already carries
`.pincer/` from a migrated worktree is migrated; it cannot be half in each mode. A
schema 2 record that cannot be read never turns the project legacy or migrated.

## Worktrees

Change records, agreement snapshots and evaluation locators are tracked files: each
worktree sees the versions committed on its branch, and a lifecycle event committed
in one worktree reaches another only through git. Local state (`.pincer/runtime/`,
including the selection, attempts and the lock) belongs to one worktree and is never
shared or copied: selecting a change in one worktree changes nothing in another, and
attempts recorded in one are unavailable in the other (`EVIDENCE_MISSING`, the same as a
fresh clone). The lock serializes writers inside one worktree only; two worktrees can
each activate a different change on different branches, and the runtime does not
claim to prevent two developers from working on the same change independently. When
two branches carry divergent histories of the same record, the merge is reconciled by
hand before execution: the merged file must satisfy the sequence and projection
rules, or it is `HISTORY_INVALID`.

## Platform limits

The check runner is a POSIX contract: `bash` in `PATH`, process groups
(`detached: true`, `kill(-pid)`), `SIGTERM`/`SIGKILL`. Native Windows is not
supported and not claimed. The CI matrix (`.github/workflows/ci.yml`: ubuntu and macOS
× Node 22 and 24) is the target surface; a release claims only the runs it can cite,
and any platform outside the matrix is untested. Node 22 is the floor (`engines`)
because 18 and 20 are past end of life, not because of any output defect: until
T-79 a command whose stdout or stderr outgrew one pipe buffer lost the tail and
still exited 0, on every version alike — the boundary was the pipe buffer, 65,536
bytes, where 65,536 arrived and 65,537 did not. Every write now goes to the file
descriptor synchronously (`scripts/pincer-runtime/io.cjs`), so a report is
complete when the command exits however it is consumed; `test/runtime-output.test.js`
compares a piped report against the same report redirected to a file. Sandbox and approval controls of the
host stay in force; the runtime never bypasses them.
