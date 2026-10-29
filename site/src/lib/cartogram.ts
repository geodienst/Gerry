// The Gerrygram: a contiguous cartogram of the states (Dougenik, Chrisman and Niemeyer, 1985). A state whose map
// shifts n seats toward one party, compared with the median of its neutral maps, grows to (1 + 0.1 n)^2 times its
// area, 10% wider and taller per seat; every other state keeps its area. The borders the states share move together,
// so a growing state pushes its neighbors aside and squeezes them, and nothing overlaps. Alaska and Hawaii stay as
// they are. Pure: ui/map.ts draws it, node --test checks it.

export type Point = [number, number];
export type Ring = Point[];

export interface CartogramState {
  /** the arcs of each polygon's rings, topojson style: i is arc i, ~i is arc i reversed */
  polygons: number[][][];
  /** seats the map shifts toward one party; 0 keeps the area */
  shift: number;
  /** stays in place and pushes nothing: the insets of Alaska and Hawaii */
  fixed?: boolean;
}

export const GROW_PER_SEAT = 0.1;
export const ROUNDS = 14;

const ringArea = (ring: Ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
};

/** The rings of a state's polygons from the arcs, the first point of each later arc left out. */
export function ringsOf(polygons: number[][][], arcs: Point[][]): Ring[][] {
  return polygons.map((polygon) => polygon.map((indexes) => indexes.flatMap((i, n) => {
    const points = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
    return n ? points.slice(1) : points;
  })));
}

/** Area of a state, all its rings together; holes run the other way and count against it. */
export function areaOf(rings: Ring[][]): number {
  return Math.abs(rings.flat().reduce((t, r) => t + ringArea(r), 0));
}

function centroidOf(rings: Ring[][]): Point {
  let x = 0; let y = 0; let total = 0;
  for (const ring of rings.flat()) {
    let cx = 0; let cy = 0; let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f; a += f;
    }
    if (!a) continue;
    x += cx / 3; y += cy / 3; total += a;
  }
  return [x / total, y / total];
}

/**
 * Move the points of the arcs so that each state reaches its target area: new arcs, the input left as it was.
 * Arcs of a fixed state stay where they are.
 */
export function cartogram(arcs: Point[][], states: CartogramState[], rounds = ROUNDS): Point[][] {
  const out = arcs.map((arc) => arc.map(([x, y]) => [x, y] as Point));
  const moving = states.filter((s) => !s.fixed);
  const still = new Set(states.filter((s) => s.fixed).flatMap((s) => s.polygons.flat(2).map((i) => (i >= 0 ? i : ~i))));
  const free = [...new Set(moving.flatMap((s) => s.polygons.flat(2).map((i) => (i >= 0 ? i : ~i))))].filter((i) => !still.has(i));
  const targets = moving.map((s) => areaOf(ringsOf(s.polygons, out)) * (1 + GROW_PER_SEAT * Math.abs(s.shift)) ** 2);
  for (let round = 0; round < rounds; round++) {
    const forces = moving.map((s, n) => {
      const rings = ringsOf(s.polygons, out);
      const area = areaOf(rings);
      const radius = Math.sqrt(area / Math.PI);
      return { c: centroidOf(rings), radius, mass: Math.sqrt(targets[n] / Math.PI) - radius, error: Math.max(area, targets[n]) / Math.min(area, targets[n]) };
    });
    const reduce = 1 / (1 + forces.reduce((t, f) => t + f.error - 1, 0) / forces.length);
    for (const i of free) {
      for (const p of out[i]) {
        let mx = 0; let my = 0;
        for (const f of forces) {
          const dx = p[0] - f.c[0]; const dy = p[1] - f.c[1];
          const d = Math.hypot(dx, dy) || 1e-9;
          const push = d > f.radius ? (f.mass * f.radius) / d : ((f.mass * d * d) / (f.radius * f.radius)) * (4 - (3 * d) / f.radius);
          mx += (dx / d) * push * reduce; my += (dy / d) * push * reduce;
        }
        p[0] += mx; p[1] += my;
      }
    }
  }
  return out;
}

/** Scale and move points so their bounding box fits [[x0, y0], [x1, y1]], centered, keeping the shape. */
export function fitPoints(arcs: Point[][], [[x0, y0], [x1, y1]]: [Point, Point]): Point[][] {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const arc of arcs) for (const [x, y] of arc) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const k = Math.min((x1 - x0) / (maxX - minX), (y1 - y0) / (maxY - minY));
  const ox = x0 + ((x1 - x0) - (maxX - minX) * k) / 2 - minX * k;
  const oy = y0 + ((y1 - y0) - (maxY - minY) * k) / 2 - minY * k;
  return arcs.map((arc) => arc.map(([x, y]) => [x * k + ox, y * k + oy] as Point));
}

/** An SVG path for rings. */
export const pathOf = (rings: Ring[][]) => rings.flat().filter((r) => r.length > 2).map((r) => `M${r.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`).join('');
