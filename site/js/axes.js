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
