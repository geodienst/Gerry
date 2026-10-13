// Tests for site/js/extensions.js on testdata.js plus made-up extension fields
// (shape: "Interfaces" of docs/superpowers/plans/2026-10-06-extensions.md). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results } from './testdata.js';
import {
  extensionFills, redrawView, stateRedraw, stateExtras, competitiveText, adoptedLine, controlTables,
  senateView,
} from './extensions.js';

/** testdata.js with the Phase 5 fields; all numbers made up, with 7 states and 429 seats nationally. */
function extended() {
  const r = results();
  r.national.majority = {
    seats_needed: 216, base_share: 0.5179747,
    enacted: { share: 0.5230328, seats_at_base: 213 },
    neutral: { share: 0.5115747, low: 0.5065747, high: 0.5159747, probability_at_base: 0.9853454 },
    proportional: { share: 0.4978747 },
  };
  r.national.redraw = { seats_2024: 217, change: -4 };
  for (const s of Object.values(r.states)) s.redraw = { seats_2024: s.enacted, change: 0, map_changed: false };
  r.states.TX.redraw = { seats_2024: 3, change: -3, map_changed: true }; // enacted 0
  r.states.CA.redraw = { seats_2024: 0, change: 1, map_changed: true }; // enacted 1
  r.states.FL.redraw = { seats_2024: 1, change: 0, map_changed: true }; // new map, same seats
  r.national.by_control = {
    Republican: { states: 2, seats: 6, drawing: -6 }, Democratic: { states: 2, seats: 4, drawing: 4 },
    Bipartisan: { states: 1, seats: 2, drawing: 0 }, Nonpartisan: { states: 2, seats: 14, drawing: 0 },
  };
  r.national.by_body = {
    Legislature: { states: 5, seats: 16, drawing: -2 }, Commission: { states: 1, seats: 2, drawing: 0 },
    Court: { states: 1, seats: 8, drawing: 0 },
  };
  r.national.senate = {
    base_share: 0.5172, states_needed: 26, share: 0.5291, states_at_base: 22, seats_at_base: 44,
    tipping: [{ postal: 'WI', share: 0.5051 }],
  };
  // the Senate seats on the ballot in 2026 (owner, October 13, 2026): five made-up seats, 48 D and 47 R not on it
  r.national.senate_2026 = {
    checked: '2026-10-13', base_share: 0.518, up: 5, held: { D: 2, R: 3 }, not_up: { D: 48, R: 47 }, majority: 51,
    needed: 3, share: 0.5301, won_at_base: 2, seats_at_base: 50,
    seats: [{ postal: 'DE', share: 0.5796, held: 'D' }, { postal: 'NM', share: 0.5514, held: 'D' },
      { postal: 'FL', share: 0.4879, held: 'R' }, { postal: 'TX', share: 0.4635, held: 'R' },
      { postal: 'WY', share: 0.2603, held: 'R' }],
  };
  return r;
}

test('extensionFills: the numbers in the method paragraph "Extensions"', () => {
  // the House of 435 and its majority of 218 (seats_needed 216 of the districts + the 2 Democratic single seats)
  // the Senate in the method: 26 states, all 100 seats at once 0.5291 -> 53.0%, the list of October 13, 2026
  assert.deepEqual(extensionFills(extended()), { 'house-seats': '435', 'house-majority': '218', 'senate-states': '26',
    'senate-all': '53.0%', 'senate-checked': 'October 13, 2026' });
});

// --- redraws since 2024 (Task 6.11) ---

test('redrawView: the net change and the states with another seat count', () => {
  const view = redrawView(extended());
  // seats of 435: 217 and 213 of the districts + the 2 Democratic single seats
  assert.equal(view.sentence, 'With these votes, the maps of the 2024 election give Democrats 219 seats and the 2026 maps 215. '
    + 'Net change: R+4, 4 seats toward Republicans.');
  assert.deepEqual(view.rows.map((r) => [r.postal, r.text]), [
    ['TX', 'R+3: 3 seats toward Republicans'], ['CA', 'D+1: 1 seat toward Democrats'],
  ]);
  // Equal changes in alphabetical order (testdata has NM before HI); FL has a new map with the
  // same seats, so no row.
  const r = extended();
  r.states.NM.redraw = { seats_2024: 0, change: 1, map_changed: true }; // enacted 1
  r.states.HI.redraw = { seats_2024: 1, change: 1, map_changed: true }; // enacted 2
  r.states.LA.redraw = { seats_2024: 2, change: -1, map_changed: true }; // enacted 1
  assert.deepEqual(redrawView(r).rows.map((row) => [row.postal, row.text]), [
    ['TX', 'R+3: 3 seats toward Republicans'], ['LA', 'R+1: 1 seat toward Republicans'],
    ['CA', 'D+1: 1 seat toward Democrats'], ['HI', 'D+1: 1 seat toward Democrats'],
    ['NM', 'D+1: 1 seat toward Democrats'],
  ]);
});

test('stateRedraw: fewer, more, the same number, and an unchanged map', () => {
  const r = extended();
  assert.equal(stateRedraw(r.states.TX), '2024 map: 3 Democratic seats with these votes. 2026 map: 0 (3 fewer).');
  assert.equal(stateRedraw(r.states.CA), '2024 map: 0 Democratic seats with these votes. 2026 map: 1 (1 more).');
  assert.equal(stateRedraw(r.states.FL), '2024 map: 1 Democratic seat with these votes. 2026 map: 1 (the same number).');
  assert.equal(stateRedraw(r.states.MO), 'Map unchanged since 2024.');
});

test('stateExtras: the adopted line under the heading, competitive districts and the redraw after the chart', () => {
  const r = extended();
  r.states.TX.adopted = { by: 'Legislature', control: 'Republican', note: null };
  r.states.TX.competitive = { enacted: 1, median: 2, p5: 1, p95: 3, neutral_dist: [0, 600, 3900, 500, 0] };
  assert.deepEqual(stateExtras(r, 'TX'), {
    head: ['Adopted by: Legislature (Republican control).'],
    body: [
      'Competitive districts (45 to 55%): 1 on the enacted map, 2 on neutral maps (90% of neutral maps: 1 to 3).',
      '2024 map: 3 Democratic seats with these votes. 2026 map: 0 (3 fewer).',
    ],
  });
  r.states.TX.adopted.note = 'A made-up note.';
  assert.deepEqual(stateExtras(r, 'TX').head, ['Adopted by: Legislature (Republican control).', 'A made-up note.']);
});

// --- competitive districts (Task 6.12) ---

test('competitiveText: per state and for the nation, without a band of one value', () => {
  assert.equal(competitiveText({ enacted: 2, median: 6, p5: 4, p95: 8 }, 'map'),
    'Competitive districts (45 to 55%): 2 on the enacted map, 6 on neutral maps (90% of neutral maps: 4 to 8).');
  assert.equal(competitiveText({ enacted: 81, median: 96, p5: 87, p95: 105 }, 'maps'),
    'Competitive districts (45 to 55%): 81 on the enacted maps, 96 on neutral maps (90% of neutral maps: 87 to 105).');
  assert.equal(competitiveText({ enacted: 0, median: 0, p5: 0, p95: 0 }, 'map'),
    'Competitive districts (45 to 55%): 0 on the enacted map, 0 on neutral maps.');
});

// --- who adopted the map (Task 6.13) ---

test('adoptedLine: body and control, with the note', () => {
  assert.deepEqual(adoptedLine({ by: 'Legislature', control: 'Republican', note: null }),
    { line: 'Adopted by: Legislature (Republican control).', note: '' });
  assert.equal(adoptedLine({ by: 'Legislature', control: 'Democratic', note: null }).line, 'Adopted by: Legislature (Democratic control).');
  assert.deepEqual(adoptedLine({ by: 'Commission', control: 'Bipartisan', note: 'A made-up note.' }),
    { line: 'Adopted by: Commission (bipartisan).', note: 'A made-up note.' });
  assert.equal(adoptedLine({ by: 'Court', control: 'Nonpartisan', note: null }).line, 'Adopted by: Court (nonpartisan).');
});

test('controlTables: every value in order, with states, seats and the summed drawing effect', () => {
  const tables = controlTables(extended());
  assert.deepEqual(tables.byControl.map((r) => [r.label, r.states, r.seats, r.drawing]), [
    ['Republican control', '2', '6', 'R+6'], ['Democratic control', '2', '4', 'D+4'],
    ['Bipartisan', '1', '2', '0'], ['Nonpartisan', '2', '14', '0'],
  ]);
  assert.deepEqual(tables.byBody.map((r) => [r.label, r.drawing]), [['Legislature', 'R+2'], ['Commission', '0'], ['Court', '0']]);
});

// --- the Senate (Task 6.14) ---

test('senateView: the seats on the ballot in 2026, the threshold and the seat that decides', () => {
  // By hand: 5 seats up, 95 not (48 D, 47 R); 51 needed, so 3 of the 5; neededShare(0.5301) -> 53.1%; the 3rd seat is
  // Florida's, share(0.4879) -> 48.8%.
  const view = senateView(extended());
  assert.equal(view.title, 'Senate in 2026');
  assert.deepEqual(view.needed, { value: '53.1%', label: 'needed for a majority' });
  assert.equal(view.sentence, 'On November 3, 5 of the 100 seats are on the ballot. Of the other 95, Democrats hold 48 and '
    + 'Republicans 47. At 50 to 50 the vice president, a Republican, decides, so Democrats need 51 seats: 3 of the 5 on the '
    + "ballot. If each of those seats went to the party that wins its state's presidential vote, Democrats would need 53.1% "
    + 'of the two-party vote. Ranked by that vote, the 3rd seat is in Florida, where Democrats won 48.8% in 2016 and 2020 '
    + 'together.');
  assert.ok(view.note.startsWith('Senate races depend more on the candidates than House races'));
  assert.ok(view.note.endsWith('The Senate has no districts, so none of this is an effect of maps.'));
});

test('senateView.at: the seats at a stop of the vote slider and the seats that change party', () => {
  const view = senateView(extended());
  // the base: Delaware and New Mexico above one half, both held by Democrats: 48 + 2 = 50, nothing changes
  const base = view.at({ share: 0.518, label: '51.8%', base: true });
  assert.deepEqual([base.seats, base.figure], [50, { value: '50 of 100', label: 'Democratic seats at 51.8%' }]);
  assert.equal(base.text, 'With the 2016 and 2020 votes (51.8%), as on the vote slider in chapter 01, Democrats would win 2 '
    + 'of the 5 seats on the ballot and hold 50 of 100. No seat changes party.');
  // 55.0%: a shift of 3.2 points takes Florida (0.5199) but not Texas (0.4955): 51 of 100
  const up = view.at({ share: 0.55, label: '55.0%', base: false });
  assert.equal(up.text, 'At 55.0% of the vote, as on the vote slider in chapter 01, Democrats would win 3 of the 5 seats on '
    + 'the ballot and hold 51 of 100. Seats that change party: Florida to Democrats.');
  // 45.0%: New Mexico drops to 0.4834
  assert.ok(view.at({ share: 0.45, label: '45.0%', base: false }).text.endsWith('Seats that change party: New Mexico to Republicans.'));
});
