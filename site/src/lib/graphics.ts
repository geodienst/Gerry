// The images to download: the national comparison at a stop of the vote slider in chapter 01, the drawing effect by
// state, and for the Share panel of chapter 02 one state or the map of all states. This module gives their texts,
// numbers and captions; ui/graphics.ts draws them on a canvas.
import { SITE_URL } from './hash.ts';
import { count, effectWords, longDate, seats, sliderShare } from './format.ts';
import { effectList, houseOf, planCount } from './model.ts';
import { recordView, singleSeatView } from './chapters.ts';
import { plural } from './text.ts';
import type { EffectRow } from './model.ts';
import type { OutcomesView } from './chapters.ts';
import type { Postal, Results } from '../types.ts';

/** Who made the images, and the license they may be reused under. */
export const CREDIT = 'Govert Schoof, Geodienst, University of Groningen';
export const LICENSE = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
/** The site's address without the scheme, as printed in the images: "somevotes.org". */
export const SITE_NAME = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** The light tokens of styles/tokens.css, which the images use whatever the color scheme on screen.
 *  site/test/graphics.test.ts keeps them equal to the tokens. */
export const LIGHT = {
  sheet: '#fbfcfa', fg: '#18201c', muted: '#56615b', rule: '#d3d9d4', ink: '#1d5c48',
  'party-d': '#2a78d6', 'party-r': '#e34948', 'neutral-d': '#01665e', 'neutral-r': '#8c510a', mid: '#ecebe7', blank: '#c9ccd1',
  'party-tie': '#904ec9', 'neutral-tie': '#a87800', water: '#e5eae6',
} as const;

type Point = OutcomesView['points'][number];

/** The lines at the foot of both images: the votes, the date of the maps and the sources, the credit, the address. */
export interface GraphicFoot {
  votes: string;
  maps: string;
  credit: string;
  site: string;
}

function foot(results: Results, point: Pick<Point, 'base' | 'share'>): GraphicFoot {
  return {
    votes: point.base
      ? `Votes: the 2016 and 2020 presidential results added together, ${sliderShare(point.share)} Democratic.`
      : `Votes: the 2016 and 2020 presidential results, every district shifted so that Democrats have ${sliderShare(point.share)} of the two-party vote.`,
    maps: `Maps used on November 3, 2026, legal status as of ${longDate(results.meta.status_checked)}. `
      + 'Neutral maps and votes: ALARM Project. District maps: U.S. Census Bureau.',
    credit: `${CREDIT}. ${LICENSE.name}.`,
    site: SITE_NAME,
  };
}

/** The credit and license at the end of both captions. */
const captionCredit = `Graphic: ${CREDIT}, ${SITE_NAME} (${LICENSE.name}).`;

/** The national comparison: the three counts in the House of 435 at one stop of the slider. */
export function nationalGraphic(results: Results, view: OutcomesView, index: number) {
  const point = view.points[index];
  const house = houseOf(results);
  const majority = results.national.majority.seats_needed + house.dSingle;
  const seatsOf = (key: string) => point.rows.find((r) => r.key === key)?.seats ?? 0;
  const at = point.base ? 'With the 2016 and 2020 presidential votes'
    : `With Democrats at ${sliderShare(point.share)} of the two-party vote`;
  return {
    title: 'The same votes. Three different outcomes.',
    lead: point.lead,
    total: house.total,
    majority,
    majorityLabel: `${seats(majority)} for a majority`,
    // simpler than chapter 01: the neutral row without its median and band, which the site explains
    rows: point.rows.map((r) => (r.key === 'neutral'
      ? { key: r.key, label: 'Neutral maps', seats: r.seats, value: r.value, desc: '' }
      : { key: r.key, label: r.label, seats: r.seats, value: r.value, desc: r.desc })),
    sides: { r: 'Republican majority', d: 'Democratic majority' },
    // the difference between the first and second row, and between the second and third
    steps: point.steps.map((s) => s.value),
    foot: foot(results, point),
    caption: `${at}, the maps used on November 3, 2026 give Democrats ${seats(seatsOf('enacted'))} of the `
      + `${seats(house.total)} House seats. Neutral maps, ${count(planCount(results))} per state drawn by a computer, `
      + `give ${seats(seatsOf('neutral'))}; seats in proportion to each state's vote give `
      + `${seats(seatsOf('proportional'))}. ${captionCredit}`,
    file: `somevotes-national-${point.label.replace('%', '').replace('.', '-')}.png`,
    alt: `${point.lead} For each count, one block per seat between the count and the ${seats(majority)} seats `
      + 'needed for a majority.',
  };
}
export type NationalGraphic = ReturnType<typeof nationalGraphic>;

/** The drawing effect by state on the 2016 and 2020 votes, with the net of all states. */
export function statesGraphic(results: Results, view: OutcomesView) {
  const list = effectList(results);
  // both columns start with the largest effect
  const rows = (states: EffectRow[]) => [...states].sort((a, b) => Math.abs(b.drawing) - Math.abs(a.drawing) || a.name.localeCompare(b.name, 'en'))
    .map((r) => ({ name: r.name, drawing: r.drawing, label: r.label }));
  // a side without states is left out, and a net of 0 needs no clause
  const side = (n: number, moved: number, party: string) => (n === 0 ? ''
    : `${seats(moved)} House ${plural(moved, 'seat', 'seats')} toward ${party} in ${count(n)} ${plural(n, 'state', 'states')}`);
  const sides = [side(list.toR.length, list.seatsR, 'Republicans'), side(list.toD.length, list.seatsD, 'Democrats')].filter(Boolean);
  return {
    title: 'Drawing effect by state',
    // simpler than the site, as the national image: neutral maps without their median, which the site explains
    note: 'Seats each enacted map moves toward one party, compared with neutral maps.',
    net: list.bar.net,
    netValue: list.net,
    summary: list.summary,
    headR: list.bar.left,
    headD: list.bar.right,
    toR: rows(list.toR),
    toD: rows(list.toD),
    zeros: `${count(list.zero.length)} ${plural(list.zero.length, 'state matches its', 'states match their')} neutral maps: `
      + `${list.zero.map((r) => r.name).join(', ')}.`,
    foot: foot(results, view.points[view.baseIndex]),
    caption: `Compared with ${count(planCount(results))} neutral maps per state, drawn by a computer, the maps used on `
      + `November 3, 2026 move ${sides.length ? sides.join(' and ') : 'no House seat toward either party'}`
      + `${list.net === 0 ? '' : `: net ${effectWords(list.net)}`}. Votes: the 2016 and 2020 presidential results. `
      + captionCredit,
    file: 'somevotes-drawing-effect-by-state.png',
    alt: `${list.summary} One bar per state that moves seats.`,
  };
}
export type StatesGraphic = ReturnType<typeof statesGraphic>;

/** "New Mexico" -> "new-mexico", for file names. */
export const slug = (name: string): string => name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

/**
 * One state on the 2016 and 2020 votes, as its record beside the map: the drawing effect, the three counts and its
 * districts by Democratic share. A state with one seat gets its name and the two lines of its short record.
 */
export function stateGraphic(results: Results, view: OutcomesView, postal: Postal) {
  const base = foot(results, view.points[view.baseIndex]);
  const single = results.national.single_seat.find((s) => s.postal === postal);
  if (single) {
    const record = singleSeatView(results, postal);
    return {
      postal, single: true, title: record.name, meta: record.headline, headline: null, rows: [], seatsOf: '', lines: record.lines,
      foot: base,
      caption: `${record.name}. ${record.lines.join(' ')} ${captionCredit}`,
      file: `somevotes-${slug(record.name)}.png`,
      alt: `${record.name}. ${record.lines.join(' ')}`,
    };
  }
  const record = recordView(results, postal);
  const s = results.states[postal];
  const [proportional, neutral, enacted] = record.trio;
  return {
    postal,
    single: false,
    title: record.name,
    meta: `${record.seatCount}. ${record.mapName}. ${record.status}.`,
    headline: record.headline,
    // simpler than the record, as the national image: neutral maps without their median, which the site explains
    rows: [
      { label: proportional.label, value: proportional.value },
      { label: 'Neutral maps', value: neutral.value },
      { label: enacted.label, value: enacted.value },
    ],
    seatsOf: record.seatsOf,
    lines: [],
    foot: base,
    caption: `With the 2016 and 2020 presidential votes, the map ${s.name} uses on November 3, 2026 gives Democrats `
      + `${seats(s.enacted)} of its ${seats(s.seats)} House seats. Neutral maps, ${count(planCount(results))} drawn by a `
      + `computer, give ${seats(s.neutral.median)}; seats in proportion to the state's vote give ${seats(s.proportional)}. `
      + captionCredit,
    file: `somevotes-${slug(s.name)}.png`,
    alt: `${s.name}: ${record.headline.value}, ${record.headline.sentence} Democratic seats: vote-proportional `
      + `${proportional.value}, neutral maps ${neutral.value}, enacted maps ${enacted.value}. Map of the districts by Democratic share.`,
  };
}
export type StateGraphic = ReturnType<typeof stateGraphic>;

/** All states on one map, each in the color of its drawing effect, with the net of all states. */
export function statesMapGraphic(results: Results, view: OutcomesView) {
  const list = effectList(results);
  const states = statesGraphic(results, view);
  return {
    title: states.title,
    note: states.note,
    net: states.net,
    netValue: states.netValue,
    summary: states.summary,
    foot: states.foot,
    caption: states.caption,
    file: 'somevotes-drawing-effect-map.png',
    alt: `${list.summary} Map of the states in the color of their drawing effect.`,
  };
}
export type StatesMapGraphic = ReturnType<typeof statesMapGraphic>;
