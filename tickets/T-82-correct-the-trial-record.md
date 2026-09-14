---
ticket: T-82
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T20:12:28Z
last_check: 2026-09-13T20:19:11Z passed 81ae159ba212
verified: 2026-09-13T20:19:11Z 81ae159ba212
finished: 2026-09-13T20:19:11Z
---

## Objective
Correct the delivery trial record to what the saved runs actually support. An independent recomputation from the 42 saved `record.json` files reproduced every headline number exactly, but found six statements the data does not support: the escaped-regression claim, the reason recorded on one invalidated run, the undisclosed ambient agent configuration both arms ran under, the freeze's coverage of the live driver, two runs whose recorded minutes exceed the tool's own session duration, and an operator-intervention count that disagrees with the table beside it.

## Context
- Relevant files: docs/trial-prd-v6.md (S-29, S-30 and Counts rows, Deviations, Limitations); docs/prd-v6-artifacts/benchmark/runs/ui-states/pair-1/pincer/record.json (the recorded reason); scripts/delivery-benchmark/benchmark.cjs (`frozenManifest`); docs/prd-v6-artifacts/benchmark/{run-live.sh,session.cjs,effort.cjs} (the unfrozen driver).
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-10 (S-29 "Record prompts, interventions, failures, exclusions and evaluator provenance; no post-hoc cherry-picking or silent replacement of invalid runs"; S-30 "Report variation, denominators, unavailable values and limitations").
- Source: the delivery-benchmark audit run during `/pincer-evaluate` of the combined v5+v6 candidate.
- Implements: R-10 ("honestly reported; a result showing overhead or no quality advantage is valid data").

## Requirements
- The escaped-regression metric says what it is: the candidate's own `npm test` for five briefs, plus one hidden `truncate` regression test for bugfix-brownfield. Limitations state that only the brownfield brief has independent regression coverage. `docs/delivery-benchmark.md` carries the same over-general sentence and is inside the freeze (`frozen.json.protocol`); it is not edited — the discrepancy is recorded as a known limitation so the freeze of 2026-09-12 still verifies.
- The record on `ui-states/pair-1/pincer` is left exactly as the operator wrote it: `docs/prd-v6-artifacts/README.md` states that the collector rebuilds `benchmark/runs/` from scratch and that those files are not hand-edited, so a correction there would not survive a re-collect and would misrepresent what was recorded at the time. The contradiction is disclosed where the claims live instead. Deviations disclose that one of the six invalidated runs carried substantive work and a rejected evaluation, and give the alternative denominator (17/19 for the kit arm) so a reader can judge the invalidation rule.
- Limitations disclose that both arms ran inside the operator's personal Claude Code configuration, that the plain arm invoked the `Skill` tool in 20 of its sessions and one kit run used a browser MCP plugin, and that the records do not capture which skills, plugins or MCP servers were active. The plain arm is not described as a bare agent.
- The trial record states that the freeze covers the briefs, evaluators, harness and protocol but not the live driver, and that the driver changed during the benchmark.
- The session-time ratio is reported as a range with both measures named (harness wall clock and the tool's own `duration_ms`), and the two outlier runs are footnoted.
- The S-29 operator-intervention figure agrees with the S-27 row and with `report.md`.

## Acceptance Criteria
- [x] Every statement in `docs/trial-prd-v6.md` is either recomputed from the saved records or labelled as unavailable.
- [x] No number in the record disagrees with another number in the record.
- [x] `node scripts/delivery-benchmark/benchmark.cjs check-freeze` still matches the freeze of 2026-09-12 — nothing inside the freeze is edited.
- [x] The tables the generator produces still reproduce the document byte for byte.

## Verification
Proves: the trial record's claims match the saved runs, and the freeze is untouched.
```bash
node test/coverage-trial-record.test.js
node test/delivery-benchmark.test.js
node scripts/delivery-benchmark/benchmark.cjs check-freeze
```

## Constraints
- No run is re-run, re-evaluated, added or removed; only the description of the existing runs changes. Manage this ticket with the pinned released v0.5.0 kit.
- Freezing the driver is a change to the benchmark contract and belongs to a later PRD, not to a correction ticket; record it as a follow-up.
