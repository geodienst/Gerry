// The key figures under the title and the national strip below the map (site design,
// update of October 7, 2026). Texts come from model.js; the blocks of the extensions
// (Tasks 6.10 to 6.14) from extensions.js.
import { drawSeatAxis } from './charts.js';
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
