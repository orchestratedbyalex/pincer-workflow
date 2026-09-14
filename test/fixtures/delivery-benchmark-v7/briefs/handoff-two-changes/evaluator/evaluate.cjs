'use strict';
// Held-out evaluator for handoff-two-changes. Each change is its own check, because the
// failure this brief is looking for is "the second session lost the first one's work" —
// which a single combined check would report as one undifferentiated rejection.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'change-1', 'format: symbols, negatives, zero and the unsupported currency', 'format.test.cjs'),
      kit.hidden(ctx, 'change-2', 'parse: the inverse of format, and unparseable text', 'parse.test.cjs'),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
