# PRD v7 comparison — delivery and human review

**No comparison has been run.** T-95 is open. This document is the frozen shape of the
result and the place the numbers will go; every cell below is outstanding, and the
record at `docs/prd-v7-artifacts/comparison/comparison-v7.json` says so in a form
`test/improvement-trial-records.test.js` checks.

Publishing the shape before the result is deliberate. The design decisions that make a
comparison trustworthy — which baseline, which denominator, who reviews, what counts
as a met target — are much harder to defend after seeing the numbers, so they are
settled here, in advance, and frozen.

## What is being compared

Two separate comparisons, which answer different questions and are not substitutes:

1. **Paired pilots, baseline against improved.** The three pilot task types from T-89,
   repeated on matched disposable snapshots with the 0.6.0 kit and with the improved
   kit. This is the before/after evidence for the product improvements. Order is
   controlled and recorded per pair so learning effects are visible rather than
   invisible; a pair whose two sides name the same kit compares nothing and is refused.
2. **The three-arm experiment**, 72 runs: eight briefs × `plain`/`pincer`/`strict` ×
   three matched repetitions. This measures workflow tradeoffs across task types. It is
   **not** a substitute for the before/after comparison, and the report does not use it
   as one.

## Predeclared targets

Frozen before any run. Each is `met`, `missed` or `outstanding` — there is nothing in
between, and the validator refuses anything else.

| Target | Result | Basis |
| --- | --- | --- |
| Halve the avoidable workflow operations on the paired pilots | `outstanding` | the three paired pilots have not run |
| Reduce median short-task cost and active session time without lower observed acceptance or weakened invariants | `outstanding` | the 72-run comparison has not run |

**A missed target is a product finding, not permission to relabel runs, drop cells or
suppress failures.** The record carries no field that would let a missed target be
reported as anything else: setting `suppressed` is a validation failure
(`RESULT_SUPPRESSED`), not an option.

The engineering target came from the [assessment](pincer-assessment-2026-09-13.md),
which proposed halving the measured overhead "as a proposed target, not a prediction".
It is an objective, and missing it is a result this document will publish.

**Unfavourable results are published here, with their uncertainty.** If the improved
kit costs more, saves nothing, or lowers acceptance, that goes in the table above with
the numbers behind it. A negative result is a valid answer to the question R-09 asks;
the only invalid answer is one that was shaped by what the numbers turned out to be.
Three matched repetitions per cell detect gross friction — they do not establish
superiority, equivalence, or a reliable per-brief effect, and the report says so
wherever it reports a difference.

## What the report must carry

| Item | Rule |
| --- | --- |
| Per-brief and per-arm acceptance | with the denominator it was computed over, and the count excluded from it |
| Independent regressions | held-out checks reported separately from the candidate's own tests |
| Interventions | by kind: clarification, reapproval, repair, operator |
| Stage effort | setup, authoring, verification, recovery and review timed separately |
| Tokens and cost | provider-reported; `null` with a reason where unavailable, never zero |
| Spread | reported, not only central tendency |
| Denominators | every rate carries the number of runs behind it |
| Null reasons | every unmeasured value says why it is unmeasured |

## Human review

At least **two reviewers who did not implement the candidate**, timed, on matched
candidate tasks, blinded to arm where the artifacts make blinding feasible. Recorded
per review: reviewer pseudonym, task, decision, elapsed minutes, confidence 1–5, faults
missed against the held-out evaluator, order position, prior exposure, and whether the
arm was knowable.

This is the measure the v6 study did not take at all — it recorded setup time as zero
for automated preparation and did not measure review time. **Missing review time is
`null` with its reason and is never reported as zero**; the validator refuses a review
whose elapsed time is zero, because a stopwatch nobody started is not no time spent.

An automated record check cannot stand in for a review. `test/improvement-trial-records.test.js`
proves the records are well formed; whether a reviewer judged correctly is read from
what they wrote.

## Runs

| | Scheduled | Completed | Invalid | Outstanding |
| --- | ---: | ---: | ---: | ---: |
| Three-arm comparison | 72 | 0 | 0 | 72 |
| Paired pilots | 3 pairs | 0 | 0 | 3 pairs |
| Independent reviews | ≥2 reviewers | 0 | — | all |

The counts must account for the schedule: `completed + invalid + outstanding` equals
`scheduled`, and a schedule that is not 72 runs needs an explicit recorded scope
revision rather than a quietly smaller study.

## What would have to be true before this document has numbers

From the [protocol](prd-v7-protocol.md), section 9, all still outstanding:

- the three pilot projects selected, and project access decided for the two brownfield ones;
- a concrete spending cap and wall-clock cap — **the 72-run schedule is substantive
  spending and must be costed before it runs**;
- at least two non-implementing reviewers identified and available;
- the Codex CLI version pinned and available, and browser tooling for the UI brief
  (absent tooling makes a run `unavailable`, never an acceptance);
- the v7 candidate identified, so both kits in each pair are pinned by digest.

Until then every criterion of R-09 is unchecked and T-95 stays open. A valid negative
comparison satisfies the measurement requirement; nothing satisfies it that was not run.
