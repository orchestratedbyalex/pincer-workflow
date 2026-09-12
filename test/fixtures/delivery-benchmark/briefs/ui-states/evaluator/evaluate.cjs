'use strict';
// Held-out evaluator for ui-states: structural markup checks in Node (no browser).
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'validator', 'validate returns the specified messages', 'validate.test.cjs'),
      kit.hidden(ctx, 'empty-state', 'labels, ids, names, no summary, Sign up button', 'empty.test.cjs'),
      kit.hidden(ctx, 'error-state', 'aria-invalid, aria-describedby, error elements and the alert summary', 'errors.test.cjs'),
      kit.hidden(ctx, 'submitting-state', 'aria-busy, disabled button, Signing up…', 'submitting.test.cjs'),
      kit.hidden(ctx, 'escaping', 'values are HTML-escaped', 'escaping.test.cjs'),
      kit.npmTest(ctx),
      kit.evidenceBinding(ctx)
    ];
  }
};
