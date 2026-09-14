# PRD v7 review packet — make trusted delivery easier and cheaper

What a reviewer needs to check this work without reading the whole branch: where the
implementation is, which requirement and scenario each part answers, what was actually
run, which artifacts show the behaviour, what deviates from the PRD, how to reproduce
the interesting failures independently, and what is still open.

This packet assembles the review material. It does not evaluate, merge, version, or
publish; those are separate stages with their own gates.

**Read section 6 first if you read nothing else.** A large part of [PRD v7](../.prd/prd-v7.md)
is live observation — three baseline pilots, two platform journeys, a cross-agent
handoff, 72 benchmark runs and timed reviews by two non-implementing people. **None of
it has been run.** The tooling, the record schemas, the validators and the frozen
protocol are here; the observations are outstanding and their requirements are
unfinished. Nothing in this packet should be read as evidence that they happened.

## 1. Implementation reference

| Ticket | What it added | Where |
| --- | --- | --- |
| T-87 | The frozen v7 protocol, the interface contract of both new surfaces, the preservation matrix, the reconciled handover | `docs/prd-v7-protocol.md`, `docs/prd-v7-preservation.md`, `docs/prd-v7-artifacts/v6-preservation.json`, `test/improvement-contracts.test.js` |
| T-88 | The v7 effort record (schema 7) as an event log, its offline projection, and the execution freeze | `scripts/delivery-benchmark-v7/effort.cjs`, `scripts/delivery-benchmark-v7/freeze.cjs`, `test/effort-records.test.js`, `test/execution-freeze.test.js` |
| T-89 | The baseline friction measurement, its two harnesses, the observation record schema and validator | `docs/prd-v7-pilots.md`, `scripts/delivery-benchmark-v7/baseline-journey.cjs`, `scripts/delivery-benchmark-v7/scale-measure.cjs`, `scripts/delivery-benchmark-v7/observations.cjs`, `test/strict-pilot-records.test.js` |
| T-90 | `coverage scaffold --change <id> [--json]` — the read-only coverage draft | `template/scripts/pincer-runtime/scaffold.cjs`, CLI dispatch, `test/coverage-scaffold.test.js` |
| T-91 | `resume --brief [--change <id>] [--json]` — the projection of the computed resume report | `template/scripts/pincer-runtime/resume.cjs` (`brief`/`renderBrief`), CLI dispatch, `test/resume-brief.test.js` |
| T-92 | The first-use journey in the README and the canonical playbooks, the packed-install walkthrough, regenerated adapters and plugin | `README.md`, `template/.claude/commands/`, `test/strict-onboarding.test.js` |
| T-93 | The platform journey record, the handoff record and the support matrix | `docs/prd-v7-platforms.md`, `docs/prd-v7-artifacts/platforms/`, `test/platform-trial-records.test.js` |
| T-94 | The v7 benchmark edition: eight briefs with held-out evaluators and injected faults, the 72-run schedule, the browser-evaluation seam | `scripts/delivery-benchmark-v7/`, `test/fixtures/delivery-benchmark-v7/`, `test/delivery-benchmark-v7.test.js` |
| T-95 | The comparison record: paired pilots, timed independent reviews, predeclared targets | `docs/prd-v7-comparison.md`, `docs/prd-v7-artifacts/comparison/`, `test/improvement-trial-records.test.js` |
| T-96 | This packet, the replay cases and the integration gates | `docs/prd-v7-review-packet.md`, `docs/prd-v7-artifacts/replay.sh`, `test/improvement-review-packet.test.js` |
| T-97 | Fix found while measuring: `REVISION_CHANGED` advised a command changes mode refuses | `template/scripts/pincer-runtime/readiness.cjs`, regression in `test/change-lifecycle.test.js` |
| T-98 | Fix found before the first live run: the frozen driver placed and capped nothing, and the edition had no run loop | `scripts/delivery-benchmark-v7/live-driver.sh`, `scripts/delivery-benchmark-v7/orchestrator.cjs`, `test/benchmark-orchestrator.test.js` |

## 2. The two shipped product changes

Both are additive, read-only projections of state the runtime already computes. Neither
creates a second authoritative record, caches a readiness value, executes a check or
widens an exemption.

**`coverage scaffold`** removes transcription, not judgment. It lists every live
scenario exactly once with its requirement, preserves authored content verbatim, and
reports each ticket's own `Implements:` claim and Verification text as *material to
read* with the ticket's file. It never invents a link, a check command, a ticket role
or a scope disposition. Its envelope is `draft: 1` with no `schema` key, so every gate
that reads a map refuses it.

**`resume --brief`** is a projection: `next` is the full report's own object, copied.
Every distinct blocker code survives grouping with its exact count, and the brief names
the command that prints the rows it omitted.

Measured, on the same journey at four change sizes (`docs/prd-v7-pilots.md` §3):

| Scenarios | `resume` | `--brief` | saved | `resume --json` | `--brief --json` | saved |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 1,211 | 576 | 52% | 4,655 | 1,614 | 65% |
| 40 | 3,796 | 581 | 85% | 26,629 | 2,730 | 90% |

The brief is constant-size; the full report grows with the change. **The scaffold's
byte saving is real only at scale and the pilots document says so**: at three scenarios
the draft is no smaller than reading the PRD and the tickets. On small changes its value
is that membership is generated and therefore cannot be wrong, not that it is shorter.

Fewer bytes is not less effort. Whether either helps a real session is T-93 and T-95.

## 3. Scenario-by-scenario disposition

`mechanical` means a check decides it. `judgment` means a person decided and the entry
says who and on what. `outstanding` means it has not been established.

| Req | Scenario | Disposition | Basis |
| --- | --- | --- | --- |
| R-01 | S-01 | delivered (mechanical) | `test/improvement-contracts.test.js` — the protocol is dated, versioned, names the baseline, schedule, metrics and rubric, and records every access/cap decision as outstanding |
| R-01 | S-02 | delivered (mechanical) | `docs/prd-v7-preservation.md` maps 22 guarantees to suites that exist; the counterexample table is executed by the suites it names |
| R-01 | S-03 | delivered (mechanical) | `test/improvement-contracts.test.js` — the reconciliation table is checked against this checkout by `git merge-base`; the v6 study is digested file-by-file in `docs/prd-v7-artifacts/v6-preservation.json` and mutation-checked |
| R-02 | S-04 | delivered (mechanical) | `test/effort-records.test.js` — linked events, stage timings, overlapping intervals merged not summed, deterministic replay |
| R-02 | S-05 | delivered (mechanical) | `test/effort-records.test.js` — null keeps its reason and is never zero; missing provenance, a missing evaluator or an unverified strict adoption cannot yield `accepted`; a cap-terminated run with a usable candidate is evaluated |
| R-02 | S-06 | delivered (mechanical) | `test/execution-freeze.test.js` — every frozen input mutated in turn; secret canaries refused rather than hashed; symlinked inputs refused |
| R-03 | S-07 | **outstanding** | no pilot has run. Three records exist, all `observed: false`, `status: outstanding`, with their reason |
| R-03 | S-08 | **outstanding** | the validator and its forgery cases are delivered and tested; the observations they would validate do not exist |
| R-03 | S-09 | delivered (mechanical + judgment) | `docs/prd-v7-pilots.md` §2–4: measured friction, ranked, with both improvements tied to numbered observations before implementation. **Judgment:** that this operator-driven measurement is an adequate design basis is mine as implementer; it is explicitly *not* the agent pilots R-03 asks for |
| R-04 | S-10 | delivered (mechanical) | `test/coverage-scaffold.test.js` — complete inventory, authored content preserved, unresolved separated, byte-identical repeated calls |
| R-04 | S-11 | delivered (mechanical) | `test/coverage-scaffold.test.js` — malformed, duplicate-key, unsupported-schema, wrong-change and symlinked inputs refused before any draft; whole-tree snapshots show no write |
| R-04 | S-12 | delivered (mechanical) | `test/coverage-scaffold.test.js` — the draft is refused by `readMap`, `load` and `coverage adopt --preview`; the authored map passes the real gates; stale-agreement refusal survives |
| R-05 | S-13 | delivered (mechanical) | `test/resume-brief.test.js` — thirteen state fixtures; identical verdict and next action; every blocker category retained with its count |
| R-05 | S-14 | delivered (mechanical) | `test/resume-brief.test.js` — a 20-scenario change: brief is under half the bytes, counts exact, references resolve, piped JSON complete, tree unchanged |
| R-05 | S-15 | delivered (mechanical) / **outstanding** (live) | `test/resume-brief.test.js` — default contracts unchanged and missing history never guessed are mechanical. **A fresh session actually using it is T-93 and has not run** |
| R-06 | S-16 | delivered (mechanical) | `test/strict-onboarding.test.js` — a packed `npm pack` + install walkthrough through unresolved mapping, reviewed adoption, paused recovery and stale-authorization refusal |
| R-06 | S-17 | delivered (mechanical) / **outstanding** (live) | `test/strict-onboarding.test.js` — repeated continuation requests no duplicate decision and changed scope requires its authorization, driven through the CLI. **Whether an agent reading the instructions behaves this way is T-93** |
| R-06 | S-18 | delivered (mechanical) | `test/strict-onboarding.test.js` — first-use journey precedes the historical changelog by byte offset; kit pinning documented; no installation check presented as a live trial |
| R-07 | S-19 | **outstanding** | no live journey on either surface |
| R-07 | S-20 | **outstanding** | no handoff has been run |
| R-07 | S-21 | delivered (mechanical) / **outstanding** (content) | `test/platform-trial-records.test.js`, `docs/prd-v7-platforms.md` — the matrix separates `observed`/`installed`/`unobserved` and the validator refuses packaged parity as observed. **Every row is currently `unobserved` or `installed`; nothing is observed** |
| R-08 | S-22 | delivered (mechanical) | `test/delivery-benchmark-v7.test.js` — eight working controls pass; each injected fault fails its intended evaluator. **Limitation:** three faults are not separable and the suite asserts the intended check is among the failures, not alone. The browser adapter is a deterministic fake proving the seam, not a browser |
| R-08 | S-23 | delivered (mechanical) | `test/delivery-benchmark-v7.test.js` — 72 unique cells, balanced arm order, matched inputs asserted structurally; a strict run without observed adoption is a protocol failure. **Limitation:** equal model/tool/caps across arms is a property of the live driver, not exercised offline |
| R-08 | S-24 | delivered (mechanical) | `test/execution-freeze.test.js`, `test/delivery-benchmark-v7.test.js` — changed inputs create a new cohort; old records stay readable under their own; invalid and partial cases retain reasons; independent checks distinguished from own-tests |
| R-09 | S-25 | **outstanding** | 0 of 72 runs and 0 of 3 paired pilots completed |
| R-09 | S-26 | **outstanding** | no reviewers identified; no review has been timed |
| R-09 | S-27 | **outstanding** | both predeclared targets are `outstanding`; the report shape is frozen and publishes unfavourable results, but there are no results |
| R-10 | S-28 | delivered (mechanical) | `test/improvement-review-packet.test.js` binds every citation in this table to the repository; missing artifacts, forged references and vacuous citations fail |
| R-10 | S-29 | delivered (mechanical) / **outstanding** (CI) | `package.json` test chain, `test/distribution.test.js`, `test/installer.test.js` — the full offline suite, both generators and packed installs pass locally. **The Ubuntu/macOS × Node 22/24 CI matrix has not run on this work** |
| R-10 | S-30 | delivered (judgment) | authored documentation and metadata precede candidate selection; no candidate has been selected, so no evaluation exists to be stale. **Judgment:** mine as implementer |

Ten of thirty scenarios are outstanding, and three more are partly outstanding. That is
the honest shape of this increment: the engineering is done, the experiment is not.

## 4. Replay cases

`bash docs/prd-v7-artifacts/replay.sh all` builds scratch projects from `template/` and
drives the runtime the way a session would. Six cases, each with its working control:

| Case | What it establishes |
| --- | --- |
| `incomplete` | an unmapped change's draft names every gap, invents nothing, is refused as a map, and the authored map adopts through the real gates |
| `escaping` | malformed, unsupported-schema and symlinked maps are refused with exit 4 before any draft is printed; usage errors exit 2 |
| `stale` | a PRD edit after authorization yields `AGREEMENT_CHANGED` in full and brief alike, and the draft reports the new scenario as unresolved rather than covered |
| `routing` | brief and full agree on the verdict, the next action and every blocker category; the brief is smaller and names where the detail is; no report writes |
| `frozen` | a mutated execution input starts a new cohort, an old record is refused rather than re-evaluated, and a secret canary never reaches a fingerprint |
| `substituted` | a mislabelled fixture, a missing stage, a forged candidate, a discarded failure, a generic continue, an escaping reference and packaged-parity-as-observed each fail by code |

The v6 replay cases are unchanged and still run from `docs/prd-v6-artifacts/replay.sh`.

## 5. Preservation

`docs/prd-v7-preservation.md` maps every guarantee PRD v7 section 3 requires to the
suites that would fail if it broke, and `test/improvement-contracts.test.js` fails when
a row names a suite that does not exist.

The v6 study is frozen file-by-file in `docs/prd-v7-artifacts/v6-preservation.json`
(674 files). The assertion is mutation-checked: corrupting one digest makes the suite
name the file that moved. V7 is a new edition under `scripts/delivery-benchmark-v7/`
and `test/fixtures/delivery-benchmark-v7/`; nothing under the v6 paths was edited.

Two historical records were touched, both mechanically and both recorded here.

`docs/prd-v5-review-packet.md`'s full-suite row names the `npm test` chain and its
validator asserts the count matches `package.json`. Twelve new suites made it stale, so
the row was updated the way PRD v6 updated it before: the count and list are current,
and the row says explicitly that the v6 and v7 suites were added later and **this v5
record makes no claim about either set**. No v5 result, disposition or artifact changed.

Both packet validators counted suites with `/node (test\/[a-z-]+\.test\.js)/g`, which
cannot match a suite name containing a digit — `delivery-benchmark-v7` was invisible to
them and the count silently understated the chain by one. The character class is now
`[a-z0-9-]`. This is a latent defect in the validators, found because a v7 suite carries
a version number; it is a fix, not a relaxation, and it makes both counts stricter.

One deviation from the PRD's architecture table, recorded rather than hidden: it placed
v7 measurement code under `scripts/delivery-benchmark/`. That directory is digested
whole by the v6 harness (`scripts/delivery-benchmark/benchmark.cjs:56`,
`treeDigest(__dirname)`), so any file added inside it breaks the v6 freeze. The v7 code
is therefore a sibling, `scripts/delivery-benchmark-v7/`. The alternative was editing a
frozen v6 file.

## 6. What is outstanding, and what it needs

Every item here is a decision only the user can make. The implementing agent prepared
the bounded schedule, as PRD v7 section 8 directs; what remains is the access and
spending decisions it said to obtain afterwards.

| Outstanding | Blocks | What it needs |
| --- | --- | --- |
| Three pilot projects (1 greenfield, 2 brownfield, one with pre-existing user edits) | R-03 (S-07, S-08) | project selection and access decisions |
| A concrete spending cap and wall-clock cap | R-03, R-07, R-09 | **the 72-run schedule is substantive spending and must be costed before it runs** |
| Two non-implementing reviewers | R-09 (S-26) | people who did not implement this candidate, available for timed reviews |
| Codex CLI availability and pinned version | R-07 (S-19, S-20) | the tool installed and its version recorded |
| Browser tooling for UI evaluation | R-08, R-09 | absent tooling makes a run `unavailable`, never an acceptance |
| The CI matrix on this work | R-10 (S-29) | a push; the matrix is Ubuntu/macOS × Node 22/24 |

A smaller study is not something the implementing agent may decide by running fewer
cells: it requires an explicit recorded scope revision.

## 6b. Ticket state, as the runtime computes it

These tickets were managed with the independently pinned released 0.6.0 kit, outside
the working tree. What it will and will not close is itself a result worth reading:

| Ticket | Status | Why |
| --- | --- | --- |
| T-87, T-88, T-94 | `done` | verified through the pinned kit, with real receipts |
| T-90, T-91, T-97 | `open` | `pincer-ticket: T-90 depends on T-89, which is 'open'` — the gate refuses to close them |
| T-92 | `open` | depends on T-90 and T-91 |
| T-89, T-93, T-95 | `open` | their live observations have not run |
| T-96 | `open` | depends on T-95 |

**The dependency gate is right and was not worked around.** T-90 and T-91's
implementations are complete and their checks pass, but PRD v7's build order says the
baseline observations come before the optimizations, and T-89 has not produced them.
Editing `depends_on` to close the tickets would have been the one move that turns this
packet into a false record, so the tickets stay open and say why. The workflow refusing
to mark its own work done is the same refusal it exists to give a user.

## 7. Limitations

- **The friction record is operator-driven.** It measures commands, bytes and authored
  lines. It cannot show whether an agent understands the instructions, where it goes
  wrong, or what a human spends reviewing the result. It is the design basis S-09 asks
  for and is not the pilots S-07 and S-08 ask for.
- **Fewer bytes is not less effort.** The brief's 52–90% reduction is output size, not
  measured human or agent effort. The paired comparison that would measure effort is
  T-95 and has not run.
- **Three benchmark faults are not separable** from adjacent checks; the suite asserts
  the intended evaluator is among the failures rather than alone.
- **The browser evaluation is a seam, not a browser.** A deterministic fake adapter
  proves that markup checks pass where observation fails, that a missing adapter yields
  `unverified`/`unavailable`, and that a throwing adapter yields `error`.
- **No live session of any kind was run** for this increment, and no model was invoked
  by any test. `npm test` is offline by construction.
- **The support matrix claims nothing observed.** Every row is `unobserved` or
  `installed`.
- **Remote publication state is unverified.** The reconciliation speaks only about this
  checkout; whether the remote carries the v6 evaluation, bump and tag was not checked
  against the server.

## 8. Evaluation boundary

Authored documentation and metadata are finished before any candidate is selected.
**No candidate has been selected and no evaluation exists**; this packet is review
material, not evidence, and it creates no approval provenance. Subsequent changes
retain normal stale-evidence behaviour. Evaluation, merge, version bump and publication
are separate actions with their own gates, and none of them has been performed.

The repository remains in legacy management mode. These tickets were managed with an
independently pinned released 0.6.0 kit outside the working tree
(digest `cc8c11e0584bec979fe22069700eeada3681b75919f95f2dc8ba9529da055410`, from tag
`v0.6.0` → commit `694241c`), never with the runtime code under modification.
