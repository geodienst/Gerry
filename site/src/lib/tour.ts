// Timing of the explainer at the top of chapter 01; ui/tour.ts plays the steps.

/** Reading time for one step: about 20 characters a second plus a pause, at most 11 seconds. */
export function stepTime(text: string, fixed = 0): number {
  return fixed > 0 ? fixed : Math.min(11000, 1500 + 50 * text.length);
}
