// Runs every test/*.test.js in order and stops at the first failure.
// Run with: npm test
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();
for (const file of suites) {
  const r = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`FAIL ${file} (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}
console.log(`ok ${suites.length} suites`);
