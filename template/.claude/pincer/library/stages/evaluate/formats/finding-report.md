---
owner: the session, merging the roster's findings
home: <homes.evidence>/<candidate>/review/report.md when stages.evaluate.where is local; the PR comment when it is pr
readers: AI → human (the person and the release stage); AI → AI (fix tickets are written from it)
shape: a header naming the candidate and the reviewers, then the findings ordered by severity, security first, each with a disposition
---
# Finding report

One report per candidate. Findings keep the finding format and gain a disposition:
`fix now (T-NN)` when a ticket is opened for it, or `known issue` with the person's
agreement. Order: security first, then correctness, silent failures, spec drift,
coverage, history, standards, accessibility. A section with no findings is written as
"none", so the reader knows it was looked at.

```markdown
# Review of <candidate short sha>

Base <base short sha>, candidate <candidate short sha>. Reviewers: <names>; <inline or dispatched>.
Spec: <path>. Requirements: R-01 delivered, R-02 blocked (see finding 1).

## Security
<findings or "none">

## Correctness
...

## Silent failures
...

## Spec drift
...

## Other (coverage, history, standards, accessibility)
...

## Not reported
<count> findings under 70 confidence; style opinions dropped.
```

## Example

```markdown
# Review of 3f9c2a1

Base 8b1d0e4, candidate 3f9c2a1. Reviewers: code-quality-reviewer, silent-failure-hunter,
security-reviewer; dispatched. Spec: specs/rate-limit-login.md. Requirements: R-01
delivered, R-02 delivered.

## Security
none

## Correctness
- `src/routes/login.ts:42` — the rate limiter keys on `req.ip` before the proxy
  middleware runs, so every client behind the load balancer shares one counter.
  Scenario: two users behind the office proxy → the second is refused after the
  first's ten attempts. Fix: register the limiter after `trustProxy`.
  Confidence: 90. Disposition: fix now (T-04).

## Silent failures
- `src/middleware/limit.ts:17` — a failed counter write is caught and ignored, so
  the limit silently stops counting. Scenario: the store throws → every attempt
  passes. Fix: log and refuse closed. Confidence: 80. Disposition: fix now (T-04).

## Spec drift
none

## Other (coverage, history, standards, accessibility)
none

## Not reported
2 findings under 70 confidence; style opinions dropped.
```
