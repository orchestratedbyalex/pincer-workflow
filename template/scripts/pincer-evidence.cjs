#!/usr/bin/env node
'use strict';
// PINCER evidence — validate an evidence manifest, or digest files for one
// (docs/engine.md, "Evidence manifest schema 1"). Read-only.
//
//   scripts/pincer-evidence.cjs validate <manifest> [--candidate <sha>]   prints "ok <candidate>", or one problem per line and exits 1
//   scripts/pincer-evidence.cjs digest <file>...                          prints "<sha256>  <file>" per line
require('./pincer/cli.cjs').main(['evidence', ...process.argv.slice(2)]).then((code) => { process.exitCode = code; });
