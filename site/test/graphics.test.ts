// Tests for site/src/lib/graphics.ts on the made-up results in testdata.ts. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withExtensions as results } from './testdata.ts';
import { outcomesView } from '../src/lib/chapters.ts';
import { effectList } from '../src/lib/model.ts';
import { CREDIT, LICENSE, LIGHT, SITE_NAME, nationalGraphic, statesGraphic } from '../src/lib/graphics.ts';

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
  assert.ok(g.zeros.startsWith(`${list.zeroLabel}: `));
  assert.ok(g.caption.includes(' neutral maps per state, the maps used on November 3, 2026 move '));
  assert.ok(g.caption.endsWith('Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).'));
  assert.equal(g.file, 'somevotes-drawing-effect-by-state.png');
});
