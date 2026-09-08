# Re-probe of the T-22 guard (cd7021d..7614b3a), 2026-09-08

Reviewer: code-quality-reviewer subagent (Claude), resumed from the T-21 review.
Outcome: all eight prior findings resolved or mostly resolved; residual forms
listed below; items 1–4 and the case-fold and over-block were fixed in T-23, the
rest are the guard's documented limit.

## Summary

`node test/candidate.test.js` and `node test/hooks.test.js` (210 payloads) pass at
7614b3a. Every form reported against T-21 now exits 2, and the benign set is
allowed. The NFD case is resolved because the allowed set is built from
`git ls-files` output. A second probe pass found a handful of forms that still exit
0; the two that matter are the `-C` prefix escaping the absolute/`$` checks and
`bash -lc`-style bundled flags.

## Findings

1. MEDIUM — `git -C "$PWD"|/abs/repo|~/repo checkout -- .` passes: the
   absolute/`$` checks ran on the pathspec before the `-C` prefix was joined.
2. MEDIUM — bundled shell flags (`bash -lc`, `sh -ec`, `zsh -xc`) defeat the `-c`
   recursion in both guards.
3. LOW — brace expansion (`{tickets,src}/`) not in the glob class.
4. LOW — `xargs git checkout --` with the pathspec on stdin; `git -c alias.…`.
5. LOW — indirection the guard cannot see: `Git`/`GIT` on case-insensitive
   filesystems (cheap: fold case), `git archive | tar -x`, `find -exec git checkout`,
   `checkout-index --stdin`, unlisted wrappers (`stdbuf`, `setsid`, …).
6. LOW — over-block: `git checkout "$BRANCH"` / `git switch "$b"` exit 2.

Clean: NFD/NFC comparison; force flags, `--pathspec-from-file`, `-p`, `switch`,
`checkout-index`, `read-tree`, stash allowances, clean pathspecs; pathspec magic and
normalisation apart from braces; playbook wording.

## Status of the eight T-21-review findings at 7614b3a

| # | Finding | Status |
| --- | --- | --- |
| 1 | force flags / `switch --discard-changes` | resolved |
| 2 | `tickets/…` variants, `-C tickets` | resolved (brace residual → T-23) |
| 3 | whole-tree spellings | resolved for pathspecs; `-C` prefix residual → T-23 |
| 4 | `--pathspec-from-file`, `checkout-index`, `read-tree` | resolved |
| 5 | `clean` inconsistencies | resolved |
| 6 | NFD false stale | resolved |
| 7 | over-blocked stash forms | resolved (new over-block `$BRANCH` → T-23) |
| 8 | wrapper bypass | mostly resolved (bundled `-c`, `xargs` stdin → T-23; unlisted wrappers documented) |
