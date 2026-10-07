// Texts and view models for the extensions (docs/superpowers/specs/2026-10-06-extensions-design.md,
// chapters 1 to 4 and 7), from the results.json fields of Phase 5. Pure, like model.js.
import { share, seats, count } from './format.js';

// --- Majority threshold (Task 6.10) -------------------------------------------------------------

/** The House majority block: the sentence, the fixed rule for the six single-seat states and the vote axis. */
export function majorityView(results) {
  const m = results.national.majority;
  const states = count(Object.keys(results.states).length);
  return {
    sentence: `With these votes, Democrats need ${share(m.enacted.share)} of the two-party vote for a House majority `
      + `under the enacted maps, ${share(m.neutral.share)} under neutral maps and ${share(m.proportional.share)} `
      + `if seats followed the vote. They have ${share(m.base_share)}.`,
    proportionalNote: m.proportional.share < 0.5
      ? `Proportional needs less than half of the vote because each state rounds its seats to whole numbers on its own, and over ${states} states those roundings do not cancel out.`
      : '',
    rule: 'A majority is 218 of the 435 seats. The six states with one seat count for the party that won them '
      + 'in both 2016 and 2020: Delaware and Vermont for Democrats, Alaska, North Dakota, South Dakota and Wyoming '
      + `for Republicans. So Democrats need ${seats(m.seats_needed)} of the ${seats(results.national.seats)} districts.`,
    axis: {
      base: m.base_share, low: m.neutral.low, high: m.neutral.high,
      marks: [
        { key: 'proportional', value: m.proportional.share, text: `Proportional ${share(m.proportional.share)}` },
        { key: 'neutral', value: m.neutral.share, text: `Neutral ${share(m.neutral.share)}` },
        { key: 'enacted', value: m.enacted.share, text: `Enacted ${share(m.enacted.share)}` },
      ],
      baseText: `Vote ${share(m.base_share)}`,
    },
    label: `Share of the two-party vote that Democrats need for a House majority: enacted maps ${share(m.enacted.share)}, `
      + `neutral maps ${share(m.neutral.share)} (90% of outcomes between ${share(m.neutral.low)} and ${share(m.neutral.high)}), `
      + `proportional ${share(m.proportional.share)}. Their share is ${share(m.base_share)}.`,
  };
}

/** Text for the [data-fill] spans that the extensions add to the method section. */
export function extensionFills(results) {
  return {
    'majority-seats': seats(results.national.majority.seats_needed),
    seats: seats(results.national.seats),
  };
}
