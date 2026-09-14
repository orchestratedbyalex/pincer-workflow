'use strict';
// Held-out evaluator for cli-greenfield. The behaviour check runs the candidate's CLI from
// a hidden test file; the candidate's own suite is a regression signal only.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'slug-rules', 'slugging, collapsing, trimming, digits and both error paths', 'slug.test.cjs'),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
