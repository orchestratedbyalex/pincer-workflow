# Release checklist

What `/pincer-release` audits before the person accepts. Read-only: every item is
checked from `scripts/pincer-status.sh` output or from git, and a failure goes back to
its stage through a new ticket. Pass or fail per item, one sentence of evidence each.

## Tickets

- [ ] `scripts/pincer-status.sh` prints the agreement line and no `Warnings:` block
- [ ] every ticket of the change is `done` with `verified` on its status line
- [ ] no ticket line reads `invalid`
- [ ] `git log --oneline` shows one `T-NN: <title>` commit per ticket, in dependency order

## Evidence

- [ ] `git status --short` is empty before the audit and after it
- [ ] every command in `repo.checks` passes when run directly, output quoted
- [ ] with evidence on: `node scripts/pincer-evidence.cjs validate <manifest> --candidate <sha>` prints `ok <sha>` and every artifact it lists is tracked
- [ ] with `stages.release.audit` = `pr`: the pull request is merged, its checks are green, and the deploy named in `systems.deploy` was observed

## Review

- [ ] the review report exists (a file under the evidence home, or the PR comment) and every finding has a file, a line and a disposition
- [ ] every fix after evaluate went through its own ticket and `T-NN:` commit, never an ad-hoc commit
- [ ] no secret environment file is tracked: `git ls-files | grep -i '^\.env'` shows only `.env.example`

## Acceptance

- [ ] the person saw the result and every ticket's `Done when` lines before being asked
- [ ] every done ticket shows `accepted by <name>` in status, the name from `people` with `accepts: true`
- [ ] `accepted_words` holds the person's own words, not a paraphrase
- [ ] the audit wrote nothing but the acceptances: no `verify`, no `done`, no ticket edits, and `git status --short` is still empty
