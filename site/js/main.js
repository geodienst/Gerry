// Entry point: loads site/data/results.json and site/data/map.topojson, then wires chapter 01, the map, the sheet beside it and the national strip.
// d3 and topojson come from site/vendor/ as globals; the page makes no other requests.
import { stateFromHash, linkFor } from './hash.js';
import { makeColors } from './colors.js';
import {
  indexResults, stateOptions, mapHints, effectList, nationalView, methodFills,
} from './model.js';
import {
  majorityView, extensionFills, redrawView, competitiveText, controlTables, senateView,
} from './extensions.js';
import { createMap, drawLegend } from './map.js';
import { renderList, renderState, renderLargest, renderSingle } from './sheet.js';
import {
  renderNational, renderMajority, renderRedraws, renderControl, renderSenate,
} from './national.js';
import { outcomesView, largestEffects, recordView, singleSeatView } from './chapters.js';
import { renderOutcomes } from './outcomes.js';

const { d3 } = globalThis;
const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkMode = window.matchMedia('(prefers-color-scheme: dark)');

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** The two poles of the current palette, read from the CSS tokens (light or dark). */
function readPoles(palette) {
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  return {
    d: token(palette === 'party' ? '--party-d' : '--neutral-d'),
    r: token(palette === 'party' ? '--party-r' : '--neutral-r'),
    mid: token('--mid'),
    blank: token('--blank'),
  };
}

async function main() {
  let results;
  let topology;
  try {
    [results, topology] = await Promise.all([getJson('data/results.json'), getJson('data/map.topojson')]);
  } catch (error) {
    $('load-error').textContent = `The map data did not load (${error.message}). `
      + 'Open the page through a web server, for example with make serve, not as a file.';
    $('load-error').hidden = false;
    return;
  }

  const index = indexResults(results);
  const ui = { view: 'states', palette: 'party', selected: '', zerosOpen: false };
  let colors = makeColors(d3.interpolateLab, readPoles(ui.palette));
  const hints = mapHints({
    touch: window.matchMedia('(pointer: coarse)').matches,
    mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
  });
  $('maphint').textContent = hints.hint;
  const outcomes = renderOutcomes(outcomesView(results), { reduceMotion: () => reduceMotion.matches });
  outcomes.paint(colors);

  const map = createMap({
    svg: $('map'), box: $('mapbox'), tip: $('tip'), tapline: $('tapline'), gesture: $('gesture'),
    index, topology, hints,
    onSelect: (postal) => select(postal, { push: true }),
    reduceMotion: () => reduceMotion.matches,
  });

  const pick = $('pick');
  for (const option of stateOptions(results, { single: true })) pick.append(new Option(option.label, option.postal));
  pick.addEventListener('change', () => select(pick.value, { push: true }));
  const paintLargest = renderLargest($('largest'), largestEffects(results), (postal) => select(postal, { push: true }));

  function renderSheet() {
    if (index.single[ui.selected]) renderSingle($('sheet'), singleSeatView(results, ui.selected), back);
    else if (ui.selected) renderState($('sheet'), recordView(results, ui.selected), colors, back);
    else renderList($('sheet'), effectList(results), colors, (postal) => select(postal, { push: true, focus: true }), ui);
  }

  function paint() {
    map.paint(colors, ui.view, ui.selected);
    drawLegend($('legend'), ui.view, colors);
    paintLargest(colors, ui.selected);
    renderSheet();
  }

  /** Choose a state ("" for the whole map): sheet, outline, zoom and the link (#TX). */
  function select(postal, { push = false, focus = false, animate = true, announce = !focus } = {}) {
    const previous = ui.selected;
    ui.selected = postal;
    pick.value = postal;
    if (push && postal !== previous) history.pushState(null, '', linkFor(postal, location.pathname + location.search));
    paint();
    if (postal !== previous) map.zoomTo(postal, animate);
    if (focus) $('sheet-title').focus();
    // The map, the State menu and the link leave the focus where it is; a screen reader hears the new sheet's heading.
    else if (announce && postal !== previous) $('sheet-status').textContent = $('sheet-title').textContent;
  }

  /** From a state back to the list; focus goes to that state's row, or to the heading when the row is folded. */
  function back() {
    const previous = ui.selected;
    select('', { push: true, announce: false });
    $('sheet-status').textContent = ''; // the list is back, so the live region drops the old state's name
    const row = $('sheet').querySelector(`.row[data-postal="${previous}"]`);
    row?.focus(); // a row inside the folded line cannot take focus
    if (!row || document.activeElement !== row) $('sheet-title').focus();
  }

  function fromLocation() {
    const postal = stateFromHash(location.hash, results.states, index.single);
    const target = location.hash.slice(1);
    if (!postal && target && document.getElementById(target)) return; // a link to a section, such as #method
    select(postal);
  }
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  // Escape acts from the sheet or the map, or with nothing focused while one of them is in view;
  // not from the State menu, from text elsewhere on the page, or while reading further down.
  const inView = (el) => { const box = el.getBoundingClientRect(); return box.bottom > 0 && box.top < window.innerHeight; };
  document.addEventListener('keydown', (event) => {
    const from = event.target;
    const inside = $('sheet').contains(from) || $('mapbox').contains(from);
    const idle = from === document.body && (inView($('sheet')) || inView($('mapbox')));
    if (event.key === 'Escape' && ui.selected && (inside || idle)) back();
  });

  const pressed = (on, off) => { $(on).setAttribute('aria-pressed', 'true'); $(off).setAttribute('aria-pressed', 'false'); };
  $('view-districts').addEventListener('click', () => { ui.view = 'districts'; pressed('view-districts', 'view-states'); paint(); });
  $('view-states').addEventListener('click', () => { ui.view = 'states'; pressed('view-states', 'view-districts'); paint(); });
  const setPalette = (palette) => {
    ui.palette = palette;
    colors = makeColors(d3.interpolateLab, readPoles(palette));
    outcomes.paint(colors);
    paint();
  };
  $('palette-party').addEventListener('click', () => { pressed('palette-party', 'palette-neutral'); setPalette('party'); });
  $('palette-neutral').addEventListener('click', () => { pressed('palette-neutral', 'palette-party'); setPalette('neutral'); });
  darkMode.addEventListener('change', () => setPalette(ui.palette));
  $('zoom-in').addEventListener('click', () => map.zoomBy(1.8));
  $('zoom-out').addEventListener('click', () => map.zoomBy(1 / 1.8));
  $('zoom-reset').addEventListener('click', () => { select('', { push: true }); map.zoomTo('', true); });

  const national = nationalView(results);
  renderNational($('national'), national);
  const majority = majorityView(results);
  renderMajority($('majority'), majority);
  renderRedraws($('redraws'), redrawView(results));
  $('competitive-text').textContent = competitiveText(results.national.competitive, 'maps');
  renderControl($('control'), controlTables(results));
  renderSenate($('senate'), senateView(results));
  const fills = { ...methodFills(results), ...extensionFills(results) };
  for (const el of document.querySelectorAll('[data-fill]')) {
    if (Object.hasOwn(fills, el.dataset.fill)) el.textContent = fills[el.dataset.fill];
  }

  // Charts size themselves to their box; draw them again when the width changes, keeping keyboard focus.
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === width) return; // phones change only the height while scrolling
    width = window.innerWidth;
    const focusable = () => [...$('sheet').querySelectorAll('button, summary, a[href], [tabindex]')];
    const at = focusable().indexOf(document.activeElement);
    renderSheet();
    renderNational($('national'), national);
    renderMajority($('majority'), majority);
    if (at >= 0) focusable()[at]?.focus({ preventScroll: true });
  });

  select(stateFromHash(location.hash, results.states, index.single), { animate: false, announce: false });
}

main();
