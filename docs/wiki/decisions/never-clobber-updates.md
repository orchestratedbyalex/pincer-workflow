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

See [[cli-installer]].
