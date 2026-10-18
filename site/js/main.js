// Entry point: loads site/data/results.json and site/data/map.topojson, then wires chapter 01, the map and the sheet beside it,
// chapter 03 and the figure in the method (chapter 04).
// d3 and topojson come from site/vendor/ as globals; the page makes no other requests.
import { stateFromHash, linkFor, outcomesLink, outcomesFromSearch, SITE_URL } from './hash.js';
import { makeColors } from './colors.js';
import {
  indexResults, stateOptions, mapHints, effectList, nationalView, methodFills, MAP_TITLES, closeLegend,
  districtShares, closeDistricts,
} from './model.js';
import { extensionFills } from './extensions.js';
import { createMap, drawLegend } from './map.js';
import { renderList, renderState, renderStateFull, renderSingle, renderDistricts, renderClose } from './sheet.js';
import {
  outcomesView, recordView, singleSeatView, decideView, keyFindings,
} from './chapters.js';
import { renderOutcomes } from './outcomes.js';
import { createTour } from './tour.js';
import { renderDecide, showSenate } from './decide.js';
import { drawSeatAxis } from './charts.js';
import { nationalSeatDomain } from './axes.js';

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
  const outcomesData = outcomesView(results);
  // the answer under the question in the masthead
  $('keyfacts').replaceChildren(...keyFindings(results).map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  const outcomes = renderOutcomes(outcomesData, { reduceMotion: () => reduceMotion.matches });
  // a link from the share button of chapter 02 sets its row and vote share; the explainer then waits for Play
  const shared = outcomesFromSearch(location.search, outcomesData.rows.map((row) => row.key), outcomesData.points.map((p) => p.share));
  createTour(outcomesData.tour, outcomes, { reduceMotion: () => reduceMotion.matches, hold: Boolean(shared) });
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

  // full screen (owner's mockup, October 14, 2026): from 900px a state record runs on the right in its own order and
  // its second part lies in a strip under the map
  const atlas = document.querySelector('.atlas'); // the map, the block under it and the sheet beside it
  const isFull = () => document.fullscreenElement === atlas || atlas.classList.contains('is-full');
  const split = () => isFull() && window.innerWidth >= 900;
  function renderSheet() {
    const more = $('sheet-more');
    const apart = split() && ui.selected && !index.single[ui.selected];
    if (!apart) more.replaceChildren();
    more.hidden = !apart;
    atlas.classList.toggle('has-more', Boolean(apart));
    atlas.classList.remove('long');
    if (index.single[ui.selected]) renderSingle($('sheet'), singleSeatView(results, ui.selected), back);
    else if (ui.selected && apart) renderStateFull($('sheet'), more, recordView(results, ui.selected), colors, back);
    else if (ui.selected) renderState($('sheet'), recordView(results, ui.selected), colors, back);
    // without a state the column follows the view of the map (owner, October 18, 2026)
    else if (ui.view === 'districts') renderDistricts($('sheet'), districtShares(results), effectList(results), colors);
    else if (ui.view === 'close') renderClose($('sheet'), closeDistricts(results), colors, (postal) => select(postal, { push: true, focus: true }));
    else renderList($('sheet'), effectList(results), colors, (postal) => select(postal, { push: true, focus: true }), ui);
    // The strip runs on under the record when the record fits above it; a longer record takes the whole height and
    // the strip stays under the map (owner, October 17, 2026, option c).
    if (apart) atlas.classList.toggle('long', $('sheet').scrollHeight > $('sheet').clientHeight + 2);
  }

  function paint() {
    map.paint(colors, ui.view, ui.selected);
    $('map-title').textContent = MAP_TITLES[ui.view];
    drawLegend($('legend'), ui.view, colors, closeLegend(results));
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

  // Chapter 04: the national seat axis as a figure in the method, drawn once the method is open
  // (a closed <details> has no width to draw in), and again at a new width.
  const national = nationalView(results);
  const details = $('method-details');
  $('method-caption').textContent = national.caption;
  const drawFigure = () => {
    if (!details.open) return;
    drawSeatAxis($('method-axis'), national.axis, nationalSeatDomain(national.axis, national.seatsTotal), national.axisLabel, 720);
  };
  details.addEventListener('toggle', drawFigure);

  function fromLocation() {
    const postal = stateFromHash(location.hash, results.states, index.single);
    const target = location.hash.slice(1);
    if (!postal && target && document.getElementById(target)) { // a link to a chapter, such as #method
      if (target === 'method') details.open = true;
      return;
    }
    select(postal);
  }
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  // Escape acts from the sheet or the map, or with nothing focused while one of them is in view;
  // not from the State menu, from text elsewhere on the page, or while reading further down.
  const inView = (el) => { const box = el.getBoundingClientRect(); return box.bottom > 0 && box.top < window.innerHeight; };
  document.addEventListener('keydown', (event) => {
    // the map covering the window goes back first; the browser's own full screen handles Escape itself
    if (event.key === 'Escape' && atlas.classList.contains('is-full')) { leaveFull(); fullButton.focus(); return; }
    const from = event.target;
    const inside = $('sheet').contains(from) || $('mapbox').contains(from);
    const idle = from === document.body && (inView($('sheet')) || inView($('mapbox')));
    if (event.key === 'Escape' && ui.selected && (inside || idle)) back();
  });

  const pressed = (on, off) => { $(on).setAttribute('aria-pressed', 'true'); $(off).setAttribute('aria-pressed', 'false'); };
  const VIEWS = ['districts', 'states', 'close'];
  for (const view of VIEWS) {
    $(`view-${view}`).addEventListener('click', () => {
      ui.view = view;
      for (const other of VIEWS) $(`view-${other}`).setAttribute('aria-pressed', String(other === view));
      paint();
    });
  }
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
  // Full screen for the map, the block under it and the sheet (owner, October 13, 2026): the browser's full screen where the page
  // may use it, otherwise the map column covers the window. The same button or Escape goes back.
  const fullButton = $('map-full');
  const showFull = () => {
    renderSheet();
    const on = isFull();
    fullButton.setAttribute('aria-pressed', String(on));
    fullButton.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    fullButton.title = on ? 'Exit full screen' : 'Full screen';
    document.body.classList.toggle('map-full', atlas.classList.contains('is-full'));
  };
  const leaveFull = () => {
    if (document.fullscreenElement === atlas) document.exitFullscreen().catch(() => {});
    atlas.classList.remove('is-full');
    showFull();
  };
  fullButton.addEventListener('click', async () => {
    if (isFull()) { leaveFull(); return; }
    try {
      if (!atlas.requestFullscreen) throw new Error('no full screen here');
      await atlas.requestFullscreen();
    } catch {
      atlas.classList.add('is-full');
    }
    showFull();
    fullButton.focus();
  });
  document.addEventListener('fullscreenchange', showFull);
  // Share (owner, October 14, 2026): the device's share sheet where there is one, else the link goes to the clipboard.
  // The button by the key findings shares the site, the one under the map the map with its state (#TX), the one by the
  // seat counts of chapter 02 the chosen row and vote share (?count=neutral&vote=49.2#outcomes). No outside services.
  async function share(url) {
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      const note = document.createElement('p');
      note.className = 'share-note';
      note.setAttribute('role', 'status');
      note.textContent = 'Link copied';
      (document.fullscreenElement || document.body).append(note);
      setTimeout(() => note.remove(), 2000);
    } catch { /* the reader closed the share sheet */ }
  }
  // the links name the site's own address, also when the page runs elsewhere (SITE_URL in hash.js)
  $('share-site').addEventListener('click', () => share(SITE_URL));
  $('map-share').addEventListener('click', () => share(`${SITE_URL}${linkFor(ui.selected, '')}`));
  $('outcomes-share').addEventListener('click', () => {
    const { key, index } = outcomes.state();
    share(`${SITE_URL}${outcomesLink(key, outcomesData.points[index].share)}`);
  });

  const decide = decideView(results);
  renderDecide(decide);
  // the Senate block follows the vote slider of chapter 01 (owner, October 13, 2026)
  let senatePoint = outcomesData.points[outcomesData.baseIndex];
  showSenate(decide, senatePoint);
  outcomes.onPoint((index) => { senatePoint = outcomesData.points[index]; showSenate(decide, senatePoint); });
  if (shared) { // after the Senate hook, so the Senate block follows the shared vote share
    if (shared.key) outcomes.select(shared.key);
    outcomes.moveTo(shared.index ?? outcomesData.baseIndex); // a moved slider shows no stars for changed seats
  }
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
    renderDecide(decide);
    showSenate(decide, senatePoint);
    drawFigure();
    if (at >= 0) focusable()[at]?.focus({ preventScroll: true });
  });

  const start = stateFromHash(location.hash, results.states, index.single);
  select(start, { animate: false, announce: false });
  // The browser jumped to a chapter such as #method before the chapters above it were filled in;
  // now that they are, jump again (and open the method for #method).
  const anchor = !start && location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (anchor) {
    if (anchor === $('method')) details.open = true;
    anchor.scrollIntoView();
  }
}

main();
