# cli-installer

`bin/pincer.js` — the whole CLI in one dependency-free ESM file (Node ≥18):
`init`, `update`, `doctor`. Distributed via `npx pincer-workflow`.

## How it works

- **Platform sets** (`PLATFORM_ROOTS`): `common` = AGENTS.md, checklist, the
  three scripts AND `.claude/commands|agents|references` (the canonical
  playbooks, rubrics and templates every adapter points at — since 0.2.3;
  before that a Codex- or Copilot-only install had skills pointing at files
  that were never installed); `claude` = CLAUDE.md, `.claude/settings.json`,
  `.claude/hooks`; `codex` = `.codex`, `.agents`; `copilot` = `.github`.
- **Manifest** `.pincer.json`: `{ version, platforms, files: {rel: sha256} }`.
  Written on every install/update. It is the baseline that lets `update`
  distinguish "user edited this" from "template changed."
- **Copy logic** (`install()`, shared by init and update): missing → write;
  identical → skip; differs + hash matches manifest (untouched since install)
  → refresh; differs + hash doesn't match (user edit) → write `<file>.new`
  sidecar, keep tracking the user's version as baseline ([[never-clobber-updates]]).
- **Post-copy**: chmod 755 on the hook and sync script; `.gitignore` gets
  `.env` / `.env.*` / `!.env.example` appended only if missing (never ships a
  gitignore in the template — npm strips those).
- **doctor**: files present, exec bits, gitignore coverage, version currency,
  unmerged `*.new` leftovers; exits 1 on problems.

## Key files

- `bin/pincer.js` — everything
- `test/smoke.test.js` — full lifecycle in a temp dir (init → refuse re-init →
  edit → update conflict → doctor fail → merge → doctor pass)

## Gotchas

- `execFileSync` failures in tests: the CLI's message is in `err.stdout`/`err.stderr`,
  NOT the Error message — the test's `runFail` helper exists for this.
- Codex channel = repo-local **skills**: `PLATFORM_ROOTS.codex` is
  `['.codex', '.agents']`; `sync-prompts.sh` emits
  `.agents/skills/pincer-*/SKILL.md` (frontmatter `name`+`description`,
  `$ARGUMENTS` → prose, `/pincer-*` → `$pincer-*` with a guard so
  `scripts/pincer-status.sh` survives). Codex **removed custom prompts and
  `~/.codex/prompts/`** in openai/codex#16115 (2026-03-28); 0.2.0/0.2.1 shipped
  a dead copy step (0.2.1 even invented a `/prompts:` prefix from stale docs) —
  the two clean Codex dry runs on 2026-09-02 caught both. Skills are invoked by
  `$pincer-plan <brief>` mention, listed via `/skills`
  ([[distribution-channels]]).
- BSD sed has no `\|` alternation in basic regex — use two `-e` expressions
  (bit the `/pincer-*` rewrite in `sync-prompts.sh`).
