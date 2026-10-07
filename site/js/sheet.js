// The sheet beside the map (site design, chapter 1): without a chosen state the list
// "Drawing effect by state"; with a chosen state its numbers. Texts come from model.js.
import { drawSeatAxis, drawSorted, drawNetBar } from './charts.js';
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
  sheet.append('h2').attr('id', 'sheet-title').attr('tabindex', -1).text('Drawing effect by state');
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
  net.append('h3').text('All states together');
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
    cell.append('span').attr('class', 'lab').text(item.label);
    cell.append('span').attr('class', 'val').text(item.value);
    cell.append('span').attr('class', 'sub').text(item.sub);
  }
}

function sourceLine(parent, source) {
  const p = parent.append('p').attr('class', 'note').text('Map file: ');
  p.append('a').attr('href', source.url).attr('rel', 'noopener').text(source.label);
}

/**
 * One state, in the order of the site design (chapter 1).
 * @param {object} sheet stateSheet(results, postal)
 */
export function renderState(el, sheet, colors, onBack) {
  const root = d3.select(el).html('');
  root.append('button').attr('type', 'button').attr('class', 'back').text('All states').on('click', onBack);
  const head = root.append('div').attr('class', 'stack');
  head.append('h2').attr('id', 'sheet-title').attr('tabindex', -1).text(sheet.name);
  const meta = head.append('p').attr('class', 'meta');
  meta.append('span').text(sheet.mapName);
  meta.append('span').attr('class', 'pill').text(sheet.status);
  meta.append('span').text(sheet.legal);
  meta.append('span').text(sheet.seatCount);

  trio(root, sheet.trio);
  root.append('p').attr('class', 'note').text(sheet.seatsOf);
  drawSeatAxis(root.append('div').node(), sheet.axis, [sheet.axis.lo, sheet.axis.hi], sheet.axisLabel);
  definitionList(root, sheet.effects);
  root.append('p').attr('class', 'note').text(sheet.position);

  if (sheet.blocked) {
    const b = root.append('div').attr('class', 'stack');
    b.append('h3').text('Blocked map');
    const bm = b.append('p').attr('class', 'meta');
    bm.append('span').text(sheet.blocked.name);
    bm.append('span').attr('class', 'pill').text(sheet.blocked.status);
    b.append('p').attr('class', 'note').text(`${sheet.blocked.seatsText} ${sheet.blocked.position}`);
    sourceLine(b, sheet.blocked.source);
  }

  const sorted = root.append('div').attr('class', 'stack');
  sorted.append('h3').text('Districts, sorted');
  drawSorted(sorted.append('div').node(), sheet.sorted, colors, sheet.sortedLabel);
  sorted.append('p').attr('class', 'note').text(sheet.sortedCaption);

  const measures = root.append('div').attr('class', 'stack');
  measures.append('h3').text('Other measures');
  definitionList(measures, sheet.measures.map((m) => ({ label: m.label, value: m.value, note: m.context })));

  if (sheet.notes.length > 0) {
    const notes = root.append('div').attr('class', 'stack');
    notes.append('h3').text('Notes');
    const ul = notes.append('ul').attr('class', 'notes');
    for (const text of sheet.notes) ul.append('li').text(text);
  }
  sourceLine(root, sheet.source);
}
