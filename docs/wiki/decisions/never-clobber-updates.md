# never-clobber-updates

**Decided:** 2026-09-01

`pincer update` never overwrites a file the user edited. A sha256 manifest
(`.pincer.json`, written at install) records the as-installed hash of every
file. On update: current hash == manifest hash → safe to refresh in place;
hash differs → the user changed it, so the new template version lands as
`<file>.new` beside it and the manifest keeps tracking the user's version.
`doctor` fails while unmerged `*.new` files remain.

## Why

The kit is meant to be edited — AGENTS.md's Conventions section explicitly so,
playbooks legitimately per-project. An updater that clobbers user edits would
destroy exactly the customization the workflow encourages; one that never
updates anything would strand users on old versions. The hash baseline gives
both: silent refresh where safe, explicit merge where not.

## Alternatives rejected

- **Three-way merge** — real merge machinery (or git dependency) for marginal
  gain; `.new` + manual diff is transparent and dependency-free.
- **Overwrite with backup (`<file>.bak`)** — inverts the failure mode: a user
  who doesn't notice loses their edits from the live path.

## Manifest schema 2 (M0, 2026-09-05)

The baseline itself must be trustworthy. `.pincer.json` now carries
`schema: 2`; `readManifest` validates schema, platforms and paths. A manifest
without schema 2 (0.2.x installs) is treated as **untrusted**: every differing
file gets a `.new` proposal instead of an in-place refresh, and the manifest
records `null` for a conflicted file rather than the template hash.
`writeProposal` makes unique sidecar names so repeated updates never overwrite
an earlier proposal. Dry run 2026-09-08: an appended AGENTS.md line survived
`pincer update`, `AGENTS.md.new` appeared, 21 unchanged files were skipped.

See [[cli-installer]]; the same trust principle for tickets is
[[revocable-receipts]].
