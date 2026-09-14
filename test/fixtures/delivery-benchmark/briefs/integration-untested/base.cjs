'use strict';
// Base repository for integration-untested: a naive HTTP client with no tests.
const CLIENT = `'use strict';
const http = require('node:http');
// Fetch the service status. Known to fail when the service is flaky.
function fetchStatus(baseUrl) {
  return new Promise((resolve, reject) => {
    http.get(\`\${baseUrl}/status\`, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
module.exports = { fetchStatus };
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', `${JSON.stringify({ name: 'status-client', version: '0.3.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
    lib.write(ws, 'README.md', '# status-client\n\nTalks to the status service (`GET /status`, JSON). The service is flaky: it sometimes answers 503 and sometimes hangs, and callers currently hang with it. No tests yet.\n');
    lib.write(ws, 'lib/client.js', CLIENT);
    lib.write(ws, '.gitignore', 'node_modules/\n');
    lib.gitInit(ws);
    lib.commitAll(ws, 'status-client 0.3.0 (no tests)');
  }
};
