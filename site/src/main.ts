// Entry point: loads data/results.json and data/map.topojson, then wires the key findings, chapter 01, chapter 02 (the map
// and the sheet beside it, app/atlas.ts), chapter 03 and the figure in the method (chapter 04).
// Vite bundles d3, topojson-client and the styles into the page; the page requests only its two data files.
import './styles/index.css';
import { stateFromHash, outcomesLink, outcomesFromSearch, SITE_URL } from './lib/hash.ts';
import { indexResults, nationalView, methodFills } from './lib/model.ts';
import { extensionFills } from './lib/extensions.ts';
import { outcomesView, decideView, keyFindings } from './lib/chapters.ts';
import { nationalSeatDomain } from './lib/axes.ts';
import type { Palette } from './types.ts';
import { loadData } from './app/data.ts';
import { createAtlas } from './app/atlas.ts';
import { byId as $, node } from './ui/dom.ts';
import { paletteColors } from './ui/palette.ts';
import { renderOutcomes } from './ui/outcomes.ts';
import { createTour } from './ui/tour.ts';
import { renderDecide, showSenate } from './ui/decide.ts';
import { drawSeatAxis } from './ui/charts.ts';
import { share } from './ui/share.ts';
import { mountGraphics } from './ui/graphics.ts';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
const lessMotion = () => reduceMotion.matches;

async function main() {
  const data = await loadData($('load-error'));
  if (!data) return;
  const { results, topology } = data;

  const index = indexResults(results);
  let palette: Palette = 'party';
  let colors = paletteColors(palette);
  const outcomesData = outcomesView(results);
  // the answer under the question in the masthead
  $('keyfacts').replaceChildren(...keyFindings(results).map((text) => node('li', {}, text)));
  const outcomes = renderOutcomes(outcomesData, { reduceMotion: lessMotion });
  // a link from the share button of chapter 01 sets its row and vote share; the explainer then waits for Play
  const shared = outcomesFromSearch(location.search, outcomesData.rows.map((row) => row.key), outcomesData.points.map((p) => p.share));
  createTour(outcomesData.tour, outcomes, { reduceMotion: lessMotion, hold: Boolean(shared) });
  outcomes.paint(colors);
  // the images under "Graphics to reuse", at the 2016 and 2020 votes whatever the slider shows
  const graphics = mountGraphics(results, outcomesData, palette);

  const atlas = createAtlas({ results, topology, index, colors, reduceMotion: lessMotion });

  // Chapter 04: the national seat axis as a figure in the method, drawn once the method is open
  // (a closed <details> has no width to draw in), and again at a new width.
  const national = nationalView(results);
  const details = $<HTMLDetailsElement>('method-details');
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
      atlas.select(''); // back from #TX to #method shows the whole map, as the same link does in a new tab
      return;
    }
    atlas.select(postal);
    if (postal) atlas.reveal(); // a state typed into the address; back and forward within chapter 02 do not jump
  }
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);

  const setPalette = (next: Palette) => {
    palette = next;
    colors = paletteColors(palette);
    outcomes.paint(colors);
    atlas.repaint(colors);
    graphics.palette(palette);
  };
  const PALETTES: Palette[] = ['party', 'neutral'];
  for (const choice of PALETTES) {
    $(`palette-${choice}`).addEventListener('click', () => {
      for (const other of PALETTES) $(`palette-${other}`).setAttribute('aria-pressed', String(other === choice));
      setPalette(choice);
    });
  }
  darkMode.addEventListener('change', () => setPalette(palette));

  // Share: the button by the key findings shares the site, the one by the seat counts of
  // chapter 01 the chosen row and vote share (?count=neutral&vote=49.2#outcomes); the one under the map is in
  // app/atlas.ts. The links name the site's own address, also when the page runs elsewhere (SITE_URL in lib/hash.ts).
  $('share-site').addEventListener('click', () => share(SITE_URL));
  $('outcomes-share').addEventListener('click', () => {
    const { key, index: at } = outcomes.state();
    share(`${SITE_URL}${outcomesLink(key, outcomesData.points[at].share)}`);
  });

  const decide = decideView(results);
  renderDecide(decide);
  // the Senate block follows the vote slider of chapter 01
  let senatePoint = outcomesData.points[outcomesData.baseIndex];
  showSenate(decide, senatePoint);
  outcomes.onPoint((at) => { senatePoint = outcomesData.points[at]; showSenate(decide, senatePoint); });
  if (shared) { // after the Senate hook, so the Senate block follows the shared vote share
    if (shared.key) outcomes.select(shared.key);
    outcomes.moveTo(shared.index ?? outcomesData.baseIndex); // a moved slider shows no stars for changed seats
    // once chapter 01 shows another row or vote share, by the reader or by the explainer, the address no longer
    // claims the shared ones
    const sharedKey = outcomes.state().key;
    const sharedIndex = outcomes.state().index;
    const leave = () => {
      const now = outcomes.state();
      if (now.key === sharedKey && now.index === sharedIndex) return;
      const query = new URLSearchParams(location.search);
      if (!query.has('count') && !query.has('vote')) return;
      query.delete('count');
      query.delete('vote');
      history.replaceState(history.state, '', `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}`);
    };
    outcomes.onUser(() => queueMicrotask(leave)); // after the click has chosen its row
    outcomes.onPoint(leave);
  }
  const fills: Record<string, string> = { ...methodFills(results), ...extensionFills(results) };
  for (const el of document.querySelectorAll<HTMLElement>('[data-fill]')) {
    const key = el.dataset.fill ?? '';
    if (Object.hasOwn(fills, key)) el.textContent = fills[key];
  }

  // Charts size themselves to their box; draw them again when the width changes, keeping keyboard focus.
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === width) return; // phones change only the height while scrolling
    width = window.innerWidth;
    const focusable = () => [...$('sheet').querySelectorAll<HTMLElement>('button, summary, a[href], [tabindex]')];
    const at = focusable().indexOf(document.activeElement as HTMLElement);
    atlas.renderSheet();
    renderDecide(decide);
    showSenate(decide, senatePoint);
    drawFigure();
    if (at >= 0) focusable()[at]?.focus({ preventScroll: true });
  });

  const start = stateFromHash(location.hash, results.states, index.single);
  atlas.select(start, { animate: false, announce: false });
  // a link to a state (#TX) opens on that state, not at the top of the page; a reload keeps the reader's place
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (start && navigation?.type !== 'reload') atlas.reveal();
  // The browser jumped to a chapter such as #method before the chapters above it were filled in;
  // now that they are, jump again (and open the method for #method).
  const anchor = !start && location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (anchor) {
    if (anchor === $('method')) details.open = true;
    // on a phone a shared vote share shows below the chapter head; such a link starts at the House and its counts
    const moved = anchor === $('outcomes') && shared?.index != null && shared.index !== outcomesData.baseIndex;
    const house = moved && window.innerWidth < 768 ? document.querySelector('#outcomes .whead') : null;
    (house ?? anchor).scrollIntoView();
  }
}

main();
