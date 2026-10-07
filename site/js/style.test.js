// Color tokens in site/style.css, light and dark: the values of the site design (chapter 3), and from
// Task 6.9 the contrast of chapter 7 (at least 4.5:1 for text and 3:1 for marks). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
function tokensAfter(marker) {
  const start = css.indexOf(':root {', css.indexOf(marker));
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/g)].map(([, name, value]) => [name, value]));
}
const MODES = { light: tokensAfter(':root {'), dark: tokensAfter('@media (prefers-color-scheme: dark)') };

test('the tokens are those of the site design, light and dark', () => {
  assert.deepEqual(MODES.light, {
    bg: '#f5f6f7', sheet: '#ffffff', fg: '#16181b', muted: '#5b626b', rule: '#d7dbe0', ink: '#23324f',
    'party-d': '#2a78d6', 'party-r': '#e34948', 'neutral-d': '#01665e', 'neutral-r': '#8c510a',
    mid: '#ecebe7', blank: '#c9ccd1', water: '#e9edf2',
  });
  assert.deepEqual(MODES.dark, {
    bg: '#111316', sheet: '#191c20', fg: '#eceef1', muted: '#a3aab3', rule: '#2d3239', ink: '#c8d3ea',
    'party-d': '#3987e5', 'party-r': '#e66767', 'neutral-d': '#5ab4ac', 'neutral-r': '#d8b365',
    mid: '#3a3a37', blank: '#4a4f56', water: '#20252b',
  });
});
