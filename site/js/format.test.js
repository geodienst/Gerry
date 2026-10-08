// Tests for site/js/format.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundHalfUp, share, sliderShare, neededShare, planShare, advantage, seats,
  effect, effectWords, effectLine, count, percentLabel, longDate,
} from './format.js';

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

test('neededShare: a threshold rounds up to the next 0.1 point, so the share it names is enough (owner, October 8)', () => {
  assert.equal(neededShare(0.5230328), '52.4%'); // 52.303 is not reached at 52.3
  assert.equal(neededShare(0.5115747), '51.2%');
  assert.equal(neededShare(0.4978747), '49.8%');
  assert.equal(neededShare(0.5291), '53.0%');
  assert.equal(neededShare(0.523), '52.3%'); // exactly on a tenth stays
});

test('sliderShare: always one decimal, also at one half', () => {
  assert.equal(sliderShare(0.47), '47.0%');
  assert.equal(sliderShare(0.5), '50.0%');
  assert.equal(sliderShare(0.5179747), '51.8%');
  assert.equal(sliderShare(0.56), '56.0%');
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
  assert.equal(planShare(4975 / 5000), 'more than 99%'); // 99.5% rounds up to 100%, but it is not all plans
});

// planShare goes into sentences, so the edges are words, not the symbols < and > (owner, October 7, 2026).
test('planShare: only exact 0 and 1 give 0% and 100%; the edges in words', () => {
  assert.equal(planShare(0), '0%');
  assert.equal(planShare(1), '100%');
  assert.equal(planShare(1 / 5000), 'less than 1%');
  assert.equal(planShare(24 / 5000), 'less than 1%'); // 0.48%
  assert.equal(planShare(4976 / 5000), 'more than 99%');
  assert.equal(planShare(4999 / 5000), 'more than 99%');
});

test('planShare rejects values outside 0 to 1', () => {
  for (const bad of [-0.0001, 1.0001, Number.NaN, '1']) {
    assert.throws(() => planShare(bad), TypeError, String(bad));
  }
});

test('advantage: points with one decimal and the direction', () => {
  assert.equal(advantage(0.042), '4.2 points toward Republicans');
  assert.equal(advantage(-0.042), '4.2 points toward Democrats');
  assert.equal(advantage(0.18158537190478174), '18.2 points toward Republicans'); // 18.158... -> 18.2
  assert.equal(advantage(0.1235), '12.4 points toward Republicans'); // (0.1235 * 100).toFixed(1) gives "12.3"
  assert.equal(advantage(0.0005), '0.1 points toward Republicans'); // 0.05 rounds up
  assert.equal(advantage(-0.0005), '0.1 points toward Democrats');
});

test('advantage: values that round to 0.0 points', () => {
  assert.equal(advantage(0), 'less than 0.05 points either way');
  assert.equal(advantage(-0), 'less than 0.05 points either way');
  assert.equal(advantage(0.0004), 'less than 0.05 points either way');
  assert.equal(advantage(-0.000499), 'less than 0.05 points either way');
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

// Effects: positive is more Democratic seats (spec chapter 5); the site shows the direction.
test('effect: the direction instead of a sign', () => {
  assert.equal(effect(-6), 'R+6');
  assert.equal(effect(3), 'D+3');
  assert.equal(effect(-10), 'R+10');
  assert.equal(effect(0), '0');
  assert.equal(effect(-0), '0');
});

test('effectWords: seats toward a party, one seat in the singular', () => {
  assert.equal(effectWords(-6), '6 seats toward Republicans');
  assert.equal(effectWords(3), '3 seats toward Democrats');
  assert.equal(effectWords(-1), '1 seat toward Republicans');
  assert.equal(effectWords(1), '1 seat toward Democrats');
  assert.equal(effectWords(0), 'no difference');
  assert.equal(effectWords(-0), 'no difference');
});

test('effectLine: notation and words joined by a middle dot', () => {
  assert.equal(effectLine(-6), 'R+6 · 6 seats toward Republicans');
  assert.equal(effectLine(3), 'D+3 · 3 seats toward Democrats');
  assert.equal(effectLine(0), '0 · no difference');
  assert.equal(effectLine(-0), '0 · no difference');
});

test('effect, effectWords and effectLine reject fractions and text', () => {
  for (const bad of [2.5, '3', Number.NaN, Infinity, null, undefined]) {
    assert.throws(() => effect(bad), TypeError, String(bad));
    assert.throws(() => effectWords(bad), TypeError, String(bad));
    assert.throws(() => effectLine(bad), TypeError, String(bad));
  }
});

test('count: whole numbers with thousands separators', () => {
  assert.equal(count(0), '0');
  assert.equal(count(999), '999');
  assert.equal(count(5000), '5,000');
  assert.equal(count(17272), '17,272');
  assert.equal(count(1234567), '1,234,567');
});

test('count rejects fractions, negatives and text', () => {
  // Infinity, 2 ** 53 and 1e21 are above Number.MAX_SAFE_INTEGER
  for (const bad of [2.5, -1, '5000', Number.NaN, null, Infinity, 2 ** 53, 1e21]) {
    assert.throws(() => count(bad), TypeError, String(bad));
  }
});

test('percentLabel: whole percents for ticks and legends, half-up', () => {
  assert.equal(percentLabel(0.2), '20%');
  assert.equal(percentLabel(0.35), '35%');
  assert.equal(percentLabel(0.5), '50%');
  assert.equal(percentLabel(0.285), '29%'); // Math.round(0.285 * 100) gives 28
  assert.equal(percentLabel(0), '0%');
  assert.equal(percentLabel(1), '100%');
});

test('percentLabel rejects values outside 0 to 1', () => {
  for (const bad of [-0.01, 1.01, Number.NaN, '0.5']) {
    assert.throws(() => percentLabel(bad), TypeError, String(bad));
  }
});

test('longDate: month name, day without a leading zero, year', () => {
  assert.equal(longDate('2026-10-03'), 'October 3, 2026');
  assert.equal(longDate('2026-11-03'), 'November 3, 2026');
  assert.equal(longDate('2025-01-31'), 'January 31, 2025');
  assert.equal(longDate('2024-02-29'), 'February 29, 2024'); // leap year
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  names.forEach((name, i) => {
    const month = String(i + 1).padStart(2, '0');
    assert.equal(longDate(`2026-${month}-15`), `${name} 15, 2026`);
  });
  // does not depend on the time zone of the machine
  const saved = process.env.TZ;
  try {
    for (const tz of ['Pacific/Kiritimati', 'UTC', 'Pacific/Pago_Pago']) { // UTC+14, UTC, UTC-11
      process.env.TZ = tz;
      assert.equal(longDate('2026-10-03'), 'October 3, 2026', tz);
      assert.equal(longDate('2026-12-31'), 'December 31, 2026', tz);
      assert.equal(longDate('2026-01-01'), 'January 1, 2026', tz);
    }
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

test('longDate rejects other forms and impossible dates', () => {
  for (const bad of ['2026-10-3', '03-10-2026', '2026-13-01', '2026-00-10', '2026-02-29', '2026-10-03T00:00', 20261003, null]) {
    assert.throws(() => longDate(bad), TypeError, String(bad));
  }
  // text around a date
  for (const bad of [' 2026-10-03', '12026-10-03', '2026-10-03 ', '2026-10-03\n']) {
    assert.throws(() => longDate(bad), TypeError, JSON.stringify(bad));
  }
});
