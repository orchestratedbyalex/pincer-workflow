---
ticket: T-81
status: done
size: S
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T20:09:51Z
last_check: 2026-09-13T20:12:21Z passed 286fb34f0090
verified: 2026-09-13T20:12:21Z 286fb34f0090
finished: 2026-09-13T20:12:21Z
---

## Objective
Close the redirection hole in the ticket guard. `isExactPincerCall()` decides that a single runtime command with no separator is trusted and short-circuits the shell-mutation check, but it never looks at the command's redirection operators, so `node scripts/pincer-runtime.cjs <allowlisted verb> > <protected path>` is allowed. The hole predates this change — `evidence export > tickets/T-01.md` and `register > .prd/changes/<id>.json` are allowed at the base commit too — but this change widened it twice: T-59 added `change` and `resume` to the allowlist, which are the two read-only reporters an agent naturally redirects into a file, and the widened `BINDING_PATH` now claims to protect `.prd/evidence/changes/` and the candidate coverage snapshots, which are bypassable the same way.

## Context
- Relevant files: template/.claude/hooks/hook-policy.cjs (`isExactPincerCall` and `ticketShellMutation`, `BINDING_PATH`, the inline source-regex fallback); test/hooks.test.js (the allowed-commands list); plugin/hooks/hook-policy.cjs (generated).
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-08 (the adoption path that widened `BINDING_PATH`); PRD v5 R-03 and R-08 (the runtime is the sole writer of lifecycle and change records).
- Source: the mechanical security audit run during `/pincer-evaluate` of the combined v5+v6 candidate. Verified against the base commit: `change list > .prd/changes/prd-v1.json` exits 2 (blocked) at `9bcf8df` and 0 (allowed) at `5b0358b`.
- Implements: the guard `template/scripts/pincer-ticket.sh` describes in its own header — "a PreToolUse hook blocks hand edits of those fields so 'done' can only be reached through a passing check".

## Requirements
- A command carrying an output redirection is never an exact runtime call: its redirect target falls through to the existing `ticketShellMutation` path test, so a write into `tickets/`, `.prd/changes/`, `.prd/evidence/changes/`, a candidate `coverage/` snapshot or `.pincer/runtime/` is blocked whatever the command in front of it is.
- The protection does not depend on which verbs are allowlisted: adding a verb later must not reopen this.
- The inline source-regex fallback covers the same widened set of paths as `BINDING_PATH`.
- `test/hooks.test.js` asserts the negative cases beside the allowed-command list: each protected path, through `>` and `>>`, behind an allowlisted verb, is refused; the plain allowlisted calls without redirection still pass.

## Acceptance Criteria
- [x] Every protected path is refused behind every allowlisted verb, through `>` and `>>`.
- [x] The commands the allowlist exists to permit still pass unchanged.
- [x] `plugin/hooks/hook-policy.cjs` regenerated and identical.

## Verification
Proves: an allowlisted runtime verb cannot carry a write into runtime-owned state.
```bash
node test/hooks.test.js
node test/distribution.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-59. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
- The hook is defence in depth for one agent surface, not the security boundary; the fix must not be described as one.
