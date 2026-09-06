import assert from 'node:assert/strict';
import { tempDir, createTicket, createPrd, write, read, step, run, statusScript } from './helpers.js';

const dir = tempDir();
createPrd(dir);
const file = createTicket(dir, { command: 'test "$(cat value.txt)" = good' });
write(dir, 'value.txt', 'good');
assert.equal(step(dir, 'verify').status, 0);
write(dir, 'value.txt', 'bad');
assert.equal(step(dir, 'verify').status, 1);
assert.notEqual(step(dir, 'done').status, 0, 'green → red cannot close');
assert.doesNotMatch(read(dir, file), /^verified:/m);

write(dir, 'value.txt', 'good');
assert.equal(step(dir, 'verify').status, 0);
write(dir, 'value.txt', 'bad');
assert.notEqual(step(dir, 'done').status, 0, 'closure reruns the current check');
write(dir, 'value.txt', 'good');
assert.equal(step(dir, 'verify').status, 0);
assert.equal(step(dir, 'done').status, 0);
write(dir, 'value.txt', 'bad');
assert.notEqual(step(dir, 'verify').status, 0);
assert.match(run(dir, 'bash', [statusScript]).stdout, /WARN.*T-01|T-01.*WARN/);
assert.notEqual(step(dir, 'done').status, 0, 'already-done must not hide failed checks');

const interrupted = tempDir();
createPrd(interrupted);
const interruptedFile = createTicket(interrupted, { command: 'bash check.sh' });
write(interrupted, 'check.sh', 'exit 0\n');
assert.equal(step(interrupted, 'verify').status, 0);
// Signal only the temporary verification parent, never the test runner.
write(interrupted, 'check.sh', 'kill -TERM "$PPID"\nsleep 1\n');
assert.notEqual(step(interrupted, 'verify').status, 0);
assert.doesNotMatch(read(interrupted, interruptedFile), /^verified:/m);
assert.notEqual(step(interrupted, 'done').status, 0);
assert.match(read(interrupted, interruptedFile), /^last_check: .* (interrupted|running) /m);
console.log('verification freshness tests passed');
