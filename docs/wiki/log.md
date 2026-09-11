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
