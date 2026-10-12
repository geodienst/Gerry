// Tests for the reading time of the explainer in site/js/tour.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepTime } from './tour.js';

test('stepTime: 1.5 seconds plus 50 ms a character, at most 11 seconds, or the fixed time of ?tourms', () => {
  assert.equal(stepTime('x'.repeat(100)), 6500); // 1500 + 100 * 50
  assert.equal(stepTime('x'.repeat(400)), 11000); // 21500 is capped
  assert.equal(stepTime('x'.repeat(100), 300), 300);
});
