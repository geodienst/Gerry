// Chapter 03, "In detail" (redesign, chapter 5): competitive districts, redraws since 2024,
// the tables by political control and, last, the Senate. Texts from lib/chapters.ts (decideView);
// this module only fills the cards and draws the two axes.
import { select } from 'd3';
import { drawDotRows } from './charts.ts';
import { byId as $ } from './dom.ts';
import type { DecideView, OutcomesPoint } from '../lib/chapters.ts';

/** Large figures with a short label under each. */
function figures(el: HTMLElement, items: { value: string; label: string }[]) {
  const root = select(el).html('');
  for (const item of items) {
    const cell = root.append('div');
    cell.append('b').text(item.value);
    cell.append('span').text(item.label);
  }
}

/** The Senate at one stop of the vote slider in chapter 01: the seats it gives, and which
 *  seats change party. `point` is a stop of outcomesView().points. */
export function showSenate(view: DecideView, point: OutcomesPoint) {
  const at = view.senate.at(point);
  figures($('senate-figures'), [view.senate.needed, at.figure]);
  $('senate-at').textContent = at.text;
}

/** Fill the four cards. The axis takes the width of its card, so call this again after a resize. */
export function renderDecide(view: DecideView) {
  $('senate-title').textContent = view.senate.title;
  $('senate-text').textContent = view.senate.sentence;
  $('senate-note').textContent = view.senate.note;

  figures($('competitive-figures'), view.competitive.figures);
  drawDotRows($('competitive-axis'), view.competitive.dots, view.competitive.label, 360);
  $('competitive-text').textContent = view.competitive.text;

  figures($('redraw-figures'), view.redraws.figures);
  $('redraw-text').textContent = view.redraws.sentence;
  const list = select($('redraw-list')).html('');
  for (const row of view.redraws.rows) {
    const item = list.append('li');
    item.append('span').text(row.name);
    item.append('span').attr('class', 'v').text(row.text);
  }

  type Rows = DecideView['control']['byControl'] | DecideView['control']['byBody'];
  const tables: [string, Rows][] = [['by-control', view.control.byControl], ['by-body', view.control.byBody]];
  for (const [id, rows] of tables) {
    const body = select($(id)).html('');
    for (const row of rows) {
      const tr = body.append('tr');
      tr.append('th').attr('scope', 'row').text(row.label);
      for (const value of [row.states, row.seats, row.drawing]) tr.append('td').attr('class', 'num').text(value);
    }
  }
  $('control-note').textContent = view.control.note;
}
