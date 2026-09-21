'use strict';
// Held-out evaluator for ui-states.
//
// Structural checks run in Node; rendered visibility and native input run through the
// browser seam for all three states. The aria-only and CSS-hidden controls pass markup
// assertions but fail actual browser observations. Missing capability is unverified,
// which makes the run unavailable, never accepted.
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    const { render } = require(require('node:path').join(ctx.candidateDir, 'src', 'form.js'));
    return [
      kit.hidden(ctx, 'empty-state', 'a bound label, a submit button and no error summary', 'empty.test.cjs'),
      kit.hidden(ctx, 'error-state', 'aria-invalid, aria-describedby and the alert summary', 'errors.test.cjs'),
      kit.hidden(ctx, 'escaping', 'user values are HTML-escaped', 'escaping.test.cjs'),
      await kit.observed(ctx, 'empty-observed', 'empty state is visible and label and submit respond to native input',
        render({ mode: 'empty', values: {}, errors: {} }), { state: 'empty' }),
      await kit.observed(ctx, 'error-observed', 'error summary and associated message are visible',
        render({ mode: 'error', values: { email: 'nope' }, errors: { email: 'Enter a valid email' } }), { state: 'error' }),
      await kit.observed(ctx, 'submitting-observed', 'a browser refuses to activate the submit button while submitting',
        render({ mode: 'submitting', values: { email: 'a@b.test' }, errors: {} }),
        { state: 'submitting', clickMustNotFire: 'button[type=submit]' }),
      kit.ownTests(ctx),
      kit.evidenceBinding(ctx),
    ];
  },
};
