# integration-untested — retries for an untested client

A change to an integration that has no tests at all. The base repository has
`src/client.js`, which takes its transport as an argument, and an empty `test/` directory.

## Task

`fetchJson(transport, url)` calls `transport(url)` and returns the parsed body. Give it
retry behaviour and the tests it has never had:

- a response with `status` 200 resolves with `JSON.parse(body)`;
- a response with `status` 500, 502 or 503 is retried, up to **two** retries (three calls
  in total), with the last response's status in the error if they all fail;
- a response with `status` 400 or 404 is **not** retried: it rejects immediately with
  `Error` whose message is `request failed: <status>`;
- after exhausting the retries it rejects with `Error` whose message is
  `request failed after 3 attempts: <status>`;
- a body that is not valid JSON rejects with `Error` whose message is `invalid JSON body`,
  and is not retried.

Add tests that `npm test` runs, using a fake transport. Commit your work.

## Changes

1

## Prompt 1

Read BRIEF.md in this repository and implement what it asks for, committing your work as
you go. Work autonomously; when you are done, stop and summarize what you changed.
