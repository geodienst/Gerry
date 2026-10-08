// Texts and view models for the four chapters of the redesign (docs/superpowers/specs/2026-10-08-redesign-design.md).
// Pure, like model.js and extensions.js: no DOM and no d3, every number through format.js, nothing new computed.
import { seats, count, effect, effectWords } from './format.js';
import { nationalView } from './model.js';

export const LABELS = { proportional: 'Vote-proportional', neutral: 'Neutral-map median', enacted: 'Enacted maps' };
// The rows of dots (drawDotRows) have 112 units for a label: there the short forms (owner decision, October 8, 2026).
export const SHORT_LABELS = { proportional: 'Proportional', neutral: 'Neutral median', enacted: 'Enacted' };
export const EFFECT_LABELS = { geographic: 'Geographic effect', drawing: 'Drawing effect' };

const sum = (values) => values.reduce((a, b) => a + b, 0);
// "217 to 229", or one number if both ends are equal
const range = (lo, hi) => (lo === hi ? seats(lo) : `${seats(lo)} to ${seats(hi)}`);

// --- Chapter 01: one electorate, three outcomes (Task 7.3) --------------------------------------

/** Everything chapter 01 shows: the three rows, the effects between them, the band and the sentences beside the waffle. */
export function outcomesView(results) {
  const n = results.national;
  const national = nationalView(results);
  const states = count(Object.keys(results.states).length);
  const plans = count(sum(Object.values(results.states)[0].neutral.dist));
  const { median, p5, p95 } = n.neutral;
  const band = p5 === p95 ? `90% of outcomes give ${seats(p5)}` : `90% of outcomes: ${seats(p5)} to ${seats(p95)}`;
  const where = n.enacted < p5 ? 'below that range' : n.enacted > p95 ? 'above that range' : 'within that range';
  const step = (key, value, from, to) => ({
    key, label: EFFECT_LABELS[key], value: effect(value), words: effectWords(value),
    detail: `${effectWords(value)} (${seats(from)} to ${seats(to)})`,
  });
  return {
    intro: `Democratic seats in the ${states} states with more than one seat, counted three ways with the same votes. `
      + 'Select a row to see it as seats.',
    total: n.seats,
    rows: [
      { key: 'proportional', label: LABELS.proportional, seats: n.proportional, value: seats(n.proportional),
        desc: "Each state's seats in proportion to its two-party vote." },
      { key: 'neutral', label: LABELS.neutral, seats: median, value: seats(median),
        desc: `The middle outcome of the neutral maps. ${band}.` },
      { key: 'enacted', label: LABELS.enacted, seats: n.enacted, value: seats(n.enacted),
        desc: 'The maps used on November 3, 2026.' },
    ],
    steps: [
      step('geographic', n.effects.geographic, n.proportional, median),
      step('drawing', n.effects.drawing, median, n.enacted),
    ],
    band: {
      lo: p5, hi: p95,
      key: `Outlined: ${p5 === p95 ? 'seat' : 'seats'} ${range(p5, p95)}, where the Democratic seats end in 90% of neutral outcomes`,
    },
    effectsNote: 'The geographic effect is the difference between proportional seats and neutral maps. '
      + 'The drawing effect is the difference between neutral maps and the enacted maps.',
    spread: `90% of neutral outcomes give Democrats ${range(p5, p95)} seats. The enacted maps give ${seats(n.enacted)}, ${where}.`,
    position: national.position,
    neutralNote: `The neutral maps come from the ALARM Project. For each state a computer drew ${plans} maps that follow `
      + "the state's rules, such as equal population and the Voting Rights Act, without using party data. "
      + `The national figures combine the ${states} states.`,
    scope: national.note,
  };
}

/** The line above the waffle and its title, for the chosen row. */
export function waffleText(view, key) {
  const row = view.rows.find((r) => r.key === key);
  const rest = view.total - row.seats;
  return {
    d: seats(row.seats),
    r: seats(rest),
    label: `${row.label}: ${seats(row.seats)} Democratic and ${seats(rest)} Republican seats of ${seats(view.total)}.`,
  };
}
