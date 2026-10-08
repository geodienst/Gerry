// A small made-up results.json for the unit tests of the site modules (shape: spec chapter 7).
// Seven states; Texas has 4 districts here, not 38. Numbers are chosen so each text can be checked by hand.

const notes = (...keys) => keys.map((key) => ({ key, text: `Note ${key}.` }));

function state(fields) {
  return {
    fips: '00', map_name: 'A map', status: 'In effect',
    source: { label: 'A state office', url: 'https://example.org/map' },
    notes: [], d_share: 0.5, proportional: 1, enacted: 1,
    neutral: { median: 1, p5: 1, p95: 1, dist: [0, 5000, 0] },
    position: { fewer: 0, equal: 1, more: 0, midrank: 0.5 },
    effects: { geographic: 0, drawing: 0 }, outside_band: false,
    eg: { value: 0, median: 0, p5: 0, p95: 0 }, mm: null,
    districts: [], sorted: { enacted: [0.4, 0.6], p5: [0.38, 0.58], p50: [0.4, 0.6], p95: [0.42, 0.62] },
    ...fields,
  };
}

const BASE = {
  meta: {
    generated: '2026-10-06',
    ensemble: { name: 'alarm_v15', doi: 'doi:10.7910/DVN/SLCD3E', version: 15 },
    census_vest_commit: '243c8a8134ecf8151777a9388c48323e274767e2',
    vote_basis: ['pre_16', 'pre_20'],
    status_checked: '2026-10-03',
  },
  national: {
    seats: 429, proportional: 224, enacted: 213,
    // dist: 430 probabilities; the axis tests only read its length
    neutral: { median: 223, p5: 217, p95: 229, dist: Array.from({ length: 430 }, (_, k) => (k === 223 ? 1 : 0)) },
    position: { fewer: 0.00108, equal: 0.00172, more: 0.9972, midrank: 0.00194 },
    effects: { geographic: -1, drawing: -10 }, outside_band: true,
    single_seat: [
      { postal: 'AK', fips: '02', name: 'Alaska' }, { postal: 'DE', fips: '10', name: 'Delaware' },
      { postal: 'ND', fips: '38', name: 'North Dakota' }, { postal: 'SD', fips: '46', name: 'South Dakota' },
      { postal: 'VT', fips: '50', name: 'Vermont' }, { postal: 'WY', fips: '56', name: 'Wyoming' },
    ],
  },
  // These made-up states feed the list sums and tooltip tests. Their fields need not agree with each other.
  states: {
    TX: state({
      name: 'Texas', fips: '48', seats: 4, map_name: 'PLANC2333 (HB 4)', status: 'Challenged',
      source: { label: 'Texas Legislative Council', url: 'https://data.capitol.texas.gov/dataset/planc2333' },
      notes: notes('vra_constraint_cvap', 'adopted_after_2024_election'),
      d_share: 0.46351837472645074, proportional: 2, enacted: 0,
      // cumulative shares 0, 0.06, 0.86, 1: p5 = 1, median = 2, p95 = 3
      neutral: { median: 2, p5: 1, p95: 3, dist: [0, 300, 4000, 700, 0] },
      position: { fewer: 0, equal: 0, more: 1, midrank: 0 },
      effects: { geographic: 0, drawing: -2 }, outside_band: true,
      eg: { value: 0.18158537190478174, median: 0.005961346451705714, p5: -0.07198470187957512, p95: 0.06725447641844755 },
      mm: { value: 0.07266102318893874, median: -0.007672757620158094, p5: -0.03475429596202062, p95: 0.01744668353647938 },
      districts: [
        { id: '4801', share: 0.2704011618476941, d: 160635, r: 433426 },
        { id: '4809', share: 0.46911980526614294, d: 200000, r: 226334 },
        { id: '4815', share: 0.4248013536755188, d: 180000, r: 243728 },
        { id: '4828', share: 0.4099767081677145, d: 170000, r: 244660 },
      ],
      sorted: {
        enacted: [0.2704011618476941, 0.4099767081677145, 0.4248013536755188, 0.46911980526614294],
        p5: [0.25, 0.38, 0.45, 0.52], p50: [0.27, 0.41, 0.49, 0.56], p95: [0.29, 0.44, 0.53, 0.6],
      },
    }),
    CA: state({ name: 'California', fips: '06', seats: 2, effects: { geographic: 1, drawing: 3 } }),
    FL: state({ name: 'Florida', fips: '12', seats: 2, effects: { geographic: 0, drawing: -4 } }),
    NM: state({ name: 'New Mexico', fips: '35', seats: 2, effects: { geographic: 0, drawing: 1 } }),
    HI: state({
      name: 'Hawaii', fips: '15', seats: 2, d_share: 0.6603, proportional: 1, enacted: 2,
      neutral: { median: 2, p5: 2, p95: 2, dist: [0, 0, 5000] },
      effects: { geographic: 1, drawing: 0 },
      eg: { value: -0.17945873654711123, median: -0.17945853594427652, p5: -0.17945991332328537, p95: -0.17945782724110415 },
      mm: null,
      districts: [{ id: '1501', share: 0.6213, d: 6213, r: 3787 }, { id: '1502', share: 0.7011, d: 7011, r: 2989 }],
      sorted: { enacted: [0.6213, 0.7011], p5: [0.6, 0.69], p50: [0.62, 0.7], p95: [0.64, 0.71] },
    }),
    LA: state({
      name: 'Louisiana', fips: '22', seats: 6, proportional: 2, enacted: 1,
      neutral: { median: 1, p5: 1, p95: 1, dist: [1, 4989, 10, 0, 0, 0, 0] },
      effects: { geographic: -1, drawing: 0 },
    }),
    MO: state({
      name: 'Missouri', fips: '29', seats: 8, map_name: 'HB 2909 of 2022', proportional: 3, enacted: 2,
      neutral: { median: 2, p5: 1, p95: 2, dist: [0, 643, 4346, 11, 0, 0, 0, 0, 0] },
      position: { fewer: 0.1286, equal: 0.8692, more: 0.0022, midrank: 0.5632 },
      effects: { geographic: -1, drawing: 0 },
      notes: notes('vra_filter_bvap', 'blocked_map'),
      sorted: {
        enacted: [0.25, 0.3, 0.32, 0.35, 0.38, 0.4, 0.72, 0.78],
        p5: [0.24, 0.28, 0.31, 0.34, 0.36, 0.4, 0.6, 0.74],
        p50: [0.26, 0.3, 0.33, 0.36, 0.39, 0.44, 0.68, 0.77],
        p95: [0.28, 0.32, 0.35, 0.38, 0.42, 0.5, 0.74, 0.8],
      },
      blocked_map: {
        name: 'HB 1 of 2025', status: 'Blocked',
        source: { label: 'Redistricting Data Hub', url: 'https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/' },
        enacted: 1, districts: [],
        position: { fewer: 0, equal: 0.1286, more: 0.8714, midrank: 0.0643 },
      },
    }),
  },
};

/** A fresh copy, so a test can change it without touching the others. */
export function results() {
  return structuredClone(BASE);
}

/**
 * results() plus the fields of Phase 5, made up, for chapters.test.js: the national blocks of chapter 03 and,
 * per state, who adopted the map, competitive districts and the redraw. extensions.test.js keeps its own copy.
 */
export function withExtensions() {
  const r = results();
  r.national.majority = {
    seats_needed: 216, base_share: 0.5179747,
    enacted: { share: 0.5230328, seats_at_base: 213 },
    neutral: { share: 0.5115747, low: 0.5065747, high: 0.5159747, probability_at_base: 0.9853454 },
    proportional: { share: 0.4978747 },
  };
  r.national.redraw = { seats_2024: 217, change: -4 };
  r.national.competitive = { enacted: 81, median: 96, p5: 87, p95: 105 };
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
  for (const s of Object.values(r.states)) {
    s.adopted = { by: 'Legislature', control: 'Republican', note: null };
    s.competitive = { enacted: 0, median: 1, p5: 0, p95: 2 };
    s.redraw = { seats_2024: s.enacted, change: 0, map_changed: false };
  }
  r.states.TX.redraw = { seats_2024: 3, change: -3, map_changed: true }; // enacted 0
  return r;
}
