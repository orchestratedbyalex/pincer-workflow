---
ticket: T-32
status: open
size: M
prd: .prd/prd-v4.md
depends_on: [T-31]
---

## Objective
Implement explicit change registration and the versioned SHA-256 source manifest so verification can be bound to a registered PRD revision and to reproducible inputs.

## Context
- Relevant files: new `template/scripts/pincer-runtime/identity.cjs` (binding file, revision digests), new `template/scripts/pincer-runtime/source.cjs` (manifest), `template/scripts/pincer-runtime.cjs` (`register`, `snapshot` commands), `template/docs/runtime-contracts.md` (`## Change binding`, `## Content revisions`, `## Source manifest`), new `test/runtime-identity.test.js`.
- PRD section: R-02, R-04, 5 (ownership table: change binding is owned by registration).
- Implements: R-02 (S-04, S-05, S-06), R-04 (S-11 static, S-12, S-14)

## Requirements
- `register --prd .prd/prd-vN.md [--change <id>] [--authorization <text>] [--replace]` validates the PRD, requires a git repository with a HEAD commit, writes `.prd/changes/<id>.json` (schema 1: `schema`, `change`, `prd`, `prd_revision`, `base` = HEAD at registration, `registered`, `authorization` when supplied, `runtime_version`) atomically, and prints the binding. The default `<id>` is `prd-vN`. A second binding for a different PRD is refused unless `--replace` is given; registering the same PRD again with the same revision is idempotent; a changed revision requires `--rebind`, which updates `prd_revision` and reports that prior readiness for the old revision no longer applies. Registration never infers approval from PRD status; the diagnostic says so when `--authorization` is absent.
- `identity.cjs` exports `loadBinding(root)` returning `{ binding }` or `{ problem, code }` with codes `CHANGE_REQUIRED` (none), `AMBIGUOUS` (several files), `MALFORMED`, `UNSUPPORTED_SCHEMA`, `REVISION_CHANGED` (PRD content digest differs from `prd_revision`). Any command that executes a check refuses on a problem before starting a child process.
- `source.cjs` exports `snapshot(root, options)` returning `{ digest, files: [{path, sha256, mode, deleted}], excluded: [], limitations: [], problems: [] }`. Inclusion: `git ls-files -z --cached --others --exclude-standard` relative to the project root; deleted tracked files are entries with `deleted: true`; the executable bit is part of each entry; tickets and PRDs are hashed after normalization; the fixed exclusions and `.prd/source-exclude` rules follow the contract; a pattern that matches a tracked file, `tickets/`, `.prd/prd-v*.md` or the exclude file itself is a problem `UNSUPPORTED_INPUT`; a path matching the secret rule is a problem `SECRET_PATH` naming only the path; a symlink or a submodule entry is `UNSUPPORTED_INPUT`; ignored `node_modules` and similar directories are listed as a limitation string, never hashed. Outside a git repository, `snapshot` reports `UNSUPPORTED_INPUT`.
- `snapshot [--json]` prints the digest and file count, or the full manifest as JSON; manifests are stored content-addressed under `.pincer/runtime/manifests/<digest>.json` only when a caller asks (`--store`), never by `status`.
- Tests (`test/runtime-identity.test.js`, added to `npm test`): S-04 two PRDs with identical ticket commands register as different changes and the binding names each; S-05 editing PRD content changes `prd_revision` mismatch (`REVISION_CHANGED`) while a `status:` change does not, and `--rebind` clears it; S-06 missing, duplicate, malformed JSON, unsupported schema and ambiguous bindings each produce the named code before any child process would start; S-11 static: a source edit, a test edit, a lockfile edit, a config edit, a new untracked file, a deletion, and a mode change each change the digest; S-12: ticking a box or changing lifecycle fields leaves the digest stable, editing acceptance text or the exclude file changes it; S-14: a tracked `.env` yields `SECRET_PATH` with no file content in the output, `.env.example` is ordinary input, a symlink and a submodule are refused, an ignored `node_modules` is a limitation, a non-git directory is refused.

## Acceptance Criteria
- [ ] Registration writes a valid binding, refuses ambiguity and unsupported schemas, and never selects the highest PRD number on its own.
- [ ] The manifest changes for every source change class in S-11 and stays stable for S-12; every S-14 case follows the contract with no secret value in any output.
- [ ] `npm test` passes with the new suite.

## Verification
Proves: change identity and source identity behave as contracted on real fixtures; regression: a stable digest across a source change, a changed digest across a checkbox tick, or a secret path silently included.
```bash
node test/runtime-identity.test.js && npm test
```

## Constraints
- No execution, no state writes beyond the binding file and content-addressed manifests; attempts arrive in T-34/T-35.
