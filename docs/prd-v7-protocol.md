# PRD v7 improvement protocol — frozen 2026-09-14

Protocol version **v7.1**. This document is the frozen design of the v7 measurement
work and the frozen interface contract of the two additive product surfaces. It is
written *before* the first observed run, as [PRD v7](../.prd/prd-v7.md) R-01 requires.
Nothing here records an approval, a spending authorization, a passing check or a live
observation. Where a decision is still outstanding it is named as outstanding.

The v6 protocol ([delivery-benchmark.md](delivery-benchmark.md), frozen
`test/fixtures/delivery-benchmark/frozen.json`) and the v6 study records are
unchanged by this document and by every v7 artifact. V7 is a **new edition with its
own cohort identity**. Fixing v6 methodology means running a new study, never
rewriting the old result.

## 1. Baseline identity

| Item | Value |
| --- | --- |
| Repository | `pincer-workflow`, branch `main` |
| Baseline commit | `715853d` (merge of PR #2), package `0.6.0` |
| Released kit under test (baseline arm) | tag `v0.6.0` → commit `694241c` |
| Pinned management kit | the same tag, extracted outside the working tree |
| Management-kit digest | `cc8c11e0584bec979fe22069700eeada3681b75919f95f2dc8ba9529da055410` |
| Node / OS of the authoring host | v22.23.1 / macOS 26.6.2 (darwin 25.6.0) |

The management-kit digest is `sha256` over the sorted `sha256` of every extracted
file (`find . -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256`). The
distribution repository stays in **legacy management mode** for this PRD, as it did
for v5 and v6: its own tickets are managed with that independently pinned released
kit, never with the runtime code under modification.

## 2. Handover reconciliation (S-03)

The wiki briefing written at the end of the v6 session stated that the evaluation
commit, the version bump and the tag were local-only and that "nothing since the
merge is pushed". **That is no longer true of this checkout**, and the claim is
corrected here rather than repeated.

| Claim in the earlier handover | State in this checkout | How it was checked |
| --- | --- | --- |
| The evaluation commit `350823e` is local-only | present and an ancestor of `HEAD` | `git merge-base --is-ancestor 350823e HEAD` → true |
| The version bump `566b553` is local-only | present and an ancestor of `HEAD` | `git merge-base --is-ancestor 566b553 HEAD` → true |
| `main`'s `package.json` says 0.5.0 | says `0.6.0` | `package.json` |
| `main` carries PRD v4's `NOTES.md` | carries the v5+v6 evaluation | `NOTES.md` frontmatter names `.prd/prd-v6.md`, candidate `ce98abd` |
| The v6 evidence directory is local-only | present | `.prd/evidence/prd-v6/ce98abd…/` with `manifest.json`, 10 check logs, 2 review artifacts |
| The tag `v0.6.0` is unpushed | exists locally on `694241c` | `git rev-parse v0.6.0` |

**Remote state is not asserted.** The local `origin/main` ref points at the same
commit as `HEAD`, but a local remote-tracking ref records the last fetch, not the
current server state. This protocol therefore says only: *the local checkout contains
the evaluation, the bump and the tag*. Whether the remote carries them, and whether
the tag is pushed, is unverified here and must be checked against the server before
any statement about publication is made.

Historical evidence is not current readiness. The `ce98abd` manifest validates its own
historical candidate. It says nothing about `715853d` or about any v7 candidate, and
`status` reporting `stale: candidate changed after evaluation` on this tree is the
correct answer, not a defect to be tuned away.

### v6 preservation

Every v6 study artifact is retained byte-for-byte. The frozen set is:

- `test/fixtures/delivery-benchmark/**` (briefs, evaluators, `frozen.json`)
- `scripts/delivery-benchmark/*.cjs` (the v6 driver, record schema 1, reporter)
- `docs/delivery-benchmark.md`, `docs/trial-prd-v6.md`
- `docs/prd-v6-artifacts/**`, `docs/prd-v6-review-packet.md`
- `.prd/prd-v6.md`, `.prd/evidence/prd-v6/**`, `NOTES.md`

`test/improvement-contracts.test.js` asserts the digest of this set against the values
recorded in `docs/prd-v7-artifacts/v6-preservation.json`, so a v7 change that edits a
v6 record fails a check rather than passing silently.

## 3. Cohort identity and execution freeze

A **cohort** is the set of runs sharing one frozen execution path. Its identity is
`sha256` over, in this order:

1. the protocol digest — this file;
2. the harness digest — the named benchmark execution path (`briefs.cjs`, `schedule.cjs`, `harness.cjs`, `evaluator-kit.cjs` under `scripts/delivery-benchmark-v7/`), not every file that shares the directory;
3. the brief digests — every file under `test/fixtures/delivery-benchmark-v7/briefs/<id>/`;
4. the evaluator digests — the `evaluator/` subtree of each brief, recorded separately;
5. the effort-collector digest;
6. the live-driver digest;
7. the cap settings;
8. the configuration fingerprint (section 7).

Changing **any** of these starts a new cohort with a new identity. Records already
written keep their old cohort ID and are never re-evaluated under the new one. There
is no re-freeze-and-re-evaluate path in v7; that is the specific v6 deviation this
edition removes.

## 4. Cohorts, arms and the 72-run schedule

Three arms:

| Arm | Workspace |
| --- | --- |
| `plain` | no kit installed, no workflow instructions |
| `pincer` | kit installed, strict coverage **not** adopted (the v6 default path) |
| `strict` | kit installed, strict coverage adopted and the adoption **observed** in the record |

Eight briefs: the six bounded v6 task types, reused verbatim in intent, plus two new
long-form briefs, each at least three sessions across at least two changes:

| Brief | Type | Sessions |
| --- | --- | --- |
| `cli-greenfield` | new CLI feature | 1 |
| `bugfix-brownfield` | bugfix in existing code | 1 |
| `integration-untested` | change to an untested integration | 1 |
| `ui-states` | UI feature with error/accessibility states | 1 |
| `scope-revision` | mid-build requirement change | 1 |
| `handoff-two-changes` | two-change resume | 2 |
| `revision-recovery` | **new** — revision plus interruption and recovery | 3 |
| `brownfield-maintenance` | **new** — maintenance and review on existing code | 3 |

Schedule: 8 briefs × 3 arms × 3 matched repetitions = **72 runs**. Arm order is
balanced so that each brief starts with each arm across the three repetitions and the
overall count of first positions is equal per arm. Within a repetition, the three arms
of one brief receive identical task intent, base repository, model, tool versions and
caps.

**A `strict` run that did not actually adopt strict coverage is a protocol failure,
not evidence about strict Pincer.** Adoption is verified from the run's own workspace
(a schema 3 change record with a `coverage` object and an `adopt` event), not from the
agent's narration.

### Validity, exclusion and partial work

| Status | Meaning |
| --- | --- |
| `pending` | scheduled, not yet run |
| `valid` | ran under the frozen path and produced a judged result |
| `invalid` | ran but violated the protocol; reason mandatory; retained on disk |
| `unavailable` | could not run (missing tool, account, browser); reason mandatory |
| `outstanding` | required but not yet run; keeps its requirement unfinished |

A session that hits a cap is **ended and judged on whatever it committed**, provided a
usable candidate exists; the cap is recorded as an `operator` intervention. This is the
predeclared rule and it applies identically in all three arms. A run that produced no
usable candidate is `invalid` with its reason. Reruns take repetition numbers above the
scheduled three and carry a note naming the run they replace; the original is retained.

Missing required runs keep R-09 unfinished. They are never replaced by synthetic
records, and an aggregate is never reported over a denominator that hides them.

## 5. Metrics

Every metric is either measured, or `null` with a reason. **`null` is never rendered
as zero.** The v6 study recorded setup time as zero for automated preparation and did
not measure review time at all; v7 records both explicitly or records why not.

| Metric | Definition |
| --- | --- |
| `setup_minutes` | preparing the workspace and installing the kit, before the first task prompt |
| `authoring_minutes` | producing PRD, tickets and coverage map |
| `verification_minutes` | running checks and repairing failures |
| `recovery_minutes` | pause, fresh-session resume and re-orientation |
| `review_minutes` | human review of the candidate, timed separately (section 6) |
| `active_minutes` | summed session wall-clock, overlapping intervals merged once |
| `elapsed_minutes` | first session start to last session end |
| `provider_minutes` | provider-reported duration, kept separate from both above |
| `tokens`, `cost_usd` | provider-reported; `null` with a reason when unavailable |
| `commands` | runtime commands executed, counted from the transcript |
| `context_reads` | file reads performed to re-establish context |
| `repeated_approvals` | authorization requests for scope already authorized |
| `interventions` | `clarification`, `reapproval`, `repair`, `operator` |

`active_minutes` is recomputed from raw interval events; two sessions overlapping in
wall-clock time contribute their union, never their sum. Totals in every report
recompute from the raw event log with no model call.

## 6. Human review

At least **two reviewers who did not implement the candidate**, blinded to arm where
the artifacts make blinding feasible. Recorded per review: reviewer pseudonym, task,
arm (revealed after), order position, prior exposure to the task, minutes elapsed,
accept/reject decision, readiness judgment, faults found, faults missed against the
held-out evaluator, and self-reported confidence.

Frozen rubric, applied in this order:

1. Does the candidate do what the brief asked?
2. Is there evidence it was verified, and does that evidence bind to this candidate?
3. What would you still need before releasing it?
4. Confidence, 1–5.

Missing review time is `null` with a reason. **An automated record check never stands
in for a review.** Reviewers are an outstanding prerequisite (section 9).

## 7. Configuration isolation and redaction

Captured per run, by allowlist only:

`model`, `tool`, `tool_version`, `node_version`, `os`, `platform_release`, `cwd_kind`
(`scratch` / `workspace`), `permission_mode`, `max_turns`, `wall_clock_minutes`,
`kit_digest`, `base_commit`, `prompt_digest`, `driver_digest`, `collector_digest`,
`evaluator_digest`, and the **names** of any environment variables the driver sets.

Never captured: environment dumps, credential values, secret-value hashes, home
directory paths, hostnames, or private project content. A secret-shaped value found in
a captured field is a validation failure, not something to redact and continue from.
Raw private capture (full transcripts) stays outside the tracked tree; the tracked
artifacts carry sanitized records only.

## 8. Product interface freeze

The two additive surfaces are frozen here before implementation. Both are **read-only**:
they write no file, launch no check, change no selection, and record no approval.

### 8.1 `coverage scaffold --change <id> [--json]`

A **draft projection** of the validated PRD inventory, the change's tickets and any
authored map. It is not a coverage map and cannot become one by being saved.

```
node scripts/pincer-runtime.cjs coverage scaffold --change <id> [--json]
```

- `--change <id>` is required. No positional arguments. Unknown flags are a usage error.
- Output goes to stdout through `io.cjs`.
- Exit `0` when a draft was produced (complete or not); `4` when the inputs cannot be
  read or validated (`INPUT_INVALID`, `INVENTORY_INVALID`, `COVERAGE_INVALID`,
  `UNSUPPORTED_SCHEMA`, `MALFORMED`); `1` for a refusal that is not an input error.

Draft envelope — **`draft: 1` and no `schema` key**, so `coverage.validateMap` rejects
it outright:

```
{ draft: 1, kind: "coverage-draft", change, prd,
  inventory: { digest, requirements: <n>, scenarios: <n> },
  authored: { map: <path> | null, digest: <hex> | null },
  scenarios: { "S-NN": { requirement, state, tickets: [], checks: [] } },
  scope:     { "S-NN": { disposition, decision, prior, note, state } },
  tickets:   { "T-NN": { role, rationale, state } },
  checks:    { "C-NN": { kind, required, command, timeout, cwd, obligation, note, state } },
  candidates: { tickets: { "T-NN": { file, objective, implements: [], verification } } },
  unresolved: [ { code, id, detail } ],
  next: { action, command } }
```

`state` is `"authored"` for content read from the existing map and `"unresolved"` for
an entry the draft could not resolve. **The draft never invents a link, a check
command, a ticket role or a scope disposition.** Candidate tickets and their existing
verification text are listed under `candidates` with their file provenance, as material
for a human or agent to read — never promoted into `scenarios` or `checks`.

Every live inventory scenario appears exactly once across `scenarios` and `scope`.
The draft body contains **no timestamp**, so two calls on identical authored inputs
produce byte-identical output.

Unresolved codes: `SCENARIO_UNLINKED`, `CHECK_UNDECLARED`, `TICKET_UNCLASSIFIED`,
`SCENARIO_STALE` (a map row with no live scenario), `TICKET_FOREIGN` (a ticket of
another PRD).

The route to a real map is unchanged: a human or agent authors
`.prd/coverage/<id>.json`, `coverage` validates it, `coverage adopt --preview/--apply`
adopts it, and `change authorize` records the user's instruction covering the new
agreement. Editing the inputs after adoption still yields `AGREEMENT_CHANGED`.

### 8.2 `resume --brief [--change <id>] [--json]`

A **pure projection** of the report `resume.build()` already computes. No second policy
engine, no independent readiness cache, no truncation that can hide a blocker.

```
node scripts/pincer-runtime.cjs resume --brief [--change <id>] [--json]
```

- `--brief` is a switch; it composes with the existing `--change` and `--json`.
- Default `resume` output and the resume JSON schema 2 contract are **unchanged**.
- Exit code is the exit code the full report would have produced, unchanged.

Brief JSON envelope — a distinct `kind`, carrying the same verdicts:

```
{ brief: 1, kind: "resume-brief", of: 2, generated, root, mode,
  change: { id, prd, base, lifecycle } | null,
  selection: { change, problem } | null,
  agreement: { current, verdict, authorized: { id, disposition } | null },
  coverage: { label, strict, structure, implementation } | null,
  tickets: { total, by_status: { open, in_progress, done }, not_ready: <n> },
  attempts: { total, running: <n>, current_failed: <n> },
  candidate: { notes, candidate, evidence } | null,
  blockers: { total, categories: [ { code, count } ] },
  next: <the full report's next, verbatim>,
  detail: { command, prd, tickets: [ paths ], omitted: <n> } }
```

Invariants, each with its own test:

- `next` is the full report's `next` object, **copied**, never recomputed.
- Every distinct blocker `code` in the full report appears in `blockers.categories`
  with its exact count. Grouping collapses repetition, never a category.
- `tickets.total` and `attempts.total` equal the full report's array lengths, and
  `detail.omitted` states how many rows the brief did not print.
- `detail.command` is the exact command that prints the omitted rows.
- On a large change, brief human output is **fewer bytes** than the full report.
- Reports change no files: a whole-tree snapshot before and after is identical.

## 9. Execution prerequisites — outstanding

These are unsettled and block the live tickets. They do not block the protocol,
tooling or product tickets.

| Prerequisite | State | Needed by |
| --- | --- | --- |
| Three pilot projects (1 greenfield, 2 brownfield with real intended work, one with pre-existing user edits) | **outstanding** — not selected | T-89 |
| Project access decision for the two brownfield projects | **outstanding** | T-89 |
| Spending cap for live sessions | **outstanding** — no budget supplied | T-89, T-93, T-95 |
| Wall-clock cap | **outstanding** | T-89, T-93, T-95 |
| Two non-implementing reviewers | **outstanding** — none identified | T-95 |
| Codex CLI availability and version | **outstanding** — to be verified at execution | T-93 |
| Browser tooling for UI evaluation | **outstanding** — absence is `unavailable`, never acceptance | T-94, T-95 |

The 72-run schedule is substantive spending and **must be costed before execution**.
At the v6 recorded rate (36 runs, $52.54 total across both arms) a 72-run three-arm
schedule with two additional three-session briefs is materially larger, and the two
long briefs cost more per run than the six short ones. A smaller study requires an
explicit recorded scope revision; it is not something the implementing agent may
decide by running fewer cells.

## 10. What this protocol does not establish

- It does not predict, promise or require a favourable result. A valid negative
  comparison satisfies the measurement requirement and refutes the performance claim.
- Three repetitions per cell detect gross friction. They do not establish superiority,
  equivalence or a reliable per-brief effect.
- Reusing the six v6 briefs permits comparison of **task types**, not a direct causal
  comparison against v6's differently configured recorded costs.
- A passing record validator proves record properties. It does not prove that a
  session happened, that an agent complied, or that a reviewer judged correctly.
- A mapped scenario is not a satisfied scenario, and structural coverage is not
  semantic adequacy.
