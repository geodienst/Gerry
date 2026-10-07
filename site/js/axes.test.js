// Tests for site/js/axes.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitTransform, chartUnits, nationalSeatDomain, placeLabels, sortedDomain, netBar } from './axes.js';

// --- the map (Task 6.2) ---

test('fitTransform: a state fills 88% of the map, centered', () => {
  // box 100 x 50 in a 975 x 610 map: 100/975 = 0.1026 > 50/610 = 0.0820, so k = 0.88 / 0.1026 = 8.58
  const t = fitTransform([[100, 100], [200, 150]]);
  assert.ok(Math.abs(t.k - 8.58) < 1e-9, String(t.k));
  // the box center (150, 125) lands on the map center (487.5, 305)
  assert.ok(Math.abs(t.x + t.k * 150 - 487.5) < 1e-9 && Math.abs(t.y + t.k * 125 - 305) < 1e-9);
  // a tall box 100 x 200: 100/975 = 0.1026 < 200/610 = 0.3279, so the height sets k = 0.88 / 0.3279 = 2.684
  const tall = fitTransform([[100, 100], [200, 300]]);
  assert.ok(Math.abs(tall.k - 2.684) < 1e-9, String(tall.k));
  // its center (150, 200) lands on the map center as well
  assert.ok(Math.abs(tall.x + tall.k * 150 - 487.5) < 1e-9 && Math.abs(tall.y + tall.k * 200 - 305) < 1e-9);
});

test('fitTransform: a tiny state stops at 80 times', () => {
  assert.equal(fitTransform([[500, 300], [501, 301]]).k, 80);
});

// --- the charts (Task 6.5) ---

test('chartUnits: one unit is 1/15 rem, between the minimum and the maximum', () => {
  assert.equal(chartUnits(311, 15, 560), 311); // phone: the sheet is 311px wide
  assert.equal(chartUnits(1200, 15, 560), 560); // wide card: at most 560 units
  assert.equal(chartUnits(800, 20.52, 560), 560); // 800 * 15 / 20.52 = 584.8
  assert.equal(chartUnits(500, 20.52, 560), 365); // 500 * 15 / 20.52 = 365.5, rounds to 365
  assert.equal(chartUnits(200, 15, 560), 280); // never below 280 units
});

test('nationalSeatDomain: 14 seats around the band', () => {
  // p5 217 - 14 = 203, p95 229 + 14 = 243; proportional 224 and enacted 213 lie inside
  assert.deepEqual(nationalSeatDomain({ p5: 217, p95: 229, median: 223, proportional: 224, enacted: 213 }, 429), [203, 243]);
});

test('nationalSeatDomain: widens for a marker outside, stays within 0 and the seat total', () => {
  assert.deepEqual(nationalSeatDomain({ p5: 217, p95: 229, median: 223, proportional: 250, enacted: 190 }, 429), [190, 250]);
  assert.deepEqual(nationalSeatDomain({ p5: 5, p95: 425, median: 200, proportional: 200, enacted: 200 }, 429), [0, 429]);
});

test('placeLabels: labels far apart stay in row 0', () => {
  const placed = placeLabels([{ key: 'p', x: 100 }, { key: 'n', x: 250 }, { key: 'e', x: 400 }]);
  assert.deepEqual(placed.map((p) => [p.key, p.row]), [['p', 0], ['n', 0], ['e', 0]]);
});

test('placeLabels: a colliding label moves one row up, a third one row further', () => {
  // 150 - 100 = 50 < 92: n moves up; e at 400 is free in row 0
  assert.deepEqual(placeLabels([{ key: 'p', x: 100 }, { key: 'n', x: 150 }, { key: 'e', x: 400 }]).map((p) => p.row), [0, 1, 0]);
  // all three on one seat count: rows 0, 1 and 2, in drawing order
  assert.deepEqual(placeLabels([{ key: 'p', x: 300 }, { key: 'n', x: 300 }, { key: 'e', x: 300 }]).map((p) => [p.key, p.row]),
    [['p', 0], ['n', 1], ['e', 2]]);
});

test('placeLabels: anchors at the edges keep labels inside the chart', () => {
  assert.deepEqual(placeLabels([{ key: 'a', x: 30 }, { key: 'b', x: 280 }, { key: 'c', x: 540 }]).map((p) => p.anchor), ['start', 'middle', 'end']);
});

test('sortedDomain: at least 20% to 80% with a margin of 2 points', () => {
  const [low, high] = sortedDomain({ enacted: [0.27, 0.47], p5: [0.25, 0.45], p95: [0.29, 0.6] });
  assert.ok(Math.abs(low - 0.18) < 1e-12 && Math.abs(high - 0.82) < 1e-12, `${low} ${high}`);
  const [low2, high2] = sortedDomain({ enacted: [0.1, 0.95], p5: [0.12, 0.9], p95: [0.15, 0.97] });
  assert.ok(Math.abs(low2 - 0.08) < 1e-12 && Math.abs(high2 - 0.99) < 1e-12, `${low2} ${high2}`);
});

test('netBar: bars from the center, scaled to the larger side, and the net marker', () => {
  // scale = (180 - 20) / 6 = 26.67 per seat; net = 4 - 6 = -2 -> 180 - 53.33
  const bar = netBar(6, 4, 360);
  assert.equal(bar.center, 180);
  assert.deepEqual(bar.left, { x: 20, width: 160 });
  assert.ok(Math.abs(bar.right.width - 106.667) < 1e-3);
  assert.ok(Math.abs(bar.netX - 126.667) < 1e-3);
  assert.equal(bar.anchor, 'middle');
  assert.equal(netBar(0, 0, 360).netX, 180);
  assert.equal(netBar(10, 0, 360).anchor, 'start');
});
