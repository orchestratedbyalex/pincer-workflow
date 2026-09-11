---
ticket: T-30
status: open
size: M
prd: .prd/prd-v4.md
depends_on: []
---

## Objective
Write the runtime contract document that every later ticket implements against: schemas, CLI and exit codes, the supported Markdown grammar, normalized fields, source-manifest exclusions, capture limits, reason codes, evidence schema 2, migration and rollback, and legacy compatibility.

## Context
- Relevant files: new `template/docs/runtime-contracts.md` (ships with the kit and the plugin), `scripts/build-plugin.sh` (copies `template/docs/*.md`; the xform must rewrite `docs/runtime-contracts.md` like the checklists), `bin/pincer.js` (`PLATFORM_ROOTS.common` gains the doc), `test/distribution.test.js` and `test/smoke.test.js` (file lists), new `test/contracts.test.js`.
- PRD section: 5 (architecture and data contracts), 6 step 2, R-02, R-04, R-08, R-09, 9 (rollback).
- Implements: R-02, R-04, R-08, R-09 (contract freeze; the behavior lands in T-31..T-40)

## Requirements
- The document has these sections, each with the concrete contract, not prose about intent: `## Modes` (legacy vs migrated, how each is recognized, what each command does in each mode); `## Commands and exit codes` (every `pincer-runtime.cjs` command, its arguments, what it writes, and a table of exit codes: 0 success or inspection done, 1 check failed / not ready / transition refused, 2 usage, 3 state busy, 4 invalid input or unreadable state, 124 timed out, 130 interrupted; wrapper mappings for `pincer-ticket.sh` and `pincer-status.sh`); `## Supported grammar` (frontmatter, ticket, PRD, NOTES rules as validated today plus the optional `timeout` field in seconds); `## Change binding` (`.prd/changes/<change-id>.json` schema 1 fields: `schema`, `change`, `prd`, `prd_revision`, `base`, `registered`, `authorization`, `legacy_receipts`, `runtime_version`); `## Content revisions` (PRD revision digest = SHA-256 of the file with the `status:` line removed; ticket authored digest = SHA-256 with `status`, `started`, `finished`, `verified`, `last_check` lines removed and Acceptance Criteria checkbox marks normalized to `[ ]`; check digest = SHA-256 of the Verification block text plus the effective timeout); `## Source manifest` (schema 1: tracked plus untracked non-ignored files, mode bit, deletions, path identity, PRD/ticket normalization, fixed exclusions `.git/`, `.pincer/`, `NOTES.md`, `.prd/evidence/`, `.prd/changes/`; the optional tracked `.prd/source-exclude` file, one pattern per line, may exclude only untracked paths and never `tickets/`, `.prd/prd-v*.md` or itself; secret paths `.env` and `.env.*` except `.env.example` block with a path-only diagnostic; symlinks and submodules are rejected; ignored dependencies and services are recorded as limitations); `## Attempts` (attempt schema 1 fields, sequence, outcomes `running|passed|failed|interrupted|timed_out|error`, context keys, the index file, the lock directory and owner file, stale-lock reclaim rule, recovery); `## Capture and sanitization` (stdout and stderr captured to files up to 1 MiB each with a truncation marker, lines matching the documented secret patterns replaced by `[redacted]` and counted, no environment dump, sanitization failure yields `error`); `## Readiness and reason codes` (the eleven suggested codes plus `LEGACY_RECEIPT`, `SECRET_PATH`, `UNSUPPORTED_INPUT`; the status JSON schema 1 object with `schema`, `mode`, `change`, `prd`, `tickets[]`, `candidate`, `reasons[]`, `next`); `## Evidence schema 2` (schema 1 plus `change` binding fields, `provenance` per check, `attempt` on runtime command checks, legacy label for schema 1); `## Migration and rollback` (preview, apply, backups under `.pincer/backups/<timestamp>/`, idempotence, conflicts, partial state, restoring backups, what an older runtime does not enforce); `## Legacy compatibility` (what stays byte-identical for unmigrated projects); `## Platform limits` (POSIX shell, process groups, untested platforms).
- The Claude plugin and every installer layout ship the document; the plugin copy is path-rewritten like the checklists.
- `test/contracts.test.js` asserts every section heading, the exit-code rows, the reason-code list, the fixed exclusions and the secret-path rule, and that the plugin copy equals the template copy after path rewriting. It is added to the `npm test` script.

## Acceptance Criteria
- [ ] `template/docs/runtime-contracts.md` exists with all thirteen sections and the values listed above.
- [ ] The document ships in the tarball, every installer layout and the plugin; `test/contracts.test.js` runs under `npm test`.
- [ ] No unsettled state-ownership decision remains: every record in PRD section 5's ownership table names its owner and file location in the document.

## Verification
Proves: the contract document is present, complete and distributed; regression: a missing section, exit code, reason code or exclusion, or a plugin copy that drifts from the template. Static assertions are primary evidence for this static contract.
```bash
node test/contracts.test.js && npm test && grep -q 'test/contracts.test.js' package.json && grep -q 'docs/runtime-contracts.md' bin/pincer.js && test -f plugin/docs/runtime-contracts.md
```

## Constraints
- Contracts only: no runtime code in this ticket. Later tickets update the document when they discover a necessary change, in the same commit as the code.
