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

// --- contrast (Task 6.9) ---

// WCAG 2 relative luminance and contrast ratio
const channel = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => { const [r, g, b] = rgb(hex).map(channel); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
/** `top` with opacity `alpha` over `bottom`, as hex */
const blend = (top, bottom, alpha) => `#${rgb(top).map((v, i) => Math.round(alpha * v + (1 - alpha) * rgb(bottom)[i]).toString(16).padStart(2, '0')).join('')}`;
// The two opacities in style.css that decide a contrast: the bars of the seat axis and the zoom hint over the map.
const BAR_OPACITY = Number(/\.chart \.bar \{[^}]*fill-opacity:\s*([\d.]+)/.exec(css)[1]);
const HINT_ALPHA = Number(/\.gesture \{[^}]*background:\s*rgba\(10, 12, 16, ([\d.]+)\)/.exec(css)[1]);

test('text reaches 4.5:1 on the page, the sheet and the pressed buttons', () => {
  for (const [mode, t] of Object.entries(MODES)) {
    for (const [text, background] of [
      ['fg', 'sheet'], ['fg', 'bg'], ['muted', 'sheet'], ['muted', 'bg'], ['ink', 'sheet'], ['ink', 'bg'], ['sheet', 'ink'],
    ]) {
      const ratio = contrast(t[text], t[background]);
      assert.ok(ratio >= 4.5, `${mode}: --${text} on --${background} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('marks reach 3:1: poles, bars, marker lines and the outline of the chosen state', () => {
  // .chart .bar: --muted at its fill-opacity over --sheet
  for (const [mode, t] of Object.entries(MODES)) {
    const bar = blend(t.muted, t.sheet, BAR_OPACITY);
    const pairs = [
      ['party-d', t['party-d'], t.sheet], ['party-r', t['party-r'], t.sheet],
      ['neutral-d', t['neutral-d'], t.sheet], ['neutral-r', t['neutral-r'], t.sheet],
      ['bar', bar, t.sheet], ['marker line on a bar', t.fg, bar], ['muted line', t.muted, t.sheet],
      ['outline of the chosen state', t.fg, t.water],
    ];
    for (const [name, a, b] of pairs) {
      const ratio = contrast(a, b);
      assert.ok(ratio >= 3, `${mode}: ${name} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the zoom hint over the map is readable on its lightest colors', () => {
  // .gesture: white on rgba(10, 12, 16, alpha) over the map
  for (const [mode, t] of Object.entries(MODES)) {
    for (const under of [t.mid, t.water, t.blank, '#ffffff']) {
      const ratio = contrast('#ffffff', blend('#0a0c10', under, HINT_ALPHA));
      assert.ok(ratio >= 4.5, `${mode}: zoom hint over ${under} is ${ratio.toFixed(2)}:1`);
    }
  }
});
