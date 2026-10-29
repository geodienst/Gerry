// The Gerrygram for Graphics to reuse: the cartogram of the map's view "States: drawing effect" (site/src/lib/cartogram.ts),
// with its title, the balance, the seats per state and the source. It writes gerrygram.html beside this script, which
// tools/gerrygram/render.ps1 turns into site/public/img/somevotes-gerrygram.png and .webp, and gerrygram.svg, the bare
// map for the videos. node tools/gerrygram/make.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cartogram, ROUNDS } from '../../site/src/lib/cartogram.ts';

const site = fileURLToPath(new URL('../../', import.meta.url));
const d3 = await import(pathToFileURL(join(site, 'node_modules/d3/src/index.js')));
const results = JSON.parse(readFileSync(join(site, 'site/public/data/results.json'), 'utf8'));
const map = JSON.parse(readFileSync(join(site, 'site/public/data/map.topojson'), 'utf8'));
const C = { bg: '#f1f3f0', fg: '#18201c', muted: '#56615b', d: '#2a78d6', r: '#e34948', mid: '#ecebe7', edge: '#a3aaa5', blank: '#c9ccd1' };
const SERIF = '"Palatino Linotype", Palatino, Georgia, serif';
const SANS = '"Segoe UI", system-ui, sans-serif';
const GROW = 0.10;

// arcs in projected coordinates
const projection = d3.geoAlbersUsa().scale(1300).translate([480, 300]);
const { scale: [sx, sy], translate: [tx, ty] } = map.transform;
const arcs = map.arcs.map((arc) => {
  let x = 0; let y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return projection([x * sx + tx, y * sy + ty]); }).filter(Boolean);
});
const byFips = Object.fromEntries(Object.values(results.states).map((s) => [s.fips, s]));
const ringOf = (indexes) => indexes.flatMap((i, n) => {
  const pts = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
  return n ? pts.slice(1) : pts;
});
const states = map.objects.states.geometries.map((g) => {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  const st = byFips[g.properties.id];
  const moved = st && st.seats > 1 ? st.effects.drawing : 0;
  return { postal: g.properties.postal, st, moved, polys, inset: ['AK', 'HI'].includes(g.properties.postal) };
});
const moving = states.filter((s) => !s.inset);
const rings = (s) => s.polys.map((p) => p.map(ringOf));
const area = (s) => Math.abs(rings(s).flat().reduce((t, r) => t + d3.polygonArea(r), 0));
const centroid = (s) => {
  let ax = 0; let ay = 0; let at = 0;
  for (const r of rings(s).flat()) { const a = d3.polygonArea(r); const [cx, cy] = d3.polygonCentroid(r); ax += cx * a; ay += cy * a; at += a; }
  return [ax / at, ay / at];
};
for (const s of moving) { s.area0 = area(s); s.target = s.area0 * (1 + GROW * Math.abs(s.moved)) ** 2; }
// the real shape, kept to draw Texas and California's own outline inside their grown shape
for (const s of moving) { s.rings0 = rings(s).map((p) => p.map((r) => r.map((q) => [...q]))); s.c0 = centroid(s); }

const moved = cartogram(arcs, states.map((s) => ({ polygons: s.polys, shift: s.moved, fixed: s.inset })));
arcs.splice(0, arcs.length, ...moved);
const off = moving.map((s) => area(s) / s.target - 1);
console.log(`after ${ROUNDS} rounds: area off by at most ${(Math.max(...off.map(Math.abs)) * 100).toFixed(1)}%, mean ${(off.reduce((t, v) => t + Math.abs(v), 0) / off.length * 100).toFixed(1)}%`);
for (const s of moving.filter((v) => v.moved || ['NM', 'OK', 'NV', 'GA', 'AL', 'LA'].includes(v.postal))) {
  process.stdout.write(`${s.postal} x${(area(s) / s.area0).toFixed(2)} (want ${(s.target / s.area0).toFixed(2)})  `);
}
console.log();

// draw: fit everything into the frame
const W = 1200; const H = 860; const M = 48; // one margin for title, balance, map and source
const all = states.flatMap((s) => rings(s).flat(2));
const [x0, x1] = d3.extent(all, (p) => p[0]); const [y0, y1] = d3.extent(all, (p) => p[1]);
const k = Math.min((W - 80) / (x1 - x0), (H - 250) / (y1 - y0));
const ox = (W - (x1 - x0) * k) / 2 - x0 * k; const oy = 168 - y0 * k;
const pt = ([x, y]) => `${(x * k + ox).toFixed(1)},${(y * k + oy).toFixed(1)}`;
const d = (s) => rings(s).flat().map((r) => `M${r.map(pt).join('L')}Z`).join('');
const tone = (n) => d3.interpolateRgb(C.mid, n < 0 ? C.r : C.d)(0.45 + 0.11 * Math.min(5, Math.abs(n)));
let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family='${SANS}'>`;
g += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
// title and subtitle are laid out in the page itself, which measures the letters: "Gerry" swells in the middle,
// sags a little, and pushes the subtitle line down under it
g += `<g id="title" font-family='${SERIF}' font-size="54" font-weight="700" fill="${C.fg}"></g>`;
g += `<path id="subline" d="M${M},118H${W - M}" fill="none"/><text id="sub" font-size="20" fill="${C.muted}"><textPath href="#subline">Cartogram based on seats shifted by drawing the district lines.</textPath></text>`;
for (const s of states) {
  const fill = s.moved ? tone(s.moved) : (!s.st || s.st.seats === 1 ? C.blank : C.mid);
  g += `<path d="${d(s)}" fill="${fill}" stroke="${s.moved ? C.bg : C.edge}" stroke-width="${s.moved ? 1.4 : 0.8}" stroke-linejoin="round"/>`;
}
for (const s of states.filter((v) => ['TX', 'CA'].includes(v.postal))) {
  const [nx, ny] = centroid(s);
  const shift = ([x, y]) => pt([x + nx - s.c0[0], y + ny - s.c0[1]]);
  g += `<path d="${s.rings0.flat().map((r) => `M${r.map(shift).join('L')}Z`).join('')}" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.75"/>`;
}
for (const s of states.filter((v) => v.moved)) {
  const [cx, cy] = centroid(s).map((v, i) => (i ? v * k + oy : v * k + ox));
  const n = Math.abs(s.moved); const label = `${s.moved < 0 ? 'R' : 'D'}+${n}`;
  if (s.postal === 'MD') { g += `<text x="${cx + 26}" y="${cy + 26}" font-size="13" font-weight="700" fill="${C.fg}">MD ${label}</text>`; continue; }
  if (n >= 2) {
    g += `<text x="${cx}" y="${cy - 4 - n * 1.5}" text-anchor="middle" font-size="14" font-weight="600" letter-spacing="0.5" fill="#fff">${s.postal}</text>`;
    g += `<text x="${cx}" y="${cy + 16 + n}" text-anchor="middle" font-family='${SERIF}' font-size="${14 + 3 * n}" font-weight="700" fill="#fff">${label}</text>`;
  } else g += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${C.fg}">${s.postal} ${label}</text>`;
}
const toR = states.filter((v) => v.moved < 0); const toD = states.filter((v) => v.moved > 0);
const sum = (a) => a.reduce((t, v) => t + Math.abs(v.moved), 0);
// the balance sits on the same two baselines as the title and the subtitle
const bw = 300; const bx = W - M - bw; const unit = bw / (sum(toR) + sum(toD));
g += `<text x="${bx}" y="84" font-family='${SERIF}' font-size="34" font-weight="700" fill="${C.fg}">Net R+${sum(toR) - sum(toD)}</text>`;
g += `<rect x="${bx}" y="94" width="${sum(toR) * unit - 1}" height="9" fill="${C.r}"/><rect x="${bx + sum(toR) * unit + 1}" y="94" width="${sum(toD) * unit - 1}" height="9" fill="${C.d}"/>`;
g += `<text x="${bx}" y="118" font-size="16" font-weight="700" fill="${C.r}">${sum(toR)}</text>`;
g += `<text x="${bx + bw}" y="118" text-anchor="end" font-size="16" font-weight="700" fill="${C.d}">${sum(toD)}</text>`;
g += `<line x1="${M}" x2="${W - M}" y1="${H - 66}" y2="${H - 66}" stroke="#d3d9d4"/>`;
g += `<text x="${M}" y="${H - 18}" font-size="13" fill="${C.muted}">Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).</text>`;
g += `<text x="${M}" y="${H - 40}" font-size="13" fill="${C.muted}">Based on <tspan font-weight="700" fill="${C.fg}">somevotes.org</tspan> data. 10% correction per seat difference from neutral map median (based on Alarm project).</text>`;
g += '</svg>';
const LAYOUT = `<script>${readFileSync(new URL('layout.js', import.meta.url), 'utf8').replace('__M__', M).replace('__WM__', W - M)}</script>`;
writeFileSync(new URL('gerrygram.html', import.meta.url), `<!doctype html><meta charset="utf-8"><title>Gerrygram</title><style>html,body{margin:0;background:${C.bg}}</style>${g}${LAYOUT}`);

// a bare copy for the videos: only the states, with their colours and thin borders, no text; each path has its state
const BW = 1600; const pad = 8;
const bk = Math.min((BW - 2 * pad) / (x1 - x0), 1e9); const BH = Math.ceil((y1 - y0) * bk + 2 * pad);
const bp = ([x, y]) => `${((x - x0) * bk + pad).toFixed(1)},${((y - y0) * bk + pad).toFixed(1)}`;
let bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" width="${BW}" height="${BH}">\n`;
for (const s of states) {
  const fill = s.moved ? tone(s.moved) : (!s.st || s.st.seats === 1 ? C.blank : C.mid);
  const dd = rings(s).flat().map((r) => `M${r.map(bp).join('L')}Z`).join('');
  bare += `  <path id="${s.postal}" data-seats-moved="${s.moved}" d="${dd}" fill="${fill}" stroke="${s.moved ? '#ffffff' : C.edge}" stroke-width="0.8" stroke-opacity="0.7" stroke-linejoin="round"/>\n`;
}
bare += '</svg>\n';
writeFileSync(new URL('gerrygram.svg', import.meta.url), bare);
console.log(`gerrygram.svg ${BW} x ${BH}, ${states.length} states, ${(bare.length / 1024).toFixed(0)} KB`);
