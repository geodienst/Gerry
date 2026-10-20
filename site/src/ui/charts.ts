// The charts (site design, chapter 5): the seat axis, the sorted districts and the net bar.
// Geometry comes from lib/axes.ts, numbers from lib/format.ts; this module only draws.
import {
  area, axisBottom, axisLeft, curveStep, line, max, range, scaleLinear, select, sum, type Selection,
} from 'd3';
import {
  BASE_FONT, SEAT_AXIS, LABEL_GAP, chartUnits, placeLabels, sortedDomain, netBar,
  DOT_ROWS, rowTextAnchor, markerSegments,
} from '../lib/axes.ts';
import { seats, percentLabel } from '../lib/format.ts';
import type { DotRowsSpec, SeatAxis } from '../lib/axes.ts';
import type { Sorted } from '../types.ts';
import type { Colors } from '../lib/colors.ts';
import type { DistrictShares, EffectList } from '../lib/model.ts';

type Svg = Selection<SVGSVGElement, unknown, null, undefined>;
type MarkKey = 'proportional' | 'neutral' | 'enacted' | 'base';
interface Mark { key: MarkKey; x: number; text: string }

/** The neutral distribution and the three counts on a seat axis. */

/** An empty svg in `el`, sized so that one viewBox unit is 1/15 rem; returns it with its width in units. */
function chartSvg(el: HTMLElement, maxUnits: number, height: number, label: string): { svg: Svg; width: number } {
  const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT;
  const width = chartUnits(el.getBoundingClientRect().width, rootPx, maxUnits);
  const svg = select(el).html('').append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`).style('max-width', `${width / BASE_FONT}rem`)
    .attr('class', 'chart').attr('role', 'img').attr('aria-label', label);
  return { svg, width };
}

/**
 * Markers with labels: Proportional dashed with a square, Neutral a solid line, Enacted a dot,
 * and "base", the actual vote on the vote axis (Task 6.10), a dotted line.
 */
function drawMarks(svg: Svg, marks: Mark[], width: number, plotBottom: number, top: number, rows: number) {
  const text = Object.fromEntries(marks.map((mark) => [mark.key, mark.text]));
  const placed = placeLabels(marks, width, LABEL_GAP, rows);
  const labelY = (p: { row: number }) => top - 6 - 12 * p.row; // row 0 right above the plot, each next row 12 units higher
  // Labels first, so their boxes are known; lines and symbols go in before the first label, under all of them.
  const labels = placed.map((p) => svg.append('text').attr('class', 'mark-label').attr('x', p.x).attr('y', labelY(p))
    .attr('text-anchor', p.anchor).text(text[p.key]).node() as SVGTextElement);
  const boxes = labels.map(labelBox);
  const under = () => labels[0];
  const dashes: Partial<Record<string, string>> = { proportional: '3 2', base: '1 2' };
  placed.forEach((p, i) => {
    const stroke = p.key === 'neutral' ? 2 : 1;
    // from its own label down to the plot, with a gap at each label of another marker in the way;
    // the edge of the stroke stays 3 units from a label box, 1.5 past its halo
    const pad = 3 + stroke / 2;
    for (const [from, to] of markerSegments(p.x, labelY(p) + 3, plotBottom, boxes.filter((box, j) => j !== i), pad)) {
      svg.insert('line', under).attr('x1', p.x).attr('x2', p.x).attr('y1', from).attr('y2', to)
        .attr('stroke', p.key === 'base' ? 'var(--muted)' : 'var(--fg)')
        .attr('stroke-width', stroke)
        .attr('stroke-dasharray', dashes[p.key] ?? null);
    }
    if (p.key === 'enacted') svg.insert('circle', under).attr('cx', p.x).attr('cy', plotBottom - 6).attr('r', 5).attr('fill', 'var(--fg)');
    if (p.key === 'proportional') {
      svg.insert('rect', under).attr('x', p.x - 4).attr('y', plotBottom - 10).attr('width', 8).attr('height', 8)
        .attr('fill', 'var(--sheet)').attr('stroke', 'var(--fg)');
    }
  });
}

/** A label's box in viewBox units; an empty box when the browser cannot measure it (a chart that is not displayed). */
function labelBox(node: SVGGraphicsElement) {
  try {
    const { x, y, width, height } = node.getBBox();
    return { x, y, width, height };
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/**
 * Seat axis: bars for the share of neutral plans per seat count, the 5th to 95th
 * percentile band, and the markers for Proportional, Neutral and Enacted.
 * @param domain whole seats shown, lo to hi
 * @param label text alternative
 * @param maxUnits widest chart in viewBox units
 */
export function drawSeatAxis(el: HTMLElement, axis: SeatAxis, [lo, hi]: readonly number[], label: string, maxUnits: number = SEAT_AXIS.width) {
  const { height: H, margin: m } = SEAT_AXIS;
  const { svg, width: W } = chartSvg(el, maxUnits, H, label);
  const x = scaleLinear().domain([lo - 0.5, hi + 0.5]).range([m.l, W - m.r]);
  const total = sum(axis.dist);
  const shown = axis.dist.slice(lo, hi + 1).map((n, i): [number, number] => [lo + i, n / total]);
  const y = scaleLinear().domain([0, max(shown, (d) => d[1]) || 1]).range([H - m.b, m.t + 8]);
  svg.append('rect').attr('x', x(axis.p5 - 0.5)).attr('y', m.t + 4)
    .attr('width', x(axis.p95 + 0.5) - x(axis.p5 - 0.5)).attr('height', H - m.b - m.t - 4).attr('fill', 'var(--band)');
  const barWidth = Math.max(1, Math.min(18, (x(1) - x(0)) * 0.8));
  svg.append('g').selectAll('rect').data(shown).join('rect').attr('class', 'bar')
    .attr('x', (d) => x(d[0]) - barWidth / 2).attr('width', barWidth)
    .attr('y', (d) => y(d[1])).attr('height', (d) => H - m.b - y(d[1]));
  const ticks = x.ticks(Math.min(10, hi - lo + 1, Math.floor(W / 40))).filter(Number.isInteger);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
    .call(axisBottom(x).tickValues(ticks).tickSize(3).tickFormat((d) => seats(Number(d))));
  drawMarks(svg, [
    { key: 'proportional', x: x(axis.proportional), text: `Proportional ${seats(axis.proportional)}` },
    { key: 'neutral', x: x(axis.median), text: `Neutral ${seats(axis.median)}` },
    { key: 'enacted', x: x(axis.enacted), text: `Enacted ${seats(axis.enacted)}` },
  ], W, H - m.b, m.t, 3);
}

/** Sorted districts: enacted shares as dots against the neutral band and median per position, a dashed line at 50%. */
export function drawSorted(el: HTMLElement, sorted: Sorted, colors: Colors, label: string) {
  const H = 190;
  const m = { l: 34, r: 10, t: 10, b: 24 };
  const { svg, width: W } = chartSvg(el, 560, H, label);
  const n = sorted.enacted.length;
  const x = scaleLinear().domain([0.5, n + 0.5]).range([m.l, W - m.r]);
  const y = scaleLinear().domain(sortedDomain(sorted)).range([H - m.b, m.t]);
  const index = range(n);
  const band = area<number>().x((i) => x(i + 1)).y0((i) => y(sorted.p5[i])).y1((i) => y(sorted.p95[i])).curve(curveStep);
  svg.append('path').attr('d', band(index)).attr('fill', 'var(--band)');
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0.5)).attr('y2', y(0.5))
    .attr('stroke', 'var(--muted)').attr('stroke-dasharray', '4 3');
  svg.append('text').attr('x', W - m.r).attr('y', y(0.5) - 4).attr('text-anchor', 'end').text(percentLabel(0.5));
  svg.append('path').attr('d', line<number>().x((i) => x(i + 1)).y((i) => y(sorted.p50[i])).curve(curveStep)(index))
    .attr('fill', 'none').attr('stroke', 'var(--muted)').attr('stroke-width', 1.5);
  svg.append('g').selectAll('circle').data(sorted.enacted).join('circle')
    .attr('cx', (v, i) => x(i + 1)).attr('cy', (v) => y(v)).attr('r', n > 30 ? 3 : 4)
    .attr('fill', (v) => colors.party(v > 0.5)).attr('stroke', 'var(--sheet)').attr('stroke-width', 1);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
    .call(axisLeft(y).ticks(5).tickSize(3).tickFormat((v) => percentLabel(Number(v))));
  svg.append('text').attr('x', m.l).attr('y', H - 6).text('Districts from lowest to highest Democratic share');
}

/** Districts by Democratic share in five-point bins: a bar per bin in the color of the party
 *  ahead, a dashed line at 50%, the count of each bin as its tooltip. */
export function drawShareBins(el: HTMLElement, bins: DistrictShares['bins'], colors: Colors, label: string) {
  const H = 150;
  const m = { l: 24, r: 6, t: 8, b: 20 };
  const { svg, width: W } = chartSvg(el, 360, H, label);
  const x = scaleLinear().domain([bins[0].lo, bins[bins.length - 1].hi]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, max(bins, (b) => b.n) ?? 0]).nice(4).range([H - m.b, m.t]);
  for (const v of y.ticks(4)) {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--rule)');
    svg.append('text').attr('x', m.l - 4).attr('y', y(v) + 3.5).attr('text-anchor', 'end').text(String(v));
  }
  svg.append('g').selectAll('rect').data(bins).join('rect')
    .attr('x', (b) => x(b.lo) + 1).attr('width', (b) => Math.max(1, x(b.hi) - x(b.lo) - 2))
    .attr('y', (b) => y(b.n)).attr('height', (b) => y(0) - y(b.n))
    .attr('fill', (b) => colors.party(b.dem))
    .append('title').text((b) => b.title);
  svg.append('line').attr('x1', x(0.5)).attr('x2', x(0.5)).attr('y1', m.t - 4).attr('y2', H - m.b)
    .attr('stroke', 'var(--fg)').attr('stroke-dasharray', '4 3');
  for (const v of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    if (v < bins[0].lo || v > bins[bins.length - 1].hi) continue;
    svg.append('text').attr('x', x(v)).attr('y', H - 5).attr('text-anchor', 'middle').text(percentLabel(v));
  }
}

/** Net bar under the list: seats toward Republicans to the left, toward Democrats to the right, a marker at the net. */
export function drawNetBar(el: HTMLElement, list: EffectList, colors: Colors) {
  const { svg, width: W } = chartSvg(el, 360, 38, list.bar.label);
  const bar = netBar(list.seatsR, list.seatsD, W);
  svg.append('rect').attr('x', bar.left.x).attr('y', 18).attr('width', bar.left.width).attr('height', 14).attr('fill', colors.party(false));
  svg.append('rect').attr('x', bar.right.x).attr('y', 18).attr('width', bar.right.width).attr('height', 14).attr('fill', colors.party(true));
  svg.append('line').attr('x1', bar.center).attr('x2', bar.center).attr('y1', 12).attr('y2', 36).attr('stroke', 'var(--muted)');
  svg.append('text').attr('x', 4).attr('y', 12).text(list.bar.left);
  svg.append('text').attr('x', W - 4).attr('y', 12).attr('text-anchor', 'end').text(list.bar.right);
}

/**
 * Rows of dots on one axis (redesign, chapters 4 and 5): a label per row, the band where a row has one,
 * an open dot or a filled one (Enacted), an optional value text beside the dot, and an optional dashed
 * base line with its label (the actual vote on the House majority axis).
 * @param label text alternative
 * @param maxUnits widest chart in viewBox units
 */
export function drawDotRows(el: HTMLElement, spec: DotRowsSpec, label: string, maxUnits = 560) {
  const m = DOT_ROWS;
  const top = spec.base ? m.top : 6;
  const bottom = top + m.row * spec.rows.length;
  const { svg, width: W } = chartSvg(el, maxUnits, bottom + m.bottom, label);
  svg.classed('dotrows', true);
  const x = scaleLinear().domain(spec.domain).range([m.left, W - m.right]);
  for (const tick of spec.ticks) {
    svg.append('line').attr('class', 'grid').attr('x1', x(tick.value)).attr('x2', x(tick.value)).attr('y1', top).attr('y2', bottom);
    svg.append('text').attr('x', x(tick.value)).attr('y', bottom + 15).attr('text-anchor', 'middle').text(tick.text);
  }
  const baseX = spec.base ? x(spec.base.value) : null;
  spec.rows.forEach((row, i) => {
    const cy = top + m.row * i + m.row / 2;
    svg.append('text').attr('class', 'lbl').attr('x', 0).attr('y', cy + 4).text(row.label);
    if (row.band && row.band[1] > row.band[0]) {
      svg.append('rect').attr('class', 'bandr').attr('x', x(row.band[0])).attr('y', cy - 6)
        .attr('width', x(row.band[1]) - x(row.band[0])).attr('height', 12);
    }
    svg.append('circle').attr('class', row.filled ? 'mk filled' : 'mk').attr('cx', x(row.value)).attr('cy', cy).attr('r', 5);
    if (row.text) {
      const anchor = rowTextAnchor(x(row.value), baseX, W);
      svg.append('text').attr('x', x(row.value) + (anchor === 'start' ? 9 : -9)).attr('y', cy + 4)
        .attr('text-anchor', anchor).text(row.text);
    }
  });
  if (spec.base && baseX !== null) {
    svg.append('line').attr('class', 'base').attr('x1', baseX).attr('x2', baseX).attr('y1', top - 8).attr('y2', bottom);
    svg.append('text').attr('class', 'baselbl').attr('x', baseX).attr('y', top - 11).attr('text-anchor', 'middle').text(spec.base.text);
  }
}
