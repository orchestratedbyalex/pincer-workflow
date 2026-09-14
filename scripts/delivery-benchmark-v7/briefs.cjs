'use strict';
// PRD v7 T-94 (R-08) — the v7 brief edition.
//
// A brief is one task, its base repository, its held-out judgment and the deliberately
// faulty candidates that prove the judgment can tell a wrong answer from a right one.
// The v6 edition (../lib.cjs, test/fixtures/delivery-benchmark/) is untouched and still
// loadable; this is a separate edition with its own cohort identity, as the protocol
// requires. Fixing v6 methodology means running a new study, not rewriting the old one.
//
// The one rule that makes the whole comparison meaningful: an implementation workspace
// receives `brief.md` and nothing else. `evaluator/`, `controls.cjs` and `base.cjs` are
// HELD_OUT — an agent that could read the evaluator would be writing to the test rather
// than to the task, and every acceptance number would be worthless.
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(REPO, 'test', 'fixtures', 'delivery-benchmark-v7');
const BRIEFS_DIR = path.join(FIXTURES, 'briefs');
const FROZEN = path.join(FIXTURES, 'frozen.json');
const PROTOCOL = path.join(REPO, 'docs', 'prd-v7-protocol.md');
// Never copied into an implementation workspace, in any arm.
const HELD_OUT = ['evaluator', 'controls.cjs', 'base.cjs'];
// The two long-form briefs the v6 edition lacked: three or more sessions across two or
// more changes, which is where continuity and recovery can actually be observed.
const LONG_FORM = ['revision-recovery', 'brownfield-maintenance'];

// "## Title" sections of a brief: { Title: body }. Same grammar as the v6 edition, so a
// brief reads the same way to a person who has seen the old ones.
function sections(text) {
  const out = {};
  let key = null;
  for (const line of text.split('\n')) {
    const m = /^## (.+)$/.exec(line);
    if (m) { key = m[1].trim(); out[key] = ''; continue; }
    if (key !== null) out[key] += `${line}\n`;
  }
  return out;
}

function briefIds(dir = BRIEFS_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
}

function loadBrief(id, dir = BRIEFS_DIR) {
  const root = path.join(dir, id);
  if (!fs.existsSync(path.join(root, 'brief.md'))) throw new Error(`unknown brief: ${id}`);
  const text = fs.readFileSync(path.join(root, 'brief.md'), 'utf8');
  const secs = sections(text);
  const prompts = Object.keys(secs)
    .filter(k => /^Prompt \d+$/.test(k))
    .sort((x, y) => Number(x.split(' ')[1]) - Number(y.split(' ')[1]))
    .map(k => ({ name: `S${k.split(' ')[1]}`, prompt: secs[k].trim() }));
  if (!prompts.length) throw new Error(`${id}: brief.md declares no "## Prompt N" section`);
  if (!secs.Task) throw new Error(`${id}: brief.md has no "## Task" section`);
  return {
    id, root, text, prompts, sessions: prompts.length,
    task: secs.Task.trim(), sections: secs,
    base: require(path.join(root, 'base.cjs')),
    controls: require(path.join(root, 'controls.cjs')),
    evaluatorDir: path.join(root, 'evaluator'),
    // How many distinct PINCER changes the task spans. A one-change task cannot show
    // continuity however many sessions it takes, which is the v6 limitation the two
    // long-form briefs exist to remove.
    changes: Number(secs.Changes ? secs.Changes.trim() : 1) || 1,
  };
}

// The files an implementation workspace may receive. Anything under HELD_OUT is absent
// by construction rather than by a rule someone has to remember.
function workspaceFiles(id, dir = BRIEFS_DIR) {
  return fs.readdirSync(path.join(dir, id), { withFileTypes: true })
    .filter(e => !HELD_OUT.includes(e.name))
    .map(e => e.name)
    .sort();
}
const heldOutOf = (id, dir = BRIEFS_DIR) => fs.readdirSync(path.join(dir, id)).filter(n => HELD_OUT.includes(n)).sort();

module.exports = { REPO, FIXTURES, BRIEFS_DIR, FROZEN, PROTOCOL, HELD_OUT, LONG_FORM, sections, briefIds, loadBrief, workspaceFiles, heldOutOf };
