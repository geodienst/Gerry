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
 * "Drawing effect by state" in two levels (owner, October 13, 2026): the largest effects toward Republicans at the top
 * and toward Democrats at the bottom, between them one fold with the smaller effects and, inside it, the fold of the
 * zero states; then the net bar.
 * @param {Element} el the sheet
 * @param {object} list effectList(results)
 * @param {object} colors makeColors(...)
 * @param {{moreOpen: boolean, zerosOpen: boolean}} ui remembers which folds are open
 */
export function renderList(el, list, colors, onSelect, ui) {
  const sheet = d3.select(el).html('');
  sheet.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text('Drawing effect by state');
  sheet.append('p').attr('class', 'note')
    .text('Seats each enacted map moves toward one party, compared with the median of its neutral maps. Select a state for its numbers.');
  const rows = (parent, items) => {
    if (items.length === 0) return;
    const box = parent.append('div').attr('class', 'list');
    for (const row of items) stateRow(box, row, colors, onSelect);
  };
  rows(sheet, list.big.toR);
  if (list.small.toR.length + list.zero.length + list.small.toD.length > 0) {
    const more = sheet.append('details').attr('class', 'more').property('open', ui.moreOpen)
      .on('toggle', (event) => { if (event.target === more.node()) ui.moreOpen = event.target.open; });
    more.append('summary').text(list.moreLabel);
    rows(more, list.small.toR);
    if (list.zero.length > 0) {
      const zeros = more.append('details').attr('class', 'zeros').property('open', ui.zerosOpen)
        .on('toggle', (event) => { ui.zerosOpen = event.target.open; });
      zeros.append('summary').text(list.zeroLabel);
      rows(zeros, list.zero);
    }
    rows(more, list.small.toD);
  }
  rows(sheet, list.big.toD);
  const net = sheet.append('div').attr('class', 'net');
  net.append('h4').text('All states together');
  drawNetBar(net.append('div').node(), list, colors);
  net.append('p').attr('class', 'note').text(list.summary);
}

/**
 * "Drawing effects of 3 seats or more" above the map (redesign, chapter 4): a button per state and the
 * sentence for the rest. Drawn once, so a button keeps the focus; the returned function marks the chosen
 * state and colors the swatches.
 * @param {object} view largestEffects(results)
 * @returns {(colors: object, selected: string) => void}
 */
export function renderLargest(el, view, onSelect) {
  const root = d3.select(el).html('');
  root.append('span').attr('class', 'k').text(view.title);
  const buttons = view.chips.map((chip) => {
    const button = root.append('button').attr('type', 'button').attr('class', 'chip').attr('data-postal', chip.postal)
      .attr('aria-label', chip.aria).on('click', () => onSelect(chip.postal));
    button.append('i').attr('class', 'sw').attr('aria-hidden', 'true');
    button.append('span').text(chip.postal);
    button.append('b').text(chip.label);
    return { button, chip };
  });
  return (colors, selected) => {
    for (const { button, chip } of buttons) {
      button.attr('aria-current', chip.postal === selected ? 'true' : null);
      button.select('.sw').style('background', colors.effect(chip.drawing));
    }
  };
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

  const sorted = root.append('div').attr('class', 'stack');
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

/** The short record of a state with one seat (redesign, chapter 4). */
export function renderSingle(el, view, onBack) {
  const root = d3.select(el).html('');
  root.append('button').attr('type', 'button').attr('class', 'back').text('All states').on('click', onBack);
  root.append('span').attr('class', 'k').text(view.kicker);
  root.append('h3').attr('id', 'sheet-title').attr('tabindex', -1).text(view.name);
  headline(root, view.headline, 'var(--blank)', view.lines);
}
