# cli-installer

`bin/pincer.js` — the whole CLI in one dependency-free ESM file (Node ≥18):
`init`, `update`, `doctor`. Distributed via `npx pincer-workflow`.

## How it works

- **Platform sets** (`PLATFORM_ROOTS`): `common` (AGENTS.md, checklist, sync
  script) always installs; `claude`/`codex`/`copilot` add their roots.
  `init --platform` flag, or an interactive readline prompt on a TTY;
  non-TTY defaults to all three.
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
- `update` for Codex users prints a reminder to re-copy prompts to
  `~/.codex/prompts/` — Codex has no repo-local prompt loading
  ([[distribution-channels]]). The hint (shared `CODEX_INSTALL` const in
  `bin/pincer.js`) must start with `mkdir -p ~/.codex/prompts`: Codex never
  creates that directory, and on a fresh machine a bare `cp` dies with
  "Not a directory" (found 2026-09-02 on the first clean Codex dry run).
  Codex invokes custom prompts as `/prompts:pincer-plan`, not `/pincer-plan`.
