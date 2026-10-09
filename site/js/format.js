// Number formatting for the site (spec chapter 8, "Opmaak van getallen").
// The pipeline exports raw numbers; every number a visitor sees goes through
// this module.
//
// Rounding is half-up on the decimal value. We take the shortest decimal form
// of the number (the digits JavaScript prints for it) and round those digits
// with integer arithmetic. We never use Math.round or toFixed on a float:
// 0.285 * 100 is 28.499999999999996, so Math.round gives 28 instead of 29.

/**
 * Round a non-negative number half-up after moving the decimal point `shift`
 * places to the right. Returns text with exactly `decimals` decimals.
 * roundHalfUp(0.285, 0, 2) === '29'; roundHalfUp(1.005, 2) === '1.01'.
 * @param {number} value non-negative finite number
 * @param {number} decimals digits after the decimal point
 * @param {number} [shift=0] power of ten to multiply by first (2 = percent)
 * @returns {string}
 */
export function roundHalfUp(value, decimals, shift = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`expected a non-negative finite number, got ${value}`);
  }
  // toExponential() without an argument gives the shortest digits that
  // identify the number: 0.285 -> "2.85e-1".
  const [mantissa, exponent] = value.toExponential().split('e');
  const digits = mantissa.replace('.', '');
  // value = digits * 10^(exponent - (digits.length - 1)); we want the integer
  // round(value * 10^(shift + decimals)).
  const power = Number(exponent) - (digits.length - 1) + shift + decimals;
  let scaled = BigInt(digits);
  if (power >= 0) {
    scaled *= 10n ** BigInt(power);
  } else {
    const divisor = 10n ** BigInt(-power);
    const remainder = scaled % divisor;
    scaled /= divisor;
    if (2n * remainder >= divisor) scaled += 1n;
  }
  const text = scaled.toString().padStart(decimals + 1, '0');
  return decimals === 0 ? text : `${text.slice(0, -decimals)}.${text.slice(-decimals)}`;
}

function checkFraction(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`expected a fraction from 0 to 1, got ${value}`);
  }
}

/**
 * A vote share (fraction) as a percent with one decimal: 0.547901 -> "54.8%".
 * If that shows 50.0%, two decimals; if that still shows 50.00%, words.
 * @param {number} fraction
 * @returns {string}
 */
export function share(fraction) {
  checkFraction(fraction);
  const one = roundHalfUp(fraction, 1, 2);
  if (one !== '50.0') return `${one}%`;
  const two = roundHalfUp(fraction, 2, 2);
  if (two !== '50.00') return `${two}%`;
  if (fraction < 0.5) return 'just under 50%';
  if (fraction > 0.5) return 'just over 50%';
  return 'exactly 50%';
}

/**
 * The gap between the two parties in a district, in points with one decimal: 0.4691 -> "6.2 points".
 * @param {number} fraction the Democratic share of the two-party vote
 * @returns {string}
 */
export function margin(fraction) {
  checkFraction(fraction);
  return `${roundHalfUp(Math.abs(2 * fraction - 1), 1, 2)} points`;
}

/**
 * A vote share on the slider as a percent with one decimal, also at one half: 0.5 -> "50.0%".
 * @param {number} fraction
 * @returns {string}
 */
export function sliderShare(fraction) {
  checkFraction(fraction);
  return `${roundHalfUp(fraction, 1, 2)}%`;
}

/**
 * A share Democrats need, such as a majority threshold, rounded up to one decimal (owner decision, October 8, 2026):
 * the share it names is always enough. 0.5230328 -> "52.4%" (52.3% falls just short); 0.523 -> "52.3%".
 * @param {number} fraction
 * @returns {string}
 */
export function neededShare(fraction) {
  checkFraction(fraction);
  return `${(Math.ceil(fraction * 1000 - 1e-9) / 10).toFixed(1)}%`;
}

/**
 * A share of plans (fraction) as a whole percent, for use in a sentence: 3086/5000 -> "62%".
 * Above 0 but rounding to 0 gives "less than 1%"; below 1 but rounding to 100 gives "more than 99%".
 * @param {number} fraction
 * @returns {string}
 */
export function planShare(fraction) {
  checkFraction(fraction);
  if (fraction === 0) return '0%';
  if (fraction === 1) return '100%';
  const whole = roundHalfUp(fraction, 0, 2);
  if (whole === '0') return 'less than 1%';
  if (whole === '100') return 'more than 99%';
  return `${whole}%`;
}

/**
 * Efficiency gap or mean-median (fraction, positive favors Republicans) in
 * percentage points with the direction: 0.182 -> "18.2 points toward Republicans".
 * null (mean-median with two districts) -> "Not defined for two districts".
 * @param {number|null} value
 * @returns {string}
 */
export function advantage(value) {
  if (value === null) return 'Not defined for two districts';
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`expected a finite number or null, got ${value}`);
  }
  const points = roundHalfUp(Math.abs(value), 1, 2);
  if (points === '0.0') return 'less than 0.05 points either way';
  return `${points} points toward ${value > 0 ? 'Republicans' : 'Democrats'}`;
}

/**
 * A seat count as a whole number: 17 -> "17".
 * @param {number} n
 * @returns {string}
 */
export function seats(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`expected a whole number of seats, got ${n}`);
  }
  return String(n);
}

// Effects count Democratic seats (spec chapter 5: positive is more Democratic
// seats). The site shows the direction instead of a sign, so neither party is
// the default (site design, update of October 7, 2026).

function checkWhole(n) {
  if (!Number.isInteger(n)) {
    throw new TypeError(`expected a whole number of seats, got ${n}`);
  }
}

/**
 * A seat effect as a direction: -6 -> "R+6", 3 -> "D+3", 0 -> "0".
 * @param {number} n whole seats, positive toward Democrats
 * @returns {string}
 */
export function effect(n) {
  checkWhole(n);
  if (n === 0) return '0';
  return `${n < 0 ? 'R' : 'D'}+${Math.abs(n)}`;
}

/**
 * A seat effect in words: -6 -> "6 seats toward Republicans",
 * 1 -> "1 seat toward Democrats", 0 -> "no difference".
 * @param {number} n
 * @returns {string}
 */
export function effectWords(n) {
  checkWhole(n);
  if (n === 0) return 'no difference';
  const size = Math.abs(n);
  return `${size} ${size === 1 ? 'seat' : 'seats'} toward ${n < 0 ? 'Republicans' : 'Democrats'}`;
}

/**
 * Notation and words together: -6 -> "R+6 · 6 seats toward Republicans",
 * 0 -> "0 · no difference". The separator is a middle dot (U+00B7).
 * @param {number} n
 * @returns {string}
 */
export function effectLine(n) {
  return `${effect(n)} · ${effectWords(n)}`;
}

/**
 * A whole number with thousands separators: 5000 -> "5,000".
 * @param {number} n
 * @returns {string}
 */
export function count(n) {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new TypeError(`expected a whole number, got ${n}`);
  }
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * A fraction as a whole percent, for axis ticks and legends: 0.35 -> "35%".
 * @param {number} fraction
 * @returns {string}
 */
export function percentLabel(fraction) {
  checkFraction(fraction);
  return `${roundHalfUp(fraction, 0, 2)}%`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/**
 * A date from results.json as text: "2026-10-03" -> "October 3, 2026".
 * @param {string} iso YYYY-MM-DD
 * @returns {string}
 */
export function longDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === 'string' ? iso : '');
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return `${MONTHS[month - 1]} ${day}, ${year}`;
    }
  }
  throw new TypeError(`expected a date as YYYY-MM-DD, got ${iso}`);
}
