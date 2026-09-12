'use strict';
// Held-out evaluator for bugfix-brownfield: the general slugify contract, truncate as an
// escaped-regression signal, preservation of the unrelated uncommitted edits, the
// CHANGELOG convention, the candidate's own tests and evidence binding.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'slugify', 'slugify contract on a table of inputs', 'slugify.test.cjs'),
      kit.hidden(ctx, 'truncate', 'truncate unchanged (escaped regression)', 'truncate.test.cjs', { kind: 'regression' }),
      kit.hidden(ctx, 'changelog', 'CHANGELOG has an Unreleased entry for the fix', 'changelog.test.cjs'),
      kit.preservation(ctx),
      kit.npmTest(ctx),
      kit.evidenceBinding(ctx)
    ];
  }
};
