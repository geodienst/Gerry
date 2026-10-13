// Texts and view models for the extensions (docs/superpowers/specs/2026-10-06-extensions-design.md,
// chapters 1 to 4 and 7), from the results.json fields of Phase 5. Pure, like model.js.
import { share, neededShare, seats, count, effect, effectWords, effectLine, longDate } from './format.js';
import { houseOf } from './model.js';

/** Text for the [data-fill] spans that the extensions add to the method section. */
export function extensionFills(results) {
  return {
    // the House of 435 and its majority: the districts Democrats need plus the Democratic single seats
    'house-seats': seats(houseOf(results).total),
    'house-majority': seats(results.national.majority.seats_needed + houseOf(results).dSingle),
    // the Senate in the method: all 100 seats at once, and the date of the list of seats on the ballot
    'senate-states': count(results.national.senate.states_needed),
    'senate-all': neededShare(results.national.senate.share),
    'senate-checked': longDate(results.national.senate_2026.checked),
  };
}

// --- Redraws since 2024 (Task 6.11) -------------------------------------------------------------

const plural = (n, one, many) => (n === 1 ? one : many);

/** National: the net change and the states whose seat count changed, from large R to large D. */
export function redrawView(results) {
  const n = results.national.redraw;
  const { dSingle } = houseOf(results); // seats of the House of 435, as in chapter 01
  const rows = Object.entries(results.states)
    .filter(([, s]) => s.redraw.change !== 0)
    .map(([postal, s]) => ({ postal, name: s.name, change: s.redraw.change, text: effectLine(s.redraw.change) }))
    .sort((a, b) => a.change - b.change || a.name.localeCompare(b.name, 'en'));
  return {
    sentence: `With these votes, the maps of the 2024 election give Democrats ${seats(n.seats_2024 + dSingle)} seats and the `
      + `2026 maps ${seats(results.national.enacted + dSingle)}. Net change: ${effect(n.change)}, ${effectWords(n.change)}.`,
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

/** "Competitive districts (45 to 55%): 2 on the enacted map, 6 on neutral maps (90% of neutral maps: 4 to 8)." */
export function competitiveText(c, maps) {
  const band = c.p5 === c.p95 ? '' : ` (90% of neutral maps: ${count(c.p5)} to ${count(c.p95)})`;
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
      + 'drawing effect uses the national neutral-map median instead, so the two can differ.',
  };
}

// --- The Senate (Task 6.14; the seats on the ballot in 2026, owner, October 13, 2026) -------------------------

const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const nameList = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

/** The Senate block beside the House majority: the seats on the ballot on November 3, 2026, each going to the party
 *  that wins its state's presidential vote, shifted like the vote slider. at(point) follows the slider of chapter 01. */
export function senateView(results) {
  const s = results.national.senate_2026;
  const names = Object.fromEntries([
    ...Object.entries(results.states).map(([postal, st]) => [postal, st.name]),
    ...results.national.single_seat.map((st) => [st.postal, st.name]),
  ]);
  const key = s.seats[s.needed - 1];
  const tie = s.majority > 50 ? 'a Republican' : 'a Democrat';
  return {
    title: 'Senate in 2026',
    needed: { value: neededShare(s.share), label: 'needed for a majority' },
    sentence: `On November 3, ${count(s.up)} of the 100 seats are on the ballot. Of the other ${count(100 - s.up)}, `
      + `Democrats hold ${count(s.not_up.D)} and Republicans ${count(s.not_up.R)}. At 50 to 50 the vice president, ${tie}, `
      + `decides, so Democrats need ${count(s.majority)} seats: ${count(s.needed)} of the ${count(s.up)} on the ballot. If each `
      + `of those seats went to the party that wins its state's presidential vote, Democrats would need ${neededShare(s.share)} `
      + `of the two-party vote. Ranked by that vote, the ${ordinal(s.needed)} seat is in ${names[key.postal]}, where Democrats `
      + `won ${share(key.share)} in 2016 and 2020 together.`,
    note: 'Senate races depend more on the candidates than House races: in 2020 Susan Collins won Maine while Joe Biden '
      + 'carried it by 9 points. These numbers show how the seats on the ballot lean on presidential votes, not who will win '
      + 'them. The Senate has no districts, so none of this is an effect of maps.',
    /** The seats at one stop of the vote slider ({share, label, base}): the same rule as the pipeline (senate_seats_at). */
    at(point) {
      const swing = point.share - s.base_share;
      const won = s.seats.filter((seat) => seat.share + swing > 0.5);
      const total = s.not_up.D + won.length;
      const toD = won.filter((seat) => seat.held === 'R').map((seat) => names[seat.postal]);
      const toR = s.seats.filter((seat) => seat.held === 'D' && !won.includes(seat)).map((seat) => names[seat.postal]);
      const changes = [toD.length ? `${nameList(toD)} to Democrats` : '', toR.length ? `${nameList(toR)} to Republicans` : '']
        .filter(Boolean);
      const where = point.base ? `With the 2016 and 2020 votes (${point.label})` : `At ${point.label} of the vote`;
      return {
        seats: total,
        figure: { value: `${count(total)} of 100`, label: `Democratic seats at ${point.label}` },
        text: `${where}, as on the vote slider above, Democrats would win ${count(won.length)} of the ${count(s.up)} `
          + `seats on the ballot and hold ${count(total)} of 100. `
          + (changes.length ? `Seats that change party: ${changes.join('; ')}.` : 'No seat changes party.'),
      };
    },
  };
}
