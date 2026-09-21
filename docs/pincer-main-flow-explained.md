# Pincer's main flow, explained for junior developers

This is a step-by-step companion to [pincer-main-flow.mmd](diagrams/pincer-main-flow.mmd). It covers every box and decision in that diagram. The [workflow guide](pincer-workflow-guide.md) renders the main diagram and the three supporting diagrams.

PINCER stands for **Plan, Investigate, Narrow, Code, Evaluate, Release**. Investigation is part of the planning command. The workflow helps a developer and a coding agent agree on the work, implement it in small pieces, and keep proof that the result meets the agreement.

Throughout this guide, imagine adding a **task-title editor** to an existing app. A user should be able to rename a task, save it, and see the saved title after refreshing. Empty titles should be rejected. This example illustrates the process; it does not authorize changes to any project.

## How to read the diagram

- Rectangles describe work to do.
- Diamonds ask a question. Follow the arrow with the matching answer.
- Boxes with double sides send you to a more detailed diagram.
- Arrows that go backward mean something needs revision or another check.
- The green endpoint means ready for a release decision. Publication is a separate action.

The diagram summarizes the workflow for projects with registered changes. Older installations may need migration; follow the runtime's status and recovery instructions rather than editing state files yourself.

## Words you will encounter

| Term | Plain-language meaning |
| --- | --- |
| PRD | Product requirements document: what the change must do, its constraints, and how success will be judged. |
| Requirement and scenario | A promised behavior and a concrete situation that exercises it, usually identified as `R-NN` and `S-NN`. |
| Ticket | One manageable, verifiable piece of implementation work. |
| Change | The registered collection of a PRD, its tickets, decisions, and lifecycle state. |
| Acceptance criteria | Specific statements that must be true before a ticket is done. |
| Verification | Running a ticket's declared check and recording the actual result. |
| Coverage map | Explicit links between scenarios, implementation tickets, and checks or reviews. This is different from a percentage of code lines tested. |
| Candidate | The exact committed version being evaluated, identified by a Git commit ID. |
| Evidence | Saved test logs and review artifacts associated with that candidate. |
| Gate | A condition that must be satisfied before the workflow can advance. |

## 1. Idea, bug, or feature

Start with the problem and the desired outcome. You do not need a complete technical solution yet. Explain who needs the change and what is wrong or missing today.

**Example:** “People cannot correct a task title after creating it. Let them edit and save it.” This is enough to begin planning, but it leaves questions about validation and saving behavior.

## 2. Install Pincer in the project

For a new project installation, run `npx pincer-workflow init` in the project directory and select your coding platform. The package requires Node.js 22 or later. Installation adds the workflow instructions, templates, and scripts used by later stages.

If Pincer is already installed, inspect the existing installation instead of blindly reinstalling it. Installing or updating the kit is different from implementing your feature.

## 3. Read status and saved work

Use `/pincer-status`, or run `bash scripts/pincer-status.sh` in an installed project. Read the current PRD, ticket states, selected change, saved review information, and reported next step.

This prevents starting a duplicate feature or overlooking unfinished work. Also inspect Git status so existing uncommitted work is understood and preserved.

## 4. Continue an existing change?

Choose **Yes** when this request continues work already recorded in the project. Follow step 5. Choose **No** for a new change and continue to step 6.

A new conversation does not necessarily mean a new change. For example, returning tomorrow to finish the title editor should normally resume its existing tickets.

## 5. Follow recovery chart 3

Use [chart 3 in the workflow guide](pincer-workflow-guide.md#3-decisions-stopping-and-coming-back-later). For projects with change records, `node scripts/pincer-runtime.cjs resume --brief` reports the current situation and next action.

Select the intended change, read its authorization and lifecycle state, and follow the report. A check that is still running must not be treated as an abandoned check. Interrupted work may need recovery; completed work may need reopening; changed scope may need a new decision. Keep previous results as history.

When implementation can continue, return to the ticket loop in step 22. If the report directs you to another stage, follow that instruction rather than assuming you must write more code.

## 6. PLAN: write what success means

Use `/pincer-plan` to turn the request into a PRD. Describe observable behavior clearly enough that someone else can decide whether it works. Planning depth should match the uncertainty and risk.

**Example:** a valid title is saved, refreshing retains it, and an empty title shows a useful error without replacing the old title. “Make editing work well” is too vague to check.

## 7. INVESTIGATE: read code, test risks

Read the existing implementation, relevant tests, and project conventions. Find where the change belongs and what could break. Test important assumptions before building a plan around them.

**Example:** find the task model, update endpoint, validation rules, and UI form patterns. Check whether the existing tests actually pass. If persistence behavior is unclear, investigate it before promising that a rename survives a refresh.

## 8. Write the plan, limits, and exclusions

Save the plan in a PRD such as `.prd/prd-vN.md`, using the next appropriate version. Include scope, architecture, success criteria, relevant security and visual requirements, assumptions, and explicit exclusions.

**Example:** editing a single task title is included; bulk renaming and task-history browsing are excluded. Exclusions make the boundary clear. Removing something previously promised requires the user's scope decision.

## 9. Scope and design already allowed?

Check whether the user's actual instructions already authorize the proposed scope and important design choices. If **Yes**, continue to Narrow. If **No**, show the concrete proposal in step 10.

Permission can carry across sessions when it is recorded and still applies. A passing test or an agent-written “approved” label does not create permission.

## 10. Show the proposal and ask the user

Explain the unresolved choice, your proposed solution, and its consequences. Ask only about decisions that remain open. After approval or revision, update the plan and check that the resulting scope is covered.

**Example:** if saving immediately on every keystroke would change cost or behavior, settle that choice before implementing it. If the proposal is declined, revise it or wait; there is no automatic permission to proceed.

## 11. NARROW: split into ordered tickets

Use `/pincer-narrow` to divide the PRD into coherent pieces that can each be verified. Order them by dependencies and preserve existing ticket numbers and history.

**Example:** first implement title validation and persistence, then add the editor UI that uses that behavior. A ticket should be small enough to understand, but large enough to prove a meaningful result.

## 12. Give each ticket a test and success checks

Write acceptance criteria and a runnable Verification block for each ticket. Its `Proves:` explanation should say what behavior the check establishes. The command must be non-interactive and fail when the promised behavior is wrong.

**Example:** check that a valid rename persists and an empty title is rejected without changing saved data. A successful build alone does not demonstrate those behaviors. Visual judgment belongs in the later review as well.

## 13. Register and select this change

Registration creates the tracked change record linking the work to its PRD. Selection tells this particular working copy which change it is operating on. Use the runtime commands prescribed by the Narrow playbook.

These are different concepts: a repository can contain several change records, while your working copy selects the one you intend to work on. Registration and selection do not authorize implementation.

## 14. Use strict coverage?

Choose **Yes** to adopt a machine-validated map of scenarios, tickets, and checks. Continue through steps 15–18. Choose **No** to use the ordinary workflow in step 19.

Strict coverage makes omissions explicit. It does not establish that every test is well designed; someone still needs to judge whether each check proves the intended behavior.

## 15. Draft links: each goal to tickets and checks

The coverage scaffold produces a read-only draft inventory and unresolved items. Use it to see what still needs to be linked. It does not write or adopt the final map, invent a test, or grant approval.

**Example:** connect the “empty title is rejected” scenario to its implementing ticket and the declared rejection-path check. A ticket merely claiming a requirement is not enough to establish that link.

## 16. Review gaps and author the real map

Author `.prd/coverage/<change id>.json` using the documented schema. Cover every scenario and ticket, identify checks, and explain tickets that enable other work rather than directly implement a requirement.

If a scenario is deferred or removed, record the user's actual decision and its scope disposition. Do not quietly drop a difficult scenario to make the map complete.

## 17. Map valid and complete?

Have the runtime validate the map. If **No**, return to step 16 and resolve the named gaps. If **Yes**, continue to adoption.

Structural validity means the required records and links are consistent. Reviewers must still assess semantic adequacy: does the linked check actually exercise the scenario?

## 18. Preview and adopt the map

Preview coverage adoption before applying it, using the commands in the Narrow playbook. Inspect the inventory and agreement that adoption will record, then apply the intended map.

Adoption updates the change record and its agreement. It grants no permission by itself. Continue to step 20 to record authorization for the resulting agreement.

## 19. Use normal checks; strict coverage unverified

Without strict adoption, continue with ticket verification and candidate evaluation. Requirements still need review and evidence under the ordinary workflow.

Report strict coverage as unverified. This label describes the absence of strict adoption; it does not mean that ordinary tests automatically failed or that requirement review can be skipped.

## 20. Record permission for this exact plan

Use the runtime to bind the user's real authorization to the current agreement. Retain the reference and the user's words, or the basis of an explicitly delegated decision. Reuse authorization that already covers this work.

An agreement digest is a fingerprint of the agreed inputs. If those inputs change, the runtime can detect that the recorded authorization no longer matches. Never invent an approval excerpt or treat writing a record as human approval.

## 21. Activate the change

Activate the selected, authorized change through the runtime. This moves it into the state where ticket implementation can proceed. A paused change follows the resume path instead.

If activation is refused, read the reason and resolve it. Do not edit lifecycle fields manually to bypass a missing authorization or unresolved decision.

## 22. CODE: ticket loop in chart 2

Use `/pincer-code` and [chart 2](pincer-workflow-guide.md#2-how-one-ticket-gets-implemented). For each ticket, confirm prerequisites, start it through the runtime, implement the behavior, run verification, and review the diff. Tick only acceptance criteria that have actually been established, then mark the ticket done through the runtime and commit its files.

If self-review changes the code, verify again. If a check fails or cannot run, preserve that result and resolve the cause. If a new material scope decision appears, follow the decision/recovery path. Repeat until the required tickets and checks are current.

## 23. Complete the change and commit built state

After the ticket work is finished, use the runtime's completion operation and save the PRD's built state, following the Code playbook. Commit the resulting tracked changes.

“Ticket done” describes one piece of work. “Change completed” means the whole change is ready for evaluation. Neither means published, and neither replaces the evaluation stage.

## 24. Choose a clean, saved code version

Select the exact committed candidate to review, including implementation, ticket closures, change completion, and PRD built state. The working tree must be clean. Record the candidate commit ID and the actual base commit from before the change.

This gives the review a precise subject. “The latest code” is ambiguous once someone makes another edit; a full commit ID is not.

## 25. EVALUATE: tests, code, goals, UI, security

Use `/pincer-evaluate`. Review the change against the PRD, run the required checks, inspect code quality, and review security behavior. For a UI, open the app and inspect it rather than relying only on source code.

**Example:** demonstrate editing and refreshing a title, try empty input, inspect the error state, and check that unrelated task behavior still works. Record anything blocked or unverified honestly. A tool that cannot run provides no passing result.

## 26. Save test logs and review results for this version

Retain the actual logs and review artifacts, export or author evidence using the applicable runtime/playbook path, and validate its manifest. Save `NOTES.md` with the candidate, base, and evidence references.

Evaluation evidence is stored under `.prd/evidence/`; local runtime attempts live under the ignored `.pincer/runtime/`. Commit the permitted evidence and notes. A later evidence-only commit is supported, but source or other candidate-input changes require reevaluation. Manifest validation checks consistency; it cannot establish that an invented test result really happened.

## 27. Required proof passes and matches this code?

Check both the outcome and its freshness. Required checks must pass, required reviews must be present, and the evidence must refer to the evaluated candidate. A result from an older implementation does not prove the new one works.

If **Yes**, proceed to Release. If **No**, return to implementation through step 28. An explicitly authorized scope revision must also be reflected in the plan and evaluated candidate; it is not a way to silently relabel failure as success.

## 28. Reopen work and create a fix ticket

Follow the runtime's reopening process and create a ticket for the discovered defect. Preserve the old failure and evaluation as history. Return to the Code loop, then complete the work, select a new candidate, and evaluate again.

**Example:** evaluation finds that refreshing restores the old title. Add a regression check for persistence and fix the implementation. Do not edit the previous report into a pass.

## 29. RELEASE: read-only audit and project checks

Use `/pincer-release` to audit the workflow artifacts and run the project's candidate-wide release gate. Check ticket readiness, authorization, completion, candidate-bound evidence, applicable coverage obligations, and a clean working tree.

This stage reports results. It does not fix source code, rewrite receipts, repair evidence, or publish. In particular, release does not run ticket verification commands that write new runtime results; follow the Release playbook's allowed checks.

## 30. Audit passes and files stay unchanged?

If **Yes**, proceed to the release decision. If **No**, route the failure in step 31. Check the working tree before and after the audit: even a successful command invalidates this audit if it changes candidate files.

**Example:** a project check unexpectedly rewrites a tracked generated file. The audit cannot pass on the claim that it tested an unchanged candidate. Investigate and return through the appropriate stage.

## 31. Report failure and return to the responsible stage

Name the failed condition, retain the real output, and identify where the repair belongs. Missing authorization or changed scope goes back to the decision process; a code defect goes to Code; missing or stale review evidence goes to Evaluate.

The diagram ends this branch at routing because the correct destination depends on the failure. Repairs that change candidate inputs need a new candidate and evaluation before another release audit.

## 32. Ready for a release decision

A passing audit means the named candidate satisfied the applicable workflow checks. Present the result, evidence, and remaining disclosed limitations so the person responsible for release can make the decision.

This is a readiness statement. It is not a guarantee that software has no bugs, that a human review was infallible, or that anything has already been deployed.

## 33. Merge or publish only under separate authorization

Carry out the intended merge, deployment, or package publication only when the user's instructions authorize that action. Existing explicit authorization may already cover it; do not ask again for the same permission.

These operations have distinct results. A local commit saves work locally, a push sends commits to GitHub, a merge updates the target branch, and an npm publish makes a package version available in the registry. Verify the actual destination after the authorized action. Release PASS alone performs none of them.

## Commands at a glance

These are the project-local Claude command names. On Codex, use the corresponding `$pincer-*` skills. The Claude plugin uses names such as `/pincer:plan`. Follow the installed platform's adapter.

| What you need | Command |
| --- | --- |
| Understand current work and next action | `/pincer-status` |
| Define and investigate the change | `/pincer-plan` |
| Create verifiable tickets | `/pincer-narrow` |
| Implement or resume tickets | `/pincer-code` |
| Review the completed candidate | `/pincer-evaluate` |
| Audit release readiness | `/pincer-release` |

For exact runtime commands and record formats, consult the source playbooks: [Plan](../template/.claude/commands/pincer-plan.md), [Narrow](../template/.claude/commands/pincer-narrow.md), [Code](../template/.claude/commands/pincer-code.md), [Evaluate](../template/.claude/commands/pincer-evaluate.md), [Release](../template/.claude/commands/pincer-release.md), and [runtime contracts](../template/docs/runtime-contracts.md).
