# PRD v6 artifacts

What a reviewer can inspect without re-running anything. Three directories:

| Path | Holds |
| --- | --- |
| `benchmark/` | the 36 paired live runs behind `docs/trial-prd-v6.md`: one `record.json` per run, the collected session logs, the aggregate `report.md` / `report.json` and `validate.out`, plus the tooling that produced them |
| `records/` | twelve runtime records — a coverage map, a schema 3 change record, an agreement snapshot, coverage and impact reports, an evidence manifest — as the commands actually wrote them |
| `replay.sh` | eight failure cases reproduced end to end (`bash docs/prd-v6-artifacts/replay.sh all`, about twenty seconds) |

## Publication

`docs/delivery-benchmark.md` states that a run writes nothing outside its `--runs`
directory and that sharing results is a separate decision. This directory is that
decision: these artifacts are published deliberately, so that the numbers in
`docs/trial-prd-v6.md` can be checked against the runs they came from rather than taken
on trust. Nothing here is required by the installed kit — `package.json` ships `bin` and
`template` only, so none of it reaches an npm consumer.

## What is removed, and what is not

`benchmark/collect.cjs` sanitizes as it copies, and the output tree is rebuilt from
scratch on every collect. It replaces the runs root, the scratchpad directory, the home
directory and the hostname literally, then rewrites any surviving absolute path under
`/private/tmp/claude-N`, `/tmp/claude-N`, `/Users/<user>`, `/home/<user>` or
`/var/folders` (the macOS per-user `$TMPDIR`, whose second segment is a per-user token)
as `<path>`. Account-state notices keep the reason a run was invalidated but not the
wall-clock time or timezone of the reset. Session logs are a field whitelist — identifier,
turns, durations, cost, usage, error flag and result text — so no full transcript is
copied, and workspaces are never copied at all.

Two things remain on purpose. Claude Code session identifiers are kept: they are the
identity of each run and what makes a record checkable against its own logs; they are
opaque and grant no access. Paths of the form `~/Documents/...` are the home directory
already replaced by `~`, and describe only the layout of this repository.

If you collect again, run `node docs/prd-v6-artifacts/benchmark/collect.cjs <runs-root>`
and commit the result; do not hand-edit files under `benchmark/runs/`.
