// Color scales for the map, the legends and the charts (site design, chapter 3).
// Pure: the caller passes d3.interpolateLab and the poles, read from the CSS
// tokens, so dark mode and the "Party colors / Neutral colors" toggle only
// swap the poles. node --test runs this module with the vendored d3.
import { effect, percentLabel } from './format.js';

export const SHARE_DOMAIN = [0.2, 0.8]; // district scale; outside it the full pole color
export const SHARE_EXPONENT = 0.85; // as in preview version 5
export const SHARE_TICKS = [0.2, 0.35, 0.5, 0.65, 0.8];
export const EFFECT_MAX = 6; // drawing effect scale in whole seats; beyond 6 the full pole color
export const EFFECT_START = 0.3; // effects start 30% of the way to a pole; each seat adds 70%/6 (preview version 5)

/**
 * The scales for one set of poles.
 * @param {(a: string, b: string) => (t: number) => string} interpolateLab d3.interpolateLab
 * @param {{d: string, r: string, mid: string, blank: string}} poles CSS colors
 */
export function makeColors(interpolateLab, poles) {
  const towardD = interpolateLab(poles.mid, poles.d);
  const towardR = interpolateLab(poles.mid, poles.r);
  const half = (SHARE_DOMAIN[1] - SHARE_DOMAIN[0]) / 2;
  return {
    poles,
    blank: poles.blank,
    /** Fill for a district's Democratic share (fraction), 50% is the midpoint. */
    share(value) {
      const t = Math.max(-1, Math.min(1, (value - 0.5) / half));
      return (t >= 0 ? towardD : towardR)(Math.abs(t) ** SHARE_EXPONENT);
    },
    /** Fill for a drawing effect in whole seats, 0 is the midpoint. */
    effect(seats) {
      if (seats === 0) return towardD(0);
      const t = EFFECT_START + ((1 - EFFECT_START) * Math.min(Math.abs(seats), EFFECT_MAX)) / EFFECT_MAX;
      return (seats > 0 ? towardD : towardR)(t);
    },
    /** Fill for a seat count that goes to one party: the full pole. */
    party(towardDemocrats) {
      return towardDemocrats ? poles.d : poles.r;
    },
  };
}

/** Stops for the district legend's color bar: offset 0 to 1 over 20% to 80%. */
export function shareStops(count = 25) {
  const [low, high] = SHARE_DOMAIN;
  return Array.from({ length: count }, (_, i) => {
    const offset = i / (count - 1);
    return { offset, value: low + (high - low) * offset };
  });
}

/** Labels under the district legend: 20%, 35%, 50%, 65%, 80%, with their offset on the bar. */
export function shareTicks() {
  const [low, high] = SHARE_DOMAIN;
  return SHARE_TICKS.map((value) => ({ offset: (value - low) / (high - low), label: percentLabel(value) }));
}

/** Thirteen boxes from R+6 to D+6; every second one has a label (site design, chapter 3). */
export function effectBoxes() {
  return Array.from({ length: 2 * EFFECT_MAX + 1 }, (_, i) => {
    const value = i - EFFECT_MAX;
    return { value, label: value % 2 === 0 ? effect(value) : null };
  });
}
