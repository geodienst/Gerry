// Tests for site/src/lib/axes.ts. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitTransform, chartUnits, nationalSeatDomain, placeLabels, sortedDomain, netBar,
  HOUSE, houseLayout, houseCell, housePlace, seatTicks, rowDomain, rowTextAnchor,
} from '../src/lib/axes.ts';
import { markerSegments } from '../src/lib/axes.ts';

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
  assert.equal(chartUnits(500, 20.52, 560), 365); // 500 * 15 / 20.52 = 365.497, rounds to 365
  assert.equal(chartUnits(500, 18, 560), 417); // 500 * 15 / 18 = 416.67, rounds up to 417
  assert.equal(chartUnits(200, 15, 560), 280); // never below 280 units
});

test('nationalSeatDomain: 14 seats around the band', () => {
  // p5 217 - 14 = 203, p95 229 + 14 = 243; proportional 224 and enacted 213 lie inside
  assert.deepEqual(nationalSeatDomain({ p5: 217, p95: 229, median: 223, proportional: 224, enacted: 213 }, 429), [203, 243]);
});

test('nationalSeatDomain: widens for a marker outside, stays within 0 and the seat total', () => {
  // band 217 - 14 = 203 to 229 + 14 = 243; enacted 190 < 203 and proportional 250 > 243 widen it
  assert.deepEqual(nationalSeatDomain({ p5: 217, p95: 229, median: 223, proportional: 250, enacted: 190 }, 429), [190, 250]);
  // 5 - 14 = -9 stops at 0, 425 + 14 = 439 stops at the 429 seats
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
  // 191 - 100 = 91 < 92: n moves up; 192 - 100 = 92 is not below 92: both stay in row 0
  assert.deepEqual(placeLabels([{ key: 'p', x: 100 }, { key: 'n', x: 191 }]).map((p) => p.row), [0, 1]);
  assert.deepEqual(placeLabels([{ key: 'p', x: 100 }, { key: 'n', x: 192 }]).map((p) => p.row), [0, 0]);
  // a fourth label on the same spot shares the top row; with rows = 4 it gets a row of its own
  const four = [{ key: 'p', x: 300 }, { key: 'n', x: 300 }, { key: 'e', x: 300 }, { key: 'base', x: 300 }];
  assert.deepEqual(placeLabels(four).map((p) => p.row), [0, 1, 2, 2]);
  assert.deepEqual(placeLabels(four, 560, 92, 4).map((p) => p.row), [0, 1, 2, 3]);
  // an edge label collides by where its text sits: e at 500 > 560 - 70 ends at its mark, so the middle
  // of its text is about 500 - 92 / 2 = 454, and 454 - 400 = 54 < 92 moves e up although 500 - 400 = 100
  assert.deepEqual(placeLabels([{ key: 'p', x: 400 }, { key: 'e', x: 500 }]).map((p) => p.row), [0, 1]);
  // the same at the start: s at 60 < 70 starts at its mark, its middle about 60 + 92 / 2 = 106; 160 - 106 = 54 < 92
  assert.deepEqual(placeLabels([{ key: 's', x: 60 }, { key: 'p', x: 160 }]).map((p) => p.row), [0, 1]);
});

test('placeLabels: anchors at the edges keep labels inside the chart', () => {
  // width 560: 30 < 70 starts at its mark, 540 > 560 - 70 = 490 ends at its mark, 280 is centered
  assert.deepEqual(placeLabels([{ key: 'a', x: 30 }, { key: 'b', x: 280 }, { key: 'c', x: 540 }]).map((p) => p.anchor), ['start', 'middle', 'end']);
  // width 311: start below 70, end above 311 - 70 = 241; 70 and 241 themselves are centered
  assert.deepEqual(placeLabels([{ key: 'a', x: 69 }, { key: 'b', x: 70 }, { key: 'c', x: 241 }, { key: 'd', x: 242 }], 311)
    .map((p) => p.anchor), ['start', 'middle', 'middle', 'end']);
});

test('sortedDomain: at least 20% to 80% with a margin of 2 points', () => {
  // everything inside 20% to 80%: 0.2 - 0.02 = 0.18, 0.8 + 0.02 = 0.82
  const [low, high] = sortedDomain({ enacted: [0.27, 0.47], p5: [0.25, 0.45], p95: [0.29, 0.6] });
  assert.ok(Math.abs(low - 0.18) < 1e-12 && Math.abs(high - 0.82) < 1e-12, `${low} ${high}`);
  // low from enacted: 0.1 - 0.02 = 0.08; high from p95: 0.97 + 0.02 = 0.99
  const [low2, high2] = sortedDomain({ enacted: [0.1, 0.95], p5: [0.12, 0.9], p95: [0.15, 0.97] });
  assert.ok(Math.abs(low2 - 0.08) < 1e-12 && Math.abs(high2 - 0.99) < 1e-12, `${low2} ${high2}`);
  // low from p5: 0.15 - 0.02 = 0.13; high from enacted: 0.9 + 0.02 = 0.92
  const [low3, high3] = sortedDomain({ enacted: [0.3, 0.9], p5: [0.15, 0.6], p95: [0.35, 0.85] });
  assert.ok(Math.abs(low3 - 0.13) < 1e-12 && Math.abs(high3 - 0.92) < 1e-12, `${low3} ${high3}`);
  // 0.005 - 0.02 = -0.015 stops at 0, 0.995 + 0.02 = 1.015 stops at 1
  assert.deepEqual(sortedDomain({ enacted: [0.01, 0.99], p5: [0.005, 0.95], p95: [0.02, 0.995] }), [0, 1]);
});

test('netBar: bars from the center, scaled to the larger side, and the net marker', () => {
  // scale = (180 - 20) / 6 = 26.67 per seat; net = 4 - 6 = -2 -> 180 - 53.33
  const bar = netBar(6, 4, 360);
  assert.equal(bar.center, 180);
  assert.deepEqual(bar.left, { x: 20, width: 160 });
  assert.equal(bar.right.x, 180); // the bar toward Democrats starts at the center
  assert.ok(Math.abs(bar.right.width - 106.667) < 1e-3);
  assert.ok(Math.abs(bar.netX - 126.667) < 1e-3);
  assert.equal(bar.anchor, 'middle');
  assert.equal(netBar(0, 0, 360).netX, 180);
  assert.equal(netBar(10, 0, 360).anchor, 'start'); // scale 160 / 10 = 16: 180 - 10 * 16 = 20 < 60
  assert.equal(netBar(0, 10, 360).anchor, 'end'); // 180 + 10 * 16 = 340 > 360 - 60 = 300
  // width 300: center 150, scale (150 - 20) / 10 = 13, netX 150 + 10 * 13 = 280 > 300 - 60 = 240
  const narrow = netBar(0, 10, 300);
  assert.equal(narrow.center, 150);
  assert.equal(narrow.anchor, 'end');
});

// --- marker lines ---

test('markerSegments: a line with no label in its way runs from its label to the plot', () => {
  assert.deepEqual(markerSegments(100, 25, 102, []), [[25, 102]]);
  // a box from x 0 to 50 is out of reach: 100 > 50 + 2
  assert.deepEqual(markerSegments(100, 25, 102, [{ x: 0, y: 22, width: 50, height: 15 }]), [[25, 102]]);
  // an empty box, from a chart that is not displayed, leaves no gap
  assert.deepEqual(markerSegments(100, 25, 102, [{ x: 0, y: 0, width: 0, height: 0 }]), [[25, 102]]);
});

test('markerSegments: a gap at each label in the way, 2 units around its box', () => {
  const row0 = { x: 70, y: 22, width: 60, height: 15 }; // gap 22 - 2 = 20 to 22 + 15 + 2 = 39
  // the line starts at 25, inside the gap, so it starts again at 39
  assert.deepEqual(markerSegments(100, 25, 102, [row0]), [[39, 102]]);
  // from higher up: 10 to 20, then 39 to 102
  assert.deepEqual(markerSegments(100, 10, 102, [row0]), [[10, 20], [39, 102]]);
  // overlapping boxes make one gap: 8 to 27 and 20 to 39 give 8 to 39
  assert.deepEqual(markerSegments(100, 0, 102, [row0, { x: 80, y: 10, width: 40, height: 15 }]), [[0, 8], [39, 102]]);
  // the pad reaches 2 units past the box: x 131 is in reach of a box that ends at 130, x 132 is not
  assert.deepEqual(markerSegments(131, 25, 102, [row0]), [[39, 102]]);
  assert.deepEqual(markerSegments(132, 25, 102, [row0]), [[25, 102]]);
});

// --- the House of 435 in chapter 01 ---

test('houseLayout: two halves of 217 seats and a middle seat at the top, 7 rows wide or 14 rows compact', () => {
  assert.equal(HOUSE.half, 217);
  // 7 rows: 31 full columns; half width 31 * 12 - 2 = 370; the middle column is the 32nd of 63 (x 31 * 12 = 372),
  // in the grid like any other; width 63 * 12 - 2 = 754
  assert.deepEqual(houseLayout(7), { rows: 7, cols: 31, partial: 7, width: 754, height: 84, mid: { x: 372, y: 2 } });
  // 14 rows: 16 columns, the inner one holds 217 - 15 * 14 = 7 seats; half width 16 * 12 - 2 = 190; 33 columns in all
  assert.deepEqual(houseLayout(14), { rows: 14, cols: 16, partial: 7, width: 394, height: 168, mid: { x: 192, y: 2 } });
});

test('houseCell: from the outer column inward, each column bottom up; the right half mirrors the left', () => {
  // k 0: outer column, bottom row (2 + 6 * 12 = 74); k 6: same column, top row
  assert.deepEqual(houseCell('D', 0, 7), { x: 0, y: 74 });
  assert.deepEqual(houseCell('D', 6, 7), { x: 0, y: 2 });
  assert.deepEqual(houseCell('D', 7, 7), { x: 12, y: 74 });
  // k 216: the last seat of the half, inner column (30 * 12 = 360), top row, next to the middle seat
  assert.deepEqual(houseCell('D', 216, 7), { x: 360, y: 2 });
  // right half: x mirrored, width - 10 - x; its inner column (384) is one step after the middle column (372)
  assert.deepEqual(houseCell('R', 0, 7), { x: 744, y: 74 });
  assert.deepEqual(houseCell('R', 216, 7), { x: 384, y: 2 });
  // 14 rows: the inner column (15 * 12 = 180) holds k 210 to 216 in its top 7 rows, bottom up
  assert.deepEqual(houseCell('D', 209, 14), { x: 168, y: 2 });
  assert.deepEqual(houseCell('D', 210, 14), { x: 180, y: 74 });
  assert.deepEqual(houseCell('D', 216, 14), { x: 180, y: 2 });
});

test('housePlace: seat i of 435 counted from the Democratic side', () => {
  assert.deepEqual(housePlace(0), { side: 'D', k: 0 });
  assert.deepEqual(housePlace(216), { side: 'D', k: 216 });
  assert.equal(housePlace(217), 'mid'); // seat 218, the majority
  assert.deepEqual(housePlace(218), { side: 'R', k: 216 });
  assert.deepEqual(housePlace(434), { side: 'R', k: 0 });
});

// --- rows of dots: the strip in the state record and the axes of chapter 03 (Task 7.2) ---

test('seatTicks: the smallest step of 1, 2, 5, 10, 20, 50 or 100 that gives at most 7 ticks, ending on the total', () => {
  assert.deepEqual(seatTicks(2), [0, 1, 2]);
  assert.deepEqual(seatTicks(6), [0, 1, 2, 3, 4, 5, 6]); // 7 ticks with step 1
  assert.deepEqual(seatTicks(8), [0, 2, 4, 6, 8]); // step 1 gives 9
  // 38: step 1 gives 39, 2 gives 20, 5 gives 8, 10 gives 4; the total 38 is added
  assert.deepEqual(seatTicks(38), [0, 10, 20, 30, 38]);
  // the total replaces a step tick at half a step or less from it
  assert.deepEqual(seatTicks(52), [0, 10, 20, 30, 40, 52]);
  assert.deepEqual(seatTicks(9), [0, 2, 4, 6, 9]);
  assert.deepEqual(seatTicks(17), [0, 5, 10, 17]);
});

test('rowDomain: whole steps around the values, at least half a step to spare', () => {
  // vote shares: lowest 0.4978747 - 0.005 = 0.4928747 -> 49.29 steps -> floor 49 -> 0.49;
  // highest 0.5230328 + 0.005 = 0.5280328 -> 52.80 steps -> ceil 53 -> 0.53
  assert.deepEqual(rowDomain([0.4978747, 0.5115747, 0.5065747, 0.5159747, 0.5230328, 0.5179747], 0.01), {
    domain: [0.49, 0.53], ticks: [0.49, 0.5, 0.51, 0.52, 0.53],
  });
  // competitive districts: (81 - 2.5) / 5 = 15.7 -> 15 -> 75; (105 + 2.5) / 5 = 21.5 -> 22 -> 110
  assert.deepEqual(rowDomain([81, 96, 87, 105], 5), {
    domain: [75, 110], ticks: [75, 80, 85, 90, 95, 100, 105, 110],
  });
  // a value on a step still gets room: 80 -> (77.5 / 5 = 15.5 -> 15) to (82.5 / 5 = 16.5 -> 17)
  assert.deepEqual(rowDomain([80], 5).domain, [75, 85]);
});

test('rowTextAnchor: the value text goes left of its dot when the base line is just to the right, or at the edge', () => {
  // width 560: right of the dot unless the base line lies within 40 units to the right, or the dot is past 500
  assert.equal(rowTextAnchor(300, 400, 560), 'start');
  assert.equal(rowTextAnchor(380, 400, 560), 'end'); // 20 units left of the base line
  assert.equal(rowTextAnchor(400, 400, 560), 'end'); // on the base line
  assert.equal(rowTextAnchor(401, 400, 560), 'start'); // right of it
  assert.equal(rowTextAnchor(520, null, 560), 'end'); // near the right edge, no base line
  assert.equal(rowTextAnchor(100, null, 560), 'start');
});
