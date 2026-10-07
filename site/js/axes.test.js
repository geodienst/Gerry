// Tests for site/js/axes.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitTransform } from './axes.js';

// --- the map (Task 6.2) ---

test('fitTransform: a state fills 88% of the map, centered', () => {
  // box 100 x 50 in a 975 x 610 map: 100/975 = 0.1026 > 50/610 = 0.0820, so k = 0.88 / 0.1026 = 8.58
  const t = fitTransform([[100, 100], [200, 150]]);
  assert.ok(Math.abs(t.k - 8.58) < 1e-9, String(t.k));
  // the box center (150, 125) lands on the map center (487.5, 305)
  assert.ok(Math.abs(t.x + t.k * 150 - 487.5) < 1e-9 && Math.abs(t.y + t.k * 125 - 305) < 1e-9);
});

test('fitTransform: a tiny state stops at 80 times', () => {
  assert.equal(fitTransform([[500, 300], [501, 301]]).k, 80);
});
