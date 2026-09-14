'use strict';
// Held-out evaluator for ui-states.
//
// The markup checks are structural and run in Node. The submitting state is NOT: whether
// a browser refuses to activate the button is a fact about the rendered page, and the
// `aria-only` control passes every markup assertion while a real browser still fires the
// click. That check goes through the browser seam, and with no adapter configured it is
// `unverified` — which makes the run unavailable, never accepted.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    const { render } = require(require('node:path').join(ctx.candidateDir, 'src', 'form.js'));
    return [
      kit.hidden(ctx, 'empty-state', 'a bound label, a submit button and no error summary', 'empty.test.cjs'),
      kit.hidden(ctx, 'error-state', 'aria-invalid, aria-describedby and the alert summary', 'errors.test.cjs'),
      kit.hidden(ctx, 'escaping', 'user values are HTML-escaped', 'escaping.test.cjs'),
      kit.observed(ctx, 'submitting-observed', 'a browser refuses to activate the submit button while submitting',
        render({ mode: 'submitting', values: { email: 'a@b.test' }, errors: {} }),
        { clickMustNotFire: 'button[type=submit]' }),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
