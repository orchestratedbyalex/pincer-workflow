'use strict';
// Held-out evaluator for integration-untested. Retrying, NOT retrying, and what happens
// when the retries run out are three separate checks: a candidate that retries everything
// is wrong in a different way from one that retries nothing.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'retries', 'a retryable status is retried up to two times', 'retries.test.cjs'),
      kit.hidden(ctx, 'no-retry-on-4xx', 'a client error is not retried', 'no-retry.test.cjs'),
      kit.hidden(ctx, 'exhaustion', 'exhausted retries reject with the documented message', 'exhaustion.test.cjs'),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
