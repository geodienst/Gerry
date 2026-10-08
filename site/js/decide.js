// Chapter 03, "What the maps decide" (redesign, chapter 5): the House majority, the Senate, competitive
// districts, redraws since 2024 and the tables by political control. Texts from chapters.js (decideView);
// this module only fills the cards and draws the two axes.
import { drawDotRows } from './charts.js';

const { d3 } = globalThis;
const $ = (id) => document.getElementById(id);

/** Large figures with a short label under each. */
function figures(el, items) {
  const root = d3.select(el).html('');
  for (const item of items) {
    const cell = root.append('div');
    cell.append('b').text(item.value);
    cell.append('span').text(item.label);
  }
}

/** Fill the five cards. The axes take the width of their card, so call this again after a resize. */
export function renderDecide(view) {
  $('decide-intro').textContent = view.intro;

  $('majority-text').textContent = view.majority.sentence;
  drawDotRows($('majority-axis'), view.majority.dots, view.majority.label);
  $('majority-note').textContent = [view.majority.proportionalNote, view.majority.rule].filter(Boolean).join(' ');

  figures($('senate-figures'), view.senate.figures);
  $('senate-text').textContent = view.senate.sentence;
  $('senate-note').textContent = view.senate.note;

  figures($('competitive-figures'), view.competitive.figures);
  drawDotRows($('competitive-axis'), view.competitive.dots, view.competitive.label, 360);
  $('competitive-text').textContent = view.competitive.text;

  figures($('redraw-figures'), view.redraws.figures);
  $('redraw-text').textContent = view.redraws.sentence;
  const list = d3.select($('redraw-list')).html('');
  for (const row of view.redraws.rows) {
    const item = list.append('li');
    item.append('span').text(row.name);
    item.append('span').attr('class', 'v').text(row.text);
  }

  for (const [id, rows] of [['by-control', view.control.byControl], ['by-body', view.control.byBody]]) {
    const body = d3.select($(id)).html('');
    for (const row of rows) {
      const tr = body.append('tr');
      tr.append('th').attr('scope', 'row').text(row.label);
      for (const value of [row.states, row.seats, row.drawing]) tr.append('td').attr('class', 'num').text(value);
    }
  }
  $('control-note').textContent = view.control.note;
}
