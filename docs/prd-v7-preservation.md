# PRD v7 preservation matrix

[PRD v7](../.prd/prd-v7.md) section 3 lists what this increment must preserve. This is
the map from each of those guarantees to the regression suites that would fail if it
broke, so "preserved" is a checkable claim rather than an intention.

**No efficiency target changes any of these gates.** The two additive surfaces are
read-only projections: `coverage scaffold` produces a draft that no gate accepts, and
`resume --brief` reports the verdict the full report already computed. Neither creates
a second authoritative record, caches a readiness value, executes a check or widens an
exemption. If an improvement ever needs one of these rows relaxed, that is a recorded
scope revision, not an optimization.

`test/improvement-contracts.test.js` reads this table and fails when a row names a
suite that is not in the tree, so the matrix cannot drift into naming checks that do
not exist.

| Guarantee | What must stay true | Suites |
| --- | --- | --- |
| Agreement identity | The agreement digest covers the PRD body, the inventory, the tickets and the map; editing any of them changes it, and a reformat or reorder does not | `change-agreement.test.js`, `coverage-agreement.test.js`, `coverage-map.test.js` |
| Explicit decisions | A deferral or removal needs a resolved decision naming the scenario and an authorization naming that decision; a generic continue authorizes no revised scope | `change-authorization.test.js`, `coverage-adoption.test.js`, `change-command-gates.test.js` |
| Selection and worktree isolation | Selection is metadata local to the worktree, grants no approval, and a report about an unselected change never prints a command that would run as written | `change-selection.test.js`, `change-resume.test.js`, `resume-brief.test.js` |
| Latest-failure precedence | A failed, interrupted or timed-out attempt immediately supersedes an earlier pass; historical passes stay historical | `runtime-lifecycle.test.js`, `runtime-runner.test.js`, `verification.test.js` |
| Source mutation detection | A check that mutates tracked source during its own run ends `error`; untracked non-ignored writes are `SOURCE_CHANGED` | `runtime-runner.test.js`, `runtime-state.test.js` |
| Conservative source freshness | Source changed after a passing attempt revokes readiness rather than narrowing the dependency scope to keep it green | `runtime-lifecycle.test.js`, `recovery.test.js`, `change-lifecycle.test.js` |
| Attempt locking | One writer at a time; a stale lock is reclaimed only through explicit recovery, never by assuming the owner died | `runtime-state.test.js`, `change-transactions.test.js` |
| Transaction recovery | Process death at any journal boundary recovers; a committed transaction completes and an uncommitted one is discarded, and neither promotes an attempt to passed | `change-transactions.test.js`, `recovery.test.js`, `runtime-state.test.js` |
| The exact post-candidate artifact allowlist | Only `NOTES.md`, valid locators and the named manifest's own listed artifacts may differ from the candidate — never a whole directory | `candidate.test.js`, `coverage-evidence.test.js`, `runtime-evidence.test.js` |
| Legacy mode | A project with no change records keeps the v0.4.1 receipt rules | `ticket.test.js`, `verification.test.js`, `runtime-lifecycle.test.js` |
| Migrated mode | A v0.5.0 schema 1 binding keeps the released semantics, including its `register --rebind` repair | `runtime-migrate.test.js`, `runtime-status.test.js` |
| Changes mode | Schema 2 records, explicit lifecycle, agreements and authorization | `change-registry.test.js`, `change-lifecycle.test.js`, `change-evaluations.test.js` |
| Strict mode | Schema 3 records, the authored map, phase-specific coverage and schema 3 evidence | `coverage-readiness.test.js`, `coverage-evidence.test.js`, `coverage-impact.test.js` |
| Schema and default CLI compatibility | Status JSON, resume JSON schema 2, evidence schemas and default human output are unchanged; new draft and brief output is opt-in | `contracts.test.js`, `change-contracts.test.js`, `coverage-contracts.test.js`, `resume-brief.test.js` |
| Complete output on every exit path | Every byte goes through `io.cjs`; a piped report is never truncated and never exits 0 with partial JSON | `runtime-output.test.js`, `resume-brief.test.js` |
| One next-action precedence | Every report that renders a next action consumes `routing.cjs` and cannot recommend a command the gates refuse | `change-resume.test.js`, `coverage-reports.test.js`, `resume-brief.test.js`, `change-lifecycle.test.js` |
| Structural-impact contract for a requirement-body edit | A changed requirement body is a structural change under the existing contract and the freshness gates still apply; PRD v7 does not reclassify the earlier F-02 finding as a release bypass | `coverage-impact.test.js`, `coverage-agreement.test.js` |
| Read-only reporting | Scaffold and brief write no file, launch no check, change no selection and record no approval | `coverage-scaffold.test.js`, `resume-brief.test.js`, `runtime-output.test.js` |
| The v6 study is frozen | Every v6 protocol, fixture, driver and raw record is byte-for-byte unchanged; v7 is a new edition with its own cohort | `improvement-contracts.test.js`, `delivery-benchmark.test.js` |
| Measurement honesty | A null metric keeps its reason and is never reported as zero; missing provenance, a missing evaluator or an unverified strict adoption never yield `accepted` | `effort-records.test.js`, `execution-freeze.test.js` |
| Secrets never reach a record | Configuration capture is an allowlist; a secret-looking key or value is refused rather than redacted or hashed, and environment variables contribute names only | `execution-freeze.test.js` |
| Generated parity | Adapters and plugin are regenerated from `template/` and never hand-edited | `distribution.test.js`, `change-distribution.test.js`, `coverage-distribution.test.js` |

## Counterexamples for the new surfaces

A preservation claim is only as good as the case that would break it. These are the
controlled counterexamples the two new suites drive, rather than only asserting the
happy path:

| Surface | Counterexample | Suite |
| --- | --- | --- |
| Coverage draft | The draft envelope saved in the map's place is refused by `readMap`, `load` and `coverage adopt --preview` | `coverage-scaffold.test.js` |
| Coverage draft | The same document *with* a `schema: 1` key validates — so the missing key is the whole guard, not an accident | `improvement-contracts.test.js` |
| Coverage draft | A malformed, duplicate-keyed, unsupported-schema or symlinked map is refused with exit 4 before any draft is printed | `coverage-scaffold.test.js` |
| Coverage draft | An authored row the inventory no longer defines is preserved and flagged, never dropped | `coverage-scaffold.test.js` |
| Coverage draft | A ticket's own `Implements:` claim does not become a link, and ticket IDs on that line are not read as scenarios | `coverage-scaffold.test.js` |
| Brief resume | Across eleven fixtures — no selection, planned, paused, active, terminal, wrong selection, running attempt, interrupted attempt, invalid history, stale agreement, stale evidence — brief and full give the same verdict and next action | `resume-brief.test.js` |
| Brief resume | Every distinct blocker code survives grouping with its exact count | `resume-brief.test.js` |
| Brief resume | A whole-tree snapshot before and after every report is identical | `resume-brief.test.js` |
| Execution freeze | Mutating each frozen input in turn changes the cohort, and a record from an earlier cohort is refused rather than re-evaluated | `execution-freeze.test.js` |
| Execution freeze | Secret canaries in allowlisted fields are refused, not hashed; an `NAME=value` environment entry is refused without being echoed | `execution-freeze.test.js` |
| Effort record | An outcome its own checks contradict is refused; an acceptance resting only on the candidate's own tests is refused | `effort-records.test.js` |
| Effort record | Overlapping sessions are merged, and the naive sum is reported beside the union rather than instead of it | `effort-records.test.js` |
