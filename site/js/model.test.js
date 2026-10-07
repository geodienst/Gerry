// Tests for site/js/model.js on the made-up results in testdata.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results } from './testdata.js';
import {
  AT_LARGE_TEXT, indexResults, districtLabel, districtTip, stateTip, tapLine, stateOptions, mapHints,
  effectList, positionText, stateSheet,
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
});

// --- the state sheet (Task 6.4) ---

test('positionText: fewer, the same and more, as plan shares', () => {
  assert.equal(positionText({ fewer: 0, equal: 0, more: 1 }, 5000, 'the enacted map'),
    'Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more.');
  assert.equal(positionText({ fewer: 0.1286, equal: 0.8692, more: 0.0022 }, 5000, 'the enacted map'),
    'Of the 5,000 neutral maps, 13% give fewer Democratic seats than the enacted map, 87% the same number and <1% more.');
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
  assert.deepEqual(sheet.effects.map((e) => e.value), ['0 · no difference', 'R+2 · 2 seats toward Republicans']);
  assert.equal(sheet.position, 'Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more.');
  assert.equal(sheet.blocked, null);
});

test('stateSheet: the seat axis and its text alternative (Texas)', () => {
  const sheet = stateSheet(results(), 'TX');
  assert.deepEqual(sheet.axis, { lo: 0, hi: 4, dist: [0, 300, 4000, 700, 0], proportional: 2, median: 2, p5: 1, p95: 3, enacted: 0 });
  assert.equal(sheet.axisLabel, 'Democratic seats in Texas: proportional 2, neutral baseline 2 (90% of maps 1 to 3), enacted 0. '
    + 'Bars: share of the 5,000 neutral maps per seat count.');
  assert.equal(sheet.sortedLabel, 'Texas: the 4 enacted districts from lowest to highest Democratic share, 27.0% to 46.9%, '
    + 'against the median and the 90% band of the neutral maps at each position.');
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
  assert.equal(sheet.trio[1].sub, '90% of maps: 2');
  assert.equal(sheet.trio[2].sub, 'inside the neutral band');
  assert.deepEqual(sheet.measures[1], { label: 'Mean-median', value: 'Not defined for two districts', context: '' });
  assert.equal(sheet.status, 'In effect');
});

test('stateSheet: Missouri has the row for the blocked map HB 1', () => {
  const sheet = stateSheet(results(), 'MO');
  assert.equal(sheet.position, 'Of the 5,000 neutral maps, 13% give fewer Democratic seats than the enacted map, 87% the same number and <1% more.');
  assert.deepEqual(sheet.blocked, {
    name: 'HB 1 of 2025',
    status: 'Blocked',
    seatsText: 'With these votes it would give 1 Democratic seat.',
    position: 'Of the 5,000 neutral maps, 0% give fewer Democratic seats than HB 1 of 2025, 13% the same number and 87% more.',
    source: { label: 'Redistricting Data Hub', url: 'https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/' },
  });
});
