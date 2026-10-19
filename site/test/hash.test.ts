// Tests for site/src/lib/hash.ts. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateFromHash, linkFor, outcomesLink, outcomesFromSearch, SITE_URL } from '../src/lib/hash.ts';

const STATES = { TX: {}, CA: {}, MO: {} };

test('stateFromHash reads a state code in any case', () => {
  assert.equal(stateFromHash('#TX', STATES), 'TX');
  assert.equal(stateFromHash('#tx', STATES), 'TX');
  assert.equal(stateFromHash('TX', STATES), 'TX');
  assert.equal(stateFromHash('#%54X', STATES), 'TX');
  assert.equal(stateFromHash('# ca ', STATES), 'CA');
});

test('stateFromHash gives the whole map for anything else', () => {
  for (const hash of ['', '#', undefined, null, '#WY', '#ZZ', '#TEX', '#method', '#national', '#%E0%A4%A', '#__proto__', '#constructor']) {
    assert.equal(stateFromHash(hash, STATES), '', String(hash));
  }
});

test('linkFor puts the state in the hash, or drops the hash for the whole map', () => {
  assert.equal(linkFor('TX', '/index.html'), '#TX');
  assert.equal(linkFor('', '/index.html'), '/index.html');
  assert.equal(linkFor('', '/?x=1'), '/?x=1');
});

test('stateFromHash accepts a single-seat state only when the caller passes the six', () => {
  const single = { WY: {}, VT: {} };
  assert.equal(stateFromHash('#WY', STATES, single), 'WY');
  assert.equal(stateFromHash('#wy', STATES, single), 'WY');
  assert.equal(stateFromHash('#TX', STATES, single), 'TX');
  assert.equal(stateFromHash('#AK', STATES, single), ''); // not in either list
  assert.equal(stateFromHash('#WY', STATES), ''); // without the third argument, as before
});

const KEYS = ['proportional', 'neutral', 'enacted'];
const SHARES = [0.47, 0.471, 0.492, 0.5, 0.5179747240856283, 0.56];

test('outcomesLink gives the chosen row and the vote share in percent with one decimal, at chapter 02', () => {
  assert.equal(outcomesLink('neutral', 0.492), '?count=neutral&vote=49.2#outcomes');
  assert.equal(outcomesLink('enacted', 0.5179747240856283), '?count=enacted&vote=51.8#outcomes');
  assert.equal(outcomesLink('proportional', 0.5), '?count=proportional&vote=50.0#outcomes');
});

test('the share links start with the site address, somevotes.org for now (to check before launch)', () => {
  assert.equal(SITE_URL, 'https://somevotes.org/');
  assert.equal(`${SITE_URL}${linkFor('TX', '')}`, 'https://somevotes.org/#TX');
  assert.equal(`${SITE_URL}${outcomesLink('neutral', 0.492)}`, 'https://somevotes.org/?count=neutral&vote=49.2#outcomes');
});

test('outcomesFromSearch reads a link made by outcomesLink back to the row and the stop of the slider', () => {
  for (const [key, index] of [['neutral', 2], ['enacted', 4], ['proportional', 3], ['enacted', 0], ['neutral', 5]] as const) {
    const search = outcomesLink(key, SHARES[index]).split('#')[0];
    assert.deepEqual(outcomesFromSearch(search, KEYS, SHARES), { key, index }, search);
  }
});

test('outcomesFromSearch gives null without a count or a vote, and leaves out what it does not know', () => {
  for (const search of ['', '?', '?notour', '?tourms=400']) assert.equal(outcomesFromSearch(search, KEYS, SHARES), null, search);
  assert.deepEqual(outcomesFromSearch('?count=house&vote=49.2', KEYS, SHARES), { key: null, index: 2 });
  assert.deepEqual(outcomesFromSearch('?count=neutral', KEYS, SHARES), { key: 'neutral', index: null });
  assert.deepEqual(outcomesFromSearch('?count=neutral&vote=49.25', KEYS, SHARES), { key: 'neutral', index: null }); // between two stops
  assert.deepEqual(outcomesFromSearch('?count=neutral&vote=60', KEYS, SHARES), { key: 'neutral', index: null }); // off the slider
  assert.deepEqual(outcomesFromSearch('?count=neutral&vote=abc', KEYS, SHARES), { key: 'neutral', index: null });
  assert.deepEqual(outcomesFromSearch('?count=__proto__&vote=51.8', KEYS, SHARES), { key: null, index: 4 });
});
