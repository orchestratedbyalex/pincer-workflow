'use strict';
// Verify execution provenance before loading any configurable browser code.
const fs = require('node:fs');
const path = require('node:path');
const effective = require('./effective.cjs');
async function prepareBrowser(bundle, { signal } = {}) {
  const manifest = effective.assertCurrent(bundle);
  const descriptor = bundle.input.browser;
  if (!descriptor || !manifest.effective.browser) throw new Error('required UI browser capability is absent');
  if (signal?.aborted) throw new Error('browser preflight aborted');
  const root = bundle.inputRoot || bundle.root;
  const runtimePath = effective.contained(root, descriptor.runtime.path);
  const runtimeIsFile = fs.statSync(runtimePath).isFile();
  const executableRel = descriptor.runtime.executable || (runtimeIsFile ? descriptor.runtime.path : null);
  if (!executableRel) throw new Error('browser runtime directory requires an explicit executable within its complete bundle');
  const executable = effective.contained(root, executableRel);
  const relative = path.relative(runtimePath, executable);
  if ((runtimeIsFile && relative !== '') || (!runtimeIsFile && (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)))) {
    throw new Error('browser executable is outside its pinned runtime bundle');
  }
  if (!fs.statSync(executable).isFile() || !Object.hasOwn(manifest.effective.browser.runtime.files, executableRel)) throw new Error('browser executable is not a pinned runtime file');
  fs.accessSync(executable, fs.constants.X_OK);
  // A prior probe in this process cannot substitute cached code for newly pinned bytes.
  for (const rel of Object.keys(manifest.effective.browser.files)) delete require.cache[effective.contained(root, rel)];
  const implementation = require(effective.contained(root, descriptor.entry));
  if (!implementation || typeof implementation.create !== 'function') throw new Error('browser implementation must expose a configured factory');
  const adapter = implementation.create({ executable, expectedVersion: descriptor.runtime.version });
  if (!adapter || adapter.real !== true || typeof adapter.observe !== 'function' || typeof adapter.probe !== 'function' || typeof adapter.name !== 'string' || !adapter.name || typeof adapter.version !== 'string' || !adapter.version) {
    throw new Error('browser factory did not return a real observable adapter');
  }
  const observation = await adapter.probe({ signal });
  if (!observation || observation.version !== descriptor.runtime.version || observation.executable !== executable || typeof observation.protocolVersion !== 'string' || !observation.protocolVersion || observation.nativeInput !== true || observation.screenshot !== true) {
    throw new Error('browser capability probe incomplete or version/executable mismatch');
  }
  if (signal?.aborted) throw new Error('browser preflight aborted');
  effective.assertCurrent(bundle);
  return adapter;
}
module.exports = { prepareBrowser };
