# Open threads

- [2026-09-11] The runtime trial covered Claude Code `-p` + Sonnet only; Codex, Copilot, plugin and Windows are untested for the runtime (`docs/trial-2026-09-11-prd-v4.md`); CI has since run the suites on ubuntu and Node 18 ([[runtime]])
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
- [2026-09-11] PRD v5 T-57..T-61 outstanding on `feat/prd-v5`: resume report, migration to changes mode (legacy and schema 1 binding; the ticket map's `migrate` still writes schema 1 until T-58), playbooks/guards/installer/adapters for the change commands, live handoff trials, review packet ([[runtime]])
- [2026-09-11] Sandbox limit observed: `node <file> <long argv>` SIGKILLed in the Claude Code Bash tool; feedback drafted; CI is unaffected ([[runtime]])

