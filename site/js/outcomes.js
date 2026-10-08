// Chapter 01, "One electorate. Three outcomes." (redesign, chapter 3): three rows as a radio group with the two
// effects between them, a waffle of the seats that follows the chosen row, and the sentences beside it.
// Texts come from chapters.js and geometry from axes.js; this module only draws.
import { WAFFLE, waffleSize, waffleCell, waffleTick, waffleBand } from './axes.js';
import { waffleText } from './chapters.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);

function node(tag, attrs = {}, text = null, ns = null) {
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (text !== null) el.textContent = text;
  return el;
}
const svgNode = (tag, attrs, text = null) => node(tag, attrs, text, SVG_NS);

/**
 * Draw chapter 01. Nothing is colored until the first paint(colors).
 * @param {object} view outcomesView(results)
 * @param {{reduceMotion: () => boolean}} o
 * @returns {{paint(colors: object): void, select(key: string, animate?: boolean): void}}
 */
export function renderOutcomes(view, { reduceMotion }) {
  $('outcomes-intro').textContent = view.intro;

  // The rows: one tab stop; arrows and Home/End move the choice and the focus (redesign, chapter 8).
  const group = $('scen');
  group.replaceChildren();
  const rows = view.rows.map((row, i) => {
    const button = node('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': 'false', tabindex: '-1', 'data-key': row.key });
    button.append(node('span', { class: 'dot', 'aria-hidden': 'true' }), node('span', { class: 'lab' }, row.label),
      node('span', { class: 'big' }, row.value), node('span', { class: 'desc' }, row.desc));
    button.addEventListener('click', () => select(row.key, true));
    button.addEventListener('keydown', (event) => {
      const last = view.rows.length - 1;
      const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: last }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const next = view.rows[(to + view.rows.length) % view.rows.length].key;
      select(next, true);
      group.querySelector(`[data-key="${next}"]`).focus();
    });
    group.append(button);
    const step = view.steps[i];
    if (step) {
      const line = node('div', { class: 'step' });
      const text = node('span');
      text.append(`${step.label} `, node('b', {}, step.value), `: ${step.words}`);
      line.append(text);
      group.append(line);
    }
    return button;
  });

  // The waffle: one square per seat, column by column; the band outline; the number above the last Democratic seat.
  const size = waffleSize(view.total);
  const svg = $('waffle');
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  for (const g of svg.querySelectorAll('g')) g.remove();
  const seatLayer = svgNode('g');
  const squares = Array.from({ length: view.total }, (_, i) => {
    const { x, y } = waffleCell(i);
    const rect = svgNode('rect', { class: 'seat', x, y, width: WAFFLE.size, height: WAFFLE.size });
    seatLayer.append(rect);
    return rect;
  });
  const band = svgNode('g', { class: 'band', display: 'none' });
  for (const { x, y } of waffleBand(view.band.lo, view.band.hi)) {
    band.append(svgNode('rect', { x: x + 0.7, y: y + 0.7, width: WAFFLE.size - 1.4, height: WAFFLE.size - 1.4 }));
  }
  const tick = svgNode('g', { class: 'tick', 'aria-hidden': 'true' });
  svg.append(seatLayer, band, tick);
  $('key-band-text').textContent = view.band.key;

  // The two columns under rows and waffle.
  const effect = (step) => {
    const line = node('div', { class: 'eff' });
    line.append(node('span', { class: 'k' }, step.label), node('span', { class: 'v' }, step.value), node('span', { class: 'w' }, step.detail));
    return line;
  };
  $('effects').replaceChildren(...view.steps.map(effect), node('p', { class: 'note' }, view.effectsNote));
  $('spread').replaceChildren(node('p', {}, view.spread), node('p', {}, view.position),
    node('p', { class: 'note' }, view.neutralNote), node('p', { class: 'note' }, view.scope));

  let current = 'enacted';
  let shown = null; // the Democratic count on screen, where a change starts from
  let colors = null;

  function draw(animate) {
    if (!colors) return;
    const row = view.rows.find((r) => r.key === current);
    const n = row.seats;
    const motion = animate && shown !== null && !reduceMotion();
    squares.forEach((rect, i) => {
      const fill = colors.party(i < n);
      if (rect.getAttribute('fill') === fill) return;
      // squares change one after another, starting at the old count
      rect.style.transitionDelay = motion ? `${Math.abs(i - shown) * 18}ms` : '0ms';
      rect.style.transitionDuration = motion ? '' : '0s';
      rect.setAttribute('fill', fill);
    });
    shown = n;
    band.setAttribute('display', current === 'neutral' ? 'inline' : 'none');
    $('key-band').hidden = current !== 'neutral';
    const mid = waffleCell(Math.max(n, 1) - 1).x + WAFFLE.size / 2;
    tick.replaceChildren(
      svgNode('line', { x1: mid, x2: mid, y1: WAFFLE.top - 4, y2: WAFFLE.top - 1 }),
      svgNode('text', { x: waffleTick(n, view.total), y: WAFFLE.top - 6, 'text-anchor': 'middle' }, row.value),
    );
    const text = waffleText(view, current);
    const who = (name, value, toD) => {
      const span = node('span', { class: 'who' });
      const swatch = node('i', { class: 'sw', 'aria-hidden': 'true' });
      swatch.style.background = colors.party(toD);
      span.append(swatch, name, node('b', {}, value));
      return span;
    };
    $('readout').replaceChildren(who('Democrats', text.d, true), who('Republicans', text.r, false));
    $('waffle-label').textContent = text.label;
  }

  function select(key, animate = false) {
    current = key;
    for (const button of rows) {
      const on = button.dataset.key === key;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
    draw(animate);
  }

  select(current);
  return {
    /** Colors for the squares and the key; again after a palette or theme change. */
    paint(next) {
      colors = next;
      for (const swatch of document.querySelectorAll('#outcomes .wkey .sw')) swatch.style.background = colors.party(swatch.classList.contains('d'));
      draw(false);
    },
    select,
  };
}
