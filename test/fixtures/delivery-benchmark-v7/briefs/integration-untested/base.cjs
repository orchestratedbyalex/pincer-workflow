'use strict';
// Base repository for integration-untested: a client with no retry and no tests.
const CLIENT = `'use strict';
async function fetchJson(transport, url) {
  const response = await transport(url);
  if (response.status !== 200) throw new Error('request failed: ' + response.status);
  return JSON.parse(response.body);
}
module.exports = { fetchJson };
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"client\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/client.js', CLIENT);
    lib.write(ws, 'test/.gitkeep', '');
    lib.write(ws, 'README.md', '# client\n\nA JSON client with no tests.\n');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Untested client');
  },
};
