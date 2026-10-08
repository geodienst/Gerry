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

test('the tokens are those of the redesign, light and dark', () => {
  // Redesign, chapter 7: the mockup palette in the token names of the site.
  assert.deepEqual(MODES.light, {
    bg: '#f1f3f0', sheet: '#fbfcfa', fg: '#18201c', muted: '#56615b', rule: '#d3d9d4', ink: '#1d5c48',
    tint: '#e2ebe5', mast: '#143a2f', 'mast-fg': '#eef4f0', 'mast-muted': '#b2c8bd',
    'party-d': '#2a78d6', 'party-r': '#e34948', 'neutral-d': '#01665e', 'neutral-r': '#8c510a',
    mid: '#ecebe7', blank: '#c9ccd1', water: '#e5eae6',
  });
  assert.deepEqual(MODES.dark, {
    bg: '#0f1513', sheet: '#151d1a', fg: '#e6ece8', muted: '#9eaba4', rule: '#2a3531', ink: '#8fd0b4',
    tint: '#1c2a25', mast: '#0b2920', 'mast-fg': '#e6efe9', 'mast-muted': '#9ab8aa',
    'party-d': '#3987e5', 'party-r': '#e66767', 'neutral-d': '#5ab4ac', 'neutral-r': '#d8b365',
    mid: '#3a3a37', blank: '#4a4f56', water: '#1b2421',
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
// The patterns allow any spacing and a number without a leading zero (.75).
function cssNumber(pattern, what) {
  const match = pattern.exec(css);
  assert.ok(match, `style.css: cannot read ${what}`);
  return Number(match[1]);
}
const barOpacity = () => cssNumber(/\.chart\s+\.bar\s*\{[^}]*?\bfill-opacity\s*:\s*(\d*\.?\d+)/, 'the fill-opacity of .chart .bar');
const hintAlpha = () => cssNumber(/\.gesture\s*\{[^}]*?\bbackground\s*:\s*rgba\(\s*10\s*,\s*12\s*,\s*16\s*,\s*(\d*\.?\d+)\s*\)/,
  'the alpha of rgba(10, 12, 16, alpha) in the background of .gesture');

test('text reaches 4.5:1 on the page, the sheet and the pressed buttons', () => {
  for (const [mode, t] of Object.entries(MODES)) {
    for (const [text, background] of [
      ['fg', 'sheet'], ['fg', 'bg'], ['muted', 'sheet'], ['muted', 'bg'], ['ink', 'sheet'], ['ink', 'bg'], ['sheet', 'ink'],
      // redesign: the chosen row and state (--tint) and the masthead (--mast)
      ['fg', 'tint'], ['muted', 'tint'], ['mast-fg', 'mast'], ['mast-muted', 'mast'],
    ]) {
      const ratio = contrast(t[text], t[background]);
      assert.ok(ratio >= 4.5, `${mode}: --${text} on --${background} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('marks reach 3:1: poles, bars, marker lines and the outline of the chosen state', () => {
  // .chart .bar: --muted at its fill-opacity over --sheet
  const opacity = barOpacity();
  for (const [mode, t] of Object.entries(MODES)) {
    const bar = blend(t.muted, t.sheet, opacity);
    const pairs = [
      ['party-d', t['party-d'], t.sheet], ['party-r', t['party-r'], t.sheet],
      ['neutral-d', t['neutral-d'], t.sheet], ['neutral-r', t['neutral-r'], t.sheet],
      // the waffle of chapter 01 lies on the page background, not on a sheet
      ['party-d on the page', t['party-d'], t.bg], ['party-r on the page', t['party-r'], t.bg],
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
  const alpha = hintAlpha();
  for (const [mode, t] of Object.entries(MODES)) {
    for (const under of [t.mid, t.water, t.blank, '#ffffff']) {
      const ratio = contrast('#ffffff', blend('#0a0c10', under, alpha));
      assert.ok(ratio >= 4.5, `${mode}: zoom hint over ${under} is ${ratio.toFixed(2)}:1`);
    }
  }
});
