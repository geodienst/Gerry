// The chosen state lives in the link as #TX (site design, chapter 4).
import type { CountKey, Postal } from '../types.ts';

/**
 * The state in a location hash, or "" for the whole map.
 * "#TX", "#tx" and "#%54X" give "TX"; an unknown code, "#method" or a broken escape give "".
 * A single-seat state gives its code only when the caller passes the six as `single` (redesign, open point 6).
 * @param hash location.hash
 * @param states results.json "states", keyed by postal code
 * @param single the single-seat states, keyed by postal code
 */
export function stateFromHash(hash: string | null | undefined, states: Record<Postal, unknown>, single: Record<Postal, unknown> = {}): Postal {
  let code: string;
  try {
    code = decodeURIComponent(String(hash ?? '').replace(/^#/, '')).trim().toUpperCase();
  } catch {
    return '';
  }
  return /^[A-Z]{2}$/.test(code) && (Object.hasOwn(states, code) || Object.hasOwn(single, code)) ? code : '';
}

/**
 * The link for a state: "TX" gives "#TX"; "" gives the page without a hash.
 * @param path location.pathname + location.search
 */
export function linkFor(postal: Postal, path: string): string {
  return postal ? `#${postal}` : path;
}

// The address in the links of the share buttons (owner, October 17, 2026: "url will probably be somevotes.org").
// To check before launch. The page itself can run elsewhere, such as the preview on claude.ai.
export const SITE_URL = 'https://somevotes.org/';

/**
 * The link to chapter 01 as the reader set it: the chosen row and the national vote share on
 * the slider, in percent with one decimal. "neutral" at 0.492 gives "?count=neutral&vote=49.2#outcomes".
 * @param key the chosen row: proportional, neutral or enacted
 * @param share the Democratic share of the two-party vote at the stop on screen, as a fraction
 */
export function outcomesLink(key: string, share: number): string {
  return `?count=${encodeURIComponent(key)}&vote=${(share * 100).toFixed(1)}#outcomes`;
}

/**
 * The row and the stop of the slider in a link made by outcomesLink, or null when the link has neither.
 * An unknown row gives key null; a share half a stop (0.05 points) or more from every stop gives index null.
 * @param search location.search
 * @param keys the rows of chapter 01
 * @param shares the share at each stop of the slider, as fractions
 */
export function outcomesFromSearch<K extends string = CountKey>(
  search: string, keys: readonly K[], shares: readonly number[],
): { key: K | null; index: number | null } | null {
  const params = new URLSearchParams(search);
  if (!params.has('count') && !params.has('vote')) return null;
  const count = params.get('count');
  const key = keys.find((k) => k === count) ?? null;
  const vote = Number(params.get('vote') ?? Number.NaN);
  const off = (i: number): number => Math.abs(shares[i] * 100 - vote);
  const nearest = shares.reduce((best, s, i) => (off(i) < off(best) ? i : best), 0);
  return { key, index: Number.isFinite(vote) && off(nearest) < 0.05 - 1e-9 ? nearest : null };
}
