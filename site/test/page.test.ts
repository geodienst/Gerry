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
  // the icons come from the site's own folder; the style sheet comes in through main.ts
  assert.deepEqual(refs, ['favicon-32.png', 'icon.svg', 'apple-touch-icon.png', './src/main.ts']);
  for (const file of ['favicon-32.png', 'icon.svg', 'apple-touch-icon.png', 'img/preview.png']) {
    assert.ok(existsSync(fileURLToPath(new URL(`../public/${file}`, import.meta.url))), file);
  }
  const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  // Justitia in the masthead, the Geodienst logo and the University of Groningen shield in the footer
  assert.deepEqual(images, ['img/justice.webp', 'img/geodienst.svg', 'img/rug-shield.png']);
});

test('the preview for a shared link: title and description as on the page, and an image of 1200 by 630', () => {
  const html = read('index.html');
  const meta = (name: string) => new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)">`).exec(html)?.[1];
  assert.equal(meta('og:title'), /<title>([^<]*)<\/title>/.exec(html)![1]);
  assert.equal(meta('og:description'), meta('description'));
  assert.match(meta('og:image')!, /^https:\/\/[^/]+\/(Gerry\/)?img\/preview\.png$/);
  assert.equal(new URL('img/preview.png', meta('og:url')).href, meta('og:image'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  // width and height from the PNG header
  const png = readFileSync(fileURLToPath(new URL('../public/img/preview.png', import.meta.url)));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.deepEqual([meta('og:image:width'), meta('og:image:height')], ['1200', '630']);
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
  // the license texts are linked from the footer, the preview image is for shared links and the touch icon for a
  // phone's home screen: none is loaded with the page
  const apart = (file: string) => file.startsWith('licenses/') || file === 'img/preview.png' || file === 'apple-touch-icon.png';
  const files = filesUnder(DIST, DIST).filter((file) => !apart(file));
  const bytes = files.reduce((total, file) => total + statSync(join(DIST, file)).size, 0);
  assert.ok(bytes < 1_500_000, `${bytes} bytes in dist/`);
});

test('the license texts in site/public/licenses are those of the bundled libraries', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  for (const name of PACKAGES) {
    const shipped = readFileSync(join(SITE, 'public', 'licenses', `${name}.txt`));
    const bundled = readFileSync(join(root, 'node_modules', name, 'LICENSE'));
    assert.ok(shipped.equals(bundled), `site/public/licenses/${name}.txt differs from node_modules/${name}/LICENSE`);
  }
});
