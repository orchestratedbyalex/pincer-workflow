'use strict';
// Held-out evaluator for handoff-two-changes: both changes on the final candidate and
// the protocol check on the tree at the end of session 1.
const path = require('node:path');
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'a1-add', 'A1 add', 'a1.test.cjs'),
      kit.hidden(ctx, 'a2-list', 'A2 list (finished in S2)', 'a2.test.cjs'),
      kit.hidden(ctx, 'b1-clear', 'B1 clear and --dry-run', 'b1.test.cjs'),
      kit.check('session-boundary', 'protocol', 'at the end of S1: A1 and B1 pass, A2 does not', ctx.runNode([path.join(ctx.evaluatorDir, 'session-boundary.cjs'), ctx.workspaceDir, JSON.stringify(ctx.record.sessions.map(s => ({ name: s.name, ended: s.ended })))], { timeout: 40000, unverifiedExit: 3 })),
      kit.npmTest(ctx),
      kit.evidenceBinding(ctx)
    ];
  }
};
