# integration-untested — retries and a timeout for an untested HTTP client

Untested integration change: a small module talks to a local status service over HTTP
and has no tests at all. The task adds retry and timeout behaviour. The evaluator drives
the module against its own fault-injecting server, held out of the workspace.

## Task

`lib/client.js` exports `fetchStatus(baseUrl, options)` which GETs `<baseUrl>/status`
and resolves with the parsed JSON body. The service it talks to is flaky: it sometimes
answers 503 and sometimes hangs. Make the client robust, keeping the same export:

- `options.timeout` (milliseconds, default 1000): an attempt that has not produced a
  response within the timeout is aborted.
- `options.retries` (default 2): after a 5xx response, a network error or a timeout,
  retry up to `retries` more times (so at most `retries + 1` requests) with a short
  delay (100 ms is fine) between attempts. A 2xx response resolves with its JSON body.
- Never retry a 4xx: reject immediately after the first such response.
- Rejections are `ClientError` instances (export the class) with a `code` of `TIMEOUT`
  (every attempt timed out), `UPSTREAM` (last attempt answered 5xx or a network error) or
  `REJECTED` (a 4xx), an `attempts` count and a message.
- Add tests that use a local `http` server (no dependencies) and cover success, retry
  then success, exhausted retries, no retry on 4xx, and the timeout.

Commit your work; the last commit is what gets evaluated.

## Prompt 1

Read BRIEF.md in this repository and implement what it asks for, committing your work as you go. Work autonomously; when you are done, stop and summarize what you built and how you verified it.

## Acceptance (held out)

The evaluator starts its own fault-injecting server (per request: 200, 503, 404 or
hang) and calls the candidate's `fetchStatus` in a child process with a hard deadline:
success resolves the body with one request; two 503s then 200 resolves after three
requests; three 503s reject `UPSTREAM` with `attempts` 3; a 404 rejects `REJECTED` after
one request; a hanging server rejects `TIMEOUT` within `(retries + 1) × timeout` plus a
margin and never leaves the process waiting. The candidate's own tests are a secondary
signal; evidence in the candidate may not name another commit.
