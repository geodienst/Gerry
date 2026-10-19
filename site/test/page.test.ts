// The page as files (site design, chapter 7): index.html loads only its own entry module, the modules import each other
// and the two bundled libraries, one module fetches the two data files, no em dashes in visible text, and the built
// page stays under 1.5 MB. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(SITE, 'src');
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

/** Every file under `dir`, as paths relative to `base`, with forward slashes. */
function filesUnder(dir: string, base: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((file) => join(dir, file))
    .filter((path) => statSync(path).isFile())
    .map((path) => relative(base, path).split(sep).join('/'))
    .sort();
}
const read = (file: string): string => readFileSync(join(SITE, file), 'utf8');
const MODULES = filesUnder(SRC, SITE).filter((file) => file.endsWith('.ts'));
const STYLES = filesUnder(SRC, SITE).filter((file) => file.endsWith('.css'));

// Packages a module may import at run time; Vite bundles them, so the page asks no other server for them.
const PACKAGES = ['d3', 'topojson-client'];
// Packages with types only: `import type` leaves no code behind.
const TYPE_PACKAGES = ['topojson-specification', 'geojson'];

test('index.html loads only its own entry module and images', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  // data:, is an empty icon, so the browser does not ask for favicon.ico; the style sheet comes in through main.ts
  assert.deepEqual(refs, ['data:,', './src/main.ts']);
  const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(images, ['img/justice.webp', 'img/geodienst.svg']); // Justitia in the masthead, the logo in the footer
});

test('modules import only each other, the style sheet and the bundled libraries', () => {
  for (const file of MODULES) {
    const source = read(file);
    for (const [statement, specifier] of source.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+'([^']+)'/gm)) {
      if (specifier.startsWith('.')) {
        assert.match(specifier, /^\.\.?\/[\w./-]+\.(ts|css)$/, `${file} imports ${specifier}`);
        assert.ok(existsSync(join(SITE, file, '..', specifier)), `${file} imports ${specifier}, which does not exist`);
      } else if (/^\s*(?:import|export)\s+type\b/.test(statement)) {
        assert.ok([...PACKAGES, ...TYPE_PACKAGES].includes(specifier), `${file} imports types from ${specifier}`);
      } else {
        assert.ok(PACKAGES.includes(specifier), `${file} imports ${specifier}`);
      }
    }
    for (const [, specifier] of source.matchAll(/^\s*import\s+'([^']+)'/gm)) {
      assert.match(specifier, /^\.\.?\/[\w./-]+\.css$/, `${file} imports ${specifier} for its side effects`);
    }
    assert.ok(!/\bimport\(/.test(source), `${file} has a dynamic import`);
  }
});

test('the page fetches results.json and map.topojson and nothing else', () => {
  const calls = MODULES.flatMap((file) => (read(file).match(/\bfetch\(/g) ?? []).map(() => file));
  assert.deepEqual(calls, ['src/app/data.ts']);
  const urls = [...read('src/app/data.ts').matchAll(/'(data\/[^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['data/results.json', 'data/map.topojson']);
});

test('visible text has no em dashes', () => {
  // The character itself, and the forms a browser turns into one: HTML references, JS and CSS escapes.
  const EM_DASH = /\u{2014}|&mdash;|&#0*8212;|&#x0*2014;|\\u\{?0*2014\}?|\\0*2014(?![0-9a-f])/iu;
  for (const file of ['index.html', ...STYLES, ...MODULES]) {
    assert.ok(!EM_DASH.test(read(file)), `em dash in site/${file}`);
  }
});

test('district names in the text of the page do not break after the hyphen', () => {
  // "TX-15" in a sentence sits in <span class="nowrap">; a style sheet keeps that span on one line.
  const html = read('index.html');
  const loose = html.replace(/<span class="nowrap">[A-Z]{2}-\d+<\/span>/g, '').match(/\b[A-Z]{2}-\d+\b/g) ?? [];
  assert.deepEqual(loose, []);
  assert.match(html, /<span class="nowrap">TX-15<\/span>/);
  assert.match(STYLES.map(read).join('\n'), /\.nowrap\s*\{\s*white-space:\s*nowrap;\s*\}/);
});

test('the built page and everything it loads stay under 1.5 MB', (t) => {
  if (!existsSync(join(DIST, 'index.html'))) {
    t.skip('run pnpm build first');
    return;
  }
  // the license texts are linked from the footer, not loaded with the page
  const files = filesUnder(DIST, DIST).filter((file) => !file.startsWith('licenses/'));
  const bytes = files.reduce((total, file) => total + statSync(join(DIST, file)).size, 0);
  assert.ok(bytes < 1_500_000, `${bytes} bytes in dist/`);
});

test('the license texts in site/public/licenses are those of the bundled libraries and fonts', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const FONTS = ['public-sans', 'source-serif-4'];
  const sources: [string, string][] = [
    ...PACKAGES.map((name): [string, string] => [name, name]),
    ...FONTS.map((name): [string, string] => [name, `@fontsource-variable/${name}`]),
  ];
  for (const [name, pkg] of sources) {
    const shipped = readFileSync(join(SITE, 'public', 'licenses', `${name}.txt`));
    const bundled = readFileSync(join(root, 'node_modules', pkg, 'LICENSE'));
    assert.ok(shipped.equals(bundled), `site/public/licenses/${name}.txt differs from node_modules/${pkg}/LICENSE`);
  }
});
