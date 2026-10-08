// Tests for site/js/chapters.js on the made-up results in testdata.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results } from './testdata.js';
import { LABELS, SHORT_LABELS, EFFECT_LABELS, outcomesView, waffleText } from './chapters.js';

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
  const view = outcomesView(results());
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

test('outcomesView: an enacted count inside or above the band, a band of one count, no effect', () => {
  const r = results();
  r.national.enacted = 220; // 217 <= 220 <= 229
  assert.match(outcomesView(r).spread, /The enacted maps give 220, within that range\.$/);
  r.national.enacted = 230; // above 229
  assert.match(outcomesView(r).spread, /The enacted maps give 230, above that range\.$/);
  const one = results();
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
  const view = outcomesView(results());
  // enacted 213 of 429 -> 429 - 213 = 216 Republican seats
  assert.deepEqual(waffleText(view, 'enacted'), { d: '213', r: '216', label: 'Enacted maps: 213 Democratic and 216 Republican seats of 429.' });
  // neutral 223 -> 206
  assert.deepEqual(waffleText(view, 'neutral'), { d: '223', r: '206', label: 'Neutral-map median: 223 Democratic and 206 Republican seats of 429.' });
});
