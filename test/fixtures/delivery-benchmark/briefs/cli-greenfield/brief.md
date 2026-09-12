# cli-greenfield — a todo CLI from an empty project

Greenfield CLI feature: the base repository is an empty Node project (a `package.json`
with a `test` script and a README). Both arms receive the same `BRIEF.md` and the same
prompt; the evaluator below is held out of the workspace.

## Task

Build a dependency-free command-line todo list at `bin/todo.js` (run as
`node bin/todo.js <command> …`). Items live in a JSON file: the path in the `TODO_FILE`
environment variable, otherwise `todo.json` in the current directory. Behaviour:

- `add <text…>` appends an item (words joined by single spaces), prints `added #<n>: <text>`
  where `<n>` is the 1-based item number, exit 0. Missing text: prints `usage: todo add <text>`
  on stderr, exit 2.
- `list` prints one line per item in order: `#<n> [ ] <text>` for open items and
  `#<n> [x] <text>` for done ones; with no items it prints `no items`. Exit 0.
- `done <n>` marks item `<n>` done and prints `done #<n>`, exit 0. A number that does not
  exist prints `no such item: <n>` on stderr and exits 1 without changing the file.
  Marking a done item again is fine (prints `done #<n>`).
- An unreadable or non-JSON file prints `todo.json is not valid JSON` on stderr and exits 1
  for every command, leaving the file untouched. An unknown command prints usage on
  stderr, exit 2.
- Add tests (`npm test` must run them) and a short README section describing the commands.

Commit your work; the last commit is what gets evaluated.

## Prompt 1

Read BRIEF.md in this repository and implement what it asks for, committing your work as you go. Work autonomously; when you are done, stop and summarize what you built and how you verified it.

## Acceptance (held out)

The evaluator runs `node bin/todo.js` with `TODO_FILE` pointing into a scratch directory
and checks: add/list round trip and numbering, the `no items` case, `done` on an open
and a missing item (stderr text, exit code, file unchanged), the usage errors, a corrupt
file (stderr, exit 1, file unchanged) and that `npm test` passes in the candidate. It
also checks that no evidence in the candidate names another commit as the candidate.
