<!-- Generated from .claude/commands/pincer-evaluate.md by scripts/sync-prompts.sh — edit the source, not this file -->


# /pincer-evaluate — Final Quality Pass

You are reviewing all work built this session against the PRD and tickets. Autonomous —
run the pipeline, then present results.

## Steps

1. Get the full diff of the session: `git log --oneline` and `git diff <first-commit>..HEAD`.
2. Dispatch a `code-quality-reviewer` agent with: the diff, the PRD's Success Criteria and
   Scope sections, and the list of tickets. If the diff is large, split by area and
   dispatch two in parallel. (No subagents on this platform? Review the diff yourself
   in a separate pass, applying `.claude/agents/code-quality-reviewer.md` as the rubric.)
3. Yourself, in parallel, check spec compliance: does what was built match every ticket's
   acceptance criteria and the PRD scope? List any gaps.
4. If the project has a UI, look at it — don't only read the code. Start it, open it in
   the browser (screenshot via Chrome DevTools MCP if available), and check it against
   the PRD's Visual Direction and Success Criteria. Note anything visibly broken or off.
5. Run a mechanical security audit (cheap, ~2 min — do all of these):
   - Whole history, not just the tree:
     `git log -p | grep -iE '(api[_-]?key|secret|token|password)[[:space:]]*[:=]'` —
     a secret committed then deleted is still leaked.
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
8. Fix what the user approves (or everything clearly broken, if time allows), verify,
   and commit as `review: fixes`.
9. Close out: write a brief `NOTES.md` at the repo root — what was built, what was cut
   and why, known issues, and what you'd do next with more time. Then a **Handover**
   section, written for the stranger who inherits this repo in six months: how to get
   oriented (which file to read first), what each dependency is for and why it earned
   its place, and what breaks first as the code ages (the riskiest assumption, the
   least-tested path). Commit it. This is the first document a reviewer of this repo
   should read.
10. Suggest `/pincer-release` as the final step: "Run `/pincer-release` for a pass/fail audit of the
   whole workflow's artifacts."
