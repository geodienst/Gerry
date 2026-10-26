// Draws the images of lib/graphics.ts on a canvas, in the light colors and the typefaces of the site, and hands
// them out as PNG files; the caption under each can be copied. No outside services.
import { geoAlbersUsa, geoPath, interpolateLab } from 'd3';
import { makeColors, EFFECT_MAX, effectBoxes, shareStops, shareTicks } from '../lib/colors.ts';
import { LIGHT, nationalGraphic, statesGraphic } from '../lib/graphics.ts';
import { LEGEND_TEXT } from '../lib/model.ts';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { GraphicFoot, NationalGraphic, StateGraphic, StatesGraphic, StatesMapGraphic } from '../lib/graphics.ts';
import { copy } from './share.ts';
import type { OutcomesView } from '../lib/chapters.ts';
import type { Colors } from '../lib/colors.ts';
import type { DistrictProps, Palette, Postal, Results, StateProps } from '../types.ts';

export type DistrictShape = Feature<Polygon | MultiPolygon, DistrictProps>;
export type StateShape = Feature<Polygon | MultiPolygon, StateProps>;

const W = 1200; // width in CSS pixels; the file has twice as many
const SCALE = 2;
const PAD = 64;

/** The scales of a palette in the light colors. */
export function lightColors(palette: Palette): Colors {
  return makeColors(interpolateLab, {
    d: palette === 'party' ? LIGHT['party-d'] : LIGHT['neutral-d'],
    r: palette === 'party' ? LIGHT['party-r'] : LIGHT['neutral-r'],
    mid: LIGHT.mid,
    blank: LIGHT.blank,
    tie: palette === 'party' ? LIGHT['party-tie'] : LIGHT['neutral-tie'],
  });
}

interface Faces { head: string; body: string }

/** The two font stacks of the page, from the tokens. */
function faces(): Faces {
  const css = getComputedStyle(document.documentElement);
  return { head: css.getPropertyValue('--font-head').trim(), body: css.getPropertyValue('--font-body').trim() };
}

/** `text` broken into lines no wider than `width` in the context's font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Write `text` from the top `y` in lines of `lineHeight`; returns the y under the last line. */
function paragraph(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, font: string,
  color: string, lineHeight: number): number {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const lines = wrap(ctx, text, width);
  lines.forEach((line, i) => ctx.fillText(line, x, y + lineHeight * (i + 0.78)));
  return y + lineHeight * lines.length;
}

/** The foot of both images under a rule: votes, maps and sources, then the credit with the address on the right. */
function drawFoot(ctx: CanvasRenderingContext2D, f: Faces, foot: GraphicFoot, y: number): number {
  ctx.fillStyle = LIGHT.rule;
  ctx.fillRect(PAD, y, W - 2 * PAD, 1);
  let at = y + 16;
  at = paragraph(ctx, foot.votes, PAD, at, W - 2 * PAD, `15px ${f.body}`, LIGHT.muted, 22);
  at = paragraph(ctx, foot.maps, PAD, at, W - 2 * PAD, `15px ${f.body}`, LIGHT.muted, 22);
  ctx.font = `700 18px ${f.body}`;
  ctx.fillStyle = LIGHT.ink;
  ctx.textAlign = 'right';
  ctx.fillText(foot.site, W - PAD, at + 26);
  ctx.textAlign = 'left';
  paragraph(ctx, foot.credit, PAD, at + 8, W - 2 * PAD - 220, `15px ${f.body}`, LIGHT.muted, 22);
  return at + 8 + 22 + PAD * 0.6;
}

/** Size the canvas for a height in whole pixels, fill it with the sheet color and return its context in CSS pixels. */
function begin(canvas: HTMLCanvasElement, height: number): CanvasRenderingContext2D {
  const h = Math.ceil(height); // the fill covers the last row too, so the file ends without a transparent strip
  canvas.width = W * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.fillStyle = LIGHT.sheet;
  ctx.fillRect(0, 0, W, h);
  return ctx;
}

let spare: HTMLCanvasElement | null = null; // one pixel high: the first pass only measures

/**
 * Draw the image twice: once on a spare canvas to measure its height, then on `canvas` at that height.
 * @param draw draws the image and returns the y of its bottom
 */
function render(canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D) => number) {
  spare ??= document.createElement('canvas');
  const height = draw(begin(spare, 1));
  draw(begin(canvas, height));
}

/** The seats the axis shows: every count, with at least 15 seats either side of the majority line. */
function majorityDomain(g: NationalGraphic): [number, number] {
  const values = g.rows.map((r) => r.seats);
  return [Math.min(g.majority - 15, Math.min(...values) - 4), Math.max(g.majority + 15, Math.max(...values) + 4)];
}

/**
 * The national comparison against the majority: for each count one block per seat between the count and the majority
 * line, blue above 218 and red below it, so the few seats that decide the majority can be counted. A seat scale runs
 * under the rows.
 */
export function drawNational(canvas: HTMLCanvasElement, g: NationalGraphic, colors: Colors) {
  const f = faces();
  render(canvas, (ctx) => {
    let y = PAD - 8;
    y = paragraph(ctx, g.title, PAD, y, W - 2 * PAD, `700 44px ${f.head}`, LIGHT.fg, 54);
    y = paragraph(ctx, g.lead, PAD, y + 8, 960, `600 24px ${f.head}`, LIGHT.fg, 33) + 40;
    const plotX = 360;
    const plotW = W - PAD - 130 - plotX;
    const [lo, hi] = majorityDomain(g);
    const x = (seatCount: number) => plotX + (plotW * (seatCount - lo)) / (hi - lo);
    const unit = plotW / (hi - lo);
    const gap = unit >= 6 ? 2 : 1; // the surface between two blocks
    const size = Math.max(1, unit - gap);
    const tall = Math.max(size, 14);
    const mid = x(g.majority);
    const rowsTop = y + 22;
    const rowH = 104;
    const rowsBottom = rowsTop + (g.rows.length - 1) * rowH + 52;
    /** Seat `s` (counted from the Democratic side) as a block in the row whose blocks are centered on `cy`. */
    const block = (s: number, cy: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x(s - 1) + gap / 2, cy - tall / 2, size, tall);
    };
    // the key above the rows: each side of the line names its majority
    ctx.font = `600 16px ${f.body}`;
    ctx.fillStyle = colors.party(false);
    ctx.fillRect(mid - 14 - 12, y - 12, 12, 12);
    ctx.fillStyle = LIGHT.fg;
    ctx.textAlign = 'right';
    ctx.fillText(g.sides.r, mid - 14 - 20, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.party(true);
    ctx.fillRect(mid + 14, y - 12, 12, 12);
    ctx.fillStyle = LIGHT.fg;
    ctx.fillText(g.sides.d, mid + 14 + 20, y);
    g.rows.forEach((row, i) => {
      const top = rowsTop + i * rowH;
      paragraph(ctx, row.label, PAD, top, plotX - PAD - 30, `600 20px ${f.body}`, LIGHT.fg, 26);
      paragraph(ctx, row.desc, PAD, top + 28, plotX - PAD - 30, `15px ${f.body}`, LIGHT.muted, 20);
      const cy = top + 21;
      if (row.seats > g.majority) {
        for (let s = g.majority + 1; s <= row.seats; s += 1) block(s, cy, colors.party(true));
      } else {
        for (let s = row.seats + 1; s <= g.majority; s += 1) block(s, cy, colors.party(false));
      }
      // the count on the right
      ctx.fillStyle = LIGHT.fg;
      ctx.textAlign = 'right';
      ctx.font = `700 44px ${f.head}`;
      ctx.fillText(row.value, W - PAD, top + 38);
      ctx.textAlign = 'left';
      // the difference to the next row, as between the rows of chapter 01
      if (i < g.steps.length) {
        ctx.fillStyle = LIGHT.rule;
        ctx.fillRect(PAD + 2, top + rowH - 26, 2, 22);
        ctx.font = `700 15px ${f.body}`;
        ctx.fillStyle = LIGHT.fg;
        ctx.fillText(g.steps[i], PAD + 14, top + rowH - 10);
      }
    });
    // the majority line through all rows, and the seat scale under them
    ctx.strokeStyle = LIGHT.fg;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(mid, rowsTop - 10);
    ctx.lineTo(mid, rowsBottom + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = LIGHT.rule;
    ctx.fillRect(plotX, rowsBottom + 6, plotW, 1);
    // tick labels leave room for the label of the majority line
    ctx.font = `700 15px ${f.body}`;
    const clear = ctx.measureText(g.majorityLabel).width / 2 + 24;
    ctx.font = `14px ${f.body}`;
    ctx.fillStyle = LIGHT.muted;
    ctx.textAlign = 'center';
    for (let tick = Math.ceil(lo / 10) * 10; tick <= hi; tick += 10) {
      if (Math.abs(x(tick) - mid) < clear) continue;
      ctx.fillRect(x(tick), rowsBottom + 6, 1, 6);
      ctx.fillText(String(tick), x(tick), rowsBottom + 30);
    }
    ctx.font = `700 15px ${f.body}`;
    ctx.fillStyle = LIGHT.fg;
    ctx.fillText(g.majorityLabel, mid, rowsBottom + 30);
    ctx.textAlign = 'left';
    return drawFoot(ctx, f, g.foot, rowsBottom + 64);
  });
  canvas.setAttribute('aria-label', g.alt);
}

/** The drawing effect by state: the net large, then a bar per state in two columns, then the states without one. */
export function drawStates(canvas: HTMLCanvasElement, g: StatesGraphic, colors: Colors) {
  const f = faces();
  render(canvas, (ctx) => {
    let y = PAD - 8;
    y = paragraph(ctx, g.title, PAD, y, W - 2 * PAD, `700 44px ${f.head}`, LIGHT.fg, 54);
    y = paragraph(ctx, g.note, PAD, y + 4, 960, `19px ${f.body}`, LIGHT.muted, 27) + 24;
    // the net, large, with the sentence of sums beside it
    ctx.fillStyle = colors.effect(g.netValue);
    ctx.fillRect(PAD, y + 4, 14, 44);
    ctx.font = `700 44px ${f.head}`;
    ctx.fillStyle = LIGHT.fg;
    ctx.fillText(g.net, PAD + 28, y + 42);
    const netEnd = PAD + 28 + ctx.measureText(g.net).width + 28;
    const sumBottom = paragraph(ctx, g.summary, netEnd, y + 2, W - PAD - netEnd, `18px ${f.body}`, LIGHT.fg, 25);
    y = Math.max(y + 56, sumBottom) + 28;
    // two columns: toward Republicans on the left, toward Democrats on the right
    const colW = (W - 2 * PAD - 48) / 2;
    const rowH = 34;
    const column = (rows: StatesGraphic['toR'], left: number, head: string) => {
      ctx.font = `600 18px ${f.body}`;
      ctx.fillStyle = LIGHT.fg;
      ctx.fillText(head, left, y + 18);
      ctx.fillStyle = LIGHT.rule;
      ctx.fillRect(left, y + 30, colW, 1);
      rows.forEach((row, i) => {
        const base = y + 44 + i * rowH;
        ctx.font = `17px ${f.body}`;
        ctx.fillStyle = LIGHT.fg;
        ctx.fillText(row.name, left, base + 18);
        const barX = left + 190;
        const barW = colW - 190 - 70;
        ctx.fillStyle = colors.effect(row.drawing);
        ctx.fillRect(barX, base + 4, (barW * Math.min(Math.abs(row.drawing), EFFECT_MAX)) / EFFECT_MAX, 18);
        ctx.font = `700 17px ${f.body}`;
        ctx.fillStyle = LIGHT.fg;
        ctx.textAlign = 'right';
        ctx.fillText(row.label, left + colW, base + 18);
        ctx.textAlign = 'left';
      });
      return y + 44 + rows.length * rowH;
    };
    const leftBottom = column(g.toR, PAD, g.headR);
    const rightBottom = column(g.toD, PAD + colW + 48, g.headD);
    y = Math.max(leftBottom, rightBottom) + 16;
    y = paragraph(ctx, g.zeros, PAD, y, W - 2 * PAD, `16px ${f.body}`, LIGHT.muted, 23);
    return drawFoot(ctx, f, g.foot, y + 30);
  });
  canvas.setAttribute('aria-label', g.alt);
}

/** The height of the two map cards: 16:9 at the width of the images, so they fill a screen or a post. */
const WIDE_H = Math.round((W * 9) / 16);
/** Room for the foot under a card: the rule, the votes, the maps and sources, the credit and the margin. */
const FOOT_ROOM = 150;
/** The column of text beside the map. */
const COL_W = 360;

interface MapBox { x: number; y: number; w: number; h: number }
/** What a map card draws: the shapes that set the scale, the land around them, and the shapes with their colors. */
interface MapLayers {
  fit: Feature[];
  /** pale land around the colored shapes, under them */
  around: Feature[];
  shapes: { shape: Feature; fill: string }[];
  /** drawn on top in the ink of the text */
  outline: Feature[];
}

/**
 * The map of a card: water to the right and top edges of the image, `fit` fitted into it inside `inset`, in the
 * projection of the map on the page; the land around first, then the colored shapes, then the outline.
 * @param inset room inside the box: top, right, bottom, left
 */
function drawMap(ctx: CanvasRenderingContext2D, box: MapBox, layers: MapLayers, inset: [number, number, number, number]) {
  const [top, right, bottom, left] = inset;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.fillStyle = LIGHT.water;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const projection = geoAlbersUsa().fitExtent([[box.x + left, box.y + top], [box.x + box.w - right, box.y + box.h - bottom]],
    { type: 'FeatureCollection', features: layers.fit });
  const path = geoPath(projection, ctx);
  ctx.lineJoin = 'round';
  const fillAll = (shapes: { shape: Feature; fill: string }[], line: string, width: number) => {
    for (const { shape, fill } of shapes) {
      ctx.beginPath();
      path(shape);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  };
  fillAll(layers.around.map((shape) => ({ shape, fill: LIGHT.mid })), LIGHT.sheet, 1);
  fillAll(layers.shapes, LIGHT.sheet, 0.8);
  ctx.strokeStyle = LIGHT.fg;
  ctx.lineWidth = 1.4;
  for (const shape of layers.outline) {
    ctx.beginPath();
    path(shape);
    ctx.stroke();
  }
  ctx.restore();
}

/** The legend of the district colors on a pale card: a bar from 20% to 80% with its numbers, both ends named. */
function shareLegend(ctx: CanvasRenderingContext2D, f: Faces, colors: Colors, x: number, y: number, w: number) {
  ctx.fillStyle = LIGHT.sheet;
  ctx.fillRect(x - 14, y - 14, w + 28, 80);
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  for (const stop of shareStops()) gradient.addColorStop(stop.offset, colors.share(stop.value));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, 12);
  ctx.font = `14px ${f.body}`;
  ctx.fillStyle = LIGHT.muted;
  ctx.textAlign = 'center';
  for (const tick of shareTicks()) ctx.fillText(tick.label, x + tick.offset * w, y + 32);
  ctx.textAlign = 'left';
  ctx.fillText(LEGEND_TEXT.low, x, y + 52);
  ctx.textAlign = 'right';
  ctx.fillText(LEGEND_TEXT.high, x + w, y + 52);
  ctx.textAlign = 'left';
}

/** The big number of a card with the bar of its color before it; returns the y under it. */
function bigNumber(ctx: CanvasRenderingContext2D, f: Faces, text: string, color: string, y: number): number {
  ctx.fillStyle = color;
  ctx.fillRect(PAD, y + 4, 12, 48);
  ctx.font = `700 56px ${f.head}`;
  ctx.fillStyle = LIGHT.fg;
  ctx.fillText(text, PAD + 24, y + 48);
  return y + 62;
}

/**
 * One state as a 16:9 card: on the left its name, the drawing effect large and the three counts; on the right, to the
 * edges of the image, its districts by Democratic share among the pale states around it, with the legend on the water.
 * A state with one seat gets its two lines and its outline in gray.
 * @param state the outline of the state
 * @param districts its districts
 * @param around the states around it, drawn pale
 * @param shareOf the Democratic share of each district
 */
export function drawState(canvas: HTMLCanvasElement, g: StateGraphic, colors: Colors,
  { state, districts, around, shareOf }: { state: StateShape; districts: DistrictShape[]; around: StateShape[]; shareOf: Record<string, number> }) {
  const f = faces();
  render(canvas, (ctx) => {
    let y = PAD - 8;
    y = paragraph(ctx, g.title, PAD, y, COL_W, `700 46px ${f.head}`, LIGHT.fg, 54);
    y = paragraph(ctx, g.meta, PAD, y + 2, COL_W, `16px ${f.body}`, LIGHT.muted, 22) + 22;
    if (g.headline) {
      y = bigNumber(ctx, f, g.headline.value, colors.effect(g.headline.drawing), y);
      y = paragraph(ctx, g.headline.sentence, PAD, y, COL_W, `17px ${f.body}`, LIGHT.fg, 24) + 16;
      ctx.fillStyle = LIGHT.rule;
      ctx.fillRect(PAD, y, COL_W, 1);
      for (const row of g.rows) {
        ctx.font = `600 18px ${f.body}`;
        ctx.fillStyle = LIGHT.fg;
        ctx.fillText(row.label, PAD, y + 32);
        ctx.font = `700 34px ${f.head}`;
        ctx.textAlign = 'right';
        ctx.fillText(row.value, PAD + COL_W, y + 36);
        ctx.textAlign = 'left';
        y += 50;
        ctx.fillStyle = LIGHT.rule;
        ctx.fillRect(PAD, y, COL_W, 1);
      }
      y = paragraph(ctx, g.seatsOf, PAD, y + 8, COL_W, `14px ${f.body}`, LIGHT.muted, 20);
    } else {
      for (const line of g.lines) y = paragraph(ctx, line, PAD, y, COL_W, `18px ${f.body}`, LIGHT.fg, 26) + 10;
    }
    // the map from the column to the right and top edges, down to the foot
    const x = PAD + COL_W + 36;
    const box = { x, y: 0, w: W - x, h: Math.max(y, WIDE_H - FOOT_ROOM) };
    const fill = (d: DistrictShape) => (g.single ? colors.blank : colors.share(shareOf[d.properties.id]));
    drawMap(ctx, box, { fit: [state], around, shapes: districts.map((d) => ({ shape: d, fill: fill(d) })), outline: [state] },
      [28, 28, g.single ? 28 : 112, 28]);
    if (!g.single) shareLegend(ctx, f, colors, box.x + 30, box.y + box.h - 78, 300);
    return drawFoot(ctx, f, g.foot, box.h + 26);
  });
  canvas.setAttribute('aria-label', g.alt);
}

/**
 * All states as a 16:9 card: the net large and the sums on the left with the key under them, the map of the states in
 * the color of their drawing effect to the right and top edges, the six states with one seat gray.
 * @param drawingOf the drawing effect of a state, null for a state with one seat
 */
export function drawStatesMap(canvas: HTMLCanvasElement, g: StatesMapGraphic, colors: Colors,
  { states, drawingOf }: { states: StateShape[]; drawingOf: (postal: Postal) => number | null }) {
  const f = faces();
  render(canvas, (ctx) => {
    let y = PAD - 8;
    y = paragraph(ctx, g.title, PAD, y, COL_W, `700 40px ${f.head}`, LIGHT.fg, 48);
    y = paragraph(ctx, g.note, PAD, y + 4, COL_W, `16px ${f.body}`, LIGHT.muted, 22) + 22;
    y = bigNumber(ctx, f, g.net, colors.effect(g.netValue), y);
    y = paragraph(ctx, g.summary, PAD, y, COL_W, `17px ${f.body}`, LIGHT.fg, 24) + 24;
    // the key: thirteen boxes from R+6 to D+6, every second one named
    const boxes = effectBoxes();
    const size = COL_W / boxes.length;
    ctx.font = `13px ${f.body}`;
    ctx.textAlign = 'center';
    boxes.forEach((b, i) => {
      ctx.fillStyle = colors.effect(b.value);
      ctx.fillRect(PAD + i * size + 1, y, size - 2, 14);
      if (b.label) {
        ctx.fillStyle = LIGHT.muted;
        ctx.fillText(b.label, PAD + i * size + size / 2, y + 32);
      }
    });
    ctx.textAlign = 'left';
    y += 40;
    const x = PAD + COL_W + 36;
    const box = { x, y: 0, w: W - x, h: Math.max(y, WIDE_H - FOOT_ROOM) };
    const fill = (postal: Postal) => { const d = drawingOf(postal); return d === null ? colors.blank : colors.effect(d); };
    drawMap(ctx, box, { fit: states, around: [], shapes: states.map((s) => ({ shape: s, fill: fill(s.properties.postal) })), outline: [] },
      [24, 24, 24, 24]);
    return drawFoot(ctx, f, g.foot, box.h + 26);
  });
  canvas.setAttribute('aria-label', g.alt);
}

/** Save the canvas as a PNG file with this name. */
export function download(canvas: HTMLCanvasElement, file: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');
}

/**
 * The block "Graphics to reuse": draws both images, fills in their captions and wires the buttons. Both use the 2016
 * and 2020 votes, as the site opens, whatever the slider in chapter 01 shows; they follow the colors chosen under the
 * map (palette).
 */
export function mountGraphics(results: Results, view: OutcomesView, palette: Palette) {
  const card = (id: string) => {
    const root = document.getElementById(id)!;
    return { root, canvas: root.querySelector('canvas')!, caption: root.querySelector<HTMLElement>('.caption')! };
  };
  const nationalCard = card('graphic-national');
  const statesCard = card('graphic-states');
  const states = statesGraphic(results, view);
  const national = nationalGraphic(results, view, view.baseIndex);
  let colors = lightColors(palette);
  const drawNationalCard = () => {
    drawNational(nationalCard.canvas, national, colors);
    nationalCard.caption.textContent = national.caption;
  };
  const drawStatesCard = () => {
    drawStates(statesCard.canvas, states, colors);
    statesCard.caption.textContent = states.caption;
  };
  const on = (c: ReturnType<typeof card>, action: string, run: () => void) =>
    c.root.querySelector(`[data-action="${action}"]`)!.addEventListener('click', run);
  on(nationalCard, 'download', () => download(nationalCard.canvas, national.file));
  on(nationalCard, 'copy', () => { void copyCaption(national.caption); });
  on(statesCard, 'download', () => download(statesCard.canvas, states.file));
  on(statesCard, 'copy', () => { void copyCaption(states.caption); });
  drawNationalCard();
  drawStatesCard();
  return {
    palette(next: Palette) {
      colors = lightColors(next);
      drawNationalCard();
      drawStatesCard();
    },
  };
}

/** Copy a caption, with a short note as after copying a link; without a clipboard the caption stays on the page to select. */
export const copyCaption = (text: string): Promise<void> => copy(text, 'Caption copied');
