'use strict';
// Held-out evaluator for bugfix-brownfield. The fix and the behaviour that had to survive
// it are separate checks, so "fixed it by deleting the guards" fails on its own row.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'boundary', 'a string at the limit is unchanged and a truncated one fits the limit', 'boundary.test.cjs'),
      kit.hidden(ctx, 'existing-behaviour', 'the documented errors and the empty-string case still hold', 'preserved.test.cjs'),
      kit.ownTests(ctx),
      kit.preservation(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
