#!/usr/bin/env node
// Entry point for the blueprint stage's scripts: recon prints the classification
// with its reasons and the answers it could pre-fill. Offline unless --network.
'use strict';
require('./pincer/cli.cjs').blueprint(process.argv.slice(2)).then((code) => { process.exitCode = code; });
