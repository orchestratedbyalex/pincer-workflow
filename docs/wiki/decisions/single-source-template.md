# single-source-template

**Decided:** 2026-09-01

`template/` is the only hand-edited copy of the kit. Everything else is
generated from it: the Codex **skills** (`template/.agents/skills/pincer-*/SKILL.md`
— `template/.codex/prompts/` was deleted in v0.2.2 when Codex dropped custom
prompts) and the Copilot prompt files by `template/scripts/sync-prompts.sh`, the
Claude Code plugin (`plugin/`) by `scripts/build-plugin.sh`. Generated output is
committed (so installs need no build step) but never hand-edited. The
`sync-prompts.sh` outputs say so in a header
(`<!-- Generated from … by scripts/sync-prompts.sh — edit the source, not this file -->`);
the 51 files `build-plugin.sh` writes do **not** carry one, so `plugin/` is
hand-edit-proof only by convention and by `test/distribution.test.js`.

## Why

Three platforms × six playbooks (plan, narrow, code, evaluate, release, status)
= eighteen chances to drift. With one source,
an edit to a playbook propagates everywhere by re-running two scripts, and
"adapters in sync" is mechanically checkable (run generators → `git status`
clean — it's a dry-run-checklist item).

## Alternatives rejected

- **Hand-maintained per-platform copies** — guaranteed drift; the pre-rebrand
  `verify.md` leftover found in the deck's BOM was exactly this failure mode.
- **Generate at install time instead of committing** — would put perl/bash in
  the user's critical path and make the GitHub repo unreadable as a plugin
  marketplace (which needs `plugin/` present).

See [[template-kit]], [[distribution-channels]].
