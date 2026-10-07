// Texts and view models built from results.json (spec chapter 7). Pure: no DOM
// and no d3, so node --test covers every sentence the site shows. Every number
// goes through format.js; nothing here computes a new statistic.
import { share, seats, effectLine } from './format.js';

// --- The map (Task 6.2) -------------------------------------------------------------------------

export const AT_LARGE_TEXT = 'One at-large seat. No districts, so nothing to compare.';

/** Lookups for the map: the 44 states, the six single-seat states and each district's share. */
export function indexResults(results) {
  const single = Object.fromEntries(results.national.single_seat.map((s) => [s.postal, s]));
  const shareOf = {};
  for (const s of Object.values(results.states)) for (const d of s.districts) shareOf[d.id] = d.share;
  return { results, states: results.states, single, shareOf };
}

/** "4809" in Texas -> "TX-9". */
export function districtLabel(id, postal) {
  return `${postal}-${Number.parseInt(id.slice(2), 10)}`;
}

/** Tooltip in the view "Districts: Democratic share": { title, lines }. */
export function districtTip(index, id, postal) {
  if (index.single[postal]) return { title: index.single[postal].name, lines: [AT_LARGE_TEXT] };
  return {
    title: `${districtLabel(id, postal)} · ${index.states[postal].name}`,
    lines: [`Democratic share ${share(index.shareOf[id])}`],
  };
}

/** Tooltip in the view "States: drawing effect". */
export function stateTip(index, postal) {
  if (index.single[postal]) return { title: index.single[postal].name, lines: [AT_LARGE_TEXT] };
  const s = index.states[postal];
  return {
    title: s.name,
    lines: [
      `Drawing effect ${effectLine(s.effects.drawing)}`,
      `Neutral ${seats(s.neutral.median)}, enacted ${seats(s.enacted)} Democratic seats`,
    ],
  };
}

/** The line under the map after a tap or click: "TX-9: 46.9% Democratic". */
export function tapLine(index, id, postal, view) {
  if (index.single[postal]) return `${index.single[postal].name}: ${AT_LARGE_TEXT}`;
  if (view === 'states') return '';
  return `${districtLabel(id, postal)}: ${share(index.shareOf[id])} Democratic`;
}

/** The 44 states for the "State" menu, by name. */
export function stateOptions(results) {
  return Object.entries(results.states)
    .map(([postal, s]) => ({ postal, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The hint under the map and the messages over it (site design, update of October 7). */
export function mapHints({ touch, mac }) {
  const key = mac ? '⌘' : 'Ctrl';
  return {
    hint: touch
      ? 'Tap a state to zoom in on its districts. Use two fingers to zoom and move the map.'
      : `Click a state to zoom in on its districts. ${key} + scroll to zoom, drag to move.`,
    wheel: `Use ${key} + scroll to zoom the map`,
    touch: 'Use two fingers to move the map',
  };
}

export const LEGEND_TEXT = {
  districts: 'Democratic share of the two-party vote.',
  states: 'Seats the enacted map moves toward one party, compared with the neutral median.',
  low: 'More Republican',
  high: 'More Democratic',
  blank: 'Gray: one at-large seat.',
};
