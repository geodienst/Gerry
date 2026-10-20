// The two images to download: the national comparison at the stop of the vote slider in chapter 01, and the drawing
// effect by state. This module gives their texts, numbers and captions; ui/graphics.ts draws them on a canvas.
import { SITE_URL } from './hash.ts';
import { count, effectWords, longDate, seats, sliderShare } from './format.ts';
import { effectList, houseOf, planCount } from './model.ts';
import { plural } from './text.ts';
import type { EffectRow } from './model.ts';
import type { OutcomesView } from './chapters.ts';
import type { Results } from '../types.ts';

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
    rows: point.rows.map((r) => ({ key: r.key, label: r.label, seats: r.seats, value: r.value, desc: r.desc })),
    band: { lo: point.band.lo, hi: point.band.hi },
    // the difference between the first and second row, and between the second and third
    steps: point.steps.map((s) => s.value),
    foot: foot(results, point),
    caption: `${at}, the maps used on November 3, 2026 give Democrats ${seats(seatsOf('enacted'))} of the `
      + `${seats(house.total)} House seats. The median of ${count(planCount(results))} neutral maps per state, drawn by a `
      + `computer, gives ${seats(seatsOf('neutral'))}; seats in proportion to each state's vote give `
      + `${seats(seatsOf('proportional'))}. ${captionCredit}`,
    file: `somevotes-national-${point.label.replace('%', '').replace('.', '-')}.png`,
    alt: `${point.lead} Bars of the ${seats(house.total)} House seats for the three ways of counting.`,
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
    note: 'Seats each enacted map moves toward one party, compared with the median of its neutral maps.',
    net: list.bar.net,
    netValue: list.net,
    summary: list.summary,
    headR: list.bar.left,
    headD: list.bar.right,
    toR: rows(list.toR),
    toD: rows(list.toD),
    zeros: `${list.zeroLabel}: ${list.zero.map((r) => r.name).join(', ')}.`,
    foot: foot(results, view.points[view.baseIndex]),
    caption: `Compared with the median of ${count(planCount(results))} neutral maps per state, the maps used on `
      + `November 3, 2026 move ${sides.length ? sides.join(' and ') : 'no House seat toward either party'}`
      + `${list.net === 0 ? '' : `: net ${effectWords(list.net)}`}. Votes: the 2016 and 2020 presidential results. `
      + captionCredit,
    file: 'somevotes-drawing-effect-by-state.png',
    alt: `${list.summary} One bar per state that moves seats.`,
  };
}
export type StatesGraphic = ReturnType<typeof statesGraphic>;
