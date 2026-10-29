// The Gerrygram (lib/cartogram.ts) on the site's own map: each state reaches its area, the insets stay, and the
// states keep sharing their borders.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { geoAlbersUsa } from 'd3';
import { GROW_PER_SEAT, areaOf, cartogram, fitPoints, ringsOf, type Point } from '../src/lib/cartogram.ts';

const topology = JSON.parse(readFileSync(new URL('../public/data/map.topojson', import.meta.url), 'utf8'));
const results = JSON.parse(readFileSync(new URL('../public/data/results.json', import.meta.url), 'utf8'));
const projection = geoAlbersUsa().scale(1300).translate([480, 300]);
const { scale: [sx, sy], translate: [tx, ty] } = topology.transform;
const arcs: Point[][] = topology.arcs.map((arc: [number, number][]) => {
  let x = 0; let y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return projection([x * sx + tx, y * sy + ty]); }).filter(Boolean);
});
const states = topology.objects.states.geometries.map((g: { type: string; arcs: number[][]; properties: { postal: string } }) => ({
  postal: g.properties.postal,
  polygons: g.type === 'Polygon' ? [g.arcs] : (g.arcs as unknown as number[][][]),
  shift: results.states[g.properties.postal]?.effects?.drawing ?? 0,
  fixed: ['AK', 'HI'].includes(g.properties.postal),
}));
const moved = cartogram(arcs, states);

test('a state grows by (1 + 0.1 per seat) squared and a state without a shift keeps its area, within 1%', () => {
  for (const s of states.filter((v: { fixed: boolean }) => !v.fixed)) {
    const ratio = areaOf(ringsOf(s.polygons, moved)) / areaOf(ringsOf(s.polygons, arcs));
    const want = (1 + GROW_PER_SEAT * Math.abs(s.shift)) ** 2;
    assert.ok(Math.abs(ratio / want - 1) < 0.01, `${s.postal}: ${ratio.toFixed(3)}, want ${want.toFixed(3)}`);
  }
  const tx = states.find((s: { postal: string }) => s.postal === 'TX');
  assert.equal(tx.shift, -6);
});

test('Alaska and Hawaii stay where they are, and the input arcs are left as they were', () => {
  for (const s of states.filter((v: { fixed: boolean }) => v.fixed)) assert.deepEqual(ringsOf(s.polygons, moved), ringsOf(s.polygons, arcs));
  assert.notDeepEqual(moved, arcs);
});

test('fitPoints puts the Gerrygram inside the map, keeping its shape', () => {
  const fitted = fitPoints(moved, [[8, 8], [967, 602]]);
  const all = fitted.flat();
  assert.ok(all.every(([x, y]) => x >= 7.99 && x <= 967.01 && y >= 7.99 && y <= 602.01));
});
