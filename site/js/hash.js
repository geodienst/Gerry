// The chosen state lives in the link as #TX (site design, chapter 4).

/**
 * The state in a location hash, or "" for the whole map.
 * "#TX", "#tx" and "#%54X" give "TX"; an unknown code, "#method" or a broken escape give "".
 * A single-seat state gives its code only when the caller passes the six as `single` (redesign, open point 6).
 * @param {string} hash location.hash
 * @param {object} states results.json "states", keyed by postal code
 * @param {object} [single] the single-seat states, keyed by postal code
 * @returns {string}
 */
export function stateFromHash(hash, states, single = {}) {
  let code;
  try {
    code = decodeURIComponent(String(hash ?? '').replace(/^#/, '')).trim().toUpperCase();
  } catch {
    return '';
  }
  return /^[A-Z]{2}$/.test(code) && (Object.hasOwn(states, code) || Object.hasOwn(single, code)) ? code : '';
}

/**
 * The link for a state: "TX" gives "#TX"; "" gives the page without a hash.
 * @param {string} postal
 * @param {string} path location.pathname + location.search
 * @returns {string}
 */
export function linkFor(postal, path) {
  return postal ? `#${postal}` : path;
}

// The address in the links of the share buttons (owner, October 17, 2026: "url will probably be somevotes.org").
// To check before launch. The page itself can run elsewhere, such as the preview on claude.ai.
export const SITE_URL = 'https://somevotes.org/';

/**
 * The link to chapter 02 as the reader set it (owner, October 14, 2026): the chosen row and the national vote share on
 * the slider, in percent with one decimal. "neutral" at 0.492 gives "?count=neutral&vote=49.2#outcomes".
 * @param {string} key the chosen row: proportional, neutral or enacted
 * @param {number} share the Democratic share of the two-party vote at the stop on screen, as a fraction
 * @returns {string}
 */
export function outcomesLink(key, share) {
  return `?count=${encodeURIComponent(key)}&vote=${(share * 100).toFixed(1)}#outcomes`;
}

/**
 * The row and the stop of the slider in a link made by outcomesLink, or null when the link has neither.
 * An unknown row gives key null; a share half a stop (0.05 points) or more from every stop gives index null.
 * @param {string} search location.search
 * @param {string[]} keys the rows of chapter 02
 * @param {number[]} shares the share at each stop of the slider, as fractions
 * @returns {{key: string|null, index: number|null}|null}
 */
export function outcomesFromSearch(search, keys, shares) {
  const params = new URLSearchParams(search);
  if (!params.has('count') && !params.has('vote')) return null;
  const key = keys.includes(params.get('count')) ? params.get('count') : null;
  const vote = Number(params.get('vote') ?? Number.NaN);
  const off = (i) => Math.abs(shares[i] * 100 - vote);
  const nearest = shares.reduce((best, s, i) => (off(i) < off(best) ? i : best), 0);
  return { key, index: Number.isFinite(vote) && off(nearest) < 0.05 - 1e-9 ? nearest : null };
}
