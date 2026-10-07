// Geometry for the map and the charts (site design, chapters 4 and 5). Pure: map.js and
// charts.js draw with d3; this module decides the numbers, so node --test can check them.

// --- The map (Task 6.2) -------------------------------------------------------------------------

export const MAP = { width: 975, height: 610, maxZoom: 80, fill: 0.88 }; // a chosen state fills 88% of the map

/** Zoom that centers a projected bounding box [[x0, y0], [x1, y1]] and fills 88% of the map: { x, y, k }. */
export function fitTransform([[x0, y0], [x1, y1]], map = MAP) {
  const k = Math.min(map.maxZoom, map.fill / Math.max((x1 - x0) / map.width, (y1 - y0) / map.height));
  return { x: map.width / 2 - (k * (x0 + x1)) / 2, y: map.height / 2 - (k * (y0 + y1)) / 2, k };
}
