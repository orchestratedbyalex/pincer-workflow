# PINCER Runtime Contracts

The runtime is `scripts/pincer-runtime.cjs` with its modules under
`scripts/pincer-runtime/`. It is dependency-free CommonJS for Node.js 18+ and is the
only writer of ticket lifecycle state, verification attempts, change bindings and
exported candidate evidence. The shell entry points `scripts/pincer-ticket.sh` and
`scripts/pincer-status.sh` are compatibility wrappers that delegate to it. This
document is the contract the runtime implements; tests pin it, and a change to a
contract updates this file in the same commit as the code.

Schema numbers in this document (`schema: 1` on bindings, attempts, manifests and
status; evidence `schema: 2`) are independent of the package version. The runtime
records its contract version as `runtime: 1`.

## Modes

A project is in one of two modes per PRD, decided by the presence of a change binding
(`.prd/changes/<change-id>.json`, see below) whose `prd` names that PRD.

| | Legacy (no binding) | Migrated (binding present) |
| --- | --- | --- |
| How recognized | no `.prd/changes/*.json` names the PRD | exactly one binding names it |
| Selected PRD for status | the highest-numbered valid `.prd/prd-vN.md` | the binding's PRD; a newer unregistered PRD is reported, never selected |
| `start` | as v0.4.1: dependency and readiness checks, writes `status: in_progress` and `started` | same checks; a dependency is ready when its latest attempt passed against current inputs |
| `verify` | runs the block, writes `last_check` and `verified` into the ticket | runs the block as an attempt under `.pincer/runtime/`; writes nothing to tracked files |
| `done` | re-runs the check, then writes `status: done` and `finished` | consumes the latest passing attempt whose inputs are current; writes `status: done` and `finished` once; read-only and idempotent afterwards |
| Readiness authority | `last_check`/`verified` receipts in the ticket | attempt records; `verified`/`last_check` are ignored and reported as `LEGACY_RECEIPT` |
| Local state | none; `.pincer/` is never written | `.pincer/runtime/` (ignored) |
| Evidence | schema 1, authored | schema 2, exported from attempts (schema 1 still validates with a legacy label) |
| Status line | `Runtime  legacy · no change binding · migrate with node scripts/pincer-runtime.cjs migrate --preview --prd <prd>` | `Runtime  change <id> · revision <12 hex> · base <short sha>` |

Legacy mode is recognizable in every output; nothing switches modes implicitly.
Migration (`migrate --apply`) is the only transition.

## Commands and exit codes

All commands: `node scripts/pincer-runtime.cjs <command> [arguments]`. The project
root is `CLAUDE_PROJECT_DIR`, else `git rev-parse --show-toplevel`, else the working
directory. Diagnostics go to stderr, prefixed `pincer-ticket: ` for ticket input,
`pincer: ` for PRD, NOTES and runtime state, `evidence: ` for manifests.

| Command | Arguments | Writes | Notes |
| --- | --- | --- | --- |
| `validate` | `<file>... [--digests]` | nothing | validates tickets, PRDs and NOTES; `--digests` prints `ticket`, `check` and `prd` digests |
| `register` | `--prd .prd/prd-vN.md [--change <id>] [--authorization <text>] [--replace] [--rebind]` | `.prd/changes/<id>.json` | requires a git HEAD; `--replace` allows a binding for another PRD to be replaced; `--rebind` updates `prd_revision` after PRD content changed |
| `snapshot` | `[--json] [--store]` | `.pincer/runtime/manifests/<digest>.json` only with `--store` | prints the source digest and file count, or the manifest |
| `status` | `[--json]` | nothing | human report, or one status JSON object on stdout |
| `ready` | `[T-NN]` | nothing | read-only gate: exit 0 when ready, 1 when not, with reason codes |
| `start` | `T-NN` | ticket `status`, `started`, `prd` | both modes |
| `verify` | `T-NN` | legacy: ticket receipts; migrated: an attempt | always creates a new attempt in migrated mode |
| `done` | `T-NN` | ticket `status`, `finished` (once) | legacy re-runs the check; migrated consumes the current pass |
| `bind` | `T-NN .prd/prd-vN.md` | ticket `prd` | legacy association repair |
| `recover` | | attempts, lock, journal | finalizes dead-owner `running` attempts as `interrupted`; never promotes to `passed` |
| `migrate` | `--preview | --apply --prd .prd/prd-vN.md [--change <id>] [--authorization <text>]` | apply: backups, ticket receipt lines, `.gitignore`, binding | preview writes nothing |
| `check` | `C-NN --candidate <sha> [--timeout <seconds>] -- <command...>` | an attempt | candidate-context check on a clean view of the committed candidate |
| `evidence export` | `--candidate <sha> --base <sha> --prd .prd/prd-vN.md --draft <file>` | `.prd/evidence/prd-vN/<candidate>/` | schema 2 manifest and logs populated from attempts |

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | success; for `status`, inspection succeeded even when work is not ready |
| 1 | the check failed, the readiness gate is not ready, or a transition was refused |
| 2 | usage error (unknown command or option, missing argument) |
| 3 | state busy: the lock is held by a live owner after the bounded wait |
| 4 | invalid input or unreadable state (malformed ticket, PRD, binding, index, manifest) |
| 124 | the check timed out |
| 130 | the check was interrupted (SIGINT or SIGTERM received by the runtime) |

Wrapper mappings: `scripts/pincer-ticket.sh <start|verify|done|bind> …` calls the
command of the same name and returns its exit code; `scripts/pincer-status.sh` calls
`status` (reading `PINCER_BUILD_BUDGET_MIN` from the environment) and returns its exit
code. Both print a Node.js 18+ requirement message and exit 4 when `node` is absent.

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
  integer number of seconds; default 600). Exactly one `## Acceptance Criteria` section
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

## Change binding

`.prd/changes/<change-id>.json`, written only by `register` and `migrate --apply`,
tracked in git, schema 1:

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

Exactly one binding may exist per worktree in this increment. A second file, a file
for another PRD (without `--replace`), malformed JSON, an unsupported `schema`, or a
`prd_revision` that no longer matches the PRD content are diagnosed before any child
process starts (`AMBIGUOUS`, `CHANGE_REQUIRED`, `MALFORMED`, `UNSUPPORTED_SCHEMA`,
`REVISION_CHANGED`). Copying a binding into another repository requires its `base`
to exist there and its `prd` path to resolve; otherwise it is `UNSUPPORTED_INPUT`.
Binding fields are recorded on every attempt separately; a binding is never hashed
into the source manifest.

## Content revisions

Digests are SHA-256, hex, shown shortened to 12 characters in human output and in
full in records. Line endings are not normalized.

| Digest | Input |
| --- | --- |
| PRD revision (`prd_revision`, `prdDigest`) | the PRD file with the frontmatter `status` line removed |
| Ticket authored digest (`ticket_digest`) | the ticket file with the frontmatter `status`, `started`, `finished`, `verified` and `last_check` lines removed and every Acceptance Criteria checkbox mark normalized to `[ ]` |
| Check digest (`check_digest`) | the Verification block text (the lines between the fences) followed by `\ntimeout=<effective seconds>` |
| Source digest | the source manifest (next section) |

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
`.prd/changes/`. This is why a new evidence artifact or NOTES edit cannot invalidate
the snapshot that produced it; the separate post-candidate commit policy (only
NOTES.md and the manifest's listed files may follow the candidate) is unchanged.

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
not prove the environment stayed healthy.

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
| `lock/` | the exclusive lock directory; `lock/owner.json` is `{ pid, ppid, host, started, command }` |
| `journal/` | temporary files for atomic replacement |

Context keys: `ticket:<change>:<T-NN>` and `candidate:<40 hex>:<C-NN>`. Attempt IDs
are `<sequence, 6 digits>-<UTC compact timestamp>-<6 hex>`; the `sequence` in
`index.json` is the authority for ordering (timestamps alone never order attempts).

Attempt record schema 1:

| Field | Value |
| --- | --- |
| `schema`, `runtime` | `1`, `1` |
| `id`, `sequence` | as above |
| `context` | `{ kind: "ticket" \| "candidate", change, prd, prd_revision, base, ticket?, ticket_digest?, candidate?, check? }` |
| `check` | `{ digest, display, timeout_seconds }` (display is the sanitized command text) |
| `outcome` | `running \| passed \| failed \| interrupted \| timed_out \| error` |
| `exit_code`, `signal` | the child's exit code or signal, else `null` |
| `runner` | `{ shell: "<bash path>", args: ["-eo", "pipefail", "-c"], version: "<first line of bash --version>" }` |
| `cwd` | the working directory relative to the root (`.`) |
| `environment` | `{ os, node, declared: {} }`; declared nonsecret context only, never a dump |
| `started`, `finished` | ISO UTC; `finished` is `null` while running |
| `source` | `{ before: <digest>, after: <digest or null>, files: <count>, limitations: [] }` |
| `artifacts` | `{ stdout: { path, sha256, bytes, truncated, redactions }, stderr: { ... } }` |
| `owner` | `{ pid, ppid, host }` |
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
finalizes as `interrupted` after verifying the owner pid is dead on this host.

Lock: acquired by `mkdir lock/` (atomic); waiters poll every 100 ms for up to 10 s,
then fail with exit 3 naming the owner. A lock whose owner pid is on this host and no
longer alive is reclaimed with a diagnostic; a live owner is never stolen; a foreign
host is never reclaimed automatically. The lock is held while records are written and
released while the child runs. Every write goes to `journal/` on the same filesystem
and is renamed into place; a stray journal file is ignored on read and reported by
`recover`. A malformed `index.json` is exit 4 and is never overwritten by inspection.

Timeout: the effective timeout is the ticket's `timeout` field or 600 s, or `--timeout`
for `check`; it is part of the check digest. On expiry the runtime sends SIGTERM to the
child's process group, waits 5 s, then sends SIGKILL.

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
never a pass claiming complete output.

## Readiness and reason codes

Readiness is one pure computation (`scripts/pincer-runtime/readiness.cjs`) consumed
by the human status, the JSON status, `ready`, `done`, `start` (for dependencies) and
release. Lifecycle `done` and verification readiness are distinct: an old done ticket
can be stale or failed without its `finished` date changing.

| Code | Meaning | Next action |
| --- | --- | --- |
| `CHANGE_REQUIRED` | no change binding names this PRD | `register` or `migrate` |
| `MIGRATION_REQUIRED` | legacy receipts exist and the command needs runtime state | `migrate --preview` |
| `REVISION_CHANGED` | PRD content differs from the bound revision | `register --rebind` |
| `CHECK_CHANGED` | the Verification block or timeout changed since the latest pass | `verify` |
| `SOURCE_CHANGED` | the source digest differs from the verified one (paths named) | `verify` |
| `CHECK_FAILED` | the latest attempt failed | fix, then `verify` |
| `ATTEMPT_RUNNING` | an attempt is `running` | wait, or `recover` if its owner died |
| `ATTEMPT_INTERRUPTED` | the latest attempt was interrupted | `verify` |
| `ATTEMPT_TIMED_OUT` | the latest attempt timed out | fix or raise `timeout`, then `verify` |
| `ATTEMPT_ERROR` | the latest attempt could not be recorded or mutated source | inspect the record, then `verify` |
| `EVIDENCE_MISSING` | no attempt, missing log, or missing local state | `verify` |
| `LEGACY_RECEIPT` | only a migrated legacy receipt exists | `verify` |
| `CRITERIA_UNTICKED` | unticked acceptance criteria | tick verified criteria |
| `DEPENDENCY_BLOCKED` | a `depends_on` ticket is not ready | finish the dependency |
| `INPUT_INVALID` | malformed ticket, PRD or NOTES | repair the input |
| `CANDIDATE_STALE` | NOTES/evidence do not describe HEAD (reason quoted) | `/pincer-evaluate` |
| `STATE_BUSY` | the lock is held | retry, or `recover` |
| `SECRET_PATH` | a secret file is in the source view | remove or ignore it |
| `UNSUPPORTED_INPUT` | symlink, submodule, no git, or a refused exclusion | remove the input or change the configuration |

Status JSON schema 1 (one object on stdout; diagnostics on stderr; no progress text,
no secret values):

```
{ schema: 1, runtime: 1, generated, root, mode: "legacy" | "migrated",
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

`status` exits 0 when inspection succeeded; `ready` exits 1 for non-ready work; both
exit 4 on invalid input.

## Evidence schema 2

Schema 2 keeps every schema 1 field and rule and adds:

- top-level `change`: `{ id, prd_revision, base }` (`base` must equal the manifest's
  `base`);
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
command result.

`check` refuses unless HEAD equals `--candidate`, the binding is current, and
`git status --porcelain --untracked-files=all` lists nothing outside `NOTES.md` and
`.prd/evidence/prd-vN/<candidate>/`; it never stashes, resets or commits.

Validation: `node scripts/pincer-evidence.cjs validate <manifest> …` accepts schema 1
and 2 and prints `ok <candidate> schema <n>`. Status labels schema 1 `provenance:
legacy (schema 1, authored command results)` and schema 2 `provenance: runtime`. A
schema 1 manifest cannot satisfy a requirement for runtime evidence. Release
readiness additionally requires that no newer local attempt for the same candidate and
check with the same source digest is nonpassing; a fresh clone without
`.pincer/runtime/` reports `local verification history unavailable; saved candidate
evidence validated only`. Local capture establishes provenance and mistake detection,
not tamper-proof attestation.

## Migration and rollback

`migrate --preview --prd .prd/prd-vN.md` prints the plan and writes nothing: the
binding it would write, each ticket of that PRD whose `verified`/`last_check` lines
would be removed and recorded as `legacy_receipts`, the `.gitignore` line it would
add, and every conflict. It exits 0 when apply would proceed and 1 when a conflict
would stop it. Conflicts (all fail closed, before the first write): a binding for
another PRD, malformed tickets, an unsupported binding schema, a ticket of another PRD
with the same ID, and a partially applied earlier migration (binding present but
receipts remaining, or receipts removed without a binding).

`migrate --apply` backs up every authored file it changes under
`.pincer/backups/<UTC timestamp>/<original path>`, rewrites the tickets, adds
`.pincer/` to `.gitignore`, then writes the binding last. Repeated apply reports
`already migrated` and changes nothing. Imported receipts are history: a migrated done
ticket reports `LEGACY_RECEIPT` until a runtime attempt exists, without changing
`finished`. Installation and update deploy the runtime files and `doctor` reports when
a migration is available; neither migrates.

Rollback: restore the files from the backup directory (they are byte-identical
originals), delete `.prd/changes/<id>.json`, and remove `.pincer/`. The project is
then in legacy mode with its original receipts. An older runtime does not enforce the
runtime guarantees: it will accept the restored receipts as it did before.

## Legacy compatibility

For an unmigrated project nothing changes: the ticket and status commands keep their
names, arguments, output lines and diagnostics; receipts stay in the ticket; `done`
re-runs the check; `.pincer/` is never created; schema 1 evidence validates. The only
additions are the `Runtime  legacy …` status line, the exit code 4 for invalid input,
and the `--json` form of status. A project that already carries `.pincer/` from a
migrated worktree is migrated; it cannot be half in each mode.

## Platform limits

The check runner is a POSIX contract: `bash` in `PATH`, process groups
(`detached: true`, `kill(-pid)`), `SIGTERM`/`SIGKILL`. Native Windows is not
supported and not claimed. Tested platforms are the CI matrix (ubuntu and macOS ×
Node 18 and 22); other platforms are untested. Sandbox and approval controls of the
host stay in force; the runtime never bypasses them.
