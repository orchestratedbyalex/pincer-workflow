---
name: pincer-evaluate
description: "Final quality pass over everything built — high-confidence findings only"
---
<!-- Generated from .claude/commands/pincer-evaluate.md by scripts/sync-prompts.sh — edit the source, not this file -->


# $pincer-evaluate — Final Quality Pass

You are reviewing all work built this session against the PRD and tickets. Autonomous —
run the pipeline, then present results.

## Steps

1. Run `scripts/pincer-status.sh`. Review only tickets associated with the selected
   PRD. Every such ticket should be `done` with a current receipt; if one
   is still open or in progress, stop and ask whether it was cut (then it goes in the
   PRD's Out of Scope) or should be finished first via `$pincer-code`. Then get the full
   diff of the change: identify the actual base commit before this change from
   its ticket commits and recorded context. If it cannot be established, resolve
   that uncertainty before claiming a complete review. Record full commit IDs for
   `base` and `candidate` (`git rev-parse HEAD`), then review `git diff <base>..<candidate>`.
   Require a clean candidate before review, excluding only the notes being written.
2. Dispatch a `code-quality-reviewer` agent with: the diff, the PRD's Success Criteria and
   Scope sections, and the list of tickets. If the diff is large, split by area and
   dispatch two in parallel. (No subagents on this platform? Review the diff yourself
   in a separate pass, applying `.claude/agents/code-quality-reviewer.md` as the rubric.)
3. Yourself, in parallel, check spec compliance. For every requirement `R-NN` in the
   PRD record one disposition: `delivered` (evidence on this candidate), `blocked`
   (required behavior failed or was left unverified — this blocks PASS; do not relabel
   it a known limitation to pass), or `deferred` (only with explicit user authorization;
   record the scope decision in the PRD's Out of Scope and evaluate the revised
   candidate). Compare what was built against every ticket's acceptance criteria and
   the PRD scope, and list any gaps. Whether the requirement map is complete and each
   check is semantically adequate is your judgment as reviewer — record that judgment
   in the evaluation; the kit is not a mechanical traceability engine and does not
   validate requirement-revision impact.
4. If the project has a UI, look at it — don't only read the code. Start it, open it in
   the browser (screenshot via Chrome DevTools MCP if available), and check it against
   the PRD's Visual Direction and Success Criteria. Note anything visibly broken or off.
5. Run a mechanical security audit:
   - Inspect the relevant history with a secret scanner that redacts values, when one is
     available. Otherwise review likely locations without copying candidate values into
     output. Report file, line, and remediation only; a secret committed then deleted is
     still leaked.
   - `.gitignore` covers `.env*` (except `.env.example`), and `git ls-files | grep -i env`
     shows only `.env.example`.
   - `npm audit --omit=dev` (or the ecosystem's equivalent) — report high/critical only.
   - If there's an HTTP API: hit one endpoint with invalid input (empty, oversized)
     and confirm a clean 4xx with a generic message, no stack trace.
6. Filter the agent's findings: report only issues you'd flag in a real PR review —
   concrete bugs, silent failures, misleading code. Drop nitpicks and style opinions.
7. Present findings as a short list with `file:line` references, ordered by severity.
   Security findings always rank above style-adjacent ones. For each, say whether you
   recommend fixing now (within the timebox) or noting as known-issue.
8. Fix findings clearly within the authorized PRD through a new ticket associated with
   that PRD. Use `pincer-ticket.sh` to start, verify, and close it, then make a scoped
   `T-{NN}: {title}` commit. Ask only when a fix changes scope, architecture, or another
   material decision; never make an ad-hoc `review: fixes` commit.
9. Close out: write a brief `NOTES.md` at the repo root with frontmatter:
   ```yaml
   ---
   prd: .prd/prd-vN.md
   base: <full reviewed base commit ID>
   candidate: <full reviewed candidate commit ID>
   ---
   ```
   Record the candidate before the separate NOTES commit. Status accepts a later
   commit only when its diff from the candidate changes solely `NOTES.md`; changes
   to source, tickets, or PRD require reevaluation. Legacy notes without these
   references do not establish readiness. Then describe what was built, what was cut
   and why, known issues, and what you'd do next with more time. Then a **Handover**
   section, written for the stranger who inherits this repo in six months: how to get
   oriented (which file to read first), what each dependency is for and why it earned
   its place, and what breaks first as the code ages (the riskiest assumption, the
   least-tested path). Commit it. This is the first document a reviewer of this repo
   should read.
10. Suggest `$pincer-release` as the final step: "Run `$pincer-release` for a pass/fail audit of the
   whole workflow's artifacts."
