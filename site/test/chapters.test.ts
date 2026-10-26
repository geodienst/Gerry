// Tests for site/src/lib/chapters.ts on the made-up results in testdata.ts. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { results, withExtensions } from './testdata.ts';
import {
  LABELS, SHORT_LABELS, EFFECT_LABELS, outcomesView, waffleText, changedKey, recordView, singleSeatView,
  decideView, keyFindings,
} from '../src/lib/chapters.ts';
import { stateSheet, AT_LARGE_TEXT } from '../src/lib/model.ts';
import { senateView, redrawView, controlTables } from '../src/lib/extensions.ts';

// --- chapter 01 (Task 7.3) ---

test('labels: the three ways of counting and the two effects, as CLAUDE.md names them', () => {
  assert.deepEqual(LABELS, { proportional: 'Vote-proportional', neutral: 'Neutral-map median', enacted: 'Enacted maps' });
  // short forms for the rows of dots, where the label column is 112 units wide
  assert.deepEqual(SHORT_LABELS, { proportional: 'Proportional', neutral: 'Neutral median', enacted: 'Enacted' });
  assert.deepEqual(EFFECT_LABELS, { geographic: 'Geographic effect', drawing: 'Drawing effect' });
});

test('outcomesView: three rows, the two effects between them, the band and the sentences', () => {
  // testdata national: 429 districts; proportional 224, neutral 223 (p5 217, p95 229), enacted 213; geographic -1,
  // drawing -10; position.more 0.9972; seven states; Texas first with 5,000 maps. Every count is shown in the House of
  // 435: plus the 2 Democratic single-seat states -> 226, 225 (219 to 231), 215.
  const view = outcomesView(withExtensions());
  // 215 is 218 - 3; position.more 0.9972 -> "More than 99%", under the House
  assert.equal(view.lead, 'Democrats would win 215 seats on the 2026 maps, 3 short of a majority. '
    + 'The result on a neutral map is 225.');
  assert.equal(view.points[view.baseIndex].beats, 'More than 99% of the simulated neutral maps give Democrats more seats '
    + 'than the 2026 maps do.');
  // at 50%: 207 of the 2026 maps is 11 short; neutral median 205; 19% of neutral outcomes above the enacted maps
  assert.equal(view.points[0].lead, 'Democrats would win 207 seats on the 2026 maps, 11 short of a majority. '
    + 'The result on a neutral map is 205.');
  assert.equal(view.points[0].beats, '19% of the simulated neutral maps give Democrats more seats than the 2026 maps do.');
  assert.equal(view.intro, 'Choose an option to see how the seats will be divided. On top of that, move the slider to change '
    + 'the national vote share.');
  assert.equal(view.total, 435);
  assert.deepEqual(view.rows.map((r) => [r.key, r.label, r.seats, r.value]), [
    ['proportional', 'Vote-proportional', 226, '226'], ['neutral', 'Neutral-map median', 225, '225'], ['enacted', 'Enacted maps', 215, '215'],
  ]);
  assert.deepEqual(view.rows.map((r) => r.desc), [
    "Seats in proportion to each state's two-party vote.",
    '90% of neutral maps: 219 to 231.',
    'The maps used on November 3, 2026.',
  ]);
  // the effects do not change: the single-seat states are the same in every count
  assert.deepEqual(view.steps, [
    { key: 'geographic', label: 'Geographic effect', name: 'geography', value: 'R+1', words: '1 seat toward Republicans', detail: '1 seat toward Republicans (226 to 225)' },
    { key: 'drawing', label: 'Drawing effect', name: 'drawing', value: 'R+10', words: '10 seats toward Republicans', detail: '10 seats toward Republicans (225 to 215)' },
  ]);
  assert.deepEqual(view.band, { lo: 219, hi: 231, key: 'Outlined: where the Democratic seats end in 90% of neutral outcomes (219 to 231 of 435)' });
  // the finding beside the waffle: drawing -10, enacted 215, neutral median 225
  assert.equal(view.finding, 'In this comparison, with the 2016 and 2020 votes (51.8% for Democrats), the enacted maps shift '
    + '10 seats toward Republicans. They give Democrats 215 seats, where the neutral-map median gives 225.');
  // the House of 435: 218 - 216 = 2 Democratic one-seat states (DE, VT), 4 Republican (AK, ND, SD, WY)
  assert.deepEqual(view.house, {
    dSingle: 2, rSingle: 4,
    singles: [
      { party: 'D', text: 'Delaware and Vermont: one seat each, not part of the comparison. They count for Democrats, who won both states in 2016 and 2020.' },
      { party: 'R', text: 'Alaska, North Dakota, South Dakota and Wyoming: one seat each, not part of the comparison. They count for Republicans, who won all four states in 2016 and 2020.' },
    ],
    fillKey: '1 square = 1 seat of 435. Democrats fill from the left, Republicans from the right.',
    singleKey: 'Framed: the six states with one seat, the same in every count.',
  });
  assert.equal(view.effectsNote, 'The first comparison shows what changes when votes are counted in districts rather than '
    + 'translated into proportional seats. The second shows what changes when we use the 2026 maps instead of neutral maps.');
  assert.equal(view.majorityLabel, '218 for a majority');
  // 215 < 219
  assert.equal(view.spread, '90% of neutral outcomes give Democrats 219 to 231 seats. The enacted maps give 215, below that range.');
  // 0.9972 -> 99.72% -> rounds to 100 but is not all outcomes -> "more than 99%" (nationalView)
  assert.equal(view.position, 'In more than 99% of neutral outcomes Democrats win more seats than under the enacted maps.');
  // plans: Texas's dist 0 + 300 + 4000 + 700 + 0 = 5,000
  assert.equal(view.neutralNote, 'The neutral maps come from the ALARM Project. For each state a computer drew 5,000 maps that follow '
    + "the state's rules, such as equal population and the Voting Rights Act, without using party data. The national figures combine "
    + 'the 7 states with more than one seat and add the six states with one seat.');
  assert.equal(view.scope, '435 seats. The six states with one at-large seat (Alaska, Delaware, North Dakota, South Dakota, Vermont, '
    + 'Wyoming) count the same in all three ways, for the party that won them in 2016 and 2020; they cannot be redrawn.');
});

test('outcomesView: one view per point of the vote slider, the base point as the main view', () => {
  const view = outcomesView(withExtensions());
  assert.deepEqual(view.points.map((p) => p.label), ['50.0%', '51.8%', '53.0%']);
  assert.equal(view.baseIndex, 1);
  const base = view.points[1];
  for (const key of ['rows', 'steps', 'band', 'finding', 'spread', 'position'] as const) assert.deepEqual(base[key], view[key], key);
  const half = view.points[0];
  // at 50%: 217, 203 (197 to 208) and 205 of the districts, plus 2 -> 219, 205 (199 to 210), 207
  assert.deepEqual(half.rows.map((r) => [r.key, r.label, r.seats, r.value]),
    [['proportional', 'Vote-proportional', 219, '219'], ['neutral', 'Neutral-map median', 205, '205'], ['enacted', 'Enacted maps', 207, '207']]);
  assert.equal(half.rows[1].desc, '90% of neutral maps: 199 to 210.');
  // geographic 205 - 219 = -14, drawing 207 - 205 = +2
  assert.deepEqual(half.steps.map((s) => [s.value, s.detail]),
    [['R+14', '14 seats toward Republicans (219 to 205)'], ['D+2', '2 seats toward Democrats (205 to 207)']]);
  assert.equal(half.finding, 'In this comparison, with Democrats at 50.0% of the two-party vote, the enacted maps shift 2 seats toward Democrats. '
    + 'They give Democrats 207 seats, where the neutral-map median gives 205.');
  assert.equal(half.spread, '90% of neutral outcomes give Democrats 199 to 210 seats. The enacted maps give 207, within that range.');
  assert.equal(half.position, 'In 19% of neutral outcomes Democrats win more seats than under the enacted maps.');
  assert.equal(half.valueText, '50.0% of the two-party vote for Democrats');
  assert.equal(base.valueText, '51.8% of the two-party vote for Democrats, the 2016 and 2020 result');
  // the slider: a plain scale at the whole percents among the stops, and a mark at the 2016 and 2020 votes
  // (no threshold labels, which looked like choices). testdata stops: 50%, the base, 53%
  assert.deepEqual(view.slider.scale, [{ index: 0, label: '50%' }, { index: 2, label: '53%' }]);
  assert.deepEqual(view.slider.base, { index: 1, label: '2016 and 2020 votes' });
  assert.equal(view.slider.label, 'Democratic share of the national two-party vote');
  assert.equal(view.slider.caption, 'The slider moves every district by the same amount; it is not a forecast.');
  // why presidential votes of 2016 and 2020; plans 5,000 per state; 2024 at 49.2499% -> 49.2%
  assert.deepEqual(view.why, { summary: 'Why these votes?', text: 'House results depend on the maps themselves: in safe '
    + 'districts one party often has no candidate, and incumbents run ahead of their party. Presidential votes are cast '
    + 'everywhere for the same two candidates, so they can be counted on any map, including the 5,000 neutral maps per '
    + 'state. The ALARM Project provides them by voting district for 2016 and 2020; adding both evens out the candidates '
    + 'of a single year. In 2024 Democrats won 49.2% of the two-party presidential vote. Move the slider there to see a '
    + 'year like it.' });
});

test('outcomesView: the drawing effect at every stop of the slider, with a few examples', () => {
  const { byVote } = outcomesView(withExtensions());
  // testdata stops: 50% (205 against 203 of 435: D+2), the base (215 against 225: R+10), 53% (223 against 236: R+13)
  assert.deepEqual(byVote.bars.map((b) => [b.index, b.drawing, b.value]), [[0, 2, 'D+2'], [1, -10, 'R+10'], [2, -13, 'R+13']]);
  assert.equal(byVote.bars[2].title, '53.0% of the vote: R+13. Enacted maps 223, neutral-map median 236.');
  assert.equal(byVote.title, 'The effect size of enacted maps');
  // the first stop with an effect toward Republicans is the base, 51.8%
  assert.equal(byVote.text, 'The enacted maps have fewer close districts than neutral maps, so they react less when the '
    + 'national vote shifts. When Democrats win less than 51.8% of the national two-party vote, the enacted maps give them '
    + 'more seats than neutral maps would. From 51.8% on they give them fewer. Each bar shows the drawing effect at one '
    + 'position of the vote slider in chapter 01; the dark line marks where the slider stands.');
  assert.equal(byVote.axis, 'Democratic share of the national two-party vote');
  // examples: the stop nearest 2024 (here 50.0%, not 49.2%, so no year), 50%, the 2016 and 2020 votes, the strongest effect
  assert.deepEqual(byVote.examples, [
    { index: 0, label: '50.0%', note: '', value: 'D+2' },
    { index: 1, label: '51.8%', note: '2016 + 2020', value: 'R+10' },
    { index: 2, label: '53.0%', note: '', value: 'R+13' },
  ]);
  assert.equal(byVote.line, '50.0%: D+2; 51.8% (2016 + 2020): R+10; 53.0%: R+13');
  assert.equal(byVote.label, 'Drawing effect at each point of the vote slider, from 50.0% to 53.0%. 50.0%: D+2; '
    + '51.8% (2016 + 2020): R+10; 53.0%: R+13.');
  assert.equal(byVote.max, 15); // the largest effect, 13, rounded up to 5
});

test('outcomesView: the explainer in five steps, each with a row and a stop of the slider', () => {
  const view = outcomesView(withExtensions());
  const { tour } = view;
  assert.equal(tour.base, view.baseIndex);
  // the first four steps stay at the 2016 and 2020 votes; the fifth goes to the stop nearest 2024 (49.25%): in testdata
  // the stops are 50%, the base and 53%, so 50.0%, where the enacted maps give 205 + 2 and neutral maps 203 + 2
  assert.deepEqual(tour.steps.map((s) => [s.key, s.index]), [['proportional', 1], ['proportional', 1], ['neutral', 1], ['enacted', 1], ['enacted', 0]]);
  assert.deepEqual(tour.steps.map((s) => s.text), [
    'Each square is one seat in the U.S. House, 435 in all. The party with 218 seats has the majority.',
    "Vote-proportional: if each state's seats followed its two-party vote, Democrats would win 226 seats.",
    'Neutral-map median: a computer drew 5,000 legal maps per state without using party data. Their middle outcome gives '
      + 'Democrats 225 seats, 1 seat toward Republicans compared with the votes. That is the geographic effect.',
    'Enacted maps: the maps the states drew for November 3, 2026 give Democrats 215 seats, 10 seats toward Republicans '
      + 'compared with neutral maps. That is the drawing effect.',
    'The slider moves the national vote. At 50.0%, near the Democratic share of the 2024 presidential vote, the enacted maps '
      + 'give Democrats 207 seats and neutral maps 205.',
  ]);
  assert.equal(tour.intro, 'A short tour of this chapter in five steps.');
  assert.equal(tour.end, 'That is the comparison. Choose a row or move the slider to explore it yourself.');
  // without the presidential shares the tour has four steps and the 2024 sentence is left out
  const r = withExtensions();
  delete r.national.president;
  const four = outcomesView(r);
  assert.equal(four.tour.steps.length, 4);
  assert.equal(four.tour.intro, 'A short tour of this chapter in four steps.');
  assert.ok(!four.why.text.includes('2024'));
});

test('outcomesView: no second stop with the label of the base', () => {
  const r = withExtensions();
  // a grid point at 51.8% next to the base share 0.5179747 would read 51.8% twice
  r.national.swing.points.splice(2, 0, { ...r.national.swing.points[1], share: 0.518, base: false });
  const view = outcomesView(r);
  assert.deepEqual(view.points.map((p) => p.label), ['50.0%', '51.8%', '53.0%']);
  assert.equal(view.baseIndex, 1);
  // the scale leaves out the base; the dropped stop at 51.8% does not count
  assert.deepEqual(view.slider.scale, [{ index: 0, label: '50%' }, { index: 2, label: '53%' }]);
});

test('outcomesView: the finding without a drawing effect, and the key of the changed seats', () => {
  const r = withExtensions();
  r.national.enacted = 223;
  r.national.effects.drawing = 0;
  assert.equal(outcomesView(r).finding, 'In this comparison, with the 2016 and 2020 votes (51.8% for Democrats), '
    + 'the enacted maps give Democrats 225 seats, the same as the neutral-map median.');
  assert.equal(changedKey(11), 'Star: the 11 seats that changed with this choice');
  assert.equal(changedKey(1), 'Star: the 1 seat that changed with this choice');
});

test('outcomesView: an enacted count inside or above the band, a band of one count, no effect', () => {
  const r = withExtensions();
  r.national.enacted = 220; // 217 <= 220 <= 229, shown as 222 in 219 to 231
  assert.match(outcomesView(r).spread, /The enacted maps give 222, within that range\.$/);
  r.national.enacted = 230; // above 229, shown as 232
  assert.match(outcomesView(r).spread, /The enacted maps give 232, above that range\.$/);
  const one = withExtensions();
  Object.assign(one.national.neutral, { p5: 223, p95: 223 });
  one.national.proportional = 223; // the effects follow from the counts: 223 to 223 is no geographic effect
  const view = outcomesView(one);
  assert.equal(view.rows[1].desc, '90% of neutral maps give 225.');
  assert.equal(view.spread, '90% of neutral outcomes give Democrats 225 seats. The enacted maps give 215, below that range.');
  assert.equal(view.band.key, 'Outlined: where the Democratic seats end in 90% of neutral outcomes (225 of 435)');
  // an effect of 0 keeps both numbers; the words say "no difference"
  assert.equal(view.steps[0].value, '0');
  assert.equal(view.steps[0].detail, 'no difference (225 to 225)');
});

test('waffleText: the count per party and the title of the waffle', () => {
  const view = outcomesView(withExtensions());
  // enacted 215 of 435 -> 220 Republican seats and a Republican majority (218 needed)
  assert.deepEqual(waffleText(view, 'enacted'), { d: '215', r: '220',
    label: 'Enacted maps: 215 Democratic and 220 Republican seats of 435: a Republican majority.' });
  // neutral 225 -> 210, a Democratic majority
  assert.deepEqual(waffleText(view, 'neutral'), { d: '225', r: '210',
    label: 'Neutral-map median: 225 Democratic and 210 Republican seats of 435: a Democratic majority.' });
});

// --- chapter 02 (Task 7.4) ---

test('recordView: the sheet of Phase 6 plus the headline, the strip and the extras (Texas)', () => {
  const r = withExtensions();
  const record = recordView(r, 'TX');
  // everything stateSheet gives stays
  const sheet = stateSheet(r, 'TX');
  for (const key of Object.keys(sheet) as (keyof typeof sheet)[]) assert.deepEqual(record[key], sheet[key], key);
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
      '2024 map: 3 Democratic seats with the 2016 and 2020 votes. 2026 map: 0 (3 fewer).'],
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
    lines: [AT_LARGE_TEXT, 'In all three counts this seat goes to Republicans, who won Wyoming in 2016 and 2020.'],
  });
});

// --- chapter 03 (Task 7.5) ---

test('keyFindings: the answer under the question in the masthead', () => {
  const r = withExtensions();
  // threshold 52.4%; the states move 4 + 2 = 6 seats toward Republicans and 1 + 3 = 4 toward Democrats, net R+2
  assert.deepEqual(keyFindings(r), [
    'With the maps the states drew for 2026, Democrats need 52.4% of the two-party vote for a House majority.',
    'The enacted maps move 6 seats toward Republicans and 4 toward Democrats. Net effect: R+2.',
    // the vote basis
    'All numbers use the 2016 and 2020 presidential votes together, 51.8% Democratic. They are not a prediction for '
      + 'November 3.',
  ]);
});

test('decideView: Senate, competitive districts, redraws and the tables', () => {
  const r = withExtensions();
  const view = decideView(r);
  // Senate: the view of extensions.js, which has its own tests
  const s = senateView(r);
  assert.deepEqual([view.senate.title, view.senate.needed, view.senate.sentence, view.senate.note],
    [s.title, s.needed, s.sentence, s.note]);
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
    { value: '219 to 215', label: 'Democratic seats, 2024 maps to 2026 maps' }, { value: 'R+4', label: '4 seats toward Republicans' },
  ]);
  assert.deepEqual({ sentence: view.redraws.sentence, rows: view.redraws.rows }, redrawView(r));
  assert.deepEqual(view.control, controlTables(r));
});
