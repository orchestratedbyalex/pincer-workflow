# Code-quality review — PRD v2 (T-11..T-20), candidate 2952e62 (superseded)

Reviewer: code-quality-reviewer subagent (Claude), 2026-09-08, diff
`7a93f07..2952e62`. Outcome: six findings; all fixed in T-21, which produced a new
candidate. This directory holds no manifest: the candidate was not accepted.

## Summary

The validator (`pincer-evidence.cjs`) is solid: the path-containment walk
(segment-by-segment `lstat`, symlink rejection at every level, `realpath` of the
manifest before matching `MANIFEST_AT`) held up against every escape tried, it never
writes, and the test matrix exercises each failure class in a fresh temp repo. The
defects are concentrated in the shell integration around it.

## Findings (by severity)

1. **`notes_current` false-stale when the project is a subdirectory of the git
   toplevel** — Medium. `git diff --name-only` prints toplevel-relative paths while
   the validator's list is `CLAUDE_PROJECT_DIR`-relative, so every evidence file is
   "offending" (`stale: candidate changed after evaluation: packages/app/.prd/…`)
   while the `Evidence` line says `ok`. Regression relative to M0. Fix: `--relative`.
2. **`notes_current` false-stale for any non-ASCII artifact filename** — Medium.
   `core.quotePath=true` prints octal-escaped quoted paths that never match the raw
   list. Fix: `-c core.quotePath=false`.
3. **Ticket guard does not block whole-tree restores; playbook and T-17 overstate
   it** — Medium. `git checkout -- .`, `git restore .`, `git reset --hard`,
   `git stash push`, `git restore --source=HEAD :/` all passed the guard and would
   revive a revoked receipt. Fix: block whole-tree forms in `ticketShellMutation`
   and test them.
4. **Status `Evidence` line reports the script's own usage errors as an evidence
   verdict** — Low. `prd-v0` sentinel and malformed candidates produced
   `pincer-evidence: --prd must be …` as the manifest's verdict. Fix: omit
   malformed flags; label exit 2 separately.
5. **64-hex candidates accepted by `notes_current` but rejected by the validator**
   — Low. Fix: 40-hex only.
6. **Manifest `base` never checked against NOTES.md `base`** — Low. Fix: `--base`.

Silent failures: no findings. Security (path handling, shell injection, secrets):
no findings.

## Requirement drift

- R-02 / R-05 / T-19: the trials did not observe "unavailable visual tool →
  unverified" or "deferral requiring authorization"; T-19 was closed on a
  section-presence check. Addressed by two focused trials after this review (see
  the trial records' addenda).
- R-04: not met for subdirectory installs or non-ASCII names (findings 1, 2).
- R-06: whole-tree restores unguarded (finding 3).
- R-03, R-05 (profile, authorization rule), R-06 (failure text, single warnings,
  elapsed line): met.
