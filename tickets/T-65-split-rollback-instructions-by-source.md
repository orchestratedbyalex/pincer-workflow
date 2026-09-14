---
ticket: T-65
status: done
size: S
prd: .prd/prd-v5.md
depends_on: []
started: 2026-09-12T06:39:52Z
last_check: 2026-09-12T06:41:50Z passed fa41af914e5b
verified: 2026-09-12T06:41:50Z fa41af914e5b
finished: 2026-09-12T06:41:50Z
---

## Objective
Fix review finding 3 on the built PRD v5 candidate: the rollback instructions in the contract say to restore the original binding from the backup and then delete `.prd/changes/<id>.json`, which is the same path, so following them deletes the restored binding; they also allow removing the restored runtime index. The tested rollbacks preserve both, so they do not test the documented procedure. Split the instructions into a legacy procedure and a v0.5.0 (binding) procedure that the tests follow literally.

## Context
- Relevant files: template/docs/runtime-contracts.md ("Migration and rollback"); test/change-contracts.test.js; test/change-migration.test.js (binding rollback); test/runtime-migrate.test.js (legacy rollback); docs/prd-v5-review-packet.md section 6.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), R-09 (S-27).
- Source: the user's review of `feat/prd-v5` at `1a5cbc5`, finding 3 (P2).
- Implements: R-09 ("a rollback guide").

## Requirements
- From legacy: restore the backed-up tickets and `.gitignore`; delete the schema 2 record `.prd/changes/<id>.json` and its `.prd/changes/<id>/` directory if present; remove `.pincer/` (a legacy project has no runtime state to keep). Result: legacy with the original receipts.
- From a v0.5.0 binding: restore the backed-up binding to `.prd/changes/<id>.json` (this overwrites the schema 2 record at the same path; do not delete it afterwards), delete `.prd/changes/<id>/` if present, restore the backed-up `.pincer/runtime/index.json` (the candidate pointers are rewritten by the migration) and remove `.pincer/runtime/selection.json`; keep the rest of `.pincer/runtime/` so the old attempts and manifests remain. Result: migrated (v0.5.0) with the original binding and history.
- The contract pins name both procedures; each rollback test states which procedure it follows and its steps match the text one for one; the packet's section 6 quotes the split.

## Acceptance Criteria
- [x] The contract has one procedure per migration source and neither deletes a file it just restored.
- [x] `test/change-migration.test.js` and `test/runtime-migrate.test.js` follow the documented steps literally and restore the originals byte for byte.
- [x] Packet section 6 and generated copies updated.

## Verification
Proves: the documented rollback is the one that is tested, for both sources.
```bash
node test/change-contracts.test.js
node test/change-migration.test.js
node test/runtime-migrate.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-58. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
