# Open threads

- [2026-09-08] R-05 "new consequential decision during narrow" and the interrupt-and-resume scenario were never observed live (R-06 failed recheck was, on 2026-09-10) ([[candidate-evidence]])
- [2026-09-11] Recovery exception follow-up: the code playbook says the Verification block must pass "when run directly" but not in which environment; a Sonnet session bypassed a broken `PATH` and applied the exception. Tighten to "the recorded failure is explained by a working-tree change since reverted; any other cause is fixed first and re-run through `verify`", and build a fixture with an external dependency so the negative scenario can be observed (`docs/trial-2026-09-10-prd-v3.md` finding 1; T-25's `git diff --quiet HEAD` clause is vacuous after commit, known issue) ([[revocable-receipts]])
- [2026-09-10] M1 runtime should capture command logs rather than let the agent author them (interactive trial finding 2) ([[revocable-receipts]])
- [2026-09-08] The PRD v1 evaluation (legacy NOTES.md, no evidence manifest) survives only in git history before `6518cfb`; the v1 evidence gap is by design ([[candidate-evidence]])
- [2026-09-02] No trusted-publishing workflow (OIDC, publish on tag); CI now runs tests only ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit copy with no back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local marketplace add path documented in README) ([[distribution-channels]])
- [2026-09-02] Improvement-plan items beyond M0/M2-bridge (M1 runtime, M3 parity, M4 learning loop) not started ([[revocable-receipts]])
- [2026-09-02] Codex supports hooks now; port `hook-policy.cjs` as a Codex hook adapter (README wording already corrected) ([[distribution-channels]])
- [2026-09-02] Codex: the `$pincer-plan` → `$pincer-release` chain is untested on Codex ([[cli-installer]])
- [2026-09-04] Copilot: `/pincer-*` prompt-file chain in VS Code untested end to end ([[distribution-channels]])
