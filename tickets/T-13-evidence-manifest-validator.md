---
ticket: T-13
status: open
size: L
prd: .prd/prd-v2.md
depends_on: []
---

## Objective
Define evidence schema 1 and ship a dependency-free, read-only Node validator for candidate evidence manifests, packaged on every channel.

## Context
- PRD: `.prd/prd-v2.md`, requirement R-03 and the Architecture and compatibility section. Implements: R-03 (validator half); R-04 and status/release integration follow in T-15.
- New file `template/scripts/pincer-evidence.cjs` (CommonJS so it runs under `node` regardless of the host project's `type` field; Node ≥18; no dependencies).
- Packaging: `bin/pincer.js` `common` file list (line ~29), `scripts/build-plugin.sh` copies scripts explicitly, `test/distribution.test.js` packed-file list and per-platform layout expectations.
- `test/helpers.js` for temporary repositories; new `test/evidence.test.js`.

## Requirements
Evidence layout: `.prd/evidence/prd-v<N>/<candidate-40-hex>/manifest.json`, with every artifact file inside that same directory (subdirectories allowed).

Manifest schema 1 (JSON object; unknown top-level keys are rejected):
- `schema`: integer `1`. Any other value fails with `unknown evidence schema`.
- `prd`: `.prd/prd-vN.md`; must match the manifest's `prd-vN` directory.
- `base`, `candidate`: full 40-hex commit IDs; `candidate` must match the directory name.
- `created`: ISO-8601 UTC timestamp.
- `environment`: object with `os`, `node` strings, `tools` string array, `limitations` string array (may be empty). Redacted summaries only; the validator rejects values longer than 2000 characters as a guard against environment dumps.
- `coverage_review`: nonempty string (the recorded agent/reviewer judgment on mapping completeness).
- `requirements`: nonempty array of `{id: "R-NN", disposition: "delivered"|"blocked"|"deferred", tickets: ["T-NN"...], checks: ["C-NN"...], note?: string, authorized_by?: string}`. IDs unique; `deferred` requires nonempty `authorized_by`; every `checks` entry must exist in `checks` (dangling reference fails).
- `checks`: array of `{id: "C-NN", kind: "command"|"visual"|"review", required: boolean, result: "passed"|"failed"|"unverified", command?: string, timestamp: ISO UTC, artifacts: [repo-relative path...], scenario?, viewport?, observed?, note?}`. IDs unique. `command` kind requires `command`. `visual` kind requires `scenario`, `viewport`, `observed` and at least one artifact whose path ends in `.png`, `.jpg`, `.jpeg` or `.webp`. Every referenced artifact must be listed in `artifacts` (dangling fails).
- `visual_review`: `{applicable: boolean, reason?: string}`; when `applicable` is `false`, `reason` is required (non-UI changes state why).
- `artifacts`: array of `{path, sha256}` with unique paths, 64-hex digests, each path repo-relative (no leading `/`, no drive letter, no `..` segment, no backslash), inside the manifest directory, an existing regular file (not a symlink, and no symlink in any path component below the repository root), with a matching SHA-256. Every listed artifact must be referenced by at least one check (unreferenced fails).
- Any `required: true` check with result `failed` or `unverified` fails validation with the check ID and result named.

CLI (`node scripts/pincer-evidence.cjs <command> ...`):
- `validate <manifest> [--candidate <sha>] [--prd <ref>] [--files]`: exit 0 and print `ok <candidate>` on success; with `--files`, additionally print the manifest path and each artifact path one per line (repo-relative). On failure print one `evidence: <manifest>: <reason>` line per problem to stderr and exit 1. `--candidate`/`--prd` mismatches fail with `wrong candidate` / `wrong PRD`. A missing or unreadable manifest fails with `missing`; invalid JSON fails with `malformed`.
- `digest <file>...`: print `<sha256>  <path>` per file (helper for authors).
- Usage errors exit 2. The validator never writes anything.
- Repository root is `CLAUDE_PROJECT_DIR`, else `git rev-parse --show-toplevel`, else the current directory.

Packaging: add the helper to `bin/pincer.js` `common`, `scripts/build-plugin.sh`, and the `test/distribution.test.js` packed list and every platform layout; the installer must ship it on Claude, Codex and Copilot installs.

`test/evidence.test.js` (temporary repositories, one per case): a complete manifest passes and `--files` lists the manifest and artifacts; rejects missing manifest, malformed JSON, unknown schema, missing artifact, tampered artifact (digest mismatch), dangling check reference, dangling artifact reference, duplicate check ID, duplicate artifact path, unreferenced artifact, wrong candidate (both directory mismatch and `--candidate` mismatch), wrong PRD, absolute path, `..` traversal, symlinked artifact, symlinked directory component, artifact outside the manifest directory, failed required check, unverified required check, visual check without image, deferred requirement without authorization, unknown top-level key. Add the file to the `npm test` chain.

## Acceptance Criteria
- [ ] `template/scripts/pincer-evidence.cjs validate` accepts a complete schema-1 manifest and rejects every failure class listed in Requirements with an actionable one-line diagnostic and exit 1.
- [ ] Escaping paths (absolute, traversal, symlink file, symlink directory, outside the manifest directory) are rejected; unknown schema versions fail explicitly.
- [ ] `--files` lists the manifest and every artifact path; `digest` prints SHA-256 digests; the validator writes nothing.
- [ ] The helper ships in the npm tarball, every installer platform layout and the plugin, as checked by `test/distribution.test.js`.
- [ ] `test/evidence.test.js` is in the `npm test` chain and passes.

## Verification
```bash
node test/evidence.test.js && grep -q 'evidence.test.js' package.json && node test/distribution.test.js
```

## Constraints
- No general Markdown/YAML parsing; JSON only with explicit checks.
- No network, no dependencies, no writes; do not integrate with status/release here (T-15).
- Validation establishes consistency of locally authored records, not that commands ran or images depict the application; say so in the file header.
