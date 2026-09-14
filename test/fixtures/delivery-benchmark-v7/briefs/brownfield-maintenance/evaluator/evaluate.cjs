'use strict';
// Held-out evaluator for brownfield-maintenance. The preservation check is the one that
// matters most here: on a populated repository the expensive failure is not "the feature
// is missing", it is "something that already worked stopped working, or somebody's
// uncommitted work was swept into a commit".
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'deep-merge', 'nested objects merge, arrays replace, null deletes', 'merge.test.cjs'),
      kit.hidden(ctx, 'describe', 'dotted leaf paths, sorted', 'describe.test.cjs'),
      kit.hidden(ctx, 'existing-behaviour', 'merge still does not mutate its arguments', 'preserved.test.cjs'),
      kit.ownTests(ctx),
      kit.preservation(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
