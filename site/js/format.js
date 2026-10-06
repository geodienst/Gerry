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
 * A share of plans (fraction) as a whole percent: 3086/5000 -> "62%".
 * Above 0 but rounding to 0 gives "<1%"; below 1 but rounding to 100 gives ">99%".
 * @param {number} fraction
 * @returns {string}
 */
export function planShare(fraction) {
  checkFraction(fraction);
  if (fraction === 0) return '0%';
  if (fraction === 1) return '100%';
  const whole = roundHalfUp(fraction, 0, 2);
  if (whole === '0') return '<1%';
  if (whole === '100') return '>99%';
  return `${whole}%`;
}

/**
 * Efficiency gap or mean-median (fraction, positive favors Republicans) in
 * percentage points: 0.042 -> "favors Republicans by 4.2 points".
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
  if (points === '0.0') return 'Less than 0.05 points either way';
  return `favors ${value > 0 ? 'Republicans' : 'Democrats'} by ${points} points`;
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
