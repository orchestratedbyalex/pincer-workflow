---
owner: the reviewer agent that found it; the session keeps or drops it
home: the review report (a file under the evidence home, or the PR comment) via finding-report
readers: AI → AI (the session merges them), then AI → human (the person reads the report)
shape: one entry per finding with the six fields below; nothing under 70 confidence
---
# Finding

Every reviewer returns the same shape so the evaluate stage can merge any set of
them. Six fields, in this order:

- **File** and **line**: `path:line`, the place a reader opens first.
- **Defect**: one sentence saying what is wrong, not what to do about it.
- **Failure scenario**: the concrete input or state and the wrong outcome it produces.
- **Suggested fix**: one or two sentences; the fix itself goes through a ticket.
- **Confidence**: 0 to 100. Below 70 the finding is not reported.
- **Category** (optional): security, correctness, silent failure, spec drift, coverage, history, standards, accessibility.

```markdown
- `src/routes/login.ts:42` — <defect in one sentence>
  Scenario: <input or state> → <wrong outcome>
  Fix: <one or two sentences>
  Confidence: 85 (security)
```

## Example

```markdown
- `src/routes/login.ts:42` — the rate limiter keys on `req.ip` before the proxy
  middleware runs, so every client behind the load balancer shares one counter.
  Scenario: two users log in from behind the office proxy within a minute → the
  second one is refused with 429 after the first's ten attempts.
  Fix: register the limiter after `trustProxy` so `req.ip` is the client address.
  Confidence: 90 (correctness)
```
