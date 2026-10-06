// Tests for site/js/format.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundHalfUp, share, planShare, advantage, seats } from './format.js';

test('roundHalfUp rounds the decimal value, not the binary float', () => {
  // (1.005).toFixed(2) gives "1.00": the float is 1.00499999999999989...
  assert.equal(roundHalfUp(1.005, 2), '1.01');
  // Math.round(0.285 * 100) gives 28: 0.285 * 100 is 28.499999999999996.
  assert.equal(roundHalfUp(0.285, 0, 2), '29');
  // (0.1235 * 100).toFixed(1) gives "12.3".
  assert.equal(roundHalfUp(0.1235, 1, 2), '12.4');
  // Math.round(0.5005 * 1000) / 10 gives 50: 0.5005 * 1000 is 500.49999999999994.
  assert.equal(roundHalfUp(0.5005, 1, 2), '50.1');
  assert.equal(roundHalfUp(0.995, 0, 2), '100');
});

test('roundHalfUp handles zero, one, tiny values and padding', () => {
  assert.equal(roundHalfUp(0, 1, 2), '0.0');
  assert.equal(roundHalfUp(1, 1, 2), '100.0');
  assert.equal(roundHalfUp(1e-7, 1, 2), '0.0');
  assert.equal(roundHalfUp(0.0004, 2, 2), '0.04');
  assert.equal(roundHalfUp(123.456, 0), '123');
  assert.equal(roundHalfUp(2.5, 0), '3');
});

test('roundHalfUp rejects negative and non-finite input', () => {
  for (const bad of [-0.1, Number.NaN, Infinity, '0.5', null, undefined]) {
    assert.throws(() => roundHalfUp(bad, 1), TypeError, String(bad));
  }
});

test('share: percent with one decimal', () => {
  assert.equal(share(0.547901), '54.8%');
  assert.equal(share(0.436352), '43.6%');
  assert.equal(share(0.4945), '49.5%');
  assert.equal(share(0.5005), '50.1%'); // 50.05 rounds up to 50.1, away from 50.0
  assert.equal(share(0.5015), '50.2%'); // Math.round(0.5015 * 1000) / 10 gives 50.1
  assert.equal(share(0), '0.0%');
  assert.equal(share(1), '100.0%');
});

test('share: two decimals when one decimal would show 50.0%', () => {
  assert.equal(share(0.4995), '49.95%'); // 49.95 -> 50.0 -> 49.95
  assert.equal(share(0.5004), '50.04%');
  assert.equal(share(0.50049), '50.05%'); // 50.049 -> 50.0 -> 50.05
  assert.equal(share(0.50005), '50.01%'); // 50.005 -> 50.0 -> 50.01
});

test('share: words when two decimals would still show 50.00%', () => {
  assert.equal(share(0.49996), 'just under 50%');
  assert.equal(share(0.49995), 'just under 50%'); // 49.995 -> 50.00
  assert.equal(share(0.500049), 'just over 50%');
  assert.equal(share(0.5), 'exactly 50%');
});

test('share rejects values outside 0 to 1', () => {
  for (const bad of [-0.01, 1.2, Number.NaN, '0.5', null]) {
    assert.throws(() => share(bad), TypeError, String(bad));
  }
});

test('planShare: whole percents', () => {
  assert.equal(planShare(3086 / 5000), '62%');
  assert.equal(planShare(1901 / 5000), '38%');
  assert.equal(planShare(0.125), '13%');
  assert.equal(planShare(0.5), '50%');
  assert.equal(planShare(4974 / 5000), '99%'); // 99.48
  assert.equal(planShare(1425 / 5000), '29%'); // 28.5; Math.round(0.285 * 100) gives 28
  assert.equal(planShare(2875 / 5000), '58%'); // 57.5; Math.round(0.575 * 100) gives 57
});

test('planShare: half-up at the edges, 25/5000 and 4975/5000', () => {
  assert.equal(planShare(25 / 5000), '1%'); // 0.5% rounds up to 1%
  assert.equal(planShare(4975 / 5000), '>99%'); // 99.5% rounds up to 100%, but it is not all plans
});

test('planShare: only exact 0 and 1 give 0% and 100%', () => {
  assert.equal(planShare(0), '0%');
  assert.equal(planShare(1), '100%');
  assert.equal(planShare(1 / 5000), '<1%');
  assert.equal(planShare(24 / 5000), '<1%'); // 0.48%
  assert.equal(planShare(4976 / 5000), '>99%');
  assert.equal(planShare(4999 / 5000), '>99%');
});

test('planShare rejects values outside 0 to 1', () => {
  for (const bad of [-0.0001, 1.0001, Number.NaN, '1']) {
    assert.throws(() => planShare(bad), TypeError, String(bad));
  }
});

test('advantage: points with one decimal and the favored party', () => {
  assert.equal(advantage(0.042), 'favors Republicans by 4.2 points');
  assert.equal(advantage(-0.042), 'favors Democrats by 4.2 points');
  assert.equal(advantage(0.1235), 'favors Republicans by 12.4 points');
  assert.equal(advantage(0.0005), 'favors Republicans by 0.1 points'); // 0.05 rounds up
  assert.equal(advantage(-0.0005), 'favors Democrats by 0.1 points');
});

test('advantage: values that round to 0.0 points', () => {
  assert.equal(advantage(0), 'Less than 0.05 points either way');
  assert.equal(advantage(-0), 'Less than 0.05 points either way');
  assert.equal(advantage(0.0004), 'Less than 0.05 points either way');
  assert.equal(advantage(-0.000499), 'Less than 0.05 points either way');
});

test('advantage: null mean-median for two districts', () => {
  assert.equal(advantage(null), 'Not defined for two districts');
});

test('advantage rejects non-numbers', () => {
  for (const bad of [Number.NaN, Infinity, undefined, '0.04']) {
    assert.throws(() => advantage(bad), TypeError, String(bad));
  }
});

test('seats: whole numbers as text', () => {
  assert.equal(seats(17), '17');
  assert.equal(seats(0), '0');
  assert.equal(seats(429), '429');
});

test('seats rejects fractions, negatives and text', () => {
  for (const bad of [2.5, -1, '3', Number.NaN, null]) {
    assert.throws(() => seats(bad), TypeError, String(bad));
  }
});
