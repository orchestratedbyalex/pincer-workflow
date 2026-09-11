---
ticket: T-40
status: done
size: M
prd: .prd/prd-v4.md
depends_on: [T-39]
started: 2026-09-11T11:24:28Z
last_check: 2026-09-11T11:32:08Z passed 67de5e81d0c8
verified: 2026-09-11T11:32:08Z 67de5e81d0c8
finished: 2026-09-11T11:32:08Z
---

## Objective
Ship the runtime in every distribution channel with identical files, prove the packed layouts execute the compatibility commands, update the public documentation, and assemble the review packet with the requirement and scenario traceability table.

## Context
- Relevant files: `scripts/build-plugin.sh` (copy `pincer-runtime.cjs` and `pincer-runtime/`; xform rewrites `scripts/pincer-runtime.cjs`), `bin/pincer.js` (`PLATFORM_ROOTS.common`, `EXECUTABLES`, help text), `test/distribution.test.js` (S-28 matrix: Claude-only, Codex-only, Copilot-only, all, plugin contain the identical runtime directory and can run `pincer-ticket.sh`, `pincer-status.sh`, `pincer-runtime.cjs status --json`, `migrate --preview`, `register` and `verify` on a fixture), `test/smoke.test.js`, `README.md`, `docs/index.html` (capability claims only where true), `template/.codex/README.md`, new `docs/prd-v4-review-packet.md`, `template/docs/runtime-contracts.md` (final).
- PRD section: R-09 (S-28), R-10 (S-30), 7, 8 (review packet).
- Implements: R-09 (S-28), R-10 (S-30 summary), all integration

## Requirements
- Every layout installs `scripts/pincer-runtime.cjs`, `scripts/pincer-runtime/*.cjs`, the wrappers and `docs/runtime-contracts.md`; the plugin ships the same files under `plugin/scripts/`; `test/distribution.test.js` compares the runtime directory digests across the tarball layouts and the plugin and runs the compatibility commands from each installed copy against a small git fixture.
- README: the `What you get` table and the update notes describe the runtime, migration, `done` semantics, `.pincer/` local state, evidence schema 2 and the Node 18+ requirement for all commands; no parity or superiority claim beyond what tests and trials show; `docs/index.html` gains one factual line for the runtime if its sheet lists the scripts.
- `docs/prd-v4-review-packet.md` follows PRD section 8: implementation reference (branch, base, the candidate is filled in at evaluation), traceability table with every R-01..R-10 and S-01..S-31 mapped to implementation files, test or trial evidence and disposition (delivered, blocked, deferred, outstanding), a pointer to the contract document, the verification record (suite list, packed matrix, generator parity), representative artifacts copied from a fixture run (a passed, failed and interrupted attempt, a stale-source JSON status, a schema-2 manifest, a sanitized log), and known limitations. S-31 is `outstanding` until T-41 records it.
- `npm test` includes every runtime suite; both generators produce no diff; `npm pack --dry-run` lists the runtime directory.

## Acceptance Criteria
- [x] Packed Claude-only, Codex-only, Copilot-only, all-platform and plugin layouts contain the identical runtime and execute the compatibility commands.
- [x] README, contract document and review packet are complete and make no unsupported claims; every S-NN has a disposition.
- [x] Full suite, packed installs and generator parity pass.

## Verification
Proves: the runtime is distributed identically on every channel and the review packet maps every requirement and scenario to evidence; regression: a layout missing a runtime file, a plugin copy that drifts, or a scenario without a disposition.
```bash
node test/distribution.test.js && npm test && for s in $(seq -f 'S-%02g' 1 31); do grep -q "$s" docs/prd-v4-review-packet.md || { echo "missing $s"; exit 1; }; done && for r in $(seq -f 'R-%02g' 1 10); do grep -q "$r" docs/prd-v4-review-packet.md || { echo "missing $r"; exit 1; }; done && npm pack --dry-run --json 2>/dev/null | grep -q 'template/scripts/pincer-runtime/' && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- No version bump in this ticket; the bump follows the evaluation as before.
