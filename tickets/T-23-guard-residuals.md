---
ticket: T-23
status: done
size: S
prd: .prd/prd-v2.md
depends_on: [T-22]
started: 2026-09-08T15:41:29Z
last_check: 2026-09-08T15:45:16Z passed 95e207b45e54
verified: 2026-09-08T15:45:16Z 95e207b45e54
finished: 2026-09-08T15:45:16Z
---

## Objective
Close the cheap residuals from the T-22 re-probe of the ticket guard and stop over-blocking branch switches through a variable.

## Context
- T-22 re-probe (saved as `review/t22-reprobe.md` in the accepted evidence directory), items 1–4 and 6, plus the case-fold note in item 5. Implements: R-06.
- `template/.claude/hooks/hook-policy.cjs` `widePathspec`, `wholeTreeRestore`, `ticketShellMutation`, `dangerousReason`, `gitSubcommand`, `commandParts`; `test/hooks.test.js`.

## Requirements
- A `-C <dir>` prefix that is absolute, `~`-rooted, a drive path, or contains `$`/backtick makes any pathspec wide.
- Shell `-c` recursion (ticket guard and dangerous-command guard alike) matches bundled short flags such as `-lc`, `-ec`, `-xc`.
- `{` counts as a glob character in the first segment.
- The executable name is compared case-insensitively (`Git`, `GIT`).
- `xargs git checkout|restore|clean` with no visible pathspec is wide (the pathspec arrives on stdin); `git -c alias.<name>=…` makes the command wide.
- `git checkout <ref>` / `git switch <ref>` with exactly one positional, no `--` and no force flag is a branch switch and is allowed even when the ref is `$BRANCH`; pathspecs after `--` keep the `$` rule.
- `test/hooks.test.js` blocks `git -C "$PWD" checkout -- .`, `git -C /abs/repo checkout -- .`, `git -C ~/repo checkout -- .`, `bash -lc "git checkout -- ."`, `sh -ec "git restore ."`, `git checkout -- {tickets,src}/`, `Git checkout -- .`, `echo . | xargs git checkout --`, `git -c alias.co=checkout co -- .`, and the dangerous hook blocks `bash -lc "git push --force"`; it allows `git checkout "$BRANCH"`, `git switch "$b"`, `git checkout -- "src/$name.js"` stays blocked (documented).

## Acceptance Criteria
- [x] Every listed residual form is blocked and `git checkout "$BRANCH"` is allowed, by direct hook payload.
- [x] The dangerous-command hook shares the bundled `-c` recursion.
- [x] All hook, recovery, workflow and distribution tests pass.

## Verification
Proves: direct hook payloads show the residual forms blocked and the branch-switch idiom allowed; regression: any listed form passing or the idiom blocked.
```bash
node test/hooks.test.js && node test/recovery.test.js && node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- Unlisted wrappers (`stdbuf`, `setsid`, …), `git archive | tar`, `find -exec`, and `checkout-index --stdin` stay out of scope and are documented as the guard's limit.
