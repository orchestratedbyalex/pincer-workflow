# Open threads

- [2026-09-11] 0.5.0 is merged, bumped and tagged on `main` but not yet published (`npm publish --otp`, user) or pushed; CI has never run the runtime suites on ubuntu or Node 18 ([[runtime-owned-verification]], [[distribution-channels]])
- [2026-09-11] The runtime trial covered Claude Code `-p` + Sonnet only; Codex, Copilot, plugin, Windows and Node 18 are untested for the runtime (`docs/trial-2026-09-11-prd-v4.md`) ([[runtime]])
- [2026-09-11] `pincer-ticket-lib.sh` is no longer shipped but `pincer update` leaves the old copy in installed projects; decide whether the installer should remove obsolete files ([[cli-installer]])
- [2026-09-11] Follow-up PRDs from PRD v4 §10: explicit lifecycle/resume, mechanical requirement coverage and impact, platform parity and measured delivery quality ([[runtime-owned-verification]])

- [2026-09-08] R-05 "new consequential decision during narrow" and the interrupt-and-resume scenario were never observed live (R-06 failed recheck was, on 2026-09-10) ([[candidate-evidence]])
- [2026-09-08] The PRD v1 evaluation (legacy NOTES.md, no evidence manifest) survives only in git history before `6518cfb`; the v1 evidence gap is by design ([[candidate-evidence]])
- [2026-09-02] No trusted-publishing workflow (OIDC, publish on tag); CI now runs tests only ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit copy with no back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local marketplace add path documented in README) ([[distribution-channels]])
- [2026-09-02] Codex supports hooks now; port `hook-policy.cjs` as a Codex hook adapter (README wording already corrected) ([[distribution-channels]])
- [2026-09-02] Codex: the `$pincer-plan` → `$pincer-release` chain is untested on Codex ([[cli-installer]])
- [2026-09-04] Copilot: `/pincer-*` prompt-file chain in VS Code untested end to end ([[distribution-channels]])
