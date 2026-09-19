# Log

## [2026-09-08] PRD v2 reviewed and rewritten

User requested assessment and revision, not implementation. Replaced the original
dry-run cleanup draft with requirement coverage, behavioral acceptance fixtures,
a shared candidate-evidence validator and explicit evaluation commit semantics.
Kept ticket restores guarded because they can revive an earlier passing receipt;
replaced arbitrary size caps and approval triggers with risk and authorization
rules. Added compatibility expectations and separated mechanical validation from
agent judgment. M1 runtime migration remains subsequent work. PRD remains draft;
briefing and open threads updated to match.

## [2026-09-02] init | Wiki initialized

Scaffolded at extraction+publish time. Repo state: v0.1.0 live on npm
(verified from the registry), plugin channel built (`plugin/` generated,
marketplace.json at root), GitHub push pending. Seeded systems pages for the
CLI installer, the template kit, and the distribution channels, plus decision
pages for single-source generation and never-clobber updates. Files:
docs/wiki/* created; CLAUDE.md note appended.

## [2026-09-02] end | Website published via GitHub Pages
- What: converted the PINCER Claude artifact (12-sheet deck) into docs/index.html + docs/.nojekyll; enabled Pages (main:/docs); README links the site; repo homepage set.
- Why: user wanted the site public and discoverable from the repo.
- Files: docs/index.html, docs/.nojekyll, README.md (also pushed the 3 pending local commits).
- Outcome: https://orchestratedbyalex.github.io/pincer-workflow/ returns 200, Pages build status "built". Sheet 112 rewritten to the npx/plugin install path.

## [2026-09-02] end | Mechanical done + explicit state (improvement items 1 and 2)
- What: scripts/pincer-ticket.sh (start/verify/done, receipts), scripts/pincer-status.sh, .claude/hooks/ticket-guard.sh, /pincer-status command; code loop rewritten around them; every playbook opens with the status script; template, AGENTS.md, checklist, Codex README, installer, plugin builder, README, website updated.
- Why: "done" was an agent assertion and elapsed time a model estimate; now both come from the harness/clock.
- Files: template/scripts/*, template/.claude/hooks/ticket-guard.sh, template/.claude/commands/*.md, bin/pincer.js, scripts/build-plugin.sh, test/ticket.test.js, README.md, docs/index.html, plugin/ + adapters regenerated.
- Outcome: npm test green (smoke + lifecycle, incl. hook block/allow cases); not yet released to npm.

## [2026-09-02] end | v0.2.0 bump, README/site refreshed, publish left to user
- What: package.json 0.1.0 -> 0.2.0, plugin.json rebuilt at 0.2.0, marketplace.json description updated, README (six playbooks, update note) and website (release stamp v0.2.0, command/BOM wording) refreshed; commit tagged v0.2.0 and pushed with tags.
- Why: ship items 1 and 2 to npx users; publish needs the user's 2FA, and the classifier blocked `npm publish` from this session.
- Outcome: `npm pack --dry-run` shows all new files (37 files, 28 kB). Registry still at 0.1.0 until `npm publish` runs.

## [2026-09-02] end | v0.2.0 published to npm; publish-failure diagnosis
- What: user's `npm publish` failed with E404 on PUT; root cause was an expired session token (`npm whoami` → 401), fixed by `npm login` + republish. 0.2.0 now on the registry with the correct repository URL.
- Why: durable gotcha — npm reports auth failure on publish as 404, not 401.
- Files: docs/wiki only (briefing, systems/distribution-channels, open-threads).
- Outcome: stale-URL thread closed; remaining threads: dry run of the new loop, plugin install test, CI publishing, kit upstream decision, roadmap items 3–5.

## [2026-09-02] end | Codex install hint fixed after first clean dry run
- What: user's clean `npx pincer-workflow init` (Codex) failed at the printed next step — `cp` into a missing `~/.codex/prompts/` ("Not a directory"). Hint now `mkdir -p … && cp …` via a shared `CODEX_INSTALL` const; Codex docs also corrected to `/prompts:pincer-*` invocation.
- Why: Codex never creates its prompts dir, and exposes custom prompts under a `/prompts:` prefix.
- Files: bin/pincer.js, template/.codex/README.md, template/scripts/sync-prompts.sh, README.md, docs/index.html (sheet 112), test/smoke.test.js, wiki cli-installer page.
- Outcome: tests green, commit dbfa2a5; NOT yet released to npm (see open-threads).

## [2026-09-02] end | v0.2.1 bump + README per-platform sections
- What: version 0.2.1 in package.json, plugin.json (via build-plugin), website stamp; README gained Claude Code / Codex CLI / Copilot subsections with the full Codex install, `/prompts:` naming, posture and re-copy-on-update notes; `.codex/README.md` says the copy must be redone after `update`.
- Why: 0.2.0 on npm still prints the broken Codex `cp` step.
- Files: package.json, plugin/.claude-plugin/plugin.json, docs/index.html, README.md, template/.codex/README.md, wiki.
- Outcome: tests green, tag v0.2.1 created locally; publish + push left to the user (2FA).

## [2026-09-02] end | Codex adapter re-done as skills (v0.2.2)
- What: second clean Codex dry run — install ran, but `/pincer-status` was "Unrecognized". Investigation: openai/codex#16115 (2026-03-28) removed custom prompts entirely; the binary has no `/prompts:` and no prompts dir. Codex now loads `.agents/skills/<name>/SKILL.md` from the repo, invoked as `$name`.
- Why: 0.2.0 and 0.2.1 both pointed at a feature that no longer exists.
- Files: template/scripts/sync-prompts.sh (emits .agents/skills, rewrites $ARGUMENTS and /pincer-*→$pincer-*), template/.agents/skills/* (new), template/.codex/prompts/ (deleted), bin/pincer.js (codex root adds .agents, copy hint gone), template/.codex/README.md, template/AGENTS.md, dry-run-checklist, README, site sheet 112, CLAUDE.md, tests, wiki.
- Outcome: tests green, v0.2.2 tagged; publish/push left to the user.

## [2026-09-02] end | v0.2.3: canonical kit on all platforms, AGENTS.md wording
- What: user asked to fix `pincer-code` pointing at CLAUDE.md (absent on Codex-only installs); while checking, found Codex-/Copilot-only installs got none of `.claude/` although plan/narrow/evaluate load `.claude/references/*` and `.claude/agents/*` and the shipped sync script reads `.claude/commands/`. `PLATFORM_ROOTS.common` now includes those three dirs; `claude` keeps CLAUDE.md, settings.json, hooks.
- Files: template/.claude/commands/pincer-code.md, bin/pincer.js, test/smoke.test.js (codex-only tree asserted), template/.codex/README.md, README, site stamp, wiki.
- Outcome: tests green, v0.2.3 tagged; publish/push left to the user.

## [2026-09-04] end | v0.2.3 published and pushed; Copilot brownfield dry run started

- Published 0.2.3 to npm (needed `npm login` + `--otp`), verified the tarball carries
  `.claude/{agents,commands,references}`, pushed commit 91ad466 and tag v0.2.3.
- User's brownfield Copilot install (0.2.2) showed `.github/` but no `.claude/` — exactly
  the 0.2.3 gap; next step there is `npx pincer-workflow@latest update`.
- Recorded the npm auth/404 and 202-delay gotchas in [[distribution-channels]].

## [2026-09-08] end | M0 trust branch distilled; Sonnet brownfield dry run passed
What: wiki caught up with `fix/m0-trust` (16 commits, unpublished): new decisions [[revocable-receipts]] and [[release-audit-read-only]], schema-2 section in [[never-clobber-updates]], [[ticket-state-machine]] rewritten for the lib/last_check/hook-policy design, CI and tarball-install notes in [[cli-installer]] and [[distribution-channels]].
Why: the wiki had no record of M0; the 2026-09-08 dry run on Sonnet in a brownfield CRA repo confirmed every M0 guarantee live (receipt revocation, validation catching a hand edit, PRD v2 demoting the v1 candidate, update preserving a local AGENTS.md edit).
Files: docs/dry-run-2026-09-08-sonnet.md (new, 9 findings + verdict), docs/wiki/{briefing,index,open-threads,log}.md, 2 new decision pages, 3 system pages.
Outcome: nothing blocks tagging M0 as 0.3.0; findings 1–4 form the next kit PRD, 5–9 are small fixes. Dry-run doc and wiki still uncommitted on the branch.

## [2026-09-08] end | v0.3.0 tagged and pushed; PRD v2 drafted from dry-run findings
What: committed the dry-run doc + wiki on fix/m0-trust, fast-forwarded main, `npm version minor` → 0.3.0, regenerated adapters/plugin, README update paragraph + site stamp mention 0.3.0, `npm test` green (116 hook payloads), tag v0.3.0 pushed with main; `.prd/prd-v2.md` (draft) turns findings 1–9 into R-01..R-06.
Why: dry run confirmed M0; the maintenance checklist items 1–5 are covered by `npm test`, item 6 by the CI matrix now running on the pushed commits.
Files: README.md, docs/index.html, package.json, plugin/.claude-plugin/plugin.json, .prd/prd-v2.md, docs/wiki/{briefing,open-threads,log}.md.
Outcome: npm publish still pending (needs the user's OTP); next is `/pincer-narrow` on PRD v2.

## [2026-09-08] end | PRD v2 implemented on feat/prd-v2 (T-11..T-20), two live trials passed
- What: narrowed `.prd/prd-v2.md` into T-11..T-19, built all of them plus T-20 (trial findings). New `template/scripts/pincer-evidence.cjs`, evidence schema 1, `notes_current` rewrite, `profile` field, shared authorization block, `Proves:` policy, status/recovery fixes, dry-run checklist rewrite, README/AGENTS updates.
- Why: PRD v2 = bounded bridge to M1/M2 after the 2026-09-08 Sonnet dry run; requirements and release evidence must be reviewable, not narrated.
- Files: template/.claude/commands/*, template/.claude/references/*, template/scripts/*, template/docs/*, bin/pincer.js, scripts/build-plugin.sh, test/{behavioral-verification,evidence,candidate}.test.js + helpers, docs/trial-2026-09-08-{greenfield,brownfield}.md, wiki decisions/candidate-evidence, decisions/requirements-through-delivery, systems/evidence-validator, systems/ticket-state-machine.
- Outcome: `npm test` green (13 suites); greenfield and brownfield print-mode trials PASS at release with validated manifests; narrow-approval, supplied-ID and reviewer-artifact findings fixed in T-20. Next: built commit, evaluate this repo with evidence, release, merge, 0.4.0.

## [2026-09-08] end | Candidate 2952e62 rejected on review; T-21 fixes; focused trials for unverified-visual and deferral
- What: code-quality review of the first PRD v2 candidate found six defects (paths relative to toplevel vs project, quotePath, whole-tree restores past the guard, usage errors as evidence verdicts, 64-hex, unchecked base); T-21 fixed them with tests (146 hook payloads). Two extra Sonnet print-mode trials: evaluate with no browser tool, and a greenfield brief with a user-authorized deferral (run on the T-21 kit after the pre-T-20 kit reproduced the narrow stall).
- Why: evaluate playbook step 8 — fixes go through a ticket and a new candidate; T-19's requirements named the two scenarios.
- Files: template/scripts/pincer-ticket-lib.sh, pincer-status.sh, pincer-evidence.cjs, template/.claude/hooks/hook-policy.cjs, template/.claude/commands/pincer-code.md, test/*, docs/trial-2026-09-08-*.md, .prd/evidence/prd-v2/2952e62…/ (superseded record).
- Outcome: new candidate to be evaluated with a fresh manifest; NOTES.md will point at it.

## [2026-09-09] end | feat/prd-v2 merged to main; v0.4.0 bumped and tagged, publish pending
- Reviewed the branch (npm test green, generators clean, tarball carries `pincer-evidence.cjs`, status `current` / evidence `ok`) and fast-forwarded `main` to `6518cfb`.
- Bumped to 0.4.0 with `npm version minor --no-git-tag-version`, rebuilt `plugin/` (its manifest embeds the version), committed by hand as `v0.4.0: …` with an annotated tag, mirroring v0.3.0.
- Files: package.json, plugin/.claude-plugin/plugin.json, README.md (v0.4.0 update note), docs/index.html (stamp, timebox copy removed, evidence row), wiki briefing/open-threads/log.
- Outcome: status now reports the candidate changed (package.json) by design; user-run `npm publish --otp` and `git push --follow-tags` remain.

## [2026-09-09] end | v0.4.0 published and pushed; CI green
- User published 0.4.0 (registry showed it after ~2 min); `git push --follow-tags` sent 21 commits and the tag.
- CI runs 34323868697 (main) and 34323868930 (v0.4.0 tag) both succeeded — first CI coverage of the PRD v2 work.
- Files: wiki briefing, open-threads, log only.
- Outcome: release complete; nothing in flight.

## [2026-09-10] end | First interactive Sonnet trial on published 0.4.0: release PASS, one recovery finding
- Fixture `~/Documents/dev/personal/pincer-trial-interactive` from `npx pincer-workflow@0.4.0 init`; user drove one interactive session through all five stages, operator audited from a second terminal and injected faults.
- Observed live for the first time: human-answered plan questions (3, none re-asked at narrow), the fix-ticket path in evaluate (reviewer bugs → T-03 → new candidate), the R-06 failed-recheck message and status, the evidence digest mismatch.
- Finding 1: asked to git-checkout a ticket, the assistant declined by judgment, reverted the source itself, re-verified and committed a receipt refresh, which R-04 treated as a new candidate; a second evaluation was needed. Recorded as a playbook follow-up.
- Files: `docs/trial-2026-09-10-interactive.md` (new), `docs/wiki/briefing.md`, `docs/wiki/open-threads.md`.

## [2026-09-11] end | PRD v3 shipped as v0.4.1: recovery exception, one check per command, plan asks only the open part
- What: PRD v3 (`profile: small`, R-01..R-03) planned, narrowed into T-24..T-27, built, evaluated (first candidate rejected on four wording findings, T-28 fixed them), release PASS on candidate `a10358e`; bumped to 0.4.1 and tagged, publish pending.
- Why: the interactive trial's finding 1 (receipt-refresh commit after a hand repair), finding 3 (three commands under one `unverified`) and finding 4 (plan re-asked what the brief settled).
- Files: `template/.claude/commands/pincer-{code,status,evaluate,plan}.md`, `template/docs/dry-run-checklist.md`, `test/workflow.test.js`, `docs/trial-2026-09-10-prd-v3.md`, `.prd/prd-v3.md`, `.prd/evidence/prd-v3/a10358e…/`, `NOTES.md`, README, `docs/index.html`, generated adapters and plugin.
- Outcome: eligible recovery case observed live (named command, no verify, no commit); negative case stays outstanding because the injected `npm` shim was detected and bypassed; the reviewer caught that the exception's second condition was literally unsatisfiable before T-28.

## [2026-09-11] end | PRD v4 drafted for user implementation and later review
- What: drafted `.prd/prd-v4.md` against local v0.4.1, with R-01..R-10, S-01..S-31, seven ordered implementation packages, validation gates, migration constraints, and a review packet.
- Why: the user requested detailed logical next steps after the roadmap assessment. The next increment corrects recovery and moves verification execution, source identity, attempts, and evidence capture into a shared runtime.
- Scope: minimal explicit change identity now; full lifecycle/authorization enforcement, mechanical coverage-impact analysis, and comparative platform trials remain follow-up PRDs.
- Outcome: draft only; no implementation, tickets, runtime migration, release action, or test-pass claim. Documentation links, identifier uniqueness, and whitespace checked. Wiki briefing points to the draft.

## [2026-09-11] end | PRD v4 implemented on feat/prd-v4: the runtime (T-29..T-43), trials, review packet
- What: `template/scripts/pincer-runtime.cjs` + `pincer-runtime/` (parse, identity, source, state, runner, sanitize, readiness, status, lifecycle, migrate, evidence); wrappers delegate; Bash lib removed; guard covers `.pincer/` and `.prd/changes/`; evidence schema 2; migration; playbooks, templates, rules, checklists, README, site; `docs/runtime-contracts.md`; nine new suites; `docs/prd-v4-review-packet.md`, `docs/prd-v4-artifacts/`, `docs/trial-2026-09-11-prd-v4.md`.
- Why: PRD v4 (verification slice of M1): runtime-owned, source-bound attempts instead of agent-authored receipts and logs.
- How: this repo's own tickets ran on a pinned v0.4.1 kit (dogfooding rule); T-42/T-43 came out of the live trial (register/migrate steps in playbooks; register ignores `.pincer/`).
- Outcome: all 15 tickets done; greenfield chain on the runtime passed release with schema 2 evidence; baseline comparison recorded. Next: `PRD v4: built`, evaluate (schema 1 via the pinned kit), merge, bump 0.5.0, publish.

## [2026-09-11] end | PRD v4 built; candidate 7b561b1 reviewed, T-44 fixes, final candidate
- What: `PRD v4: built`; two reviewer subagents (runtime code/tests; docs/playbooks/packaging) returned 18 findings; T-44 fixed them (guard leaves `.pincer/drafts/` writable, rename-based lock acquire and stale claim, `recover` waits and escalates to SIGKILL, `index.current` is the attempt authority, sanitizer covers Basic/Token/Digest and quoted values, export validates ids and artifact paths, `timeout` ≤ 2147483, contract/checklist/playbook alignment, plugin transform of `scripts/pincer-runtime/`, doctor names obsolete files).
- Outcome: the final candidate is this wiki commit on top of T-44; evaluation and release follow in the same session.

## [2026-09-11] end | External review of candidate 77c5205 fixed in T-45; candidate 3
- What: three reproduced defects (readiness honored a record stripped to `{id, outcome}`; altered captured logs exported as runtime evidence with readiness green; `sleep 9 & exit 0` under a 1 s timeout ran 9 s because `terminate()` skipped an exited shell) fixed in T-45 with failing-before assertions.
- Why: the runtime's record and log digests existed but were never checked; the timeout logic keyed on the shell's exit rather than the group.
- Files: `template/scripts/pincer-runtime/{state,readiness,lifecycle,status,evidence,runner}.cjs`, `template/docs/runtime-contracts.md`, three runtime test suites, packet, this wiki.
- Outcome: T-45 done via the pinned kit (`2ff2b1a`); candidate 3 = this wiki commit; its evaluation commit follows.

## [2026-09-11] end | Reviewer findings on T-45 fixed in T-46; candidate 4
- What: a reviewer subagent over the T-45 diff reported five Low findings (limitation naming undelivered signals, old `recover` records reclassified as malformed, contract overstating validated fields, a record copied over the pointed-at one accepted, group-id reuse window); T-46 fixed four with assertions and recorded the fifth as a contract limit.
- Why: the evaluation of candidate 3 was not yet committed, so the fixes went in before evidence rather than into known issues.
- Files: `template/scripts/pincer-runtime/{state,runner,readiness,lifecycle,status,evidence}.cjs`, `pincer-runtime.cjs` (export passes the pointed id), contract, three suites, packet, this wiki.
- Outcome: T-46 done via the pinned kit; candidate 4 = this wiki commit; the evaluation commit follows.

## [2026-09-11] end | Release audit PASS for candidate 1a7fb78; merged; 0.5.0 bump
- What: `/pincer-release` audit against `template/docs/release-checklist.md` (status no warnings, 18/18 done, notes current, evidence ok, provenance legacy schema 1 by design, artifacts tracked, `npm test` green, tree clean before and after); `feat/prd-v4` fast-forwarded into `main`; `npm version minor --no-git-tag-version` → 0.5.0, plugin rebuilt, site stamp updated.
- Why: the user asked for release, merge, bump and publish after the T-45/T-46 fixes.
- Files: `package.json`, `plugin/.claude-plugin/plugin.json`, `docs/index.html`, this wiki.
- Outcome: commit `v0.5.0: …` with annotated tag `v0.5.0`; publish and push are the next actions (publish needs the user's OTP).

## [2026-09-11] end | 0.5.0 published, pushed, CI green
- What: `npm publish` (user, web auth) landed 0.5.0 as `latest`; `git push --follow-tags origin main` moved origin from `1cb5ab4` to `2d244eb` with tag `v0.5.0`; CI run 34636744572 passed on ubuntu/macOS × Node 18/22; `feat/prd-v4` deleted after the merge.
- Why: release flow after the PASS audit of candidate 1a7fb78.
- Correction: the registry shows v0.4.1 published at 2026-09-11T08:14Z, so earlier notes calling it unpublished were wrong.
- Outcome: nothing in flight; next work is the PRD v4 §10 follow-ups.

## [2026-09-11] end | PRD v5 drafted: change lifecycle, authorization, and resume
- What: created `.prd/prd-v5.md` against local v0.5.0 (`9bcf8df`), with R-01..R-10, S-01..S-32, seven dependency-ordered implementation packages, migration constraints, and a later-review packet.
- Why: the user requested a clear PRD for the next lifecycle/resume increment after the v4 fixes. A targeted rerun of the prior three reproductions rejected incomplete attempts and altered logs, and bounded the one-second background-child timeout to 1.22 s.
- Decisions proposed: selection is local to each worktree; lifecycle and verification readiness are separate; completed means implementation ready for evaluation; agreement changes require explicit authorization or a recorded existing-delegation disposition; no automatic Git source changes.
- Outcome: draft only; no implementation, ticket creation, migration, or release action. Checked document identifiers, local links, and whitespace; no runtime changes or full-suite rerun for this documentation task.

## [2026-09-11] end | PRD v5 decomposed into T-47..T-61
- What: created 15 open tickets with explicit PRD associations, dependencies, acceptance criteria and planned verification suites; `docs/prd-v5-ticket-map.md` records build order and all 32 scenario owners. PRD v5 status is now ticketed.
- Why: the user explicitly requested tickets for the v5 work. This is decomposition for their implementation and later review, not a request to start coding or migrate the distribution repository.
- Validation: the existing parser validated the repository ticket set and each new ticket; dependency references and acyclicity, initial open state, absence of receipt fields, complete scenario coverage, local links and whitespace checks passed. Planned implementation tests were not created or run.
- Outcome: start T-47 using a pinned released kit. No prior tickets, runtime files, generated outputs, commits, registration, migration, or release actions changed in this task.

## [2026-09-11] end | PRD v5 T-47..T-56 implemented on feat/prd-v5
What: contract freeze + released fixtures (T-47), transactions (T-48), schema 2 change records (T-49), selection (T-50), agreements (T-51), authorization/decisions (T-52), lifecycle transitions (T-53), command gates (T-54), change-scoped attempts (T-55), evaluation locator (T-56); ten new `test/change-*.test.js` suites in `npm test`.
Why: PRD v5 (preserve changes, authorization, resume context); each ticket verified with the pinned v0.5.0 kit and committed as `T-NN: …`.
Files: template/scripts/pincer-runtime/{transaction,changes,agreement,authorization,transitions,gates,locator}.cjs, status/lifecycle/runner/state/readiness/evidence edits, template/docs/runtime-contracts.md, test/fixtures/prd-v5/, test/helpers.js (bindV050).
Outcome: T-57..T-61 remain (resume report, migration, adapters, live trials, review packet). Mid-implementation checkpoint; the branch is not evaluated.

## [2026-09-12] end | PRD v5 implemented on feat/prd-v5: T-57..T-62 done, trials, review packet, PRD built
- What: resume report (T-57), migration to changes mode (T-58), playbooks/guards/installer/adapters (T-59), live handoff trials with a v0.5.0 baseline (T-60, `docs/trial-prd-v5.md`, `docs/prd-v5-artifacts/`), review packet with eight executable replay cases (T-61, `docs/prd-v5-review-packet.md`, `replay.sh`), playbook fix from trial finding 1 (T-62). PRD set to `built`.
- Why: PRD v5 (retained change records, explicit selection, agreement-bound authorization, lifecycle transactions, resume) is complete and ready for the user's evaluation; nothing merged, bumped or published.
- Files: template/scripts/pincer-runtime/{resume,migrate}.cjs, template/.claude/commands/*, template/AGENTS.md, template/docs/*, bin/pincer.js, test/change-*.test.js, docs/trial-prd-v5.md, docs/prd-v5-review-packet.md, docs/prd-v5-artifacts/, tickets/T-57..T-62.
- Outcome: full `npm test` green through the pinned v0.5.0 kit; generators in parity; CI outstanding for the branch. Trials: S-30 both project types pass; S-31 changed-scope block held (agent residual disclosed), interruption recovered; S-32 baseline needed 2 binding deletions and 2 re-typed approvals where the runtime needed none.

## [2026-09-12] end | Review findings on built PRD v5 fixed: T-63 gate revalidation under the lock, T-64 validated followers, T-65 rollback split
The user's review of `feat/prd-v5` at `1a5cbc5` found two P1s and one P2; each became a follow-up ticket closed through the pinned v0.5.0 kit (commits `d43168c`, `7d94c58`, `dcbcfbe`), no done ticket edited.
T-63: `runner.runAttempt` takes `revalidate`/`announce`; verify/check re-run `gates.guard` under the lock before the running record (fixture `test/fixtures/attempt-race.cjs`, gate suite S-24 block, contract pins). T-64: `locator.followers` computes allowed post-candidate paths from valid locators + validated manifests; `requireCandidateView` uses it (evaluations suite R-07 block). T-65: contract rollback split into legacy and binding procedures; both rollback tests follow them literally.
Packet sections 1, 2, 4, 6, 10 updated; wiki runtime/decision/briefing updated; full `npm test` re-run after the fixes (result in the packet's verification record).
Outcome: PRD v5 still `built`, awaiting the user's re-review, evaluation, CI push and release.

## [2026-09-12] end | PRD v6 and implementation breakdown created
- What: `.prd/prd-v6.md` (ticketed), 13 open tickets T-66..T-78 and `docs/prd-v6-ticket-map.md`; 10 requirements and 30 scenarios with primary owners, checks and dependency order.
- Why: the user selected complete requirement coverage and change impact, with an independent delivery benchmark, and requested tickets.
- Decisions: PRD prose owns definitions; a strict authored map owns links and candidate check declarations; adoption is explicit and agreement-bound; export/release reconcile the full candidate inventory; semantic adequacy remains a review judgment. Benchmark: six briefs, three paired repetitions each, 36 runs with independently frozen evaluators and honest failures/limitations.
- Validation: existing parser accepts the PRD and all new tickets; full ticket-set validation passes; planning checks confirm unique R/S IDs, all scenario owners, valid local links, ordered acyclic dependencies and open/unchecked state without receipts. Runtime tests were not rerun for this documentation-only task.
- Outcome: v6 runtime implementation begins with T-66; no code, migration, evaluation, merge or publication performed. V5 release/re-review gates remain separate.

## [2026-09-12] end | PRD v6 implemented: strict coverage, impact and the delivery benchmark
Built T-66..T-78 on `feat/prd-v6` (base `07b2210`): the PRD's own prose is the inventory,
`.prd/coverage/<id>.json` is the one authored map, both live inside the agreement digest,
`coverage`/`impact` are read-only reports, strict `check C-NN` runs only the declaration,
and evidence schema 3 derives every row from the map snapshot. Adoption is opt-in and
backed up; unadopted projects are untouched.
Also: a six-brief, 36-run paired delivery benchmark with held-out evaluators
(`docs/trial-prd-v6.md`) — acceptance 17/18 per arm, kit arm ~4.7x cost, the only
difference being changed-scope handling (3/3 vs 2/3); and the review packet with eight
executable replay cases (`docs/prd-v6-review-packet.md`).
Files: `template/scripts/pincer-runtime/{requirements,coverage,dispositions,adopt,phases,impact,checks}.cjs`,
14 new suites, `scripts/delivery-benchmark/`, `test/fixtures/delivery-benchmark/`, `docs/prd-v6-artifacts/`.
Outcome: 50 suites green locally through the pinned v0.5.0 kit; both generators in parity;
CI not run on the branch and Node 18 unverified anywhere; nothing evaluated, merged or released.
New pages: [[strict-coverage]], [[delivery-benchmark]], [[coverage-is-authored-and-bound]].

## [2026-09-14] end | 0.6.0 released; wiki distilled from the v5+v6 evaluation, and the release found split across refs
- What: applied the wiki update parked at the end of the evaluation session, now that its
  precondition — the merge — is met: PR #1 landed `feat/prd-v6` on `main` at 06:51, the
  version bump at 06:53, `npm publish` at 06:54. Rewrote [[briefing]] and
  [[open-threads]]; updated [[runtime]] (Node floor, changes-mode status schema, the
  T-79..T-86 fixes), [[distribution-channels]] (version history, CI matrix, the bump
  gotcha), [[evidence-validator]] (schema 3 false `ok`s, consistency vs execution),
  [[delivery-benchmark]] (the T-82 corrections), [[strict-coverage]] (T-84, T-83),
  [[ticket-state-machine]], [[cli-installer]], [[template-kit]], [[candidate-evidence]],
  [[single-source-template]], [[requirements-through-delivery]], [[revocable-receipts]],
  [[release-audit-read-only]], [[explicit-change-lifecycle]] and [[index]]. New page:
  [[one-next-action-precedence]].
- Why: CLAUDE.md asks for a wiki `end` at task end, and the draft had been held back
  because a wiki commit after the candidate makes status read `stale`. The merge released
  that hold — and the version bump had already made status stale regardless.
- Method: rather than trusting the parked draft, every wiki page was audited against the
  repo at HEAD by 11 parallel agents, and each reported staleness was put to an
  adversarial verifier whose default verdict was "refuted". 45 claims confirmed stale,
  22 refuted — including three dead commit SHAs that the T-77 history rewrite renamed
  (`5b0358b`→`e07faca`, `307792d`→`bdad2e0`), one of them in text written earlier in this
  same session.
- Found by checking the state instead of assuming it: (1) `npm version minor` ran without
  `--no-git-tag-version` and without rebuilding, so `plugin/.claude-plugin/plugin.json`
  stayed at 0.5.0 and `test/distribution.test.js` was red at HEAD — fixed by re-running
  `scripts/build-plugin.sh`; (2) PR #1 merged the branch at the *candidate* `ce98abd`,
  before the evaluate commit was pushed, so `main` carries v5+v6 code under PRD v4's
  NOTES.md and the evaluation record is local-only; (3) the bump commit and tag `v0.6.0`
  are local-only, so npm has 0.6.0 but no public ref does. The published tarball was
  diffed against `git archive origin/main`: `bin/`, `template/`, README and LICENSE
  byte-identical, `version` the only difference.
- Outcome: full `npm test` green after the plugin rebuild — 51 suites, `NPM_TEST_EXIT=0`,
  captured from the run and not through a pipe. The evaluated candidate `ce98abd` and its
  record are unchanged; `status` reads `stale: candidate changed after evaluation:
  package.json` and will until the next candidate. Remaining and all the user's: get
  `350823e`, `566b553` and this commit onto `main`, and push the tag.

## [2026-09-14] end | PRD v7 implemented as far as it can go without spending
Built the two product surfaces (`coverage scaffold`, `resume --brief`) as read-only
projections, the frozen v7 protocol and preservation matrix, the effort record and
execution freeze, the v7 benchmark edition (8 briefs, 72-run schedule), the observation
record validators, six replay cases and the review packet. T-97 was created and fixed
from a defect the baseline measurement reproduced.
Files: template/scripts/pincer-runtime/scaffold.cjs, resume.cjs, readiness.cjs;
scripts/delivery-benchmark-v7/*; docs/prd-v7-{protocol,pilots,preservation,platforms,comparison,review-packet}.md;
docs/prd-v7-artifacts/*; 11 new suites in package.json.
Outcome: engineering done and green; every live observation (T-89, T-93, T-95) is
outstanding pending project access, a costed spending cap and two non-implementing
reviewers. 10 of 30 scenarios are outstanding and the packet says so.

## [2026-09-14] end | PRD v7 merged; T-98 fixed the benchmark driver before its first run
The v7 branch merged as PR #3 (`ae796d6`) with the full CI matrix green. Reviewing the
merged edition against "what happens if someone actually runs this" found that
`live-driver.sh` validated `--workspace` and `--wall-clock-minutes` and then used
neither, and that v7 had no run loop at all — so the loop, and everything it would
enforce, would have lived in an unfrozen file. T-98 fixed the driver, added
`orchestrator.cjs` as a named frozen input, and re-minted the cohort openly
(`eef74402…` → `6de061ec…`) while zero runs existed. A fourth defect surfaced only under
test: the cap watchdog's `sleep` held the caller's stdout, which would have blocked every
successful run for the full cap.
Files: scripts/delivery-benchmark-v7/{live-driver.sh,orchestrator.cjs,freeze-spec.cjs},
test/benchmark-orchestrator.test.js, test/fixtures/delivery-benchmark-v7/frozen.json,
docs/prd-v7-protocol.md, tickets/T-98, wiki.
Outcome: 63 suites green, T-98 done with a real receipt, Codex pinned at 0.153.4. No live
session has run and none was paid for; the spending, project and reviewer decisions remain
the user's.

## [2026-09-15] assessment | next work after T-98

- Reviewed HEAD `0534ea2` and saved `docs/pincer-assessment-2026-09-15.md`.
- Offline stand-ins reproduced incomplete completed effort records, an accepted
  execution/record cohort mismatch and kit installation committing unrelated edits.
  Inspected identical default/strict instructions and the missing running-session
  checkpoint. No paid model or live trial was launched.
- Next recommendation: close those five benchmark orchestration gaps before paid
  runs, complete the planned strict pilots, then test guided coverage authoring as
  the next product improvement. Keep release metadata changes before evaluation.
- Local regression chain still running at handoff, with no failures through coverage
  evidence checks. Exact-HEAD CI has green Ubuntu Node 22/24 jobs and macOS jobs still
  in progress. No full-matrix pass claimed. Product source and tickets unchanged.

## [2026-09-15] documentation | junior-friendly Pincer flowcharts

- Added `docs/pincer-workflow-guide.md` with the full journey, ticket loop, recovery,
  and security/cost decisions. Raw Mermaid sources are in `docs/diagrams/`.
- Distinguished user/agent judgment from runtime checks, strict from default coverage,
  elapsed time from billing, and release auditing from publication.
- Checked the charts against canonical playbooks; all diagram connections resolve.
  No runtime, generated adapter, ticket state or frozen benchmark input changed.

## [2026-09-15] end | PR #4 merged, and the 2026-09-15 assessment verified

- Merged PR #4 (`0534ea2`), fast-forwarded local `main`, CI green 4/4 on the merge commit,
  deleted five merged local branches (kept the unmerged `backup/pre-rewrite-2026-09-13`).
- Independently re-verified all five findings of `docs/pincer-assessment-2026-09-15.md`
  with offline stand-in CLIs and zero paid sessions: four confirmed as written, F-04 real
  but masked by a larger defect the assessment missed (the preservation check is dead, not
  merely contaminated). Added three gaps it did not raise: no operator entry point,
  `ui-states` structurally unavailable, a cap-less dry run strands a cell.
- Corrected stale claims the assessment flagged: `docs/prd-v7-review-packet.md` (S-29 now
  delivered, scenario count 10 → 7, Codex and CI moved out of the outstanding table),
  `docs/prd-v7-platforms.md`, `docs/prd-v7-comparison.md`, `docs/wiki/open-threads.md`.
  Four doc-binding suites re-run green.
- New page [[v7-execution-gaps]]; briefing and index updated.
- Outcome: nothing live has run and nothing was spent. The five gaps are a day of offline
  work and must close before run #1 — the same fix after run 30 strands those runs.

## [2026-09-15] end | T-99 closes the five execution gaps before run #1

- Fixed all five verified findings plus the three gaps verification added: arm preamble
  and adoption observation, record completion through `effort.problems()`, preservation
  reorder + record wiring + brief hooks, clean re-drive after a crash with per-session
  checkpoints, and a cohort/model/caps preflight that refuses before touching anything.
- Shipped the operator entry point the edition never had (`--runs`, `--kit`, `--browser`,
  `--i-have-a-spending-cap`), and made every refusal non-terminal so a dry run can no
  longer strand a cell.
- Suite: the new cases drive the real loop with a stand-in CLI and assert on what landed
  on disk, including both directions of the preservation check. 63 suites green.
- Cohort re-minted `6de061ec…` → `47dedc0a…`; exactly `harness`, `collector` and `briefs`
  moved. Free because no run exists — the last moment it would have been.
- Outcome: T-99 done, receipt `a05a552f47b9`. No session ran and nothing was spent. What
  remains before run #1 is decisions, not code: cap, projects, reviewers, and a browser
  adapter ([[v7-execution-gaps]]).

## [2026-09-19] end | T-109 smoke execution package prepared; smoke launch path added
What: packaged the first operational smoke (identities, prompts, schedule, caps, checks,
auth prerequisites, stop/resume, blockers, protocol corrections) without any paid session;
fixed the orchestrator so the smoke can run through the frozen loop (`--study-purpose`,
`--repetitions`), regenerated `frozen.json`, staged a study root at
`/Users/Shared/pincer-v8-study`, dry-resolved the proposed effective manifest and ran the
inspector on an honest draft. Files: `scripts/delivery-benchmark-v7/{orchestrator,effective}.cjs`,
`test/benchmark-study-launch.test.js`, `docs/prd-v8-artifacts/execution/*`,
`docs/prd-v8-progress.md`, `docs/wiki/systems/study-readiness-gate.md`.
Outcome: readiness still pending on user decisions and reviewed evidence, by design.

## [2026-09-19] end | T-109 smoke package corrected after review
Three review findings fixed: the CLI planned all eight briefs (added `--briefs`, required for the smoke purpose, CLI-level regression that spawns the documented command); the proposed inspector command failed `PATH_INVALID` (manifest must be inside the input root; now the study checkout's copy, exercised); `cleanup_complete` was never retained (now in `record.environment`; evidence table split into configured vs observed, hook firing unobservable under `json`).
Files: `scripts/delivery-benchmark-v7/{effective,orchestrator,isolated-launch}.cjs`, `test/benchmark-{study-launch,environment}.test.js`, frozen cohort `f09e4312…` → `d1e57a17…`, package §2/§4/§5/§8/§9/§10/§11/§12, progress journal, wiki gate page/threads/briefing.
Study root: worktree moved to `bffcfc8`; drafts regenerated (effective cohort `64325207…`); `runs/smoke` untouched. No paid launch, push, merge or publication.
