---
ticket: T-31
status: done
size: M
prd: .prd/prd-v4.md
depends_on: [T-30]
started: 2026-09-11T09:51:00Z
last_check: 2026-09-11T09:55:27Z passed b5f98bf01619
verified: 2026-09-11T09:55:27Z b5f98bf01619
finished: 2026-09-11T09:55:27Z
---

## Objective
Implement the shared parser module in Node with the same supported grammar and diagnostics as the Bash validators, plus the normalizations the contracts define, so one implementation validates tickets, PRDs and NOTES on every platform.

## Context
- Relevant files: new `template/scripts/pincer-runtime.cjs` (entry point with a `validate` command), new `template/scripts/pincer-runtime/parse.cjs`, `template/scripts/pincer-ticket-lib.sh` (the awk rules to port, unchanged in this ticket), `test/validation.test.js` (the malformed table, reused as the acceptance set), new `test/runtime-parse.test.js`.
- PRD section: R-02 (supported syntax), R-04 (normalization), R-09 (restricted grammar, reject unsupported syntax), contracts `## Supported grammar` and `## Content revisions`.
- Implements: R-02, R-04, R-09 (S-05 and S-12 static parts, S-29 grammar part)

## Requirements
- `parse.cjs` exports: `parseFrontmatter(text)`, `validateTicket(file, text)` returning `{ ok, problems[], ticket }` with diagnostics matching the Bash wording (`frontmatter must begin with ---`, `duplicate frontmatter key`, `unindented key: value`, `status must be open, in_progress, or done`, `canonical ID`, `match filename`, `size must be S, M, or L`, `ISO UTC timestamp`, `depends_on must be an inline list`, `duplicate depends_on`, `cannot depend on itself`, `noncanonical ticket ID`, `Acceptance Criteria requires at least one nonempty checkbox`, `malformed acceptance checkbox`, `duplicate Acceptance Criteria`, `Verification requires exactly one closed runnable bash fence`, `exactly one bash fence`, `duplicate Verification`, `invalid bash syntax`, `tilde fences are unsupported`), `verificationCommands(text)`, `unticked(text)`, `validatePrd(ref, text)` (version matches filename, status draft|ticketed|built, profile small|standard), `validateMetadata(text)`, `normalizeTicket(text)`, `normalizePrd(text)`, `checkDigest(text, timeoutSeconds)`, `ticketDigest`, `prdDigest`, and `validateTicketSet(dir)` (duplicate IDs, ambiguous files).
- The optional `timeout` frontmatter field must be a positive integer number of seconds; anything else is a validation error. The effective timeout defaults to 600.
- `node scripts/pincer-runtime.cjs validate <file>...` prints one `pincer-ticket: <file>: <problem>` or `pincer: <file>: <problem>` line per problem to stderr and exits 4 on invalid input, 0 when valid; `--digests` prints `ticket`, `check` and `prd` digests as `key value` lines.
- `test/runtime-parse.test.js` runs the malformed table from `test/validation.test.js` against the Node validator with the same diagnostic patterns, every supported checkbox marker, the fenced-example case, PRD profile cases, and the normalization cases: ticking a box, changing `status`/`started`/`finished`/`verified`/`last_check` leaves `ticketDigest` unchanged; editing acceptance text, the Verification block, `depends_on`, `size` or `timeout` changes it; changing a PRD `status` leaves `prdDigest` unchanged while any other edit changes it. It is added to `npm test`.

## Acceptance Criteria
- [x] Every malformed case rejected by the Bash validator is rejected by the Node validator with a matching diagnostic; every valid case is accepted.
- [x] Normalization matches the contract: lifecycle fields and checkbox marks are the only exceptions; unsupported `timeout` values are rejected.
- [x] `npm test` passes with the new suite.

## Verification
Proves: the Node parser accepts the supported grammar, rejects each malformed form before any mutation, and normalizes exactly the contracted fields; regression: a malformed ticket accepted, a valid one rejected, or a checkbox tick changing the authored digest.
```bash
node test/runtime-parse.test.js && npm test
```

## Constraints
- Do not change the Bash scripts or their tests; the wrappers switch in T-33 and T-36.
- No parser dependency: Node built-ins only.
