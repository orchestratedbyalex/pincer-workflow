# Code-quality review — T-21 diff (2952e62..cd7021d), 2026-09-08

Reviewer: code-quality-reviewer subagent (Claude). Outcome: five of six prior
findings resolved; the whole-tree guard was still bypassable. Fixed in T-22.

## Summary

All six listed test files passed. `--relative`/`quotePath` comparison is
byte-consistent with the validator whenever `CLAUDE_PROJECT_DIR` names the
project; malformed NOTES fields no longer become fabricated flags; usage errors are
labelled; `--base` works; the visual rule is relaxed as specified. The unresolved
area was `wholeTreeRestore`: a fixed list of literal spellings rather than
normalised pathspecs or mode flags.

## Findings

1. HIGH — `git checkout -f`/`--force`, `git switch --discard-changes` pass and
   discard every local change including ticket files.
2. HIGH — `tickets/…` pathspecs blocked only in two spellings; `tickets/T-*`,
   `tickets/*.md`, `tickets//`, `tickets/./`, `tickets/../tickets`, `:/tickets`,
   `:(top)tickets`, `:(icase)TICKETS`, `git -C tickets checkout -- T-01…` pass.
3. MEDIUM — other whole-tree spellings pass: `./*`, `**`, `./.`, `:(top)`,
   `:(glob)**`, `"$PWD"`, absolute paths.
4. MEDIUM — `--pathspec-from-file`, `checkout-index -af`, `read-tree -u --reset`
   unguarded.
5. LOW — `git clean` pathspec handling inconsistent; `-e <pattern>` counted as a
   positional.
6. LOW — NFD manifest path vs NFC git storage on macOS yields a false `stale`.
7. LOW — `git stash create|store|--help` wrongly blocked.
8. LOW (pre-existing) — `bash -c`, `eval`, `nice`, `time`, `nohup`, `xargs`
   wrappers bypass `ticketShellMutation`.

Clean: `notes_current` comparison (beyond 6), `evidence_validate`/`evidence_reason`,
`--base`, relaxed visual rule, playbook wording apart from the over-promise.

## Status of the six original findings

| # | Finding | Status after T-21 |
| --- | --- | --- |
| 1 | subdirectory false-stale | resolved |
| 2 | non-ASCII false-stale | resolved for quoting; NFD edge remained (→ T-22) |
| 3 | 40/64-hex | resolved |
| 4 | manifest base unchecked | resolved |
| 5 | usage errors as verdicts | resolved |
| 6 | whole-tree restores | partially resolved (→ T-22) |
