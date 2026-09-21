'use strict';
// A diagnostic is deliberately not an effort record. Its directory also acts as a
// durable retry barrier, including when publication fails between its two files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const claims = require('./run-claims.cjs');
const { secretIn } = require('./freeze.cjs');
const DIRECTORY = 'finalization-failure';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function blocked(home) { return fs.existsSync(claims.contained(home, DIRECTORY)); }
function problems(value, home) {
  try {
    if (!value || Object.keys(value).sort().join(',') !== 'code,raw,recovery,run,schema') throw new Error();
    if (value.schema !== 1 || value.code !== 'FINALIZATION_FAILED' || !/^[a-z0-9-]+\/rep-[1-9]\/(?:plain|pincer|strict)$/.test(value.run) || value.run.length > 120) throw new Error();
    if (value.recovery !== 'blocked; inspect retained evidence before explicit operator disposition') throw new Error();
    if (!value.raw || Object.keys(value.raw).sort().join(',') !== 'path,sha256,unavailable' || value.raw.path !== `${DIRECTORY}/record.json` ) throw new Error();
    if (secretIn(JSON.stringify(value))) throw new Error();
    if (value.raw.sha256 === null) {
      if (value.raw.unavailable !== 'Raw record contains secret-looking material; digest withheld.') throw new Error();
    } else if (!/^[a-f0-9]{64}$/.test(value.raw.sha256) || value.raw.unavailable !== null) throw new Error();
    if (home) {
      const raw = fs.readFileSync(claims.contained(home, value.raw.path));
      const sensitive = secretIn(raw.toString('utf8'));
      if (sensitive ? value.raw.sha256 !== null : value.raw.sha256 === null || digest(raw) !== value.raw.sha256) throw new Error();
    }
    return [];
  } catch { return [{ code: 'DIAGNOSTIC_INVALID', detail: 'Diagnostic envelope or retained record does not validate.' }]; }
}
function retain(home, record) {
  const dir = claims.contained(home, DIRECTORY);
  // mkdir is the first durable action: even an incomplete diagnostic blocks retries.
  fs.mkdirSync(dir, { mode: 0o700 });
  const raw = `${JSON.stringify(record, null, 2)}\n`;
  claims.atomicWrite(claims.contained(home, `${DIRECTORY}/record.json`), raw);
  fs.chmodSync(path.join(dir, 'record.json'), 0o600);
  const diagnostic = { schema: 1, code: 'FINALIZATION_FAILED', run: record.run,
    recovery: 'blocked; inspect retained evidence before explicit operator disposition',
    raw: { path: `${DIRECTORY}/record.json`, sha256: secretIn(raw) ? null : digest(raw),
      unavailable: secretIn(raw) ? 'Raw record contains secret-looking material; digest withheld.' : null } };
  if (problems(diagnostic, home).length) throw new Error('Diagnostic envelope does not validate');
  claims.atomicWrite(path.join(dir, 'diagnostic.json'), `${JSON.stringify(diagnostic, null, 2)}\n`);
  return diagnostic;
}
function failed(home, record) {
  let diagnostic = null;
  let diagnosticFailure = false;
  try { diagnostic = retain(home, record); } catch { diagnosticFailure = true; }
  return { record, stop: true, failed: true, code: 'FINALIZATION_FAILED', diagnostic, diagnosticFailure,
    detail: 'Finalization failed; retain the last checkpoint and raw artifacts for explicit operator disposition.' };
}
module.exports = { DIRECTORY, blocked, problems, retain, failed };
