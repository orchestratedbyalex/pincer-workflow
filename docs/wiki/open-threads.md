# Open threads

- [2026-09-08] R-05 "new consequential decision during narrow" and the interrupt-and-resume scenario were never observed live (R-06 failed recheck was, on 2026-09-10) ([[candidate-evidence]])
- [2026-09-10] Interactive trial finding 1: after a hand repair the assistant re-verified and committed a receipt refresh on a built PRD, forcing a second evaluation; the code playbook recovery section should say the user restores the ticket and nothing is committed when the source already matches HEAD; evaluate should record one check per command and the M1 runtime should capture logs rather than let the agent author them (`docs/trial-2026-09-10-interactive.md`) ([[revocable-receipts]])
- [2026-09-08] The PRD v1 evaluation (legacy NOTES.md, no evidence manifest) survives only in git history before `6518cfb`; the v1 evidence gap is by design ([[candidate-evidence]])
- [2026-09-02] No trusted-publishing workflow (OIDC, publish on tag); CI now runs tests only ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit copy with no back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local marketplace add path documented in README) ([[distribution-channels]])
- [2026-09-02] Improvement-plan items beyond M0/M2-bridge (M1 runtime, M3 parity, M4 learning loop) not started ([[revocable-receipts]])
- [2026-09-02] Codex supports hooks now; port `hook-policy.cjs` as a Codex hook adapter (README wording already corrected) ([[distribution-channels]])
- [2026-09-02] Codex: the `$pincer-plan` → `$pincer-release` chain is untested on Codex ([[cli-installer]])
- [2026-09-04] Copilot: `/pincer-*` prompt-file chain in VS Code untested end to end ([[distribution-channels]])
