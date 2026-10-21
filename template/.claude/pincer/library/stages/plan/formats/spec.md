---
owner: the person who accepts owns it; the session drafts it
home: <homes.specs>/<name>.md in the repository; with stages.plan.spec = forge the issue holds the discussion and the file points at it with forge:
readers: AI → human for the approval; then AI → AI (narrow builds tickets from it, evaluate and release check against it)
shape: this template; the example below
---
# Spec

Frontmatter: `status` (`draft`, then `approved` when the person says so, then `built`
when code finishes), `date`, and `forge: <url>` when the issue holds the discussion.
Requirements carry stable `R-NN` IDs, assigned once and never renumbered: tickets name
the IDs they implement. A
revision keeps the file and its IDs and adds to them. An interface example may
clarify a contract; implementation code is not a requirement.

````markdown
---
status: draft
date: YYYY-MM-DD
forge: https://github.com/<owner>/<repo>/issues/<n>   # only with stages.plan.spec = forge
---
# <name>

## Problem
Who has it, what it costs, and where the brief lives (quote it or link it).

## Scope
| This spec covers | This spec does not cover |
| --- | --- |
| ... | ... |

## Requirements
### R-01 — short title
What must be true, observably. Name the failure path and, in brownfield work, the
behavior that must not change.

### R-02 — short title
...

## Success criteria
| Criterion | How to verify |
| --- | --- |
| ... | a command to run, or a thing to observe |

## Out of scope
Explicit list. A cut made later is appended here with its reason.

## Security (when the project handles secrets or external input)
Trust boundaries: the untrusted inputs, where each is validated, which secrets exist
and where they live.

## Visual direction (when there is a user interface)
What it should feel like; what it must not look like.

## Approval
<name>, <date>: "<their words>"
````

## Example

````markdown
---
status: approved
date: 2026-10-21
---
# Rate-limit the login endpoint

## Problem
Credential-stuffing bots hit `POST /login` thousands of times a night; the brief from
Alex (2026-10-20, chat): "slow them down without locking real people out".

## Scope
| This spec covers | This spec does not cover |
| --- | --- |
| a per-IP limit on `POST /login` | captchas, account lockout, other endpoints |

## Requirements
### R-01 — limit per IP
More than 10 attempts from one IP in a minute get `429` with `Retry-After`; the
eleventh attempt is refused, the tenth is not. Existing successful logins keep working.

### R-02 — operators can see it
Each refusal is logged with the IP and the window, never with the password.

## Success criteria
| Criterion | How to verify |
| --- | --- |
| the eleventh attempt in a minute is refused | `npm test -- --grep "rate limit"` |
| a normal login still works | the same test file's happy path |

## Out of scope
Distributed counting across instances; one instance is enough for now.

## Security
The IP comes from the proxy header only when the proxy is trusted; otherwise the socket
address. No secret is involved.

## Approval
Alex, 2026-10-21: "yes, build it like this"
````
