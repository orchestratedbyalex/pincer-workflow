# bugfix-brownfield — an off-by-one in an existing helper

Brownfield bugfix. The base repository already has `src/truncate.js`, its own test suite
and a changelog. One reported defect, and the rest of the behaviour must keep working.

## Task

`truncate(text, limit)` is supposed to return `text` unchanged when it is at most
`limit` characters, and otherwise return exactly `limit` characters ending in a single
`…` (so the result is never longer than `limit`).

The reported defect: a string exactly `limit` characters long is truncated when it should
be returned unchanged, and a truncated result comes back one character too long.

Fix it. The existing behaviour must not change:

- a limit below 1 throws `RangeError` with the message `limit must be at least 1`;
- a non-string `text` throws `TypeError` with the message `text must be a string`;
- `truncate('', 5)` returns `''`.

Add the regression to the existing suite, add a line to `CHANGELOG.md` under
`## Unreleased`, and leave the rest of the repository alone. Commit your work.

## Changes

1

## Prompt 1

Read BRIEF.md in this repository and fix what it describes, committing your work as you
go. Work autonomously; when you are done, stop and summarize the fix and how you verified it.
