// The colors of the map and the charts come from the CSS tokens (styles/tokens.css), so dark mode and the
// "Red and blue / Teal and brown" choice only swap the poles.
import { interpolateLab } from 'd3';
import { makeColors } from '../lib/colors.ts';
import type { Palette } from '../types.ts';
import type { Colors } from '../lib/colors.ts';

/** The two poles of a palette, read from the CSS tokens (light or dark). */
function readPoles(palette: Palette) {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    d: token(palette === 'party' ? '--party-d' : '--neutral-d'),
    r: token(palette === 'party' ? '--party-r' : '--neutral-r'),
    mid: token('--mid'),
    blank: token('--blank'),
    tie: token(palette === 'party' ? '--party-tie' : '--neutral-tie'),
  };
}

/** The scales for a palette in the color scheme on screen. */
export const paletteColors = (palette: Palette): Colors => makeColors(interpolateLab, readPoles(palette));
