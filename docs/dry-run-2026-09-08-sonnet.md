# Dry run 2026-09-08: M0 kit on Claude Sonnet, brownfield repo

Kit under test: `fix/m0-trust` packed as `pincer-workflow-0.2.3.tgz` (version
not yet bumped), installed with
`npx --yes --package <tgz> pincer init --platform claude` into
`wordAnalyzer`, an existing Create React App / TypeScript project on branch
`chore/upgrade-react-scripts`. Driver: the kit author, following
`docs/dry-run-checklist.md`, with a cheaper model (Sonnet) to see whether the
kit carries the workflow rather than the model.

## What passed

| Area | Evidence |
|---|---|
| Full chain | plan → narrow → code → evaluate → release on PRD v1 (OS-aware background gradient, pure CSS). Every commit scoped: PRD alone, narrow (status flip + ticket), T-01 (code + ticket), built flip, NOTES. |
| Plan investigates before asking | On PRD v2 the model found the existing word counter and its helper first, then reframed the brief as a restyle. Three questions, all real decisions. |
| Release audit | Used `docs/release-checklist.md` (17 items), ran `npm test` and `npm run build` directly, never called `pincer-ticket.sh`, tree clean before and after, N/A rows carried reasons, one judgment note named before the verdict. |
| Receipt revocation | With the `@media` block removed, `pincer-ticket.sh done T-01` re-ran verification, failed on the grep line, dropped `verified:` and wrote `last_check: … failed <hash>`. Status then warned on T-01, marked NOTES.md stale, pointed at code with a re-verify, and stopped offering release. `git checkout` of both files restored "NOTES.md: current" with no residue. |
| Hand edit outside the editor | Ticket status changed to `pending` in a text editor (hooks cannot see this). `pincer-status.sh` reported "invalid tickets: status must be open, in_progress, or done" and refused to give a next action. |
| Ticket guard | Blocked `git checkout -- tickets/T-01…` from the assistant's shell with an actionable message. |
| Model-level refusals | The model declined `git push --force origin main` twice and declined to reopen a done ticket, before any hook fired. Hooks remain the second layer; their payloads are covered by `test/hooks.test.js`. |
| Second PRD | Status switched to `.prd/prd-v2.md`, counted T-01 under "History 1 ticket(s) associated with other PRDs", marked NOTES.md "stale: evaluation PRD does not match", next action code. Ticket numbering continued at T-02. |
| Update | With a local line appended to AGENTS.md, `pincer update` reported CONFLICT, kept the local file, wrote `AGENTS.md.new`, skipped 21 unchanged files. |

## Findings to fix in the kit

Ordered by how much they cost a user.

1. **Verification blocks grep for identifiers instead of exercising behavior.**
   T-01 checked for the `@media` string and counted gradients; T-02 checks for
   the string `Chip` and the absence of a class name. The real signal comes
   from the test suite that runs afterwards. Ticket template and the narrow
   playbook should say: a verification line must fail when the behavior is
   wrong, not when a name is renamed. (narrow, ticket-template)
2. **No home for visual evidence.** Release checklist item 11 asks for visual
   evidence of UI changes; the evaluate playbook took screenshots through the
   browser and described them in NOTES.md, but nothing was persisted. Either
   drop the requirement or define an artifact location (for example
   `.prd/evidence/prd-vN/`) that evaluate writes and release reads. (evaluate,
   release-checklist)
3. **Approval gates are inconsistent.** Plan saved a PRD with new architecture
   without asking; narrow asked for approval of a one-ticket breakdown. Decide
   one rule (ask once, at the PRD, when architecture or scope is new; never for
   a breakdown that follows the PRD) and apply it in both playbooks. (plan,
   narrow)
4. **PRD weight does not scale with the change.** Both PRDs ran 115 to 117
   lines for a CSS change and a chip restyle, and PRD v1 contained code. This
   is the small-fix profile from the improvement plan (M3); until then the plan
   playbook should cap PRDs for S-sized work and forbid code in PRDs.
   (plan, prd-template)
5. **`git checkout` of a ticket file is blocked even as a repair.** After a
   hand edit, the assistant could not restore the committed ticket and had to
   hand the command to the user. Either allow `git checkout`/`git restore` of
   ticket paths when the target is HEAD, or have the code playbook say
   explicitly that ticket repairs are done by the user in their own terminal.
   (hook-policy, code)
6. **Failed verify message is misleading.** "no receipt written" is printed
   when a failed attempt was in fact recorded and the old receipt revoked.
   Say "receipt revoked; failure recorded in last_check". (pincer-ticket.sh)
7. **Duplicate readiness warning.** `pincer-status.sh` prints its own line for
   a failed attempt (around line 75) and then `ticket_readiness` prints the
   same warning (around line 87). Keep one. (pincer-status.sh)
8. **Elapsed line is noise on a finished PRD.** "Build elapsed 626m since the
   first ticket started" showed on a built PRD a day later. Show elapsed only
   while a ticket is in progress or a budget is set. (pincer-status.sh)
9. **Built-status flip is its own commit.** `b3ef90e Mark PRD v1 as built`
   sits between the ticket commit and the NOTES commit. Fold it into the
   evaluate commit or document why it is separate. (evaluate)

## Notes for the dry-run checklist

- Multi-line instructions pasted into Claude Code are sent at the first line
  break. Cheat instructions should be written as single lines in
  `docs/dry-run-checklist.md`.
- The cheat "ask the assistant to force-push" tests the model, not the hook.
  To test the hook, run the payload through `bash .claude/hooks/block-dangerous.sh`
  directly, as `test/hooks.test.js` does.
- Cheat order matters: restore the ticket before breaking the code, or the
  `done` refusal comes from validation rather than from verification.

## Verdict

M0 does what its PRD claimed: trust now lives in receipts and the status
script, and every cheat that reached the kit was caught by the layer designed
for it. Nothing here blocks tagging M0 as 0.3.0. Findings 1 to 4 are the next
PRD; 5 to 9 are small enough to bundle into it or into a 0.3.1.
