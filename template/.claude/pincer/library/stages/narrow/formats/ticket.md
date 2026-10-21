---
owner: the session writes it in narrow; the person accepts it in release
home: <homes.tickets>/T-NN-<slug>.md; with stages.narrow.tickets = forge the issue holds the discussion and forge: points at it
readers: AI → AI (code builds it, evaluate reviews against it) and AI → human (the person checks it and accepts it)
shape: this template; the example below
---
# Ticket

Filename `T-NN-<slug>.md`. The parser requires the frontmatter keys `ticket`, `status`,
`size` and `depends_on`; `spec`, `forge` and `timeout` are optional. The lifecycle
fields (`status` after creation, `started`, `last_check`, `verified`, `finished`,
`accepted`, `accepted_by`, `accepted_words`) are written only by
`scripts/pincer-ticket.sh`; never by hand.

````markdown
---
ticket: T-NN
status: open
size: S                      # S | M | L, relative; split when it helps verification
spec: specs/<name>.md        # omit when plan is off
depends_on: []               # e.g. [T-01]
timeout: 600                 # optional, seconds; verify records interrupted when it expires
forge: https://...           # only when stages.narrow.tickets = forge
---

## Objective
One sentence: what to build and why.

## Who reads this
Who picks this up, and how far the builder should get on its own before asking.

## Context
- Relevant files: `src/...` (what is there, what to follow)
- Implements: R-01, R-03 (omit when plan is off; enabling work states its purpose in the Objective)

## Decisions so far
- What was already decided, and by whom, so the builder does not reopen it.

## Open questions
None.

## Requirements
- Concrete and checkable: which errors, and what the user sees.

## Acceptance Criteria
- [ ] Observable behavior 1
- [ ] The reject path, when the surface takes external input

## Verification
Proves: what this check establishes and which regression it detects.
```bash
npm test -- --grep "<the feature>"
```

## How the person checks
Before merge: what to run or open. After merge: what to look at, where it runs.

## Done when
The outcome in one or two lines, ending where the person accepts. The script fills
`accepted`, `accepted_by` and `accepted_words` in the frontmatter when they do.

## Constraints
- What not to do: the tempting adjacent work that is out of scope.
````

Rules: exactly one `## Acceptance Criteria` section with checkboxes, every unchecked
one blocks `done`. Exactly one `## Verification` section with one fenced `bash` block
that exits 0 only when the ticket is done; `verify` runs it verbatim. `Proves:` comes
first and says what the check establishes; a check must fail when the behavior is
wrong, not only when a name changes. A tool the check needs but cannot run yields an
explicit `unverified`, never invented output. Split a ticket that has separate
dependencies, owners or verification paths.

## Example

````markdown
---
ticket: T-03
status: open
size: S
spec: specs/rate-limit-login.md
depends_on: [T-02]
---

## Objective
Refuse the eleventh login attempt from one IP within a minute with `429` and `Retry-After`.

## Who reads this
The session building this change; get as far as a green check on your own, ask only
if the proxy header rule in the spec's Security section is unclear.

## Context
- Relevant files: `src/routes/login.ts` (the handler), `src/middleware/` (where the limiter goes)
- Implements: R-01

## Decisions so far
- In-memory counter per instance; Alex accepted that one instance is enough (spec, Out of scope).

## Open questions
None.

## Requirements
- The limiter keys on the client IP from the trusted proxy header, else the socket address.
- The tenth attempt in a minute passes; the eleventh gets `429` and a `Retry-After` in seconds.

## Acceptance Criteria
- [ ] Ten attempts in a minute are handled normally
- [ ] The eleventh attempt returns `429` with `Retry-After`
- [ ] A successful login is unaffected below the limit

## Verification
Proves: the limit boundary (10 pass, 11 refused) and that normal logins still work; it catches an off-by-one and a limiter that refuses everyone.
```bash
npm test -- --grep "rate limit"
```

## How the person checks
Before merge: `npm test -- --grep "rate limit"`. After merge: eleven quick logins against
staging; the last one shows the `429` page.

## Done when
Bots see `429` after ten tries and Alex has logged in normally on staging.

## Constraints
- No captcha, no account lockout, no shared store.
````
