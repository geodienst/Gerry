// The record beside the map (redesign, chapter 4): without a chosen state the list "Drawing effect by state", with a chosen state its record, for a state with one seat a short record. Texts come from model.js and chapters.js.
import { drawSorted, drawNetBar, drawDotRows } from './charts.js';
import { EFFECT_MAX } from './colors.js';

const { d3 } = globalThis;

function stateRow(parent, row, colors, onSelect) {
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
 * @param {Element} el the sheet
 * @param {object} list effectList(results)
 * @param {object} colors makeColors(...)
 * @param {{zerosOpen: boolean}} ui remembers whether the zero states are unfolded
 */
export function renderList(el, list, colors, onSelect, ui) {
  const sheet = d3.select(el).html('');
  sheet.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text('Drawing effect by state');
  sheet.append('p').attr('class', 'note')
    .text('Seats each enacted map moves toward one party, compared with the median of its neutral maps. Select a state for its numbers.');
  const toR = sheet.append('div').attr('class', 'list');
  for (const row of list.toR) stateRow(toR, row, colors, onSelect);
  if (list.zero.length > 0) {
    const zeros = sheet.append('details').attr('class', 'zeros').property('open', ui.zerosOpen)
      .on('toggle', (event) => { ui.zerosOpen = event.target.open; });
    zeros.append('summary').text(list.zeroLabel);
    const zeroList = zeros.append('div').attr('class', 'list');
    for (const row of list.zero) stateRow(zeroList, row, colors, onSelect);
  }
  const toD = sheet.append('div').attr('class', 'list');
  for (const row of list.toD) stateRow(toD, row, colors, onSelect);
  const net = sheet.append('div').attr('class', 'net');
  net.append('h4').text('All states together');
  drawNetBar(net.append('div').node(), list, colors);
  net.append('p').attr('class', 'note').text(list.summary);
}

function definitionList(parent, items) {
  const dl = parent.append('dl').attr('class', 'kv');
  for (const item of items) {
    dl.append('dt').text(item.label);
    const dd = dl.append('dd');
    dd.append('b').text(item.value);
    if (item.note) dd.append('span').attr('class', 'note').text(` ${item.note}`);
  }
  return dl;
}

function trio(parent, items) {
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

function sourceLine(parent, source) {
  const p = parent.append('p').attr('class', 'note').text('Map file: ');
  p.append('a').attr('href', source.url).attr('rel', 'noopener').text(source.label);
}

/** The headline: a large value with a swatch, and one or two lines of text. */
function headline(parent, value, swatch, lines) {
  const head = parent.append('div').attr('class', 'headline');
  const big = head.append('span').attr('class', 'big');
  big.append('i').attr('aria-hidden', 'true').style('background', swatch);
  big.append('span').text(value);
  const text = head.append('div');
  for (const line of lines) text.append('p').text(line);
}

/**
 * One state, in the order of the redesign (chapter 4): everything the sheet of Phase 6 showed, with the
 * headline, and the seat strip in place of the seat axis.
 * @param {object} record recordView(results, postal)
 */
export function renderState(el, record, colors, onBack) {
  const root = d3.select(el).html('');
  root.append('button').attr('type', 'button').attr('class', 'back').text('All states').on('click', onBack);
  root.append('span').attr('class', 'k').text(record.kicker);
  root.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text(record.name);
  const meta = root.append('p').attr('class', 'meta');
  meta.append('span').text(record.mapName);
  meta.append('span').attr('class', 'pill').text(record.status);
  meta.append('span').text(record.legal);
  meta.append('span').text(record.seatCount);
  for (const line of record.extras.head) root.append('p').attr('class', 'meta').text(line);

  headline(root, record.headline.value, colors.effect(record.headline.drawing), [record.headline.sentence]);
  trio(root, record.trio);
  root.append('p').attr('class', 'note').text(record.seatsOf);
  drawDotRows(root.append('div').node(), record.strip, record.strip.label);
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
  drawSorted(sorted.append('div').node(), record.sorted, colors, record.sortedLabel);
  sorted.append('p').attr('class', 'note').text(record.sortedCaption);

  if (record.extras.body.length > 0) {
    const more = root.append('div').attr('class', 'stack extras');
    for (const line of record.extras.body) more.append('p').attr('class', 'note').text(line);
  }

  const measures = root.append('div').attr('class', 'stack');
  measures.append('h4').text('Other measures');
  definitionList(measures, record.measures.map((m) => ({ label: m.label, value: m.value, note: m.context })));

  if (record.notes.length > 0) {
    const notes = root.append('div').attr('class', 'stack');
    notes.append('h4').text('Notes');
    const ul = notes.append('ul').attr('class', 'notes');
    for (const text of record.notes) ul.append('li').text(text);
  }
  sourceLine(root, record.source);
}

/**
 * One state in full screen, after the owner's mockup (October 14, 2026): the record on the right in its own order, ending
 * with the map, its status and who adopted it; under the map and the record a strip with the sorted districts, their
 * notes, and the other measures and the notes folded.
 * @param {Element} el the sheet on the right
 * @param {Element} moreEl the strip under the map
 */
export function renderStateFull(el, moreEl, record, colors, onBack) {
  const root = d3.select(el).html('');
  root.append('button').attr('type', 'button').attr('class', 'back').text('All states').on('click', onBack);
  root.append('span').attr('class', 'k').text(record.kicker);
  const name = root.append('div').attr('class', 'fullname');
  name.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text(record.name);
  name.append('span').attr('class', 'seats').text(record.seatCount);
  headline(root, record.headline.value, colors.effect(record.headline.drawing), [record.headline.sentence]);
  trio(root, record.trio);
  root.append('p').attr('class', 'note').text(record.seatsOf);
  drawDotRows(root.append('div').node(), record.strip, record.strip.label);
  // each effect with its note on a line of its own, as in the mockup
  const dl = root.append('dl').attr('class', 'kv stacked');
  for (const item of record.effects) {
    dl.append('dt').text(item.label);
    const dd = dl.append('dd');
    dd.append('b').text(item.value);
    if (item.note) dd.append('span').attr('class', 'note').text(item.note.replace(/^\((.*)\)$/, '$1'));
  }
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

  const more = d3.select(moreEl).html('');
  const chart = more.append('div').attr('class', 'fs-chart');
  chart.append('h4').text('Districts, sorted');
  drawSorted(chart.append('div').attr('class', 'card').node(), record.sorted, colors, record.sortedLabel);
  const text = more.append('div').attr('class', 'fs-text');
  text.append('p').attr('class', 'note').text(record.sortedCaption);
  for (const line of record.extras.body) text.append('p').attr('class', 'note').text(line);
  const folds = more.append('div').attr('class', 'fs-folds');
  const measures = folds.append('details').attr('class', 'fold');
  measures.append('summary').text('Other measures');
  definitionList(measures, record.measures.map((m) => ({ label: m.label, value: m.value, note: m.context })));
  if (record.notes.length > 0) {
    const notes = folds.append('details').attr('class', 'fold');
    notes.append('summary').text('Notes');
    const ul = notes.append('ul').attr('class', 'notes');
    for (const line of record.notes) ul.append('li').text(line);
  }
  sourceLine(folds, record.source);
}

/** The short record of a state with one seat (redesign, chapter 4). */
export function renderSingle(el, view, onBack) {
  const root = d3.select(el).html('');
  root.append('button').attr('type', 'button').attr('class', 'back').text('All states').on('click', onBack);
  root.append('span').attr('class', 'k').text(view.kicker);
  root.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text(view.name);
  headline(root, view.headline, 'var(--blank)', view.lines);
}
