// Tests for site/src/lib/model.ts on the made-up results in testdata.ts. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results, withExtensions } from './testdata.ts';
import type { Results } from '../src/types.ts';
import {
  AT_LARGE_TEXT, indexResults, districtLabel, districtTip, stateTip, tapLine, stateOptions, mapHints,
  isClose, isSwing, closeness, closeTip, closeLegend, MAP_TITLES,
  effectList, positionText, stateSheet, nationalView, methodFills, houseOf, districtShares, closeDistricts,
} from '../src/lib/model.ts';

// --- the map (Task 6.2) ---

test('districtLabel: postal code and the district number without a leading zero', () => {
  assert.equal(districtLabel('4809', 'TX'), 'TX-9');
  assert.equal(districtLabel('0601', 'CA'), 'CA-1');
  assert.equal(districtLabel('3612', 'NY'), 'NY-12');
});

test('indexResults: single-seat states and the share of every district', () => {
  const index = indexResults(results());
  assert.deepEqual(Object.keys(index.single), ['AK', 'DE', 'ND', 'SD', 'VT', 'WY']);
  assert.equal(index.shareOf['4809'], 0.46911980526614294);
  assert.equal(index.shareOf['1502'], 0.7011);
});

test('tooltips: a district, a state, and a single-seat state', () => {
  const index = indexResults(results());
  assert.deepEqual(districtTip(index, '4809', 'TX'), { title: 'TX-9, Texas', lines: ['Democratic share 46.9%'] });
  assert.deepEqual(stateTip(index, 'TX'), {
    title: 'Texas',
    lines: ['Drawing effect R+2: 2 seats toward Republicans', 'Neutral-map median 2, enacted 0 Democratic seats'],
  });
  assert.deepEqual(districtTip(index, '5600', 'WY'), { title: 'Wyoming', lines: [AT_LARGE_TEXT] });
  assert.deepEqual(stateTip(index, 'WY'), { title: 'Wyoming', lines: [AT_LARGE_TEXT] });
  assert.equal(AT_LARGE_TEXT, 'One at-large seat. No districts, so nothing to compare.');
});

test('close races: 45% to 55% Democratic, both ends included, for districts and for whole states', () => {
  assert.deepEqual([0.4499, 0.45, 0.5, 0.55, 0.5501].map(isClose), [false, true, true, true, false]);
  const index = indexResults(results());
  // swing states: 48.5% to 51.5% statewide. CA keeps the testdata default 0.5: a swing
  // state; TX at 46.35% and HI at 66.03% are not; WY has one seat
  assert.deepEqual(['CA', 'TX', 'HI', 'WY'].map((p) => isSwing(index, p)), [true, false, false, false]);
  // dots by the margin between the parties, |2 * share - 1|: under 2 points 'tight', 2 to 5 points 'near'
  assert.deepEqual([0.5, 0.509, 0.51, 0.476, 0.524, 0.525, 0.6].map(closeness), ['tight', 'tight', 'near', 'near', 'near', null, null]);
  assert.equal(MAP_TITLES.close, 'Close districts and swing states');
});

test('closeTip: the district share, marked when close, and the close districts of its state', () => {
  // without the extension fields there is no line for the state
  // TX-9 at 46.91%: close, the parties 6.2 points apart
  assert.deepEqual(closeTip(indexResults(results()), '4809', 'TX'), { title: 'TX-9, Texas', lines: ['Democratic share 46.9%, a margin of 6.2 points'] });
  // HI-2 at 70.1% is not close; withExtensions gives every state 0 close districts enacted and a median of 1
  const index = indexResults(withExtensions());
  assert.deepEqual(closeTip(index, '1502', 'HI'), { title: 'HI-2, Hawaii', lines: ['Democratic share 70.1%',
    'Close districts in Hawaii: 0 on the enacted map, a median of 1 on neutral maps'] });
  assert.deepEqual(closeTip(index, '5600', 'WY'), { title: 'Wyoming', lines: [AT_LARGE_TEXT] });
});

test('closeLegend: the three fills, the outline and the national counts', () => {
  const legend = closeLegend(withExtensions());
  // two layers, each with one job: gold outlines for swing states, rings for close calls
  assert.deepEqual(legend.items, [
    { key: 'swing', text: 'Gold outline: swing state, 48.5% to 51.5% Democratic statewide' },
    { key: 'tight', text: 'Thick ring: close call, under 2 points apart' }, { key: 'near', text: 'Thin ring: 2 to 5 points apart' },
    { key: 'd', text: 'Close district, Democrats ahead' }, { key: 'r', text: 'Close district, Republicans ahead' },
    { key: 'other', text: 'Gray: not close, more than 10 points apart' }]);
  // testdata: HI at 66.03% and TX at 46.35% set their share, the five other states keep the default 0.5 -> 5 swing states
  assert.equal(legend.note, '81 close districts (45% to 55% Democratic) on the enacted maps; neutral maps give a median of 96. '
    + '5 swing states, counted on the 2016 and 2020 votes.');
});

test('tapLine: the tapped district, nothing in the states view, the at-large text', () => {
  const index = indexResults(results());
  assert.equal(tapLine(index, '4809', 'TX', 'districts'), 'TX-9: 46.9% Democratic');
  assert.equal(tapLine(index, '4809', 'TX', 'states'), '');
  assert.equal(tapLine(index, '4809', 'TX', 'close'), 'TX-9: 46.9% Democratic');
  assert.equal(tapLine(index, '5600', 'WY', 'districts'), `Wyoming: ${AT_LARGE_TEXT}`);
  assert.equal(tapLine(index, '5600', 'WY', 'states'), `Wyoming: ${AT_LARGE_TEXT}`);
});

test('stateOptions: the states with more than one seat, by name', () => {
  assert.deepEqual(stateOptions(results()).map((o) => o.postal), ['CA', 'FL', 'HI', 'LA', 'MO', 'NM', 'TX']);
  // In testdata the names sort like the postal codes. Sorted by postal code, these four would come as IA, ID, NH, NV.
  const states = { IA: { name: 'Iowa' }, ID: { name: 'Idaho' }, NV: { name: 'Nevada' }, NH: { name: 'New Hampshire' } };
  assert.deepEqual(stateOptions({ states } as unknown as Results).map((o) => o.postal), ['ID', 'IA', 'NV', 'NH']);
});

test('stateOptions: with single, also the six single-seat states, marked and sorted by name', () => {
  const options = stateOptions(results(), { single: true });
  // 7 states plus 6: sorted by name, Alaska first and Wyoming last
  assert.deepEqual(options.map((o) => o.postal), ['AK', 'CA', 'DE', 'FL', 'HI', 'LA', 'MO', 'NM', 'ND', 'SD', 'TX', 'VT', 'WY']);
  assert.equal(options.find((o) => o.postal === 'WY')?.label, 'Wyoming (one seat)');
  assert.equal(options.find((o) => o.postal === 'TX')?.label, 'Texas');
  // without single: the label is the name
  assert.ok(stateOptions(results()).every((o) => o.label === o.name));
});

test('mapHints: mouse, Mac and touch, without a hint line under the map', () => {
  assert.deepEqual(mapHints({ touch: false, mac: false }), {
    wheel: 'Use Ctrl + scroll to zoom the map',
    touch: 'Use two fingers to move the map',
  });
  assert.equal(mapHints({ touch: false, mac: true }).wheel, 'Use ⌘ + scroll to zoom the map');
  assert.deepEqual(Object.keys(mapHints({ touch: true, mac: false })), ['wheel', 'touch']);
});

// --- "Drawing effect by state" (Task 6.4) ---

test('effectList: toward Republicans, zero, toward Democrats, each from large R to large D', () => {
  const list = effectList(results());
  // drawing effects: FL -4, TX -2, HI 0, LA 0, MO 0, NM +1, CA +3
  assert.deepEqual(list.toR.map((r) => [r.postal, r.label]), [['FL', 'R+4'], ['TX', 'R+2']]);
  assert.deepEqual(list.zero.map((r) => r.postal), ['HI', 'LA', 'MO']);
  assert.deepEqual(list.toD.map((r) => [r.postal, r.label]), [['NM', 'D+1'], ['CA', 'D+3']]);
  // ties go by name, not by file order or postal code: Mississippi (MS, added last) comes before Missouri (MO)
  const r = results();
  r.states.MS = { ...r.states.MO, name: 'Mississippi' };
  assert.deepEqual(effectList(r).zero.map((s) => s.postal), ['HI', 'LA', 'MS', 'MO']);
});

test('effectList: the sums, the collapsed line and the net bar', () => {
  const list = effectList(results());
  // toward Republicans 4 + 2 = 6 seats in 2 states, toward Democrats 1 + 3 = 4 in 2 states, net -2
  assert.equal(list.seatsR, 6);
  assert.equal(list.seatsD, 4);
  assert.equal(list.net, -2);
  assert.equal(list.zeroLabel, '3 states match their neutral median');
  assert.equal(list.summary, '2 states move 6 seats toward Republicans, 2 states move 4 seats toward Democrats. Net: 2 seats toward Republicans.');
  assert.deepEqual(list.bar, {
    left: '6 toward Republicans', right: '4 toward Democrats', net: 'Net R+2',
    label: '6 seats toward Republicans, 4 toward Democrats, net 2 seats toward Republicans',
  });
});

test('effectList: one state, one seat, and no state on a side', () => {
  const r = results();
  r.states = { TX: r.states.TX, HI: r.states.HI };
  r.states.TX.effects.drawing = -1;
  const list = effectList(r);
  assert.equal(list.zeroLabel, '1 state matches its neutral median');
  assert.equal(list.summary, '1 state moves 1 seat toward Republicans, no state moves a seat toward Democrats. Net: 1 seat toward Republicans.');
  assert.equal(list.bar.label, '1 seat toward Republicans, 0 toward Democrats, net 1 seat toward Republicans');
  // no state toward Republicans: the sentence starts with a capital and the sum is a plain 0
  r.states.TX.effects.drawing = 2;
  const flipped = effectList(r);
  assert.equal(flipped.seatsR, 0);
  assert.equal(flipped.summary, 'No state moves a seat toward Republicans, 1 state moves 2 seats toward Democrats. Net: 2 seats toward Democrats.');
});

// --- the state sheet (Task 6.4) ---

test('positionText: fewer, the same and more, as plan shares', () => {
  assert.equal(positionText({ fewer: 0, equal: 0, more: 1, midrank: 0 }, 5000, 'the enacted map'),
    'Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more.');
  assert.equal(positionText({ fewer: 0.1286, equal: 0.8692, more: 0.0022, midrank: 0.5632 }, 5000, 'the enacted map'),
    'Of the 5,000 neutral maps, 13% give fewer Democratic seats than the enacted map, 87% the same number and less than 1% more.');
});

test('stateSheet: heading, status, the three numbers and the effects (Texas)', () => {
  const sheet = stateSheet(results(), 'TX');
  assert.equal(sheet.name, 'Texas');
  assert.equal(sheet.mapName, 'PLANC2333 (HB 4)');
  assert.equal(sheet.status, 'Challenged in court');
  assert.equal(sheet.legal, 'Legal status as of October 3, 2026');
  assert.equal(sheet.seatCount, '4 seats');
  assert.deepEqual(sheet.trio, [
    { label: 'Vote-proportional', value: '2', sub: '46.4% Democratic vote' },
    { label: 'Neutral-map median', value: '2', sub: '90% of maps: 1 to 3' },
    { label: 'Enacted maps', value: '0', sub: 'outside the neutral band' },
  ]);
  assert.equal(sheet.seatsOf, 'Democratic seats of 4.');
  assert.deepEqual(sheet.effects, [
    { label: 'Geographic effect', value: '0: no difference', note: '(neutral maps compared with proportional)' },
    { label: 'Drawing effect', value: 'R+2: 2 seats toward Republicans', note: '(enacted map compared with neutral maps)' },
  ]);
  assert.equal(sheet.position, 'Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more.');
  assert.equal(sheet.blocked, null);
});

test('stateSheet: the seat axis and its text alternative (Texas)', () => {
  const sheet = stateSheet(results(), 'TX');
  assert.deepEqual(sheet.axis, { lo: 0, hi: 4, dist: [0, 300, 4000, 700, 0], proportional: 2, median: 2, p5: 1, p95: 3, enacted: 0 });
  assert.equal(sheet.axisLabel, 'Democratic seats in Texas: proportional 2, neutral-map median 2 (90% of maps 1 to 3), enacted 0. '
    + 'Bars: share of the 5,000 neutral maps per seat count.');
  assert.equal(sheet.sortedLabel, 'Texas: the 4 enacted districts from lowest to highest Democratic share, 27.0% to 46.9%, '
    + 'against the median and the 90% band of the neutral maps at each position.');
  assert.equal(sheet.sortedCaption, 'Dots: enacted districts. Line and shading: median and 90% band of the neutral maps at each position.');
});

test('stateSheet: efficiency gap and mean-median with their neutral context', () => {
  const sheet = stateSheet(results(), 'TX');
  // EG 0.1816 -> 18.2; median 0.0060 -> 0.6; p5 -0.0720 -> 7.2 toward Democrats; p95 0.0673 -> 6.7
  assert.deepEqual(sheet.measures[0], {
    label: 'Efficiency gap', value: '18.2 points toward Republicans',
    context: '(neutral maps: 0.6 points toward Republicans; 90% between 7.2 points toward Democrats and 6.7 points toward Republicans)',
  });
  // MM 0.0727 -> 7.3; median -0.0077 -> 0.8 toward Democrats; p5 -0.03475 -> 3.5 (half-up); p95 0.0174 -> 1.7
  assert.deepEqual(sheet.measures[1], {
    label: 'Mean-median', value: '7.3 points toward Republicans',
    context: '(neutral maps: 0.8 points toward Democrats; 90% between 3.5 points toward Democrats and 1.7 points toward Republicans)',
  });
  assert.deepEqual(sheet.notes, ['Note vra_constraint_cvap.', 'Note adopted_after_2024_election.']);
  assert.deepEqual(sheet.source, { label: 'Texas Legislative Council', url: 'https://data.capitol.texas.gov/dataset/planc2333' });
});

test('stateSheet: two districts (Hawaii) and a band of one seat count', () => {
  const sheet = stateSheet(results(), 'HI');
  assert.equal(sheet.trio[1].sub, '90% of maps give 2');
  assert.equal(sheet.trio[2].sub, 'inside the neutral band');
  assert.deepEqual(sheet.measures[1], { label: 'Mean-median', value: 'Not defined for two districts', context: '' });
  assert.equal(sheet.status, 'In effect');
  assert.equal(sheet.axisLabel, 'Democratic seats in Hawaii: proportional 1, neutral-map median 2 (90% of maps give 2), enacted 2. '
    + 'Bars: share of the 5,000 neutral maps per seat count.');
  // EG median, p5 and p95 all round to 17.9 points toward Democrats: the value once, not three times
  assert.deepEqual(sheet.measures[0], {
    label: 'Efficiency gap', value: '17.9 points toward Democrats', context: '(90% of neutral maps: 17.9 points toward Democrats)',
  });
});

test('stateSheet: neutral context that points one way names the party once', () => {
  const r = results();
  // Missouri's efficiency gap in results.json: median, p5 and p95 all toward Republicans
  r.states.MO.eg = { value: 0.0887, median: 0.0852, p5: 0.0787, p95: 0.2032 };
  assert.deepEqual(stateSheet(r, 'MO').measures[0], {
    label: 'Efficiency gap', value: '8.9 points toward Republicans',
    context: '(neutral maps: 8.5 points; 90% between 7.9 and 20.3 points, all toward Republicans)',
  });
  // toward Democrats p5 is the larger gap: the range runs from the smaller to the larger number of points
  r.states.MO.mm = { value: -0.0364, median: -0.0482, p5: -0.0575, p95: -0.0292 };
  assert.deepEqual(stateSheet(r, 'MO').measures[1], {
    label: 'Mean-median', value: '3.6 points toward Democrats',
    context: '(neutral maps: 4.8 points; 90% between 2.9 and 5.8 points, all toward Democrats)',
  });
});

test('stateSheet: neutral context in two directions or around zero keeps the party at each number', () => {
  const r = results();
  // p5 rounds to 0.0 points, which has no direction
  r.states.MO.eg = { value: 0.0887, median: 0.0852, p5: 0.0004, p95: 0.2032 };
  assert.equal(stateSheet(r, 'MO').measures[0].context,
    '(neutral maps: 8.5 points toward Republicans; 90% between less than 0.05 points either way and 20.3 points toward Republicans)');
  // the value points the other way, the neutral maps one way: the context still names the party once
  r.states.MO.eg = { value: -0.0246, median: 0.0836, p5: 0.0201, p95: 0.1124 };
  assert.equal(stateSheet(r, 'MO').measures[0].context, '(neutral maps: 8.4 points; 90% between 2.0 and 11.2 points, all toward Republicans)');
});

test('stateSheet: Missouri has the row for the blocked map HB 1', () => {
  const sheet = stateSheet(results(), 'MO');
  assert.equal(sheet.position, 'Of the 5,000 neutral maps, 13% give fewer Democratic seats than the enacted map, 87% the same number and less than 1% more.');
  assert.deepEqual(sheet.blocked, {
    name: 'HB 1 of 2025',
    status: 'Blocked',
    seatsText: 'With the 2016 and 2020 votes it would give 1 Democratic seat.',
    position: 'Of the 5,000 neutral maps, 0% give fewer Democratic seats than HB 1 of 2025, 13% the same number and 87% more.',
    source: { label: 'Redistricting Data Hub', url: 'https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/' },
  });
  // the plan count is the sum of the state's neutral.dist; a blocked map with two seats gets the plural
  const r = results();
  r.states.MO.neutral.dist = [0, 643, 3346, 11, 0, 0, 0, 0, 0];
  r.states.MO.blocked_map!.enacted = 2;
  const other = stateSheet(r, 'MO');
  assert.equal(other.blocked?.seatsText, 'With the 2016 and 2020 votes it would give 2 Democratic seats.');
  assert.match(other.blocked?.position ?? '', /^Of the 4,000 neutral maps, /);
});

// --- the national section (Task 6.7) ---

test('houseOf: the House of 435, the districts plus the single-seat states with their fixed party', () => {
  // 429 districts + 6 single-seat states; DE and VT Democratic, AK, ND, SD and WY Republican
  assert.deepEqual(houseOf(results()), { total: 435, dSingle: 2, rSingle: 4 });
});

test('nationalView: the strip with the three numbers, the effects and the position', () => {
  const view = nationalView(results());
  // 6 entries in single_seat -> "six"; their names sorted alphabetically; 429 + 6 = 435 seats
  assert.equal(view.note, '435 seats. The six states with one at-large seat (Alaska, Delaware, North Dakota, South Dakota, Vermont, '
    + 'Wyoming) count the same in all three ways, for the party that won them in 2016 and 2020; they cannot be redrawn.');
  // every count of 429 plus the 2 Democratic single-seat states: 224 -> 226, the band
  // 217 to 229 -> 219 to 231, 213 -> 215; the effects stay as they are
  assert.deepEqual(view.trio.map((t) => [t.value, t.sub]), [['226', 'seats follow the vote'], ['225', '90% of outcomes: 219 to 231'], ['215', 'maps used in 2026']]);
  // geographic -1 -> "R+1", one seat (singular); drawing -10 -> "R+10", 10 seats
  assert.equal(view.effects, 'Geographic effect R+1: neutral maps give 1 seat toward Republicans compared with seats that follow the vote. '
    + 'Drawing effect R+10: the enacted maps give 10 seats toward Republicans compared with neutral maps.');
  // position.more 0.9972: above 0.99 and below 1 -> "more than 99%"
  assert.equal(view.position, 'In more than 99% of neutral outcomes Democrats win more seats than under the enacted maps.');
  assert.equal(view.axisLabel, 'Democratic seats in the House of 435: proportional 226, neutral-map median 225 '
    + '(90% of outcomes 219 to 231), enacted 215. Bars: share of neutral outcomes per seat count.');
  // a band of one seat count: "give", not a colon before a lone number
  const one = results();
  Object.assign(one.national.neutral, { p5: 223, p95: 223 });
  assert.equal(nationalView(one).trio[1].sub, '90% of outcomes give 225');
  assert.match(nationalView(one).axisLabel, /neutral-map median 225 \(90% of outcomes give 225\), enacted 215\./);
  // dist had one probability per seat count from 0 to 429; shifted by the 2 Democratic single seats: 0 to 431
  assert.equal(view.axis.dist.length, 432);
  assert.deepEqual(view.axis.dist.slice(0, 2), [0, 0]);
  assert.equal(view.axis.dist[225], 1); // testdata puts all neutral outcomes at 223 of 429
  assert.equal(view.seatsTotal, 435);
  // the count comes from single_seat: 5 entries -> "five"; above ten as digits, 11 -> "11"
  const r = results();
  r.national.single_seat = r.national.single_seat.slice(0, 5);
  assert.equal(nationalView(r).note, '434 seats. The five states with one at-large seat (Alaska, Delaware, North Dakota, South Dakota, '
    + 'Vermont) count the same in all three ways, for the party that won them in 2016 and 2020; they cannot be redrawn.');
  r.national.single_seat = Array.from({ length: 11 }, (_, k) => ({ postal: `S${k}`, fips: '00', name: `State ${k}` }));
  assert.match(nationalView(r).note, /^440 seats\. The 11 states with one at-large seat \(State 0, /);
});

// --- the method and the footer (Task 6.8) ---

test('methodFills: plans, states, ALARM version, dates and Louisiana', () => {
  assert.deepEqual(methodFills(results()), {
    plans: '5,000',
    states: '7',
    'alarm-version': '15',
    'status-date': 'October 3, 2026',
    generated: 'October 6, 2026',
    'la-share': 'more than 99%', // 4989 of 5000 is 99.78%, which rounds to 100 but is not all plans
    'la-seats': '1 Democratic seat',
    'share-2024': '49.2%', // the Democratic share of the 2024 presidential vote, for the method
  });
});

// --- the column beside the map without a state, per view ---

test('districtShares: the districts of the 2026 maps in five-point bins, blue from 50%', () => {
  // testdata: TX 27.04%, 46.91%, 42.48%, 41.00% and HI 62.13%, 70.11%; the other states have no districts
  const view = districtShares(results());
  assert.equal(view.title, 'Districts by Democratic share');
  // then the House the other chapters count in: the six single-seat states of the testdata, two of them Democratic
  assert.equal(view.count, 'With the 2016 and 2020 votes, Democrats win 2 of 6 districts. '
    + 'The six states with one seat add 2 Democratic seats, for 4 of 435.');
  assert.equal(view.hint, 'Click a state on the map for its record.');
  // from the bin of the lowest share (25%) to the bin of the highest (70%)
  assert.deepEqual(view.bins.map((b) => [Math.round(b.lo * 100), b.n, b.dem]), [
    [25, 1, false], [30, 0, false], [35, 0, false], [40, 2, false], [45, 1, false],
    [50, 0, true], [55, 0, true], [60, 1, true], [65, 0, true], [70, 1, true],
  ]);
  assert.equal(view.bins[3].title, '40 to 45%: 2 districts');
  assert.equal(view.bins[0].title, '25 to 30%: 1 district');
  assert.equal(view.label, 'Bar chart: 6 districts by Democratic share in steps of 5 points, 2 above 50%.');
});

test('closeDistricts: districts from 45% to 55%, both included, closest to 50% first', () => {
  const view = closeDistricts(results());
  assert.equal(view.title, 'Close districts, 45 to 55%');
  assert.deepEqual(view.rows.map((r) => [r.label, r.text, r.dem, r.postal]), [['TX-9', '46.9%', false, 'TX']]);
  assert.equal(view.count, '1 on the 2026 maps.');
  assert.equal(view.hint, 'Click a district to zoom in.');
  // the bounds count, and a tie goes by the distance to 50%, then by the label
  const r = results();
  r.states.TX.districts = [{ id: '4801', share: 0.45 }, { id: '4802', share: 0.55 }, { id: '4803', share: 0.5501 },
    { id: '4804', share: 0.499 }].map((d) => ({ ...d, d: 0, r: 0 })); // closeDistricts reads only the share
  assert.deepEqual(closeDistricts(r).rows.map((x) => x.label), ['TX-4', 'TX-1', 'TX-2']);
});
