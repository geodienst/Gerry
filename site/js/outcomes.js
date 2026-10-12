// Chapter 01, "One electorate. Three outcomes." (redesign, chapter 3): three rows as a radio group with the two
// effects between them, a waffle of the seats that follows the chosen row, and the sentences beside it. A vote
// slider (plan 2026-10-08-vote-slider) moves all of it to another national vote share.
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
  let pi = view.baseIndex; // the point of the vote slider on screen
  const point = () => view.points[pi];

  // The rows: one tab stop; arrows and Home/End move the choice and the focus (redesign, chapter 8).
  const group = $('scen');
  group.replaceChildren();
  const parts = {}; // per row: the number and the description, which follow the slider
  const stepTexts = [];
  const rows = view.rows.map((row, i) => {
    const button = node('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': 'false', tabindex: '-1', 'data-key': row.key });
    // the number with a block in the Democratic color under it: these are Democratic seats (owner, October 12)
    parts[row.key] = { num: node('span', { class: 'n' }), desc: node('span', { class: 'desc' }) };
    const big = node('span', { class: 'big' });
    big.append(parts[row.key].num, node('i', { class: 'sw d', 'aria-hidden': 'true' }),
      node('span', { class: 'visually-hidden' }, ' Democratic seats'));
    button.append(node('span', { class: 'dot', 'aria-hidden': 'true' }), node('span', { class: 'lab' }, row.label),
      big, parts[row.key].desc);
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
    if (i < view.steps.length) {
      const line = node('div', { class: 'step' });
      const text = node('span');
      line.append(text);
      group.append(line);
      stepTexts.push(text);
    }
    return button;
  });

  // The House of 435 (owner concept, October 8, 2026): seat i counted from the Democratic side, Democrats from
  // the left, Republicans from the right, seat 218 at the top of the middle column. The six one-seat states are
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
  svg.append(seatLayer, band, changed, frames);
  $('key-fill').textContent = house.fillKey;
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
  // a tap anywhere else closes the tip on a touch screen
  document.addEventListener('pointerdown', (event) => { if (!event.target.closest?.('#waffle .frames')) hideTip(); });

  function frame(seatsInFrame, text) {
    const spots = seatsInFrame.map(at);
    const xs = spots.map((s) => s.x);
    const ys = spots.map((s) => s.y);
    const rect = svgNode('rect', {
      x: Math.min(...xs) - 1.5, y: Math.min(...ys) - 1.5,
      width: Math.max(...xs) - Math.min(...xs) + HOUSE.size + 3, height: Math.max(...ys) - Math.min(...ys) + HOUSE.size + 3,
    });
    // a mouse shows the tip while it points at the frame; a tap or a click toggles it
    rect.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') showTip(rect, text); });
    rect.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') hideTip(); });
    rect.addEventListener('click', () => (tip.hidden || tip.textContent !== text ? showTip(rect, text) : hideTip()));
    return rect;
  }

  // the band at the point on screen, in seats of 435 like every count of chapter 01
  function drawBand() {
    const { lo, hi } = point().band;
    band.replaceChildren(...seatsFrom(lo - 1, hi).map((i) => {
      const { x, y } = at(i);
      return svgNode('rect', { x: x + 0.7, y: y + 0.7, width: HOUSE.size - 1.4, height: HOUSE.size - 1.4 });
    }));
  }

  function build(rows) {
    layout = houseLayout(rows);
    svg.setAttribute('viewBox', `${-PAD} 0 ${layout.width + 2 * PAD} ${layout.height + PAD}`);
    cells = Array.from({ length: 2 * HOUSE.half + 1 }, (_, i) => {
      const { x, y } = at(i);
      return svgNode('rect', { class: i === HOUSE.half ? 'seat middle' : 'seat', x, y, width: HOUSE.size, height: HOUSE.size });
    });
    seatLayer.replaceChildren(...cells);
    drawBand();
    frames.replaceChildren(frame(seatsFrom(0, house.dSingle), house.singles[0].text),
      frame(seatsFrom(2 * HOUSE.half + 1 - house.rSingle, 2 * HOUSE.half + 1), house.singles[1].text));
    changed.replaceChildren(...dots());
    hideTip();
  }

  // 7 rows where the waffle is at least 560px wide, else 14
  function fit() {
    const rows = box.clientWidth >= 560 ? 7 : 14;
    if (!layout || rows !== layout.rows) {
      build(rows);
      draw(false);
    }
  }

  // The texts that follow the slider: row numbers, the effects between and under the rows, the finding and the
  // sentences beside the waffle.
  const effect = (step) => {
    const line = node('div', { class: 'eff' });
    line.append(node('span', { class: 'k' }, step.label), node('span', { class: 'v' }, step.value), node('span', { class: 'w' }, step.detail));
    return line;
  };
  function texts() {
    const p = point();
    for (const row of p.rows) {
      parts[row.key].num.textContent = row.value;
      parts[row.key].desc.textContent = row.desc;
    }
    p.steps.forEach((step, i) => stepTexts[i].replaceChildren(`${step.label} `, node('b', {}, step.value), `: ${step.words}`));
    $('finding').textContent = p.finding;
    $('key-band-text').textContent = p.band.key;
    $('effects').replaceChildren(...p.steps.map(effect), node('p', { class: 'note' }, view.effectsNote));
    $('spread').replaceChildren(node('p', {}, p.spread), node('p', {}, p.position),
      node('p', { class: 'note' }, view.neutralNote), node('p', { class: 'note' }, view.scope));
  }

  // The vote slider: one step per point, a plain scale of whole percents and a mark at the 2016 and 2020 votes.
  const slider = $('vote');
  slider.min = '0';
  slider.max = String(view.points.length - 1);
  slider.step = '1';
  slider.value = String(pi);
  $('vote-label').textContent = view.slider.label;
  $('vote-majority').textContent = view.slider.majority;
  const mark = (cls, { index, label }) => {
    const tick = node('span', { class: cls });
    tick.style.setProperty('--at', String(index / (view.points.length - 1)));
    tick.append(node('span', {}, label));
    return tick;
  };
  $('vote-ticks').replaceChildren(...view.slider.scale.map((t) => mark('tk', t)), mark('tk base', view.slider.base));
  // the short line where the chosen row reaches a majority; it moves with the choice of row
  const tipLine = $('vote-tip');
  const placeTipLine = () => {
    const index = view.slider.reach[current];
    tipLine.hidden = index < 0;
    tipLine.style.setProperty('--at', String(Math.max(index, 0) / (view.points.length - 1)));
  };
  const back = $('vote-back');
  function showPoint() {
    const p = point();
    slider.value = String(pi);
    slider.setAttribute('aria-valuetext', p.valueText);
    $('vote-out').textContent = p.base ? `${p.label}, the 2016 and 2020 votes` : p.label;
    back.hidden = p.base;
  }
  function moveTo(index) {
    pi = index;
    showPoint();
    texts();
    drawBand();
    draw(false, true);
  }
  slider.addEventListener('input', () => moveTo(Number(slider.value)));
  back.addEventListener('click', () => { moveTo(view.baseIndex); slider.focus(); });

  let current = 'enacted';
  let shown = null; // the Democratic count on screen, where a change starts from
  let colors = null;

  // fromSlider: the count changed with the vote, not with the row, so no dots
  function draw(animate, fromSlider = false) {
    if (!colors || !layout) return;
    const here = { ...view, rows: point().rows };
    const row = here.rows.find((r) => r.key === current);
    const n = row.seats; // Democratic seats of 435
    const motion = animate && shown !== null && !reduceMotion();
    cells.forEach((rect, i) => {
      const fill = colors.party(i < n);
      if (rect.getAttribute('fill') === fill) return;
      // squares change one after another, starting at the old count
      rect.style.transitionDelay = motion ? `${Math.abs(i - shown) * 18}ms` : '0ms';
      rect.style.transitionDuration = motion ? '' : '0s';
      rect.setAttribute('fill', fill);
    });
    if (fromSlider) {
      moved = null;
      changed.replaceChildren();
      $('key-changed').hidden = true;
    } else if (shown !== null && shown !== n) {
      moved = [Math.min(shown, n), Math.max(shown, n)];
      changed.replaceChildren(...dots());
      $('key-changed-text').textContent = changedKey(moved[1] - moved[0]);
      $('key-changed').hidden = false;
    }
    shown = n;
    band.setAttribute('display', current === 'neutral' ? 'inline' : 'none');
    $('key-band').hidden = current !== 'neutral';
    const text = waffleText(here, current);
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
    placeTipLine();
    for (const button of rows) {
      const on = button.dataset.key === key;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
    draw(animate);
  }

  texts();
  showPoint();
  fit();
  new ResizeObserver(fit).observe(box);
  select(current);
  return {
    /** Colors for the squares and the key; again after a palette or theme change. */
    paint(next) {
      colors = next;
      for (const swatch of document.querySelectorAll('#outcomes .sw.d, #outcomes .sw.r')) swatch.style.background = colors.party(swatch.classList.contains('d'));
      draw(false);
    },
    select,
  };
}
