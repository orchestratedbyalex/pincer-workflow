'use strict';
const http = require('node:http');
const path = require('node:path');
const client = require(path.join(process.env.CANDIDATE, 'lib', 'client.js'));
// A server whose behaviour per request is scripted: 'ok' | 503 | 404 | 'hang'.
function scripted(script) {
  const calls = [];
  const s = http.createServer((req, res) => {
    calls.push(req.url);
    const step = script[Math.min(calls.length, script.length) - 1];
    if (step === 'hang') return; // never answers
    if (step === 'ok') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true,"n":' + calls.length + '}'); return; }
    res.writeHead(step); res.end();
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${s.address().port}`, calls, close: () => { s.closeAllConnections?.(); s.close(); } })));
}
// Every test has its own deadline so a hanging candidate fails instead of blocking.
const withDeadline = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`candidate did not settle within ${ms} ms`)), ms).unref())]);
module.exports = { client, scripted, withDeadline };
