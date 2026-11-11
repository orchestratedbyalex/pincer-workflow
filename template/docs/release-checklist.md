# Release checklist

`/pincer-release` first audits without writing files, then records the person's
acceptance and commits only those acceptance fields. Technical checks must pass
before asking for acceptance. Mark acceptance items pending until the person has
responded; pending acceptance alone is not a technical audit failure. Final PASS
requires every applicable item below. Give one sentence of evidence per item.

## Tickets

- [ ] status prints the agreement; before acceptance, its only permitted warnings are `T-NN done without acceptance`; after acceptance there are no warnings
- [ ] every ticket of the change is `done` with `verified` on its status line
- [ ] no ticket line reads `invalid`
- [ ] `git log --oneline` shows one `T-NN: <title>` commit per ticket, in dependency order

## Evidence

- [ ] record the full evaluated `candidate` and pre-acceptance `audit_head`; their diff contains only retained evaluation artifacts and previously recorded acceptance fields, with no implementation, check, spec or agreement changes
- [ ] `git status --short` is empty before and after the read-only audit; no check wrote files or moved `HEAD`
- [ ] with tree audit, every command in `repo.checks` passes when run directly, output quoted
- [ ] with evidence on, `node scripts/pincer-evidence.cjs validate <manifest> --candidate <candidate>` prints `ok <candidate>` and every listed artifact is tracked; repeat after acceptance against the same original candidate
- [ ] with PR audit, the implementation PR is merged with green checks and the named deploy was observed; any acceptance PR required by the agreement is also merged with its required checks passing before final PASS

## Review

- [ ] the review report exists and every finding has a file, a line and a disposition
- [ ] every implementation fix after evaluate went through its own ticket and `T-NN:` commit, followed by a new evaluation
- [ ] no secret environment file is tracked: `git ls-files | grep -i '^\.env'` shows only `.env.example`, or no entries when no environment example is needed

## Acceptance

- [ ] the person saw the result and every ticket's `Done when` lines before being asked
- [ ] every done ticket shows `accepted by <name>` in status, the name from `people` with `accepts: true`
- [ ] `accepted_words` holds the person's own words, not a paraphrase or synthetic approval
- [ ] only `accept` wrote acceptance; the complete staged and committed diff from `audit_head` changes only `accepted`, `accepted_by`, and `accepted_words` in the intended tickets' frontmatter, never their body, receipt or any other file
- [ ] new acceptance is retained in a separate `accept: <candidate short sha>` commit; the verdict identifies both the evaluated candidate and acceptance commit, and `git status --short` is empty
- [ ] no push, merge or publication occurred without the user's authorization; any required remote acceptance step is complete or explicitly pending rather than passed
