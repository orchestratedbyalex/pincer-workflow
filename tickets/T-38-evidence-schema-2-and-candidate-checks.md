---
ticket: T-38
status: done
size: L
prd: .prd/prd-v4.md
depends_on: [T-36]
started: 2026-09-11T11:02:48Z
last_check: 2026-09-11T11:10:34Z passed 84039cc9fb04
verified: 2026-09-11T11:10:34Z 84039cc9fb04
finished: 2026-09-11T11:10:34Z
---

## Objective
Run evaluate's executable checks through the runtime against the committed candidate, export a portable schema-2 evidence set populated from attempts, and validate schema 2 alongside schema 1 with a legacy provenance label.

## Context
- Relevant files: new `template/scripts/pincer-runtime/evidence.cjs` (schema 1 validation moved here from `pincer-evidence.cjs`, schema 2 added, export), `template/scripts/pincer-evidence.cjs` (thin entry point; CLI unchanged; `validate` accepts both schemas), `template/scripts/pincer-runtime.cjs` (`check C-NN --candidate <sha> [--timeout N] -- <command…>` and `evidence export --candidate <sha> --base <sha> --prd .prd/prd-vN.md --draft <file>`), `template/docs/runtime-contracts.md` (`## Evidence schema 2`), `test/evidence.test.js` (schema 1 stays green), new `test/runtime-evidence.test.js`.
- PRD section: R-07, 5 (candidate manifest owned by the exporter plus explicit review/visual inputs).
- Implements: R-07 (S-21, S-22, S-23)

## Requirements
- `check` refuses unless HEAD equals `--candidate`, the binding is current, and `git status --porcelain --untracked-files=all` lists nothing outside `NOTES.md` and `.prd/evidence/prd-vN/<candidate>/`; it never stashes, resets or commits. It runs the command as a candidate-context attempt (`kind: candidate`, `candidate`, `check`) with the same capture, timeout and signal rules as ticket attempts, and prints the attempt outcome; exit codes follow the runner.
- `evidence export` reads a draft JSON with the authored fields (`environment.tools`, `environment.limitations`, `coverage_review`, `requirements`, review and visual `checks` with their artifact paths, `visual_review`), takes the latest attempt for every command check ID named in the draft's `checks` (an entry `{id, kind: "command", required}` without result), refuses when any named check has no attempt for this candidate, copies each attempt's sanitized stdout and stderr into `checks/C-NN.log` (command line first, then the logs, with truncation notes), fills `command`, `result` (`passed` → `passed`, any other outcome → `failed`, an `error` outcome → `unverified` with the error in `note`), `timestamp`, `provenance: "runtime"` and `attempt` (`id`, `sequence`, `outcome`, `exit_code`, `started`, `finished`, `source_before`, `source_after`, `check_digest`, `runner`, `cwd`, `log_sha256`, `truncated`), labels review and visual checks `provenance: "authored"`, adds `change` (`id`, `prd_revision`, `base`), computes `artifacts` digests, writes `manifest.json` schema 2 and validates it. It never invents a review transcript or converts a review judgment into a command result.
- Validator: schema 1 stays as today; schema 2 requires the additional fields, checks that each runtime command check's log artifact digest equals `attempt.log_sha256`, that `result` agrees with `attempt.outcome`, and that `change.base` equals `base`; `--files` lists artifacts for both. `validate` prints `ok <candidate> schema <n>`; status labels a schema-1 manifest `provenance: legacy (schema 1, authored command results)` and a schema-2 one `provenance: runtime`.
- Tests (`test/runtime-evidence.test.js`, added to `npm test`): S-21 on a committed fixture candidate, `check` runs, `export` produces a manifest whose command text, outcome, log and source identity match the attempt; editing the log, pointing at a wrong candidate, deleting an artifact, and altering `attempt.log_sha256` each fail validation; a dirty tree, a HEAD that is not the candidate, and an untracked stray file each make `check` refuse; S-22 the tickets' `verify` runs before the candidate created no product diff, and the export commit path (NOTES.md plus the evidence directory) keeps `notes_current` current while an extra source change does not; S-23 a schema-1 fixture validates with the legacy label and cannot satisfy a requirement that a schema-2 runtime check is required for (a draft naming a command check with no attempt refuses export).

## Acceptance Criteria
- [x] Executable candidate checks run only on a clean view of the committed candidate and are exported from attempts, not authored.
- [x] Schema 2 validates tamper, wrong-candidate and missing-artifact cases; schema 1 keeps validating with a legacy label.
- [x] `npm test` passes with the new suite and the existing evidence suite.

## Verification
Proves: exported evidence is populated from runtime attempts and validated end to end on a real candidate; regression: an export from a dirty tree, a manifest whose log disagrees with its attempt, or schema 1 passing as runtime provenance.
```bash
node test/runtime-evidence.test.js && node test/evidence.test.js && npm test
```

## Constraints
- Keep `pincer-evidence.cjs` as the validator entry point so existing commands and playbook text keep working.
