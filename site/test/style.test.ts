// Color tokens in site/src/styles/tokens.css, light and dark, and from Task 6.9 the contrast of chapter 7 (at least
// 4.5:1 for text and 3:1 for marks). The opacities and the brace check read every style sheet. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Tokens = Record<string, string>;

// The token values, light and dark. A change of palette changes these two tables; the contrast tests below hold
// for any values.
const EXPECTED: Record<'light' | 'dark', Tokens> = {
  light: {
    bg: '#f2f2f2', sheet: '#ffffff', fg: '#141414', muted: '#5a5a5a', rule: '#d4d4d4', ink: '#141414',
    tint: '#e8e8e8', mast: '#141414', 'mast-fg': '#f5f5f5', 'mast-muted': '#b8b8b8',
    'party-d': '#2a78d6', 'party-r': '#e34948', 'neutral-d': '#01665e', 'neutral-r': '#8c510a',
    mid: '#ecebe7', blank: '#c9ccd1', water: '#e9e9e9', gold: '#a87800', edge: '#a6a6a6',
  },
  dark: {
    bg: '#111111', sheet: '#1a1a1a', fg: '#ececec', muted: '#a3a3a3', rule: '#333333', ink: '#ececec',
    tint: '#2a2a2a', mast: '#000000', 'mast-fg': '#f0f0f0', 'mast-muted': '#a8a8a8',
    'party-d': '#3987e5', 'party-r': '#e66767', 'neutral-d': '#5ab4ac', 'neutral-r': '#d8b365',
    mid: '#3a3a37', blank: '#4a4f56', water: '#1e1e1e', gold: '#e3b23c', edge: '#6b6b6b',
  },
};

const STYLES = fileURLToPath(new URL('../src/styles/', import.meta.url));
const tokensCss = readFileSync(join(STYLES, 'tokens.css'), 'utf8');
const sheets = readdirSync(STYLES).filter((file) => file.endsWith('.css')).sort();
const css = sheets.map((file) => readFileSync(join(STYLES, file), 'utf8')).join('\n');

function tokensAfter(marker: string): Tokens {
  const start = tokensCss.indexOf(':root {', tokensCss.indexOf(marker));
  const block = tokensCss.slice(start, tokensCss.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/g)].map(([, name, value]) => [name, value]));
}
const MODES: Record<'light' | 'dark', Tokens> = {
  light: tokensAfter(':root {'),
  dark: tokensAfter('@media (prefers-color-scheme: dark)'),
};

test('the color tokens have the values of EXPECTED, light and dark', () => {
  assert.deepEqual(MODES.light, EXPECTED.light);
  assert.deepEqual(MODES.dark, EXPECTED.dark);
});

// --- contrast (Task 6.9) ---

// WCAG 2 relative luminance and contrast ratio
const channel = (v: number): number => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string): number => { const [r, g, b] = rgb(hex).map(channel); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string): number => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
/** `top` with opacity `alpha` over `bottom`, as hex */
const blend = (top: string, bottom: string, alpha: number): string => `#${rgb(top).map((v, i) => Math.round(alpha * v + (1 - alpha) * rgb(bottom)[i]).toString(16).padStart(2, '0')).join('')}`;
// The two opacities in the style sheets that decide a contrast: the bars of the seat axis and the zoom hint over the map.
// The patterns allow any spacing and a number without a leading zero (.75).
function cssNumber(pattern: RegExp, what: string): number {
  const match = pattern.exec(css);
  assert.ok(match, `site/src/styles: cannot read ${what}`);
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
      ['outline of the chosen state', t.fg, t.water], ['gold outline of a swing state on the pale districts', t.gold, t.mid],
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

test('every brace in each style sheet is matched, so no rule is skipped', () => {
  // October 13, 2026: a stray } after the key findings made the browser skip the next rule, the space around every
  // chapter. Comments hold no rules; the depth must never drop below zero and must end at zero.
  for (const file of sheets) {
    let depth = 0;
    for (const [i, ch] of [...readFileSync(join(STYLES, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')].entries()) {
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      assert.ok(depth >= 0, `${file}: a } without its { near character ${i}`);
    }
    assert.equal(depth, 0, `${file}: a { without its }`);
  }
});
