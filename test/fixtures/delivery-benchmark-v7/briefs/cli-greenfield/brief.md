# cli-greenfield — a slug command from an empty project

Greenfield CLI feature. The base repository is an empty Node project: a `package.json`
with a `test` script, a README and nothing else. Both arms receive the same BRIEF.md and
the same prompt; the evaluator is held out of the workspace.

## Task

Build a dependency-free command-line slug tool at `bin/slug.js`, run as
`node bin/slug.js <text...>`. It prints one line to stdout and exits 0. Behaviour:

- The words given are joined with single spaces, lowercased, and every run of characters
  that is not a letter or a digit becomes a single `-`.
- Leading and trailing `-` are removed: `"  Hello,   World!  "` becomes `hello-world`.
- A run of separators collapses to one `-`: `"a -- b"` becomes `a-b`.
- Digits are kept: `"Top 10 Things"` becomes `top-10-things`.
- Text that contains no letter or digit at all prints `slug: no slug characters` on
  stderr and exits 1, printing nothing to stdout.
- No arguments prints `usage: slug <text...>` on stderr and exits 2.

Add tests that `npm test` runs, and a README section describing the command. Commit your
work; the last commit is what gets evaluated.

## Changes

1

## Prompt 1

Read BRIEF.md in this repository and implement what it asks for, committing your work as
you go. Work autonomously; when you are done, stop and summarize what you built and how
you verified it.
