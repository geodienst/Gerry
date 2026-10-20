// Color scales for the map, the legends and the charts (site design, chapter 3).
// Pure: the caller passes d3.interpolateLab and the poles, read from the CSS
// tokens, so dark mode and the "Party colors / Neutral colors" toggle only
// swap the poles. node --test runs this module with d3 from node_modules.
import { effect, percentLabel } from './format.ts';

/** The two poles of a palette and the colors in between, as CSS colors read from the tokens. */
export interface Poles {
  d: string;
  r: string;
  mid: string;
  blank: string;
}
export type Interpolate = (a: string, b: string) => (t: number) => string;

export const SHARE_DOMAIN: readonly [number, number] = [0.2, 0.8]; // district scale; outside it the full pole color
export const SHARE_EXPONENT = 0.85; // below 1, so shares near 50% already show some color
export const SHARE_TICKS = [0.2, 0.35, 0.5, 0.65, 0.8];
export const EFFECT_MAX = 6; // drawing effect scale in whole seats; beyond 6 the full pole color
// effects start 45% of the way to a pole and each seat adds 55%/6, so R+1 and D+1 already show color
export const EFFECT_START = 0.45;

/**
 * The scales for one set of poles.
 * @param interpolateLab d3.interpolateLab
 */
export function makeColors(interpolateLab: Interpolate, poles: Poles) {
  const towardD = interpolateLab(poles.mid, poles.d);
  const towardR = interpolateLab(poles.mid, poles.r);
  const half = (SHARE_DOMAIN[1] - SHARE_DOMAIN[0]) / 2;
  return {
    poles,
    blank: poles.blank,
    /** Fill for a district's Democratic share (fraction), 50% is the midpoint. */
    share(value: number): string {
      const t = Math.max(-1, Math.min(1, (value - 0.5) / half));
      return (t >= 0 ? towardD : towardR)(Math.abs(t) ** SHARE_EXPONENT);
    },
    /** Fill for a drawing effect in whole seats, 0 is the midpoint. */
    effect(seats: number): string {
      if (seats === 0) return towardD(0);
      const t = EFFECT_START + ((1 - EFFECT_START) * Math.min(Math.abs(seats), EFFECT_MAX)) / EFFECT_MAX;
      return (seats > 0 ? towardD : towardR)(t);
    },
    /** Fill for a seat count that goes to one party: the full pole. */
    party(towardDemocrats: boolean): string {
      return towardDemocrats ? poles.d : poles.r;
    },
  };
}
export type Colors = ReturnType<typeof makeColors>;

/** Stops for the district legend's color bar: offset 0 to 1 over 20% to 80%. */
export function shareStops(count = 25): { offset: number; value: number }[] {
  const [low, high] = SHARE_DOMAIN;
  return Array.from({ length: count }, (_, i) => {
    const offset = i / (count - 1);
    return { offset, value: low + (high - low) * offset };
  });
}

/** Labels under the district legend: 20%, 35%, 50%, 65%, 80%, with their offset on the bar. */
export function shareTicks(): { offset: number; label: string }[] {
  const [low, high] = SHARE_DOMAIN;
  return SHARE_TICKS.map((value) => ({ offset: (value - low) / (high - low), label: percentLabel(value) }));
}

/** Thirteen boxes from R+6 to D+6; every second one has a label (site design, chapter 3). */
export function effectBoxes(): { value: number; label: string | null }[] {
  return Array.from({ length: 2 * EFFECT_MAX + 1 }, (_, i) => {
    const value = i - EFFECT_MAX;
    return { value, label: value % 2 === 0 ? effect(value) : null };
  });
}
