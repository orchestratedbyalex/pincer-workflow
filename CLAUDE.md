# pincer-workflow — dev instructions

This is the distribution repo for PINCER 1.0, the harness builder. `template/` is the
single source of truth: the kit that `npx pincer-workflow init` copies into a project.
The design is `docs/superpowers/specs/2026-10-20-harness-builder-design.md` and its
plan `docs/superpowers/plans/2026-10-20-harness-builder.md`.

The dev loop: edit `template/`, run the tests, commit. After ANY edit inside
`template/`:

```bash
npm test
```

The shipped copies of the always-on stages (`template/.claude/skills/`,
`template/.claude/commands/`, `template/.agents/`, `template/.github/prompts/`) are
generated from `template/.claude/pincer/library/` and `test/distribution.test.js` fails
when they are stale. Regenerate them with

```bash
npm run generate
```

which runs `node template/scripts/pincer/cli.cjs --root template generate` with the
always-on harness `test/fixtures/always-on.harness.json`, every platform and
`--overwrite`. `template/docs/engine.md` describes the generator.

Rules that the tests enforce: Node 22+, no dependencies, every `require` is `node:` or
a relative sibling; no `@` imports in anything Codex or Copilot reads; the six
agreement headings used as is; course text paraphrased, never copied.

The tier table `template/.claude/pincer/library/models.json` maps `strong`, `standard` and
`fast` to each platform's model name. The Claude row stays the aliases `opus`, `sonnet`,
`haiku`, which float to the newest model and which VS Code maps for Copilot. The Codex
and Copilot rows name concrete models and change when a vendor ships: check the
catalogue (the Codex models page; GitHub's supported-models reference) and name the
source in the commit message. The tests pin the table's shape, not its values.

Release flow: `npm version <level>` → `npm publish` (needs 2FA) → `git push --follow-tags`.
Try it locally first: `npm pack`, copy the tarball into another repository and run
`npx ./pincer-workflow-<version>.tgz init` there (the `./` matters). The Claude Code plugin channel is paused; the wiki under
`docs/wiki/` is frozen.
