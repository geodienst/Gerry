// Draws the two images of lib/graphics.ts on a canvas, in the light colors and the typefaces of the site, and hands
// them out as PNG files; the caption under each can be copied. No outside services.
import { interpolateLab } from 'd3';
import { makeColors, EFFECT_MAX } from '../lib/colors.ts';
import { LIGHT, nationalGraphic, statesGraphic } from '../lib/graphics.ts';
import type { GraphicFoot, NationalGraphic, StatesGraphic } from '../lib/graphics.ts';
import type { OutcomesView } from '../lib/chapters.ts';
import type { Colors } from '../lib/colors.ts';
import type { Palette, Results } from '../types.ts';

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

/** The national comparison: a bar of the House for each count, Democrats from the left, the majority line across. */
export function drawNational(canvas: HTMLCanvasElement, g: NationalGraphic, colors: Colors) {
  const f = faces();
  render(canvas, (ctx) => {
    let y = PAD - 8;
    y = paragraph(ctx, g.title, PAD, y, W - 2 * PAD, `700 44px ${f.head}`, LIGHT.fg, 54);
    y = paragraph(ctx, g.lead, PAD, y + 8, 960, `600 24px ${f.head}`, LIGHT.fg, 33) + 34;
    const barX = 380;
    const barW = W - PAD - 150 - barX;
    const x = (seatCount: number) => barX + (barW * seatCount) / g.total;
    // the parties at both ends and the majority line, above the first bar
    ctx.font = `600 16px ${f.body}`;
    ctx.fillStyle = colors.party(true);
    ctx.fillRect(barX, y - 12, 12, 12);
    ctx.fillStyle = LIGHT.fg;
    ctx.fillText('Democrats', barX + 18, y);
    ctx.textAlign = 'right';
    ctx.fillText('Republicans', barX + barW - 18, y);
    ctx.fillStyle = colors.party(false);
    ctx.fillRect(barX + barW - 12, y - 12, 12, 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = LIGHT.fg;
    ctx.fillText(g.majorityLabel, x(g.majority - 0.5), y);
    ctx.textAlign = 'left';
    const rowsTop = y + 14;
    const rowH = 104;
    g.rows.forEach((row, i) => {
      const top = rowsTop + i * rowH;
      paragraph(ctx, row.label, PAD, top, barX - PAD - 24, `600 20px ${f.body}`, LIGHT.fg, 26);
      paragraph(ctx, row.desc, PAD, top + 28, barX - PAD - 24, `15px ${f.body}`, LIGHT.muted, 20);
      const split = x(row.seats);
      ctx.fillStyle = colors.party(true);
      ctx.fillRect(barX, top + 4, split - barX - 1, 36);
      ctx.fillStyle = colors.party(false);
      ctx.fillRect(split + 1, top + 4, barX + barW - split - 1, 36);
      if (row.key === 'neutral') {
        ctx.strokeStyle = LIGHT.fg;
        ctx.lineWidth = 2;
        ctx.strokeRect(x(g.band.lo - 1), top - 1, x(g.band.hi) - x(g.band.lo - 1), 46);
      }
      ctx.font = `700 44px ${f.head}`;
      ctx.fillStyle = LIGHT.fg;
      ctx.textAlign = 'right';
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
    const rowsBottom = rowsTop + (g.rows.length - 1) * rowH + 48;
    // the majority line over the bars
    ctx.strokeStyle = LIGHT.fg;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x(g.majority - 0.5), rowsTop);
    ctx.lineTo(x(g.majority - 0.5), rowsBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    return drawFoot(ctx, f, g.foot, rowsBottom + 36);
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
 * The block "Graphics to reuse": draws both images, fills in their captions and wires the buttons. The national
 * image follows the stop of the slider in chapter 01 (point) and both follow the colors chosen under the map (palette).
 */
export function mountGraphics(results: Results, view: OutcomesView, palette: Palette) {
  const card = (id: string) => {
    const root = document.getElementById(id)!;
    return { root, canvas: root.querySelector('canvas')!, caption: root.querySelector<HTMLElement>('.caption')! };
  };
  const nationalCard = card('graphic-national');
  const statesCard = card('graphic-states');
  const states = statesGraphic(results, view);
  let index = view.baseIndex;
  let national = nationalGraphic(results, view, index);
  let colors = lightColors(palette);
  const drawNationalCard = () => {
    drawNational(nationalCard.canvas, national, colors);
    nationalCard.caption.textContent = national.caption;
  };
  const drawStatesCard = () => {
    drawStates(statesCard.canvas, states, colors);
    statesCard.caption.textContent = states.caption;
  };
  // While the slider moves, the caption follows at once and the image a moment after the last stop: it lies far
  // below the slider, and drawing 2400 pixels at every stop would slow the slider on a phone.
  let pending = 0;
  const flush = () => {
    if (!pending) return;
    clearTimeout(pending);
    pending = 0;
    drawNationalCard();
  };
  const on = (c: ReturnType<typeof card>, action: string, run: () => void) =>
    c.root.querySelector(`[data-action="${action}"]`)!.addEventListener('click', run);
  on(nationalCard, 'download', () => { flush(); download(nationalCard.canvas, national.file); });
  on(nationalCard, 'copy', () => { void copyCaption(national.caption); });
  on(statesCard, 'download', () => download(statesCard.canvas, states.file));
  on(statesCard, 'copy', () => { void copyCaption(states.caption); });
  drawNationalCard();
  drawStatesCard();
  return {
    point(at: number) {
      if (at === index) return;
      index = at;
      national = nationalGraphic(results, view, index);
      nationalCard.caption.textContent = national.caption;
      nationalCard.canvas.setAttribute('aria-label', national.alt);
      clearTimeout(pending);
      pending = window.setTimeout(() => { pending = 0; drawNationalCard(); }, 150);
    },
    palette(next: Palette) {
      colors = lightColors(next);
      clearTimeout(pending);
      pending = 0;
      drawNationalCard();
      drawStatesCard();
    },
  };
}

/** Copy a caption, with a short note as after copying a link. */
export async function copyCaption(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const note = document.createElement('p');
    note.className = 'share-note';
    note.setAttribute('role', 'status');
    note.textContent = 'Caption copied';
    document.body.append(note);
    setTimeout(() => note.remove(), 2000);
  } catch { /* no clipboard: the caption stays on the page to select */ }
}
