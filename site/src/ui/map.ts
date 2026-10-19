// The map: three views, zoom, tooltips and the tap line (site design, chapter 4, the update of
// October 7, 2026, and the close races of October 8). Ctrl or Cmd plus scroll zooms, a plain scroll scrolls the
// page; on a touch screen two fingers zoom and move, one finger scrolls the page.
import { MAP, fitTransform } from '../lib/axes.ts';
import { shareStops, shareTicks, effectBoxes } from '../lib/colors.ts';
import { districtTip, stateTip, closeTip, tapLine, isClose, isSwing, closeness, LEGEND_TEXT } from '../lib/model.ts';
import { geoAlbersUsa, geoPath, select, zoom as d3zoom, zoomIdentity, type D3ZoomEvent } from 'd3';
import { feature as topoFeature } from 'topojson-client';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { DistrictProps, MapTopology, MapView, Postal, StateProps } from '../types.ts';
import type { Colors } from '../lib/colors.ts';
import type { CloseLegend, Index, MapHints } from '../lib/model.ts';
import { node } from './dom.ts';

const ZOOM_MS = 650;

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
  const root = select(svg);
  root.append('rect').attr('class', 'bg').attr('width', MAP.width).attr('height', MAP.height);
  const layer = root.append('g');
  const districtLayer = layer.append('g');
  const stateLayer = layer.append('g');
  const borderLayer = layer.append('g');
  let view: MapView = 'districts';

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

  function choose(postal: Postal, districtId: string | null) {
    tapline.textContent = tapLine(index, districtId ?? '', postal, view);
    if (index.states[postal] || index.single[postal]) onSelect(postal);
  }

  // Tooltips only for a mouse; a tap gets the tap line instead (choose).
  const districts = districtLayer.selectAll<SVGPathElement, DistrictFeature>('path').data(districtsGeo.features).join('path')
    .attr('class', 'district').attr('d', path)
    .on('pointermove', (event: PointerEvent, f) => {
      if (event.pointerType !== 'mouse') return;
      showTip(event, (view === 'close' ? closeTip : districtTip)(index, f.properties.id, f.properties.state));
    })
    .on('pointerleave', hideTip)
    .on('click', (_event, f) => choose(f.properties.state, f.properties.id));
  const states = stateLayer.selectAll<SVGPathElement, StateFeature>('path').data(statesGeo.features).join('path')
    .attr('class', 'statefill').attr('d', path)
    .on('pointermove', (event: PointerEvent, f) => { if (event.pointerType === 'mouse') showTip(event, stateTip(index, f.properties.postal)); })
    .on('pointerleave', hideTip)
    .on('click', (_event, f) => choose(f.properties.postal, null));
  const borders = borderLayer.selectAll<SVGPathElement, StateFeature>('path').data(statesGeo.features).join('path')
    .attr('class', 'state').attr('d', path);
  // The view 'close': a ring on each district with a margin under 5 points, filled with the color of the party ahead;
  // thick under 2 points. The rings keep their size on screen while the map zooms.
  const DOT = { tight: 5, near: 3.6, ring: { tight: 1.8, near: 0.9 } };
  const dotLayer = layer.append('g').attr('class', 'dots').attr('display', 'none');
  // every district on this layer is close, so closeOf never gives null here
  const closeOf = (f: DistrictFeature) => closeness(index.shareOf[f.properties.id]) as 'tight' | 'near';
  const dots = dotLayer.selectAll<SVGCircleElement, DistrictFeature>('circle')
    .data(districtsGeo.features.filter((f) => !index.single[f.properties.state] && closeness(index.shareOf[f.properties.id])))
    .join('circle')
    .attr('class', closeOf)
    .attr('cx', (f) => path.centroid(f)[0]).attr('cy', (f) => path.centroid(f)[1]);
  const sizeDots = (k: number) => dots.attr('r', (f) => DOT[closeOf(f)] / k)
    .attr('stroke-width', (f) => DOT.ring[closeOf(f)] / k);
  sizeDots(1);

  // Zoom: wheel only with Ctrl or Cmd, touch only with two fingers, drag with the mouse.
  // The wheel delta is d3's, clamped to [-1, 1]: d3 multiplies it by 10 while Ctrl is held, which would make
  // one notch zoom 4x. A notch zooms at most 2x; a trackpad pinch (many small events) is as in d3.
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, MAP.maxZoom])
    .translateExtent([[0, 0], [MAP.width, MAP.height]])
    .wheelDelta((e) => Math.max(-1, Math.min(1, -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * (e.ctrlKey ? 10 : 1))))
    .filter((event) => {
      if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
      if (event.type === 'touchstart') return event.touches.length > 1;
      return !event.button;
    })
    .on('start', (event) => { if (event.sourceEvent && event.sourceEvent.type === 'mousedown') svg.classList.add('dragging'); })
    .on('end', () => svg.classList.remove('dragging'))
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => { layer.attr('transform', event.transform.toString()); sizeDots(event.transform.k); });
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
    if (event.ctrlKey || event.metaKey) event.preventDefault();
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
     * close district takes the full color of the party it leans to, every other district the pale midpoint, and the
     * swing states get a thick outline.
     */
    paint(colors: Colors, nextView: MapView, selected: Postal) {
      view = nextView;
      const close = view === 'close';
      const fill = (id: string) => {
        const share = index.shareOf[id];
        if (!close) return colors.share(share);
        return isClose(share) ? colors.party(share > 0.5) : colors.poles.mid;
      };
      // in the view 'close' everything that is not close, the single-seat states too, is the same pale gray
      districts.attr('fill', (f) => (index.single[f.properties.state] ? (close ? colors.poles.mid : colors.blank) : fill(f.properties.id)))
        .classed('quiet', (f) => close && (Boolean(index.single[f.properties.state]) || !isClose(index.shareOf[f.properties.id])));
      root.classed('calm', close);
      root.classed('drawing', view === 'states'); // gray state lines in the view of the drawing effect (styles/map.css)
      dotLayer.attr('display', close ? null : 'none');
      dots.attr('fill', (f) => colors.party(index.shareOf[f.properties.id] > 0.5));
      states.attr('fill', (f) => (index.single[f.properties.postal] ? colors.blank : colors.effect(index.states[f.properties.postal].effects.drawing)));
      districtLayer.attr('display', view === 'states' ? 'none' : null);
      stateLayer.attr('display', view === 'states' ? null : 'none');
      borders.classed('swing', (f) => view === 'close' && isSwing(index, f.properties.postal));
      borders.filter((f) => view === 'close' && isSwing(index, f.properties.postal)).raise();
      borders.classed('on', (f) => f.properties.postal === selected);
      borders.filter((f) => f.properties.postal === selected).raise();
    },
    /** Zoom to a state, or back to the whole map for "". */
    zoomTo(postal: Postal, animate: boolean) {
      const feature = statesGeo.features.find((f) => f.properties.postal === postal);
      if (!feature) {
        move(animate).call(zoom.transform, zoomIdentity);
        return;
      }
      const t = fitTransform(path.bounds(feature));
      move(animate).call(zoom.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
    },
    zoomBy(factor: number) {
      move(true).call(zoom.scaleBy, factor);
    },
  };
}

/** The legend under the map for the current view (site design, chapter 3). */
export function drawLegend(el: HTMLElement, view: MapView, colors: Colors, close: CloseLegend) {
  const legend = select(el).html('');
  if (view === 'close') {
    // close: { items: [{ key, text }], note } from closeLegend(results)
    const swatch: Record<string, string> = { d: colors.party(true), r: colors.party(false), other: colors.poles.mid };
    const kind: Record<string, string> = { swing: 'sw gold', tight: 'sw ring tight', near: 'sw ring near', other: 'sw pale' };
    for (const item of close.items) {
      const span = legend.append('span').attr('class', 'item');
      span.append('i').attr('class', kind[item.key] ?? 'sw').attr('aria-hidden', 'true')
        .style('background', swatch[item.key] ?? null);
      span.append('span').text(item.text);
    }
    legend.append('span').attr('class', 'note').text(close.note);
    return;
  }
  const width = 260;
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
}
