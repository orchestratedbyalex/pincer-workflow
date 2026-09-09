# Open threads

- [2026-09-09] v0.4.0 is tagged locally on `main` but not published or pushed; after `npm publish --otp` and `git push --follow-tags`, confirm CI is green for the v0.4.0 tag — it never ran on the PRD v2 commits (`gh run list --workflow=ci.yml`) ([[distribution-channels]])
- [2026-09-08] Live trials were run non-interactively (`claude -p --model sonnet --permission-mode bypassPermissions`, one session per stage); an interactive trial with questions answered by a human is still untested ([[requirements-through-delivery]])
- [2026-09-08] R-05 "new consequential decision during narrow" and R-06 "failed recheck" were never observed live; covered by wording tests and `test/recovery.test.js` only ([[candidate-evidence]])
- [2026-09-08] The PRD v1 evaluation (legacy NOTES.md, no evidence manifest) survives only in git history before `6518cfb`; the v1 evidence gap is by design ([[candidate-evidence]])
- [2026-09-02] No trusted-publishing workflow (OIDC, publish on tag); CI now runs tests only ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit copy with no back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local marketplace add path documented in README) ([[distribution-channels]])
- [2026-09-02] Improvement-plan items beyond M0/M2-bridge (M1 runtime, M3 parity, M4 learning loop) not started ([[revocable-receipts]])
- [2026-09-02] Codex supports hooks now; port `hook-policy.cjs` as a Codex hook adapter (README wording already corrected) ([[distribution-channels]])
- [2026-09-02] Codex: the `$pincer-plan` → `$pincer-release` chain is untested on Codex ([[cli-installer]])
- [2026-09-04] Copilot: `/pincer-*` prompt-file chain in VS Code untested end to end ([[distribution-channels]])
