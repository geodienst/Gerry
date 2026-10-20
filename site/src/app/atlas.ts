// Chapter 02, "State by state": the map with its three views, the State menu, the zoom bar, full screen, and the
// column beside the map. Without a state the column follows the view of the map; with a state it holds the state's
// record, split over the column and a strip under the map in full screen from 900px.
import { SITE_URL, linkFor } from '../lib/hash.ts';
import {
  MAP_TITLES, closeDistricts, closeLegend, districtShares, effectList, mapHints, stateOptions,
} from '../lib/model.ts';
import { recordView, singleSeatView } from '../lib/chapters.ts';
import type { MapTopology, MapView, Postal, Results } from '../types.ts';
import { byId as $ } from '../ui/dom.ts';
import { createFullScreen } from '../ui/fullscreen.ts';
import { createMap, drawLegend } from '../ui/map.ts';
import { share } from '../ui/share.ts';
import { renderClose, renderDistricts, renderList, renderSingle, renderState, renderStateFull } from '../ui/sheet.ts';
import type { Colors } from '../lib/colors.ts';
import type { Index } from '../lib/model.ts';

const VIEWS: MapView[] = ['districts', 'states', 'close'];

export interface SelectOptions {
  /** add the state to the browser history (#TX) */
  push?: boolean;
  /** move the focus to the heading of the column */
  focus?: boolean;
  animate?: boolean;
  /** let a screen reader hear the new heading */
  announce?: boolean;
}

export interface AtlasOptions {
  results: Results;
  topology: MapTopology;
  index: Index;
  colors: Colors;
  reduceMotion: () => boolean;
}

export type Atlas = ReturnType<typeof createAtlas>;

export function createAtlas({ results, topology, index, colors: initialColors, reduceMotion }: AtlasOptions) {
  const ui: { view: MapView; selected: Postal; zerosOpen: boolean } = { view: 'districts', selected: '', zerosOpen: false };
  let colors = initialColors;
  const sheet = $('sheet');
  const hints = mapHints({
    touch: window.matchMedia('(pointer: coarse)').matches,
    mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
  });
  const effects = effectList(results);
  const onRow = (postal: Postal) => select(postal, { push: true, focus: true });

  const map = createMap({
    svg: $<SVGSVGElement>('map'), box: $('mapbox'), tip: $('tip'), tapline: $('tapline'), gesture: $('gesture'),
    index, topology, hints,
    onSelect: (postal) => select(postal, { push: true }),
    reduceMotion,
  });

  const pick = $<HTMLSelectElement>('pick');
  for (const option of stateOptions(results, { single: true })) pick.append(new Option(option.label, option.postal));
  pick.addEventListener('change', () => select(pick.value, { push: true }));

  const atlas = document.querySelector<HTMLElement>('.atlas')!; // the map, the block under it and the sheet beside it
  const fullButton = $<HTMLButtonElement>('map-full');
  const full = createFullScreen(atlas, fullButton, () => renderSheet());
  const split = () => full.isFull() && window.innerWidth >= 900;

  function renderSheet() {
    const more = $('sheet-more');
    const apart = Boolean(split() && ui.selected && !index.single[ui.selected]);
    if (!apart) more.replaceChildren();
    more.hidden = !apart;
    atlas.classList.toggle('has-more', apart);
    atlas.classList.remove('long');
    const record = () => recordView(results, ui.selected);
    if (index.single[ui.selected]) renderSingle(sheet, singleSeatView(results, ui.selected), back);
    else if (ui.selected && apart) renderStateFull(sheet, more, record(), colors, back);
    else if (ui.selected) renderState(sheet, record(), colors, back);
    else if (ui.view === 'districts') renderDistricts(sheet, districtShares(results), effects, colors);
    else if (ui.view === 'close') renderClose(sheet, closeDistricts(results), effects, colors, onRow);
    else renderList(sheet, effects, colors, onRow, ui);
    // The strip runs on under the record when the record fits above it; a longer record takes the whole height and
    // the strip stays under the map.
    if (apart) atlas.classList.toggle('long', sheet.scrollHeight > sheet.clientHeight + 2);
  }

  function paint() {
    map.paint(colors, ui.view, ui.selected);
    $('map-title').textContent = MAP_TITLES[ui.view];
    drawLegend($('legend'), ui.view, colors, closeLegend(results));
    renderSheet();
  }

  /** Choose a state ("" for the whole map): sheet, outline, zoom and the link (#TX). */
  function select(postal: Postal, { push = false, focus = false, animate = true, announce = !focus }: SelectOptions = {}) {
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
    const row = sheet.querySelector<HTMLElement>(`.row[data-postal="${previous}"]`);
    row?.focus(); // a row inside the folded line cannot take focus
    if (!row || document.activeElement !== row) $('sheet-title').focus();
  }

  // Escape acts from the sheet or the map, or with nothing focused while one of them is in view;
  // not from the State menu, from text elsewhere on the page, or while reading further down.
  const inView = (el: Element) => { const box = el.getBoundingClientRect(); return box.bottom > 0 && box.top < window.innerHeight; };
  document.addEventListener('keydown', (event) => {
    // the map covering the window goes back first; the browser's own full screen handles Escape itself
    if (event.key === 'Escape' && full.covers()) { full.leave(); fullButton.focus(); return; }
    const from = event.target as Node;
    const inside = sheet.contains(from) || $('mapbox').contains(from);
    const idle = from === document.body && (inView(sheet) || inView($('mapbox')));
    if (event.key === 'Escape' && ui.selected && (inside || idle)) back();
  });

  for (const view of VIEWS) {
    $(`view-${view}`).addEventListener('click', () => {
      ui.view = view;
      for (const other of VIEWS) $(`view-${other}`).setAttribute('aria-pressed', String(other === view));
      paint();
    });
  }
  $('zoom-in').addEventListener('click', () => map.zoomBy(1.8));
  $('zoom-out').addEventListener('click', () => map.zoomBy(1 / 1.8));
  $('zoom-reset').addEventListener('click', () => { select('', { push: true }); map.zoomTo('', true); });
  // the button under the map shares the map with its state (#TX), under the site's own address (SITE_URL in lib/hash.ts)
  $('map-share').addEventListener('click', () => share(`${SITE_URL}${linkFor(ui.selected, '')}`));

  return {
    select,
    /** Lay out the column again, as after a resize. */
    renderSheet,
    /** New colors after a palette or theme change. */
    repaint(next: Colors) {
      colors = next;
      paint();
    },
  };
}
