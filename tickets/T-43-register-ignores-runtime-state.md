---
ticket: T-43
status: open
size: S
prd: .prd/prd-v4.md
depends_on: [T-40]
---

## Objective
Make a fresh registration ignore `.pincer/` the way migration does, so a registered project's first `verify` does not leave untracked runtime state that makes the candidate look dirty.

## Context
- Relevant files: `template/scripts/pincer-runtime/identity.cjs` (`register`), `template/scripts/pincer-runtime/migrate.cjs` (`IGNORE_LINE`, `gitignoreHas`), `bin/pincer.js` (`GITIGNORE_LINES`), `template/docs/runtime-contracts.md` (`## Change binding`, `## Migration and rollback`), `test/runtime-identity.test.js`, `test/smoke.test.js`.
- PRD section: R-06 (ignored, project-local `.pincer/runtime/`), R-09 (installation deploys the runtime).
- Implements: R-06, R-09 (found in the T-41 greenfield trial: after `Register PRD v1` and the first `verify`, `git status` showed `?? .pincer/`)

## Requirements
- `register` appends `.pincer/` to `.gitignore` (creating the file if needed, with the same comment migration uses) when the line is absent, before writing the binding; `--rebind` and idempotent re-registration leave `.gitignore` alone when the line exists.
- The installer's `.gitignore` lines gain `.pincer/`, so `init` and `update` ignore the runtime state on every layout; `doctor` keeps checking the `.env` lines and reports a missing `.pincer/` line as a note, not a failure.
- The contract document says registration and migration both add the line.
- Tests: `test/runtime-identity.test.js` asserts the line after a fresh `register` and that a second `register` does not duplicate it; `test/smoke.test.js` asserts the installed `.gitignore` contains `.pincer/`.

## Acceptance Criteria
- [ ] A fresh `register` leaves `git status` clean after the first `verify`.
- [ ] `init` and `update` add `.pincer/`; existing `.env` handling is unchanged.
- [ ] `npm test` passes.

## Verification
Proves: registration and installation ignore the runtime state; regression: untracked `.pincer/` after a registered project's first verify.
```bash
node test/runtime-identity.test.js && node test/smoke.test.js && npm test
```

## Constraints
- No other runtime behavior change.
