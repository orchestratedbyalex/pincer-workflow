#!/usr/bin/env node
'use strict';
// Harness-owned local service for recovery fixtures and live trials: a check that
// depends on it fails while the source is unchanged, and no other binary can stand
// in for it. Usage: node test/fixtures/local-service.cjs [port]
// Prints the bound port on stdout, answers GET /health with 200, exits on SIGTERM/SIGINT.
const http = require('node:http');
const port = Number(process.argv[2] || 0);
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok\n'); return; }
  res.writeHead(404); res.end();
});
server.listen(port, '127.0.0.1', () => { process.stdout.write(`${server.address().port}\n`); });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
