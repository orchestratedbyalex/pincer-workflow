'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { slugify } = require(path.join(process.env.CANDIDATE, 'lib', 'slugify.js'));
const table = [['Hello,  World!', 'hello-world'], ['  leading and trailing  ', 'leading-and-trailing'], ['A--B__C', 'a-b-c'], ['Version 2.0 (beta)', 'version-2-0-beta'], ['', ''], ['!!!', ''], ['already-a-slug', 'already-a-slug'], ['Ünïcode stays ascii', 'n-code-stays-ascii']];
for (const [input, expected] of table) test(`slugify(${JSON.stringify(input)})`, () => assert.equal(slugify(input), expected));
