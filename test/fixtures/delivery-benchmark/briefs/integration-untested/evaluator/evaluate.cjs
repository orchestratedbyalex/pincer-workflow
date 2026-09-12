'use strict';
// Held-out evaluator for integration-untested: each behaviour is a hidden test file run
// in its own child process with a hard timeout, so a client that hangs fails instead of
// hanging the evaluator.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    const scenario = (id, title, file, timeout) => kit.hidden(ctx, id, title, file, { timeout });
    return [
      scenario('success', 'a 200 resolves the body with one request', 'success.test.cjs', 15000),
      scenario('retry', 'two 503s then 200 resolves after three requests', 'retry.test.cjs', 15000),
      scenario('exhausted', 'three 503s reject UPSTREAM with attempts 3', 'exhausted.test.cjs', 15000),
      scenario('no-retry-4xx', 'a 404 rejects REJECTED after one request', 'reject.test.cjs', 15000),
      scenario('timeout', 'a hanging server rejects TIMEOUT within the budget', 'timeout.test.cjs', 15000),
      kit.npmTest(ctx, { timeout: 60000 }),
      kit.evidenceBinding(ctx)
    ];
  }
};
