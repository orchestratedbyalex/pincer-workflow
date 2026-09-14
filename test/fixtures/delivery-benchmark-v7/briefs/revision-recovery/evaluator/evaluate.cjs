'use strict';
// Held-out evaluator for revision-recovery. Three checks because there are three ways this
// task fails: the base matching never worked, the revision was lost, or the interrupted
// session was never recovered. Reporting them as one rejection would hide which happened.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'matching', 'subset matching and the no-match case', 'matching.test.cjs'),
      kit.hidden(ctx, 'priority', 'the highest-priority match wins, ties to the earlier rule', 'priority.test.cjs'),
      kit.hidden(ctx, 'explain', 'explain reports the winning action and its rule index', 'explain.test.cjs'),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
