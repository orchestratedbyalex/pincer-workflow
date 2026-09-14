# evidence-validator — template/scripts/pincer-evidence.cjs

Read-only, dependency-free CommonJS helper (Node ≥22) that validates evidence
manifests. Schema 1 is described below; the schema 2 (change-bound) and schema 3
(strict-coverage) validators live in `pincer-runtime/evidence.cjs` and this file is
their CLI. Ships on every channel: `bin/pincer.js` `common` list,
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
blocks readiness; a malformed NOTES.md field never shows up as a manifest verdict
(that was `evidence_validate`/`evidence_reason` in the Bash lib, which T-36 deleted —
the verdict is now produced in-process by `evidenceLine()`/`notesCurrent()` in
`pincer-runtime/status.cjs`); `notes_current` diffs
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

- `pincer-ticket-lib.sh` is gone; `notes_current` (legacy/migrated) and
  `locator.followers` (changes mode) are the runtime's own, and use the validated
  manifest's listed files to learn the allowed post-candidate change set.
- `pincer-status.sh`: prints `Evidence <manifest> · ok|<reason>` when NOTES.md names a
  manifest.
- Release playbook reads the verdict through status; never re-implements checks.

## Gotchas

- Artifacts must live under the manifest directory; shared files elsewhere under
  `.prd/evidence/` are rejected on purpose.
- `checks[].artifacts` strings must exactly equal an `artifacts[].path`.
- The helper never writes; evaluate authors the manifest by hand with `digest`.

## Schema 3 false `ok`s closed by T-83 (2026-09-13)

The validator is the artifact the contract offers a reviewer for evidence they did not
generate, so a false `ok` is the worst defect it can have. The evaluation found three
and each is now refused:

- A scenario whose linked check is **not declared in the map snapshot** was treated as
  vacuously satisfied and derived `delivered`.
- A candidate whose **PRD blob cannot be read** was reported as "not available in this
  repository" — false when the commit is present — and the map/change-record
  reconciliation was abandoned along with it.
- A **deferred or removed row's `authorization`** was shape-checked but never resolved
  in the candidate's committed change record.

## What validation does and does not establish

`ok` means the record is internally consistent with the committed candidate: the
manifest's structure, digests, references and dispositions agree with each other and
with what the repository actually contains. **It does not attest that the recorded
commands ever ran.** A reviewer who needs that reads the check logs and the CI run
IDs; the validator cannot and does not check it. The v5+v6 evaluation records `npm
audit` (C-10) as `unverified` carrying its real `ENOLOCK` output for exactly this
reason — the package has no dependencies and no lockfile, so there is nothing to audit
and nothing was fabricated.

Related: [[candidate-evidence]], [[runtime]], [[strict-coverage]].
