// The map: three views, zoom, tooltips and the tap line (site design, chapter 4, the update of
// October 7, 2026, and the close races of October 8). Ctrl or Cmd plus scroll zooms, a plain scroll scrolls the
// page, and in full screen from 900px, where the map and the record fill the window side by side, zooms too; on a
// touch screen two fingers zoom and move, one finger scrolls the page.
import { MAP, fitTransform, type Extent } from '../lib/axes.ts';
import { cartogram, fitOf, fitPoints, pathOf, realOutlines, ringsOf, type Point } from '../lib/cartogram.ts';
import { shareStops, shareTicks, effectBoxes } from '../lib/colors.ts';
import { districtTip, stateTip, closeTip, tapLine, isClose, LEGEND_TEXT, SINGLE_SEAT_PARTY } from '../lib/model.ts';
import { geoAlbersUsa, geoPath, select, zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type GeoProjection } from 'd3';
import { feature as topoFeature, mesh as topoMesh } from 'topojson-client';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { DistrictProps, MapTopology, MapView, Postal, StateProps } from '../types.ts';
import type { Colors } from '../lib/colors.ts';
import type { CloseLegend, Index, MapHints } from '../lib/model.ts';
import { node } from './dom.ts';

const ZOOM_MS = 650;
const ALWAYS_OUTLINED = new Set(['TX', 'CA']); // the Gerrygram shows their real size also on the whole map

type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictProps>;
type StateFeature = Feature<Polygon | MultiPolygon, StateProps>;
interface TipContent { title: string; lines: string[] }

export interface MapOptions {
  /** the map (viewBox 0 0 975 610) */
  svg: SVGSVGElement;
  /** the box around the map, for the place of the tooltip */
  box: HTMLElement;
  tip: HTMLElement;
  /** the line under the map */
  tapline: HTMLElement;
  /** the message over the map */
  gesture: HTMLElement;
  index: Index;
  topology: MapTopology;
  hints: MapHints;
  /** called for a state, also one with a single seat (redesign, open point 6) */
  onSelect: (postal: Postal) => void;
  reduceMotion: () => boolean;
}

export type MapControl = ReturnType<typeof createMap>;

export function createMap({ svg, box, tip, tapline, gesture, index, topology, hints, onSelect, reduceMotion }: MapOptions) {
  const statesGeo = topoFeature(topology, topology.objects.states) as unknown as { features: StateFeature[] };
  const districtsGeo = topoFeature(topology, topology.objects.districts) as unknown as { features: DistrictFeature[] };
  const projection = geoAlbersUsa().fitExtent([[8, 8], [MAP.width - 8, MAP.height - 8]], { type: 'FeatureCollection', features: statesGeo.features });
  const path = geoPath(projection);
  const gerry = gerrygram(topology, projection, index);
  const root = select(svg);
  root.append('rect').attr('class', 'bg').attr('width', MAP.width).attr('height', MAP.height);
  const layer = root.append('g');
  const districtLayer = layer.append('g');
  const stateLayer = layer.append('g');
  const borderLayer = layer.append('g');
  // the outline of the district under the mouse in the view 'close', over the state lines and the coast
  const hoverLine = layer.append('path').attr('class', 'hoverline').attr('display', 'none');
  let view: MapView = 'states';

  function showTip(event: PointerEvent, content: TipContent) {
    tip.replaceChildren(node('b', {}, content.title), ...content.lines.map((line) => node('span', {}, line)));
    tip.hidden = false;
    const frame = box.getBoundingClientRect();
    let x = event.clientX - frame.left + 12;
    const y = event.clientY - frame.top + 12;
    if (x + tip.offsetWidth > frame.width) x = Math.max(4, event.clientX - frame.left - tip.offsetWidth - 12);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  // The state the tap line speaks of; another state or another view clears the line (paint).
  let tapped: Postal | null = null;
  function choose(postal: Postal, districtId: string | null) {
    tapline.textContent = tapLine(index, districtId ?? '', postal, view);
    tapped = postal;
    // outline the district the line names, so it can be found again after the map zooms to its state
    districts.classed('picked', (f) => f.properties.id === districtId);
    districts.filter('.picked').raise();
    if (index.states[postal] || index.single[postal]) onSelect(postal);
  }

  // Tooltips only for a mouse; a tap gets the tap line instead (choose). In the view 'close' the district under the
  // mouse is outlined, so a close one stands out from its neighbors.
  let hovered: string | null = null;
  const unhover = () => { hovered = null; hoverLine.attr('display', 'none'); };
  const districts = districtLayer.selectAll<SVGPathElement, DistrictFeature>('path').data(districtsGeo.features).join('path')
    .attr('class', 'district').attr('d', path)
    .on('pointermove', (event: PointerEvent, f) => {
      if (event.pointerType !== 'mouse') return;
      showTip(event, (view === 'close' ? closeTip : districtTip)(index, f.properties.id, f.properties.state));
      if (view === 'close' && f.properties.id !== hovered) {
        hovered = f.properties.id;
        hoverLine.attr('d', path(f)).attr('display', null);
      }
    })
    .on('pointerleave', () => { hideTip(); unhover(); })
    .on('click', (_event, f) => choose(f.properties.state, f.properties.id));
  const states = stateLayer.selectAll<SVGPathElement, StateFeature>('path').data(statesGeo.features).join('path')
    .attr('class', 'statefill').attr('d', path)
    .on('pointermove', (event: PointerEvent, f) => { if (event.pointerType === 'mouse') showTip(event, stateTip(index, f.properties.postal)); })
    .on('pointerleave', hideTip)
    .on('click', (_event, f) => choose(f.properties.postal, null));
  const borders = borderLayer.selectAll<SVGPathElement, StateFeature>('path').data(statesGeo.features).join('path')
    .attr('class', 'state').attr('d', path);
  // the edge of the country, where a state borders on no other state
  const realCoast = path(topoMesh(topology as never, topology.objects.states as never, (a, b) => a === b));
  const coast = borderLayer.append('path').attr('class', 'coast').attr('d', realCoast);
  // in the Gerrygram the real size of a state as a dashed line: always for Texas and California, and for the chosen state
  const outlines = layer.insert('g', '.hoverline').selectAll<SVGPathElement, StateFeature>('path.realsize').data(statesGeo.features).join('path')
    .attr('class', 'realsize').attr('d', (f) => gerry.outlines[f.properties.postal])
    .classed('pale', (f) => !index.states[f.properties.postal]?.effects.drawing).attr('display', 'none');
  // the view 'states' draws the states, their lines and the coast as the Gerrygram, the district views as they are
  let shapes: 'real' | 'gerry' = 'real';
  function reshape(next: 'real' | 'gerry') {
    if (next === shapes) return;
    shapes = next;
    const d = (f: StateFeature) => (next === 'gerry' ? gerry.paths[f.properties.postal] : path(f));
    states.attr('d', d);
    borders.attr('d', d);
    coast.attr('d', next === 'gerry' ? gerry.coast : realCoast);
  }
  // Zoom: wheel with Ctrl or Cmd, or plain in the wide full screen, touch only with two fingers, drag with the mouse.
  // The wheel delta is d3's, clamped to [-1, 1]: d3 multiplies it by 10 while Ctrl is held, which would make
  // one notch zoom 4x. A notch zooms at most 2x; a trackpad pinch (many small events) is as in d3.
  const wide = window.matchMedia('(min-width: 900px)');
  const full = () => wide.matches && (Boolean(document.fullscreenElement?.contains(svg)) || svg.closest('.atlas.is-full') !== null);
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, MAP.maxZoom])
    .translateExtent([[0, 0], [MAP.width, MAP.height]])
    .wheelDelta((e) => Math.max(-1, Math.min(1, -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * (e.ctrlKey ? 10 : 1))))
    .filter((event) => {
      if (event.type === 'wheel') return event.ctrlKey || event.metaKey || full();
      if (event.type === 'touchstart') return event.touches.length > 1;
      return !event.button;
    })
    .on('start', (event) => { if (event.sourceEvent && event.sourceEvent.type === 'mousedown') svg.classList.add('dragging'); })
    .on('end', () => svg.classList.remove('dragging'))
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => { layer.attr('transform', event.transform.toString()); });
  root.call(zoom).on('dblclick.zoom', null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  function flash(message: string) {
    gesture.textContent = message;
    gesture.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { gesture.hidden = true; }, 1300);
  }
  // Ctrl or Cmd + wheel stays with the map, also at the zoom limits, where d3 lets it through to the page zoom.
  svg.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey || full()) event.preventDefault();
    else flash(hints.wheel);
  }, { passive: false });
  let start: number | null = null;
  svg.addEventListener('touchstart', (event) => { start = event.touches.length === 1 ? event.touches[0].clientX : null; }, { passive: true });
  svg.addEventListener('touchmove', (event) => {
    if (start !== null && event.touches.length === 1 && Math.abs(event.touches[0].clientX - start) > 12) {
      flash(hints.touch);
      start = null;
    }
  }, { passive: true });

  const move = (animate: boolean) => root.transition().duration(animate && !reduceMotion() ? ZOOM_MS : 0);
  return {
    /**
     * Fill the districts or the states with the current colors and outline the chosen state. In the view 'close' a
     * close district goes from the purple of a tie toward the party ahead, and every other district takes a pale tint
     * of its party.
     */
    paint(colors: Colors, nextView: MapView, selected: Postal) {
      if (nextView !== view) { hideTip(); unhover(); } // a tooltip of the old view would stay until the mouse moves
      if (nextView !== view || selected !== tapped) {
        tapline.textContent = '';
        tapped = null;
        districts.classed('picked', false);
      }
      view = nextView;
      reshape(view === 'states' ? 'gerry' : 'real');
      const close = view === 'close';
      const fill = (id: string) => {
        const share = index.shareOf[id];
        if (!close) return colors.share(share);
        return isClose(share) ? colors.close(share) : colors.faint(share > 0.5);
      };
      // in the view 'close' the six single-seat states take a pale tint of their party: each lies more than 10 points apart
      const single = (postal: Postal) => (close ? colors.faint(SINGLE_SEAT_PARTY[postal] === 'D') : colors.blank);
      districts.attr('fill', (f) => (index.single[f.properties.state] ? single(f.properties.state) : fill(f.properties.id)))
        .classed('quiet', (f) => close && (Boolean(index.single[f.properties.state]) || !isClose(index.shareOf[f.properties.id])));
      root.classed('calm', close);
      root.classed('drawing', view === 'states'); // gray state lines in the view of the drawing effect (styles/map.css)
      states.attr('fill', (f) => (index.single[f.properties.postal] ? colors.blank : colors.effect(index.states[f.properties.postal].effects.drawing)));
      districtLayer.attr('display', view === 'states' ? 'none' : null);
      stateLayer.attr('display', view === 'states' ? null : 'none');
      coast.raise(); // over every plain state line, which would hide it; under the outline of the chosen state
      borders.classed('on', (f) => f.properties.postal === selected);
      borders.filter((f) => f.properties.postal === selected).raise();
      outlines.attr('display', (f) => (view === 'states' && (ALWAYS_OUTLINED.has(f.properties.postal) || f.properties.postal === selected) ? null : 'none'));
    },
    /** Zoom to a state, or back to the whole map for "". */
    zoomTo(postal: Postal, animate: boolean) {
      hideTip(); // the map moves away under the pointer
      const feature = statesGeo.features.find((f) => f.properties.postal === postal);
      if (!feature) {
        move(animate).call(zoom.transform, zoomIdentity);
        return;
      }
      const t = fitTransform(shapes === 'gerry' ? gerry.bounds[postal] : path.bounds(feature));
      move(animate).call(zoom.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
    },
    zoomBy(factor: number) {
      move(true).call(zoom.scaleBy, factor);
    },
  };
}

/**
 * The Gerrygram in map coordinates (lib/cartogram.ts): the path of each state, the coast (the arcs only one state
 * uses) and each state's bounds for the zoom, all fitted into the map like the real states.
 */
function gerrygram(topology: MapTopology, projection: GeoProjection, index: Index) {
  const { scale: [sx, sy], translate: [tx, ty] } = topology.transform!;
  const projected = topology.arcs.map((arc) => {
    let x = 0; let y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return projection([x * sx + tx, y * sy + ty]); })
      .filter((p): p is Point => p !== null);
  });
  const geometries = topology.objects.states.geometries as unknown as { type: string; arcs: number[][] | number[][][]; properties: StateProps }[];
  const polygonsOf = (g: (typeof geometries)[number]) => (g.type === 'Polygon' ? [g.arcs as number[][]] : (g.arcs as number[][][]));
  const states = geometries.map((g) => {
    const postal = g.properties.postal;
    return { postal, polygons: polygonsOf(g), shift: index.states[postal]?.effects.drawing ?? 0, fixed: postal === 'AK' || postal === 'HI' };
  });
  const box: [Point, Point] = [[8, 8], [MAP.width - 8, MAP.height - 8]];
  const grown = cartogram(projected, states);
  const fit = fitOf(grown, box);
  const arcs = fitPoints(grown, box, fit);
  const real = fitPoints(projected, box, fit); // the real states at the scale of the Gerrygram
  const paths: Record<string, string> = {};
  const outlines: Record<string, string> = {};
  const bounds: Record<string, Extent> = {};
  const uses = new Map<number, number>();
  for (const s of states) {
    const rings = ringsOf(s.polygons, arcs);
    paths[s.postal] = pathOf(rings);
    outlines[s.postal] = pathOf(realOutlines(real, arcs, s.polygons));
    const points = rings.flat(2);
    bounds[s.postal] = [[Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))],
      [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))]];
    for (const i of s.polygons.flat(2)) { const a = i >= 0 ? i : ~i; uses.set(a, (uses.get(a) ?? 0) + 1); }
  }
  const coast = [...uses].filter(([i, n]) => n === 1 && arcs[i].length > 1)
    .map(([i]) => `M${arcs[i].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}`).join('');
  return { paths, outlines, bounds, coast };
}

/** The legend under the map for the current view (site design, chapter 3). */
export function drawLegend(el: HTMLElement, view: MapView, colors: Colors, close: CloseLegend) {
  const legend = select(el).html('');
  const width = 260;
  if (view === 'close') {
    // the close districts on a bar from 45% to 55%, purple in the middle; then the pale rest in both tints, half and
    // half, and the counts
    const { bar } = close;
    const svg = legend.append('svg').attr('viewBox', `0 0 ${width} 44`).attr('aria-hidden', 'true');
    const gradient = svg.append('defs').append('linearGradient').attr('id', 'legend-close');
    for (let i = 0; i <= 20; i += 1) {
      gradient.append('stop').attr('offset', i / 20).attr('stop-color', colors.close(bar.from + ((bar.to - bar.from) * i) / 20));
    }
    svg.append('rect').attr('x', 10).attr('y', 4).attr('width', width - 20).attr('height', 12).attr('fill', 'url(#legend-close)');
    for (const tick of bar.ticks) {
      const x = 10 + ((tick.value - bar.from) / (bar.to - bar.from)) * (width - 20);
      svg.append('text').attr('x', x).attr('y', 28).attr('text-anchor', 'middle').text(tick.label);
    }
    svg.append('text').attr('x', 10).attr('y', 41).text(bar.low);
    svg.append('text').attr('x', width - 10).attr('y', 41).attr('text-anchor', 'end').text(bar.high);
    for (const item of close.items) {
      const span = legend.append('span').attr('class', 'item');
      span.append('i').attr('class', 'sw pale').attr('aria-hidden', 'true')
        .style('background', `linear-gradient(90deg, ${colors.faint(false)} 50%, ${colors.faint(true)} 50%)`);
      span.append('span').text(item.text);
    }
    legend.append('span').attr('class', 'note').text(close.note);
    return;
  }
  const svg = legend.append('svg').attr('viewBox', `0 0 ${width} 44`).attr('aria-hidden', 'true');
  if (view === 'districts') {
    const gradient = svg.append('defs').append('linearGradient').attr('id', 'legend-share');
    for (const stop of shareStops()) gradient.append('stop').attr('offset', stop.offset).attr('stop-color', colors.share(stop.value));
    svg.append('rect').attr('x', 10).attr('y', 4).attr('width', width - 20).attr('height', 12).attr('fill', 'url(#legend-share)');
    for (const tick of shareTicks()) {
      svg.append('text').attr('x', 10 + tick.offset * (width - 20)).attr('y', 28).attr('text-anchor', 'middle').text(tick.label);
    }
    svg.append('text').attr('x', 10).attr('y', 41).text(LEGEND_TEXT.low);
    svg.append('text').attr('x', width - 10).attr('y', 41).attr('text-anchor', 'end').text(LEGEND_TEXT.high);
  } else {
    const boxes = effectBoxes();
    const step = (width - 20) / boxes.length;
    boxes.forEach((b, i) => {
      svg.append('rect').attr('x', 10 + i * step).attr('y', 4).attr('width', step - 1).attr('height', 12).attr('fill', colors.effect(b.value));
      if (b.label) svg.append('text').attr('x', 10 + i * step + step / 2).attr('y', 28).attr('text-anchor', 'middle').text(b.label);
    });
  }
  const blank = legend.append('span').attr('class', 'item');
  blank.append('i').attr('class', 'sw pale').attr('aria-hidden', 'true').style('background', colors.blank);
  blank.append('span').text(LEGEND_TEXT.blank);
  if (view === 'states') legend.append('span').attr('class', 'note').text(LEGEND_TEXT.cartogram);
}
