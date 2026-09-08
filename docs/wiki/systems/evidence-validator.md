# evidence-validator — template/scripts/pincer-evidence.cjs

Read-only, dependency-free CommonJS helper (Node ≥18) that validates evidence
schema 1 manifests. Ships on every channel: `bin/pincer.js` `common` list,
`scripts/build-plugin.sh` copies it to `plugin/scripts/`, and
`test/distribution.test.js` checks the tarball, each installer layout and the plugin.
Decision context in [[candidate-evidence]].

## CLI

```
node scripts/pincer-evidence.cjs validate <manifest> [--candidate <sha>] [--base <sha>] [--prd .prd/prd-vN.md] [--files]
node scripts/pincer-evidence.cjs digest <file>...
```

Rules added by T-21 (evaluation findings): `--base` must match the manifest's
`base`; a visual check needs an image only when `result: passed`, so an
`unverified` visual check (no browser) is representable and, when `required`,
blocks readiness; `evidence_validate` in the Bash lib omits any flag whose value
is malformed and `evidence_reason` labels exit-2 output `validator usage:`, so a
bad NOTES.md field never shows up as a manifest verdict; `notes_current` diffs
with `git -c core.quotePath=false diff --name-only --relative` so subdirectory
projects and non-ASCII artifact names compare correctly; candidates are 40-hex
only.

`validate` exits 0 and prints `ok <candidate>` (plus manifest and artifact paths with
`--files`); failures print `evidence: <manifest>: <reason>` per problem to stderr and
exit 1; usage errors exit 2. Repository root is `CLAUDE_PROJECT_DIR`, else
`git rev-parse --show-toplevel`, else cwd; root and manifest path go through
`realpathDeep` so macOS `/var` → `/private/var` symlinks above the repo do not break
containment checks.

## Schema 1 (all keys required, unknown keys rejected)

`schema: 1`, `prd`, `base`, `candidate` (40-hex, candidate must equal the directory
name, prd version must equal the `prd-vN` directory), `created` (ISO UTC),
`environment {os, node, tools[], limitations[]}` (strings ≤2000 chars, no other keys),
`coverage_review` (nonempty), `requirements[] {id — the PRD's own ID, uppercase
prefix-dash-digits such as R-01 or REQ-1 (T-20, after the brownfield trial had to
rename supplied IDs), disposition
delivered|blocked|deferred, tickets[], checks[], note?, authorized_by?}`,
`checks[] {id C-NN, kind command|visual|review, required, result
passed|failed|unverified, command?, timestamp, artifacts[], scenario?, viewport?,
observed?, note?}`, `visual_review {applicable, reason?}`, `artifacts[] {path, sha256}`.

Failure classes (each covered in `test/evidence.test.js`): missing, malformed JSON,
unknown schema, unknown key, wrong candidate/PRD (directory or flag), dangling check or
artifact reference, duplicate IDs/paths, unreferenced artifact, absolute/traversal/
backslash path, artifact outside the manifest directory, symlinked file or directory
component, missing file, digest mismatch, required check not passed, blocked
requirement, deferred without `authorized_by`, delivered without checks, visual check
without image or without scenario/viewport/observed, `visual_review.applicable: true`
with no visual check or `false` without reason, environment dumps.

## Callers

- `pincer-ticket-lib.sh`: `evidence_validate` and `evidence_reason` wrap the helper;
  `notes_current` uses `--files` to learn the allowed post-candidate change set.
- `pincer-status.sh`: prints `Evidence <manifest> · ok|<reason>` when NOTES.md names a
  manifest.
- Release playbook reads the verdict through status; never re-implements checks.

## Gotchas

- Artifacts must live under the manifest directory; shared files elsewhere under
  `.prd/evidence/` are rejected on purpose.
- `checks[].artifacts` strings must exactly equal an `artifacts[].path`.
- The helper never writes; evaluate authors the manifest by hand with `digest`.
