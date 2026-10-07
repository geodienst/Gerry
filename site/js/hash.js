// The chosen state lives in the link as #TX (site design, chapter 4).

/**
 * The state in a location hash, or "" for the whole map.
 * "#TX", "#tx" and "#%54X" give "TX"; a single-seat state, an unknown code,
 * "#method" or a broken escape give "".
 * @param {string} hash location.hash
 * @param {object} states results.json "states", keyed by postal code
 * @returns {string}
 */
export function stateFromHash(hash, states) {
  let code;
  try {
    code = decodeURIComponent(String(hash ?? '').replace(/^#/, '')).trim().toUpperCase();
  } catch {
    return '';
  }
  return /^[A-Z]{2}$/.test(code) && Object.hasOwn(states, code) ? code : '';
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
