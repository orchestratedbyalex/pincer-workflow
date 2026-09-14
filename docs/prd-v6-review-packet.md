# PRD v6 review packet — complete requirement coverage and change impact

What a reviewer needs to check this work without reading the whole branch: where the
implementation is, which requirement and scenario each part answers, what was actually
run, which artifacts show the behaviour, what deviates from the PRD, how to reproduce
the interesting failures independently, and what is still open. Everything here is
either a pointer into the repository or a statement about what was observed. Reviewer
judgment is marked as such and is never presented as a mechanical result.

This packet assembles the review material. It does not evaluate, merge, version, or
publish; those are separate stages with their own gates.

## 1. Implementation reference

Branch: `feat/prd-v6`, base `07b2210` (the PRD and ticket map, before any implementation).
One commit per ticket, in build order:

| Ticket | Commit | What it added |
| --- | --- | --- |
| T-66 | `98235f6` | contract freeze: the v6 grammar, schemas, reason codes and phase rules in `template/docs/runtime-contracts.md`, pinned by `test/coverage-contracts.test.js` |
| T-67 | `f65ee72` | `requirements.cjs`: the PRD inventory parser, snapshots and difference |
| T-68 | `3b18458` | `coverage.cjs`: the authored map, its validation, declaration digests and the resolved graph |
| T-69 | `ad9921f` | `adopt.cjs` and the strict agreement: schema 3 records, projection 2, snapshot schema 2, backups |
| T-70 | `df312e0` | `phases.cjs`: structural, implementation and candidate coverage; the strict completion gate |
| T-71 | `dedc786` | `impact.cjs`: structural difference against the authorized baseline |
| T-72 | `eafeac6` | strict `check C-NN`: the declaration is the only source, revalidated under the attempt lock |
| T-73 | `42860e0` | evidence schema 3: derived scenario and requirement rows, snapshots, delivery, adequacy, reconciliation |
| T-74 | `3b37ae1` | `coverage` and `impact` commands, status schema 3 and resume schema 2 summaries |
| T-75 | `417a28e` | playbooks, PRD template, `AGENTS.md`, hook policy, checklists, generated adapters and plugin, packed parity |
| T-76 | `3ecb531` | the delivery benchmark: six frozen briefs, held-out evaluators, harness, protocol, fault suite |
| T-77 | `aed95af` | 36 paired live runs, the trial record and its validator |

T-78 (this packet, the replay cases and the CI matrix) is the last ticket; its own commit
follows this file.

Candidate commit: not chosen by this packet. Selecting the evaluation candidate, running
`/pincer-evaluate` against it and writing `NOTES.md` are the next stage's work.

PRD revisions during implementation: none. The only change to `.prd/prd-v6.md` since
`07b2210` is the `status: ticketed → built` line that closing the PRD writes; no
requirement or scenario was added, removed or reworded. `git diff 07b2210..HEAD --
.prd/prd-v6.md` shows that one line, and this packet's own test checks it.

Scope changes during implementation: none. Nothing was cut, and no requirement was
deferred or removed; the Out of Scope section of the PRD is unchanged.

## 2. Traceability

One row per requirement, then one row per scenario. `delivered` means the behaviour
exists on this branch and is exercised by the named evidence. Adequacy of a test — whether
it really establishes its scenario — is reviewer judgment, not a mechanical result; the
`coverage` command reports structure, never meaning.

| Requirement | Title | Tickets | Primary evidence | Disposition |
| --- | --- | --- | --- | --- |
| R-01 | Derive the complete authored inventory | T-66, T-67 | `test/coverage-inventory.test.js`, `test/coverage-contracts.test.js` | delivered |
| R-02 | Validate one explicit coverage map | T-68 | `test/coverage-map.test.js` | delivered |
| R-03 | Bind coverage and scope dispositions to authorization | T-69 | `test/coverage-agreement.test.js`, `test/coverage-adoption.test.js` | delivered |
| R-04 | Report structural impact without inventing semantics | T-71 | `test/coverage-impact.test.js` | delivered |
| R-05 | Derive phase-appropriate coverage | T-70 | `test/coverage-readiness.test.js` | delivered |
| R-06 | Enforce the declared candidate verification contract | T-72 | `test/coverage-checks.test.js` | delivered |
| R-07 | Reconcile complete candidate evidence at export and release | T-73 | `test/coverage-evidence.test.js` | delivered |
| R-08 | Adopt and ship without silently changing old projects | T-69, T-75 | `test/coverage-adoption.test.js`, `test/coverage-distribution.test.js` | delivered |
| R-09 | Make coverage and impact useful in normal sessions | T-74, T-75, T-77 | `test/coverage-reports.test.js`, `docs/trial-prd-v6.md` | delivered |
| R-10 | Establish an independent, reproducible delivery benchmark | T-76, T-77 | `test/delivery-benchmark.test.js`, `docs/trial-prd-v6.md` | delivered |

| Scenario | Where it is exercised | Disposition |
| --- | --- | --- |
| S-01 inventory parsed exactly | `test/coverage-inventory.test.js` S-01, `test/fixtures/prd-v6/strict/` | delivered |
| S-02 malformed inventory diagnosed | `test/coverage-inventory.test.js` S-02, `test/fixtures/prd-v6/invalid/prd/` | delivered |
| S-03 identity survives lifecycle edits | `test/coverage-inventory.test.js` S-03, `test/coverage-agreement.test.js` S-03 | delivered |
| S-04 invented or missing links refused | `test/coverage-map.test.js` S-04 | delivered |
| S-05 shared checks and enabling tickets | `test/coverage-map.test.js` S-05 | delivered |
| S-06 malformed map refused | `test/coverage-map.test.js` S-06, `test/fixtures/prd-v6/invalid/coverage/` | delivered |
| S-07 edits invalidate authorization | `test/coverage-agreement.test.js` S-07 | delivered |
| S-08 dispositions need a decision | `test/coverage-map.test.js` S-08, `test/coverage-agreement.test.js` S-08 | delivered |
| S-09 deletion detected from the baseline | `test/coverage-agreement.test.js` S-09, `test/coverage-evidence.test.js` S-09 | delivered |
| S-10 impact names the affected rows | `test/coverage-impact.test.js` S-10 | delivered |
| S-11 impact distinguishes kinds of edit | `test/coverage-impact.test.js` S-11 | delivered |
| S-12 paused change keeps its authorization | `test/coverage-impact.test.js` S-12 | delivered |
| S-13 unfinished work is not covered | `test/coverage-readiness.test.js` S-13 | delivered |
| S-14 completion before candidate selection | `test/coverage-readiness.test.js` S-14 | delivered |
| S-15 structure is not delivery | `test/coverage-readiness.test.js` S-15, `test/coverage-contracts.test.js` S-15 | delivered |
| S-16 a substituted declaration is refused | `test/coverage-checks.test.js` S-16, `docs/prd-v6-artifacts/replay.sh substituted` | delivered |
| S-17 gates revalidated under the lock | `test/coverage-checks.test.js` S-17, `docs/prd-v6-artifacts/replay.sh race` | delivered |
| S-18 review obligations need artifacts | `test/coverage-checks.test.js` S-18 | delivered |
| S-19 manifest rows reconciled | `test/coverage-evidence.test.js` S-19 | delivered |
| S-20 two changes on one candidate | `test/coverage-evidence.test.js` S-20 | delivered |
| S-21 a fresh clone states its limits | `test/coverage-evidence.test.js` S-21, `docs/prd-v6-artifacts/replay.sh clone` | delivered |
| S-22 nothing changes without adoption | `test/coverage-adoption.test.js` S-22, `docs/prd-v6-artifacts/replay.sh rollback` | delivered |
| S-23 adoption survives interruption | `test/coverage-adoption.test.js` S-23 | delivered |
| S-24 packed layouts and old runtimes | `test/coverage-distribution.test.js` S-24 | delivered |
| S-25 human and JSON agree | `test/coverage-reports.test.js` S-25 | delivered |
| S-26 a small fix uses the same safeguards | `test/coverage-reports.test.js` S-26, `test/coverage-contracts.test.js` S-26 | delivered |
| S-27 changed scope before approval | `docs/trial-prd-v6.md` (6 live runs), `test/coverage-trial-record.test.js` S-27, `test/coverage-contracts.test.js` S-27 | delivered |
| S-28 the benchmark rejects faulty candidates | `test/delivery-benchmark.test.js` S-28 | delivered |
| S-29 36 matched paired runs | `docs/trial-prd-v6.md`, `test/coverage-trial-record.test.js` S-29 | delivered |
| S-30 the local review artifact | `docs/prd-v6-artifacts/benchmark/report.md`, `test/coverage-trial-record.test.js` S-30 | delivered |

## 3. Contracts

`template/docs/runtime-contracts.md` is the contract; `test/coverage-contracts.test.js`
pins its statements against the implementation, so a contract edit without a code change
(or the reverse) fails. Schema versions introduced or raised by v6:

| Artifact | Version | Notes |
| --- | --- | --- |
| coverage map `.prd/coverage/<id>.json` | schema 1 | new; the one authored source of links, dispositions and declarations |
| change record `.prd/changes/<id>.json` | schema 3 | adds `coverage`, one `adopt` event, `runtime: 3`; schema 2 records keep working untouched |
| agreement projection | version 2 | adds the `inventory` and `coverage` lines |
| agreement snapshot | schema 2 | adds the normalized inventory and map |
| attempt record | schema 3 | adds `context.inventory`, `context.coverage` and the check declaration digest |
| evidence manifest | schema 3 | adds `coverage`, `scenarios`, `adequacy`, `delivery` and `declared` per check |
| status JSON | schema 3 | adds the `coverage` summary |
| resume JSON | schema 2 | adds the `coverage` summary |
| `coverage --json` | schema 1 | new read-only report |
| `impact --json` | schema 1 | new read-only report |

Old runtimes reject the new records rather than misreading them: the v0.5.0 validator
refuses evidence schema 3 with `unknown evidence schema 3 — this runtime validates
schemas 1 and 2`, and a v0.5.0 runtime refuses a schema 3 change record as an unsupported
schema (`test/coverage-distribution.test.js`, `test/coverage-evidence.test.js`).

## 4. Verification record

Run on the tree that carries this packet, macOS 26.6.2, Node v22.23.1. The exact
commands and their results are below; nothing here is inferred from an earlier candidate.

| Gate | Command | Result |
| --- | --- | --- |
| full local suite | `npm test` (51 suites) | passed — all 51 suites on macOS 26.6.2 with Node v22.23.1, about ten minutes end to end (`delivery-benchmark` and this packet's own replay run dominate) |
| adapter generator | `bash template/scripts/sync-prompts.sh && git diff --exit-code template/.agents template/.github` | passed — `sync-prompts.sh` regenerates `template/.agents` and `template/.github` with no diff |
| plugin generator | `bash scripts/build-plugin.sh && git diff --exit-code plugin` | passed — `build-plugin.sh` regenerates `plugin/` with no diff |
| packed parity | `test/coverage-distribution.test.js` (npm pack, install into every supported layout, compare runtime behaviour) | passed in 34 s — every supported layout and the plugin carry identical runtime behaviour, and old runtimes reject the new records |
| independent replay | `bash docs/prd-v6-artifacts/replay.sh all` | passed in 20 s — all eight cases (`ok all (8 cases)`) |
| benchmark freeze | `node scripts/delivery-benchmark/benchmark.cjs check-freeze` | passed — briefs, evaluators, harness and protocol match the freeze of 2026-09-12 |
| CI matrix | GitHub Actions `.github/workflows/ci.yml`: {ubuntu-latest, macos-latest} × Node {22, 24} | **ran on 2026-09-13**, after this packet was written. The first run on the pushed branch failed all four cells of the then-current {18, 22} matrix: three on the shallow default checkout, where `git cat-file -e` exits 128 and this packet's own commit citations cannot resolve (fixed by `fetch-depth: 0`), and macOS × Node 18 on `coverage-agreement` reading a truncated `change show --json` (`SyntaxError: Unexpected end of JSON input`). That truncation was then diagnosed as a Node 18/20 defect and the floor raised to `engines: >=22` with the matrix {22, 24}; the evaluation of the combined candidate found that diagnosis wrong. The defect is the runtime writing to stdout asynchronously and then calling `process.exit()`, it reproduces on 22 and 24 alike at 65,537 bytes, and it is fixed in T-79. The floor and the matrix stay, justified by end of life. Still outstanding for whatever candidate is finally evaluated; do not treat it as green until it passes there. |

The 13 suites added by v6 are `coverage-inventory`, `coverage-map`, `coverage-agreement`,
`coverage-adoption`, `coverage-readiness`, `coverage-impact`, `coverage-checks`,
`coverage-evidence`, `coverage-reports`, `coverage-contracts`, `coverage-distribution`,
`delivery-benchmark` and `coverage-trial-record`; the 36 PRD v5 suites and the earlier
regression suites all still run in the same `npm test` chain.

## 5. Representative artifacts

Generated by driving one scratch project through the whole strict flow (register, adopt,
authorize, activate, build, complete, check, export, evaluate-commit) and copied into
`docs/prd-v6-artifacts/records/` with its absolute path replaced. They are examples of
shape, not evidence about this repository, which stays in legacy management mode.

| File | Shows |
| --- | --- |
| `coverage-map.json` | the one authored map: scenario links, ticket roles, a command check and a review obligation |
| `adopt-preview.txt` | `coverage adopt --preview`: the plan, writing nothing |
| `change-record-schema3.json` | the adopted record: `coverage {map, adopted, agreement}`, the `adopt` event, `runtime: 3` |
| `agreement-snapshot-schema2.json` | the retained snapshot: normalized inventory and map behind the authorized digest |
| `coverage-in-progress.json` | structure complete, implementation incomplete, candidate not evaluated |
| `coverage-complete.json`, `coverage-human.txt` | the same change after evaluation: 3/3 scenarios, delivery original and agreed true, adequacy adequate, no blockers |
| `evidence-export.txt`, `evidence-manifest-schema3.json` | the export and the schema 3 manifest: derived scenario and requirement rows, `declared` digests per check, `provenance: runtime` for the command check and `authored` for the review, the inventory and map snapshots as listed artifacts |
| `impact-after-revision.json`, `impact-human.txt` | one scenario added to the PRD: verdict `changed`, `S-04` added, `R-02` changed, the unchanged rows kept, and the honest note that prose outside the definitions is not analysed |
| `resume-complete.json` | the resume report with its coverage summary |

## 6. Adoption, rollback and old projects

Adoption is explicit and per change. `coverage adopt --preview` writes nothing.
`coverage adopt --apply` is one transaction: a backup under `.pincer/backups/<stamp>/`,
the schema 3 record and the adoption snapshot; it grants no authorization, and the
strict agreement it creates must be authorized by the user before anything runs.
Rolling back is a literal restore of the backed-up record; it deletes no authored file,
and the authored map stays on disk. `docs/prd-v6-artifacts/replay.sh rollback` walks
exactly that, and `test/coverage-adoption.test.js` covers the interrupted and concurrent
cases. A project that never adopts sees no behaviour change: its records stay schema 2,
its evidence stays schema 2, and `coverage` reports the label `unverified` with the
reason "strict coverage not adopted".

## 7. Live trial summary

`docs/trial-prd-v6.md` records 36 paired live runs (six briefs × three pairs × two arms)
on Claude Code 2.1.267 print mode with `sonnet`, judged by the frozen held-out evaluators.
Independent acceptance was 17/18 for each arm with zero escaped regressions; the kit arm
cost about 4.7 times as much money and 3.9 times as much session time. The one measured
behavioural difference is the changed-scope check (S-27): the kit arm surfaced the
revision and recorded no authorization in 3 of 3 runs, the plain arm in 2 of 3. **No
parity or superiority claim is made or supported by that data**, and at three pairs per
cell a one-run difference is not an effect.

Two honest limits on what the trial covers. First, no live run adopted strict coverage:
the briefs are single-change tasks and adoption is opt-in, so the live runs exercised the
v6 runtime in its v5-compatible mode. The strict path is covered by the suites and by the
replay cases in section 9, not by a live session. Second, six runs were destroyed by an
account usage limit; they are kept, marked invalid with that reason, and rerun.

## 8. Deviations and clarifications

1. **Evidence binding in the benchmark evaluator** (during T-77, harness re-frozen once).
   The `evidence-binding` check originally rejected any evidence naming a commit other
   than the evaluated one, which rejected PINCER's own convention of an evaluation commit
   whose `NOTES.md` names the implementation commit it evaluated. The corrected check
   accepts that only when the named commit is an ancestor whose diff to the candidate
   touches nothing but `NOTES.md` and `.prd/evidence/`. No evaluator digest changed, the
   previous freeze is kept in `frozen.json`'s history, and every earlier run was
   re-evaluated with unchanged outcomes except the one the correction fixed.
2. **Usage-limit handling** (during T-77). The driver now marks a run invalid and stops
   when a session fails on an account limit, instead of letting the limit turn the rest of
   the schedule into one-turn failures. The six affected runs are retained and rerun at
   pair numbers above the schedule.
3. **Command spelling.** The PRD proposed `coverage`, `impact`, `coverage adopt` and
   strict `check C-NN --candidate <sha>`; all four shipped with those spellings. A
   supplied command or timeout on a strict check is `CHECK_UNDECLARED` and exits 4
   (invalid input), not 1; the contract and the tests state the code.
4. **This repository is not migrated.** PRD v6 was built with the distribution repo in
   legacy management mode, driven by an independent pinned v0.5.0 kit, as the PRD
   requires. Nothing here adopts strict coverage for `pincer-workflow` itself.

## 9. Independent replay

`bash docs/prd-v6-artifacts/replay.sh all` builds a fresh strict-coverage project from
this repository's `template/` for each case, drives the runtime with the commands a
session would run, and asserts the observable outcome. Most cases inject one fault and
exercise the correct path beside it, so a case that passes for the wrong reason is
visible; the control column says for each case what that comparison is, and names the
cases that have none.
Nothing outside the scratch directory is written; it takes about twenty seconds.

| Case | Injected fault | Expected refusal | Working control in the same case |
| --- | --- | --- | --- |
| `omitted` | a scenario of the inventory has no map entry | `COVERAGE_INCOMPLETE` naming S-02; `change complete` refuses (after the authorization gate fires first) | restoring the link completes the structure with no other edit |
| `revision` | a scenario appended to the PRD after authorization | `AGREEMENT_CHANGED`; `start` refuses; the new scenario is an open obligation | `impact` names S-04 added, R-02 changed, the three unchanged scenarios and the baseline G-01/A-01 |
| `removal` | a scenario removed with an unknown, then an unauthorized, decision | the unknown decision is refused; a resolved decision alone is `SCOPE_UNAUTHORIZED`; a generic "continue and finish it" is still `SCOPE_UNAUTHORIZED` | an authorization naming D-01 accepts the removal and reports S-03 as `removed` |
| `substituted` | a command supplied on the command line, a review obligation run as a command, an unknown check id, then the map's command swapped | three `CHECK_UNDECLARED` refusals (exit 4); the swapped declaration cannot run under the old authorization (`AGREEMENT_CHANGED`) | the declared command runs and the attempt records its declaration digest and the command it ran |
| `race` | `change pause` committed between the pre-launch guard and the attempt lock | the attempt is refused with a gate code and no attempt is recorded | none — the case runs one raced verify and no unraced one. What it establishes is that the refusal carries a gate code and records no attempt, not which gate refused. Removing the under-lock revalidation does fail it. |
| `shared` | a second change registered beside the strict one | both records keep their own identity and schema (3 for the adopted change, 2 for the new one) | neither registration disturbs the other |
| `rollback` | the adopted record restored from its backup | coverage falls back to the label `unverified` | the backup holds the schema 2 original, and the authored map is not deleted |
| `clone` | a fresh clone with no local attempt history | `local_attempts: unavailable`, no attempts present | strict coverage survives the clone and the report still names a next action |

## 10. Known limitations

- Structural linkage cannot tell whether a check is meaningful. `coverage` reports
  structure; adequacy is a reviewer judgment recorded in the evidence and repeated in
  `coverage-human.txt` as the reviewer's words, not as a computed verdict.
- The inventory is parsed from one Markdown grammar. Requirements written any other way
  are invisible to it, by design: mentions in prose, tables and fenced examples define
  nothing. A PRD that does not use the grammar simply has no inventory.
- `impact` compares definitions and links. It says so explicitly when a PRD revision
  touched prose outside the definitions, and it does not analyse that prose.
- Local records establish provenance, not authenticated identity. An authorization
  records the user's words as the session saw them; nothing here proves who typed them.
- The delivery benchmark is six briefs, three pairs per arm, one model, one tool, one
  operating system, one day. Its evaluators were written by this project before the runs
  and held out of the workspace, which is process separation rather than a defence
  against an adversarial agent with access to this repository.
- The CI matrix ran after this packet was written; section 8 records what it found. It is
  still outstanding for whatever candidate is finally evaluated, and that gate must pass
  before anyone claims the branch is green. Node 18 and 20 are out of support (`engines: >=22`)
  because both are past end of life. The piped-output truncation first seen on Node 18 is
  not version-specific — it reproduces on 22 and 24 at 65,537 bytes — and is fixed in T-79,
  not by the floor.
- `test/delivery-benchmark.test.js` spawns many processes and runs `npm test` inside
  generated candidate projects. It is the slowest suite in the chain and it needs `git`
  and `npm` on PATH.

## 11. What this packet does not do

It does not choose an evaluation candidate, run `/pincer-evaluate`, write `NOTES.md`,
merge, bump the version or publish. It records what exists, what ran, what deviated and
what is open, so that the evaluation stage starts from facts rather than from memory.
