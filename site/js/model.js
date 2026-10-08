// Texts and view models built from results.json (spec chapter 7). Pure: no DOM
// and no d3, so node --test covers every sentence the site shows. Every number
// goes through format.js; nothing here computes a new statistic.
import {
  share, planShare, advantage, seats, count, effect, effectWords, effectLine, longDate,
} from './format.js';

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
      `Neutral-map median ${seats(s.neutral.median)}, enacted ${seats(s.enacted)} Democratic seats`,
    ],
  };
}

/** The line under the map after a tap or click: "TX-9: 46.9% Democratic". */
export function tapLine(index, id, postal, view) {
  if (index.single[postal]) return `${index.single[postal].name}: ${AT_LARGE_TEXT}`;
  if (view === 'states') return '';
  return `${districtLabel(id, postal)}: ${share(index.shareOf[id])} Democratic`;
}

/** The states for the "State" menu, by name; with `single` also the six single-seat states (redesign, open point 6). */
export function stateOptions(results, { single = false } = {}) {
  const options = Object.entries(results.states).map(([postal, s]) => ({ postal, name: s.name, label: s.name }));
  if (single) {
    for (const s of results.national.single_seat) options.push({ postal: s.postal, name: s.name, label: `${s.name} (one seat)` });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, 'en'));
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

// --- "Drawing effect by state" and the state sheet (Task 6.4) -----------------------------------

export const STATUS_LABELS = {
  'In effect': 'In effect', Challenged: 'Challenged in court', Blocked: 'Blocked', 'At-large': 'At-large',
};
const sum = (values) => values.reduce((a, b) => a + b, 0);
const plural = (n, one, many) => (n === 1 ? one : many);

/** The list without a chosen state: states toward Republicans, zero states, states toward Democrats, and the sums. */
export function effectList(results) {
  const rows = Object.entries(results.states)
    .map(([postal, s]) => ({ postal, name: s.name, drawing: s.effects.drawing, label: effect(s.effects.drawing) }))
    .sort((a, b) => a.drawing - b.drawing || a.name.localeCompare(b.name, 'en'));
  const toR = rows.filter((r) => r.drawing < 0);
  const zero = rows.filter((r) => r.drawing === 0);
  const toD = rows.filter((r) => r.drawing > 0);
  const seatsR = sum(toR.map((r) => -r.drawing));
  const seatsD = sum(toD.map((r) => r.drawing));
  const net = seatsD - seatsR;
  const moves = (n, total, party) => (n === 0
    ? `no state moves a seat toward ${party}`
    : `${count(n)} ${plural(n, 'state moves', 'states move')} ${seats(total)} ${plural(total, 'seat', 'seats')} toward ${party}`);
  const first = moves(toR.length, seatsR, 'Republicans');
  return {
    toR, zero, toD, seatsR, seatsD, net,
    zeroLabel: `${count(zero.length)} ${plural(zero.length, 'state matches its', 'states match their')} neutral median`,
    summary: `${first[0].toUpperCase()}${first.slice(1)}, ${moves(toD.length, seatsD, 'Democrats')}. Net: ${effectWords(net)}.`,
    bar: {
      left: `${seats(seatsR)} toward Republicans`,
      right: `${seats(seatsD)} toward Democrats`,
      net: `Net ${effect(net)}`,
      label: `${seats(seatsR)} ${plural(seatsR, 'seat', 'seats')} toward Republicans, ${seats(seatsD)} toward Democrats, net ${effectWords(net)}`,
    },
  };
}

// "15 to 20", or one number if the 5th and 95th percentile are equal.
const seatRange = (a) => (a.p5 === a.p95 ? seats(a.p5) : `${seats(a.p5)} to ${seats(a.p95)}`);

// "90% of maps: 1 to 3", or "90% of maps give 2" if the band is one seat count.
function bandText(neutral, unit) {
  return neutral.p5 === neutral.p95 ? `90% of ${unit} give ${seats(neutral.p5)}` : `90% of ${unit}: ${seatRange(neutral)}`;
}

/** "Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more." */
export function positionText(position, plans, what) {
  return `Of the ${count(plans)} neutral maps, ${planShare(position.fewer)} give fewer Democratic seats than ${what}, `
    + `${planShare(position.equal)} the same number and ${planShare(position.more)} more.`;
}

// If p5 and p95 round to the same text, the median does too (it lies between them): show the value once,
// like bandText does for seats. If the median, p5 and p95 all point toward one party, name the party once,
// with the range from the smaller to the larger number of points.
function measureContext(m) {
  const p5 = advantage(m.p5);
  const p95 = advantage(m.p95);
  if (p5 === p95) return `(90% of neutral maps: ${p5})`;
  const median = advantage(m.median);
  const party = (text) => / toward (Republicans|Democrats)$/.exec(text)?.[1];
  const side = party(median);
  if (side && party(p5) === side && party(p95) === side) {
    const points = (text) => text.slice(0, text.indexOf(' '));
    const [low, high] = [points(p5), points(p95)].sort((a, b) => Number(a) - Number(b));
    return `(neutral maps: ${points(median)} points; 90% between ${low} and ${high} points, all toward ${side})`;
  }
  return `(neutral maps: ${median}; 90% between ${p5} and ${p95})`;
}

/** "Democratic seats in Texas: proportional 18, neutral-map median 17 (90% of maps 15 to 20), enacted 11." */
export function axisLabel(name, a, unit) {
  const band = a.p5 === a.p95 ? `give ${seats(a.p5)}` : seatRange(a);
  return `Democratic seats in ${name}: proportional ${seats(a.proportional)}, neutral-map median ${seats(a.median)} `
    + `(90% of ${unit} ${band}), enacted ${seats(a.enacted)}.`;
}

/** Everything the sheet shows for one state, in the order of the site design (chapter 1). */
export function stateSheet(results, postal) {
  const s = results.states[postal];
  const plans = sum(s.neutral.dist);
  const axis = {
    lo: 0, hi: s.seats, dist: s.neutral.dist, proportional: s.proportional,
    median: s.neutral.median, p5: s.neutral.p5, p95: s.neutral.p95, enacted: s.enacted,
  };
  const blocked = s.blocked_map && {
    name: s.blocked_map.name,
    status: STATUS_LABELS[s.blocked_map.status],
    seatsText: `With these votes it would give ${seats(s.blocked_map.enacted)} Democratic ${plural(s.blocked_map.enacted, 'seat', 'seats')}.`,
    position: positionText(s.blocked_map.position, plans, s.blocked_map.name),
    source: s.blocked_map.source,
  };
  const shares = s.sorted.enacted;
  return {
    postal,
    name: s.name,
    mapName: s.map_name,
    status: STATUS_LABELS[s.status],
    legal: `Legal status as of ${longDate(results.meta.status_checked)}`,
    seatCount: `${seats(s.seats)} seats`,
    trio: [
      { label: 'Vote-proportional', value: seats(s.proportional), sub: `${share(s.d_share)} Democratic vote` },
      { label: 'Neutral-map median', value: seats(s.neutral.median), sub: bandText(s.neutral, 'maps') },
      { label: 'Enacted maps', value: seats(s.enacted), sub: s.outside_band ? 'outside the neutral band' : 'inside the neutral band' },
    ],
    seatsOf: `Democratic seats of ${seats(s.seats)}.`,
    axis,
    axisLabel: `${axisLabel(s.name, axis, 'maps')} Bars: share of the ${count(plans)} neutral maps per seat count.`,
    effects: [
      { label: 'Geographic effect', value: effectLine(s.effects.geographic), note: '(neutral maps compared with proportional)' },
      { label: 'Drawing effect', value: effectLine(s.effects.drawing), note: '(enacted map compared with neutral maps)' },
    ],
    position: positionText(s.position, plans, 'the enacted map'),
    blocked: blocked || null,
    sorted: s.sorted,
    sortedLabel: `${s.name}: the ${count(s.seats)} enacted districts from lowest to highest Democratic share, `
      + `${share(shares[0])} to ${share(shares[shares.length - 1])}, against the median and the 90% band of the neutral maps at each position.`,
    sortedCaption: 'Dots: enacted districts. Line and shading: median and 90% band of the neutral maps at each position.',
    measures: [
      { label: 'Efficiency gap', value: advantage(s.eg.value), context: measureContext(s.eg) },
      { label: 'Mean-median', value: advantage(s.mm ? s.mm.value : null), context: s.mm ? measureContext(s.mm) : '' },
    ],
    notes: s.notes.map((n) => n.text),
    source: s.source,
  };
}

// --- The national section (Task 6.7) ------------------------------------------------------------

// A count of up to ten in a sentence, as a word: "The six states". Larger counts as digits.
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The national strip: the three numbers, the seat axis, the effects and the position. */
export function nationalView(results) {
  const n = results.national;
  const names = n.single_seat.map((s) => s.name).sort((a, b) => a.localeCompare(b, 'en'));
  const howMany = COUNT_WORDS[names.length] ?? count(names.length);
  const axis = {
    dist: n.neutral.dist, proportional: n.proportional, median: n.neutral.median,
    p5: n.neutral.p5, p95: n.neutral.p95, enacted: n.enacted,
  };
  return {
    note: `${seats(n.seats)} seats. The ${howMany} states with one at-large seat (${names.join(', ')}) are not counted.`,
    trio: [
      { label: 'Vote-proportional', value: seats(n.proportional), sub: 'seats follow the vote' },
      { label: 'Neutral-map median', value: seats(n.neutral.median), sub: bandText(n.neutral, 'outcomes') },
      { label: 'Enacted maps', value: seats(n.enacted), sub: 'maps used in 2026' },
    ],
    axis,
    seatsTotal: n.seats,
    axisLabel: `${axisLabel('all states with more than one seat', axis, 'outcomes')} Bars: share of neutral outcomes per seat count.`,
    effects: `Geographic effect ${effect(n.effects.geographic)}: neutral maps give ${effectWords(n.effects.geographic)} `
      + `compared with seats that follow the vote. Drawing effect ${effect(n.effects.drawing)}: the enacted maps give `
      + `${effectWords(n.effects.drawing)} compared with neutral maps.`,
    position: `In ${planShare(n.position.more)} of neutral outcomes Democrats win more seats than under the enacted maps.`,
    caption: 'Bars: share of neutral outcomes per seat count; shaded: 5th to 95th percentile.',
  };
}

// --- The method and the footer (Task 6.8) -------------------------------------------------------

/** Text for the [data-fill] spans in the method section and the footer. */
export function methodFills(results) {
  const { meta, states } = results;
  const la = states.LA.neutral; // Known limits: the share of Louisiana's neutral maps at the median
  return {
    plans: count(sum(Object.values(states)[0].neutral.dist)),
    states: count(Object.keys(states).length),
    'alarm-version': count(meta.ensemble.version),
    'status-date': longDate(meta.status_checked),
    generated: longDate(meta.generated),
    'la-share': planShare(la.dist[la.median] / sum(la.dist)),
    'la-seats': `${seats(la.median)} Democratic ${plural(la.median, 'seat', 'seats')}`,
  };
}
