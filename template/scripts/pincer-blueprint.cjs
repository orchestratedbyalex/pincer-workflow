#!/usr/bin/env node
// Entry point for the blueprint stage's scripts: recon prints the classification
// with its reasons and the answers it could pre-fill (offline unless --network);
// write turns an answers file into harness.json, the agreement in AGENTS.md and
// the project copies.
'use strict';
require('./pincer/cli.cjs').blueprint(process.argv.slice(2)).then((code) => { process.exitCode = code; });
