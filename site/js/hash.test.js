// Tests for site/js/hash.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateFromHash, linkFor } from './hash.js';

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
