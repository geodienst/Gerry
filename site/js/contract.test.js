// Contract between the pipeline output and the site (spec chapter 7).
// Reads site/data/results.json and site/data/map.topojson, written by
// pipeline/04_export.py. Skips with a message until both files exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RESULTS = fileURLToPath(new URL('../data/results.json', import.meta.url));
const TOPOLOGY = fileURLToPath(new URL('../data/map.topojson', import.meta.url));
const missing = [[RESULTS, 'site/data/results.json'], [TOPOLOGY, 'site/data/map.topojson']]
  .filter(([path]) => !existsSync(path))
  .map(([, name]) => name);
const skip = missing.length > 0
  ? `site data not generated yet (missing ${missing.join(', ')}); run make export first`
  : false;

const SINGLE_SEAT = ['AK', 'DE', 'ND', 'SD', 'VT', 'WY'];
const PLANS = 5000;
const NOTE_KEYS = [
  'vra_constraint', 'core_preservation_prior_map', 'core_preservation_2010',
  'competitiveness_rule', 'vra_filter_with_votes', 'vra_filter_bvap',
  'alarm_rerun_unpublished', 'alarm_method_update_pending', 'narrow_ensemble',
  'adopted_after_2024_election', 'composite_2020_only', 'blocked_map',
];
const STATE_FIELDS = [
  'name', 'fips', 'seats', 'map_name', 'status', 'source', 'notes', 'd_share',
  'proportional', 'enacted', 'neutral', 'position', 'effects', 'outside_band',
  'eg', 'mm', 'districts', 'sorted',
];

let cache;
function data() {
  cache ??= {
    results: JSON.parse(readFileSync(RESULTS, 'utf8')),
    topology: JSON.parse(readFileSync(TOPOLOGY, 'utf8')),
  };
  return cache;
}

const isInt = (v) => Number.isInteger(v);
const isFraction = (v) => typeof v === 'number' && v >= 0 && v <= 1;
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const sum = (values) => values.reduce((a, b) => a + b, 0);
const sameSet = (a, b) => assert.deepEqual([...new Set(a)].sort(), [...new Set(b)].sort());

function checkPosition(position, where) {
  for (const key of ['fewer', 'equal', 'more', 'midrank']) {
    assert.ok(isFraction(position[key]), `${where}.position.${key}`);
  }
  assert.ok(near(position.fewer + position.equal + position.more, 1, 1e-9), `${where}.position sums to 1`);
  assert.ok(near(position.midrank, position.fewer + position.equal / 2, 1e-9), `${where}.position.midrank`);
}

function checkNeutral(neutral, length, total, where) {
  for (const key of ['median', 'p5', 'p95']) assert.ok(isInt(neutral[key]), `${where}.neutral.${key}`);
  assert.ok(neutral.p5 <= neutral.median && neutral.median <= neutral.p95, `${where}.neutral order`);
  assert.equal(neutral.dist.length, length, `${where}.neutral.dist length`);
  assert.ok(near(sum(neutral.dist), total, 1e-6), `${where}.neutral.dist sums to ${total}`);
}

function checkEffects(block, proportional, where) {
  const { neutral, enacted, effects } = block;
  assert.equal(effects.geographic, neutral.median - proportional, `${where}.effects.geographic`);
  assert.equal(effects.drawing, enacted - neutral.median, `${where}.effects.drawing`);
  assert.equal(block.outside_band, enacted < neutral.p5 || enacted > neutral.p95, `${where}.outside_band`);
}

function checkDistricts(districts, fips, seats, where) {
  assert.equal(districts.length, seats, `${where}.districts length`);
  for (const d of districts) {
    assert.match(d.id, new RegExp(`^${fips}\\d{2}$`), `${where} district id ${d.id}`);
    assert.ok(isFraction(d.share), `${where} ${d.id}.share`);
    assert.ok(isInt(d.d) && isInt(d.r) && d.d + d.r > 0, `${where} ${d.id} votes`);
    assert.ok(near(d.share, d.d / (d.d + d.r), 1e-4), `${where} ${d.id}.share matches d and r`);
  }
  assert.equal(new Set(districts.map((d) => d.id)).size, seats, `${where} district ids unique`);
}

function checkSeatsMatchDistricts(enacted, districts, where) {
  // A district is Democratic when D > R; an exact tie (share 0.5) is decided by 2020 alone.
  const wins = districts.filter((d) => d.share > 0.5).length;
  const ties = districts.filter((d) => d.share === 0.5).length;
  assert.ok(wins <= enacted && enacted <= wins + ties, `${where}: enacted ${enacted}, districts give ${wins}`);
}

function checkMeasure(measure, where) {
  for (const key of ['value', 'median', 'p5', 'p95']) {
    assert.ok(typeof measure[key] === 'number' && Number.isFinite(measure[key]), `${where}.${key}`);
  }
  assert.ok(measure.p5 <= measure.median && measure.median <= measure.p95, `${where} order`);
}

function checkSource(source, where) {
  assert.ok(typeof source.label === 'string' && source.label.length > 0, `${where}.source.label`);
  assert.match(source.url, /^https:\/\//, `${where}.source.url`);
}

test('meta has the fields of chapter 7', { skip }, () => {
  const { meta } = data().results;
  assert.match(meta.generated, /^\d{4}-\d{2}-\d{2}/);
  assert.deepEqual(Object.keys(meta.ensemble).sort(), ['doi', 'name', 'version']);
  assert.match(meta.census_vest_commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(meta.vote_basis, ['pre_16', 'pre_20']);
  assert.match(meta.status_checked, /^\d{4}-\d{2}-\d{2}$/);
});

test('national totals add up to 429, with the six single-seat states apart', { skip }, () => {
  const { national, states } = data().results;
  const all = Object.values(states);
  assert.equal(all.length, 44);
  assert.equal(national.seats, 429);
  assert.equal(sum(all.map((s) => s.seats)), 429);
  assert.equal(national.proportional, sum(all.map((s) => s.proportional)));
  assert.equal(national.enacted, sum(all.map((s) => s.enacted)));
  checkNeutral(national.neutral, 430, 1, 'national');
  checkPosition(national.position, 'national');
  checkEffects(national, national.proportional, 'national');
  assert.deepEqual(national.single_seat.map((s) => s.postal).sort(), SINGLE_SEAT);
  for (const s of national.single_seat) {
    assert.match(s.fips, /^\d{2}$/);
    assert.ok(s.name.length > 0);
    assert.ok(!(s.postal in states), `${s.postal} is single-seat and must not be in states`);
  }
});

test('every state has the fields of chapter 7', { skip }, () => {
  for (const [postal, s] of Object.entries(data().results.states)) {
    for (const field of STATE_FIELDS) assert.ok(field in s, `${postal}.${field} missing`);
    assert.match(s.fips, /^\d{2}$/, `${postal}.fips`);
    assert.ok(isInt(s.seats) && s.seats >= 2, `${postal}.seats`);
    assert.ok(['In effect', 'Challenged'].includes(s.status), `${postal}.status`);
    checkSource(s.source, postal);
    for (const note of s.notes) {
      assert.ok(NOTE_KEYS.includes(note.key), `${postal} note key ${note.key}`);
      assert.ok(typeof note.text === 'string' && note.text.length > 0, `${postal} note ${note.key} text`);
    }
    assert.ok(isFraction(s.d_share), `${postal}.d_share`);
    assert.ok(isInt(s.proportional) && s.proportional >= 0 && s.proportional <= s.seats, `${postal}.proportional`);
    assert.ok(isInt(s.enacted) && s.enacted >= 0 && s.enacted <= s.seats, `${postal}.enacted`);
    assert.ok(typeof s.outside_band === 'boolean', `${postal}.outside_band`);
    checkMeasure(s.eg, `${postal}.eg`);
    if (s.seats < 3) assert.equal(s.mm, null, `${postal}.mm must be null with two districts`);
    else checkMeasure(s.mm, `${postal}.mm`);
  }
});

test('neutral band, position, effects and districts agree per state', { skip }, () => {
  for (const [postal, s] of Object.entries(data().results.states)) {
    checkNeutral(s.neutral, s.seats + 1, PLANS, postal);
    checkPosition(s.position, postal);
    checkEffects(s, s.proportional, postal);
    checkDistricts(s.districts, s.fips, s.seats, postal);
    for (const key of ['enacted', 'p5', 'p50', 'p95']) {
      assert.equal(s.sorted[key].length, s.seats, `${postal}.sorted.${key} length`);
    }
    const shares = s.districts.map((d) => d.share).sort((a, b) => a - b);
    assert.deepEqual(s.sorted.enacted, shares, `${postal}.sorted.enacted is the sorted district shares`);
    s.sorted.p50.forEach((p50, i) => {
      assert.ok(s.sorted.p5[i] <= p50 && p50 <= s.sorted.p95[i], `${postal}.sorted order at ${i}`);
    });
    checkSeatsMatchDistricts(s.enacted, s.districts, postal);
  }
});

test('only Missouri has a blocked map, with the fields of chapter 7', { skip }, () => {
  const { states } = data().results;
  const withBlocked = Object.keys(states).filter((postal) => 'blocked_map' in states[postal]);
  assert.deepEqual(withBlocked, ['MO']);
  const b = states.MO.blocked_map;
  assert.ok(typeof b.name === 'string' && b.name.length > 0);
  assert.equal(b.status, 'Blocked');
  checkSource(b.source, 'MO.blocked_map');
  assert.ok(isInt(b.enacted) && b.enacted >= 0 && b.enacted <= states.MO.seats);
  checkDistricts(b.districts, states.MO.fips, states.MO.seats, 'MO.blocked_map');
  checkSeatsMatchDistricts(b.enacted, b.districts, 'MO.blocked_map');
  checkPosition(b.position, 'MO.blocked_map');
});

test('topojson districts match results.json per state', { skip }, () => {
  const { results, topology } = data();
  assert.equal(topology.type, 'Topology');
  const geometries = topology.objects.districts.geometries;
  for (const g of geometries) {
    assert.ok(g.type, `district ${g.properties.id} has no geometry`);
  }
  const byState = new Map();
  for (const { properties: p } of geometries) {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state).push(p.id);
  }
  sameSet([...byState.keys()], [...Object.keys(results.states), ...SINGLE_SEAT]);
  for (const [postal, s] of Object.entries(results.states)) {
    const ids = byState.get(postal);
    assert.equal(ids.length, new Set(ids).size, `${postal} has a duplicate district in the topojson`);
    sameSet(ids, s.districts.map((d) => d.id));
  }
  for (const s of results.national.single_seat) {
    assert.deepEqual(byState.get(s.postal), [`${s.fips}00`], `${s.postal} is one district 00`);
  }
});

test('topojson states layer matches results.json ids and postal codes', { skip }, () => {
  const { results, topology } = data();
  const expected = new Map(Object.entries(results.states).map(([postal, s]) => [postal, s.fips]));
  for (const s of results.national.single_seat) expected.set(s.postal, s.fips);
  const props = topology.objects.states.geometries.map((g) => g.properties);
  assert.equal(props.length, 50);
  sameSet(props.map((p) => p.postal), [...expected.keys()]);
  for (const p of props) assert.equal(p.id, expected.get(p.postal), `states layer id for ${p.postal}`);
});

test('visible text in results.json has no em dashes', { skip }, () => {
  const texts = [];
  for (const s of Object.values(data().results.states)) {
    texts.push(s.name, s.map_name, s.source.label, ...s.notes.map((n) => n.text));
    if (s.blocked_map) texts.push(s.blocked_map.name, s.blocked_map.source.label);
  }
  for (const text of texts) assert.ok(!text.includes('\u2014'), `em dash in: ${text}`);
});
