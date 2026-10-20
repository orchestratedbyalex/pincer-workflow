'use strict';
// PINCER engine — small helpers shared by the engine modules: time, atomic
// writes, JSON, git, and the output sanitizer. Dependency-free.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// UTC to the second, the timestamp format every ticket field uses.
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// Write via a temporary file in the same directory and rename into place, so a
// reader never sees a partial file and a crash leaves the old file or the new one.
function atomicWrite(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

// The parsed file, or null when it is missing or not JSON. Callers that need
// to tell the two apart read the file themselves.
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Run git in `root`; stdout without its trailing newline. Throws on a non-zero
// exit (the error carries stderr).
function git(root, args) {
  return execFileSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}
function tryGit(root, args) {
  try { return git(root, args); } catch { return null; }
}

// Output sanitizer: documented secret patterns are replaced by [redacted]
// before anything captured is persisted. A safety net, not a guarantee.
const PATTERNS = [
  // Bearer tokens first, so an `Authorization: Bearer <token>` header keeps the
  // token, not the word Bearer, as the redacted value.
  { re: /((?:bearer|basic|token|digest)\s+)[A-Za-z0-9\-._~+/=]+/gi, replace: '$1[redacted]' },
  // key/secret/password/token/authorization assignments and JSON fields; a
  // quoted value is redacted up to its closing quote, an unquoted one to the
  // next whitespace or separator. Bounded quantifiers: an unbounded prefix would
  // backtrack quadratically on long lines.
  { re: /((?:^|[^A-Za-z0-9_.-])[A-Za-z0-9_.-]{0,64}?(?:key|secret|password|passwd|token|authorization)[A-Za-z0-9_.-]{0,64}["']?[ \t]{0,8}[:=][ \t]{0,8})(?:"([^"\n]{0,512})"|'([^'\n]{0,512})'|([^\s"',;]+))/gi, replace: (m, head, dq, sq) => `${head}${dq !== undefined ? '"[redacted]"' : sq !== undefined ? "'[redacted]'" : '[redacted]'}` },
  { re: /AKIA[0-9A-Z]{16}/g, replace: '[redacted]' },
  { re: /gh[pousr]_[A-Za-z0-9]{20,}/g, replace: '[redacted]' },
];
const PEM_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PEM_END = /-----END [A-Z ]*PRIVATE KEY-----/;

// Stateful: PEM private key blocks span lines. `state` is a plain object the
// caller keeps per stream.
function sanitizeLine(line, state = {}) {
  if (state.inPem) {
    if (PEM_END.test(line)) state.inPem = false;
    return '[redacted]';
  }
  if (PEM_BEGIN.test(line)) {
    state.inPem = !PEM_END.test(line);
    return '[redacted]';
  }
  let text = line;
  for (const { re, replace } of PATTERNS) {
    text = text.replace(re, (...args) => (typeof replace === 'function' ? replace(...args) : replace.replace(/\$(\d)/g, (_, n) => args[Number(n)])));
  }
  return text;
}
function sanitizeText(text) {
  const state = {};
  return String(text).split('\n').map((line) => sanitizeLine(line, state)).join('\n');
}

module.exports = { nowIso, atomicWrite, readJson, git, tryGit, sanitizeLine, sanitizeText };
