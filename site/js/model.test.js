// Tests for site/js/model.js on the made-up results in testdata.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results } from './testdata.js';
import {
  AT_LARGE_TEXT, indexResults, districtLabel, districtTip, stateTip, tapLine, stateOptions, mapHints,
  effectList, positionText, stateSheet, nationalView, explainerView, methodFills,
} from './model.js';

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
  assert.deepEqual(districtTip(index, '4809', 'TX'), { title: 'TX-9 · Texas', lines: ['Democratic share 46.9%'] });
  assert.deepEqual(stateTip(index, 'TX'), {
    title: 'Texas',
    lines: ['Drawing effect R+2 · 2 seats toward Republicans', 'Neutral 2, enacted 0 Democratic seats'],
  });
  assert.deepEqual(districtTip(index, '5600', 'WY'), { title: 'Wyoming', lines: [AT_LARGE_TEXT] });
  assert.deepEqual(stateTip(index, 'WY'), { title: 'Wyoming', lines: [AT_LARGE_TEXT] });
  assert.equal(AT_LARGE_TEXT, 'One at-large seat. No districts, so nothing to compare.');
});

test('tapLine: the tapped district, nothing in the states view, the at-large text', () => {
  const index = indexResults(results());
  assert.equal(tapLine(index, '4809', 'TX', 'districts'), 'TX-9: 46.9% Democratic');
  assert.equal(tapLine(index, '4809', 'TX', 'states'), '');
  assert.equal(tapLine(index, '5600', 'WY', 'districts'), `Wyoming: ${AT_LARGE_TEXT}`);
  assert.equal(tapLine(index, '5600', 'WY', 'states'), `Wyoming: ${AT_LARGE_TEXT}`);
});

test('stateOptions: the states with more than one seat, by name', () => {
  assert.deepEqual(stateOptions(results()).map((o) => o.postal), ['CA', 'FL', 'HI', 'LA', 'MO', 'NM', 'TX']);
  // In testdata the names sort like the postal codes. Sorted by postal code, these four would come as IA, ID, NH, NV.
  const states = { IA: { name: 'Iowa' }, ID: { name: 'Idaho' }, NV: { name: 'Nevada' }, NH: { name: 'New Hampshire' } };
  assert.deepEqual(stateOptions({ states }).map((o) => o.postal), ['ID', 'IA', 'NV', 'NH']);
});

test('stateOptions: with single, also the six single-seat states, marked and sorted by name', () => {
  const options = stateOptions(results(), { single: true });
  // 7 states plus 6: sorted by name, Alaska first and Wyoming last
  assert.deepEqual(options.map((o) => o.postal), ['AK', 'CA', 'DE', 'FL', 'HI', 'LA', 'MO', 'NM', 'ND', 'SD', 'TX', 'VT', 'WY']);
  assert.equal(options.find((o) => o.postal === 'WY').label, 'Wyoming (one seat)');
  assert.equal(options.find((o) => o.postal === 'TX').label, 'Texas');
  // without single: the label is the name
  assert.ok(stateOptions(results()).every((o) => o.label === o.name));
});

test('mapHints: mouse, Mac and touch', () => {
  assert.deepEqual(mapHints({ touch: false, mac: false }), {
    hint: 'Click a state to zoom in on its districts. Ctrl + scroll to zoom, drag to move.',
    wheel: 'Use Ctrl + scroll to zoom the map',
    touch: 'Use two fingers to move the map',
  });
  assert.equal(mapHints({ touch: false, mac: true }).hint, 'Click a state to zoom in on its districts. ⌘ + scroll to zoom, drag to move.');
  assert.equal(mapHints({ touch: false, mac: true }).wheel, 'Use ⌘ + scroll to zoom the map');
  assert.equal(mapHints({ touch: true, mac: false }).hint, 'Tap a state to zoom in on its districts. Use two fingers to zoom and move the map.');
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
  assert.equal(positionText({ fewer: 0, equal: 0, more: 1 }, 5000, 'the enacted map'),
    'Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more.');
  assert.equal(positionText({ fewer: 0.1286, equal: 0.8692, more: 0.0022 }, 5000, 'the enacted map'),
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
    { label: 'Proportional', value: '2', sub: '46.4% Democratic vote' },
    { label: 'Neutral baseline', value: '2', sub: '90% of maps: 1 to 3' },
    { label: 'Enacted', value: '0', sub: 'outside the neutral band' },
  ]);
  assert.equal(sheet.seatsOf, 'Democratic seats of 4.');
  assert.deepEqual(sheet.effects, [
    { label: 'Geographic effect', value: '0 · no difference', note: '(neutral maps compared with proportional)' },
    { label: 'Drawing effect', value: 'R+2 · 2 seats toward Republicans', note: '(enacted map compared with neutral maps)' },
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
    seatsText: 'With these votes it would give 1 Democratic seat.',
    position: 'Of the 5,000 neutral maps, 0% give fewer Democratic seats than HB 1 of 2025, 13% the same number and 87% more.',
    source: { label: 'Redistricting Data Hub', url: 'https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/' },
  });
  // the plan count is the sum of the state's neutral.dist; a blocked map with two seats gets the plural
  const r = results();
  r.states.MO.neutral.dist = [0, 643, 3346, 11, 0, 0, 0, 0, 0];
  r.states.MO.blocked_map.enacted = 2;
  const other = stateSheet(r, 'MO');
  assert.equal(other.blocked.seatsText, 'With these votes it would give 2 Democratic seats.');
  assert.match(other.blocked.position, /^Of the 4,000 neutral maps, /);
});

// --- the national section (Task 6.7) ---

test('nationalView: the key figures under the title, as one sentence', () => {
  const view = nationalView(results());
  // testdata national: seats 429, proportional 224, neutral median 223, enacted 213, all as digits;
  // drawing effect -10 (negative = fewer Democratic seats) -> "R+10"; the four numbers are strong
  assert.deepEqual(view.keyline, [
    { text: 'Of 429 seats, Democrats win ' }, { text: '224', strong: true },
    { text: ' if seats follow the votes, ' }, { text: '223', strong: true },
    { text: ' on neutral maps and ' }, { text: '213', strong: true },
    { text: ' on the 2026 maps. Drawing effect: ' }, { text: 'R+10', strong: true }, { text: '.' },
  ]);
  assert.equal(view.keyline.map((part) => part.text).join(''),
    'Of 429 seats, Democrats win 224 if seats follow the votes, 223 on neutral maps and 213 on the 2026 maps. Drawing effect: R+10.');
  // no drawing effect -> "0"; toward Democrats -> "D+3"
  const r = results();
  r.national.effects.drawing = 0;
  assert.equal(nationalView(r).keyline.at(-2).text, '0');
  r.national.effects.drawing = 3;
  assert.equal(nationalView(r).keyline.at(-2).text, 'D+3');
});

test('nationalView: the strip with the three numbers, the effects and the position', () => {
  const view = nationalView(results());
  // 6 entries in single_seat -> "six"; their names sorted alphabetically
  assert.equal(view.note, '429 seats. The six states with one at-large seat (Alaska, Delaware, North Dakota, South Dakota, Vermont, Wyoming) are not counted.');
  // the band runs from p5 217 to p95 229
  assert.deepEqual(view.trio.map((t) => [t.value, t.sub]), [['224', 'seats follow the vote'], ['223', '90% of outcomes: 217 to 229'], ['213', 'maps used in 2026']]);
  // geographic -1 -> "R+1", one seat (singular); drawing -10 -> "R+10", 10 seats
  assert.equal(view.effects, 'Geographic effect R+1: neutral maps give 1 seat toward Republicans compared with seats that follow the vote. '
    + 'Drawing effect R+10: the enacted maps give 10 seats toward Republicans compared with neutral maps.');
  // position.more 0.9972: above 0.99 and below 1 -> "more than 99%"
  assert.equal(view.position, 'In more than 99% of neutral outcomes Democrats win more seats than under the enacted maps.');
  assert.equal(view.axisLabel, 'Democratic seats in all states with more than one seat: proportional 224, neutral-map median 223 '
    + '(90% of outcomes 217 to 229), enacted 213. Bars: share of neutral outcomes per seat count.');
  // a band of one seat count: "give", not a colon before a lone number
  const one = results();
  Object.assign(one.national.neutral, { p5: 223, p95: 223 });
  assert.equal(nationalView(one).trio[1].sub, '90% of outcomes give 223');
  assert.match(nationalView(one).axisLabel, /neutral-map median 223 \(90% of outcomes give 223\), enacted 213\./);
  // dist has one probability per seat count from 0 to 429: 430 entries
  assert.equal(view.axis.dist.length, 430);
  assert.equal(view.seatsTotal, 429);
  // the count comes from single_seat: 5 entries -> "five"; above ten as digits, 11 -> "11"
  const r = results();
  r.national.single_seat = r.national.single_seat.slice(0, 5);
  assert.equal(nationalView(r).note, '429 seats. The five states with one at-large seat (Alaska, Delaware, North Dakota, South Dakota, Vermont) are not counted.');
  r.national.single_seat = Array.from({ length: 11 }, (_, k) => ({ postal: `S${k}`, name: `State ${k}` }));
  assert.match(nationalView(r).note, /^429 seats\. The 11 states with one at-large seat \(State 0, /);
});

// --- "How to read this" (owner decision of October 7, 2026) ---

/** Texas with the numbers of the real results.json: 38 seats, 46.4%, 18 / 17 (15 to 20) / 11, R+1 and R+6. */
function realTexas() {
  const r = results();
  Object.assign(r.states.TX, {
    seats: 38, d_share: 0.46351837472645074, proportional: 18, enacted: 11,
    effects: { geographic: -1, drawing: -6 },
  });
  // 5,000 maps in all; the median, p5 and p95 are read from their fields, not from dist
  r.states.TX.neutral = { median: 17, p5: 15, p95: 20, dist: [...Array(15).fill(0), 300, 1000, 2000, 1000, 400, 300, 0] };
  return r;
}

test('explainerView: Texas as the worked example, every number from results.json', () => {
  assert.deepEqual(explainerView(realTexas(), 'TX'), {
    title: 'How to read this',
    intro: 'Texas has 38 seats, and 46.4% of its two-party vote went to Democrats. With those votes:',
    items: [
      { lead: 'Proportional: 18 seats.', text: 'Seats in proportion to the votes, so every vote counts the same.' },
      { lead: 'Neutral baseline: 17 seats.', text: "The typical result of 5,000 maps a computer drew under Texas's rules without looking at party. 90% of those maps give 15 to 20." },
      { lead: 'Enacted: 11 seats.', text: 'The map Texas uses on November 3, 2026, with the same votes.' },
      { lead: 'Geographic effect, R+1: from 18 to 17.', text: 'Each district has one winner, and Democratic voters live close together in cities, so even fair maps give them a little less than their share of the vote.' },
      { lead: 'Drawing effect, R+6: from 17 to 11.', text: 'This comes from how the enacted map is drawn.' },
    ],
    closing: 'The map and the list show these numbers for every state. Select a state to see its own.',
  });
});

test('explainerView: one seat, a band of one count, effects of zero and toward Democrats', () => {
  // testdata Texas: 4 seats, proportional 2, neutral 2 (1 to 3), enacted 0, geographic 0, drawing -2
  const view = explainerView(results(), 'TX');
  assert.equal(view.intro, 'Texas has 4 seats, and 46.4% of its two-party vote went to Democrats. With those votes:');
  assert.equal(view.items[1].text, "The typical result of 5,000 maps a computer drew under Texas's rules without looking at party. 90% of those maps give 1 to 3.");
  // no geographic effect: no "from 2 to 2", and no reason that points one way
  assert.deepEqual(view.items[3], { lead: 'Geographic effect, 0: no difference.', text: '' });
  assert.deepEqual(view.items[4], { lead: 'Drawing effect, R+2: from 2 to 0.', text: 'This comes from how the enacted map is drawn.' });
  // one seat: singular; a band of one seat count; effects toward Democrats; Hawaii's dist has 5,000 maps
  const r = results();
  Object.assign(r.states.HI, { proportional: 1, enacted: 2, effects: { geographic: 1, drawing: 0 } });
  const hawaii = explainerView(r, 'HI');
  assert.equal(hawaii.intro, 'Hawaii has 2 seats, and 66.0% of its two-party vote went to Democrats. With those votes:');
  assert.equal(hawaii.items[0].lead, 'Proportional: 1 seat.');
  assert.equal(hawaii.items[1].text, "The typical result of 5,000 maps a computer drew under Hawaii's rules without looking at party. 90% of those maps give 2.");
  assert.deepEqual(hawaii.items[3], { lead: 'Geographic effect, D+1: from 1 to 2.', text: '' });
  assert.deepEqual(hawaii.items[4], { lead: 'Drawing effect, 0: no difference.', text: '' });
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
  });
});
