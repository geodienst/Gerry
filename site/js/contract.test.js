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
  'vra_constraint', 'vra_constraint_cvap', 'core_preservation_prior_map', 'core_preservation_2010',
  'competitiveness_rule', 'vra_filter_with_votes', 'vra_filter_bvap', 'vra_filter_minority_majority',
  'vra_fixed_district', 'alarm_rerun_unpublished', 'alarm_method_update_pending', 'narrow_ensemble',
  'adopted_after_2024_election', 'composite_2020_only', 'blocked_map',
];
const STATE_FIELDS = [
  'name', 'fips', 'seats', 'map_name', 'status', 'source', 'adopted', 'notes', 'd_share',
  'proportional', 'enacted', 'neutral', 'position', 'effects', 'outside_band',
  'eg', 'mm', 'districts', 'sorted', 'competitive', 'redraw',
];
// Extensions design (docs/superpowers/specs/2026-10-06-extensions-design.md)
const MAJORITY_DISTRICTS = 216;    // 218 of 435, minus DE and VT, fixed as Democratic (chapter 1)
const MAX_SWING = 0.05;            // a threshold lies within 5 points of the base share (chapters 1 and 5)
const GRID = 10000;                // neutral and proportional thresholds: steps of 0.01 point
const ADOPTED_BY = ['Legislature', 'Commission', 'Court'];
const CONTROL = ['Republican', 'Democratic', 'Bipartisan', 'Nonpartisan'];

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

// Smallest seat count whose cumulative share of plans reaches q (spec chapter 5, inverted CDF).
function percentile(dist, q) {
  const total = sum(dist);
  let cumulative = 0;
  for (let k = 0; k < dist.length; k++) {
    cumulative += dist[k];
    if (cumulative >= q * total - 1e-9) return k;
  }
  return dist.length - 1;
}

function checkNeutral(neutral, length, total, where) {
  for (const key of ['median', 'p5', 'p95']) assert.ok(isInt(neutral[key]), `${where}.neutral.${key}`);
  assert.ok(neutral.p5 <= neutral.median && neutral.median <= neutral.p95, `${where}.neutral order`);
  assert.equal(neutral.dist.length, length, `${where}.neutral.dist length`);
  assert.ok(near(sum(neutral.dist), total, 1e-6), `${where}.neutral.dist sums to ${total}`);
  for (const [key, q] of [['p5', 0.05], ['median', 0.5], ['p95', 0.95]]) {
    assert.equal(neutral[key], percentile(neutral.dist, q), `${where}.neutral.${key} follows from neutral.dist`);
  }
}

// EG and MM follow from the exported districts; positive favors Republicans (spec chapter 5).
// Winners go by share > 0.5. No exported district sits at exactly 0.5 (real data: none); a tie would need the 2020 tie rule.
function efficiencyGap(districts) {
  let wastedD = 0;
  let wastedR = 0;
  let total = 0;
  for (const { share, d, r } of districts) {
    total += d + r;
    if (share > 0.5) { wastedD += (d - r) / 2; wastedR += r; } else { wastedR += (r - d) / 2; wastedD += d; }
  }
  return (wastedD - wastedR) / total;
}

function meanMedian(districts) {
  const shares = districts.map((d) => d.share).sort((a, b) => a - b);
  const mid = shares.length >> 1;
  const median = shares.length % 2 ? shares[mid] : (shares[mid - 1] + shares[mid]) / 2;
  return sum(shares) / shares.length - median;
}

// fewer, equal and more are the shares of plans with fewer, as many and more Democratic seats than Enacted.
function checkPositionFromDist(position, dist, enacted, where) {
  const total = sum(dist);
  const expected = {
    fewer: sum(dist.slice(0, enacted)) / total,
    equal: dist[enacted] / total,
    more: sum(dist.slice(enacted + 1)) / total,
  };
  for (const key of ['fewer', 'equal', 'more']) {
    assert.ok(near(position[key], expected[key], 1e-9), `${where}.position.${key} ${position[key]} follows from neutral.dist and enacted (${expected[key]})`);
  }
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
  const numbered = Array.from({ length: seats }, (_, i) => `${fips}${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual(districts.map((d) => d.id).sort(), numbered, `${where} district ids run from 01 to ${seats}`);
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
    assert.ok(Math.abs(measure[key]) <= 1, `${where}.${key} is a fraction, not percentage points`);
  }
  assert.ok(measure.p5 <= measure.median && measure.median <= measure.p95, `${where} order`);
}

function checkSource(source, where) {
  assert.ok(typeof source.label === 'string' && source.label.length > 0, `${where}.source.label`);
  assert.match(source.url, /^https:\/\//, `${where}.source.url`);
}

test('meta has the fields of chapter 7', { skip }, () => {
  const { meta } = data().results;
  assert.match(meta.generated, /^\d{4}-\d{2}-\d{2}$/);
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
  checkPositionFromDist(national.position, national.neutral.dist, national.enacted, 'national');
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
    for (const key of ['name', 'map_name']) assert.ok(typeof s[key] === 'string' && s[key].length > 0, `${postal}.${key}`);
    assert.ok(isInt(s.seats) && s.seats >= 2, `${postal}.seats`);
    assert.ok(['In effect', 'Challenged'].includes(s.status), `${postal}.status`);
    checkSource(s.source, postal);
    for (const note of s.notes) {
      assert.ok(NOTE_KEYS.includes(note.key), `${postal} note key ${note.key}`);
      assert.ok(typeof note.text === 'string' && note.text.length > 0, `${postal} note ${note.key} text`);
      assert.ok(!/[{}]/.test(note.text), `${postal} note ${note.key} has an unfilled placeholder`);
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
    checkPositionFromDist(s.position, s.neutral.dist, s.enacted, postal);
    checkEffects(s, s.proportional, postal);
    checkDistricts(s.districts, s.fips, s.seats, postal);
    for (const key of ['enacted', 'p5', 'p50', 'p95']) {
      const band = s.sorted[key];
      assert.equal(band.length, s.seats, `${postal}.sorted.${key} length`);
      assert.ok(band.every((v, i) => isFraction(v) && (i === 0 || band[i - 1] <= v)), `${postal}.sorted.${key} holds fractions in ascending order`);
    }
    assert.ok(near(s.eg.value, efficiencyGap(s.districts), 1e-4), `${postal}.eg.value ${s.eg.value} follows from the districts (${efficiencyGap(s.districts)})`);
    if (s.mm) assert.ok(near(s.mm.value, meanMedian(s.districts), 1e-9), `${postal}.mm.value ${s.mm.value} follows from the districts (${meanMedian(s.districts)})`);
    // One vote base: the statewide share behind Proportional is the share of the district votes behind Enacted.
    const votes = sum(s.districts.map((d) => d.d)) / sum(s.districts.map((d) => d.d + d.r));
    assert.ok(near(s.d_share, votes, 1e-5), `${postal}.d_share ${s.d_share} matches the district votes ${votes}`);
    const quota = s.d_share * s.seats;
    assert.ok(Math.floor(quota) <= s.proportional && s.proportional <= Math.ceil(quota), `${postal}.proportional ${s.proportional} is the quota ${quota} rounded`);
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
  checkPositionFromDist(b.position, states.MO.neutral.dist, b.enacted, 'MO.blocked_map');
});

test('topojson districts match results.json per state', { skip }, () => {
  const { results, topology } = data();
  assert.equal(topology.type, 'Topology');
  const geometries = topology.objects.districts.geometries;
  for (const g of geometries) {
    assert.ok(g.type, `district ${g.properties.id} has no geometry`);
    assert.ok(!('id' in g), `district ${g.properties.id} keeps its id in properties, not in geometry.id`);
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
  for (const g of topology.objects.states.geometries) {
    assert.ok(g.type, `state ${g.properties.postal} has no geometry`);
    assert.ok(!('id' in g), `state ${g.properties.postal} keeps its id in properties, not in geometry.id`);
  }
  const props = topology.objects.states.geometries.map((g) => g.properties);
  assert.equal(props.length, 50);
  sameSet(props.map((p) => p.postal), [...expected.keys()]);
  for (const p of props) assert.equal(p.id, expected.get(p.postal), `states layer id for ${p.postal}`);
});

test('visible text in results.json has no em dashes', { skip }, () => {
  const { meta, national } = data().results;
  const texts = [meta.ensemble.name, ...national.single_seat.map((s) => s.name)];
  for (const s of Object.values(data().results.states)) {
    texts.push(s.name, s.map_name, s.source.label, ...s.notes.map((n) => n.text));
    if (s.blocked_map) texts.push(s.blocked_map.name, s.blocked_map.source.label);
    if (s.adopted.note) texts.push(s.adopted.note);
  }
  for (const text of texts) assert.ok(!text.includes('\u2014'), `em dash in: ${text}`);
});

// --- Extensions: majority threshold, competitive districts, redraws, who adopted the map ---------------------

test('majority thresholds follow from the districts and lie within 5 points of the base share', { skip }, () => {
  const { national, states } = data().results;
  const m = national.majority;
  const districts = Object.values(states).flatMap((s) => s.districts);
  assert.equal(m.seats_needed, MAJORITY_DISTRICTS);
  // one vote base: the share of all district votes (rounded to whole votes in results.json)
  assert.ok(near(m.base_share, sum(districts.map((x) => x.d)) / sum(districts.map((x) => x.d + x.r)), 1e-6),
    `majority.base_share ${m.base_share}`);
  // enacted: exact, from the 216th highest district share
  const h = districts.map((x) => x.share).sort((a, b) => b - a)[MAJORITY_DISTRICTS - 1];
  assert.ok(near(m.enacted.share, m.base_share + 0.5 - h, 1e-12), `majority.enacted.share ${m.enacted.share}`);
  assert.equal(m.enacted.seats_at_base, national.enacted);
  if (m.enacted.seats_at_base < MAJORITY_DISTRICTS) assert.ok(m.enacted.share >= m.base_share, 'short of a majority: the threshold lies above the base share');
  else assert.ok(m.enacted.share <= m.base_share, 'a majority: the threshold lies at or below the base share');
  const grid = [m.neutral.share, m.neutral.low, m.neutral.high, m.proportional.share];
  for (const share of [m.enacted.share, ...grid]) {
    assert.ok(isFraction(share) && Math.abs(share - m.base_share) <= MAX_SWING + 1e-12, `threshold ${share} lies within 5 points`);
  }
  for (const share of grid) {
    const steps = (share - m.base_share) * GRID;
    assert.ok(near(steps, Math.round(steps), 1e-6), `threshold ${share} lies on the grid of 0.01 point`);
  }
  assert.ok(m.neutral.low <= m.neutral.share && m.neutral.share <= m.neutral.high, 'majority.neutral band order');
  assert.ok(near(m.neutral.probability_at_base, sum(national.neutral.dist.slice(MAJORITY_DISTRICTS)), 1e-9),
    'majority.neutral.probability_at_base follows from neutral.dist');
});

function checkCompetitive(c, length, total, where) {
  for (const key of ['enacted', 'median', 'p5', 'p95']) assert.ok(isInt(c[key]) && c[key] >= 0 && c[key] < length, `${where}.competitive.${key}`);
  assert.equal(c.neutral_dist.length, length, `${where}.competitive.neutral_dist length`);
  assert.ok(near(sum(c.neutral_dist), total, 1e-6), `${where}.competitive.neutral_dist sums to ${total}`);
  for (const [key, q] of [['p5', 0.05], ['median', 0.5], ['p95', 0.95]]) {
    assert.equal(c[key], percentile(c.neutral_dist, q), `${where}.competitive.${key} follows from neutral_dist`);
  }
}

test('competitive districts (45 to 55%) per state and for the nation', { skip }, () => {
  const { national, states } = data().results;
  for (const [postal, s] of Object.entries(states)) {
    checkCompetitive(s.competitive, s.seats + 1, PLANS, postal);
    const count = s.districts.filter((x) => x.share >= 0.45 && x.share <= 0.55).length;
    assert.equal(s.competitive.enacted, count, `${postal}.competitive.enacted counts the districts from 45 to 55%`);
  }
  checkCompetitive(national.competitive, 430, 1, 'national');
  assert.equal(national.competitive.enacted, sum(Object.values(states).map((s) => s.competitive.enacted)));
});

test('redraws since 2024 add up per state and for the nation', { skip }, () => {
  const { national, states } = data().results;
  for (const [postal, s] of Object.entries(states)) {
    const r = s.redraw;
    assert.ok(isInt(r.seats_2024) && r.seats_2024 >= 0 && r.seats_2024 <= s.seats, `${postal}.redraw.seats_2024`);
    assert.equal(r.change, s.enacted - r.seats_2024, `${postal}.redraw.change`);
    assert.equal(typeof r.map_changed, 'boolean', `${postal}.redraw.map_changed`);
    if (!r.map_changed) assert.equal(r.change, 0, `${postal}: the same map gives the same seats`);
  }
  const all = Object.values(states);
  assert.equal(national.redraw.seats_2024, sum(all.map((s) => s.redraw.seats_2024)));
  assert.equal(national.redraw.change, sum(all.map((s) => s.redraw.change)));
  assert.equal(national.redraw.change, national.enacted - national.redraw.seats_2024);
});

test('who adopted each map, and the overview per control and per body', { skip }, () => {
  const { national, states } = data().results;
  const all = Object.values(states);
  for (const [postal, s] of Object.entries(states)) {
    assert.ok(ADOPTED_BY.includes(s.adopted.by), `${postal}.adopted.by`);
    assert.ok(CONTROL.includes(s.adopted.control), `${postal}.adopted.control`);
    assert.ok(s.adopted.note === null || (typeof s.adopted.note === 'string' && s.adopted.note.length > 0), `${postal}.adopted.note`);
    if (s.adopted.by === 'Court') assert.equal(s.adopted.control, 'Nonpartisan', `${postal}: a court is Nonpartisan`);
    if (s.adopted.by === 'Legislature') assert.notEqual(s.adopted.control, 'Nonpartisan', `${postal}: a legislature is not Nonpartisan`);
  }
  for (const [field, key, values] of [['by_control', 'control', CONTROL], ['by_body', 'by', ADOPTED_BY]]) {
    assert.deepEqual(Object.keys(national[field]), values, `${field} lists every value, in order`);
    for (const value of values) {
      const members = all.filter((s) => s.adopted[key] === value);
      assert.deepEqual(national[field][value], {
        states: members.length,
        seats: sum(members.map((s) => s.seats)),
        drawing: sum(members.map((s) => s.effects.drawing)),
      }, `${field}.${value} follows from the states`);
    }
    // the drawing effects of the states add up; their sum need not equal national.effects.drawing (spec chapter 5)
    const entries = Object.values(national[field]);
    assert.equal(sum(entries.map((e) => e.states)), 44);
    assert.equal(sum(entries.map((e) => e.seats)), 429);
  }
});
