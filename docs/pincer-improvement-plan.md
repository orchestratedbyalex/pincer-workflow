# Pincer improvement plan — proposed

Prepared 5 September 2026 against v0.2.3. The user authorized starting M0 on 5 September, with greenfield and brownfield support both required. Later milestones remain proposals; publishing is separate. Findings and validation limits are recorded in the [assessment](pincer-assessment-2026-09-05.md).

**Recommended product direction**

Make Pincer the lightweight, agent-independent workflow that carries an approved product requirement all the way to reviewable evidence for the software being released. Greenfield and brownfield projects are equal requirements. Support individual developers and teams of any size; scale coordination and approval policy to the work rather than imposing a team-size limit.

Larger teams can already use Pincer with Git branches, PR reviews, and their existing CI. Current limitations concern concurrent change identity, ticket ownership, durable approval provenance, and verification of the integrated result. The runtime roadmap must preserve a path to those capabilities. Team size and project maturity are separate dimensions: a large team can start a new system, and one developer can maintain a complex existing system.

Keep the PINCER sequence, Markdown artifacts, Git history, and local operation. Add a dependable runtime beneath the playbooks. Product understanding, safe change management, and evidence quality should drive the roadmap. More agent personas or integrations should earn priority through measured delivery improvements.

The promise should be concrete: **“Know what was agreed, what changed, what passed, and what remains.”**

**The intended experience**

1. The user describes a change or supplies an existing PRD. Pincer identifies the relevant repository context, existing requirements, and uncertainty. It preserves the original brief and records assumptions.
2. Plan produces a reviewable PRD with requirement IDs, scenarios, scope, and the necessary design decisions. It asks only questions that materially affect the result. Risk determines the depth of investigation.
3. Narrow links each requirement to work and verification. A consistency check identifies gaps, conflicting requirements, impossible dependencies, and unexplained work before approval.
4. Approval is recorded against the concrete revision and breakdown. Code proceeds within that authorization. Routine resume or verification does not request the same approval again.
5. Each ticket has fresh execution evidence and a clear implementation diff. A changed requirement, failed check, interruption, or changed source updates its readiness visibly.
6. Evaluate records coverage, findings, relevant UI evidence, and any explicitly accepted limitations against the candidate revision. Fixes follow the same ticket and verification mechanism.
7. Release checks all required evidence for that candidate and writes a durable verdict. Publishing or merging remains a separate authorized action. The next change starts with preserved product knowledge and a clean lifecycle.

**Requirements and traceability**

The PRD should remain readable prose. Add enough structure to answer concrete questions without turning it into a form-filling exercise.

| Artifact | Minimum useful contents | Why it exists |
| --- | --- | --- |
| Product context | Users, product goals, architecture constraints, established behavior, links to decisions | Avoid rediscovering the product for every change |
| Change PRD | Stable ID and revision; problem; scope; requirement IDs and priorities; behavior examples; success measures; assumptions | Define the agreement for this change |
| Technical plan | Affected components, contracts, risks, validation, migration/rollback where relevant | Explain how the agreement can be delivered; keep it in the PRD for small work |
| Ticket | Change/revision reference, requirement IDs, objective, dependencies, intended files, acceptance criteria, check IDs | Bound implementation and expose uncovered scope |
| Verification evidence | Check identity, command digest, input/source identity, timestamps, exit/result, safe diagnostic summary | Record what actually ran and on which inputs |
| Evaluation and release | Candidate commit, requirement dispositions, review findings, required checks, exceptions, verdict | Make the release decision reproducible |

Example of the proposed mapping:

| Requirement | Work | Evidence | Release disposition |
| --- | --- | --- | --- |
| `R-001`: Preserve project rules through repeated updates | `T-01`: repair installer conflict tracking | `V-001`: existing file → init conflict → repeated updates; contents preserved | Delivered only when the check passes on the candidate |
| `R-002`: A failed check prevents completion | `T-02`: revoke stale verification | `V-002`: green → source regression → red → completion refused | Blocked while red |

Validation should reject missing or duplicate IDs, invalid references, dependency cycles, uncovered required criteria, malformed verification definitions, and scope changes without a disposition. Semantic ambiguity and adequacy of a test remain review judgments; label them that way. A mapped requirement is not automatically a satisfied requirement.

**Proposed architecture**

Use the existing Node CLI as the entry point for a shared local runtime. Move parsing, transitions, evidence validation, and status computation into testable modules. Keep old shell entry points as compatibility wrappers during migration. Both the npm package and Claude plugin must bundle a pinned copy of the same runtime; document the plugin's Node prerequisite instead of assuming a global `pincer` executable.

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Artifact loader and validator | Parse declared schemas, resolve IDs, validate relationships | No arbitrary file traversal; precise diagnostics for unsupported input |
| Change and ticket lifecycle | Approvals, transitions, pause/reopen/cancel/supersede, active-change selection | One authoritative writer; locking and atomic replacement |
| Verification runner | Execute reviewed check definitions; record success, failure, interruption and timeout | Explicit working directory and runner; retain host sandbox and approval controls |
| Evidence validator | Compare requirements, ticket/check definitions, source identity, and candidate | Fail closed on stale, absent, malformed, or incompatible evidence |
| Git integration | Record base/candidate, identify relevant diff, scope staging, support worktrees | Never include unrelated dirty work automatically |
| Agent adapters | Native commands/skills, invocation syntax, hooks, contextual instructions | Translate platform events into shared operations; avoid separate policy implementations |
| CLI reporting | Human output plus structured `--json` for status, next action, validation, coverage and audit | No LLM required to inspect or validate state |

Keep `.prd/` and `tickets/` compatible initially. Add change IDs and explicit artifact references before moving directories. A later change-folder layout can be migrated with a preview and backup once real multi-change use justifies it. The runtime must never infer the active change solely from the highest PRD version or a root-level notes file.

Markdown remains authoritative for requirements and authored ticket content. Runtime-owned metadata describes lifecycle state; structured evidence files describe verification attempts. Computed coverage/status reports are projections, not independently editable truth. Schema versions are separate from the npm package version. Use one well-tested parser strategy and validate its supported syntax; do not expand ad hoc shell parsing to emulate general YAML or Markdown. The implementation PRD should settle the parser dependency, if any, before installation.

**Evidence design decisions**

The current command hash is insufficient. A successful verification needs a check-definition digest, approved requirement/ticket revision, and a reproducible source identity. For a workspace check, include tracked source and relevant nonignored new files, plus tests, lockfiles, and configuration. Explicitly exclude runtime receipts and declared generated outputs so recording evidence does not invalidate itself. Never hash secret-file values into reports.

Conservatively invalidate workspace evidence on source changes at first; optimize to narrower dependency scopes only when their correctness can be demonstrated. A before/after check should detect unexpected source mutation during verification. A failing or interrupted attempt immediately supersedes any claim that the latest attempt passed. Historical successes remain historical evidence.

Ticket closure verifies the final workspace snapshot. Release runs required candidate checks against the committed source and records that commit separately; hashing HEAD alone before the ticket commit would create a self-invalidating loop. Environment-dependent checks must report their environment and limitations. Stale evidence is a state, not a warning buried in prose.

Local files and hashes provide provenance and mistake detection, not tamper-proof attestation against an actor who can rewrite the runtime. Local approval records must reference explicit user authorization; invoking an approval command is not evidence of an independent human identity. Teams needing independently enforceable approvals should use protected review/CI identities in a later integration.

**Delivery sequence and exit gates**

These are milestone boundaries, not calendar promises. Plan and approve each implementation PRD separately, using Pincer itself. Re-estimate after the first milestone rather than force the roadmap into the current 75-minute build budget.

| Milestone | Deliverable | Exit gate | Depends on |
| --- | --- | --- | --- |
| M0 — Repair trust | Safe repeated updates; honest verification failure; conservative closure/recovery; validated acceptance syntax; corrected guard/docs behavior; CI | Every reproduced regression has a passing prevention test; packed installs and generated parity pass | Existing v0.2.3 |
| M1 — Reliable runtime | Shared Node core; validated metadata; explicit change/revision/base; durable approval and evaluation references; atomic transitions; source-bound evidence; JSON status | Missing approval, stale source, red checks, interrupted transitions, and wrong-change artifacts cannot yield ready status | M0 |
| M2 — PRD continuity | Requirement IDs and scenarios; import/review of supplied PRDs; requirement-to-ticket-to-check mapping; change impact; explicit cancellations and deferrals | Every required criterion is covered or explicitly dispositioned; a changed requirement identifies affected work and evidence | M1 |
| M3 — Adaptive workflow and parity | Fix/feature/high-risk planning profiles; useful resume context; tested native adapters; safe project-rule integration; candidate release audit | Full change, interruption, revision, and release scenarios pass on each claimed platform/version | M1 and M2 |
| M4 — Prove the advantage | Repeatable benchmark suite, real-project pilots, published methodology and limitations, adoption documentation | Better measured delivery outcomes against the chosen baselines without unacceptable setup or approval overhead | Start fixtures in M0; performance claims after M3 |

M0 should ship as a focused maintenance release. M1 and M2 provide the fundamental product upgrade. M3 makes it comfortable across real projects. The benchmark begins early enough to detect regressions during development.

**First implementation PRD: “Preserve user work and report completion honestly”**

Prepare this PRD next, after agreeing the direction. Keep it independent of the larger runtime migration. The following are proposed work packages, not approved ticket files or promises that each fits an S/M timebox.

| Work package | Scope | Acceptance evidence |
| --- | --- | --- |
| 1. Preserve installer baselines | Keep the last Pincer-owned baseline separate from local content and pending upstream content; never adopt a conflict as permission to overwrite | Repeated updates, brownfield init conflicts, resolved conflicts, untouched updates, and existing `.new` edits preserve the correct contents |
| 2. Revoke invalid verification | Persist latest attempt outcome; revoke successful readiness before a new attempt; handle failure/interruption; perform a fresh final check at closure as an interim safety measure | Green → red → done is refused; source changed after verification cannot close on the old result; interruption cannot reuse success |
| 3. Validate ticket input | Require valid frontmatter, supported statuses, a nonempty acceptance section and a valid verification block; recognize supported checkbox syntax | Indented unchecked criteria, missing sections, malformed metadata, duplicate IDs and ambiguous files fail with actionable errors |
| 4. Correct immediate recovery errors | Require a usable PRD before start; persist a minimal PRD reference for new tickets; reject ambiguous legacy associations; prioritize draft/new PRDs over old notes | A new draft never inherits release readiness; a failed done-ticket recheck appears in status; legacy state needs explicit resolution rather than guessed approval |
| 5. Repair guard and playbook contracts | Parse hook JSON before matching; cover documented common command forms and state deletion/reset; remove raw-secret-output scans and broad staging advice; fix PRD version and optional-argument instructions | Payload fixtures demonstrate documented behavior; generated instructions preserve defaults and safe staging; current capability claims are qualified correctly |
| 6. Automate distribution verification | Run regressions, generators-in-temp parity, and packed-artifact installs in CI; separate product audit rules from kit-maintenance checks | Clean CI on macOS/Linux; Claude-only, Codex-only, Copilot-only, and all installs from the tarball; plugin packaging references validated |

The first work package needs a migration precaution: existing v0.2.3 manifests may already contain an edited file's hash as their baseline. The fix must conservatively treat ambiguous legacy differences as local edits, preserve files and sidecars, and offer explicit conflict resolution. Correcting only future manifest writes leaves already affected installations exposed.

M0's fresh check at closure is an interim safeguard. M1 replaces repeated implicit checks with explicit, source-bound evidence and a coherent attempt model. Full approval provenance and multi-change lifecycle belong in M1; M0 must not imply that a PRD status field proves approval.

**Planning depth should scale with risk**

| Profile | Planning and verification | Approval behavior |
| --- | --- | --- |
| Small fix | Compact PRD: observed/expected/unchanged behavior; focused scope; regression check when behavior changes | Reuse clear existing authorization; ask only for a new material decision |
| Feature | User scenarios, constraints, requirement map, design, meaningful behavioral and integration checks | One reviewable plan/breakdown approval; revisit material scope or design changes |
| High-risk change | Additional investigation, characterization, migrations, rollback, security/performance/accessibility criteria as applicable | Explicit decisions at consequential boundaries; retain approved evidence and exceptions |

Use a walking skeleton for a new system when it helps. For brownfield work, start with the smallest protected vertical change or a characterization test. Ticket count follows dependency and risk, not a mandatory 4–7. Track active execution and wall-clock lead time separately. A timebox is a user constraint, not a universal product rule.

**Platform and installation work**

Keep the three existing platform targets. Maintain a versioned capability matrix covering invocation, hook events, tool payloads, trust, sandbox assumptions, and known limits. Codex now documents project-local hooks and trust review, while VS Code hooks are Preview; adapter activation and verification must respect those differences. [Codex hooks](https://learn.chatgpt.com/docs/hooks), [VS Code hooks](https://code.visualstudio.com/docs/agent-customization/hooks).

Installation should add a small managed Pincer reference to existing project instructions, preserving conventions and other tools' settings. Structured settings need a reviewed merge strategy. Provide a preview, conflict resolution, migrations, and a useful diagnosis of missing prerequisites or inactive hooks. Native Windows support should be claimed only when the runtime and check-runner contract are tested there; until then document the supported shell environment.

Plugin-only installation needs a complete, documented bootstrap path for project artifacts and rules. Avoid requiring users to combine channels that create duplicate commands merely to obtain the full workflow. Update documentation and website capability claims from the same versioned support data where practical.

**How to measure improvement**

Use identical briefs, base repositories, model versions, resources, and acceptance evaluators when comparing Pincer v0.2.3, the improved release, a plain-agent baseline, and selected comparable workflows. Separate deterministic runtime tests from model-dependent delivery trials. Record task setup, retries, human interventions, and failed attempts. Run multiple trials and report variation; one successful demo establishes very little.

| Measure | Proposed success condition |
| --- | --- |
| Preservation | Zero lost user edits in the supported update/migration fixture matrix |
| Completion integrity | Zero false completion/release verdicts in injected failure, stale evidence, and interrupted-run fixtures |
| Traceability | 100% of required acceptance criteria linked to current passing evidence or an explicit non-delivered disposition; required unresolved items block release |
| Resume correctness | The intended active change and next action are recovered in every interruption/revision fixture |
| Delivery quality | Independent acceptance pass rate and escaped regressions improve over the baseline across repeated trials |
| Human effort | Measure clarification count, repeated approvals, manual repairs, and review time; no repeated approval of unchanged authorized work |
| Efficiency | Report setup time, active time, elapsed time, and tokens/cost when available; target improvements after collecting a baseline |
| Platform parity | Same invariant suite plus real agent-session results for each supported surface and version |

Start with a small CLI feature, a bugfix in existing code, a change to an untested integration, a UI feature with accessibility/error states, a mid-build requirement change, and a two-change resume scenario. Include handoff between supported agents. Keep independent acceptance tests separate from the checks the implementation agent authors. Use controlled faulty implementations to test whether acceptance checks detect the intended failures.

Use Pincer's own repair work as the first documented case study. Follow with several consenting real-project pilots. Collect metrics locally by default; reporting or telemetry should be explicit. State measured improvements precisely rather than claiming universal superiority.

**Defer until the foundation earns them**

Hosted dashboards, tracker synchronization, autonomous multi-agent worktree scheduling, a large plugin ecosystem, and enterprise governance should wait. A local coverage report and good next-action output can answer the first visibility needs. Parallel execution adds conflict and evidence-ownership problems and should follow reliable serial execution. Lessons learned can be proposed as scoped convention changes; do not automatically expand global project rules after every run.

The agreed starting point is M0, with equal greenfield/brownfield coverage and no team-size exclusion. Larger-team coordination belongs in the runtime and traceability milestones; hosted enterprise services are not prerequisites for teams to use Pincer with their existing Git review and CI systems.
