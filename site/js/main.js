// Entry point: loads site/data/results.json and site/data/map.topojson, then wires the map,
// the sheet beside it and the national strip. d3 and topojson come from site/vendor/ as
// globals; the page makes no other requests.
import { stateFromHash, linkFor } from './hash.js';
import { makeColors } from './colors.js';
import { indexResults, stateOptions, mapHints, effectList, stateSheet, nationalView } from './model.js';
import { createMap, drawLegend } from './map.js';
import { renderList, renderState } from './sheet.js';
import { renderKeyline, renderNational } from './national.js';

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
  const ui = { view: 'districts', palette: 'party', selected: '', zerosOpen: false };
  let colors = makeColors(d3.interpolateLab, readPoles(ui.palette));
  const hints = mapHints({
    touch: window.matchMedia('(pointer: coarse)').matches,
    mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
  });
  $('maphint').textContent = hints.hint;

  const map = createMap({
    svg: $('map'), box: $('mapbox'), tip: $('tip'), tapline: $('tapline'), gesture: $('gesture'),
    index, topology, hints,
    onSelect: (postal) => select(postal, { push: true }),
    reduceMotion: () => reduceMotion.matches,
  });

  const pick = $('pick');
  for (const option of stateOptions(results)) pick.append(new Option(option.name, option.postal));
  pick.addEventListener('change', () => select(pick.value, { push: true }));

  function renderSheet() {
    if (ui.selected) renderState($('sheet'), stateSheet(results, ui.selected), colors, back);
    else renderList($('sheet'), effectList(results), colors, (postal) => select(postal, { push: true, focus: true }), ui);
  }

  function paint() {
    map.paint(colors, ui.view, ui.selected);
    drawLegend($('legend'), ui.view, colors);
    renderSheet();
  }

  /** Choose a state ("" for the whole map): sheet, outline, zoom and the link (#TX). */
  function select(postal, { push = false, focus = false, animate = true } = {}) {
    const previous = ui.selected;
    ui.selected = postal;
    pick.value = postal;
    if (push && postal !== previous) history.pushState(null, '', linkFor(postal, location.pathname + location.search));
    paint();
    if (postal !== previous) map.zoomTo(postal, animate);
    if (focus) $('sheet-title').focus();
  }

  /** From a state back to the list; focus goes to that state's row, or to the heading when the row is folded. */
  function back() {
    const previous = ui.selected;
    select('', { push: true });
    const row = $('sheet').querySelector(`.row[data-postal="${previous}"]`);
    row?.focus(); // a row inside the folded line cannot take focus
    if (!row || document.activeElement !== row) $('sheet-title').focus();
  }

  function fromLocation() {
    const postal = stateFromHash(location.hash, results.states);
    const target = location.hash.slice(1);
    if (!postal && target && document.getElementById(target)) return; // a link to a section, such as #method
    select(postal);
  }
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  // Escape acts from the sheet, the map, or with nothing focused; not from the State menu
  // or from text elsewhere on the page.
  document.addEventListener('keydown', (event) => {
    const from = event.target;
    const here = from === document.body || $('sheet').contains(from) || $('mapbox').contains(from);
    if (event.key === 'Escape' && ui.selected && here) back();
  });

  const pressed = (on, off) => { $(on).setAttribute('aria-pressed', 'true'); $(off).setAttribute('aria-pressed', 'false'); };
  $('view-districts').addEventListener('click', () => { ui.view = 'districts'; pressed('view-districts', 'view-states'); paint(); });
  $('view-states').addEventListener('click', () => { ui.view = 'states'; pressed('view-states', 'view-districts'); paint(); });
  const setPalette = (palette) => {
    ui.palette = palette;
    colors = makeColors(d3.interpolateLab, readPoles(palette));
    paint();
  };
  $('palette-party').addEventListener('click', () => { pressed('palette-party', 'palette-neutral'); setPalette('party'); });
  $('palette-neutral').addEventListener('click', () => { pressed('palette-neutral', 'palette-party'); setPalette('neutral'); });
  darkMode.addEventListener('change', () => setPalette(ui.palette));
  $('zoom-in').addEventListener('click', () => map.zoomBy(1.8));
  $('zoom-out').addEventListener('click', () => map.zoomBy(1 / 1.8));
  $('zoom-reset').addEventListener('click', () => { select('', { push: true }); map.zoomTo('', true); });

  const national = nationalView(results);
  renderKeyline($('keyline'), national);
  renderNational($('national'), national);

  // Charts size themselves to their box; draw them again when the width changes, keeping keyboard focus.
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === width) return; // phones change only the height while scrolling
    width = window.innerWidth;
    const focusable = () => [...$('sheet').querySelectorAll('button, summary, a[href], [tabindex]')];
    const at = focusable().indexOf(document.activeElement);
    renderSheet();
    renderNational($('national'), national);
    if (at >= 0) focusable()[at]?.focus({ preventScroll: true });
  });

  select(stateFromHash(location.hash, results.states), { animate: false });
}

main();
