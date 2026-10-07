// The key figures under the title and the national strip below the map (site design,
// update of October 7, 2026). Texts come from model.js; the blocks of the extensions
// (Tasks 6.10 to 6.14) from extensions.js.
import { drawSeatAxis, drawVoteAxis } from './charts.js';
import { nationalSeatDomain } from './axes.js';

const { d3 } = globalThis;
const NATIONAL_UNITS = 720; // the national axis may be wider than the one in the sheet

/** The line under the title: the four key figures and the links to the sections below. */
export function renderKeyline(el, view) {
  const line = d3.select(el).html('');
  line.append('span').attr('class', 'lab').text(view.keyline.lead);
  for (const item of view.keyline.items) {
    const span = line.append('span');
    span.append('span').attr('class', 'lab').text(item.label);
    span.append('b').text(item.value);
  }
  line.append('a').attr('href', '#national').attr('class', 'linkbtn').text('National picture');
  line.append('a').attr('href', '#method').attr('class', 'linkbtn').text('Method');
}

/** The three numbers, the national seat axis, the effects and the position. */
export function renderNational(el, view) {
  const root = d3.select(el);
  root.select('#national-note').text(view.note);
  const trio = root.select('#national-trio').html('');
  for (const item of view.trio) {
    const cell = trio.append('div');
    cell.append('span').attr('class', 'lab').text(item.label);
    cell.append('span').attr('class', 'val').text(item.value);
    cell.append('span').attr('class', 'sub').text(item.sub);
  }
  drawSeatAxis(root.select('#national-axis').node(), view.axis, nationalSeatDomain(view.axis, view.seatsTotal), view.axisLabel, NATIONAL_UNITS);
  root.select('#national-caption').text(view.caption);
  root.select('#national-effects').text(`${view.effects} ${view.position}`);
}

/** House majority: the vote axis, the sentence, and the notes (Task 6.10). */
export function renderMajority(el, view) {
  const root = d3.select(el);
  drawVoteAxis(root.select('#majority-axis').node(), view.axis, view.label);
  root.select('#majority-text').text(view.sentence);
  root.select('#majority-note').text([view.proportionalNote, view.rule].filter(Boolean).join(' '));
}

/** Redraws since 2024: the net change and the states with another seat count (Task 6.11). */
export function renderRedraws(el, view) {
  const root = d3.select(el);
  root.select('#redraw-text').text(view.sentence);
  const list = root.select('#redraw-list').html('');
  for (const row of view.rows) {
    const item = list.append('li');
    item.append('span').text(row.name);
    item.append('span').attr('class', 'v').text(row.text);
  }
}

/** The two tables by political control and by body (Task 6.13). */
export function renderControl(el, tables) {
  const root = d3.select(el);
  for (const [id, rows] of [['#by-control', tables.byControl], ['#by-body', tables.byBody]]) {
    const body = root.select(id).html('');
    for (const row of rows) {
      const tr = body.append('tr');
      tr.append('th').attr('scope', 'row').text(row.label);
      for (const value of [row.states, row.seats, row.drawing]) tr.append('td').attr('class', 'num').text(value);
    }
  }
  root.select('#control-note').text(tables.note);
}

/** The Senate block beside the House majority (Task 6.14). */
export function renderSenate(el, view) {
  const root = d3.select(el);
  root.select('#senate-text').text(view.sentence);
  root.select('#senate-note').text(view.note);
}
