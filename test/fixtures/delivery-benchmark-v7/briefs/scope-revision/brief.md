# scope-revision — the requirement changes mid-build

A mid-build scope revision across two sessions. The second prompt changes what was asked
for; the finished work has to satisfy the revised requirement without losing the part of
the original that still stands.

## Task

`summarize(entries)` in `src/summarize.js` takes an array of
`{ level, message }` and returns a one-line summary.

Session 1 asks for counts by level: `"3 info, 1 warn"`, levels in the order
`info, warn, error`, omitting levels with no entries, and `"nothing to report"` for an
empty array.

Commit your work each session; the last commit is what gets evaluated.

## Changes

2

## Prompt 1

Read BRIEF.md in this repository and implement `summarize(entries)` as described,
committing your work. Work autonomously and stop when it is done.

## Prompt 2

The requirement has changed. As well as the counts, the summary must end with the message
of the highest-severity entry, in the form `"3 info, 1 warn: disk almost full"` — severity
order is error, then warn, then info, and the FIRST entry of the highest level present
supplies the message. `"nothing to report"` is unchanged for an empty array. Update the
implementation and its tests, and commit.
