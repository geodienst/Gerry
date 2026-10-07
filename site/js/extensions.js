// Texts and view models for the extensions (docs/superpowers/specs/2026-10-06-extensions-design.md,
// chapters 1 to 4 and 7), from the results.json fields of Phase 5. Pure, like model.js.
import { share, seats, count, effect, effectLine } from './format.js';

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
      + 'in both 2016 and 2020: Delaware and Vermont for Democrats; Alaska, North Dakota, South Dakota and Wyoming '
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

// --- Redraws since 2024 (Task 6.11) -------------------------------------------------------------

const plural = (n, one, many) => (n === 1 ? one : many);

/** National: the net change and the states whose seat count changed, from large R to large D. */
export function redrawView(results) {
  const n = results.national.redraw;
  const rows = Object.entries(results.states)
    .filter(([, s]) => s.redraw.change !== 0)
    .map(([postal, s]) => ({ postal, name: s.name, change: s.redraw.change, text: effectLine(s.redraw.change) }))
    .sort((a, b) => a.change - b.change || a.name.localeCompare(b.name, 'en'));
  return {
    sentence: `With these votes, the maps of the 2024 election give Democrats ${seats(n.seats_2024)} seats and the 2026 maps `
      + `${seats(results.national.enacted)}. Net change: ${effectLine(n.change)}.`,
    rows,
  };
}

/** In the sheet: "2024 map: 14 Democratic seats with these votes. 2026 map: 11 (3 fewer)." */
export function stateRedraw(state) {
  const r = state.redraw;
  if (!r.map_changed) return 'Map unchanged since 2024.';
  const difference = r.change === 0 ? 'the same number' : `${count(Math.abs(r.change))} ${r.change < 0 ? 'fewer' : 'more'}`;
  return `2024 map: ${seats(r.seats_2024)} Democratic ${plural(r.seats_2024, 'seat', 'seats')} with these votes. `
    + `2026 map: ${seats(state.enacted)} (${difference}).`;
}

/** The lines the extensions add to a state's sheet: under the heading, and after "Districts, sorted". */
export function stateExtras(results, postal) {
  const s = results.states[postal];
  const adopted = adoptedLine(s.adopted);
  return {
    head: [adopted.line, adopted.note].filter(Boolean),
    body: [competitiveText(s.competitive, 'map'), stateRedraw(s)],
  };
}

// --- Competitive districts (Task 6.12) ----------------------------------------------------------

/** "Competitive districts (45 to 55%): 2 on the enacted map, 6 on neutral maps (4 to 8)." */
export function competitiveText(c, maps) {
  const band = c.p5 === c.p95 ? '' : ` (${count(c.p5)} to ${count(c.p95)})`;
  return `Competitive districts (45 to 55%): ${count(c.enacted)} on the enacted ${maps}, ${count(c.median)} on neutral maps${band}.`;
}

// --- Who adopted the map (Task 6.13) ------------------------------------------------------------

export const CONTROL_LABELS = {
  Republican: 'Republican control', Democratic: 'Democratic control', Bipartisan: 'Bipartisan', Nonpartisan: 'Nonpartisan',
};

/** "Adopted by: Legislature (Republican control)." with the optional note. */
export function adoptedLine(adopted) {
  const control = adopted.control === 'Republican' || adopted.control === 'Democratic'
    ? CONTROL_LABELS[adopted.control] : adopted.control.toLowerCase();
  return { line: `Adopted by: ${adopted.by} (${control}).`, note: adopted.note ?? '' };
}

/** The two tables: per political control and per body, with states, seats and the summed drawing effect. */
export function controlTables(results) {
  const rows = (entries, label) => Object.entries(entries).map(([key, v]) => ({
    key, label: label(key), states: count(v.states), seats: seats(v.seats), drawing: effect(v.drawing),
  }));
  return {
    byControl: rows(results.national.by_control, (key) => CONTROL_LABELS[key]),
    byBody: rows(results.national.by_body, (key) => key),
    note: 'In these tables the drawing effect is the sum of the drawing effects of the states in a row. The national '
      + 'drawing effect uses the national neutral baseline instead, so the two can differ.',
  };
}
