// Texts and view models for the four chapters of the redesign (docs/superpowers/specs/2026-10-08-redesign-design.md).
// Pure, like model.ts and extensions.ts: no DOM and no d3, every number through format.ts, nothing new computed.
import {
  share, sliderShare, neededShare, planShare, seats, count, effect, effectWords, percentLabel,
} from './format.ts';
import {
  nationalView, stateSheet, axisLabel, bandText, planCount, AT_LARGE_TEXT, houseOf, SINGLE_SEAT_PARTY, COUNT_WORDS, effectList,
  LABELS, SHORT_LABELS, EFFECT_LABELS,
} from './model.ts';
import { stateExtras, senateView, redrawView, competitiveText, controlTables, legalView } from './extensions.ts';
import { seatTicks, rowDomain } from './axes.ts';
import type { DotRow } from './axes.ts';
import { plural, seatSpan, nameList, capitalize } from './text.ts';
import type { Band, CountKey, Party, Postal, Results } from '../types.ts';

export { LABELS, SHORT_LABELS, EFFECT_LABELS };

/** One row of chapter 01: a count, its Democratic seats and the line under it. */
export interface CountRow {
  key: CountKey;
  label: string;
  seats: number;
  value: string;
  desc: string;
}

/** A point of results.national.swing, or the base point with the main numbers. */
interface RawPoint {
  share: number;
  base: boolean;
  proportional: number;
  enacted: number;
  neutral: Band;
  more: number;
}

/** The row of a count at one point; every point has all three. */
function rowOf(point: { rows: CountRow[] }, key: CountKey): CountRow {
  const row = point.rows.find((r) => r.key === key);
  if (!row) throw new Error(`no row ${key}`);
  return row;
}

// --- Chapter 01: one electorate, three outcomes (Task 7.3) --------------------------------------

/**
 * The rows, effects, band and sentences of chapter 01 at one point of the vote slider (plan 2026-10-08-vote-slider):
 * a point of results.national.swing, or the base point with the main numbers. Every count is shown in the House of
 * `total` seats: the districts plus `offset`, the single-seat states fixed as Democratic.
 */
function pointView(raw: RawPoint, { offset, total }: { offset: number; total: number }) {
  const p = {
    ...raw, proportional: raw.proportional + offset, enacted: raw.enacted + offset,
    neutral: { median: raw.neutral.median + offset, p5: raw.neutral.p5 + offset, p95: raw.neutral.p95 + offset },
  };
  const { median, p5, p95 } = p.neutral;
  const mapsBand = bandText(p.neutral, 'neutral maps');
  const where = p.enacted < p5 ? 'below that range' : p.enacted > p95 ? 'above that range' : 'within that range';
  const drawing = p.enacted - median;
  const step = (key: keyof typeof EFFECT_LABELS, value: number, from: number, to: number) => ({
    key, label: EFFECT_LABELS[key], name: key === 'geographic' ? 'geography' : 'drawing', value: effect(value), words: effectWords(value),
    detail: `${effectWords(value)} (${seats(from)} to ${seats(to)})`,
  });
  const at = p.base ? `with the 2016 and 2020 votes (${sliderShare(p.share)} for Democrats)`
    : `with Democrats at ${sliderShare(p.share)} of the two-party vote`;
  return {
    share: p.share, base: p.base, label: sliderShare(p.share),
    valueText: `${sliderShare(p.share)} of the two-party vote for Democrats${p.base ? ', the 2016 and 2020 result' : ''}`,
    rows: [
      { key: 'proportional', label: LABELS.proportional, seats: p.proportional, value: seats(p.proportional),
        desc: "Seats in proportion to each state's two-party vote." },
      { key: 'neutral', label: LABELS.neutral, seats: median, value: seats(median),
        desc: `${mapsBand}.` },
      { key: 'enacted', label: LABELS.enacted, seats: p.enacted, value: seats(p.enacted),
        desc: 'The maps used on November 3, 2026.' },
    ] as CountRow[],
    steps: [
      step('geographic', median - p.proportional, p.proportional, median),
      step('drawing', drawing, median, p.enacted),
    ],
    band: {
      lo: p5, hi: p95,
      key: `Outlined: where the Democratic seats end in 90% of neutral outcomes (${seatSpan(p5, p95)} of ${seats(total)})`,
    },
    // One finding beside the waffle, said as the result of this comparison.
    finding: drawing === 0
      ? `In this comparison, ${at}, the enacted maps give Democrats ${seats(p.enacted)} seats, the same as the neutral-map median.`
      : `In this comparison, ${at}, the enacted maps shift ${effectWords(drawing)}. `
        + `They give Democrats ${seats(p.enacted)} seats, where the neutral-map median gives ${seats(median)}.`,
    spread: `90% of neutral outcomes give Democrats ${seatSpan(p5, p95)} seats. The enacted maps give ${seats(p.enacted)}, ${where}.`,
    position: `In ${planShare(p.more)} of neutral outcomes Democrats win more seats than under the enacted maps.`,
  };
}

/** Everything chapter 01 shows: the three rows, the effects between them, the band and the sentences beside the waffle. */
export function outcomesView(results: Results) {
  const n = results.national;
  const m = n.majority;
  const national = nationalView(results);
  const house = houseOf(results);
  const majority = m.seats_needed + house.dSingle; // 218 of 435
  const states = count(Object.keys(results.states).length);
  const singles = COUNT_WORDS[n.single_seat.length] ?? count(n.single_seat.length);
  const plans = count(planCount(results));
  // the base point always takes the main numbers; the other points come from the slider grid
  const base: RawPoint = { share: m.base_share, proportional: n.proportional, enacted: n.enacted, base: true,
    neutral: { median: n.neutral.median, p5: n.neutral.p5, p95: n.neutral.p95 }, more: n.position.more };
  // a grid point that reads like the base share (51.8% next to 0.51797) would be a second stop with the same label
  const points = [...(n.swing?.points ?? []).filter((p) => !p.base && sliderShare(p.share) !== sliderShare(base.share)), base]
    .sort((a, b) => a.share - b.share).map((raw) => {
      const p = { ...pointView(raw, { offset: house.dSingle, total: house.total }), more: raw.more };
      // The large sentence above the House and the 99% sentence under it, at every stop of the slider.
      const e = rowOf(p, 'enacted').seats;
      const short = majority - e;
      const part = planShare(p.more);
      return {
        ...p,
        lead: `Democrats would win ${seats(e)} seats on the 2026 maps, `
          + (short > 0 ? `${count(short)} short of a majority. ` : 'a majority. ')
          + `The result on a neutral map is ${seats(rowOf(p, 'neutral').seats)}.`,
        beats: `${capitalize(part)} of the simulated neutral maps give Democrats more seats than the 2026 maps do.`,
      };
    });
  const baseIndex = points.findIndex((p) => p.base);
  const main = points[baseIndex];
  // Why presidential votes of 2016 and 2020, and the explainer at the top of the chapter. The fifth step goes to
  // the stop nearest the Democratic share of the 2024 presidential vote.
  const p2024 = n.president?.['2024'];
  const near2024 = p2024 === undefined ? -1
    : points.reduce((best, p, i) => (Math.abs(p.share - p2024) < Math.abs(points[best].share - p2024) ? i : best), 0);
  const why = {
    summary: 'Why these votes?',
    text: 'House results depend on the maps themselves: in safe districts one party often has no candidate, and incumbents '
      + 'run ahead of their party. Presidential votes are cast everywhere for the same two candidates, so they can be counted '
      + `on any map, including the ${plans} neutral maps per state. The ALARM Project provides them by voting district for `
      + '2016 and 2020; adding both evens out the candidates of a single year.'
      + (p2024 === undefined ? '' : ` In 2024 Democrats won ${share(p2024)} of the two-party presidential vote. `
        + 'Move the slider there to see a year like it.'),
  };
  const seatsOf = (point: { rows: CountRow[] }, key: CountKey): string => rowOf(point, key).value;
  const steps: { key: CountKey; index: number; text: string }[] = [
    { key: 'proportional', index: baseIndex, text: `Each square is one seat in the U.S. House, ${seats(house.total)} in all. `
      + `The party with ${seats(majority)} seats has the majority.` },
    { key: 'proportional', index: baseIndex, text: "Vote-proportional: if each state's seats followed its two-party vote, "
      + `Democrats would win ${seatsOf(main, 'proportional')} seats.` },
    { key: 'neutral', index: baseIndex, text: `Neutral-map median: a computer drew ${plans} legal maps per state without using `
      + `party data. Their middle outcome gives Democrats ${seatsOf(main, 'neutral')} seats, ${main.steps[0].words} compared `
      + 'with the votes. That is the geographic effect.' },
    { key: 'enacted', index: baseIndex, text: 'Enacted maps: the maps the states drew for November 3, 2026 give Democrats '
      + `${seatsOf(main, 'enacted')} seats, ${main.steps[1].words} compared with neutral maps. That is the drawing effect.` },
  ];
  if (near2024 >= 0) {
    const q = points[near2024];
    steps.push({ key: 'enacted', index: near2024, text: `The slider moves the national vote. At ${q.label}, `
      + `${q.label === sliderShare(p2024!) ? '' : 'near '}the Democratic share of the 2024 presidential vote, the enacted maps `
      + `give Democrats ${seatsOf(q, 'enacted')} seats and neutral maps ${seatsOf(q, 'neutral')}.` });
  }
  const lead = main.lead;
  // The drawing effect at every stop of the slider, with a few examples: the effect is not one number.
  const seatsAt = (point: { rows: CountRow[] }, key: CountKey): number => rowOf(point, key).seats;
  const bars = points.map((p, index) => {
    const drawing = seatsAt(p, 'enacted') - seatsAt(p, 'neutral');
    return { index, share: p.share, label: p.label, drawing, value: effect(drawing),
      title: `${p.label} of the vote: ${effect(drawing)}. Enacted maps ${seats(seatsAt(p, 'enacted'))}, `
        + `neutral-map median ${seats(seatsAt(p, 'neutral'))}.` };
  });
  const strongest = bars.reduce((best, b) => (Math.abs(b.drawing) > Math.abs(best.drawing) ? b : best), bars[0]);
  const half = bars.find((b) => !points[b.index].base && Math.abs(b.share - 0.5) < 1e-9);
  const picks = [near2024 >= 0 ? bars[near2024] : null, half, bars[baseIndex], strongest]
    .filter((b): b is (typeof bars)[number] => Boolean(b));
  const examples = [...new Map(picks.map((b) => [b.index, b])).values()].sort((a, b) => a.index - b.index)
    .map((b) => ({ index: b.index, label: b.label, value: b.value,
      note: b.index === baseIndex ? '2016 + 2020' : p2024 !== undefined && b.label === sliderShare(p2024) ? '2024' : '' }));
  const line = examples.map((e) => `${e.label}${e.note ? ` (${e.note})` : ''}: ${e.value}`).join('; ');
  // where the effect turns: the first stop toward Republicans, and the stops just below it without an effect; the
  // sentence says whose vote the percentage is
  const turn = bars.findIndex((b) => b.drawing < 0);
  let even = turn;
  while (even > 0 && bars[even - 1].drawing === 0) even -= 1;
  const vote = 'of the national two-party vote';
  const where = turn < 0 ? 'At every position of the slider the enacted maps give Democrats at least as many seats as neutral maps would.'
    : turn === 0 ? 'At every position of the slider the enacted maps give Democrats fewer seats than neutral maps would.'
      : even === 0 ? `Below ${bars[turn].label} ${vote} the enacted maps give Democrats as many seats as neutral maps would; from ${bars[turn].label} on, fewer.`
        : `When Democrats win less than ${bars[even].label} ${vote}, the enacted maps give them more seats than neutral maps would. `
          + (even < turn ? `From ${bars[turn].label} on they give them fewer, and in between the same number.`
            : `From ${bars[turn].label} on they give them fewer.`);
  const byVote = {
    title: 'The effect size of enacted maps',
    text: 'The enacted maps have fewer close districts than neutral maps, so they react less when the national vote shifts. '
      + `${where} Each bar shows the drawing effect at one position of the vote slider in chapter 01; the dark line marks where the slider stands.`,
    axis: 'Democratic share of the national two-party vote',
    bars, examples, line,
    label: `Drawing effect at each point of the vote slider, from ${points[0].label} to ${points[points.length - 1].label}. ${line}.`,
    max: Math.max(5, Math.ceil(Math.max(...bars.map((b) => Math.abs(b.drawing))) / 5) * 5),
  };
  // A plain scale under the slider: the stops at whole percents, and a mark at the 2016 and 2020 votes. No labels
  // per count, which looked like choices between the counts.
  const scale = points.map((p, index) => ({ p, index }))
    .filter(({ p }) => !p.base && Math.abs(p.share * 100 - Math.round(p.share * 100)) < 1e-6)
    .map(({ p, index }) => ({ index, label: percentLabel(p.share) }));
  return {
    intro: 'Choose an option to see how the seats will be divided. On top of that, move the slider to change the national vote share.',
    total: house.total,
    rows: main.rows,
    steps: main.steps,
    band: main.band,
    finding: main.finding,
    house: houseView(results, m.seats_needed),
    effectsNote: 'The first comparison shows what changes when votes are counted in districts rather than translated into '
      + 'proportional seats. The second shows what changes when we use the 2026 maps instead of neutral maps.',
    majorityLabel: `${seats(majority)} for a majority`,
    spread: main.spread,
    position: main.position,
    neutralNote: `The neutral maps come from the ALARM Project. For each state a computer drew ${plans} maps that follow `
      + "the state's rules, such as equal population and the Voting Rights Act, without using party data. "
      + `The national figures combine the ${states} states with more than one seat and add the ${singles} states with one seat.`,
    scope: national.note,
    points,
    baseIndex,
    lead,
    byVote,
    why,
    tour: {
      intro: `A short tour of this chapter in ${COUNT_WORDS[steps.length]} steps.`,
      end: 'That is the comparison. Choose a row or move the slider to explore it yourself.',
      base: baseIndex,
      steps,
    },
    slider: {
      label: 'Democratic share of the national two-party vote',
      caption: 'The slider moves every district by the same amount; it is not a forecast.',
      scale,
      base: { index: baseIndex, label: '2016 and 2020 votes' },
    },
  };
}
export type OutcomesView = ReturnType<typeof outcomesView>;
export type OutcomesPoint = OutcomesView['points'][number];

const bothOrAll = (k: number): string => (k === 2 ? 'both states' : `all ${['', 'one', 'two', 'three', 'four', 'five', 'six'][k] ?? k} states`);

/** The House of 435 around the waffle: the framed one-seat states and the key. */
function houseView(results: Results, needed: number) {
  const single = results.national.single_seat;
  const party = (p: Party): string[] => single.filter((s) => SINGLE_SEAT_PARTY[s.postal] === p).map((s) => s.name);
  const d = party('D');
  const r = party('R');
  // seats_needed comes from the pipeline with the same rule; a different count means the two disagree
  if (d.length + r.length !== single.length || 218 - needed !== d.length) {
    throw new Error(`one-seat states: ${d.length} Democratic and ${r.length} Republican do not match ${needed} districts needed`);
  }
  const text = (list: string[], who: string): string => `${nameList(list)}: one seat each, not part of the comparison. They count for ${who}, `
    + `who won ${bothOrAll(list.length)} in 2016 and 2020.`;
  return {
    dSingle: d.length, rSingle: r.length,
    singles: [{ party: 'D' as Party, text: text(d, 'Democrats') }, { party: 'R' as Party, text: text(r, 'Republicans') }],
    fillKey: '1 square = 1 seat of 435. Democrats fill from the left, Republicans from the right.',
    singleKey: 'Framed: the six states with one seat, the same in every count.',
  };
}

/** The key of the dots on the seats that changed party with the last choice of row. */
export function changedKey(k: number): string {
  return `Star: the ${seats(k)} ${plural(k, 'seat', 'seats')} that changed with this choice`;
}

/** The line above the waffle and its title, for the chosen row. */
export function waffleText(view: { rows: CountRow[]; total: number }, key: CountKey): { d: string; r: string; label: string } {
  const row = rowOf(view, key);
  const rest = view.total - row.seats;
  return {
    d: seats(row.seats),
    r: seats(rest),
    label: `${row.label}: ${seats(row.seats)} Democratic and ${seats(rest)} Republican seats of ${seats(view.total)}: `
      + `a ${row.seats > view.total / 2 ? 'Democratic' : 'Republican'} majority.`,
  };
}

// --- Chapter 02: state by state (Task 7.4) ------------------------------------------------------

/** The state record: the sheet of Phase 6 (stateSheet, stateExtras) with the headline and the seat strip. */
export function recordView(results: Results, postal: Postal) {
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
        : `${capitalize(words)} compared with the state's neutral-map median.`,
    },
    strip: {
      domain: [0, s.seats],
      ticks: seatTicks(s.seats).map((value) => ({ value, text: seats(value) })),
      rows: [
        { key: 'proportional', label: SHORT_LABELS.proportional, value: s.proportional },
        { key: 'neutral', label: SHORT_LABELS.neutral, value: s.neutral.median, band: [s.neutral.p5, s.neutral.p95] },
        { key: 'enacted', label: SHORT_LABELS.enacted, value: s.enacted, filled: true },
      ] as CountDotRow[],
      label: axisLabel(s.name, sheet.axis, 'maps'),
    },
  };
}
export type RecordView = ReturnType<typeof recordView>;

/** The short record of a state with one seat (redesign, chapter 4). */
export function singleSeatView(results: Results, postal: Postal) {
  const s = results.national.single_seat.find((x) => x.postal === postal);
  if (!s) throw new Error(`${postal} has more than one seat`);
  return {
    postal,
    name: s.name,
    kicker: 'State record',
    headline: '1 seat',
    lines: [AT_LARGE_TEXT, `In all three counts this seat goes to ${SINGLE_SEAT_PARTY[postal] === 'D' ? 'Democrats' : 'Republicans'}, `
      + `who won ${s.name} in 2016 and 2020.`],
  };
}
export type SingleSeatView = ReturnType<typeof singleSeatView>;

// --- Chapter 03: what the maps decide (Task 7.5) ------------------------------------------------

/** A row of dots for drawDotRows: a dot at `value`, and for the neutral maps the 90% band. */
export interface CountDotRow extends DotRow {
  key: CountKey;
}

/** A spec for drawDotRows: the domain on whole steps around the values, ticks with their text, and the rows. */
function dots(values: number[], step: number, tickText: (value: number) => string, rows: CountDotRow[], base?: { value: number; text: string }) {
  const { domain, ticks } = rowDomain(values, step);
  return { domain, ticks: ticks.map((value) => ({ value, text: tickText(value) })), rows, ...(base ? { base } : {}) };
}

/** The answer under the question in the masthead: two findings on the 2016 and 2020 votes, and the vote basis.
 *  The drawing effect by vote share and the competitive districts are further down. */
export function keyFindings(results: Results): string[] {
  const n = results.national;
  const m = n.majority;
  const list = effectList(results);
  return [
    // without the neutral-map threshold next to it
    `With the maps the states drew for 2026, Democrats need ${neededShare(m.enacted.share)} of the two-party vote for a House `
      + 'majority.',
    // the seats the enacted maps move each way, added up over the states, and the net
    `The enacted maps move ${seats(list.seatsR)} ${plural(list.seatsR, 'seat', 'seats')} toward Republicans and `
      + `${seats(list.seatsD)} toward Democrats. Net effect: ${effect(list.net)}.`,
    // the vote basis: the share of the votes of both years added together
    `All numbers use the 2016 and 2020 presidential votes together, ${sliderShare(m.base_share)} Democratic. `
      + 'They are not a prediction for November 3.',
  ];
}

/** The cards of chapter 03: the texts of the extensions (Phase 6) with large figures and rows of dots. */
export function decideView(results: Results) {
  const n = results.national;
  const c = n.competitive;
  const senate = senateView(results);
  const redraws = redrawView(results);
  const offset = houseOf(results).dSingle; // seats of the House of 435, as in chapter 01
  return {
    senate,
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
        { value: `${seats(n.redraw.seats_2024 + offset)} to ${seats(n.enacted + offset)}`, label: 'Democratic seats, 2024 maps to 2026 maps' },
        { value: effect(n.redraw.change), label: effectWords(n.redraw.change) },
      ],
      sentence: redraws.sentence,
      rows: redraws.rows,
    },
    control: controlTables(results),
    legal: legalView(results),
  };
}
export type DecideView = ReturnType<typeof decideView>;
