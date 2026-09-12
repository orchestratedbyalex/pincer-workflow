# PRD v6 fixtures — the PRD v5 runtime's readers, pinned

The modules under `scripts/pincer-runtime/` are byte-identical copies of
`template/scripts/pincer-runtime/{changes,agreement,parse,transaction,state,fsutil,evidence}.cjs`
at commit `00aad6d` on `feat/prd-v5` (the fixed v5 source PRD v6 was written against;
package version 0.5.0 plus the v5 change lifecycle). They are the *older runtime*
that tests load to prove that strict-coverage records (change record schema 3),
attempts (schema 3) and evidence (schema 3) are refused as `UNSUPPORTED_SCHEMA` or as
incomplete records, never interpreted. They are never edited and never regenerated
by the new runtime; `test/coverage-contracts.test.js` compares them with
`git show 00aad6d:…` whenever that object is available locally.
