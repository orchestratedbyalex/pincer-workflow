// Complete output on every exit path (PRD v6 R-09, S-25; PRD v5 R-06). The CLI
// uses process.exit() as its return statement, and process.stdout is
// asynchronous when it is a pipe, so a report larger than one pipe buffer used
// to arrive truncated with exit 0 and an empty stderr. These cases drive the
// real commands through a real pipe and compare against the same command
// redirected to a file, so the bytes are checked rather than the mechanism.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, tempDir, write, run } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');

// A project whose snapshot is comfortably larger than the 64 KiB pipe buffer:
// one manifest entry per tracked file, ~168 bytes each.
function bigProject(files = 600) {
  const dir = tempDir();
  run(dir, 'git', ['init', '-q', '.']);
  run(dir, 'git', ['config', 'user.email', 'test@example.invalid']);
  run(dir, 'git', ['config', 'user.name', 'test']);
  for (let i = 0; i < files; i++) write(dir, `src/f${i}.txt`, `line ${i}\n`);
  run(dir, 'git', ['add', '-A']);
  run(dir, 'git', ['commit', '-qm', 'init']);
  return dir;
}

// Same command, once into a pipe and once into a file. The file is the truth:
// a regular file is written synchronously, so it always holds everything.
function bothWays(dir, args) {
  const piped = run(dir, process.execPath, [runtime, ...args], { maxBuffer: 64 * 1024 * 1024 });
  // Capture outside the project: a file inside it would itself appear in the snapshot.
  const out = path.join(tempDir(), 'redirected.out');
  const fd = fs.openSync(out, 'w');
  const redirected = run(dir, process.execPath, [runtime, ...args], { stdio: ['ignore', fd, 'pipe'] });
  fs.closeSync(fd);
  return { piped, file: fs.readFileSync(out, 'utf8'), redirected };
}

// S-25: a report larger than one pipe buffer arrives complete through a pipe.
{
  const dir = bigProject();
  const { piped, file } = bothWays(dir, ['snapshot', '--json']);
  assert.ok(file.length > 65536, `the fixture must exceed one pipe buffer (${file.length} bytes)`);
  assert.equal(piped.status, 0, `snapshot --json exits 0: ${piped.stderr}`);
  assert.equal(piped.stdout.length, file.length, `piped output is the whole report, not one pipe buffer (${piped.stdout.length} of ${file.length} bytes)`);
  assert.equal(piped.stdout, file, 'piped output is byte-identical to the redirected output');
  assert.doesNotThrow(() => JSON.parse(piped.stdout), 'piped --json parses');
}

// S-25: the diagnostics path is one stderr line per problem, so it is the
// many-small-writes shape rather than one large write. It must survive too.
{
  const dir = tempDir();
  const files = [];
  for (let i = 0; i < 400; i++) {
    const f = `tickets/T-${String(i).padStart(3, '0')}-broken.md`;
    write(dir, f, '---\nticket: nonsense\nstatus: bogus\n---\n');
    files.push(f);
  }
  const piped = run(dir, process.execPath, [runtime, 'validate', ...files], { maxBuffer: 64 * 1024 * 1024 });
  const out = path.join(tempDir(), 'err.out');
  const fd = fs.openSync(out, 'w');
  run(dir, process.execPath, [runtime, 'validate', ...files], { stdio: ['ignore', 'pipe', fd] });
  fs.closeSync(fd);
  const file = fs.readFileSync(out, 'utf8');
  assert.ok(file.length > 65536, `the diagnostics must exceed one pipe buffer (${file.length} bytes)`);
  assert.equal(piped.stderr.length, file.length, `piped diagnostics are complete (${piped.stderr.length} of ${file.length} bytes)`);
}

// A reader that goes away is not an error: `pincer snapshot --json | head -c 10`
// is a normal thing to type, and it must not crash or change the exit code.
{
  const dir = bigProject(200);
  const r = spawnSync('bash', ['-c', `"${process.execPath}" "${runtime}" snapshot --json | head -c 10`], {
    cwd: dir, encoding: 'utf8', timeout: 30000, env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  assert.equal(r.status, 0, `an early reader close is not a failure: ${r.stderr}`);
  assert.equal(r.stdout.length, 10, 'the reader got what it asked for');
  assert.ok(!/EPIPE|Error/.test(r.stderr), `no error is printed on an early close: ${r.stderr}`);
}

// The invariant, not just the symptom: nothing outside io.cjs writes to a
// standard stream directly, so a new call site cannot reintroduce the defect.
{
  const roots = ['template/scripts/pincer-runtime.cjs', 'template/scripts/pincer-evidence.cjs'];
  const dir = path.join(repo, 'template/scripts/pincer-runtime');
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.cjs') && f !== 'io.cjs') roots.push(`template/scripts/pincer-runtime/${f}`);
  const offenders = [];
  for (const rel of roots) {
    const text = fs.readFileSync(path.join(repo, rel), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/process\.std(out|err)\.write\(/.test(line) && !/^\s*\/\//.test(line)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `every write goes through io.cjs; direct writers: ${offenders.join(', ')}`);
}

console.log('runtime output tests passed (complete output through a pipe, on stdout and stderr)');
