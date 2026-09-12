# handoff-two-changes — two changes, one interruption, a fresh-session handoff

Two-change fresh-session handoff. Session 1 starts change A, sets it aside half-done,
completes change B and stops. Session 2 is a fresh session with no memory of the first
and must find and finish the unfinished work from the repository alone. The evaluator
checks the final behaviour of both changes and, from the history, that session 1 left A
half-done with B complete.

## Task

Build a dependency-free notes CLI at `bin/notes.js` (run as `node bin/notes.js <command> …`).
Notes live in a JSON array file: the path in `NOTES_FILE`, otherwise `notes.json` in the
current directory. A corrupt file prints `notes.json is not valid JSON` on stderr and
exits 1. There are two independent changes; each has its own tests and commits.

Change A — add and list:
- A1 `add <text…>`: appends the note (words joined by single spaces) and prints
  `added: <text>`; without text prints `usage: notes add <text>` on stderr, exit 2.
- A2 `list`: prints one line per note, `- <text>`, in insertion order, or `no notes`
  when empty.

Change B — clear:
- B1 `clear`: removes every note, prints `cleared <n> notes` (`n` = how many there
  were) and leaves an empty list; `clear` with the `--dry-run` flag prints the same line
  and changes nothing.

Add tests (`npm test` runs them). Commit each part separately with a message naming it.

## Prompt 1

Read BRIEF.md in this repository. Implement A1 only, commit it, then set change A aside and implement change B completely (B1, with tests), committing it. Leave A2 for a later session; do not implement it now. Stop when B is done and summarize where each change stands so that a later session can pick up from the repository alone.

## Prompt 2

Continue the unfinished work in this repository from the repository alone: find out where each change stands, finish what is left, commit, and summarize. Do not ask me to re-approve work I already approved.

## Acceptance (held out)

Hidden tests run A1, A2 and B1 against the final candidate. A protocol check exports the
last commit before session 1 ended and checks that A1 and B1 pass there while A2 does
not (`session-boundary`); with fewer than two completed sessions it is `unverified`.
