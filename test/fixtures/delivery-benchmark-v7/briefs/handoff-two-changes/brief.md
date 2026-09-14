# handoff-two-changes — a fresh session finishes what another started

Two sessions over two changes, with no conversational recap between them: the second
session is told only to continue from what is in the repository.

## Task

Two related pieces of work on `src/money.js`.

**Change 1** — `format(cents, currency)` returns a string: `format(1234, 'USD')` is
`"$12.34"`, `format(-50, 'USD')` is `"-$0.50"`, `format(0, 'USD')` is `"$0.00"`. Only
`USD` (`$`) and `EUR` (`€`) are supported; any other currency throws `Error` with the
message `unsupported currency: <code>`.

**Change 2** — `parse(text)` is the inverse: `parse("$12.34")` is
`{ cents: 1234, currency: 'USD' }`, `parse("-€0.50")` is
`{ cents: -50, currency: 'EUR' }`. Text that does not parse throws `Error` with the
message `cannot parse: <text>`.

Commit each change separately. The last commit is what gets evaluated.

## Changes

2

## Prompt 1

Read BRIEF.md in this repository and implement Change 1 only, committing your work. Work
autonomously and stop when Change 1 is done.

## Prompt 2

Continue this repository's work from its current state. Do not ask for a recap; read what
is there and finish what remains. Commit your work.
