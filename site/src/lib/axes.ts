// Geometry for the map and the charts (site design, chapters 4 and 5). Pure: ui/map.ts and
// ui/charts.ts draw with d3; this module decides the numbers, so node --test can check them.
import type { Band, Party, Sorted } from '../types.ts';

export type Extent = [[number, number], [number, number]];
export type Anchor = 'start' | 'middle' | 'end';
export interface Box { x: number; y: number; width: number; height: number }
export interface Mark { key: string; x: number }
export interface PlacedLabel extends Mark { row: number; anchor: Anchor }
/** The national seat axis: the band of the neutral outcomes and the two other counts. */
/** The markers of a seat axis: the neutral band and median, proportional and enacted. */
export interface SeatMarks extends Band { proportional: number; enacted: number }
/** A seat axis with the bars: dist[k] is the share of neutral maps with k Democratic seats. */
export interface SeatAxis extends SeatMarks { dist: number[] }

// --- The map (Task 6.2) -------------------------------------------------------------------------

export const MAP = { width: 975, height: 610, maxZoom: 80, fill: 0.88 }; // a chosen state fills 88% of the map

/** Zoom that centers a projected bounding box [[x0, y0], [x1, y1]] and fills 88% of the map: { x, y, k }. */
export function fitTransform([[x0, y0], [x1, y1]]: Extent, map = MAP): { x: number; y: number; k: number } {
  const k = Math.min(map.maxZoom, map.fill / Math.max((x1 - x0) / map.width, (y1 - y0) / map.height));
  return { x: map.width / 2 - (k * (x0 + x1)) / 2, y: map.height / 2 - (k * (y0 + y1)) / 2, k };
}

// --- The charts (Task 6.5) ----------------------------------------------------------------------

export const BASE_FONT = 15; // px; chart text is 11 units, so 11px at this root size

/**
 * Width of a chart in viewBox units for a box of `containerPx` CSS pixels. One unit is
 * 1/15 rem, so chart text grows with the page from 15px to 21px and does not shrink in a
 * narrow sheet; between `min` and `max` units.
 */
export function chartUnits(containerPx: number, rootPx: number, max: number, min = 280): number {
  return Math.round(Math.max(min, Math.min(max, (containerPx * BASE_FONT) / rootPx)));
}

export const SEAT_AXIS = { width: 560, height: 124, margin: { l: 14, r: 14, t: 40, b: 22 } };
export const NATIONAL_PAD = 14; // the national axis runs 14 seats below and above the band
export const LABEL_GAP = 92; // labels closer than this (in viewBox units) share no row
export const LABEL_ROWS = 3; // three markers can meet: Proportional, Neutral, Enacted

/** Domain of the national seat axis: 14 seats around the band, wide enough for all three markers. */
export function nationalSeatDomain(axis: SeatMarks, seatsTotal: number, pad = NATIONAL_PAD): [number, number] {
  const values = [axis.p5 - pad, axis.p95 + pad, axis.proportional, axis.enacted, axis.median];
  return [Math.max(0, Math.min(...values)), Math.min(seatsTotal, Math.max(...values))];
}

/**
 * Label rows for markers on one axis. Row 0 sits right above the plot; a label
 * that would collide with one already in a row moves one row up (site design,
 * chapter 5). Labels near an edge are anchored to stay inside the chart.
 * The result is in x order, ties in input order.
 * @param marks in drawing order
 */
export function placeLabels(marks: readonly Mark[], width = SEAT_AXIS.width, gap = LABEL_GAP, rows = LABEL_ROWS): PlacedLabel[] {
  const placed: (PlacedLabel & { at: number })[] = [];
  const order = marks.map((m, i) => ({ ...m, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  for (const mark of order) {
    const anchor: Anchor = mark.x < 70 ? 'start' : mark.x > width - 70 ? 'end' : 'middle';
    // a start or end label runs inward from its mark, so compare its middle, about gap / 2 further in
    const at = anchor === 'start' ? mark.x + gap / 2 : anchor === 'end' ? mark.x - gap / 2 : mark.x;
    let row = 0;
    while (row < rows - 1 && placed.some((p) => p.row === row && Math.abs(p.at - at) < gap)) row += 1;
    placed.push({ key: mark.key, x: mark.x, row, anchor, at });
  }
  return placed.map(({ at, ...label }) => label);
}

/**
 * The visible parts of a marker line at `x` from `top` down to `bottom`. The line leaves a gap
 * at every label box in its way (the labels of other markers on lower rows), so no line runs
 * through text (Task 6.7, Step 6). Boxes are in viewBox units; an empty box, from a chart that
 * is not displayed, leaves no gap.
 * @param pad room around each box, more than the 1.5-unit halo of a label
 * @returns [from, to] pairs, top to bottom
 */
export function markerSegments(x: number, top: number, bottom: number, boxes: readonly Box[], pad = 2): [number, number][] {
  const gaps = boxes.filter((b) => b.width > 0 && x > b.x - pad && x < b.x + b.width + pad)
    .map((b): [number, number] => [b.y - pad, b.y + b.height + pad])
    .sort((a, b) => a[0] - b[0]);
  const parts: [number, number][] = [];
  let y = top;
  for (const [from, to] of gaps) {
    if (from > y) parts.push([y, Math.min(from, bottom)]);
    y = Math.max(y, to);
  }
  if (y < bottom) parts.push([y, bottom]);
  return parts.filter(([from, to]) => to > from);
}

/** Vertical domain of the sorted district chart: at least 20% to 80%, plus a margin of 2 points. */
export function sortedDomain(sorted: Pick<Sorted, 'p5' | 'p95' | 'enacted'>): [number, number] {
  const low = Math.min(0.2, ...sorted.p5, ...sorted.enacted) - 0.02;
  const high = Math.max(0.8, ...sorted.p95, ...sorted.enacted) + 0.02;
  return [Math.max(0, low), Math.min(1, high)];
}

/** The net bar of all states together: seats toward Republicans to the left, toward Democrats to the right. */
export function netBar(seatsR: number, seatsD: number, width = 360) {
  const center = width / 2;
  const scale = (center - 20) / Math.max(seatsR, seatsD, 1);
  return {
    center,
    left: { x: center - seatsR * scale, width: seatsR * scale },
    right: { x: center, width: seatsD * scale },
  };
}

// --- The House of 435 in chapter 01 ------------------------------
// Two halves of 217 seats, Democrats from the left and Republicans from the right, and the middle seat
// (seat 218, the majority) at the top of the column between them, in the grid like the rest. Each half fills
// from its outer column inward, every column bottom up, so the change of color ends next to the middle seat.

export const HOUSE = { half: 217, size: 10, step: 12, top: 2, gap: 2 }; // top: room for the frames; gap: as between squares

/** Columns, the seats in the inner column, the size in viewBox units and the middle seat, for `rows` rows. */
export function houseLayout(rows: number, h = HOUSE) {
  const cols = Math.ceil(h.half / rows);
  const partial = h.half - (cols - 1) * rows;
  const halfWidth = cols * h.step - (h.step - h.size);
  return {
    rows, cols, partial,
    width: 2 * halfWidth + 2 * h.gap + h.size,
    height: h.top + rows * h.step - (h.step - h.size),
    mid: { x: halfWidth + h.gap, y: h.top },
  };
}

/** Top left corner of seat `k` (from 0, outer column first) of the half on `side` ('D' left, 'R' right). */
export function houseCell(side: Party, k: number, rows: number, h = HOUSE): { x: number; y: number } {
  const { cols, partial, width } = houseLayout(rows, h);
  const full = (cols - 1) * rows;
  const column = k < full ? Math.floor(k / rows) : cols - 1;
  // full columns run bottom up over all rows; the inner column holds `partial` seats in its top rows
  const row = k < full ? rows - 1 - (k % rows) : partial - 1 - (k - full);
  const x = column * h.step;
  return { x: side === 'D' ? x : width - h.size - x, y: h.top + row * h.step };
}

/** Where seat `i` of 435 (from 0, counted from the Democratic side) sits: a half and its k, or 'mid'. */
export function housePlace(i: number, h = HOUSE): { side: Party; k: number } | 'mid' {
  if (i < h.half) return { side: 'D', k: i };
  if (i === h.half) return 'mid';
  return { side: 'R', k: 2 * h.half - i };
}

// --- Rows of dots: the strip in the state record and the axes of chapter 03 (Task 7.2) ----------

export const DOT_ROWS = { left: 112, right: 16, row: 26, top: 24, bottom: 22 }; // left: room for "Neutral median"

/** One row of drawDotRows: a label, a dot at `value`, and where it has them a band and a value text. */
export interface DotRow {
  label: string;
  value: number;
  band?: readonly [number, number] | number[] | null;
  filled?: boolean;
  text?: string | null;
}
export interface DotRowsSpec {
  domain: number[];
  ticks: { value: number; text: string }[];
  rows: DotRow[];
  base?: { value: number; text: string } | null;
}

/**
 * Ticks from 0 to `total` seats: the smallest step of 1, 2, 5, 10, 20, 50 or 100 that gives at most `most` ticks,
 * then the total itself, which replaces a step tick at half a step or less from it.
 */
export function seatTicks(total: number, most = 7): number[] {
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => Math.floor(total / s) + 1 <= most) ?? 100;
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, k) => k * step);
  const last = ticks[ticks.length - 1];
  if (last === total) return ticks;
  if (last > 0 && total - last <= step / 2) ticks.pop();
  return [...ticks, total];
}

/**
 * Domain on whole steps around the values, with at least `pad` to spare on each side, and a tick per step.
 * The small epsilon keeps a value that is a whole step in floating point (0.49 / 0.01) on that step.
 */
export function rowDomain(values: readonly number[], step: number, pad = step / 2): { domain: [number, number]; ticks: number[] } {
  const low = Math.floor((Math.min(...values) - pad) / step + 1e-9);
  const high = Math.ceil((Math.max(...values) + pad) / step - 1e-9);
  const at = (k: number): number => Number((k * step).toFixed(10));
  return { domain: [at(low), at(high)], ticks: Array.from({ length: high - low + 1 }, (_, i) => at(low + i)) };
}

/**
 * Side of a value text next to its dot: 'end' (left of the dot) when the dashed base line lies within `gap`
 * units to the right, so the text would run over it, or when the dot is near the right edge; else 'start'.
 */
export function rowTextAnchor(x: number, baseX: number | null, width: number, gap = 40, edge = 60): Anchor {
  if (x > width - edge) return 'end';
  if (baseX !== null && x <= baseX && x > baseX - gap) return 'end';
  return 'start';
}
