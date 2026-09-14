---
ticket: T-90
status: open
size: M
prd: .prd/prd-v7.md
depends_on: [T-89]
timeout: 600
---

## Objective
Remove repetitive coverage-map transcription while leaving semantic links, check definitions and authorization reviewable.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-04.
- Scenarios: S-10, S-11, S-12.
- Relevant files: new template/scripts/pincer-runtime/scaffold.cjs; template/scripts/pincer-runtime.cjs; requirements.cjs and coverage.cjs siblings; bin/pincer.js; new test/coverage-scaffold.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Implement the frozen coverage scaffold --change <id> [--json] interface as a read-only draft projection of validated inventory, associated tickets and any existing authored map.
- Include every expected scenario exactly once; preserve existing explicit links/checks/scope without silently dropping removed or invalid obligations. Separate unresolved items and candidate ticket/verification references from reviewed mappings.
- Do not infer semantic sufficiency, invent check commands, tick criteria, create map files, adopt coverage, change selection or grant approval. Reuse existing containment/schema validation and io.cjs.
- Use a distinct versioned draft envelope; it must not be accepted as a valid coverage map. Document the manual author/review step and demonstrate an authored complete map passing the existing validator and explicit adoption gates.
- Tie UX choices to the T-89 friction record and measure output/operations against its representative authoring task. Preserve all old command and management modes.

## Acceptance Criteria
- [x] S-10: A partial-map fixture emits a deterministic complete inventory with authored entries preserved and unresolved links visibly separate.
- [x] S-11: Malformed inputs, wrong-change tickets, unsupported schemas and traversal/symlink escapes are refused before writes or command execution; whole-tree snapshots show inspection is read-only.
- [x] S-12: The draft cannot confer completeness/readiness; a deliberately authored map uses existing adoption/authorization, and changed inputs still trigger stale-agreement refusal.

## Verification
Proves: observable scaffold content, unresolved-input handling, containment and no-write behavior, followed by the real existing map/adoption gates.
```bash
set -e
node test/coverage-scaffold.test.js
node test/coverage-map.test.js
node test/coverage-adoption.test.js
node test/coverage-agreement.test.js
```

## Constraints
- Do not add fuzzy matching, an LLM dependency, automatic test generation, automatic file replacement or a second authoritative coverage format.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

