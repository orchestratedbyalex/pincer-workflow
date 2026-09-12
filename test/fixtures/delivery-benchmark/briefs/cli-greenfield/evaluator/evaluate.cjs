'use strict';
// Held-out evaluator for cli-greenfield. Behaviour checks run the candidate's CLI from a
// hidden node:test file; the candidate's own tests are a regression signal only.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'add-list', 'add and list round trip, numbering, empty list', 'add-list.test.cjs'),
      kit.hidden(ctx, 'done-marks', 'done marks an item; a missing item is refused without changing the file', 'done.test.cjs'),
      kit.hidden(ctx, 'errors', 'usage errors exit 2; a corrupt file is refused and left untouched', 'errors.test.cjs'),
      kit.npmTest(ctx),
      kit.evidenceBinding(ctx)
    ];
  }
};
