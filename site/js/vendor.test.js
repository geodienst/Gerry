// The vendored libraries in site/vendor match the versions pinned in package.json.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const pinned = JSON.parse(readFileSync(root('package.json'), 'utf8')).devDependencies;

for (const name of ['d3', 'topojson-client']) {
  test(`${name}: vendored copy is version ${pinned[name]} with its license`, () => {
    const script = root(`site/vendor/${name}.min.js`);
    assert.ok(existsSync(script), `${script} missing; run npm run vendor`);
    const banner = readFileSync(script, 'utf8').split('\n', 1)[0];
    assert.match(banner, new RegExp(` v${pinned[name].replaceAll('.', '\\.')} `), banner);
    const license = readFileSync(root(`site/vendor/${name}.LICENSE.txt`), 'utf8');
    assert.match(license, /Permission to use, copy, modify/);
  });
}
