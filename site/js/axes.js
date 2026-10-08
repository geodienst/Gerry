// Geometry for the map and the charts (site design, chapters 4 and 5). Pure: map.js and
// charts.js draw with d3; this module decides the numbers, so node --test can check them.

// --- The map (Task 6.2) -------------------------------------------------------------------------

export const MAP = { width: 975, height: 610, maxZoom: 80, fill: 0.88 }; // a chosen state fills 88% of the map

/** Zoom that centers a projected bounding box [[x0, y0], [x1, y1]] and fills 88% of the map: { x, y, k }. */
export function fitTransform([[x0, y0], [x1, y1]], map = MAP) {
  const k = Math.min(map.maxZoom, map.fill / Math.max((x1 - x0) / map.width, (y1 - y0) / map.height));
  return { x: map.width / 2 - (k * (x0 + x1)) / 2, y: map.height / 2 - (k * (y0 + y1)) / 2, k };
}

// --- The charts (Task 6.5) ----------------------------------------------------------------------

export const BASE_FONT = 15; // px; chart text is 11 units, so 11px at this root size

/**
 * Width of a chart in viewBox units for a box of `containerPx` CSS pixels. One unit is
 * 1/15 rem, so chart text grows with the page from 15px to 21px (site design, update of
 * October 7) and does not shrink in a narrow sheet; between `min` and `max` units.
 */
export function chartUnits(containerPx, rootPx, max, min = 280) {
  return Math.round(Math.max(min, Math.min(max, (containerPx * BASE_FONT) / rootPx)));
}

export const SEAT_AXIS = { width: 560, height: 124, margin: { l: 14, r: 14, t: 40, b: 22 } };
export const NATIONAL_PAD = 14; // the national axis runs 14 seats below and above the band
export const LABEL_GAP = 92; // labels closer than this (in viewBox units) share no row
export const LABEL_ROWS = 3; // three markers can meet: Proportional, Neutral, Enacted

/** Domain of the national seat axis: 14 seats around the band, wide enough for all three markers. */
export function nationalSeatDomain(axis, seatsTotal, pad = NATIONAL_PAD) {
  const values = [axis.p5 - pad, axis.p95 + pad, axis.proportional, axis.enacted, axis.median];
  return [Math.max(0, Math.min(...values)), Math.min(seatsTotal, Math.max(...values))];
}

/**
 * Label rows for markers on one axis. Row 0 sits right above the plot; a label
 * that would collide with one already in a row moves one row up (site design,
 * chapter 5). Labels near an edge are anchored to stay inside the chart.
 * The result is in x order, ties in input order.
 * @param {{key: string, x: number}[]} marks in drawing order
 * @returns {{key: string, x: number, row: number, anchor: string}[]}
 */
export function placeLabels(marks, width = SEAT_AXIS.width, gap = LABEL_GAP, rows = LABEL_ROWS) {
  const placed = [];
  const order = marks.map((m, i) => ({ ...m, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  for (const mark of order) {
    const anchor = mark.x < 70 ? 'start' : mark.x > width - 70 ? 'end' : 'middle';
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
 * @param {number} x
 * @param {number} top
 * @param {number} bottom
 * @param {{x: number, y: number, width: number, height: number}[]} boxes
 * @param {number} pad room around each box, more than the 1.5-unit halo of a label
 * @returns {[number, number][]} [from, to] pairs, top to bottom
 */
export function markerSegments(x, top, bottom, boxes, pad = 2) {
  const gaps = boxes.filter((b) => b.width > 0 && x > b.x - pad && x < b.x + b.width + pad)
    .map((b) => [b.y - pad, b.y + b.height + pad])
    .sort((a, b) => a[0] - b[0]);
  const parts = [];
  let y = top;
  for (const [from, to] of gaps) {
    if (from > y) parts.push([y, Math.min(from, bottom)]);
    y = Math.max(y, to);
  }
  if (y < bottom) parts.push([y, bottom]);
  return parts.filter(([from, to]) => to > from);
}

/** Vertical domain of the sorted district chart: at least 20% to 80%, plus a margin of 2 points. */
export function sortedDomain(sorted) {
  const low = Math.min(0.2, ...sorted.p5, ...sorted.enacted) - 0.02;
  const high = Math.max(0.8, ...sorted.p95, ...sorted.enacted) + 0.02;
  return [Math.max(0, low), Math.min(1, high)];
}

/** The net bar under the list: seats toward Republicans to the left, toward Democrats to the right. */
export function netBar(seatsR, seatsD, width = 360) {
  const center = width / 2;
  const scale = (center - 20) / Math.max(seatsR, seatsD, 1);
  const net = seatsD - seatsR;
  const netX = center + net * scale;
  return {
    center,
    left: { x: center - seatsR * scale, width: seatsR * scale },
    right: { x: center, width: seatsD * scale },
    netX,
    anchor: netX < 60 ? 'start' : netX > width - 60 ? 'end' : 'middle',
  };
}

// --- The waffle of chapter 01 (Task 7.2) ---------------------------------------------------------

export const WAFFLE = { rows: 13, step: 12, size: 10, top: 16, edge: 12 }; // top: room for the tick and its number

/** Columns, width and height in viewBox units of a waffle of `total` seats, filled column by column. */
export function waffleSize(total, w = WAFFLE) {
  const columns = Math.ceil(total / w.rows);
  return { columns, width: columns * w.step - (w.step - w.size), height: w.top + w.rows * w.step - (w.step - w.size) };
}

/** Top left corner of seat `i` (from 0): down a column of 13, then the next column. */
export function waffleCell(i, w = WAFFLE) {
  return { x: Math.floor(i / w.rows) * w.step, y: w.top + (i % w.rows) * w.step };
}

/** x of the number above seat `n` (from 1), the last Democratic seat; at least 12 units from either edge. */
export function waffleTick(n, total, w = WAFFLE) {
  const { width } = waffleSize(total, w);
  const x = waffleCell(Math.max(n, 1) - 1, w).x + w.size / 2;
  return Math.min(Math.max(x, w.edge), width - w.edge);
}

/** Cells of seats lo to hi (from 1, both included): the outline of the neutral band. */
export function waffleBand(lo, hi, w = WAFFLE) {
  return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => waffleCell(lo - 1 + k, w));
}

// --- Rows of dots: the strip in the state record and the axes of chapter 03 (Task 7.2) ----------

export const DOT_ROWS = { left: 112, right: 16, row: 26, top: 24, bottom: 22 }; // left: room for "Neutral median"

/** Ticks from 0 to `total` seats: the smallest step of 1, 2, 5, 10, 20, 50 or 100 that gives at most `most` ticks. */
export function seatTicks(total, most = 7) {
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => Math.floor(total / s) + 1 <= most) ?? 100;
  return Array.from({ length: Math.floor(total / step) + 1 }, (_, k) => k * step);
}

/**
 * Domain on whole steps around the values, with at least `pad` to spare on each side, and a tick per step.
 * The small epsilon keeps a value that is a whole step in floating point (0.49 / 0.01) on that step.
 */
export function rowDomain(values, step, pad = step / 2) {
  const low = Math.floor((Math.min(...values) - pad) / step + 1e-9);
  const high = Math.ceil((Math.max(...values) + pad) / step - 1e-9);
  const at = (k) => Number((k * step).toFixed(10));
  return { domain: [at(low), at(high)], ticks: Array.from({ length: high - low + 1 }, (_, i) => at(low + i)) };
}

/**
 * Side of a value text next to its dot: 'end' (left of the dot) when the dashed base line lies within `gap`
 * units to the right, so the text would run over it, or when the dot is near the right edge; else 'start'.
 */
export function rowTextAnchor(x, baseX, width, gap = 40, edge = 60) {
  if (x > width - edge) return 'end';
  if (baseX !== null && x <= baseX && x > baseX - gap) return 'end';
  return 'start';
}
