'use strict';
// PINCER engine — parser and validator for the ticket and spec grammar
// (docs/engine.md, "Ticket fields and receipts"). Dependency-free.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SPEC_REF = /^[^\s]+\.md$/;
const DEFAULT_TIMEOUT = 600;
const MAX_TIMEOUT = 2147483; // setTimeout's 32-bit millisecond limit, in seconds
// The fields only scripts/pincer-ticket.sh writes; the hook protects the same list.
const LIFECYCLE_FIELDS = ['status', 'started', 'last_check', 'verified', 'finished', 'accepted', 'accepted_by', 'accepted_words'];
// Keys whose value is kept verbatim: the inline-comment rule (`#` to end of
// line) does not apply, because the person's words may contain `#`.
const VERBATIM_KEYS = new Set(['accepted_words']);
const SPEC_STATUSES = ['draft', 'approved', 'built'];

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const lines = (text) => {
  const all = String(text).split('\n');
  if (all.length && all[all.length - 1] === '') all.pop();
  return all;
};
const fieldValue = (key, raw) => (VERBATIM_KEYS.has(key) ? raw : raw.replace(/#.*/, '')).trim();

// CLI shorthand -> canonical ID ("3" -> "T-03"); null when not a ticket id.
function normalizeId(input) {
  let n = String(input);
  if (n.startsWith('T-') || n.startsWith('t-')) n = n.slice(2);
  if (!/^[0-9]{1,6}$/.test(n) || Number(n) === 0) return null;
  return `T-${String(Number(n)).padStart(2, '0')}`;
}
function canonicalId(s) {
  if (typeof s !== 'string' || !/^T-[0-9][0-9]+$/.test(s)) return false;
  const n = s.slice(2);
  return n.length <= 6 && Number(n) > 0 && `T-${String(Number(n)).padStart(2, '0')}` === s;
}

// Frontmatter: `---`, unindented unique `key: value` lines (inline `#` comments,
// blank and comment lines allowed), `---`. Returns the fields and the index of
// the closing line, or the single structural problem.
function parseFrontmatter(text, kind = 'ticket') {
  const rows = lines(text);
  const fields = {};
  const order = [];
  if (rows[0] !== '---') return { problem: 'frontmatter must begin with ---', rows };
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    if (line === '---') return { fields, order, end: i, rows };
    if (/^[ \t]*(#.*)?$/.test(line)) continue;
    if (!/^[a-z_][a-z0-9_]*:[ \t]*/.test(line)) {
      return { problem: kind === 'ticket' ? 'frontmatter requires unindented key: value fields' : 'expected unindented key: value metadata', rows };
    }
    const key = line.slice(0, line.indexOf(':'));
    if (key in fields) return { problem: `duplicate ${kind === 'ticket' ? 'frontmatter' : 'metadata'} key: ${key}`, rows };
    fields[key] = fieldValue(key, line.slice(key.length + 1));
    order.push(key);
  }
  return { problem: 'frontmatter must close with ---', rows };
}

// Read one frontmatter field (first match), tolerating files whose
// frontmatter does not validate; '' when absent.
function frontmatterField(text, key) {
  const rows = lines(text);
  if (rows[0] !== '---') return '';
  for (const line of rows.slice(1)) {
    if (line === '---') break;
    if (line.startsWith(`${key}:`)) return fieldValue(key, line.slice(key.length + 1));
  }
  return '';
}

function verificationCommands(text) {
  const out = [];
  let inBlock = false, otherFence = false, inVerify = false;
  for (const line of lines(text)) {
    if (inBlock) { if (/^[ \t]*```[ \t]*$/.test(line)) break; out.push(line); continue; }
    if (otherFence) { if (/^[ \t]*```/.test(line)) otherFence = false; continue; }
    if (/^## Verification[ \t]*$/.test(line)) { inVerify = true; continue; }
    if (inVerify && /^[ \t]*```bash[ \t]*$/.test(line)) { inBlock = true; continue; }
    if (inVerify && /^## /.test(line)) break;
    if (/^[ \t]*```/.test(line)) otherFence = true;
  }
  return out;
}
// The block as it is hashed and executed: joined lines, one trailing newline.
const blockText = (text) => { const c = verificationCommands(text); return c.length ? `${c.join('\n')}\n` : ''; };
// Twelve hex characters of sha256 over the block: the receipt hash.
const blockHash = (text) => sha256(blockText(text)).slice(0, 12);

function unticked(text) {
  const out = [];
  let otherFence = false, inAccept = false;
  for (const line of lines(text)) {
    if (otherFence) { if (/^[ \t]*```/.test(line)) otherFence = false; continue; }
    if (/^[ \t]*```/.test(line)) { otherFence = true; continue; }
    if (/^## Acceptance Criteria[ \t]*$/.test(line)) { inAccept = true; continue; }
    if (inAccept && /^## /.test(line)) break;
    if (inAccept && /^[ \t]*([-+*]|[0-9]+[.)])[ \t]+\[ \]/.test(line)) out.push(line);
  }
  return out;
}

function effectiveTimeout(fields) {
  return fields.timeout ? Number(fields.timeout) : DEFAULT_TIMEOUT;
}

// A spec reference is a relative path inside the repository to a .md file.
function specRefProblem(ref) {
  if (typeof ref !== 'string' || !SPEC_REF.test(ref)) return 'must be a relative path to a .md file, such as specs/spec-v1.md';
  if (ref.startsWith('/') || ref.split(/[\\/]/).includes('..')) return 'must stay inside the repository (no leading / or ..)';
  return null;
}

// Full ticket validation. Returns { ok, problems, fields, timeout }.
function validateTicket(file, text) {
  const problems = [];
  const fm = parseFrontmatter(text, 'ticket');
  if (fm.problem) return { ok: false, problems: [fm.problem], fields: {} };
  const { fields, rows } = fm;
  let inVerify = false, otherFence = false, section = '';
  let accept = 0, verify = 0, boxes = 0, fences = 0, runnable = 0;
  for (let i = fm.end + 1; i < rows.length; i++) {
    const line = rows[i];
    if (inVerify) {
      if (/^[ \t]*```[ \t]*$/.test(line)) { inVerify = false; continue; }
      if (/^[ \t]*```/.test(line)) { problems.push('Verification requires one closed bash fence'); continue; }
      if (!/^[ \t]*(#.*)?$/.test(line)) runnable++;
      continue;
    }
    if (otherFence) { if (/^[ \t]*```/.test(line)) otherFence = false; continue; }
    if (/^## Acceptance Criteria[ \t]*$/.test(line)) { if (accept++) problems.push('duplicate Acceptance Criteria section'); section = 'accept'; continue; }
    if (/^## Verification[ \t]*$/.test(line)) { if (verify++) problems.push('duplicate Verification section'); section = 'verify'; continue; }
    if (/^## /.test(line)) { section = ''; continue; }
    if (section === 'accept') {
      if (/^[ \t]*(```|~~~)/.test(line)) { problems.push('Acceptance Criteria must contain visible checkboxes, not fences'); continue; }
      if (/^[ \t]*([-+*]|[0-9]+[.)])[ \t]+/.test(line) || /^[ \t]*([-+*]|[0-9]+[.)])?[ \t]*\[/.test(line)) {
        if (!/^[ \t]*([-+*]|[0-9]+[.)])[ \t]+\[[ xX]\][ \t]+[^ \t]/.test(line)) {
          problems.push('malformed acceptance checkbox; use - [ ] text or - [x] text (indented/list marker variants supported)');
        }
        boxes++;
      }
    }
    if (/^[ \t]*~~~/.test(line)) { problems.push('use backtick fences; tilde fences are unsupported'); continue; }
    if (/^[ \t]*```/.test(line)) {
      if (section === 'verify') {
        if (!/^[ \t]*```bash[ \t]*$/.test(line) || fences++) problems.push('Verification requires exactly one bash fence');
        inVerify = true;
      } else otherFence = true;
    }
  }
  if (!('ticket' in fields) || !canonicalId(fields.ticket)) problems.push('ticket must be a canonical ID between T-01 and T-999999');
  else {
    const base = path.basename(file);
    const prefix = `${fields.ticket}-`;
    if (!base.startsWith(prefix) || !/.+\.md$/.test(base) || base.length <= prefix.length + 3) problems.push('ticket ID must match filename T-NN-slug.md');
  }
  if (!['open', 'in_progress', 'done'].includes(fields.status)) problems.push('status must be open, in_progress, or done');
  if (!['S', 'M', 'L'].includes(fields.size)) problems.push('size must be S, M, or L');
  for (const key of ['started', 'finished', 'accepted']) if (key in fields && !TIMESTAMP.test(fields[key])) problems.push(`${key} must be an ISO UTC timestamp`);
  for (const key of ['verified', 'last_check']) {
    if (!(key in fields)) continue;
    const parts = fields[key].split(/[ \t]+/);
    const expected = key === 'verified' ? 2 : 3;
    if (parts.length !== expected || !TIMESTAMP.test(parts[0]) || !/^[0-9a-f]{12}$/.test(parts[parts.length - 1])) problems.push(`malformed ${key} timestamp/hash`);
    else if (key === 'last_check' && !['running', 'passed', 'failed', 'interrupted'].includes(parts[1])) problems.push('invalid last_check outcome');
  }
  // The floor: an acceptance is a timestamp, a named person and their words, all three or none.
  const acceptance = ['accepted', 'accepted_by', 'accepted_words'].filter((key) => key in fields);
  if (acceptance.length) {
    for (const key of ['accepted', 'accepted_by', 'accepted_words']) {
      if (!(key in fields) || fields[key] === '') problems.push(`${key} is required when a ticket is accepted (write it with pincer-ticket.sh accept)`);
    }
  }
  if ('timeout' in fields && (!/^[1-9][0-9]{0,8}$/.test(fields.timeout) || Number(fields.timeout) > MAX_TIMEOUT)) problems.push(`timeout must be a positive integer number of seconds (at most ${MAX_TIMEOUT})`);
  if ('spec' in fields) { const problem = specRefProblem(fields.spec); if (problem) problems.push(`spec ${problem}`); }
  const deps = fields.depends_on;
  if (!('depends_on' in fields) || !/^\[[ \t]*(T-[0-9]+([ \t]*,[ \t]*T-[0-9]+)*)?[ \t]*\]$/.test(deps)) problems.push('depends_on must be an inline list such as [T-01, T-02]');
  else {
    const seen = new Set();
    for (const entry of deps.replace(/^\[[ \t]*/, '').replace(/[ \t]*\]$/, '').split(',')) {
      const dep = entry.trim();
      if (dep === '') continue;
      if (!canonicalId(dep)) problems.push(`depends_on contains noncanonical ticket ID: ${dep}`);
      if (dep === fields.ticket) problems.push('ticket cannot depend on itself');
      if (seen.has(dep)) problems.push(`duplicate depends_on ID: ${dep}`);
      seen.add(dep);
    }
  }
  if (!accept || !boxes) problems.push('Acceptance Criteria requires at least one nonempty checkbox');
  if (!verify || fences !== 1 || inVerify || !runnable) problems.push('Verification requires exactly one closed runnable bash fence');
  if (problems.length === 0) {
    const syntax = spawnSync('bash', ['-n', '-c', blockText(text)], { encoding: 'utf8' });
    if (syntax.error) problems.push(`cannot run bash to check the Verification block (${syntax.error.message})`);
    else if (syntax.status !== 0) problems.push('invalid bash syntax in Verification block');
  }
  return { ok: problems.length === 0, problems, fields, timeout: effectiveTimeout(fields) };
}

function dependencies(fields) {
  return ((fields.depends_on || '').match(/T-[0-9]+/g) || []);
}

// <ticketsDir>/T-NN-*.md resolution, paths relative to the root.
function ticketFiles(root, ticketsDir = 'tickets') {
  const dir = path.join(root, ticketsDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /^T-[0-9]+.*\.md$/.test(name)).sort().map((name) => path.posix.join(ticketsDir, name));
}
function ticketFile(root, ticketsDir, input) {
  const id = normalizeId(input);
  if (!id) return { problem: `not a ticket id (expected 1..999999): ${input}` };
  const matches = ticketFiles(root, ticketsDir).filter((f) => path.basename(f).startsWith(`${id}-`));
  if (matches.length > 1) return { problem: `several files match ${path.posix.join(ticketsDir, id)}-*.md` };
  if (matches.length === 0) return { problem: `no ticket file ${path.posix.join(ticketsDir, id)}-*.md` };
  return { id, file: matches[0] };
}

// A spec: closed frontmatter with status draft, approved or built.
function validateSpec(root, ref) {
  const problem = specRefProblem(ref);
  if (problem) return { ok: false, problems: [`spec ${problem}: ${ref}`], fields: {} };
  const file = path.join(root, ref);
  if (!fs.existsSync(file)) return { ok: false, problems: [`spec does not exist: ${ref}`], fields: {} };
  const text = fs.readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text, 'spec');
  if (fm.problem) return { ok: false, problems: [`${ref}: ${fm.problem}`], fields: {} };
  const problems = [];
  if (!SPEC_STATUSES.includes(fm.fields.status)) problems.push(`${ref}: status must be ${SPEC_STATUSES.join(', ')}`);
  return { ok: problems.length === 0, problems, fields: fm.fields, file: ref, text };
}

// Set or remove one frontmatter field, keeping every other line as it is. A
// value is kept to one line. The text must have a closed frontmatter.
function frontmatterEnd(rows, key) {
  if (rows[0] !== '---') throw new Error(`cannot edit ${key}: frontmatter must begin with ---`);
  const end = rows.indexOf('---', 1);
  if (end === -1) throw new Error(`cannot edit ${key}: frontmatter must close with ---`);
  return end;
}
function fmSet(text, key, value) {
  const rows = lines(text);
  const end = frontmatterEnd(rows, key);
  const line = `${key}: ${String(value).replace(/\r?\n/g, ' ')}`;
  const at = rows.findIndex((row, i) => i > 0 && i < end && row.startsWith(`${key}:`));
  if (at === -1) rows.splice(end, 0, line); else rows[at] = line;
  return `${rows.join('\n')}\n`;
}
function fmUnset(text, key) {
  const rows = lines(text);
  const end = frontmatterEnd(rows, key);
  const at = rows.findIndex((row, i) => i > 0 && i < end && row.startsWith(`${key}:`));
  if (at === -1) return text;
  rows.splice(at, 1);
  return `${rows.join('\n')}\n`;
}

module.exports = {
  TIMESTAMP, SPEC_REF, DEFAULT_TIMEOUT, MAX_TIMEOUT, LIFECYCLE_FIELDS, SPEC_STATUSES,
  sha256, lines, normalizeId, canonicalId, parseFrontmatter, frontmatterField,
  verificationCommands, blockText, blockHash, unticked, effectiveTimeout,
  validateTicket, dependencies, ticketFiles, ticketFile, validateSpec, fmSet, fmUnset,
};
