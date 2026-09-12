'use strict';
// Minimal markup inspection for the hidden tests: tags with parsed attributes.
const path = require('node:path');
const { render } = require(path.join(process.env.CANDIDATE, 'src', 'form.js'));
const { validate } = require(path.join(process.env.CANDIDATE, 'src', 'validate.js'));
function tags(html, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b([^>]*)>`, 'g');
  for (const m of html.matchAll(re)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? true : a[2];
    out.push({ attrs, index: m.index });
  }
  return out;
}
const byId = (html, name, id) => tags(html, name).find(t => t.attrs.id === id);
const inner = (html, name, id) => { const m = new RegExp(`<${name}\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</${name}>`).exec(html); return m ? m[1] : null; };
module.exports = { render, validate, tags, byId, inner };
