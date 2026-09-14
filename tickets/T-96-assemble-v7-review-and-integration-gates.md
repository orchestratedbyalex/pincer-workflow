---
ticket: T-96
status: open
size: M
prd: .prd/prd-v7.md
depends_on: [T-95]
timeout: 1800
---

## Objective
Make the final implementation, observations and limitations independently reviewable against every v7 scenario.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-10.
- Scenarios: S-28, S-29, S-30.
- Relevant files: new docs/prd-v7-review-packet.md; docs/prd-v7-artifacts/replay.sh; new test/improvement-review-packet.test.js; package.json; .github/workflows/ci.yml.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Map R-01..R-10 and S-01..S-30 to actual source, checks, candidate artifacts, live observations and explicit dispositions; label semantic review judgments separately from mechanical checks.
- Provide scratch-project replay cases for incomplete scaffold, malformed/escaping inputs, stale agreement after map authoring, brief/full routing drift, frozen-driver mutation and substituted/missing trial evidence, with working controls.
- Validate citation/artifact content and candidate identity, not just identifier presence; deliberately missing/forged records and vacuous scenario citations must fail.
- Run all existing and new executable suites, both generators without drift, packed installs and the existing Ubuntu/macOS by Node 22/24 CI matrix on the identified implementation candidate. npm test stays offline.
- Finish authored docs and metadata before selecting the evaluation candidate. Identify implementation and packet/evidence commits explicitly without requiring a file to contain its own commit hash. Preserve candidate freshness and existing listed-artifact rules.
- Report remaining limitations and missed efficiency targets honestly. Packet assembly does not merge, version, publish or create approval provenance.

## Acceptance Criteria
- [x] S-28: Every scenario has inspectable evidence and a truthful disposition; missing artifacts, substituted candidates and fabricated/vacuous citations fail validation.
- [x] S-29: Local full suite, generator/packed parity and required CI pass on the identified source; missing required gates are outstanding rather than green by inheritance.
- [x] S-30: The packet states the exact evaluation boundary and outstanding limitations, with all ordinary source edits preceding candidate selection and later changes handled by existing freshness rules.

## Verification
Proves: packet/evidence reference integrity, controlled replay cases and complete offline regression coverage; external CI and live-review evidence remain independently identified gates.
```bash
set -e
node test/improvement-review-packet.test.js
npm test
```

## Constraints
- No broad artifact-directory exemptions or version/wiki freshness exceptions. Do not mark unfinished observation requirements delivered because their validators pass.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

