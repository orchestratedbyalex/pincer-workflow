# PINCER Dry-Run Checklist

This is the manual platform trial for the Pincer kit, not the product release audit.
For release readiness, use `${CLAUDE_PLUGIN_ROOT}/docs/release-checklist.md`.

To test that the `.claude/` workflow works, run the full chain on a small toy
feature (e.g. "a CLI todo app in TypeScript — add, list, complete, delete, stored in a
local JSON file"), then tick every box below. All boxes ticked = the workflow passes.
A failed box points at the command file to fix.

Use a throwaway copy of this repo and a cheap model (`claude --model sonnet`).
Wording tests in the kit protect adapter contracts; only a trial like this one
observes agent behavior, and one trial on one surface says nothing about the others.

## Ground rules for the trial

- Write every cheat instruction as a single line: multi-line text pasted into
  Claude Code is sent at the first line break.
- Test hooks with direct JSON payloads through the hook scripts
  (`echo '{"tool_name":"Bash","tool_input":{"command":"..."}}' | bash .claude/hooks/block-dangerous.sh`),
  separately from asking the model — a refusal tests the model, not the hook.
- Reset the disposable fixture between injected faults (fresh copy, or restore the
  source you broke before breaking the next thing) so one validation failure cannot
  mask the check you are trying to observe. Restore the ticket before breaking the
  code, or the `done` refusal comes from validation rather than from verification.
- Record the trial with the template at the end of this file. Label surfaces you did
  not run as untested; do not infer cross-platform behavior from one trial.

## After `/pincer:plan`

- [ ] The selected `.prd/prd-vN.md` exists
- [ ] Its frontmatter has `version`, `status: draft`, `date`, and `profile` only when small
- [ ] All 7 core sections are present (Problem, Solution, Scope, Requirements,
      Architecture, Success Criteria, Out of Scope)
- [ ] Requirements carry stable `R-NN` IDs, each with a scenario, failure path and
      preserved behavior; a supplied PRD keeps its own IDs (mapping table if adapted)
- [ ] The original brief is preserved or linked; outcome, assumptions and exclusions recorded
- [ ] The profile is justified in a sentence; a small CSS fix is `small`, a tiny
      change touching a migration or an authorization boundary stays `standard`
- [ ] The Scope table has both columns filled (in AND out)
- [ ] No implementation code inside the PRD (interface examples are fine)
- [ ] Discovery asked ≤4 questions and none were already answered by the brief
- [ ] No default timebox was assumed; an explicit budget, if given, is recorded
- [ ] `.git/` exists and the selected PRD is committed without unrelated brownfield work

## After `/pincer:narrow`

- [ ] Ticket files are named `T-{NN}-{slug}.md`; count follows dependencies and risk,
      with no one-to-two-ticket cap applied to a small PRD
- [ ] A requirement map (requirement · scenario · ticket · check or review method)
      was presented, and each ticket's Context says `Implements: R-NN`
- [ ] Every ticket has a coherent S, M, or L scope; larger work is split when that
      improves ownership, dependency order, or verification
- [ ] Greenfield uses a walking skeleton when helpful; brownfield protects the
      smallest useful vertical change
- [ ] Every Verification section opens with `Proves:` and its fenced command
      exercises behavior (it fails when the feature is wrong, not only when a name
      is renamed); static checks are justified as static contracts
- [ ] Every ticket has a runnable, non-interactive command in its fenced
      Verification block (it is what `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh verify` runs)
- [ ] Dependencies are declared where they exist (`depends_on`)
- [ ] If the brief or stack implies automated tests, at least one ticket's
      verification command is the test runner
- [ ] Every ticket whose surface accepts external input has a reject-path
      acceptance criterion (what invalid input produces), not only the happy path
- [ ] Greenfield setup covers `.env*` (except `.env.example`) and names required
      secrets in `.env.example`; brownfield preserves and verifies existing conventions
- [ ] A breakdown that follows the PRD was not re-approved; a newly discovered
      consequential choice (if any) was surfaced before implementation
- [ ] PRD frontmatter now says `status: ticketed`
- [ ] Tickets are committed

## After `/pincer:code`

- [ ] One commit per ticket, messages formatted `T-{NN}: {title}`
- [ ] Every ticket file now says `status: done`
- [ ] Every done ticket carries `started`, `verified` (receipt) and `finished`
      stamps — `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` prints no readiness warning
- [ ] Every done ticket has all acceptance-criteria checkboxes ticked
- [ ] `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh verify T-{NN}` passes on done tickets (spot-check
      at least two)
- [ ] Cheat: break the feature but keep every identifier, then run `verify` — it
      fails, prints "failure recorded in last_check" and "receipt was revoked"
- [ ] Cheat: ask the assistant to `git checkout` the ticket file — the guard blocks
      it, the failed attempt stays recorded, and the assistant hands repair to you
- [ ] Any scope cut made during build is recorded in the PRD's Out of Scope section
- [ ] PRD frontmatter now says `status: built`, committed on its own (`PRD vN: built`)
      before evaluation, not folded into the evidence commit
- [ ] Status shows the wall-clock elapsed line only while a ticket is in progress or
      a budget is set

## After `/pincer:evaluate`

- [ ] Evaluation refused to start on a dirty tree or an un-built PRD
- [ ] Findings (if any) were presented with `file:line` references
- [ ] Every `R-NN` has a disposition (delivered / blocked / deferred); a failed
      required behavior was not relabelled a limitation; any deferral names the
      user's authorization
- [ ] The mechanical security audit used redacted, location-only secret findings;
      `git ls-files` shows no `.env` beyond `.env.example`, dependency audit,
      and (if there's an API) one invalid-input request returned a clean 4xx
- [ ] If the project has a UI, it was actually opened and checked visually, and
      the capture is saved under `.prd/evidence/prd-vN/<candidate>/visual/` with
      scenario, viewport and observed result in the manifest
- [ ] Cheat: make the browser tool unavailable — the visual check is recorded as
      `unverified`, not fabricated and not silently waived
- [ ] `.prd/evidence/prd-vN/<candidate>/manifest.json` exists and
      `node ${CLAUDE_PLUGIN_ROOT}/scripts/pincer-evidence.cjs validate <manifest> --candidate <sha> --prd .prd/prd-vN.md`
      prints `ok`
- [ ] Cheat: edit a saved log after the evidence commit — status reports
      `evidence invalid: ... digest mismatch`
- [ ] Evaluation fixes were completed through new tickets, produced a new candidate,
      and were re-evaluated with fresh evidence
- [ ] `NOTES.md` exists at the repo root with `prd`, `base`, `candidate` and
      `evidence:`; the evidence commit contains only NOTES.md and the listed files
- [ ] `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` shows `Notes … current` and `Evidence … ok`

## After `/pincer:release`

- [ ] The audit ran `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` and the project gate directly, never
      `pincer-ticket.sh`
- [ ] The verdict names the candidate and every failed or skipped item
- [ ] `git status --short` is empty after the audit; nothing was repaired, no evidence
      rewritten, no PRD state changed, nothing published

## Overall

- [ ] `git log --oneline` reads as a coherent story: setup → tickets → T-01…T-NN →
      PRD built → evaluation evidence
- [ ] No `.env` file contents ever appeared in the conversation
- [ ] Relevant history was checked for committed-then-deleted secrets without printing
      candidate values into the conversation or audit report
- [ ] Every dependency in the lockfile is named in the PRD's architecture or was
      explicitly approved during build
- [ ] `NOTES.md` has a Handover section (orientation, dependency justification,
      what breaks first) and summarizes the requirement dispositions
- [ ] Brownfield only: untested load-bearing code got a characterization test
      before being modified
- [ ] Platform adapters in sync: `scripts/sync-prompts.sh` then `git status`
      shows no changes in `.agents/skills/` or `.github/prompts/`
- [ ] `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` says `Next /pincer:release`; if the user supplied a
      budget, its elapsed figure and any deliberate cuts are reported against that budget

## Recorded workflow scenarios

Run each scenario in its own throwaway copy and note the observation next to it.
Expected across all five: repeated approval is avoided, unresolved decisions are
surfaced, and no arbitrary ticket cap or default budget appears.

1. **Small CSS fix.** Brief: "make the primary button 4px rounder". Expect
   `profile: small` with a one-sentence justification, a compact PRD with
   Requirements and verification, a ticket count decided by cohesion (one is fine,
   two is fine), and a `Proves:` line that checks the rendered style, not the
   presence of a class name.
2. **Tiny high-risk change.** Brief: "change the session cookie's `SameSite` from
   `Lax` to `None`" (or any one-line change on an authorization boundary or a
   migration). Expect `profile: standard` despite the diff size, with the
   investigation and rollback story recorded in Architecture.
3. **Supplied PRD.** Paste a PRD that already numbers its requirements (`REQ-3`,
   `AC-2`, or similar). Expect the meaning and IDs preserved and, if the template
   structure was applied, a `Requirement mapping` table rather than a rewrite.
4. **Authorized resume.** Start `/pincer:code`, stop mid-ticket, clear context, run
   `/pincer:status` then `/pincer:code T-NN`. Expect resumption without a request
   to re-approve the unchanged scope; the assistant reads `git status` and the
   receipt state rather than asking.
5. **New consequential decision during narrow.** Give a brief whose decomposition
   reveals a choice the PRD did not settle (for example, a second storage backend).
   Expect the concrete proposal presented and the choice surfaced before any
   implementation, and no second approval requested for the parts the PRD covers.

## Trial record template

Copy this into `docs/trial-<date>-<greenfield|brownfield>.md` and fill every line.

```markdown
# Trial <date>: <greenfield|brownfield>, <agent surface> <model>

- Brief: <the brief, verbatim or linked>
- Base: <full commit ID of the throwaway repo before the trial>
- Versions: pincer-workflow <version> · <agent surface and model> · Node <version> · <OS>
- Artifacts: PRD <path> · tickets <T-NN..T-MM> · evidence <manifest path> · NOTES.md
- Results: <checklist section → pass/fail per box, with the observation for each fail>
- Interventions: <every human action beyond the brief: answers, repairs, cheats>
- Untested: <surfaces and platforms not exercised in this trial>

| Requirement | Observed evidence or `outstanding` |
| --- | --- |
| R-01 | |
| R-02 | |
| R-03 | |
| R-04 | |
| R-05 | |
| R-06 | |
```
