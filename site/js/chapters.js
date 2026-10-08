// Texts and view models for the four chapters of the redesign (docs/superpowers/specs/2026-10-08-redesign-design.md).
// Pure, like model.js and extensions.js: no DOM and no d3, every number through format.js, nothing new computed.
import { share, sliderShare, neededShare, planShare, seats, count, effect, effectWords, effectLine, percentLabel } from './format.js';
import { nationalView, stateSheet, axisLabel, AT_LARGE_TEXT } from './model.js';
import { stateExtras, majorityView, senateView, redrawView, competitiveText, controlTables } from './extensions.js';
import { seatTicks, rowDomain } from './axes.js';

export const LABELS = { proportional: 'Vote-proportional', neutral: 'Neutral-map median', enacted: 'Enacted maps' };
// The rows of dots (drawDotRows) have 112 units for a label: there the short forms (owner decision, October 8, 2026).
export const SHORT_LABELS = { proportional: 'Proportional', neutral: 'Neutral median', enacted: 'Enacted' };
export const EFFECT_LABELS = { geographic: 'Geographic effect', drawing: 'Drawing effect' };

const sum = (values) => values.reduce((a, b) => a + b, 0);
// "217 to 229", or one number if both ends are equal
const range = (lo, hi) => (lo === hi ? seats(lo) : `${seats(lo)} to ${seats(hi)}`);
const plural = (n, one, many) => (n === 1 ? one : many);

// --- Chapter 01: one electorate, three outcomes (Task 7.3) --------------------------------------

/**
 * The rows, effects, band and sentences of chapter 01 at one point of the vote slider (plan 2026-10-08-vote-slider):
 * a point of results.national.swing, or the base point with the main numbers.
 */
function pointView(p, total) {
  const { median, p5, p95 } = p.neutral;
  const band = p5 === p95 ? `90% of outcomes give ${seats(p5)}` : `90% of outcomes: ${seats(p5)} to ${seats(p95)}`;
  const where = p.enacted < p5 ? 'below that range' : p.enacted > p95 ? 'above that range' : 'within that range';
  const drawing = p.enacted - median;
  const step = (key, value, from, to) => ({
    key, label: EFFECT_LABELS[key], value: effect(value), words: effectWords(value),
    detail: `${effectWords(value)} (${seats(from)} to ${seats(to)})`,
  });
  const at = p.base ? `with the 2016 and 2020 votes (${sliderShare(p.share)} for Democrats)`
    : `with Democrats at ${sliderShare(p.share)} of the two-party vote`;
  return {
    share: p.share, base: p.base, label: sliderShare(p.share),
    valueText: `${sliderShare(p.share)} of the two-party vote for Democrats${p.base ? ', the 2016 and 2020 result' : ''}`,
    rows: [
      { key: 'proportional', label: LABELS.proportional, seats: p.proportional, value: seats(p.proportional),
        desc: "Each state's seats in proportion to its two-party vote." },
      { key: 'neutral', label: LABELS.neutral, seats: median, value: seats(median),
        desc: `The middle outcome of the neutral maps. ${band}.` },
      { key: 'enacted', label: LABELS.enacted, seats: p.enacted, value: seats(p.enacted),
        desc: 'The maps used on November 3, 2026.' },
    ],
    steps: [
      step('geographic', median - p.proportional, p.proportional, median),
      step('drawing', drawing, median, p.enacted),
    ],
    band: {
      lo: p5, hi: p95,
      key: `Outlined: where the Democratic seats end in 90% of neutral outcomes (${range(p5, p95)} of these ${seats(total)})`,
    },
    // One finding beside the waffle, said as the result of this comparison (expert feedback, October 8, 2026).
    finding: drawing === 0
      ? `In this comparison, ${at}, the enacted maps give Democrats ${seats(p.enacted)} seats, the same as the neutral-map median.`
      : `In this comparison, ${at}, the enacted maps shift ${effectWords(drawing)}. `
        + `They give Democrats ${seats(p.enacted)} seats, where the neutral-map median gives ${seats(median)}.`,
    spread: `90% of neutral outcomes give Democrats ${range(p5, p95)} seats. The enacted maps give ${seats(p.enacted)}, ${where}.`,
    position: `In ${planShare(p.more)} of neutral outcomes Democrats win more seats than under the enacted maps.`,
  };
}

/** Everything chapter 01 shows: the three rows, the effects between them, the band and the sentences beside the waffle. */
export function outcomesView(results) {
  const n = results.national;
  const m = n.majority;
  const national = nationalView(results);
  const states = count(Object.keys(results.states).length);
  const plans = count(sum(Object.values(results.states)[0].neutral.dist));
  // the base point always takes the main numbers; the other points come from the slider grid
  const base = { share: m.base_share, proportional: n.proportional, enacted: n.enacted, base: true,
    neutral: { median: n.neutral.median, p5: n.neutral.p5, p95: n.neutral.p95 }, more: n.position.more };
  // a grid point that reads like the base share (51.8% next to 0.51797) would be a second stop with the same label
  const points = [...(n.swing?.points ?? []).filter((p) => !p.base && sliderShare(p.share) !== sliderShare(base.share)), base]
    .sort((a, b) => a.share - b.share).map((p) => pointView(p, n.seats));
  const baseIndex = points.findIndex((p) => p.base);
  const main = points[baseIndex];
  // A tick at the first stop where a count reaches a majority, so the label and the waffle at that stop agree.
  const reach = (key) => points.findIndex((p) => p.rows.find((r) => r.key === key).seats >= m.seats_needed);
  const ticks = ['proportional', 'neutral', 'enacted'].map((key) => ({ key, index: reach(key), name: SHORT_LABELS[key] }))
    .filter((x) => x.index >= 0).map((x) => ({ ...x, value: points[x.index].label }));
  const from = (key) => {
    const found = ticks.find((x) => x.key === key);
    return found ? `at ${found.value}` : `above ${points.at(-1).label}`;
  };
  return {
    intro: `Democratic seats in the ${states} states with more than one seat, counted three ways with the same votes. `
      + 'Select a row to see it as seats.',
    total: n.seats,
    rows: main.rows,
    steps: main.steps,
    band: main.band,
    finding: main.finding,
    house: houseView(results, m.seats_needed),
    effectsNote: 'The geographic effect is the difference between proportional seats and neutral maps. '
      + 'The drawing effect is the difference between neutral maps and the enacted maps.',
    spread: main.spread,
    position: main.position,
    neutralNote: `The neutral maps come from the ALARM Project. For each state a computer drew ${plans} maps that follow `
      + "the state's rules, such as equal population and the Voting Rights Act, without using party data. "
      + `The national figures combine the ${states} states.`,
    scope: national.note,
    points,
    baseIndex,
    slider: {
      label: 'Democratic share of the national two-party vote',
      ticks,
      majority: `On the slider, a House majority starts ${from('proportional')} of the two-party vote `
        + `if seats follow the votes, ${from('neutral')} on neutral maps and ${from('enacted')} on the enacted maps.`,
    },
  };
}

// The six one-seat states count for the party that won them in both 2016 and 2020, as in majorityView.
const SINGLE_SEAT_PARTY = { DE: 'D', VT: 'D', AK: 'R', ND: 'R', SD: 'R', WY: 'R' };
const names = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const bothOrAll = (k) => (k === 2 ? 'both states' : `all ${['', 'one', 'two', 'three', 'four', 'five', 'six'][k] ?? k} states`);

/** The House of 435 around the waffle: the framed one-seat states and the key. */
function houseView(results, needed) {
  const single = results.national.single_seat;
  const party = (p) => single.filter((s) => SINGLE_SEAT_PARTY[s.postal] === p).map((s) => s.name);
  const d = party('D');
  const r = party('R');
  // seats_needed comes from the pipeline with the same rule; a different count means the two disagree
  if (d.length + r.length !== single.length || 218 - needed !== d.length) {
    throw new Error(`one-seat states: ${d.length} Democratic and ${r.length} Republican do not match ${needed} districts needed`);
  }
  const text = (list, who) => `${names(list)}: one seat each, not part of the comparison. They count for ${who}, `
    + `who won ${bothOrAll(list.length)} in 2016 and 2020.`;
  return {
    dSingle: d.length, rSingle: r.length,
    singles: [{ party: 'D', text: text(d, 'Democrats') }, { party: 'R', text: text(r, 'Republicans') }],
    fillKey: '1 square = 1 seat of 435. Democrats fill from the left, Republicans from the right.',
    singleKey: 'Framed: the six states with one seat, the same in every count.',
  };
}

/** The key of the dots on the seats that changed party with the last choice of row. */
export function changedKey(k) {
  return `Dot: the ${seats(k)} ${plural(k, 'seat', 'seats')} that changed with this choice`;
}

/** The line above the waffle and its title, for the chosen row. */
export function waffleText(view, key) {
  const row = view.rows.find((r) => r.key === key);
  const rest = view.total - row.seats;
  const house = row.seats + view.house.dSingle;
  return {
    d: seats(row.seats),
    r: seats(rest),
    house,
    label: `${row.label}: ${seats(row.seats)} Democratic and ${seats(rest)} Republican seats of ${seats(view.total)}. `
      + `With the six one-seat states, ${seats(house)} of 435 seats are Democratic: `
      + `a ${house >= 218 ? 'Democratic' : 'Republican'} majority.`,
  };
}

// --- Chapter 02: state by state (Task 7.4) ------------------------------------------------------

export const LARGEST_MIN = 3; // seats; every state at or above it is listed, the rest is counted

/**
 * "Drawing effects of 3 seats or more": every state at or above the threshold, by size, toward Republicans
 * first at equal size, then by name; and one sentence that counts the states below it.
 */
export function largestEffects(results, min = LARGEST_MIN) {
  const rows = Object.entries(results.states).map(([postal, s]) => ({ postal, name: s.name, drawing: s.effects.drawing }));
  const chips = rows
    .filter((r) => Math.abs(r.drawing) >= min)
    .sort((a, b) => Math.abs(b.drawing) - Math.abs(a.drawing) || a.drawing - b.drawing || a.name.localeCompare(b.name, 'en'))
    .map((r) => ({ ...r, label: effect(r.drawing), aria: `${r.name}, ${effectLine(r.drawing)}` }));
  const small = rows.filter((r) => r.drawing !== 0 && Math.abs(r.drawing) < min).length;
  const zero = rows.filter((r) => r.drawing === 0).length;
  const under = min === 2 ? '1 seat' : min === 3 ? '1 or 2 seats' : `1 to ${count(min - 1)} seats`;
  const parts = [];
  if (small > 0) parts.push(`${count(small)} ${plural(small, 'state', 'states')} at ${under} either way`);
  if (zero > 0) parts.push(`${count(zero)} ${plural(zero, 'state', 'states')} at 0`);
  return {
    title: `Drawing effects of ${count(min)} seats or more`,
    chips,
    rest: parts.length > 0 ? `Then ${parts.join(', and ')}.` : '',
  };
}

/** The state record: the sheet of Phase 6 (stateSheet, stateExtras) with the headline and the seat strip. */
export function recordView(results, postal) {
  const s = results.states[postal];
  const sheet = stateSheet(results, postal);
  const d = s.effects.drawing;
  const words = effectWords(d);
  return {
    ...sheet,
    kicker: 'State record',
    extras: stateExtras(results, postal),
    headline: {
      value: effect(d),
      drawing: d,
      sentence: d === 0
        ? 'No difference from the neutral-map median.'
        : `${words[0].toUpperCase()}${words.slice(1)} compared with the state's neutral-map median.`,
    },
    strip: {
      domain: [0, s.seats],
      ticks: seatTicks(s.seats).map((value) => ({ value, text: seats(value) })),
      rows: [
        { key: 'proportional', label: SHORT_LABELS.proportional, value: s.proportional },
        { key: 'neutral', label: SHORT_LABELS.neutral, value: s.neutral.median, band: [s.neutral.p5, s.neutral.p95] },
        { key: 'enacted', label: SHORT_LABELS.enacted, value: s.enacted, filled: true },
      ],
      label: axisLabel(s.name, sheet.axis, 'maps'),
    },
  };
}

/** The short record of a state with one seat (redesign, chapter 4). */
export function singleSeatView(results, postal) {
  const s = results.national.single_seat.find((x) => x.postal === postal);
  return {
    postal,
    name: s.name,
    kicker: 'State record',
    headline: '1 seat',
    lines: [AT_LARGE_TEXT, `Not counted in the ${seats(results.national.seats)} seats compared here.`],
  };
}

// --- Chapter 03: what the maps decide (Task 7.5) ------------------------------------------------

/** A spec for drawDotRows: the domain on whole steps around the values, ticks with their text, and the rows. */
function dots(values, step, tickText, rows, base = undefined) {
  const { domain, ticks } = rowDomain(values, step);
  return { domain, ticks: ticks.map((value) => ({ value, text: tickText(value) })), rows, ...(base ? { base } : {}) };
}

/** The cards of chapter 03: the texts of the extensions (Phase 6) with large figures and rows of dots. */
export function decideView(results) {
  const n = results.national;
  const majority = majorityView(results);
  const m = n.majority;
  const c = n.competitive;
  const s = n.senate;
  const senate = senateView(results);
  const redraws = redrawView(results);
  return {
    intro: 'The same votes, read for control of the House and the Senate, for redraws since 2024 and for close districts.',
    majority: {
      ...majority,
      dots: dots(
        [m.proportional.share, m.neutral.share, m.neutral.low, m.neutral.high, m.enacted.share, m.base_share], 0.01, percentLabel,
        [
          { key: 'proportional', label: SHORT_LABELS.proportional, value: m.proportional.share, text: neededShare(m.proportional.share) },
          { key: 'neutral', label: SHORT_LABELS.neutral, value: m.neutral.share, text: neededShare(m.neutral.share), band: [m.neutral.low, m.neutral.high] },
          { key: 'enacted', label: SHORT_LABELS.enacted, value: m.enacted.share, text: neededShare(m.enacted.share), filled: true },
        ],
        { value: m.base_share, text: majority.axis.baseText },
      ),
    },
    senate: {
      figures: [
        { value: neededShare(s.share), label: 'needed for a majority' },
        { value: share(s.base_share), label: 'Democratic share' },
        { value: count(s.states_at_base), label: `states won, ${count(s.states_needed)} needed` },
      ],
      sentence: senate.sentence,
      note: senate.note,
    },
    competitive: {
      figures: [{ value: count(c.enacted), label: 'enacted maps' }, { value: count(c.median), label: 'neutral median' }],
      dots: dots([c.enacted, c.median, c.p5, c.p95], 5, count, [
        { key: 'neutral', label: SHORT_LABELS.neutral, value: c.median, band: [c.p5, c.p95] },
        { key: 'enacted', label: SHORT_LABELS.enacted, value: c.enacted, filled: true },
      ]),
      label: `Competitive districts: ${count(c.enacted)} on the enacted maps and ${count(c.median)} on neutral maps, `
        + `with 90% of neutral maps between ${count(c.p5)} and ${count(c.p95)}.`,
      text: competitiveText(c, 'maps'),
    },
    redraws: {
      figures: [
        { value: `${seats(n.redraw.seats_2024)} to ${seats(n.enacted)}`, label: 'Democratic seats, 2024 maps to 2026 maps' },
        { value: effect(n.redraw.change), label: effectWords(n.redraw.change) },
      ],
      sentence: redraws.sentence,
      rows: redraws.rows,
    },
    control: controlTables(results),
  };
}
