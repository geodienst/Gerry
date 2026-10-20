// The drawing effect along the vote slider, at the bottom of chapter 01: one bar per
// stop of the slider, up for an effect toward Democrats and down toward Republicans, labels for a few examples and a
// line at the stop the slider shows. Drawn at the width of its box in pixels, so the text keeps its size on a phone.
// Texts from lib/chapters.ts (outcomesView().byVote); this module only draws.
import { svgNode } from './dom.ts';
import type { OutcomesView } from '../lib/chapters.ts';
import type { Colors } from '../lib/colors.ts';

const HEIGHT = 240;
const M = { left: 44, right: 8, top: 40, bottom: 44 }; // top: room for the example labels; bottom: scale and its name

/**
 * @param el the box for the chart
 * @param byVote outcomesView(results).byVote
 * @param scale the whole percents under the slider
 */
export function renderByVote(el: HTMLElement, byVote: OutcomesView['byVote'], scale: OutcomesView['slider']['scale']) {
  const svg = svgNode('svg', { class: 'chart byvote-chart', role: 'img', 'aria-label': byVote.label });
  el.replaceChildren(svg);
  let colors: Colors | null = null;
  let at = 0; // the stop the slider shows
  let width = 0;

  function draw() {
    width = Math.max(280, Math.round(el.clientWidth));
    svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(HEIGHT));
    const plotW = width - M.left - M.right;
    const half = (HEIGHT - M.top - M.bottom) / 2;
    const zero = M.top + half;
    const step = plotW / byVote.bars.length;
    const x = (index: number) => M.left + (index + 0.5) * step;
    const y = (seats: number) => zero - (seats / byVote.max) * half;
    const parts: SVGElement[] = [];
    // the scale of seats: D+max above, 0, R+max below
    const scaleLines: [number, string][] = [[byVote.max, `D+${byVote.max}`], [0, '0'], [-byVote.max, `R+${byVote.max}`]];
    for (const [value, text] of scaleLines) {
      parts.push(svgNode('line', { class: value === 0 ? 'zero' : 'grid', x1: M.left, x2: width - M.right, y1: y(value), y2: y(value) }));
      parts.push(svgNode('text', { class: 'axis', x: M.left - 6, y: y(value) + 4, 'text-anchor': 'end' }, text));
    }
    for (const b of byVote.bars) {
      const rect = svgNode('rect', {
        class: b.drawing > 0 ? 'col d' : 'col r', x: x(b.index) - Math.max(1, step - 1) / 2, width: Math.max(1, step - 1),
        y: Math.min(y(b.drawing), zero), height: Math.abs(y(b.drawing) - zero),
      });
      rect.append(svgNode('title', {}, b.title));
      parts.push(rect);
    }
    for (const t of scale) parts.push(svgNode('text', { class: 'axis', x: x(t.index), y: HEIGHT - M.bottom + 16, 'text-anchor': 'middle' }, t.label));
    parts.push(svgNode('text', { class: 'axis', x: M.left + plotW / 2, y: HEIGHT - 6, 'text-anchor': 'middle' }, byVote.axis));
    // example labels in the band above the plot, left out where they would run into the one before
    let right = -Infinity;
    for (const e of byVote.examples) {
      const text = e.note ? `${e.value} (${e.note})` : e.value;
      const w = text.length * 6.6;
      const cx = Math.min(Math.max(x(e.index), M.left + w / 2), width - M.right - w / 2);
      if (cx - w / 2 < right + 6) continue;
      right = cx + w / 2;
      const end = y(byVote.bars[e.index].drawing);
      parts.push(svgNode('line', { class: 'lead', x1: x(e.index), x2: x(e.index), y1: M.top - 12, y2: Math.min(end, zero) }));
      parts.push(svgNode('text', { class: 'example', x: cx, y: M.top - 16, 'text-anchor': 'middle' }, text));
    }
    parts.push(svgNode('line', { class: 'here', x1: x(at), x2: x(at), y1: M.top - 4, y2: HEIGHT - M.bottom }));
    svg.replaceChildren(...parts);
    paint(colors);
  }

  function paint(next: Colors | null) {
    colors = next;
    if (!colors) return;
    for (const rect of svg.querySelectorAll('rect.col')) rect.setAttribute('fill', colors.party(rect.classList.contains('d')));
  }

  function show(index: number) {
    at = index;
    const line = svg.querySelector('line.here');
    if (!line) return;
    const step = (width - M.left - M.right) / byVote.bars.length;
    const cx = M.left + (index + 0.5) * step;
    line.setAttribute('x1', String(cx));
    line.setAttribute('x2', String(cx));
  }

  draw();
  new ResizeObserver(() => { if (Math.round(el.clientWidth) !== width) draw(); }).observe(el);
  return { paint, show };
}
