# Pincer assessment — 5 September 2026

Pincer's strongest opportunity is **trustworthy delivery from an approved PRD to verified code across coding agents**. The current release is a compact workflow kit with useful automation, but its completion, preservation, and recovery guarantees are not yet dependable enough to support that positioning.

This review covers local v0.2.3 at commit `4d2cad6`. It is an assessment and proposal, not an approved implementation PRD. The working audience assumption is solo developers and small teams building and maintaining existing repositories. The companion [improvement plan](pincer-improvement-plan.md) describes the recommended sequence.

**What was examined and verified**

I read the installer, all six canonical playbooks, PRD/ticket templates, both lifecycle scripts, both hooks, agent rubrics, platform wiring, generators, tests, README, website copy, and relevant wiki decisions. I checked current primary documentation for comparable tools and agent hooks.

| Check | Result | What this establishes |
| --- | --- | --- |
| Existing `npm test`, Node 22.23.1 on macOS | Both test programs pass | The existing lifecycle and smoke assertions hold |
| Workflow status in this distribution repository | No PRD, tickets, or NOTES.md | There is no active Pincer delivery run to resume here |
| Regenerate adapters and plugin in a temporary copy | No content differences | Committed generated artifacts currently match their sources |
| Build a local npm tarball and install it into four temporary projects | Claude, Codex, Copilot, and all-platform installs pass `doctor` | Current package contents support fresh installation, including the canonical kit |
| Additional isolated failure probes | Failures reproduced below | Existing green tests miss material contract violations |
| Installed Codex CLI | 0.153.4; help exposes hook trust controls | Local CLI evidence supports investigating the outdated hook claim |

All failure probes used disposable projects. Destructive-command examples were only JSON input to the hook; those commands were never executed. No real secret files were read. These checks do not establish successful live agent execution of the full workflow, native Windows support, or comparative delivery performance. Those remain validation work.

**Architecture and strengths worth keeping**

| Layer | Current implementation | Assessment |
| --- | --- | --- |
| Distribution | Dependency-free Node installer; hash manifest in `.pincer.json` | Easy adoption; preservation logic needs repair |
| Workflow | Markdown under `template/.claude/commands/` | Understandable, reviewable, and usable without a service |
| Agent adapters | Generated Codex skills, Copilot prompts, Claude plugin | Good single-source discipline; platform semantics need stronger tests |
| Runtime | Bash ticket transitions, frontmatter parsing, status inference | Useful starting point; too little state to represent real delivery |
| Quality | Ticket commands, review rubric, release checklist | Sensible intentions; weak evidence provenance and incomplete release coverage |
| Safety | Project rules, Claude deny rules and regex hooks | Defense against common mistakes; claims exceed current coverage |

The sequence is memorable. Explicit scope cuts, dependency order, a runnable check per ticket, characterization tests for unprotected brownfield code, visual inspection, and handover notes are good defaults. Plain files and Git make the workflow inspectable. These are advantages to preserve during hardening.

**Confirmed defects, in repair order**

Priority describes product urgency: P0 blocks a trustworthy maintenance release; P1 materially undermines normal delivery; P2 causes friction or incomplete coverage.

| ID | Priority | Finding and observed behavior | Evidence |
| --- | --- | --- | --- |
| A01 | P0 | **Updates can overwrite local customizations.** After a conflict, the manifest records the user's edited file as the baseline. The next update treats that customization as untouched and replaces it. A pre-existing brownfield `AGENTS.md` is also overwritten by the first update after an init conflict. | `bin/pincer.js:88–95`; reproduced both sequences |
| A02 | P0 | **A failed verification does not revoke an earlier passing receipt.** A green run, a source regression, and a red run are followed by a successful `done`. | `template/scripts/pincer-ticket.sh:92–120`; observed exit codes `0 → 1 → 0` |
| A03 | P1 | **Receipts describe the command text, not the implementation.** Changing source after a passing run still allows `done`, with the same verification command subsequently failing. The code playbook asks the agent to reverify, but the runtime does not enforce it. | `template/scripts/pincer-ticket.sh:67,119–120`; `template/.claude/commands/pincer-code.md:52`; reproduced |
| A04 | P1 | **A new PRD inherits old delivery state.** With completed v1 tickets and an old `NOTES.md`, adding a draft v2 produces `Next /pincer-release`. No relation ties tickets or evaluation to a particular PRD revision. | `template/scripts/pincer-status.sh:35,46,93–109`; reproduced |
| A05 | P1 | **A failed recheck of a completed ticket disappears from status.** The command fails, but the historical receipt remains and status still reports done with no warning. | `template/scripts/pincer-ticket.sh:97–108`; `template/scripts/pincer-status.sh:61–65`; reproduced |
| A06 | P1 | **The runtime can start work without a PRD or approval.** Dependency completion is checked, but PRD existence, revision, and approval are not. This is a gap between the project rules and mechanical enforcement. | `template/scripts/pincer-ticket.sh:76–89`; reproduced start with no `.prd/` |
| A07 | P1 | **Normal formatting can bypass acceptance checks.** An indented unchecked Markdown criterion is ignored and the ticket closes. Missing acceptance sections also have no explicit validation. | `template/scripts/pincer-ticket.sh:69–74,121–122`; indentation case reproduced; missing-section case established from code |
| A08 | P1 | **Destructive-command detection misses common syntax.** Serialized `git push --force` is allowed, while the form with a following argument is blocked. Reversed removal flags and a quoted absolute path also pass. Raw JSON matching causes the terminal-flag error. | `template/.claude/hooks/block-dangerous.sh:7–15`; payload-only probes |
| A09 | P2 | **The ticket hook does not protect all state changes.** It allows changing `status: done` to `status: open`, and deleting a receipt. It checks replacement content rather than the state transition. Its broad shell exemption is already acknowledged in the wiki. | `template/.claude/hooks/ticket-guard.sh:40–60`; reset/deletion payloads reproduced |

The A01 smoke test exercises only one update after editing. The A02 lifecycle test exercises failure before the first success, rather than failure after success. Adding realistic sequences will provide more value than increasing assertion counts around the same happy paths.

**Structural gaps that prevent Pincer from being a strong PRD-driven product**

1. **Requirements are not durable entities.** The PRD has a useful success-criteria table, but no stable requirement IDs, scenarios, priorities, or explicit mapping to checks. Ticket context contains a prose PRD-section reference. A reviewer cannot reliably ask which approved requirement is unimplemented, which test proves it, or which requirement changed after approval. See `template/.claude/references/prd-template.md:35–39` and `template/.claude/references/ticket-template.md`.

2. **The product contract is too thin.** A two-page cap and a roughly twenty-minute planning phase can squeeze out users' workflows, examples, assumptions, constraints, failure behavior, and relevant nonfunctional requirements. Architecture gets substantial space before the quality of the requirements is checked. Short PRDs should be supported, with depth determined by uncertainty and risk. See `template/.claude/commands/pincer-plan.md:8–9,18–64`.

3. **The lifecycle models one short build.** Global `.prd/`, `tickets/`, and `NOTES.md` lack a change identifier, base commit, evaluation target, or release record. The three ticket states cannot express cancellation, supersession, or a deliberate pause. Build elapsed time includes overnight pauses and previous changes because it is measured from the earliest ticket start to now. See `template/scripts/pincer-status.sh:44–89`.

4. **Changing the plan mid-build has no coherent transition.** Code says to stop and update a wrong plan, while Plan refuses when tickets are in progress. Scope cuts are appended to the PRD, but there is no cancelled-ticket transition to unblock Evaluate. Plan initially requires immutable versions, then its writing step hardcodes `prd-v1.md`. See `template/.claude/commands/pincer-code.md:62–67`, `pincer-plan.md:14–16,68–79`, and `pincer-evaluate.md:13–16`.

5. **Release audits a workflow demonstration, not a release candidate.** The checklist requires a first commit containing the PRD, 4–7 tickets, and a scaffold ticket, which do not generalize to an existing repository or a small fix. Release checks at least two tickets, permits stage-limited audits, and still uses a general PASS verdict. There is no executable release command, durable verdict tied to a commit, or distinction between partial validation and readiness. See `template/.claude/commands/pincer-release.md:15–30` and `template/docs/dry-run-checklist.md`.

6. **Review and staging boundaries are ambiguous.** Evaluate asks for `git diff <first-commit>..HEAD` without recording the base. Code recommends `git add -A`, which can include unrelated existing work. Its security grep only sees unstaged tracked changes and prints matching values; Evaluate's history grep can also expose exactly the secrets the rules prohibit printing. Use scoped staging and redacted findings. This conclusion comes from the prescribed commands, not from inspecting real secrets. See `template/.claude/commands/pincer-code.md:43–56` and `pincer-evaluate.md:16,26–32`.

7. **Verification quality remains mostly assumed.** Any command returning zero can create a receipt. The system does not know whether tests actually ran, assertions cover the requested behavior, or all release-critical scenarios passed. A receipt proves execution under stated conditions; it cannot prove that an inadequate check establishes the requirement. Requirements review, meaningful behavioral tests, and selected fault-injection cases are necessary alongside runtime enforcement.

8. **Approval friction is high but approval persistence is low.** Discovery confirmation, architecture approval before writing the PRD, ticket approval, and another confirmation before coding fragment the flow. None is stored against a content revision. Build a concrete proposal first, capture approval of its scope and design, and reuse that approval until a material change occurs. See `pincer-plan.md:30,62`, `pincer-narrow.md:47`, and `pincer-code.md:24`.

9. **Adapters preserve text more reliably than behavior.** Codex generation instructs the agent to ask for arguments when none are supplied, even for commands whose arguments are optional. The status script prints slash syntax and the status skill says to quote it verbatim. The plugin references project `AGENTS.md` but only optionally supplies it through separate user setup; its checklist also requires a sync script the plugin does not bundle. Fresh installation is not equivalent to a successful end-to-end workflow. See `template/scripts/sync-prompts.sh:32`, `template/.claude/commands/pincer-status.md:15–16`, `plugin/commands/code.md:31`, and `plugin/docs/dry-run-checklist.md:74`.

10. **There is no committed CI workflow or behavioral benchmark.** The package runs two test programs. Generation consistency, packed-artifact installs, agent sessions, migration history, interruptions, and multiple PRDs lack an automated release gate. The repository's own next work is not represented as a Pincer PRD and tickets. It should become the reference example after approval.

**Current landscape and implications**

This is a comparison of documented capabilities, not a head-to-head execution benchmark. It does not establish that any tool produces better code.

| Tool | Relevant documented capability | Implication for Pincer |
| --- | --- | --- |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | Structured specification, planning and tasks; clarification, requirements checklists, and cross-artifact analysis | PRD templates and stage commands alone are insufficient differentiation |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec/blob/main/docs/overview.md) | Persistent capability specs, change folders, requirement deltas, and archival back into current specs | Handle change over time and preserve product intent across releases |
| [Kiro](https://kiro.dev/docs/specs/) | Feature and bugfix specs, requirements analysis, a quick path, and property-based testing on supported surfaces | Adapt effort to change type and invest in acceptance quality |
| [BMad](https://docs.bmad-method.org/) | Separate exploration/planning skills, small-change building, larger-work planning, and existing-code context | Support uncertain ideas and small fixes without forcing every task through identical ceremony |

The conclusion is an inference: Pincer's most credible differentiator is a small, inspectable delivery runtime that maintains requirement-to-evidence continuity and makes failures visible across agent handoffs. It must demonstrate this advantage in comparable tasks.

**Platform findings verified against current documentation**

The statement that Codex has no PreToolUse hooks is outdated. Official documentation describes tool hooks, project-local configuration, and trust review for changed hooks. Pincer should test a versioned adapter and expose trust/enabled status; simply copying the Claude hook is insufficient. Codex's documentation also says some specialized tool paths can bypass normal hook coverage, so hooks should not be advertised as a complete security boundary. [Official Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).

The current repo-local Codex skill location is consistent with the official skills documentation. [Official skill discovery documentation](https://learn.chatgpt.com/docs/build-skills).

VS Code documents PreToolUse hooks under `.github/hooks`, currently in Preview and subject to organizational policy. Treat VS Code, Copilot CLI, and the hosted coding agent as separately tested surfaces. This review verified VS Code documentation; it did not establish equivalent support across every Copilot product. [VS Code hook documentation](https://code.visualstudio.com/docs/agent-customization/hooks).

**What “best” should mean**

An approved requirement has a visible disposition: delivered with current evidence, explicitly deferred, or blocked. A fresh agent resumes the correct change without reconstructing intent from chat. A red or stale check prevents a release verdict. A small fix remains quick. Existing project rules survive upgrades. The same core invariants hold across supported agents, with honest reporting of differences in platform enforcement.

Pincer has a credible starting point for that product. The next step is to repair the demonstrated failures, then build and measure those guarantees in the order proposed in the [improvement plan](pincer-improvement-plan.md).
