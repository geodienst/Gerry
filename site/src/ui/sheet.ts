// The record beside the map (redesign, chapter 4): without a chosen state the column of the view on screen (districts
// by share, the list "Drawing effect by state" or the close districts), with a chosen state its record, for a state
// with one seat a short record. Texts come from lib/model.ts and lib/chapters.ts.
import { select, type Selection } from 'd3';
import { drawSorted, drawNetBar, drawDotRows, drawShareBins } from './charts.ts';
import { EFFECT_MAX } from '../lib/colors.ts';
import type { Postal, Source } from '../types.ts';
import type { RecordView, SingleSeatView } from '../lib/chapters.ts';
import type { Colors } from '../lib/colors.ts';
import type { CloseDistricts, DistrictShares, EffectList, EffectRow } from '../lib/model.ts';

// d3 selections are invariant in their element type, so the helpers take any HTML element through E
type Block<E extends HTMLElement = HTMLElement> = Selection<E, unknown, null, undefined>;
type OnSelect = (postal: Postal) => void;
interface Item { label: string; value: string; note?: string | null }

/** Empty `el` and return it as a d3 selection to append to. */
const clear = (el: HTMLElement): Block => select(el).html('');

/** The heading every column has; main.ts moves the focus to it. */
const title = <E extends HTMLElement>(parent: Block<E>, text: string) => parent.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text(text);

function stateRow<E extends HTMLElement>(parent: Block<E>, row: EffectRow, colors: Colors, onSelect: OnSelect) {
  const button = parent.append('button').attr('type', 'button').attr('class', 'row').attr('data-postal', row.postal)
    .on('click', () => onSelect(row.postal));
  button.append('span').text(row.name);
  const bar = button.append('svg').attr('viewBox', '0 0 120 12').attr('preserveAspectRatio', 'none').attr('aria-hidden', 'true');
  bar.append('line').attr('x1', 60).attr('x2', 60).attr('y1', 0).attr('y2', 12).attr('stroke', 'var(--rule)');
  const width = (Math.min(Math.abs(row.drawing), EFFECT_MAX) / EFFECT_MAX) * 58;
  bar.append('rect').attr('x', row.drawing < 0 ? 60 - width : 60).attr('y', 2).attr('width', width).attr('height', 8)
    .attr('fill', colors.effect(row.drawing));
  button.append('span').attr('class', 'v').text(row.label);
}

/**
 * "Drawing effect by state" with the zero states folded away and the net bar.
 * @param el the sheet
 * @param ui remembers whether the zero states are unfolded
 */
export function renderList(el: HTMLElement, list: EffectList, colors: Colors, onSelect: OnSelect, ui: { zerosOpen: boolean }) {
  const sheet = clear(el);
  netBlock(sheet, list, colors);
  title(sheet, 'Drawing effect by state');
  sheet.append('p').attr('class', 'note')
    .text('Seats each enacted map moves toward one party, compared with the median of its neutral maps. Select a state for its numbers.');
  const toR = sheet.append('div').attr('class', 'list');
  for (const row of list.toR) stateRow(toR, row, colors, onSelect);
  if (list.zero.length > 0) {
    const zeros = sheet.append('details').attr('class', 'zeros').property('open', ui.zerosOpen)
      .on('toggle', (event: Event) => { ui.zerosOpen = (event.target as HTMLDetailsElement).open; });
    zeros.append('summary').text(list.zeroLabel);
    const zeroList = zeros.append('div').attr('class', 'list');
    for (const row of list.zero) stateRow(zeroList, row, colors, onSelect);
  }
  const toD = sheet.append('div').attr('class', 'list');
  for (const row of list.toD) stateRow(toD, row, colors, onSelect);
}

/** "All states together" at the top of a column without a state: the net of the seats the enacted maps move each way,
 *  large as in the headline of a state record, then the bar of both sides and the sentence with the sums. */
function netBlock<E extends HTMLElement>(sheet: Block<E>, list: EffectList, colors: Colors) {
  const net = sheet.append('div').attr('class', 'net');
  net.append('h3').text('All states together');
  const big = net.append('p').attr('class', 'big');
  big.append('i').attr('aria-hidden', 'true').style('background', colors.effect(list.net));
  big.append('span').text(list.bar.net);
  drawNetBar(net.append('div').node()!, list, colors);
  net.append('p').attr('class', 'note').text(list.summary);
}

/** Without a state in the view "Districts: Democratic share": "All states together", then the districts of the 2026
 *  maps by share. */
export function renderDistricts(el: HTMLElement, view: DistrictShares, list: EffectList, colors: Colors) {
  const sheet = clear(el);
  netBlock(sheet, list, colors);
  title(sheet, view.title);
  sheet.append('p').attr('class', 'count').text(view.count);
  drawShareBins(sheet.append('div').attr('class', 'bins').node()!, view.bins, colors, view.label);
  sheet.append('p').attr('class', 'note').text(view.hint);
}

/** Without a state in the view "Districts: close races": "All states together", then the close districts, closest
 *  first; a click chooses the state. */
export function renderClose(el: HTMLElement, view: CloseDistricts, effects: EffectList, colors: Colors, onSelect: OnSelect) {
  const sheet = clear(el);
  netBlock(sheet, effects, colors);
  title(sheet, view.title);
  sheet.append('p').attr('class', 'count').text(view.count);
  const list = sheet.append('div').attr('class', 'list dlist');
  for (const row of view.rows) {
    const button = list.append('button').attr('type', 'button').attr('class', 'row drow').attr('data-postal', row.postal)
      .on('click', () => onSelect(row.postal));
    button.append('i').attr('class', 'sw').attr('aria-hidden', 'true').style('background', colors.party(row.dem));
    button.append('span').text(row.label);
    button.append('span').attr('class', 'v').text(row.text);
  }
  sheet.append('p').attr('class', 'note').text(view.hint);
}

/** Labels and values; `stacked` puts each note on a line of its own, without its parentheses (full screen). */
function definitionList<E extends HTMLElement>(parent: Block<E>, items: Item[], stacked = false) {
  const dl = parent.append('dl').attr('class', stacked ? 'kv stacked' : 'kv');
  for (const item of items) {
    dl.append('dt').text(item.label);
    const dd = dl.append('dd');
    dd.append('b').text(item.value);
    if (item.note) dd.append('span').attr('class', 'note').text(stacked ? item.note.replace(/^\((.*)\)$/, '$1') : ` ${item.note}`);
  }
  return dl;
}

function trio<E extends HTMLElement>(parent: Block<E>, items: RecordView['trio']) {
  const div = parent.append('div').attr('class', 'trio');
  for (const item of items) {
    const cell = div.append('div');
    // Each word in its own nowrap span, so "Vote-proportional" never breaks at its hyphen; lines break at the spaces.
    const lab = cell.append('span').attr('class', 'lab');
    item.label.split(' ').forEach((word, i) => {
      if (i > 0) lab.append('span').text(' ');
      lab.append('span').attr('class', 'nowrap').text(word);
    });
    cell.append('span').attr('class', 'val').text(item.value);
    cell.append('span').attr('class', 'sub').text(item.sub);
  }
}

function sourceLine<E extends HTMLElement>(parent: Block<E>, source: Source) {
  const p = parent.append('p').attr('class', 'note').text('Map file: ');
  p.append('a').attr('href', source.url).attr('rel', 'noopener').text(source.label);
}

/** The headline: a large value with a swatch, and one or two lines of text. */
function headline<E extends HTMLElement>(parent: Block<E>, value: string, swatch: string, lines: string[]) {
  const head = parent.append('div').attr('class', 'headline');
  const big = head.append('span').attr('class', 'big');
  big.append('i').attr('aria-hidden', 'true').style('background', swatch);
  big.append('span').text(value);
  const text = head.append('div');
  for (const line of lines) text.append('p').text(line);
}

/** "Back" with an arrow, to the column without a state of the view on screen. */
function backButton<E extends HTMLElement>(root: Block<E>, onBack: () => void) {
  const button = root.append('button').attr('type', 'button').attr('class', 'back').on('click', onBack);
  button.append('svg').attr('viewBox', '0 0 16 16').attr('aria-hidden', 'true').append('path').attr('d', 'M13 8H3M7 4 3 8l4 4');
  button.append('span').text('Back');
  return button;
}

/** Back and the kicker above the name, the same at the top of every record. */
function recordTop<E extends HTMLElement>(root: Block<E>, kicker: string, onBack: () => void) {
  backButton(root, onBack);
  root.append('span').attr('class', 'k').text(kicker);
}

/** The headline, the three numbers and the seat strip, the same in both forms of a record. */
function recordNumbers<E extends HTMLElement>(root: Block<E>, record: RecordView, colors: Colors) {
  headline(root, record.headline.value, colors.effect(record.headline.drawing), [record.headline.sentence]);
  trio(root, record.trio);
  root.append('p').attr('class', 'note').text(record.seatsOf);
  drawDotRows(root.append('div').node()!, record.strip, record.strip.label);
}

const measureItems = (record: RecordView): Item[] => record.measures.map((m) => ({ label: m.label, value: m.value, note: m.context }));

function notesList<E extends HTMLElement>(parent: Block<E>, notes: string[]) {
  const ul = parent.append('ul').attr('class', 'notes');
  for (const text of notes) ul.append('li').text(text);
}

/**
 * One state, in the order of the redesign (chapter 4): everything the sheet of Phase 6 showed, with the
 * headline, and the seat strip in place of the seat axis.
 */
export function renderState(el: HTMLElement, record: RecordView, colors: Colors, onBack: () => void) {
  const root = clear(el);
  recordTop(root, record.kicker, onBack);
  title(root, record.name);
  const meta = root.append('p').attr('class', 'meta');
  meta.append('span').text(record.mapName);
  meta.append('span').attr('class', 'pill').text(record.status);
  meta.append('span').text(record.legal);
  meta.append('span').text(record.seatCount);
  for (const line of record.extras.head) root.append('p').attr('class', 'meta').text(line);

  recordNumbers(root, record, colors);
  definitionList(root, record.effects);
  root.append('p').attr('class', 'note').text(record.position);

  if (record.blocked) {
    const b = root.append('div').attr('class', 'stack');
    b.append('h4').text('Blocked map');
    const bm = b.append('p').attr('class', 'meta');
    bm.append('span').text(record.blocked.name);
    bm.append('span').attr('class', 'pill').text(record.blocked.status);
    b.append('p').attr('class', 'note').text(`${record.blocked.seatsText} ${record.blocked.position}`);
    sourceLine(b, record.blocked.source);
  }

  const sorted = root.append('div').attr('class', 'stack sorted');
  sorted.append('h4').text('Districts, sorted');
  drawSorted(sorted.append('div').node()!, record.sorted, colors, record.sortedLabel);
  sorted.append('p').attr('class', 'note').text(record.sortedCaption);

  if (record.extras.body.length > 0) {
    const more = root.append('div').attr('class', 'stack extras');
    for (const line of record.extras.body) more.append('p').attr('class', 'note').text(line);
  }

  const measures = root.append('div').attr('class', 'stack');
  measures.append('h4').text('Other measures');
  definitionList(measures, measureItems(record));

  if (record.notes.length > 0) {
    const notes = root.append('div').attr('class', 'stack');
    notes.append('h4').text('Notes');
    notesList(notes, record.notes);
  }
  sourceLine(root, record.source);
}

/**
 * One state in full screen: the record on the right in its own order, ending
 * with the map, its status and who adopted it; under the map and the record a strip with the sorted districts, their
 * notes, and the other measures and the notes folded.
 * @param el the sheet on the right
 * @param moreEl the strip under the map
 */
export function renderStateFull(el: HTMLElement, moreEl: HTMLElement, record: RecordView, colors: Colors, onBack: () => void) {
  const root = clear(el);
  recordTop(root, record.kicker, onBack);
  const name = root.append('div').attr('class', 'fullname');
  title(name, record.name);
  name.append('span').attr('class', 'seats').text(record.seatCount);
  recordNumbers(root, record, colors);
  // each effect with its note on a line of its own
  definitionList(root, record.effects, true);
  root.append('p').attr('class', 'note').text(record.position);
  if (record.blocked) {
    const b = root.append('div').attr('class', 'stack');
    b.append('h4').text('Blocked map');
    b.append('p').attr('class', 'meta').text(`${record.blocked.name} \u00b7 ${record.blocked.status}`);
    b.append('p').attr('class', 'note').text(`${record.blocked.seatsText} ${record.blocked.position}`);
    sourceLine(b, record.blocked.source);
  }
  const foot = root.append('div').attr('class', 'foot');
  foot.append('p').attr('class', 'meta').text([record.mapName, record.status, record.legal].join(' \u00b7 '));
  for (const line of record.extras.head) foot.append('p').attr('class', 'meta').text(line);

  const more = clear(moreEl);
  const chart = more.append('div').attr('class', 'fs-chart');
  chart.append('h4').text('Districts, sorted');
  // lower than in the record, so the strip under the full-screen map leaves the map its room
  drawSorted(chart.append('div').attr('class', 'card').node()!, record.sorted, colors, record.sortedLabel, 130);
  const text = more.append('div').attr('class', 'fs-text');
  text.append('p').attr('class', 'note').text(record.sortedCaption);
  for (const line of record.extras.body) text.append('p').attr('class', 'note').text(line);
  const folds = more.append('div').attr('class', 'fs-folds');
  const measures = folds.append('details').attr('class', 'fold');
  measures.append('summary').text('Other measures');
  definitionList(measures, measureItems(record));
  if (record.notes.length > 0) {
    const notes = folds.append('details').attr('class', 'fold');
    notes.append('summary').text('Notes');
    notesList(notes, record.notes);
  }
  sourceLine(folds, record.source);
}

/** The short record of a state with one seat (redesign, chapter 4). */
export function renderSingle(el: HTMLElement, view: SingleSeatView, onBack: () => void) {
  const root = clear(el);
  recordTop(root, view.kicker, onBack);
  title(root, view.name);
  headline(root, view.headline, 'var(--blank)', view.lines);
}
