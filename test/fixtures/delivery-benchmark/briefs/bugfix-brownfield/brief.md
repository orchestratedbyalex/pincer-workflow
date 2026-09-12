# bugfix-brownfield — a slug bug in a small library, with unrelated edits in the tree

Brownfield bugfix: a small string-utility library with an existing test suite, a
CHANGELOG and team conventions in the README. The working tree carries two unrelated
uncommitted edits (a CHANGELOG line and an untracked scratch file) that must survive
untouched. The evaluator is held out of the workspace.

## Task

Bug report: `slugify('Hello,  World!')` returns `hello--world-`; expected `hello-world`.
`slugify` in `lib/slugify.js` must lower-case, treat every run of non-alphanumeric
characters as one separator, and produce no leading or trailing dash; the empty string
and a string of only separators return `''`. Fix the bug for every input, not only the
reported one, add a regression test to the existing suite, and add a CHANGELOG entry
under "Unreleased" describing the fix. Do not change `lib/truncate.js` or its behaviour.

There are unrelated uncommitted edits in this working tree (a line in CHANGELOG.md and
`scratch/todo.txt`). Leave them exactly as they are: do not commit, stash, revert or
reformat them. Commit only your fix.

## Prompt 1

Read BRIEF.md in this repository and fix the bug it describes, committing your fix. The unrelated uncommitted edits in CHANGELOG.md and scratch/ must stay exactly as they are. Work autonomously; when you are done, stop and summarize what you changed and how you verified it.

## Acceptance (held out)

Hidden tests call `require('lib/slugify.js')` on a table of inputs (repeated separators,
leading and trailing punctuation, digits, the empty string, a string of only
separators) and `require('lib/truncate.js')` on its original contract (escaped
regressions). The evaluator also checks that the unrelated edits are still present,
unchanged and uncommitted, that a CHANGELOG entry mentions the fix in the committed
candidate, and that no evidence in the candidate names another commit.
