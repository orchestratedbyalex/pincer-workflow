---
ticket: T-62
status: done
size: S
prd: .prd/prd-v5.md
depends_on: []
started: 2026-09-12T00:54:07Z
last_check: 2026-09-12T00:54:43Z passed ead9a0e17d1a
verified: 2026-09-12T00:54:43Z ead9a0e17d1a
finished: 2026-09-12T00:54:43Z
---

## Objective
Fix the trial finding from T-60 session B3: after the runtime refused with `AGREEMENT_CHANGED` for a PRD revision the agent had not made, the agent recorded the user's general "continue" instruction as a `user` authorization of the revised agreement and implemented the new ticket. The code playbook must make an out-of-session agreement change a consequential decision to surface, never something a resume instruction approves.

## Context
- Relevant files: template/.claude/commands/pincer-code.md; generated adapters; test/workflow.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), R-04, R-05 (S-14, S-16).
- Source: `docs/trial-prd-v5.md`, session B3 (brownfield), finding 1.
- Implements: R-05 (playbook wording; no runtime change).

## Requirements
- The `/pincer-code` playbook states that an `AGREEMENT_CHANGED` caused by an edit the session did not make (a revised PRD, an added or changed ticket) is a consequential decision: raise it with `change decide <id> --summary "<what changed>"`, report the structural difference, and stop.
- A general instruction to continue, resume or "not re-ask" never authorizes new scope; a `user` authorization for the revised agreement is recorded only for an instruction that names the revised content.
- The wording test pins both sentences; generated adapters are regenerated.

## Acceptance Criteria
- [x] The playbook names the out-of-session agreement change as a decision to surface and forbids reading a continue instruction as approval.
- [x] `test/workflow.test.js` pins the wording and the adapters are regenerated.

## Verification
Proves: the canonical playbook and its adapters carry the rule (a static contract; agent compliance is observed in the T-60 re-run, not here).
```bash
node test/workflow.test.js
```
