# Open threads

- [2026-09-08] PRD v2 built on `feat/prd-v2` (T-11..T-19); still to do on this repo itself: `PRD v2: built` commit, `/pincer-evaluate` writing `.prd/evidence/prd-v2/<candidate>/`, `/pincer-release`, merge to main, `npm version minor` (0.4.0) and publish ([[candidate-evidence]])
- [2026-09-08] Confirm the CI matrix is green for the v0.3.0 tag and for `feat/prd-v2` (`gh run list --workflow=ci.yml`) ([[distribution-channels]])
- [2026-09-08] Live trials were run non-interactively (`claude -p --model sonnet --permission-mode bypassPermissions`, one session per stage); an interactive trial with questions answered by a human is still untested ([[requirements-through-delivery]])
- [2026-09-08] The NOTES.md at the repo root is the PRD v1 evaluation; after PRD v2 evaluation it is replaced — keep the v1 evidence gap noted in the handover ([[candidate-evidence]])
- [2026-09-02] No trusted-publishing workflow (OIDC, publish on tag); CI now runs tests only ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit copy with no back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local marketplace add path documented in README) ([[distribution-channels]])
- [2026-09-02] Improvement-plan items beyond M0/M2-bridge (M1 runtime, M3 parity, M4 learning loop) not started ([[revocable-receipts]])
- [2026-09-02] Codex supports hooks now; port `hook-policy.cjs` as a Codex hook adapter (README wording already corrected) ([[distribution-channels]])
- [2026-09-02] Codex: the `$pincer-plan` → `$pincer-release` chain is untested on Codex ([[cli-installer]])
- [2026-09-04] Copilot: `/pincer-*` prompt-file chain in VS Code untested end to end ([[distribution-channels]])
