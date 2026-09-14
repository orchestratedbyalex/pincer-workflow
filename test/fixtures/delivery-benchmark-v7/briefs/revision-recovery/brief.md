# revision-recovery — a revision, an interruption and a recovery

Three sessions across two changes. Session 2 is interrupted part-way and session 3 has to
pick the work up from the repository, after the requirement has already been revised once.
This is the long-form brief the v6 edition had no equivalent of: continuity and recovery
cannot be observed on a single-session task.

## Task

A rule engine in `src/rules.js`.

**Change 1** — `evaluate(rules, facts)` returns the `action` of the first rule whose
`when` object is a subset of `facts` (every key present and equal), or `null` if none
matches.

**Change 2** — rules gain an optional numeric `priority`. The matching rule with the
HIGHEST priority wins, not the first; ties are broken by the earlier rule. A rule with no
`priority` counts as 0. `evaluate` must also expose `explain(rules, facts)`, returning
`{ action, rule }` where `rule` is the index of the winning rule, or
`{ action: null, rule: null }`.

Commit each session's work. The last commit is what gets evaluated.

## Changes

2

## Prompt 1

Read BRIEF.md in this repository and implement Change 1 only, committing your work. Stop
when Change 1 is done.

## Prompt 2

Begin Change 2: rules now carry a priority and the highest-priority match wins. Implement
the priority ordering and commit. Do not add `explain` yet.

## Prompt 3

The previous session ended part-way through Change 2. Read the repository, work out what
is finished and what is not, and complete the change — including `explain`. Do not ask
for a recap. Commit your work.
