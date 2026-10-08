// Tests for site/js/chapters.js on the made-up results in testdata.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results, withExtensions } from './testdata.js';
import {
  LABELS, SHORT_LABELS, EFFECT_LABELS, outcomesView, waffleText, changedKey, LARGEST_MIN, largestEffects, recordView, singleSeatView,
  decideView,
} from './chapters.js';
import { stateSheet, AT_LARGE_TEXT } from './model.js';
import { majorityView, senateView, redrawView, controlTables } from './extensions.js';

// --- chapter 01 (Task 7.3) ---

test('labels: the three ways of counting and the two effects, as CLAUDE.md names them', () => {
  assert.deepEqual(LABELS, { proportional: 'Vote-proportional', neutral: 'Neutral-map median', enacted: 'Enacted maps' });
  // short forms for the rows of dots, where the label column is 112 units wide (owner decision, October 8, 2026)
  assert.deepEqual(SHORT_LABELS, { proportional: 'Proportional', neutral: 'Neutral median', enacted: 'Enacted' });
  assert.deepEqual(EFFECT_LABELS, { geographic: 'Geographic effect', drawing: 'Drawing effect' });
});

test('outcomesView: three rows, the two effects between them, the band and the sentences', () => {
  // testdata national: 429 seats; proportional 224, neutral 223 (p5 217, p95 229), enacted 213;
  // geographic -1, drawing -10; position.more 0.9972; seven states; Texas first with 5,000 maps
  const view = outcomesView(withExtensions());
  assert.equal(view.intro, 'Democratic seats in the 7 states with more than one seat, counted three ways with the same votes. '
    + 'Select a row to see it as seats.');
  assert.equal(view.total, 429);
  assert.deepEqual(view.rows.map((r) => [r.key, r.label, r.seats, r.value]), [
    ['proportional', 'Vote-proportional', 224, '224'], ['neutral', 'Neutral-map median', 223, '223'], ['enacted', 'Enacted maps', 213, '213'],
  ]);
  assert.deepEqual(view.rows.map((r) => r.desc), [
    "Each state's seats in proportion to its two-party vote.",
    'The middle outcome of the neutral maps. 90% of outcomes: 217 to 229.',
    'The maps used on November 3, 2026.',
  ]);
  // geographic -1 lies between 224 and 223, drawing -10 between 223 and 213
  assert.deepEqual(view.steps, [
    { key: 'geographic', label: 'Geographic effect', value: 'R+1', words: '1 seat toward Republicans', detail: '1 seat toward Republicans (224 to 223)' },
    { key: 'drawing', label: 'Drawing effect', value: 'R+10', words: '10 seats toward Republicans', detail: '10 seats toward Republicans (223 to 213)' },
  ]);
  assert.deepEqual(view.band, { lo: 217, hi: 229, key: 'Outlined: seats 217 to 229, where the Democratic seats end in 90% of neutral outcomes' });
  // the finding beside the waffle: drawing -10, enacted 213, neutral median 223
  assert.equal(view.finding, 'In this comparison the enacted maps shift 10 seats toward Republicans. '
    + 'With the same votes they give Democrats 213 seats, where the neutral-map median gives 223.');
  // majority: 216 of 429 for Democrats; 435 - 429 = 6 one-seat states, 218 - 216 = 2 Democratic, 4 Republican; 429 - 216 + 1 = 214
  assert.deepEqual(view.majority, { after: 215, label: 'House majority',
    key: 'Line: House majority. Democrats need 216 of these seats, Republicans 214; the six one-seat states add 2 and 4.' });
  assert.equal(view.effectsNote, 'The geographic effect is the difference between proportional seats and neutral maps. '
    + 'The drawing effect is the difference between neutral maps and the enacted maps.');
  // 213 < 217
  assert.equal(view.spread, '90% of neutral outcomes give Democrats 217 to 229 seats. The enacted maps give 213, below that range.');
  // 0.9972 -> 99.72% -> rounds to 100 but is not all outcomes -> "more than 99%" (nationalView)
  assert.equal(view.position, 'In more than 99% of neutral outcomes Democrats win more seats than under the enacted maps.');
  // plans: Texas's dist 0 + 300 + 4000 + 700 + 0 = 5,000
  assert.equal(view.neutralNote, 'The neutral maps come from the ALARM Project. For each state a computer drew 5,000 maps that follow '
    + "the state's rules, such as equal population and the Voting Rights Act, without using party data. The national figures combine the 7 states.");
  assert.equal(view.scope, '429 seats. The six states with one at-large seat (Alaska, Delaware, North Dakota, South Dakota, Vermont, Wyoming) are not counted.');
});

test('outcomesView: the finding without a drawing effect, and the key of the changed seats', () => {
  const r = withExtensions();
  r.national.enacted = 223;
  r.national.effects.drawing = 0;
  assert.equal(outcomesView(r).finding, 'In this comparison the enacted maps give Democrats 223 seats, the same as the neutral-map median.');
  assert.equal(changedKey(11), 'Dot: the 11 seats that changed with this choice');
  assert.equal(changedKey(1), 'Dot: the 1 seat that changed with this choice');
});

test('outcomesView: an enacted count inside or above the band, a band of one count, no effect', () => {
  const r = withExtensions();
  r.national.enacted = 220; // 217 <= 220 <= 229
  assert.match(outcomesView(r).spread, /The enacted maps give 220, within that range\.$/);
  r.national.enacted = 230; // above 229
  assert.match(outcomesView(r).spread, /The enacted maps give 230, above that range\.$/);
  const one = withExtensions();
  Object.assign(one.national.neutral, { p5: 223, p95: 223 });
  one.national.effects.geographic = 0;
  const view = outcomesView(one);
  assert.equal(view.rows[1].desc, 'The middle outcome of the neutral maps. 90% of outcomes give 223.');
  assert.equal(view.spread, '90% of neutral outcomes give Democrats 223 seats. The enacted maps give 213, below that range.');
  assert.equal(view.band.key, 'Outlined: seat 223, where the Democratic seats end in 90% of neutral outcomes');
  // 224 to 223 would be wrong for an effect of 0; the numbers stay, the words say "no difference"
  assert.equal(view.steps[0].value, '0');
  assert.equal(view.steps[0].detail, 'no difference (224 to 223)');
});

test('waffleText: the count per party and the title of the waffle', () => {
  const view = outcomesView(withExtensions());
  // enacted 213 of 429 -> 429 - 213 = 216 Republican seats
  assert.deepEqual(waffleText(view, 'enacted'), { d: '213', r: '216', label: 'Enacted maps: 213 Democratic and 216 Republican seats of 429.' });
  // neutral 223 -> 206
  assert.deepEqual(waffleText(view, 'neutral'), { d: '223', r: '206', label: 'Neutral-map median: 223 Democratic and 206 Republican seats of 429.' });
});

// --- chapter 02 (Task 7.4) ---

test('largestEffects: every state at 3 seats or more, by size, then toward Republicans first, then by name', () => {
  // testdata drawing effects: TX -2, CA 3, FL -4, NM 1, HI 0, LA 0, MO 0
  const view = largestEffects(results());
  assert.equal(LARGEST_MIN, 3);
  assert.equal(view.title, 'Drawing effects of 3 seats or more');
  assert.deepEqual(view.chips, [
    { postal: 'FL', name: 'Florida', drawing: -4, label: 'R+4', aria: 'Florida, R+4 · 4 seats toward Republicans' },
    { postal: 'CA', name: 'California', drawing: 3, label: 'D+3', aria: 'California, D+3 · 3 seats toward Democrats' },
  ]);
  // below the threshold: TX (2) and NM (1); at 0: HI, LA, MO
  assert.equal(view.rest, 'Then 2 states at 1 or 2 seats either way, and 3 states at 0.');
});

test('largestEffects: ties, one state, and nothing below the threshold', () => {
  const r = results();
  r.states.NM.effects.drawing = -3; // ties with CA at 3 seats: toward Republicans first
  r.states.TX.effects.drawing = 3; // ties with CA toward Democrats: by name, California before Texas
  const view = largestEffects(r);
  assert.deepEqual(view.chips.map((c) => c.postal), ['FL', 'NM', 'CA', 'TX']);
  assert.equal(view.rest, 'Then 3 states at 0.'); // no state at 1 or 2
  r.states.HI.effects.drawing = 1;
  for (const postal of ['LA', 'MO']) r.states[postal].effects.drawing = 5;
  assert.equal(largestEffects(r).rest, 'Then 1 state at 1 or 2 seats either way.'); // no state at 0
  for (const s of Object.values(r.states)) s.effects.drawing = 4;
  assert.equal(largestEffects(r).rest, '');
});

test('recordView: the sheet of Phase 6 plus the headline, the strip and the extras (Texas)', () => {
  const r = withExtensions();
  const record = recordView(r, 'TX');
  // everything stateSheet gives stays
  const sheet = stateSheet(r, 'TX');
  for (const key of Object.keys(sheet)) assert.deepEqual(record[key], sheet[key], key);
  assert.equal(record.kicker, 'State record');
  // drawing -2 -> "R+2", "2 seats toward Republicans" with the first letter as is (a digit)
  assert.deepEqual(record.headline, { value: 'R+2', drawing: -2, sentence: '2 seats toward Republicans compared with the state\'s neutral-map median.' });
  // 4 seats -> ticks 0 to 4 in steps of 1 (seatTicks)
  assert.deepEqual(record.strip.domain, [0, 4]);
  assert.deepEqual(record.strip.ticks.map((t) => [t.value, t.text]), [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']]);
  // the short labels of the rows of dots
  assert.deepEqual(record.strip.rows, [
    { key: 'proportional', label: 'Proportional', value: 2 },
    { key: 'neutral', label: 'Neutral median', value: 2, band: [1, 3] },
    { key: 'enacted', label: 'Enacted', value: 0, filled: true },
  ]);
  assert.equal(record.strip.label, 'Democratic seats in Texas: proportional 2, neutral-map median 2 (90% of maps 1 to 3), enacted 0.');
  assert.deepEqual(record.extras, {
    head: ['Adopted by: Legislature (Republican control).'],
    body: ['Competitive districts (45 to 55%): 0 on the enacted map, 1 on neutral maps (90% of neutral maps: 0 to 2).',
      '2024 map: 3 Democratic seats with these votes. 2026 map: 0 (3 fewer).'],
  });
});

test('recordView: no drawing effect, an effect toward Democrats, a band of one seat count', () => {
  const r = withExtensions();
  // Hawaii: drawing 0, neutral 2 with p5 = p95 = 2
  const hawaii = recordView(r, 'HI');
  assert.deepEqual(hawaii.headline, { value: '0', drawing: 0, sentence: 'No difference from the neutral-map median.' });
  assert.deepEqual(hawaii.strip.rows[1].band, [2, 2]);
  assert.equal(hawaii.strip.label, 'Democratic seats in Hawaii: proportional 1, neutral-map median 2 (90% of maps give 2), enacted 2.');
  // California: drawing 3
  assert.equal(recordView(r, 'CA').headline.sentence, '3 seats toward Democrats compared with the state\'s neutral-map median.');
});

test('singleSeatView: the short record of a state with one seat', () => {
  assert.deepEqual(singleSeatView(results(), 'WY'), {
    postal: 'WY', name: 'Wyoming', kicker: 'State record', headline: '1 seat',
    lines: [AT_LARGE_TEXT, 'Not counted in the 429 seats compared here.'],
  });
});

// --- chapter 03 (Task 7.5) ---

test('decideView: the House majority with its rows of dots', () => {
  const r = withExtensions();
  const view = decideView(r);
  assert.equal(view.intro, 'The same votes, read for control of the House and the Senate, for redraws since 2024 and for close districts.');
  // the texts of Phase 6 stay
  const m = majorityView(r);
  for (const key of ['sentence', 'proportionalNote', 'rule', 'label']) assert.equal(view.majority[key], m[key], key);
  // domain: see rowDomain in axes.test.js, 0.49 to 0.53 in whole points
  assert.deepEqual(view.majority.dots.domain, [0.49, 0.53]);
  assert.deepEqual(view.majority.dots.ticks.map((t) => t.text), ['49%', '50%', '51%', '52%', '53%']);
  // shares with one decimal: 49.787 -> 49.8, 51.157 -> 51.2, 52.303 -> 52.3; the vote 51.797 -> 51.8
  assert.deepEqual(view.majority.dots.rows, [
    { key: 'proportional', label: 'Proportional', value: 0.4978747, text: '49.8%' },
    { key: 'neutral', label: 'Neutral median', value: 0.5115747, text: '51.2%', band: [0.5065747, 0.5159747] },
    { key: 'enacted', label: 'Enacted', value: 0.5230328, text: '52.3%', filled: true },
  ]);
  assert.deepEqual(view.majority.dots.base, { value: 0.5179747, text: 'Vote 51.8%' });
});

test('decideView: Senate, competitive districts, redraws and the tables', () => {
  const r = withExtensions();
  const view = decideView(r);
  // Senate: share 0.5291 -> 52.9%, base 0.5172 -> 51.7%, 22 states of the 26 needed
  assert.deepEqual(view.senate.figures, [
    { value: '52.9%', label: 'needed for a majority' }, { value: '51.7%', label: 'Democratic share' },
    { value: '22', label: 'states won, 26 needed' },
  ]);
  const s = senateView(r);
  assert.equal(view.senate.sentence, s.sentence);
  assert.equal(view.senate.note, s.note);
  // competitive: enacted 81, median 96, band 87 to 105; domain 75 to 110 in steps of 5 (rowDomain)
  assert.deepEqual(view.competitive.figures, [{ value: '81', label: 'enacted maps' }, { value: '96', label: 'neutral median' }]);
  assert.deepEqual(view.competitive.dots.domain, [75, 110]);
  assert.deepEqual(view.competitive.dots.ticks.map((t) => t.text), ['75', '80', '85', '90', '95', '100', '105', '110']);
  assert.deepEqual(view.competitive.dots.rows, [
    { key: 'neutral', label: 'Neutral median', value: 96, band: [87, 105] },
    { key: 'enacted', label: 'Enacted', value: 81, filled: true },
  ]);
  assert.equal(view.competitive.label, 'Competitive districts: 81 on the enacted maps and 96 on neutral maps, '
    + 'with 90% of neutral maps between 87 and 105.');
  assert.equal(view.competitive.text, 'Competitive districts (45 to 55%): 81 on the enacted maps, 96 on neutral maps (90% of neutral maps: 87 to 105).');
  // redraws: 217 on the 2024 maps, 213 on the 2026 maps, change -4
  assert.deepEqual(view.redraws.figures, [
    { value: '217 to 213', label: 'Democratic seats, 2024 maps to 2026 maps' }, { value: 'R+4', label: '4 seats toward Republicans' },
  ]);
  assert.deepEqual({ sentence: view.redraws.sentence, rows: view.redraws.rows }, redrawView(r));
  assert.deepEqual(view.control, controlTables(r));
});
