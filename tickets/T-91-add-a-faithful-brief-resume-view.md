---
ticket: T-91
status: open
size: M
prd: .prd/prd-v7.md
depends_on: [T-89]
timeout: 600
---

## Objective
Reduce fresh-session context loading while preserving every readiness decision and a usable route to full detail.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-05.
- Scenarios: S-13, S-14, S-15.
- Relevant files: template/scripts/pincer-runtime/resume.cjs; routing.cjs; template/scripts/pincer-runtime.cjs; new test/resume-brief.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Implement the frozen resume --brief [--change <id>] [--json] interface as a pure projection of the existing computed full report and shared routing, with no new next-action policy.
- Include viewed/selected identity, lifecycle, authorization/evidence verdicts, next action, exact blocked/omitted counts and artifact/detail references. Group repetition without hiding a blocking reason category.
- Keep default full output and JSON contracts intact. Use io.cjs, preserve errors/exit behavior, and never write state or run checks while reporting.
- Drive the whole state matrix with real fixtures, including invalid history, terminal/nonselected changes, active and interrupted attempts, stale agreement and stale evidence.
- Use T-89's observed repeated-read case to define a reproducible large-change comparison; measure fewer bytes and show that users can find all omitted detail.

## Acceptance Criteria
- [x] S-13: Every state in the PRD matrix has matching full/brief verdicts and next actions, complete blocking reason categories and correct selection guidance.
- [x] S-14: The large-change report is smaller, its exact counts and references resolve, piped JSON is complete, invalid input is nonzero and before/after files are identical.
- [x] S-15: A recorded fresh-session task locates its next work from brief output and linked artifacts; default contracts are unchanged and missing history is never guessed.

## Verification
Proves: brief/full behavioral agreement, detail discoverability, compatibility and complete read-only output; T-93 supplies the complementary live fresh-session observation.
```bash
set -e
node test/resume-brief.test.js
node test/change-resume.test.js
node test/coverage-reports.test.js
node test/runtime-output.test.js
```

## Constraints
- Do not impose a truncation limit that hides blockers, cache readiness independently, or broaden source/evidence exemptions.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

