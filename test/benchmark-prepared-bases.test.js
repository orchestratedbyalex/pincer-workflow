// Reproducible preparation permits offline base approval; this makes no model call.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tempDir } from './helpers.js';
const require = createRequire(import.meta.url);
const harness = require('../scripts/delivery-benchmark-v7/harness.cjs');
const briefs = require('../scripts/delivery-benchmark-v7/briefs.cjs');
const orchestrator = require('../scripts/delivery-benchmark-v7/orchestrator.cjs');
const root = tempDir();
const hostDates = ['2001-02-03T04:05:06Z', '2031-04-05T06:07:08Z'];
const previous = { author: process.env.GIT_AUTHOR_DATE, committer: process.env.GIT_COMMITTER_DATE };
function hostDate(date) { process.env.GIT_AUTHOR_DATE = date; process.env.GIT_COMMITTER_DATE = date; }
function dates(ws, revision = 'HEAD') { return harness.git(ws, 'show', '-s', '--format=%aI%n%cI', revision).split('\n').map(value => new Date(value).toISOString()); }
try {
  for (const id of briefs.briefIds()) {
    const bases = hostDates.map((date, i) => {
      hostDate(date);
      const ws = path.join(root, `${id}-${i}`);
      harness.prepare(ws, id);
      assert.deepEqual(dates(ws), [new Date(harness.PREPARATION_DATE).toISOString(), new Date(harness.PREPARATION_DATE).toISOString()]);
      return harness.git(ws, 'rev-parse', 'HEAD');
    });
    assert.equal(bases[0], bases[1], `${id}: exact base commit independent of host Git dates`);
  }
  // Tiny local archive exercises the real kit installation/commit path without
  // dependency installation or network access. This is not a released kit claim.
  const pkg = path.join(root, 'archive/package');
  fs.mkdirSync(path.join(pkg, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  fs.writeFileSync(path.join(pkg, 'bin/pincer.js'), `const fs=require('node:fs');fs.mkdirSync('.claude',{recursive:true});fs.writeFileSync('.claude/CLAUDE.md','synthetic kit fixture\\n');`);
  const archive = path.join(root, 'fixture-kit.tgz');
  assert.equal(harness.sh('tar', ['-czf', archive, '-C', path.dirname(pkg), 'package']).status, 0);
  for (const arm of ['pincer', 'strict']) {
    const bases = hostDates.map((date, i) => {
      hostDate(date);
      const ws = path.join(root, `kit-${arm}-${i}`);
      harness.prepare(ws, 'cli-greenfield', { arm });
      const before = harness.git(ws, 'rev-parse', 'HEAD');
      const installed = orchestrator.installKit(ws, arm, archive);
      assert.notEqual(installed.base, before);
      assert.equal(installed.base, harness.git(ws, 'rev-parse', 'HEAD'));
      return installed.base;
    });
    assert.equal(bases[0], bases[1], `${arm}: installed base is reproducible`);
  }
  // Explicit fixture dates survive the preparation wrappers, and ordinary exported
  // helpers continue to use the host's date rather than the preparation constant.
  const base = briefs.loadBrief('cli-greenfield').base;
  const originalCreate = base.create;
  const explicit = '2011-12-13T14:15:16Z';
  try {
    base.create = (ws, lib) => {
      lib.gitInit(ws);
      lib.write(ws, 'one.txt', 'one');
      lib.commitAll(ws, 'explicit all', explicit);
      lib.write(ws, 'two.txt', 'two');
      lib.commitPaths(ws, 'explicit paths', ['two.txt'], explicit);
      lib.write(ws, 'three.txt', 'three');
      lib.commitPaths(ws, 'default paths', ['three.txt']);
    };
    const ws = path.join(root, 'explicit-date');
    hostDate(hostDates[1]);
    harness.prepare(ws, 'cli-greenfield');
    assert.equal(dates(ws, 'HEAD~1')[0], new Date(harness.PREPARATION_DATE).toISOString());
    assert.equal(dates(ws, 'HEAD~2')[0], new Date(explicit).toISOString());
    assert.equal(dates(ws, 'HEAD~3')[0], new Date(explicit).toISOString());
    harness.commitAll(ws, 'candidate commit');
    assert.deepEqual(dates(ws), [new Date(hostDates[1]).toISOString(), new Date(hostDates[1]).toISOString()]);
  } finally { base.create = originalCreate; }
  console.log('benchmark prepared base tests passed');
} finally {
  for (const [key, value] of [['GIT_AUTHOR_DATE', previous.author], ['GIT_COMMITTER_DATE', previous.committer]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(root, { recursive: true, force: true });
}
