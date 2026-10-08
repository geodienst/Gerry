// Chapter 01, "One electorate. Three outcomes." (redesign, chapter 3): three rows as a radio group with the two
// effects between them, a waffle of the seats that follows the chosen row, and the sentences beside it.
// Texts come from chapters.js and geometry from axes.js; this module only draws.
import { HOUSE, houseLayout, houseCell, housePlace } from './axes.js';
import { waffleText, changedKey } from './chapters.js';

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

  // The House of 435 (owner concept, October 8, 2026): seat i counted from the Democratic side, Democrats from
  // the left, Republicans from the right, seat 218 alone at the top in the middle. The six one-seat states are
  // the outermost seats of each side, framed, with a tooltip. Wide screens get 7 rows, narrow ones 14.
  const svg = $('waffle');
  const box = svg.parentElement;
  const tip = $('waffle-tip');
  const house = view.house;
  for (const g of svg.querySelectorAll('g')) g.remove();
  const seatLayer = svgNode('g');
  const band = svgNode('g', { class: 'band', display: 'none' });
  const changed = svgNode('g', { class: 'changed', 'aria-hidden': 'true' });
  const frames = svgNode('g', { class: 'frames' });
  const midLabel = svgNode('text', { class: 'midlabel', 'aria-hidden': 'true', 'text-anchor': 'middle' }, house.midLabel);
  svg.append(seatLayer, band, changed, frames, midLabel);
  $('finding').textContent = view.finding;
  $('key-band-text').textContent = view.band.key;
  $('key-fill').textContent = house.fillKey;
  $('key-mid-text').textContent = house.midKey;
  $('key-single-text').textContent = house.singleKey;

  const PAD = 2; // room in the viewBox for the frames around the outer seats
  let layout = null;
  let cells = [];
  let moved = null; // [from, to) of the seats that changed with the last choice of row
  const at = (i) => {
    const place = housePlace(i);
    return place === 'mid' ? layout.mid : houseCell(place.side, place.k, layout.rows);
  };
  const seatsFrom = (lo, hi) => Array.from({ length: Math.max(0, hi - lo) }, (_, k) => lo + k);
  const dots = () => (moved ? seatsFrom(...moved).map((i) => {
    const { x, y } = at(i);
    return svgNode('circle', { cx: x + HOUSE.size / 2, cy: y + HOUSE.size / 2, r: 1.8 });
  }) : []);

  function showTip(frame, text) {
    tip.textContent = text;
    tip.hidden = false;
    const f = frame.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const left = Math.min(Math.max(f.left - b.left + f.width / 2 - tip.offsetWidth / 2, 0), b.width - tip.offsetWidth);
    const above = f.top - b.top - tip.offsetHeight - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${above >= 0 ? above : f.bottom - b.top + 8}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTip(); });

  function frame(seatsInFrame, text) {
    const spots = seatsInFrame.map(at);
    const xs = spots.map((s) => s.x);
    const ys = spots.map((s) => s.y);
    const rect = svgNode('rect', {
      x: Math.min(...xs) - 1.5, y: Math.min(...ys) - 1.5,
      width: Math.max(...xs) - Math.min(...xs) + HOUSE.size + 3, height: Math.max(...ys) - Math.min(...ys) + HOUSE.size + 3,
    });
    rect.addEventListener('pointerenter', () => showTip(rect, text));
    rect.addEventListener('pointerleave', hideTip);
    rect.addEventListener('click', () => (tip.hidden ? showTip(rect, text) : hideTip()));
    return rect;
  }

  function build(rows) {
    layout = houseLayout(rows);
    svg.setAttribute('viewBox', `${-PAD} 0 ${layout.width + 2 * PAD} ${layout.height + PAD}`);
    cells = Array.from({ length: 2 * HOUSE.half + 1 }, (_, i) => {
      const { x, y } = at(i);
      return svgNode('rect', { class: i === HOUSE.half ? 'seat middle' : 'seat', x, y, width: HOUSE.size, height: HOUSE.size });
    });
    seatLayer.replaceChildren(...cells);
    // the band in seats of 435: the one-seat Democratic states come first
    band.replaceChildren(...seatsFrom(view.band.lo + house.dSingle - 1, view.band.hi + house.dSingle).map((i) => {
      const { x, y } = at(i);
      return svgNode('rect', { x: x + 0.7, y: y + 0.7, width: HOUSE.size - 1.4, height: HOUSE.size - 1.4 });
    }));
    frames.replaceChildren(frame(seatsFrom(0, house.dSingle), house.singles[0].text),
      frame(seatsFrom(2 * HOUSE.half + 1 - house.rSingle, 2 * HOUSE.half + 1), house.singles[1].text));
    midLabel.setAttribute('x', layout.mid.x + HOUSE.size / 2);
    midLabel.setAttribute('y', HOUSE.top - 5);
    changed.replaceChildren(...dots());
    hideTip();
  }

  // 7 rows where the waffle is at least 560px wide, else 14; the label above the middle seat stays near 12px
  function fit() {
    const rows = box.clientWidth >= 560 ? 7 : 14;
    if (!layout || rows !== layout.rows) {
      build(rows);
      draw(false);
    }
    const scale = svg.clientWidth / (layout.width + 2 * PAD) || 1;
    midLabel.style.fontSize = `${Math.max(12, 12.5 / scale)}px`; // inline, so the chart text rule of the style sheet does not win
  }

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
    if (!colors || !layout) return;
    const row = view.rows.find((r) => r.key === current);
    const n = row.seats + house.dSingle; // Democratic seats of 435
    const motion = animate && shown !== null && !reduceMotion();
    cells.forEach((rect, i) => {
      const fill = colors.party(i < n);
      if (rect.getAttribute('fill') === fill) return;
      // squares change one after another, starting at the old count
      rect.style.transitionDelay = motion ? `${Math.abs(i - shown) * 18}ms` : '0ms';
      rect.style.transitionDuration = motion ? '' : '0s';
      rect.setAttribute('fill', fill);
    });
    if (shown !== null && shown !== n) {
      moved = [Math.min(shown, n), Math.max(shown, n)];
      changed.replaceChildren(...dots());
      $('key-changed-text').textContent = changedKey(moved[1] - moved[0]);
      $('key-changed').hidden = false;
    }
    shown = n;
    band.setAttribute('display', current === 'neutral' ? 'inline' : 'none');
    $('key-band').hidden = current !== 'neutral';
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

  fit();
  new ResizeObserver(fit).observe(box);
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
