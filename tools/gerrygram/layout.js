/* global document, __M__, __WM__ */ // runs in the page gerrygram.html; make.mjs fills in __M__ and __WM__
// "Gerry" swells in the middle and sags a little; the subtitle line bends down under it
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const title = document.getElementById('title');
  const M = __M__; const END = __WM__; const BASE = 84; const LIFT = 40;
  const swell = [1, 1.07, 1.15, 1.12, 1.04, 1, 1, 1, 1];
  let x = M; const placed = [];
  [...'Gerrygram'].forEach((ch, i) => {
    const t = document.createElementNS(NS, 'text');
    t.textContent = ch; t.setAttribute('y', BASE);
    title.appendChild(t);
    const w = t.getComputedTextLength(); const k = swell[i];
    const cx = x + (w * k) / 2;
    t.setAttribute('x', cx - w / 2);
    if (k > 1) {
      t.setAttribute('transform', `translate(${cx} ${BASE - LIFT}) scale(${k}) translate(${-cx} ${-(BASE - LIFT)})`);
      t.setAttribute('stroke', title.getAttribute('fill'));
      t.setAttribute('stroke-width', ((k - 1) * 4).toFixed(2));
      t.setAttribute('stroke-linejoin', 'round');
    }
    placed.push({ cx });
    x += w * k - 0.5;
  });
  const mid = (placed[2].cx + placed[3].cx) / 2; const half = (placed[3].cx - placed[2].cx) * 2.4; const DEPTH = 7;
  const pts = [];
  for (let px = M; px <= END; px += 2) {
    const u = Math.abs(px - mid) / half;
    const dip = u < 1 ? DEPTH * Math.cos((u * Math.PI) / 2) ** 2 : 0;
    pts.push(`${px},${(118 + dip).toFixed(2)}`);
  }
  document.getElementById('subline').setAttribute('d', 'M' + pts.join('L'));
})();
