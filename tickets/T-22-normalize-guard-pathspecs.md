---
ticket: T-22
status: done
size: M
prd: .prd/prd-v2.md
depends_on: [T-21]
started: 2026-09-08T15:32:11Z
last_check: 2026-09-08T15:36:44Z passed 5be5a9a5b5fe
verified: 2026-09-08T15:36:44Z 5be5a9a5b5fe
finished: 2026-09-08T15:36:44Z
---

## Objective
Make the ticket guard's whole-tree restore rule reason about normalized pathspecs, force flags, wrappers and the extra restore commands the T-21 review still got past it, and compare evidence paths through git's own canonical bytes.

## Context
- Review of T-21 (`.prd/evidence/prd-v2/<candidate>/review/code-quality.md` in the accepted evaluation): findings 1–8. Implements: R-06 (guard), R-04 (path comparison).
- `template/.claude/hooks/hook-policy.cjs` `wholeTreeRestore`, `ticketShellMutation`, `commandParts`, `gitSubcommand`; `template/scripts/pincer-ticket-lib.sh` `notes_current`; `template/.claude/commands/pincer-code.md` recovery section; `test/hooks.test.js`, `test/candidate.test.js`, `test/workflow.test.js`.

## Requirements
- Pathspecs are normalized before the wide test: pathspec magic (`:/`, `:(top)`, `:(glob)`, `:(icase)`, `:(literal)`, `:!`/`:(exclude)` entries ignored), `//` and `.` segments collapsed, `..` resolved, leading `./` stripped, a `-C <dir>` prefix applied. After normalization a pathspec is wide when it is empty or `.`, absolute, contains an unexpanded `$`/backtick, has a glob character in its first segment, or has a first segment equal to `tickets` (case-insensitive).
- `checkout`/`switch` with `-f`, `--force`, `--discard-changes`, a bundled short flag containing `f`, `--pathspec-from-file`, or `-p`/`--patch` without a narrow pathspec are wide; `restore` with `--pathspec-from-file` is wide; `checkout-index` with `-a`/`--all`, `read-tree` with `-u` or `--reset`, `reset --hard|--merge|--keep`, and `stash` other than `list`, `show`, `create`, `store`, `-h`, `--help` are wide; `clean` applies the same pathspec normalization (skipping `-e`/`--exclude` values).
- `ticketShellMutation` recurses into `bash|sh|zsh -c '<string>'` and `eval` arguments (bounded depth) and skips `nice`, `time`, `nohup`, `timeout`, `xargs` prefixes, mirroring `dangerousReason`.
- `notes_current` builds the allowed set from `git -c core.quotePath=false ls-files -- <path>` output for each listed file, so both sides carry git's canonical bytes (NFC on macOS with `core.precomposeunicode`, raw elsewhere).
- The code playbook states the guard's coverage as documented forms plus normalized pathspecs and force flags, and that it is a safety net, not a complete shell boundary.
- Tests: `test/hooks.test.js` blocks every reproduction listed in the review (force flags, `switch --discard-changes`, `tickets/T-*`, `tickets/*.md`, `tickets//`, `tickets/./`, `tickets/../tickets`, `:/tickets`, `:(top)tickets`, `:(icase)TICKETS`, `-C tickets checkout -- T-01-example.md`, `./*`, `**`, `./.`, `:(top)`, `:(glob)**`, `"$PWD"`, `/abs/path`, `--pathspec-from-file=list.txt`, `checkout-index -af`, `read-tree -u --reset HEAD`, `clean -f .`, `bash -c "git checkout -- ."`, `nice git restore .`) and allows `git stash create`, `git stash --help`, `git checkout -- src/app.js`, `git switch main`, `git clean -f build/`; `test/candidate.test.js` adds an NFD-named artifact that reports `current`.

## Acceptance Criteria
- [x] Every reproduction from the T-21 review is blocked and the listed benign forms are allowed, by direct hook payload.
- [x] Wrapped restores (`bash -c`, `eval`, `nice`/`time` prefixes) are blocked.
- [x] An NFD-named artifact reports `current` after a valid evidence-only commit.
- [x] The code playbook states the guard's coverage honestly; all listed tests and generated outputs pass.

## Verification
Proves: direct hook payloads and temporary repositories show the normalized guard and canonical path comparison behave as specified; regression: any listed restore form passing, a benign form blocked, or an NFD artifact reported stale.
```bash
node test/hooks.test.js && node test/candidate.test.js && node test/recovery.test.js && node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- Keep the guard a pattern-based safety net; do not attempt to resolve shell state or branch contents.
