# Pincer kit maintenance checks

These checks apply to this distribution repository. They are separate from the generic
product release audit shipped to installed projects.

## Prepare before selecting a candidate

Finish and commit authored changes first. Choose the release version explicitly; PRD
numbers do not imply version numbers. From the distribution repository root:

```bash
node scripts/prepare-release.cjs --version 0.7.0 --preview
node scripts/prepare-release.cjs --version 0.7.0 --apply
```

The version above is an example, not a release decision. Exactly one mode is required.
Preview writes no files in the target repository, including its index or refs; it uses
and removes an external temporary directory. Apply validates in the same scratch workflow:
update package metadata, regenerate both adapters and plugin, check second-pass parity,
and pack with lifecycle scripts disabled and an isolated offline npm cache. The tarball's
layout, file bytes/modes and version must agree with the prepared tree and plugin.

The JSON report lists exact additions, updates and deletions. Only `package.json`,
`plugin/`, `template/.agents/skills/` and `template/.github/prompts/` are writable outputs.
All staged work and unrelated tracked/untracked changes are refused. Unstaged or untracked
owned outputs are permitted only when byte/mode-identical to the desired regenerated
files, so repeating successful preparation is a no-op, including newly generated files.
User edits differing from generated output are refused. Symlinks, escaping paths,
non-deterministic generators, unexpected generator writes and repository drift during
validation are refused. Existing ignored files are never overwritten as new outputs.

Scratch failure leaves target files unchanged. Files are applied sequentially only after
validation; an apply-time filesystem failure may leave partial effects. A failing JSON
report lists actually changed paths in `applied` and sets `partial: true`; inspect and
resolve those paths explicitly before retrying. Preparation never stages, commits, tags,
merges, selects a candidate, publishes or grants release readiness. Exit 2 is invalid CLI
usage; exit 1 is preparation failure; exit 0 is a validated preview or apply.

Review the exact diff, commit the prepared metadata/generated outputs, then select that
commit as the implementation candidate. Complete the candidate-wide checks, evaluation
and read-only release audit below. Later source or version changes stale evidence under
the existing exact artifact allowlist; version bumps get no special exemption.
Publication remains a separately authorized action.

## Candidate checks

- [ ] `npm test` passes every regression suite
- [ ] `node test/release-preparation.test.js` passes preview, apply, fault and candidate-freshness controls
- [ ] Regenerating Codex skills, Copilot prompts, and the Claude plugin in a clean temporary copy produces no diff
- [ ] The npm tarball contains dot-directories, canonical playbooks, helpers, and the structured hook parser
- [ ] Packed Claude, Codex, Copilot, and all-platform installs pass in greenfield and brownfield fixtures
- [ ] Plugin marketplace, manifest, and hook references resolve
- [ ] Linux and macOS CI runs the same candidate-wide gate at the supported Node floor
- [ ] Manual live-agent trials and the real-browser gate are reported separately from deterministic distribution checks
- [ ] Candidate-bound evaluation and the read-only release audit pass without broadening evidence exemptions
