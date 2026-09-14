# cli-installer

`bin/pincer.js` — the whole CLI in one dependency-free ESM file (Node ≥22, the
`engines` floor since `e07faca`; 18 and 20 are end of life):
`init`, `update`, `doctor`. Distributed via `npx pincer-workflow`.

## How it works

- **Platform sets** (`PLATFORM_ROOTS`): `common` is 13 roots — AGENTS.md; three docs
  (`docs/release-checklist.md`, `docs/dry-run-checklist.md`, `docs/runtime-contracts.md`);
  five script entries plus the runtime directory (`scripts/sync-prompts.sh`,
  `pincer-ticket.sh`, `pincer-status.sh`, `pincer-evidence.cjs`, `pincer-runtime.cjs`,
  `scripts/pincer-runtime`); AND `.claude/commands|agents|references` (the canonical
  playbooks, rubrics and templates every adapter points at — since 0.2.3;
  before that a Codex- or Copilot-only install had skills pointing at files
  that were never installed); `claude` = CLAUDE.md, `.claude/settings.json`,
  `.claude/hooks`; `codex` = `.codex`, `.agents`; `copilot` = `.github`.
- **Manifest** `.pincer.json`: `{ schema: 2, version, platforms, files: {rel: sha256|null} }`
  (schema 2 since M0, 2026-09-05). Written on every install/update. It is the
  baseline that lets `update` distinguish "user edited this" from "template
  changed." A manifest without `schema: 2` is untrusted: every differing file
  becomes a `.new` proposal ([[never-clobber-updates]]). `scripts/pincer-ticket-lib.sh`
  is **no longer shipped by any set** — T-36 deleted it and `bin/pincer.js` now lists it
  in `OBSOLETE` (though `update` still leaves the old copy in installed projects — see
  [[open-threads]]).
- **Local tarball install** (dry runs of an unpublished branch):
  `npm pack`, then `npx --yes --package <tgz> pincer init --platform claude`.
  Running `npx <tgz> init` directly fails with "Permission denied" because
  the bin name is `pincer`, not the package name.
- **Copy logic** (`install()`, shared by init and update): missing → write;
  identical → skip; differs + hash matches manifest (untouched since install)
  → refresh; differs + hash doesn't match (user edit) → write `<file>.new`
  sidecar, keep tracking the user's version as baseline ([[never-clobber-updates]]).
- **Post-copy**: chmod 755 on all five `EXECUTABLES` (`scripts/sync-prompts.sh`,
  `pincer-ticket.sh`, `pincer-status.sh`, `.claude/hooks/block-dangerous.sh`,
  `.claude/hooks/ticket-guard.sh`); `.gitignore` gets
  `.env` / `.env.*` / `!.env.example` appended only if missing (never ships a
  gitignore in the template — npm strips those).
- **doctor**: files present, exec bits, gitignore coverage, version currency,
  unmerged `*.new` leftovers; exits 1 on problems.

## Key files

- `bin/pincer.js` — everything
- `test/smoke.test.js` — the full lifecycle in a temp dir (init → refuse
  re-init → edit → update conflict → doctor fail → merge → doctor pass);
  `test/installer.test.js` covers the installer's other paths;
  `test/distribution.test.js` regenerates adapters and plugin in isolation
  and compares byte-for-byte, then `npm pack`s and installs the tarball for
  every platform set, greenfield and brownfield; `test/helpers.js` is shared.

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
