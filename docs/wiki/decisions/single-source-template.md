# single-source-template

**Decided:** 2026-09-01

`template/` is the only hand-edited copy of the kit. Everything else is
generated from it: the Codex prompts and Copilot prompt files by
`scripts/sync-prompts.sh`, the Claude Code plugin (`plugin/`) by
`scripts/build-plugin.sh`. Generated output is committed (so installs need no
build step) but never hand-edited — every generated file carries a header
saying so.

## Why

Three platforms × five commands = fifteen chances to drift. With one source,
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
