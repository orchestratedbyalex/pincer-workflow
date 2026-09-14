---
ticket: T-97
status: open
size: S
prd: .prd/prd-v7.md
depends_on: [T-89]
timeout: 600
---

## Objective
Stop `REVISION_CHANGED` from recommending a command that changes mode refuses.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-03 (a product fix required by an observed failure, per the T-89 constraint).
- Scenarios: none of its own; it closes a defect found while producing S-09's friction record.
- Relevant files: template/scripts/pincer-runtime/readiness.cjs; test/runtime-lifecycle.test.js; docs/prd-v7-pilots.md.
- Found by: [baseline observation](../docs/prd-v7-pilots.md), section 2.4. The original
  probe record is retained and is not re-run to hide the finding.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- `readiness.cjs` emits the remedy `register --rebind, then verify` for `REVISION_CHANGED`
  in every mode. In changes mode that command is refused with `AGREEMENT_CHANGED:
  --rebind is not supported for change records`, so the reader is sent to a command the
  runtime will not run. Make the remedy mode-aware: changes mode gets `change revise`
  and its authorization, legacy and migrated mode keep the released wording.
- Change no readiness verdict, reason code, precedence rule or exit code. This is the
  `next` string of one reason, nothing else.
- Add a regression that drives the real refusal: a done ticket in a changes-mode project
  whose PRD revision moved, asserting the reason's remedy names a command that the
  runtime accepts rather than one it refuses.

## Acceptance Criteria
- [x] In changes mode the `REVISION_CHANGED` remedy names `change revise` and its
      authorization; in legacy and migrated mode it is unchanged.
- [x] The recommended command is not one the runtime refuses: running it on the fixture
      does not produce `AGREEMENT_CHANGED: --rebind is not supported`.
- [x] No other reason code, verdict or exit code changes; the existing suites pass.

## Verification
Proves: the remedy string is mode-correct and the recommended command is accepted by
the runtime; it does not prove the rest of the precedence is right, which the existing
readiness and lifecycle suites cover.
```bash
set -e
node test/runtime-lifecycle.test.js
node test/change-lifecycle.test.js
node test/runtime-status.test.js
```

## Constraints
- Do not relax `REVISION_CHANGED` itself. A PRD revision invalidating passing attempts
  is deliberate conservative behaviour that PRD v7 preserves; only the advice is wrong.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.
