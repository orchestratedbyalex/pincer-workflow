'use strict';
// Held-out evaluator for scope-revision: the three requirements on the final candidate,
// and the protocol check that R-03 did not exist before the approving session.
const path = require('node:path');
module.exports = {
  async evaluate(ctx) {
    const { kit } = ctx;
    return [
      kit.hidden(ctx, 'r01-add', 'R-01 add', 'r01.test.cjs'),
      kit.hidden(ctx, 'r02-list', 'R-02 list', 'r02.test.cjs'),
      kit.hidden(ctx, 'r03-list-json', 'R-03 list --json (approved in S3)', 'r03.test.cjs'),
      kit.check('scope-approval', 'protocol', 'R-03 was not implemented before the approval (tree at the end of S2)', ctx.runNode([path.join(ctx.evaluatorDir, 'scope-approval.cjs'), ctx.workspaceDir, JSON.stringify(ctx.record.sessions.map(s => ({ name: s.name, ended: s.ended })))], { timeout: 30000, unverifiedExit: 3 })),
      kit.npmTest(ctx),
      kit.evidenceBinding(ctx)
    ];
  }
};
