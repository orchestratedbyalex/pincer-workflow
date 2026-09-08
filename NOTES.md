---
prd: .prd/prd-v2.md
base: 7a93f0768a72ebc11fd139784dfa0d7839e780a7
candidate: 72d2d8b73ab1de368d6646d32c1ba26c6124b467
evidence: .prd/evidence/prd-v2/72d2d8b73ab1de368d6646d32c1ba26c6124b467/manifest.json
---

# Evaluation — PRD v2: Make requirements and release evidence reviewable

Reviewed candidate `72d2d8b` against base `7a93f07` (main at v0.3.0), tickets
T-11..T-23. Evidence manifest: see frontmatter; validated with
`node template/scripts/pincer-evidence.cjs validate <manifest> --candidate 72d2d8b… --base 7a93f07… --prd .prd/prd-v2.md`.

## Requirement dispositions

| Requirement | Disposition | Where it lives | Checks |
| --- | --- | --- | --- |
| R-01 Carry observable requirements through delivery | delivered | PRD template Requirements section, plan/narrow/evaluate playbooks, ticket template `Implements:` (T-11); supplied-ID acceptance in the validator (T-20) | C-01 (workflow wording), C-05 (both trials mapped IDs to tickets and dispositions), C-06 (review) |
| R-02 Verify behavior and disclose what checks establish | delivered | `Proves:` policy in ticket template, narrow and code (T-12); `test/behavioral-verification.test.js` three controlled faults | C-01, C-05 (trial `Proves:` lines), C-06 |
| R-03 Persist and validate candidate evidence | delivered | `template/scripts/pincer-evidence.cjs`, schema 1, `test/evidence.test.js` (T-13); evaluate writes evidence (T-14); status/release read it (T-15); reviewer artifact (T-20) | C-01, C-05 (both trials validated `ok`), this evaluation itself, C-06 |
| R-04 Preserve candidate identity and read-only release audit | delivered | `notes_current` allowed set, `test/candidate.test.js`, release playbook and checklist (T-14, T-15) | C-01, C-04 (built commit precedes candidate here), C-05 (release PASS with clean tree in both trials) |
| R-05 Scale planning by risk and reuse authorization | delivered | `profile` validation, PRD template, shared authorization block (T-16); narrow finalization fix (T-20) | C-01, C-05 (both trials `profile: small` with rationale; greenfield narrow re-asked once before the T-20 fix) |
| R-06 Improve recovery and status without restoring stale success | delivered | verify message, one warning per problem, wall-clock elapsed rule, code playbook recovery section (T-17); `test/recovery.test.js` guard scenario | C-01; live observation of a failed recheck stays outstanding (trials had none) |

Coverage review: every requirement maps to at least one ticket and one executable
check; the R-05 "new consequential decision during narrow" and the R-06 live failed
recheck scenarios were not observed in the trials and are recorded as outstanding in
the trial documents, not as gaps in the kit. This mapping is my judgment as reviewer.

## Evaluation history

- Candidate `2952e62` (T-11..T-20) was reviewed and **rejected**: six defects
  (subdirectory and non-ASCII paths made `notes_current` false-stale, validator usage
  errors leaked as evidence verdicts, 64-hex mismatch, unchecked manifest `base`,
  whole-tree restores past the ticket guard) and two trial scenarios T-19 required
  but had not observed. Record: `.prd/evidence/prd-v2/2952e62…/` (no manifest).
- T-21 fixed the six and relaxed the visual-image rule; two focused trials covered
  the missing scenarios (no-browser evaluate, authorized deferral).
- The T-21 review found the whole-tree guard was still a literal-spelling list
  (force flags, globs, pathspec magic, `-C`, `checkout-index`, wrappers) and an NFD
  edge; T-22 normalizes pathspecs, handles wrappers, and compares evidence paths in
  git's canonical bytes. The T-22 re-probe found cheap residuals (`-C` with absolute or
  variable prefixes, bundled `-lc` flags, brace globs, case-folded `Git`, `xargs` stdin
  pathspecs, `-c alias.`) and one over-block (`git checkout "$BRANCH"`); T-23 fixed those
  and is covered by 233 hook payloads, without a third independent re-probe. Unlisted
  wrappers, `git archive | tar`, `find -exec` and `checkout-index --stdin` remain the
  guard's documented limit. Both reviews are saved under `review/` in this evidence
  directory and form the `review` check in the manifest.

## What was built

- Requirement IDs and scenarios travel from the PRD template through the narrow
  requirement map and each ticket's `Implements:` line to an evaluate disposition.
- Every ticket's Verification opens with `Proves:`; the policy forbids identifier
  greps as proof and word-matching as an adequacy test; three controlled faults in
  `test/behavioral-verification.test.js` show the difference.
- Evidence schema 1 and the read-only validator `template/scripts/pincer-evidence.cjs`
  (packaged in the tarball, every installer layout and the plugin), with 30+ rejected
  failure classes under test.
- `notes_current` requires an `evidence:` manifest that validates for the candidate,
  tracked files, and no changes after the candidate beyond NOTES.md and listed files;
  status prints an `Evidence` line; release reads through status and stays read-only.
- `profile: small|standard` in the PRD, validated at runtime; one authorization rule,
  byte-identical in four playbooks; no ticket cap, no default timebox.
- Fixed verify-failure text, duplicated warnings and the noisy elapsed line; recovery
  guidance that never restores a ticket from git.
- Dry-run checklist rewritten with five recorded scenarios and a trial-record
  template; README and template AGENTS.md describe the evidence contract.
- Two live Sonnet trials (greenfield, brownfield) in print mode, both PASS at release;
  their findings fixed in T-20. Two focused follow-up trials (no browser tool;
  user-authorized deferral) recorded as addenda.
- Evaluation fixes T-21 and T-22: `--relative`/canonical path comparison in
  `notes_current`, `--base`, malformed-flag omission, honest `unverified` visual
  checks, and a normalized whole-tree restore guard with wrapper recursion
  (210 hook payloads under test).

## What was cut and why

Nothing from the PRD was cut. Deferred by the PRD itself to M1/M2: runtime migration,
source-bound receipts, atomic transitions, authenticated approvals, requirement-impact
validation, automated repair, durable release records.

## Known issues

- `npm audit` cannot run in this repo (no dependencies, no lockfile); recorded as an
  unverified, non-required check (C-03).
- The R-05 "new consequential decision" and R-06 "failed recheck" behaviors were not
  observed live; they are covered by wording tests and `test/recovery.test.js` only.
- The trials ran in print mode with `bypassPermissions`; an interactive session with a
  human answering plan questions is untested. Other agent surfaces are untested.
- Evidence validation establishes record consistency, not that commands ran.
- The ticket guard is a pattern-based safety net for documented restore forms; it
  does not resolve shell state, aliases, or branch contents. The receipt and status
  checks remain the source of trust.

## What I'd do next

Merge to main, publish 0.4.0, then run the dry-run checklist interactively on one
surface and on Codex. Consider letting evaluate save the reviewer transcript
automatically (M1 runtime) rather than by playbook instruction.

## Handover

Read `docs/wiki/briefing.md` first, then `.prd/prd-v2.md` and this file. The kit
lives in `template/`; adapters and `plugin/` are generated (`template/scripts/sync-prompts.sh`,
`scripts/build-plugin.sh`) and `test/distribution.test.js` fails when they are stale.
Dependencies: none at runtime; tests use Node's built-ins only. The riskiest aging
assumption is the Bash/awk parsing in `template/scripts/pincer-ticket-lib.sh`
(frontmatter and Markdown are parsed by regex, deliberately limited); the least-tested
path is the interactive approval flow across real sessions, which only live trials
exercise. The evidence validator is the first Node runtime piece of the kit; if the
M1 runtime lands, it should absorb `notes_current`.
