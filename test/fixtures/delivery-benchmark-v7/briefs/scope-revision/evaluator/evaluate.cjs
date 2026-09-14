'use strict';
// Held-out evaluator for scope-revision. The original requirement and the revised one are
// separate checks: a candidate that stopped at session 1 satisfies the first completely,
// and a study that reported only "does it work" would accept it.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'original-requirement', 'counts by level, ordered, omitting empty levels', 'counts.test.cjs'),
      kit.hidden(ctx, 'revised-requirement', 'the highest-severity message is appended', 'revised.test.cjs'),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
