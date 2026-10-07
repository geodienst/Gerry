// The page as files (site design, chapter 7): only its own files and site/vendor/, imports between
// its own modules, two data files, no em dashes in visible text, together under 1.5 MB. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(join(SITE, file), 'utf8');
const MODULES = readdirSync(join(SITE, 'js'))
  .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js') && file !== 'testdata.js')
  .map((file) => `js/${file}`);

test('the page loads scripts and styles only from its own folder', () => {
  const refs = [...read('index.html').matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  // data:, is an empty icon, so the browser does not ask for favicon.ico
  assert.deepEqual(refs, ['data:,', 'style.css', 'vendor/d3.min.js', 'vendor/topojson-client.min.js', 'js/main.js']);
  const images = [...read('index.html').matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(images, ['img/geodienst.svg']);
});

test('modules import only the modules next to them', () => {
  for (const file of MODULES) {
    const source = read(file);
    for (const [, specifier] of source.matchAll(/\bfrom\s+'([^']+)'/g)) {
      assert.match(specifier, /^\.\/[a-z]+\.js$/, `${file} imports ${specifier}`);
    }
    assert.ok(!/\bimport\(/.test(source), `${file} has a dynamic import`);
  }
});

test('the page fetches results.json and map.topojson and nothing else', () => {
  const calls = MODULES.flatMap((file) => (read(file).match(/\bfetch\(/g) ?? []).map(() => file));
  assert.deepEqual(calls, ['js/main.js']);
  const urls = [...read('js/main.js').matchAll(/getJson\('([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['data/results.json', 'data/map.topojson']);
});

test('visible text has no em dashes', () => {
  // The character itself, and the forms a browser turns into one: HTML references, JS and CSS escapes.
  const EM_DASH = /\u{2014}|&mdash;|&#0*8212;|&#x0*2014;|\\u\{?0*2014\}?|\\0*2014(?![0-9a-f])/iu;
  for (const file of ['index.html', 'style.css', ...MODULES]) {
    assert.ok(!EM_DASH.test(read(file)), `em dash in site/${file}`);
  }
});

test('the page and everything it loads stay under 1.5 MB', () => {
  const files = ['index.html', 'style.css', ...MODULES, 'vendor/d3.min.js', 'vendor/topojson-client.min.js',
    'data/results.json', 'data/map.topojson', 'img/geodienst.svg'];
  const bytes = files.reduce((total, file) => total + statSync(join(SITE, file)).size, 0);
  assert.ok(bytes < 1_500_000, `${bytes} bytes`);
});
