// Tests for site/js/model.js on the made-up results in testdata.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results } from './testdata.js';
import {
  AT_LARGE_TEXT, indexResults, districtLabel, districtTip, stateTip, tapLine, stateOptions, mapHints,
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
});

test('mapHints: mouse, Mac and touch', () => {
  assert.deepEqual(mapHints({ touch: false, mac: false }), {
    hint: 'Click a state to zoom in on its districts. Ctrl + scroll to zoom, drag to move.',
    wheel: 'Use Ctrl + scroll to zoom the map',
    touch: 'Use two fingers to move the map',
  });
  assert.equal(mapHints({ touch: false, mac: true }).wheel, 'Use ⌘ + scroll to zoom the map');
  assert.equal(mapHints({ touch: true, mac: false }).hint, 'Tap a state to zoom in on its districts. Use two fingers to zoom and move the map.');
});
