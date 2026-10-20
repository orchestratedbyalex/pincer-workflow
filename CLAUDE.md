# pincer-workflow — dev instructions

This is the distribution repo for PINCER. `template/` is the single source of
truth: the kit that `npx pincer-workflow init` copies into a project. The
design for the current version is `docs/superpowers/specs/2026-10-20-harness-builder-design.md`
and its plan `docs/superpowers/plans/2026-10-20-harness-builder.md`.

After ANY edit inside `template/`, run the tests and commit the result:

```bash
npm test
```

The shipped copies of the always-on stages (`template/.claude/skills/`,
`template/.claude/commands/`, `template/.agents/`, `template/.github/prompts/`)
are generated from `template/.claude/pincer/library/` and a test fails when they
are stale; regenerate them with the generator named in `template/docs/engine.md`.

Release flow: `npm version <level>` → `npm publish` (needs 2FA) → `git push --follow-tags`.
The Claude Code plugin channel is paused; the wiki under `docs/wiki/` is frozen.
