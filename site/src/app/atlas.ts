// Chapter 02, "State by state": the map with its three views, the State menu, the zoom bar, full screen, and the
// column beside the map. Without a state the column follows the view of the map; with a state it holds the state's
// record, split over the column and a strip under the map in full screen from 900px. Share at the top right of the
// column opens a panel with the image of the state on screen, or of all states, its link, text and data.
import { SITE_URL, linkFor } from '../lib/hash.ts';
import {
  MAP_TITLES, closeDistricts, closeLegend, districtShares, effectList, mapHints, stateOptions,
} from '../lib/model.ts';
import { recordView, singleSeatView } from '../lib/chapters.ts';
import { stateCsv, statesCsv } from '../lib/csv.ts';
import { stateGraphic, statesMapGraphic } from '../lib/graphics.ts';
import type { MapTopology, MapView, Palette, Postal, Results } from '../types.ts';
import { byId as $ } from '../ui/dom.ts';
import { createFullScreen } from '../ui/fullscreen.ts';
import { drawState, drawStatesMap, lightColors } from '../ui/graphics.ts';
import type { DistrictShape, StateShape } from '../ui/graphics.ts';
import { createMap, drawLegend } from '../ui/map.ts';
import { createShareBox } from '../ui/sharebox.ts';
import { renderClose, renderDistricts, renderList, renderSingle, renderState, renderStateFull } from '../ui/sheet.ts';
import { feature as topoFeature } from 'topojson-client';
import type { Colors } from '../lib/colors.ts';
import type { OutcomesView } from '../lib/chapters.ts';
import type { Index } from '../lib/model.ts';

const VIEWS: MapView[] = ['districts', 'states', 'close'];
const OUTSET: Postal[] = ['AK', 'HI']; // the two states in an inset of the map

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
  /** chapter 01, for the votes at the foot of the images */
  view: OutcomesView;
  /** the colors chosen under the map, for the images */
  palette: () => Palette;
  reduceMotion: () => boolean;
}

export type Atlas = ReturnType<typeof createAtlas>;

export function createAtlas({ results, topology, index, colors: initialColors, view, palette, reduceMotion }: AtlasOptions) {
  const ui: { view: MapView; selected: Postal; zerosOpen: boolean } = { view: 'districts', selected: '', zerosOpen: false };
  let colors = initialColors;
  const sheet = $('sheet');
  const shareWrap = $('map-sharewrap'); // Share, put back at the top right of the sheet after each render
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
  // Arrow keys on a closed menu choose a state at each press; the menu then has to stay in view, so only a choice
  // made with a mouse or a finger brings the record up.
  let keyed = false;
  pick.addEventListener('keydown', () => { keyed = true; });
  pick.addEventListener('pointerdown', () => { keyed = false; });
  pick.addEventListener('blur', () => { keyed = false; });
  pick.addEventListener('change', () => {
    select(pick.value, { push: true });
    // on a phone the record lies under the map, below the screen; bring it up
    if (pick.value && window.innerWidth < 900 && !keyed) reveal(true);
  });

  /** Bring the chosen state into view: chapter 02 with the menu, the map and the record, on a phone the record itself. */
  function reveal(smooth = false) {
    const target = window.innerWidth < 900 ? sheet : $('states');
    target.scrollIntoView({ block: 'start', behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
  }

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
    sheet.prepend(shareWrap); // the sheet was emptied: Share goes back to its top right
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

  // Share: the image of the state on screen, or of all states on one map, with the link (#TX) under the site's own
  // address (SITE_URL in lib/hash.ts) and the data as CSV. Its Escape comes first and closes only the panel.
  const shapes = {
    states: (topoFeature(topology, topology.objects.states) as unknown as { features: StateShape[] }).features,
    districts: (topoFeature(topology, topology.objects.districts) as unknown as { features: DistrictShape[] }).features,
  };
  createShareBox({
    button: $<HTMLButtonElement>('map-share'),
    box: $<HTMLDialogElement>('map-sharebox'),
    draw: (canvas) => {
      const colors = lightColors(palette());
      const postal = ui.selected;
      if (!postal) {
        const g = statesMapGraphic(results, view);
        drawStatesMap(canvas, g, colors, {
          states: shapes.states,
          drawingOf: (p) => (index.single[p] ? null : index.states[p].effects.drawing),
        });
        return g;
      }
      const g = stateGraphic(results, view, postal);
      drawState(canvas, g, colors, {
        state: shapes.states.find((s) => s.properties.postal === postal)!,
        districts: shapes.districts.filter((d) => d.properties.state === postal),
        // the states around it, pale; Alaska and Hawaii sit in their own insets, so they are never around another state
        around: OUTSET.includes(postal) ? [] : shapes.states.filter((s) => s.properties.postal !== postal && !OUTSET.includes(s.properties.postal)),
        shareOf: index.shareOf,
      });
      return g;
    },
    link: () => `${SITE_URL}${linkFor(ui.selected, '')}`,
    data: () => (ui.selected ? stateCsv(results, ui.selected) : statesCsv(results)),
  });

  // Escape acts from the sheet or the map, or with nothing focused while one of them is in view;
  // not from the State menu, from text elsewhere on the page, or while reading further down.
  const inView = (el: Element) => { const box = el.getBoundingClientRect(); return box.bottom > 0 && box.top < window.innerHeight; };
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return; // the Share panel closed on this Escape
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

  return {
    select,
    /** Bring the chosen state into view unless the map or the record already is, as after a link to a state. */
    reveal() {
      if (!inView($('mapbox')) && !inView(sheet)) reveal();
    },
    /** Lay out the column again, as after a resize. */
    renderSheet,
    /** New colors after a palette or theme change. */
    repaint(next: Colors) {
      colors = next;
      paint();
    },
  };
}
