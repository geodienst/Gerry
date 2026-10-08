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
