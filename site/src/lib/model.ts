// Texts and view models built from results.json (spec chapter 7). Pure: no DOM
// and no d3, so node --test covers every sentence the site shows. Every number
// goes through format.ts; nothing here computes a new statistic.
import {
  share, planShare, advantage, seats, count, effect, effectWords, effectLine, longDate, margin,
} from './format.ts';
import { sum, plural, seatSpan, capitalize } from './text.ts';
import type {
  Band, CountKey, MapView, Measure, Party, Position, Postal, Results, SingleSeat, Status,
} from '../types.ts';
import type { SeatMarks } from './axes.ts';

// The names of the three counts and the two effects, as the site writes them.
export const LABELS: Record<CountKey, string> = { proportional: 'Vote-proportional', neutral: 'Neutral-map median', enacted: 'Enacted maps' };
// The rows of dots (drawDotRows) have 112 units for a label: there the short forms.
export const SHORT_LABELS: Record<CountKey, string> = { proportional: 'Proportional', neutral: 'Neutral median', enacted: 'Enacted' };
export const EFFECT_LABELS = { geographic: 'Geographic effect', drawing: 'Drawing effect' } as const;

/** The number of neutral maps per state, the same for every state. */
export const planCount = (results: Results): number => sum(Object.values(results.states)[0].neutral.dist);

/** A text for a tooltip: a bold title and lines under it. */
export interface Tip {
  title: string;
  lines: string[];
}

// --- The map (Task 6.2) -------------------------------------------------------------------------

export const AT_LARGE_TEXT = 'One at-large seat. No districts, so nothing to compare.';

/** Lookups for the map: the 44 states, the six single-seat states and each district's share. */
export function indexResults(results: Results) {
  const single: Record<Postal, SingleSeat> = Object.fromEntries(results.national.single_seat.map((s) => [s.postal, s]));
  const shareOf: Record<string, number> = {};
  for (const s of Object.values(results.states)) for (const d of s.districts) shareOf[d.id] = d.share;
  return { results, states: results.states, single, shareOf };
}
export type Index = ReturnType<typeof indexResults>;

/** "4809" in Texas -> "TX-9". */
export function districtLabel(id: string, postal: Postal): string {
  return `${postal}-${Number.parseInt(id.slice(2), 10)}`;
}

/** Tooltip in the view "Districts: Democratic share": { title, lines }. */
export function districtTip(index: Index, id: string, postal: Postal): Tip {
  if (index.single[postal]) return { title: index.single[postal].name, lines: [AT_LARGE_TEXT] };
  return {
    title: `${districtLabel(id, postal)}, ${index.states[postal].name}`,
    lines: [`Democratic share ${share(index.shareOf[id])}`],
  };
}

/** Tooltip in the view "States: drawing effect". */
export function stateTip(index: Index, postal: Postal): Tip {
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

// --- The view "Districts: close races" -------------------------------

/** A Democratic share from 45% to 55%, both included: the competitive range of chapter 03. */
export const isClose = (fraction: number): boolean => fraction >= 0.45 && fraction <= 0.55;

/**
 * A swing state: 48.5% to 51.5% Democratic statewide on the 2016 and 2020 votes (the seven battleground states
 * of 2024 plus Florida). The six single-seat states are left out.
 */
export const isSwing = (index: Pick<Index, 'states'>, postal: Postal): boolean => Boolean(index.states[postal]) && Math.abs(index.states[postal].d_share - 0.5) <= 0.015;

/** How close a district is, by the margin between the parties: 'tight' under 2 points, 'near' 2 to 5, else null. */
export type Closeness = 'tight' | 'near';
export function closeness(fraction: number): Closeness | null {
  const gap = Math.abs(2 * fraction - 1);
  return gap < 0.02 ? 'tight' : gap < 0.05 ? 'near' : null;
}

/** Tooltip in the view "Districts: close races": the district, and for its state the close districts on both kinds of map. */
export function closeTip(index: Index, id: string, postal: Postal): Tip {
  if (index.single[postal]) return districtTip(index, id, postal);
  const s = index.states[postal];
  const value = index.shareOf[id];
  const lines = [`Democratic share ${share(value)}${isClose(value) ? `, a margin of ${margin(value)}` : ''}`];
  if (s.competitive) {
    lines.push(`Close districts in ${s.name}: ${count(s.competitive.enacted)} on the enacted map, `
      + `a median of ${count(s.competitive.median)} on neutral maps`);
  }
  return { title: `${districtLabel(id, postal)}, ${s.name}`, lines };
}

/** The key of the view "Districts: close races": two fills, two dots, the pale rest, the swing states and the counts. */
export function closeLegend(results: Results) {
  const c = results.national.competitive;
  const index = { states: results.states };
  const swing = Object.keys(results.states).filter((postal) => isSwing(index, postal)).length;
  return {
    // two layers, each with one job: gold outlines for swing states, rings for close calls
    items: [
      { key: 'swing', text: 'Gold outline: swing state, 48.5% to 51.5% Democratic statewide' },
      { key: 'tight', text: 'Thick ring: close call, under 2 points apart' }, { key: 'near', text: 'Thin ring: 2 to 5 points apart' },
      { key: 'd', text: 'Close district, Democrats ahead' }, { key: 'r', text: 'Close district, Republicans ahead' },
      { key: 'other', text: 'Gray: not close, more than 10 points apart' },
    ],
    note: `${count(c.enacted)} close districts (45% to 55% Democratic) on the enacted maps; neutral maps give a median `
      + `of ${count(c.median)}. ${count(swing)} swing ${plural(swing, 'state', 'states')}, counted on the 2016 and 2020 votes.`,
  };
}
export type CloseLegend = ReturnType<typeof closeLegend>;

/** The line under the map after a tap or click: "TX-9: 46.9% Democratic". */
export function tapLine(index: Index, id: string, postal: Postal, view: MapView): string {
  if (index.single[postal]) return `${index.single[postal].name}: ${AT_LARGE_TEXT}`;
  if (view === 'states') return '';
  return `${districtLabel(id, postal)}: ${share(index.shareOf[id])} Democratic`;
}

/** The states for the "State" menu, by name; with `single` also the six single-seat states (redesign, open point 6). */
export function stateOptions(results: Results, { single = false } = {}): { postal: Postal; name: string; label: string }[] {
  const options = Object.entries(results.states).map(([postal, s]) => ({ postal, name: s.name, label: s.name }));
  if (single) {
    for (const s of results.national.single_seat) options.push({ postal: s.postal, name: s.name, label: `${s.name} (one seat)` });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The hint under the map and the messages over it (site design, update of October 7). */
export function mapHints({ mac }: { touch: boolean; mac: boolean }) {
  const key = mac ? '⌘' : 'Ctrl';
  // no hint line under the map; these two only show over the map when a gesture needs them
  return {
    wheel: `Use ${key} + scroll to zoom the map`,
    touch: 'Use two fingers to move the map',
  };
}
export type MapHints = ReturnType<typeof mapHints>;

/** The title above the map for each view. */
export const MAP_TITLES: Record<MapView, string> = {
  districts: 'Democratic vote share by district', states: 'Drawing effect by state', close: 'Close districts and swing states',
};

// the two ends of the district scale
export const LEGEND_TEXT = {
  low: 'More Republican',
  high: 'More Democratic',
  // the six states with one seat, gray in the views of the districts and of the drawing effect
  blank: 'Gray: one seat, no districts',
};

// --- "Drawing effect by state" and the state sheet (Task 6.4) -----------------------------------

export const STATUS_LABELS: Record<Status, string> = {
  'In effect': 'In effect', Challenged: 'Challenged in court', Blocked: 'Blocked', 'At-large': 'At-large',
};

/** The list without a chosen state: states toward Republicans, zero states, states toward Democrats, and the sums. */
export function effectList(results: Results) {
  const rows = Object.entries(results.states)
    .map(([postal, s]) => ({ postal, name: s.name, drawing: s.effects.drawing, label: effect(s.effects.drawing) }))
    .sort((a, b) => a.drawing - b.drawing || a.name.localeCompare(b.name, 'en'));
  const toR = rows.filter((r) => r.drawing < 0);
  const zero = rows.filter((r) => r.drawing === 0);
  const toD = rows.filter((r) => r.drawing > 0);
  const seatsR = sum(toR.map((r) => -r.drawing));
  const seatsD = sum(toD.map((r) => r.drawing));
  const net = seatsD - seatsR;
  const moves = (n: number, total: number, party: string): string => (n === 0
    ? `no state moves a seat toward ${party}`
    : `${count(n)} ${plural(n, 'state moves', 'states move')} ${seats(total)} ${plural(total, 'seat', 'seats')} toward ${party}`);
  const first = moves(toR.length, seatsR, 'Republicans');
  return {
    toR, zero, toD, seatsR, seatsD, net,
    zeroLabel: `${count(zero.length)} ${plural(zero.length, 'state matches its', 'states match their')} neutral median`,
    summary: `${capitalize(first)}, ${moves(toD.length, seatsD, 'Democrats')}. Net: ${effectWords(net)}.`,
    bar: {
      left: `${seats(seatsR)} toward Republicans`,
      right: `${seats(seatsD)} toward Democrats`,
      net: `Net ${effect(net)}`,
      label: `${seats(seatsR)} ${plural(seatsR, 'seat', 'seats')} toward Republicans, ${seats(seatsD)} toward Democrats, net ${effectWords(net)}`,
    },
  };
}
export type EffectList = ReturnType<typeof effectList>;
export type EffectRow = EffectList['toR'][number];

/** "90% of maps: 1 to 3", or "90% of maps give 2" if the band is one seat count. */
export function bandText(band: Pick<Band, 'p5' | 'p95'>, unit: string): string {
  return band.p5 === band.p95 ? `90% of ${unit} give ${seats(band.p5)}` : `90% of ${unit}: ${seatSpan(band.p5, band.p95)}`;
}

/** "Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more." */
export function positionText(position: Position, plans: number, what: string): string {
  return `Of the ${count(plans)} neutral maps, ${planShare(position.fewer)} give fewer Democratic seats than ${what}, `
    + `${planShare(position.equal)} the same number and ${planShare(position.more)} more.`;
}

// If p5 and p95 round to the same text, the median does too (it lies between them): show the value once,
// like bandText does for seats. If the median, p5 and p95 all point toward one party, name the party once,
// with the range from the smaller to the larger number of points.
function measureContext(m: Measure): string {
  const p5 = advantage(m.p5);
  const p95 = advantage(m.p95);
  if (p5 === p95) return `(90% of neutral maps: ${p5})`;
  const median = advantage(m.median);
  const party = (text: string): string | undefined => / toward (Republicans|Democrats)$/.exec(text)?.[1];
  const side = party(median);
  if (side && party(p5) === side && party(p95) === side) {
    const points = (text: string): string => text.slice(0, text.indexOf(' '));
    const [low, high] = [points(p5), points(p95)].sort((a, b) => Number(a) - Number(b));
    return `(neutral maps: ${points(median)} points; 90% between ${low} and ${high} points, all toward ${side})`;
  }
  return `(neutral maps: ${median}; 90% between ${p5} and ${p95})`;
}

/** "Democratic seats in Texas: proportional 18, neutral-map median 17 (90% of maps 15 to 20), enacted 11." */
export function axisLabel(name: string, a: SeatMarks, unit: string): string {
  const band = a.p5 === a.p95 ? `give ${seats(a.p5)}` : seatSpan(a.p5, a.p95);
  return `Democratic seats in ${name}: proportional ${seats(a.proportional)}, neutral-map median ${seats(a.median)} `
    + `(90% of ${unit} ${band}), enacted ${seats(a.enacted)}.`;
}

/** Everything the sheet shows for one state, in the order of the site design (chapter 1). */
export function stateSheet(results: Results, postal: Postal) {
  const s = results.states[postal];
  const plans = sum(s.neutral.dist);
  const axis = {
    lo: 0, hi: s.seats, dist: s.neutral.dist, proportional: s.proportional,
    median: s.neutral.median, p5: s.neutral.p5, p95: s.neutral.p95, enacted: s.enacted,
  };
  const blocked = s.blocked_map && {
    name: s.blocked_map.name,
    status: STATUS_LABELS[s.blocked_map.status],
    seatsText: `With the 2016 and 2020 votes it would give ${seats(s.blocked_map.enacted)} Democratic ${plural(s.blocked_map.enacted, 'seat', 'seats')}.`,
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
      { label: LABELS.proportional, value: seats(s.proportional), sub: `${share(s.d_share)} Democratic vote` },
      { label: LABELS.neutral, value: seats(s.neutral.median), sub: bandText(s.neutral, 'maps') },
      { label: LABELS.enacted, value: seats(s.enacted), sub: s.outside_band ? 'outside the neutral band' : 'inside the neutral band' },
    ],
    seatsOf: `Democratic seats of ${seats(s.seats)}.`,
    axis,
    axisLabel: `${axisLabel(s.name, axis, 'maps')} Bars: share of the ${count(plans)} neutral maps per seat count.`,
    effects: [
      { label: EFFECT_LABELS.geographic, value: effectLine(s.effects.geographic), note: '(neutral maps compared with proportional)' },
      { label: EFFECT_LABELS.drawing, value: effectLine(s.effects.drawing), note: '(enacted map compared with neutral maps)' },
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
export type StateSheet = ReturnType<typeof stateSheet>;

// --- The national section (Task 6.7) ------------------------------------------------------------

// A count of up to ten in a sentence, as a word: "The six states". Larger counts as digits.
export const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// The six single-seat states count for the party that won them in both 2016 and 2020 (extensions design, chapter 6).
export const SINGLE_SEAT_PARTY: Record<Postal, Party> = { DE: 'D', VT: 'D', AK: 'R', ND: 'R', SD: 'R', WY: 'R' };

/**
 * The House: the districts of results.json plus the single-seat states, and how many of those go to each party. The
 * national counts are shown in this House: the single-seat states add the same
 * seats to every count, so the effects stay as they are.
 */
export function houseOf(results: Results): { total: number; dSingle: number; rSingle: number } {
  const single = results.national.single_seat;
  const of = (party: Party): number => single.filter((s) => SINGLE_SEAT_PARTY[s.postal] === party).length;
  return { total: results.national.seats + single.length, dSingle: of('D'), rSingle: of('R') };
}

/** The national strip: the three numbers, the seat axis, the effects and the position, in the House of 435. */
export function nationalView(results: Results) {
  const n = results.national;
  const { total, dSingle } = houseOf(results);
  const names = n.single_seat.map((s) => s.name).sort((a, b) => a.localeCompare(b, 'en'));
  const howMany = COUNT_WORDS[names.length] ?? count(names.length);
  const neutral = { median: n.neutral.median + dSingle, p5: n.neutral.p5 + dSingle, p95: n.neutral.p95 + dSingle };
  // the distribution moves up by the Democratic single seats: index = Democratic seats of the House
  const axis = {
    dist: [...Array<number>(dSingle).fill(0), ...n.neutral.dist], proportional: n.proportional + dSingle, ...neutral,
    enacted: n.enacted + dSingle,
  };
  return {
    note: `${seats(total)} seats. The ${howMany} states with one at-large seat (${names.join(', ')}) count the same in all `
      + 'three ways, for the party that won them in 2016 and 2020; they cannot be redrawn.',
    trio: [
      { label: LABELS.proportional, value: seats(axis.proportional), sub: 'seats follow the vote' },
      { label: LABELS.neutral, value: seats(axis.median), sub: bandText(neutral, 'outcomes') },
      { label: LABELS.enacted, value: seats(axis.enacted), sub: 'maps used in 2026' },
    ],
    axis,
    seatsTotal: total,
    axisLabel: `${axisLabel(`the House of ${seats(total)}`, axis, 'outcomes')} Bars: share of neutral outcomes per seat count.`,
    effects: `Geographic effect ${effect(n.effects.geographic)}: neutral maps give ${effectWords(n.effects.geographic)} `
      + `compared with seats that follow the vote. Drawing effect ${effect(n.effects.drawing)}: the enacted maps give `
      + `${effectWords(n.effects.drawing)} compared with neutral maps.`,
    position: `In ${planShare(n.position.more)} of neutral outcomes Democrats win more seats than under the enacted maps.`,
    caption: 'Bars: share of neutral outcomes per seat count; shaded: 5th to 95th percentile.',
  };
}
export type NationalView = ReturnType<typeof nationalView>;

// --- The method and the footer (Task 6.8) -------------------------------------------------------

/** Text for the [data-fill] spans in the method section and the footer. */
export function methodFills(results: Results): Record<string, string> {
  const { meta, states } = results;
  const la = states.LA.neutral; // Known limits: the share of Louisiana's neutral maps at the median
  return {
    plans: count(planCount(results)),
    states: count(Object.keys(states).length),
    'alarm-version': count(meta.ensemble.version),
    'status-date': longDate(meta.status_checked),
    generated: longDate(meta.generated),
    'la-share': planShare(la.dist[la.median] / sum(la.dist)),
    'la-seats': `${seats(la.median)} Democratic ${plural(la.median, 'seat', 'seats')}`,
    // the Democratic share of the 2024 presidential vote (MIT), named in the method next to the vote slider
    ...(results.national.president ? { 'share-2024': share(results.national.president['2024']) } : {}),
  };
}

// --- The column beside the map without a state follows the view of the map ----------
// "States: drawing effect" keeps effectList; the two district views get these.

const districtsOf = (results: Results) => Object.entries(results.states).flatMap(([postal, s]) => s.districts.map((d) => ({ ...d, postal })));

/** "Districts: Democratic share": the districts of the 2026 maps in five-point bins of the Democratic share, from the
 *  bin of the lowest share to that of the highest. A bin counts as Democratic from 50% on. */
export function districtShares(results: Results) {
  const all = districtsOf(results).map((d) => d.share);
  const dem = all.filter((v) => v > 0.5).length;
  const house = houseOf(results);
  const singles = results.national.single_seat.length;
  const first = Math.floor(Math.min(...all) * 20);
  const last = Math.min(19, Math.floor(Math.max(...all) * 20));
  const bins = [];
  for (let k = first; k <= last; k += 1) {
    const n = all.filter((v) => Math.min(19, Math.floor(v * 20)) === k).length;
    bins.push({ lo: k / 20, hi: (k + 1) / 20, n, dem: k >= 10, title: `${5 * k} to ${5 * k + 5}%: ${count(n)} ${plural(n, 'district', 'districts')}` });
  }
  return {
    title: 'Districts by Democratic share',
    // the districts of the 44 states, then the House of 435 that chapter 01 counts in
    count: `With the 2016 and 2020 votes, Democrats win ${count(dem)} of ${count(all.length)} districts. `
      + `The ${COUNT_WORDS[singles] ?? count(singles)} states with one seat add ${count(house.dSingle)} Democratic `
      + `${plural(house.dSingle, 'seat', 'seats')}, for ${count(dem + house.dSingle)} of ${count(house.total)}.`,
    bins,
    hint: 'Click a state on the map for its record.',
    label: `Bar chart: ${count(all.length)} districts by Democratic share in steps of 5 points, ${count(dem)} above 50%.`,
  };
}
export type DistrictShares = ReturnType<typeof districtShares>;

/** "Districts: close races": the districts from 45% to 55%, both included as in the method, closest to 50% first. */
export function closeDistricts(results: Results) {
  const rows = districtsOf(results).filter((d) => d.share >= 0.45 && d.share <= 0.55)
    .map((d) => ({ id: d.id, postal: d.postal, label: districtLabel(d.id, d.postal), share: d.share, text: share(d.share), dem: d.share > 0.5 }))
    .sort((a, b) => Math.abs(a.share - 0.5) - Math.abs(b.share - 0.5) || a.label.localeCompare(b.label));
  return {
    title: 'Close districts, 45 to 55%',
    count: `${count(rows.length)} on the 2026 maps.`,
    rows,
    hint: 'Click a district to zoom in.',
  };
}
export type CloseDistricts = ReturnType<typeof closeDistricts>;
