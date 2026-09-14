# PRD v7 baseline observation — where the strict journey costs effort

PRD v7 R-03 asks for three observed strict-coverage pilots before the workflow is
optimized, and S-09 asks for a friction record that ties the two proposed
improvements to concrete baseline events *before* their implementation begins.

**This document delivers the friction record. It does not deliver the pilots.** The
distinction is the whole point of R-03 and is stated plainly in the last section: what
follows is an operator walking the released commands and counting, not agents
following the shipped instructions on real projects. Do not read it as S-07 or S-08
evidence, and do not close T-89 on it.

## 1. What was measured

`scripts/delivery-benchmark-v7/baseline-journey.cjs` drives a pinned released kit
through a complete strict journey in a disposable project and records every command
with its exit code, its stdout/stderr byte counts and its wall-clock, plus every byte
a human had to author:

register → select → status → coverage → **author the map by hand** → adopt preview →
adopt apply → authorize → activate → start/verify/done per ticket → pause →
**fresh-session resume** → change resume → impact → **re-author the map** →
change revise → authorize the revised scope → re-verify → complete → check → export.

- Kit: tag `v0.6.0` → commit `694241c`, extracted outside the tree.
  Digest `cc8c11e0584bec979fe22069700eeada3681b75919f95f2dc8ba9529da055410`.
- Host: Node v22.23.1, macOS 26.6.2 (darwin 25.6.0).
- Cost: none. No model is invoked.

`scripts/delivery-benchmark-v7/scale-measure.cjs` repeats the two measurements that
matter for the improvements at four change sizes, because a three-scenario fixture
cannot show how either surface behaves on real work.

## 2. Measured baseline

Complete journey on a 3-scenario, 2-ticket change: **35 runtime commands**, **21,654
bytes of stdout**, **3,006 bytes authored by hand**.

| Stage | Commands | Stdout bytes |
| --- | ---: | ---: |
| adopt (register → activate) | 8 | 3,564 |
| code (start/verify/done ×2) | 6 | 806 |
| pause | 1 | 74 |
| **fresh-session resume** | 5 | **8,224** |
| **scope revision** | 10 | **6,129** |
| evaluate | 5 | 2,857 |

Two stages dominate, and they are exactly the two the PRD proposes to address.

### 2.1 Fresh-session context loading — 8,224 bytes across five commands

What a resumed session reads before it can act:

| Command | Bytes |
| --- | ---: |
| `resume --json` | 4,818 |
| `resume` | 1,354 |
| `status` | 1,146 |
| `coverage` | 835 |
| `change resume` | 71 |

Four of the five are reports of the same computed state. An agent that reads
`resume --json` to find one next action pays 4,818 bytes to get a ~120-byte answer.

**This grows with the change.** The full report carries one line per ticket, one per
attempt and one per blocker, so its size is linear in the work; the answer it is read
for is not.

### 2.2 Coverage-map authoring — 809 bytes, 53 lines, all of it transcription

The map for a 3-scenario change was **49% of everything authored in the first pass**
(809 of 1,642 bytes). Every structural line in it — the scenario IDs, the ticket IDs,
their parent requirements — already exists in documents the runtime parses. The
author's real work is the *decisions*: which ticket delivers which scenario, what
check proves it, which scope is deferred. The transcription around those decisions is
what costs, and it is where a missed or misspelled ID turns into `COVERAGE_INCOMPLETE`
on the next command.

### 2.3 A scope revision costs ten commands and re-verifies untouched work

Adding one scenario under authorization took: `impact`, `coverage`, `resume`,
re-author the map, `change revise`, `change authorize`, then **`verify` and `done`
again for every already-done ticket** — including tickets the revision did not touch.
The PRD revision changes the revision digest every passing attempt ran under, so
`REVISION_CHANGED` invalidates all of them and `change complete` refuses until each is
re-verified.

This is conservative on purpose and PRD v7 preserves it. It is recorded here as a
measured cost of revision, not as a defect.

### 2.4 A reproduced defect: `REVISION_CHANGED` advises a refused command

`template/scripts/pincer-runtime/readiness.cjs:73` emits the remedy
`register --rebind, then verify`. In changes mode that command is refused at
`template/scripts/pincer-runtime.cjs:411`:

```
pincer: AGREEMENT_CHANGED: --rebind is not supported for change records; record the
revised agreement with `change revise <id>` and its disposition with `change authorize`
```

A report recommending a command the runtime refuses is the exact defect class T-80
closed for the coverage report ([[one-next-action-precedence]]). The readiness reason
carries the legacy-mode remedy unconditionally. Reproduced from the probe's own
record; **carried as a fix ticket, and the original run is retained.**

## 3. Design basis for T-90 and T-91

Both improvements were measured against the same journey, at four change sizes, with
the same kit. Bytes of output, so the numbers are comparable across surfaces.

| Scenarios | Source to read to author the map | `coverage scaffold` draft | `resume` | `resume --brief` | saved | `resume --json` | `--brief --json` | saved |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 1,128 | 1,040 | 1,211 | 576 | 52% | 4,655 | 1,614 | 65% |
| 10 | 3,428 | 1,681 | 1,696 | 581 | 66% | 8,809 | 1,830 | 79% |
| 20 | 6,746 | 2,601 | 2,396 | 581 | 76% | 14,749 | 2,130 | 86% |
| 40 | 13,382 | 4,441 | 3,796 | 581 | 85% | 26,629 | 2,730 | 90% |

**The brief resume is constant-size.** Human brief output is 576–581 bytes at every
change size, because it reports counts and one next action rather than rows. The full
report grows linearly. The saving is therefore 52% on a toy change and 85% on a
forty-scenario one — and the JSON saving, which is what an agent actually reads,
reaches 90%.

**The scaffold's saving is real only at scale, and that is stated rather than hidden.**
At three scenarios the draft (1,040 bytes) is no smaller than reading the PRD and the
tickets (1,128). At forty it is 4,441 against 13,382 — a 67% reduction in what must be
read to author the map. On small changes its value is not byte count but correctness:
every live scenario is listed exactly once, so the author cannot omit one or misspell
an ID, which is the failure the transcription actually produces.

Neither claim is a delivery claim. Fewer bytes is not less effort, and this measures
the released commands, not a person or an agent using them. Section 5 says what would.

## 4. What is designed against what was measured

| Observation | Improvement | How the improvement answers it |
| --- | --- | --- |
| §2.1 — 8,224 bytes over five reports to find one next action | `resume --brief` (T-91) | one projection of the report already computed; `next` copied verbatim, blocker categories kept with exact counts, omitted rows named with the command that prints them |
| §2.1 — the report grows with the change, the answer does not | `resume --brief` | constant-size output: counts, not rows |
| §2.2 — the map is 49% of first-pass authoring and all of it transcription | `coverage scaffold` (T-90) | every live scenario listed exactly once with its requirement; every ticket with its objective, its own claim and its verification text, as material to read |
| §2.2 — a missed or misspelled ID becomes `COVERAGE_INCOMPLETE` later | `coverage scaffold` | membership is generated, so it cannot be wrong; the decisions stay with the author |
| §2.3 — a revision re-verifies untouched tickets | *none* | preserved deliberately; recorded as a measured cost of revision |
| §2.4 — `REVISION_CHANGED` advises a refused command | fix ticket | the remedy must be mode-aware, as `routing.cjs` already is |

Nothing else was added. The scaffold does not infer adequacy, generate checks or adopt
anything; the brief does not cache readiness, truncate a blocker or decide an action.

## 5. What this does not establish

**These are not the three pilots.** R-03 requires one greenfield and two brownfield
projects with genuine intended work, pinned bases, held-out acceptance checks, at
least one with pre-existing user edits whose preservation is recorded, carried through
adoption, an authorized revision, pause, fresh-session recovery and schema 3
evaluation **by agents following the shipped instructions**, with every operator
intervention visible.

An operator walking the commands cannot show any of what those pilots exist to find:
whether an agent understands the instructions, where it goes wrong, what it asks the
user for, which approvals it repeats, or what a human spends reviewing the result.
Byte counts are not effort and a clean scripted journey is not a usable one.

S-07 and S-08 are therefore **unchecked**, and T-89 stays open. What they need is
listed as outstanding in [the protocol](prd-v7-protocol.md), section 9: the three
projects are not selected, project access is not decided, and no spending or
wall-clock cap has been supplied. Those are the user's decisions, and the schedule
must be costed before any of it runs.

S-09 is met by sections 2–4: the friction is measured, ranked and cited, and both
improvements were designed against it before they were implemented. The paired
before/after comparison those numbers feed into belongs to T-95 and needs the same
outstanding decisions.
