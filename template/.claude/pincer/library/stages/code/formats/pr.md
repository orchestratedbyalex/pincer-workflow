---
owner: the session drafts it; the person merges
home: the forge's pull request, opened with gh pr create after the last ticket of the run
readers: AI → human (the reviewer and the person who merges); the agreement's record of the change
shape: title `T-NN..T-MM: <change>` (or `T-NN: <title>` for one ticket); the body below
---
# Pull request

The body is the summary the person reads before merging; the ticket files hold the
detail, so the body points at them instead of repeating them.

````markdown
## What changed
Two to four sentences: the outcome, in the person's terms.

## Tickets
| Ticket | Title | Receipt |
| --- | --- | --- |
| T-NN | ... | verified <timestamp> |

## How to check
The commands to run and the thing to open, from the tickets' "How the person checks".

## Out of scope
What this change deliberately leaves alone, from the spec.

## Risks
What could break first, and how you would notice.
````

## Example

````markdown
## What changed
`POST /login` now refuses the eleventh attempt from one IP within a minute with `429`
and a `Retry-After` header, and logs each refusal with the IP and the window. Normal
logins are unaffected.

## Tickets
| Ticket | Title | Receipt |
| --- | --- | --- |
| T-02 | Client IP from the trusted proxy header | verified 2026-10-21T14:02:11Z |
| T-03 | Refuse the eleventh attempt with 429 | verified 2026-10-21T15:40:03Z |

## How to check
`npm test -- --grep "rate limit"`; on staging, eleven quick logins, the last shows the
`429` page.

## Out of scope
No captcha, no account lockout, no shared counter across instances.

## Risks
A misconfigured proxy would make every client share one IP and hit the limit together;
the limiter logs the IP it used, so that shows up in the first minute.
````
