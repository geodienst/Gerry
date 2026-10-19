// Tests for site/src/lib/colors.ts with the d3 the site bundles. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d3 from 'd3';
import { makeColors, shareStops, shareTicks, effectBoxes } from '../src/lib/colors.ts';

// The poles of the site design's token table, light and dark (chapter 3).
const POLES: Record<string, { d: string; r: string; mid: string; blank: string }> = {
  'party, light': { d: '#2a78d6', r: '#e34948', mid: '#ecebe7', blank: '#c9ccd1' },
  'neutral, light': { d: '#01665e', r: '#8c510a', mid: '#ecebe7', blank: '#c9ccd1' },
  'party, dark': { d: '#3987e5', r: '#e66767', mid: '#3a3a37', blank: '#4a4f56' },
  'neutral, dark': { d: '#5ab4ac', r: '#d8b365', mid: '#3a3a37', blank: '#4a4f56' },
};
const rgb = (color: string): string => d3.rgb(color).toString();
const lightness = (color: string): number => d3.lab(color).l;

test('share: 50% is the midpoint, 20% and 80% and beyond are the full poles', () => {
  const c = makeColors(d3.interpolateLab, POLES['party, light']);
  assert.equal(rgb(c.share(0.5)), rgb('#ecebe7'));
  assert.equal(rgb(c.share(0.8)), rgb('#2a78d6'));
  assert.equal(rgb(c.share(0.92)), rgb('#2a78d6'));
  assert.equal(rgb(c.share(0.2)), rgb('#e34948'));
  assert.equal(rgb(c.share(0.18)), rgb('#e34948'));
});

test('share: Lab interpolation with exponent 0.85 between the midpoint and a pole', () => {
  const c = makeColors(d3.interpolateLab, POLES['party, light']);
  // 65% is halfway to the Democratic pole: t = 0.5 ** 0.85 = 0.5548
  assert.equal(c.share(0.65), d3.interpolateLab('#ecebe7', '#2a78d6')(0.5 ** 0.85));
  assert.equal(c.share(0.35), d3.interpolateLab('#ecebe7', '#e34948')(0.5 ** 0.85));
});

test('effect: 0 is the midpoint, one seat starts at 0.45 + 0.55/6, six seats and more are the full poles', () => {
  const c = makeColors(d3.interpolateLab, POLES['party, light']);
  assert.equal(rgb(c.effect(0)), rgb('#ecebe7'));
  assert.equal(c.effect(1), d3.interpolateLab('#ecebe7', '#2a78d6')(0.45 + 0.55 / 6));
  assert.equal(c.effect(-3), d3.interpolateLab('#ecebe7', '#e34948')(0.45 + 0.55 * 3 / 6));
  assert.equal(rgb(c.effect(6)), rgb('#2a78d6'));
  assert.equal(rgb(c.effect(-6)), rgb('#e34948'));
  assert.equal(rgb(c.effect(-10)), rgb('#e34948'));
});

test('lightness moves monotonically from the midpoint to each pole, in all four pole sets', () => {
  for (const [name, poles] of Object.entries(POLES)) {
    const c = makeColors(d3.interpolateLab, poles);
    for (const sign of [1, -1]) {
      const shares = [0, 1, 2, 3, 4, 5, 6].map((k) => lightness(c.share(0.5 + sign * 0.05 * k)));
      const effects = [0, 1, 2, 3, 4, 5, 6].map((k) => lightness(c.effect(sign * k)));
      for (const steps of [shares, effects]) {
        const diffs = steps.slice(1).map((l, i) => l - steps[i]);
        const direction = Math.sign(steps[6] - steps[0]);
        assert.ok(direction !== 0 && diffs.every((d) => Math.sign(d) === direction), `${name}, ${sign > 0 ? 'D' : 'R'} arm: ${steps.map((l) => l.toFixed(1))}`);
      }
    }
  }
});

test('party gives the full pole and blank is the token for single-seat states', () => {
  const c = makeColors(d3.interpolateLab, POLES['neutral, dark']);
  assert.equal(c.party(true), '#5ab4ac');
  assert.equal(c.party(false), '#d8b365');
  assert.equal(c.blank, '#4a4f56');
});

test('district legend: stops from 20% to 80% and five labels', () => {
  const stops = shareStops(25);
  assert.equal(stops.length, 25);
  assert.deepEqual(stops[0], { offset: 0, value: 0.2 });
  assert.equal(stops[12].offset, 0.5);
  assert.ok(Math.abs(stops[12].value - 0.5) < 1e-12);
  assert.deepEqual(stops[24], { offset: 1, value: 0.8 });
  assert.deepEqual(shareTicks().map((t) => t.label), ['20%', '35%', '50%', '65%', '80%']);
  assert.deepEqual(shareTicks().map((t) => Math.round(t.offset * 100)), [0, 25, 50, 75, 100]);
});

test('effect legend: thirteen boxes from R+6 to D+6, labels on even values', () => {
  const boxes = effectBoxes();
  assert.equal(boxes.length, 13);
  assert.deepEqual(boxes.map((b) => b.value), [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(boxes.filter((b) => b.label).map((b) => b.label), ['R+6', 'R+4', 'R+2', '0', 'D+2', 'D+4', 'D+6']);
});
