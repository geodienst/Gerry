// Tests for site/src/lib/graphics.ts on the made-up results in testdata.ts. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withExtensions as results } from './testdata.ts';
import { outcomesView } from '../src/lib/chapters.ts';
import { effectList } from '../src/lib/model.ts';
import { CREDIT, LICENSE, LIGHT, SITE_NAME, nationalGraphic, slug, stateGraphic, statesGraphic, statesMapGraphic } from '../src/lib/graphics.ts';
import { stateCsv, statesCsv } from '../src/lib/csv.ts';

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const light = tokens.match(/:root \{([\s\S]*?)\n\}/)![1];

test('the images use the light tokens of the site, whatever the color scheme on screen', () => {
  for (const [name, value] of Object.entries(LIGHT)) {
    assert.match(light, new RegExp(`--${name}: ${value};`), `--${name}`);
  }
});

test('credit, license and address: CC BY 4.0 and the site address without its scheme', () => {
  assert.equal(CREDIT, 'Govert Schoof, Geodienst, University of Groningen');
  assert.deepEqual(LICENSE, { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' });
  assert.equal(SITE_NAME, 'somevotes.org');
});

test('nationalGraphic: the three counts of chapter 01 at a stop of the slider, with votes, date, sources and address', () => {
  const r = results();
  const view = outcomesView(r);
  const g = nationalGraphic(r, view, view.baseIndex);
  const point = view.points[view.baseIndex];
  assert.equal(g.title, 'The same votes. Three different outcomes.');
  assert.equal(g.lead, point.lead);
  // the House of 435 with its majority line
  assert.equal(g.total, 435);
  assert.equal(g.majority, 218);
  assert.equal(g.majorityLabel, '218 for a majority');
  assert.deepEqual(g.rows.map((row) => [row.key, row.seats]), point.rows.map((row) => [row.key, row.seats]));
  // simpler than chapter 01: the neutral row names neither the median nor the band
  assert.deepEqual(g.rows.map((row) => row.label), ['Vote-proportional', 'Neutral maps', 'Enacted maps']);
  assert.deepEqual(g.rows.map((row) => row.desc), [point.rows[0].desc, '', point.rows[2].desc]);
  // each side of the majority line names its majority
  assert.deepEqual(g.sides, { r: 'Republican majority', d: 'Democratic majority' });
  assert.equal(g.alt, `${point.lead} For each count, one block per seat between the count and the 218 seats needed for a majority.`);
  assert.deepEqual(g.steps, point.steps.map((s) => s.value));
  assert.match(g.foot.votes, /^Votes: the 2016 and 2020 presidential results added together, \d+\.\d% Democratic\.$/);
  assert.match(g.foot.maps, /^Maps used on November 3, 2026, legal status as of [A-Z][a-z]+ \d+, \d{4}\. Neutral maps and votes: ALARM Project\. District maps: U\.S\. Census Bureau\.$/);
  assert.equal(g.foot.credit, 'Govert Schoof, Geodienst, University of Groningen. CC BY 4.0.');
  assert.equal(g.foot.site, 'somevotes.org');
  assert.ok(g.caption.startsWith('With the 2016 and 2020 presidential votes, the maps used on November 3, 2026 give Democrats '));
  assert.ok(g.caption.endsWith('Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).'));
  assert.ok(g.caption.includes(' House seats. Neutral maps, ') && !g.caption.includes('median'), g.caption);
  assert.match(g.file, /^somevotes-national-\d+-\d\.png$/);
  // another stop names the shifted vote share
  const other = view.points.findIndex((p) => !p.base);
  const shifted = nationalGraphic(r, view, other);
  assert.match(shifted.foot.votes, /every district shifted so that Democrats have \d+\.\d% of the two-party vote\.$/);
  assert.ok(shifted.caption.startsWith(`With Democrats at ${view.points[other].label} of the two-party vote, `));
});

test('statesGraphic: the net and a row per state that moves seats, largest first in both columns', () => {
  const r = results();
  const list = effectList(r);
  const g = statesGraphic(r, outcomesView(r));
  assert.equal(g.title, 'Drawing effect by state');
  assert.equal(g.net, list.bar.net);
  assert.equal(g.summary, list.summary);
  assert.equal(g.toR.length + g.toD.length + list.zero.length, Object.keys(r.states).length);
  // each column holds its own party's movers, under its own heading
  assert.ok(g.toR.every((row) => row.drawing < 0) && g.toD.every((row) => row.drawing > 0));
  assert.deepEqual(g.toR.map((row) => row.name), ['Florida', 'Texas']);
  assert.deepEqual(g.toD.map((row) => row.name), ['California', 'New Mexico']);
  assert.equal(g.headR, list.bar.left);
  assert.equal(g.headD, list.bar.right);
  for (const column of [g.toR, g.toD]) {
    assert.ok(column.every((row, i) => i === 0 || Math.abs(row.drawing) <= Math.abs(column[i - 1].drawing)));
  }
  // without the median, which the site explains
  assert.equal(g.note, 'Seats each enacted map moves toward one party, compared with neutral maps.');
  assert.ok(g.zeros.startsWith(`${list.zero.length} states match their neutral maps: `), g.zeros);
  assert.ok(!/median/.test(`${g.title} ${g.note} ${g.zeros}`));
  assert.ok(g.caption.includes(' neutral maps per state, drawn by a computer, the maps used on November 3, 2026 move '), g.caption);
  assert.ok(!g.caption.includes('median'));
  assert.ok(g.caption.endsWith('Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).'));
  assert.equal(g.file, 'somevotes-drawing-effect-by-state.png');
});

test('stateGraphic: a state as its record, the neutral maps without their median, and a caption in the words of the national one', () => {
  const r = results();
  const view = outcomesView(r);
  // testdata Texas: 4 seats, proportional 2, neutral median 2, enacted 0, drawing effect R+2
  const g = stateGraphic(r, view, 'TX');
  assert.equal(g.single, false);
  assert.equal(g.title, 'Texas');
  assert.equal(g.meta, '4 seats. PLANC2333 (HB 4). Challenged in court.');
  assert.deepEqual(g.headline, { value: 'R+2', drawing: -2, sentence: "2 seats toward Republicans compared with the state's neutral-map median." });
  assert.deepEqual(g.rows, [{ label: 'Vote-proportional', value: '2' }, { label: 'Neutral maps', value: '2' }, { label: 'Enacted maps', value: '0' }]);
  assert.equal(g.seatsOf, 'Democratic seats of 4.');
  assert.equal(g.caption, 'With the 2016 and 2020 presidential votes, the map Texas uses on November 3, 2026 gives Democrats 0 of its 4 '
    + "House seats. Neutral maps, 5,000 drawn by a computer, give 2; seats in proportion to the state's vote give 2. "
    + 'Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).');
  assert.equal(g.file, 'somevotes-texas.png');
  // the state's own share, not the national 51.8%
  assert.equal(g.foot.votes, 'Votes: the 2016 and 2020 presidential results added together, 46.4% Democratic in Texas.');
  // a state whose votes are 2020 alone (West Virginia in the real data) says so in the caption, the foot and the CSV
  const alone = results();
  alone.states.TX.notes = [...alone.states.TX.notes, { key: 'composite_2020_only', text: '' }];
  const g20 = stateGraphic(alone, outcomesView(alone), 'TX');
  assert.ok(g20.caption.startsWith('With the 2020 presidential votes, the map Texas uses on November 3, 2026 gives Democrats 0 of its 4 '));
  assert.equal(g20.foot.votes, 'Votes: the 2020 presidential results alone, 46.4% Democratic in Texas.');
  assert.ok(stateCsv(alone, 'TX')!.text.startsWith('district,democratic_votes_2020,republican_votes_2020,democratic_share\r\n'));
  // a state with one seat: its name and the two lines of its short record
  const ak = stateGraphic(r, view, 'AK');
  assert.equal(ak.single, true);
  assert.equal(ak.headline, null);
  assert.deepEqual(ak.lines, ['One at-large seat. No districts, so nothing to compare.',
    'In all three counts this seat goes to Republicans, who won Alaska in 2016 and 2020.']);
  assert.ok(ak.caption.startsWith('Alaska. One at-large seat.'));
  assert.equal(ak.foot.votes, 'Votes: the 2016 and 2020 presidential results.');
  assert.equal(ak.file, 'somevotes-alaska.png');
  assert.equal(slug('New Mexico'), 'new-mexico');
});

test('statesMapGraphic: the texts of the drawing effect by state, under its own file name', () => {
  const r = results();
  const view = outcomesView(r);
  const map = statesMapGraphic(r, view);
  const list = statesGraphic(r, view);
  assert.deepEqual([map.title, map.net, map.summary, map.caption], [list.title, list.net, list.summary, list.caption]);
  assert.equal(map.file, 'somevotes-drawing-effect-map.png');
});

test('stateCsv and statesCsv: a header row, one line per district in order of number or per state by name', () => {
  const r = results();
  // the districts come in out of order, the states too (testdata lists TX, CA, FL, ...)
  r.states.TX.districts = [...r.states.TX.districts].reverse();
  const tx = stateCsv(r, 'TX')!;
  assert.equal(tx.file, 'somevotes-texas-districts.csv');
  const lines = tx.text.split('\r\n');
  assert.equal(lines[0], 'district,democratic_votes_2016_2020,republican_votes_2016_2020,democratic_share');
  assert.deepEqual(lines.slice(1, -1).map((l) => l.split(',')[0]), ['TX-1', 'TX-9', 'TX-15', 'TX-28']);
  assert.equal(lines[1], 'TX-1,160635,433426,0.2704');
  assert.equal(lines.at(-1), '');
  assert.equal(stateCsv(r, 'AK'), null);
  const all = statesCsv(r);
  assert.equal(all.file, 'somevotes-states.csv');
  const rows = all.text.split('\r\n');
  assert.equal(rows[0], 'state,postal,seats,status,democratic_share,vote_proportional,neutral_median,neutral_p5,neutral_p95,enacted,'
    + 'geographic_effect,drawing_effect');
  assert.equal(rows.find((l) => l.startsWith('Texas,')), 'Texas,TX,4,Challenged in court,0.4635,2,2,1,3,0,0,R+2');
  assert.equal(rows.length, Object.keys(r.states).length + 2);
  assert.deepEqual(rows.slice(1, -1).map((l) => l.split(',')[0]), Object.values(r.states).map((s) => s.name).sort((a, b) => a.localeCompare(b, 'en')));
});
