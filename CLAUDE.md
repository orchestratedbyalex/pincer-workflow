# pincer-workflow — dev instructions

This is the distribution repo for PINCER. `template/` is the single source of
truth. After ANY edit inside `template/`, regenerate both derived outputs and
commit them along with the edit:

```bash
bash template/scripts/sync-prompts.sh   # regenerates template/.codex + template/.github adapters
bash scripts/build-plugin.sh            # regenerates plugin/ (Claude Code plugin)
npm test                                # smoke-tests the installer lifecycle
```

Never hand-edit `template/.agents/skills/`, `template/.github/prompts/`, or
`plugin/` — they are generated. Release flow: `npm version patch` →
`npm publish` (needs 2FA) → `git push --follow-tags`.

This project has an LLM-maintained wiki at `docs/wiki/`. Run `/llm-wiki start`
at session start to get oriented, and `/llm-wiki end` when finishing a task,
before clearing context.
