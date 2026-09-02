# Open threads

- [2026-09-02] No CI: a GitHub Actions workflow for npm trusted publishing
  (OIDC, publish on tag) was discussed, not built ([[distribution-channels]])
- [2026-09-02] The private lead-engineer-role-alexander repo has its own kit
  copy with no back-sync mechanism — decide which is upstream ([[template-kit]])
- [2026-09-02] Plugin install untested in a real Claude Code session (local
  marketplace add path documented in README) ([[distribution-channels]])
- [2026-09-02] No end-to-end dry run of the new code loop (start/verify/done + hook) in a real Claude Code session yet — only unit-level tests ([[ticket-state-machine]])
- [2026-09-02] Improvement list items 3–5 not built: change-size tracks, test-first for test-runner tickets, learning loop into AGENTS.md Conventions + cross-model review ([[mechanical-done]])
- [2026-09-02] v0.2.1 (Codex install fix) is tagged locally but not published/pushed — user runs `! npm publish` then `git push --follow-tags` ([[distribution-channels]])
- [2026-09-02] `.codex/README.md` claims Codex has no hooks; the codex-cli 0.149 binary carries hook-trust flags (`--dangerously-bypass-hook-trust`), so Codex may now support hooks — check the docs and consider porting ticket-guard/block-dangerous ([[distribution-channels]])
- [2026-09-02] Codex dry run only reached the install step; the actual /prompts:pincer-plan → release chain is still untested on Codex ([[cli-installer]])
