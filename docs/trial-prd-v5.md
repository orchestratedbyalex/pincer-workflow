# Trial 2026-09-12: PRD v5 change handoffs, Claude Code `-p`, Sonnet

Live trials of the PRD v5 runtime (change records, authorization, lifecycle, resume)
from the packed candidate kit on a greenfield and a brownfield project, plus a bounded
comparison of the same handoff journey on the released v0.5.0 kit. One
`claude -p --model sonnet --permission-mode bypassPermissions` session per stage
(`env -u CLAUDECODE`, stdin from `/dev/null`), with an operator terminal auditing on
disk between sessions. This is one surface (Claude Code print mode, Sonnet, macOS); it
says nothing about interactive mode, Codex, Copilot, the plugin install, Windows or
Node 18.

- Fixture: a tiny dependency-free notes CLI (`src/notes.js`, `node:test`) with PRD v1
  "add and list" (T-01, T-02) and PRD v2 "clear" (T-03) authored by the operator before
  any session, so that every session starts at `/pincer-code` with approvals already
  given in the prompt. The brownfield variant adds an existing README with team
  conventions, a `CHANGELOG.md`, and two unrelated uncommitted edits present in every
  session (a `CHANGELOG.md` line and `scratch/todo.txt`).
- Bases: greenfield `70b03ff` (project before the kit) → `b2d6e35` (kit, PRDs,
  tickets); brownfield `1d1be19` → `47fa7ca`; baseline `93b3f60` → `c03e54f`. The
  changed-scope re-run (`scope2`) is a clone of the brownfield fixture at `9128a9e`
  (operator PRD revision) updated to the fixed kit as `c85d237`.
- Kits: candidate `npm pack` of `feat/prd-v5` at `a302735` (T-59 closed), tarball sha256
  `68d8b75e0c16c17068ff140269e42420e8de5fee4ffadc1132d967a8e9051eac`, used for every
  session except B5 and B6; re-packed at `6e37294` (T-62 closed) as
  `8b21166ca269df19a73ce1582015f2a41a0387e2ef697a25d59a0efbc39b0499` and installed into
  `scope2` with `pincer update` for B5 and B6. Baseline: `git archive v0.5.0`
  (`2d244eb`) packed as
  `d410601882261ab82d4fc8e1ab7dd5d44365e7a64cf1257c0b08f1788bac2c6d`.
- Versions: Claude Code 2.1.267 · model `sonnet` · Node v22.23.1 · macOS 26.6.2.
- Attribution: the session logs hold each session's final output, the commands it ran
  (Bash commands and file edits, from the transcript), and the operator's `git log`,
  `git status` and `resume --json` taken after the session. Observations about
  commits, attempts, preserved edits and record contents come from the operator's
  on-disk audit between sessions and the fixture histories; the Results table says
  which where it matters.
- Artifacts: fixtures under the session scratchpad (`trial/greenfield`,
  `trial/brownfield`, `trial/baseline`, `trial/scope`, `trial/scope2`), transcripts
  under `~/.claude/projects/-private-tmp-claude-501-…-scratchpad-trial-*`, and the
  per-session files in `docs/prd-v5-artifacts/trial-logs/` (`<session>.out`,
  `<session>.commands.txt`, `<session>.git-log.txt`, `<session>.git-status.txt`,
  `<session>.resume.json`; scratchpad paths, home directory and hostname replaced).
- Prompts: every prompt is quoted in full in the session's first `commands.txt`
  context or below in Interventions; the handoff prompts (G3, B3, B5) are identical in
  substance: "Continue the work on change prd-v1 where it was left off. Find out where
  it stands from the repository alone (follow this project's AGENTS.md and the
  /pincer-code playbook in .claude/commands/pincer-code.md), do what the runtime's
  resume report says next, and continue with its remaining tickets. Do not ask me to
  re-approve scope I already approved." Brownfield prompts add "The unrelated
  uncommitted edits in CHANGELOG.md and scratch/ must stay exactly as they are."

## Results

Disposition is one of `observed` (the scenario's behaviour was seen in a fresh session
and its artifacts are listed), `failed` (seen, but the agent or runtime did the wrong
thing; the finding names its fix ticket and the re-run) or `outstanding` (not run).

| Scenario | Sessions | Disposition | Observed |
| --- | --- | --- | --- |
| S-30 greenfield handoff: A active → pause → B complete → fresh-session select/resume A | G1, G2, G3 | observed | G1 registered `prd-v1`, recorded the quoted approval as A-01 (`Authorize PRD v1`), activated, built T-01 (attempt 000001), one commit. G2 paused `prd-v1` with a reason and an authored handoff note (`Pause prd-v1: switching to feature-b`), registered `feature-b` for PRD v2, authorized A-01 from the quoted words, built T-03, completed the change, set PRD v2 built. G3, from the repository alone: `resume` → `change select prd-v1` → `change resume prd-v1`; the report showed authorization `current` (A-01 retained) and T-01 `SOURCE_CHANGED` (feature-b had edited `notes.js`); the agent re-verified T-01 (attempt 000006 passed, no code change), built T-02 (attempt 000005), completed the change, set PRD v1 built. No approval was asked in G3; `change authorize` was not run (0 in `G3.commands.txt`). Tree clean after every session. |
| S-30 brownfield handoff with unrelated edits | B1, B2, B3 (first half) | observed | Same shape as greenfield on the brownfield fixture: `Register PRD v1` → `Authorize PRD v1` → `Activate PRD v1` → `T-01: add and list` (B1); `Pause change prd-v1` → `Register PRD v2 as change feature-b` → `T-03: clear` → `Complete PRD v2` (B2). B3 selected and resumed `prd-v1` from the repository alone and re-verified T-01 after `SOURCE_CHANGED`. The `CHANGELOG.md` line and `scratch/todo.txt` were present and unchanged after B1, B2, B3 (`git status` shows ` M CHANGELOG.md` and `?? scratch/` in every `B*.git-status.txt`); no session staged, committed, stashed or checked out around them (0 `git checkout`/`stash`/`reset` in any `commands.txt`). |
| S-31 changed scope: out-of-session PRD revision blocks until the actual decision is recorded | B3 (second half), B4 (invalid), B5, B6 | failed → observed on the re-run | Operator revised PRD v1 with R-03 (`list --json`) and ticket T-04 while `prd-v1` was paused (`9128a9e`). The runtime reported the block in every session: the operator's `resume` before B3 and before B5 showed `Authorization AGREEMENT_CHANGED` with the new agreement digest and named `change authorize … --agreement <digest>` as the next action, and each agent read that line first (`resume`/`change resume` precede every other runtime command in `B3.commands.txt` and `B5.commands.txt`). No session attempted `start` before recording an authorization, so the `start` refusal itself is covered by `test/change-command-gates.test.js`, not by a live observation. **B3 failed on the agent side:** it recorded the generic "continue, do not ask me to re-approve" instruction as a `user` authorization A-02 of the revised agreement (`Authorize and resume change prd-v1 (G-02/A-02)`) and built T-04. Fixed in T-62 (playbook wording) and re-run: **B5** (fixed kit) still recorded an A-02 from the same instruction first, then raised `change decide prd-v1 --summary "AGREEMENT_CHANGED found on resume (not made this session)…"` (D-01 open), reported the structural difference (R-03, T-04) and stopped; the runtime then reported `DECISION_REQUIRED` and no ticket was started or built (`B5.git-status.txt`: only the record and the two unrelated edits dirty; `src/notes.js` untouched). **B6** with the naming approval ("Approved: the revised PRD v1 with R-03 (list --json) and ticket T-04 as written is in scope") resolved D-01 (`change decide --resolve D-01`), authorized the revised agreement G-03 as A-03 with `--decision D-01`, re-verified T-01, built T-02 and T-04 (attempts 000001–000005), completed the change, set PRD v1 built; unrelated edits unchanged. B4 ran on the unfixed kit by operator error (see Interventions) and is kept only as an invalid run. |
| S-31 interruption: verification killed, explicit recovery, correct resume | G4 | observed | Operator setup on greenfield: PRD v3 "count" (T-05, check `sleep 6 && npm test`), registered as change `count`, authorized A-01 ("approved: add count as specified"), activated, T-05 started, then the operator's `verify T-05` SIGKILLed mid-run (attempt 000007 left `running`). G4, from the repository alone: status showed `ATTEMPT_RUNNING`; the agent ran `pincer-runtime.cjs recover` (attempt 000007 finalized `interrupted`, no result fabricated, nothing restored), `resume` reported authorization `current` and `verify T-05 → done T-05` as next, the agent implemented `count`, verified (attempt 000008 passed), closed T-05, completed the change and set PRD v3 built. No re-approval asked (0 `change authorize`), no `git checkout`/`stash`/`reset`. Both attempts remain under `.pincer/runtime/attempts/`. |
| S-32 baseline: the same handoff on the released v0.5.0 kit, counts and limitations | BL1, BL2, BL3 | observed | BL1 registered PRD v1 with the quoted approval as the binding's free text and built T-01. BL2, asked to set PRD v1 aside "with its authorization and progress intact", had to run `register --prd .prd/prd-v2.md --replace`, which deleted PRD v1's binding (the agent reported it as recoverable from `git show f3d80d2:.prd/changes/prd-v1.json`); T-03 built. BL3, asked to continue PRD v1, re-registered it with `--replace`, re-typing the original approval text from history (`Register PRD v1`, `8d79744`), re-verified T-01 twice and T-03 once, built T-02, set PRD v1 built, then restored PRD v2's binding with a second `--replace` re-typing its approval (`Register PRD v2`, `9740f53`). Nothing was lost, but there is no pause, no handoff note, no selection, and the authorization text is copied by the agent rather than retained by the runtime. Counts below. |

Counts, runtime versus baseline, for the handoff journey (register A, build T-01, switch
to B, build T-03, resume A, build T-02). "Commands to first action" is the 1-based index
of the first state-changing runtime command in the resume session's `commands.txt`
(everything before it is orientation: status, resume, reading files and help).

| Measure | Runtime (G1–G3 / B1–B3) | Baseline v0.5.0 (BL1–BL3) |
| --- | --- | --- |
| wrong-change actions (commands executed against the change not being worked on) | 0 / 0 | 2 (BL2 deleted A's binding to register B; BL3 deleted B's binding to re-register A) |
| repeated approvals of unchanged scope (authorization text re-entered or re-asked for already authorized work) | 0 / 0 (G3, B3 recorded no authorization for T-01/T-02; the user was not asked) | 2 (BL3 re-typed A's approval on re-registration and B's approval on restoration; the user was not asked) |
| manual repairs of runtime state (registrations or record edits made only to get back to a previous state) | 0 / 0 | 2 (the two `register --replace` in BL3) |
| re-verifications of unchanged tickets in the resume session | 1 / 1 (T-01 `SOURCE_CHANGED`: B's work edited `notes.js`, a real source change) | 3 (T-01 twice and T-03 once in BL3, after the same real source changes plus the binding rewrites) |
| commands to first action in the resume session | 4 (G3) / 9 (B3) | 13 (BL3) |
| unnecessary evaluations (evaluation runs or candidates created in the journey) | 0 / 0 | 0 |
| unrelated uncommitted edits lost or committed | 0 (brownfield) | not measured (the baseline fixture is greenfield) |
| handoff note carried to the resume session | authored pause reason and note, displayed by `resume` | not supported (no pause; the agent's report is the only handoff) |
| selection of the change to resume | `change select prd-v1` (explicit, metadata only) | not supported (one binding per tree; `register --replace` is the only switch) |

Interruption counts (G4 versus the baseline): the baseline was not run for this scenario.
The v0.5.0 kit finalizes a killed attempt through the same `recover` command, but has no
change lifecycle to resume into, so the resume half of the scenario has no baseline
equivalent; the PRD v4 trial record covers v0.4.1 recovery.

## Interventions

1. Fixtures built by `fixture.sh` from the candidate tarball (`pincer init --platform
   claude`), PRDs and tickets authored by the operator, committed as "kit, PRD v1 and
   v2, tickets T-01..T-03". Greenfield kept `"test": "node --test test/"` and a
   pre-authored `test/clear.test.js`; see finding 2. Brownfield and baseline were rebuilt
   with `"test": "node --test"` and T-03 writing its own test file.
2. Prompts as quoted above; the S-30 switch prompts named the change id to use
   (`--change feature-b`) and the words of approval to record.
3. Changed-scope setup on the brownfield fixture after B2: the operator edited
   `.prd/prd-v1.md` (R-03) and added `tickets/T-04-json-output.md` with its test file,
   committed as `9128a9e`; T-04's check is `sleep 6 && npm test` with a parenthetical
   in its Proves line left over from planning the interruption scenario there (B3
   flagged it as odd; the interruption was run on greenfield instead).
4. Interruption setup on the greenfield fixture after G3: PRD v3 and T-05 written by
   the operator, registered, authorized, activated and started by operator commands
   (commits `2096ac1`, `5ddc140`, `4d465b9`), then `verify T-05` SIGKILLed 0.5 s after
   launch.
5. Changed-scope re-run after T-62: the first attempt (session B4 on `trial/scope`)
   ran on the unfixed kit because the operator's repack failed silently (a zsh glob
   with no match aborted the copy and `pincer update` never ran); B4 repeated B3's
   failure exactly and is recorded as invalid. The operator then repacked at `6e37294`,
   cloned the brownfield fixture at `9128a9e` as `trial/scope2`, ran `pincer update`
   (confirmed the T-62 sentence present in `.claude/commands/pincer-code.md`),
   committed `c85d237`, ran `change select prd-v1` and re-added the two unrelated
   edits before B5.
6. No permission prompts (`bypassPermissions`); the kit hooks were active in every
   session. No session was cut off; all exited 0.

## Findings

1. **A generic "continue" instruction was read as approval of new scope** (B3, failed;
   fix ticket T-62; re-run B5/B6; B4 invalid). The runtime reported the block exactly
   as specified (`AGREEMENT_CHANGED` with the authorize command as the next action),
   but the playbook did not say what to do when the agreement changed outside the
   session, and the agent recorded the resume prompt as a `user` authorization. T-62
   makes that case a decision to surface. The first re-run (B4) is invalid because it
   ran on the unfixed kit (Interventions 5) and repeated B3. On the valid re-run (B5)
   the agent still recorded an A-02 from the same instruction before raising the
   decision (the `AGREEMENT_CHANGED` block was gone but `DECISION_REQUIRED` held, so
   nothing was built); with the naming approval in B6 it resolved the decision and
   recorded A-03 against the revised agreement. The residual A-02 is visible in
   `scope2`'s record and is an agent-side finding: the playbook rule works as a stop,
   not yet as a first response. Left open as a follow-up (see Untested and
   open threads); it does not falsify S-31 because the block held.
2. **Fixture flaw, greenfield:** `"test": "node --test test/"` fails on Node 22.23
   (`MODULE_NOT_FOUND` for a bare directory argument) and `test/clear.test.js` (T-03)
   pre-existed, so `npm test` could not pass for T-01 alone. G1 narrowed T-01's check to
   its own test file and recorded the narrowing as a delegated authorization on the
   existing approval (`6f87c7b`); G2 changed the test script. Both are visible in the
   records rather than silent. The brownfield and baseline fixtures were rebuilt without
   the flaw; the greenfield history keeps it.
3. **Hook guard false positive** (G4, incidental): committing `.prd/changes/count.json`
   with `git add … && git commit -m "$(cat <<'EOF' … <noreply@anthropic.com> EOF)"` in
   one compound command was refused by the ticket guard, which read the `<…>` in the
   heredoc as a redirection next to a protected path. Splitting `git add` and
   `git commit` worked. Recorded as a limitation of the guard's lexer; no runtime or
   record impact.
4. **`SOURCE_CHANGED` after a switch is expected and cheap.** Every resume session
   re-verified T-01 once because B's work edited `notes.js`; the report named the
   changed path and the agent re-ran without touching code. On the baseline the same
   re-verify happened three times because binding rewrites also changed the tree.
5. **The baseline's friction is the one PRD v5 targets.** Switching and returning cost
   the baseline two binding deletions and two agent-copied approvals; the runtime kept
   A-01 and the pause note across sessions and needed no re-registration. This is a
   count on one journey and one model, not a parity or superiority claim.

## Untested

Interactive mode; Codex CLI; Copilot; the plugin install; Windows; Node 18; the
baseline for the interruption resume; a project with concurrent worktrees; `change
cancel`/`supersede`/`reopen` live (deterministic in `test/change-lifecycle.test.js`);
`/pincer-evaluate` and `/pincer-release` on a completed change (deterministic in
`test/change-evaluations.test.js`); a `BASE_MISMATCH` live; a first response of
`change decide` without a preceding authorization attempt (finding 1).

| Requirement | Observed evidence or `outstanding` |
| --- | --- |
| R-02 | Records written only by the runtime in every session; both changes registered, selected and resumed by id. |
| R-04 | `resume` reported the retained A-01 as `current` in G3, B3, G4; `AGREEMENT_CHANGED` after the operator revision; `DECISION_REQUIRED` after B5's decision. |
| R-05 | D-01 raised in B5, resolved in B6 with the naming approval and an authorization carrying `--decision D-01`. |
| R-06 | Pause and resume with an authored note (G2/G3, B2/B3); no lost unrelated edits on brownfield. |
| R-08 | Agents ran `resume` and `change resume` first and followed the `Next` line in every handoff session; `SOURCE_CHANGED` and `ATTEMPT_RUNNING` were acted on as named. |
| R-10 | This record; counts above; B4 disclosed as invalid; finding 1 disclosed as a residual agent-side gap. |
