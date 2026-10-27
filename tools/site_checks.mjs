import * as f from '../site/src/lib/format.ts';

// Browser checks for tools/check_site.mjs, one group per task of docs/superpowers/plans/2026-10-07-site.md and per chapter of docs/superpowers/plans/2026-10-08-redesign.md.
// A group gets `t` with: load, js, text, until, center, mouse, click, key, tab, sleep, check, screenshot.
// The checks test structure and the form of the texts, not numbers that change with the data.

const AT_LARGE = 'One at-large seat. No districts, so nothing to compare.';
const HEADING = "document.getElementById('sheet-title')?.textContent";
const ZOOM = "Number((document.querySelector('#map > g').getAttribute('transform') || '').match(/scale\\(([\\d.e-]+)\\)/)?.[1] ?? 1)";
const DATA = "fetch('data/results.json').then((r) => r.json())";
const districtOf = (postal) => `[...document.querySelectorAll('#map path.district')].find((p) => p.__data__.properties.state === '${postal}')`;
const stateOf = (postal) => `[...document.querySelectorAll('#map path.statefill')].find((p) => p.__data__.properties.postal === '${postal}')`;

// --- Task 6.3: the map ---------------------------------------------------------------------------
async function map(t) {
  t.check('the page loads and draws the map', await t.load());
  t.check('the map opens on "Districts: Democratic share"', await t.js(
    "document.getElementById('view-districts').getAttribute('aria-pressed') === 'true' && document.getElementById('view-states').getAttribute('aria-pressed') === 'false' && document.querySelector('#map path.district').parentNode.getAttribute('display') !== 'none'"));
  t.check('the map title above the map names the district view', (await t.text('#map-title')) === 'Democratic vote share by district');
  await t.js("document.getElementById('view-districts').click()");
  t.check('435 districts and 50 states on the map',
    await t.js("document.querySelectorAll('#map path.district').length === 435 && document.querySelectorAll('#map path.statefill').length === 50"));
  t.check('the zoom hint is hidden at the start', await t.js("getComputedStyle(document.getElementById('gesture')).display === 'none'"));
  t.check('the edge of the country is drawn in the gray of the state lines', await t.js(
    "(() => { const c = document.querySelectorAll('#map path.coast'); return c.length === 1 && c[0].getAttribute('d').length > 1000"
    + " && getComputedStyle(c[0]).stroke === 'rgb(163, 170, 165)'; })()"));
  t.check('while the tap line is empty it takes no room, so the box under the map is one row', await t.js(
    "document.getElementById('tapline').textContent === '' && document.getElementById('tapline').getBoundingClientRect().height === 0"
    + " && (() => { const f = document.querySelector('.mapfoot'), s = getComputedStyle(f), edge = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + parseFloat(s[k]), 0);"
    + " return Math.abs(f.getBoundingClientRect().height - f.querySelector('.mapbar').getBoundingClientRect().height - edge) < 0.5; })()"));
  t.check('the State menu lists all 50 states, the six with one seat marked', await t.js(
    "document.querySelectorAll('#pick option').length === 51 && [...document.querySelectorAll('#pick option')].filter((o) => o.textContent.endsWith(' (one seat)')).length === 6"));

  const wyoming = await t.center(districtOf('WY'));
  await t.mouse('mouseMoved', wyoming);
  t.check('pointing at Wyoming shows the at-large text', (await t.text('#tip')).includes(AT_LARGE));
  await t.click(wyoming);
  t.check('clicking Wyoming writes the tap line and opens its short record',
    (await t.text('#tapline')) === `Wyoming: ${AT_LARGE}` && await t.until(`location.hash === '#WY' && ${HEADING} === 'Wyoming'`));
  await t.js("document.getElementById('zoom-reset').click()");
  await t.until(`location.hash === '' && ${ZOOM} === 1`);
  await t.sleep(900); // let the zoom transition and the sheet settle before measuring a point on the map

  const texas = await t.center(districtOf('TX'));
  await t.mouse('mouseMoved', texas);
  t.check('pointing at a district shows its name and share',
    /^TX-\d+, Texas$/.test(await t.text('#tip b')) && (await t.text('#tip')).includes('Democratic share'));
  await t.click(texas);
  t.check('clicking a district writes the tap line', /^TX-\d+: .+ Democratic$/.test(await t.text('#tapline')), await t.text('#tapline'));
  t.check('clicking Texas puts #TX in the link and in the State menu',
    await t.until("location.hash === '#TX' && document.getElementById('pick').value === 'TX'"));
  t.check('the map zooms in on Texas', await t.until(`${ZOOM} > 2`));
  await t.js("document.getElementById('zoom-reset').click()");
  t.check('"All" drops the state from the link and shows the whole map', await t.until(`location.hash === '' && ${ZOOM} === 1`));
  await t.js('history.back()');
  t.check('the back button returns to Texas', await t.until("location.hash === '#TX' && document.getElementById('pick').value === 'TX'"));
  await t.js("location.hash = '#zz'");
  t.check('an unknown code in the link shows the whole map', await t.until("document.getElementById('pick').value === ''"));
  await t.js("(() => { const pick = document.getElementById('pick'); pick.value = 'CA'; pick.dispatchEvent(new Event('change')); })()");
  t.check('the State menu chooses a state', await t.until("location.hash === '#CA'"));
  await t.js('window.oldPage = true');
  await t.load('#TX');
  t.check('a page opened at #TX starts on Texas, zoomed in',
    (await t.js('window.oldPage === undefined')) && await t.until(`document.getElementById('pick').value === 'TX' && ${ZOOM} > 2`));

  await t.load();
  await t.js("document.getElementById('zoom-in').click()");
  t.check('"+" zooms in by 1.8', await t.until(`Math.abs(${ZOOM} - 1.8) < 1e-6`));
  await t.js("document.getElementById('zoom-out').click()");
  t.check('"−" zooms back out', await t.until(`Math.abs(${ZOOM} - 1) < 1e-6`));
  await t.mouse('mouseWheel', await t.center("document.getElementById('map')"), { deltaX: 0, deltaY: 120 });
  t.check('a plain scroll over the map shows "... + scroll to zoom the map"',
    await t.until("!document.getElementById('gesture').hidden", 2000) && (await t.text('#gesture')).endsWith('+ scroll to zoom the map'));
  await t.mouse('mouseWheel', await t.center("document.getElementById('map')"), { deltaX: 0, deltaY: -300, modifiers: 2 });
  t.check('Ctrl + scroll zooms the map', await t.until(`${ZOOM} > 1`, 3000));
  await t.js("document.getElementById('zoom-reset').click()");

  await t.js("document.getElementById('view-states').click()");
  t.check('"States: drawing effect" shows the states and a legend of 13 boxes', await t.js(
    "document.querySelector('#map path.statefill').parentNode.getAttribute('display') === null"
    + " && document.querySelector('#map path.district').parentNode.getAttribute('display') === 'none'"
    + " && document.querySelectorAll('#legend rect').length === 13"));
  t.check('the map title follows the view', (await t.text('#map-title')) === 'Drawing effect by state');
  await t.until(`${ZOOM} === 1`);
  await t.mouse('mouseMoved', await t.center(stateOf('TX')));
  t.check('pointing at a state shows its drawing effect',
    /^Drawing effect (0|[RD]\+\d+): /.test(await t.js("document.querySelector('#tip span')?.textContent ?? ''")));
  await t.js("document.getElementById('view-districts').click()");
  const legend = await t.text('#legend');
  t.check('the district legend runs from 20% to 80% with both ends named',
    ['20%', '80%', 'More Republican', 'More Democratic'].every((part) => legend.includes(part)));
  // no hint line under the map and no sentence under the legend, in any view
  const quiet = "!document.getElementById('maphint') && !document.querySelector('#legend .desc') && !document.getElementById('legend').textContent.includes('at-large')";
  const quietDistricts = await t.js(quiet);
  await t.js("document.getElementById('view-states').click()");
  const quietStates = await t.js(quiet);
  await t.js("document.getElementById('view-districts').click()");
  t.check('no hint line under the map and no sentence under the legend', quietDistricts && quietStates);
  // the six states with one seat are gray in both views; the legend says what the gray is
  const grayItem = (shapes, key) => `(() => {
    const item = [...document.querySelectorAll('#legend .item')].find((s) => s.textContent === 'Gray: one seat, no districts');
    const wyoming = [...document.querySelectorAll('${shapes}')].find((p) => p.__data__.properties.${key} === 'WY');
    return !!item && getComputedStyle(item.querySelector('i.sw')).backgroundColor === getComputedStyle(wyoming).fill; })()`;
  const grayDistricts = await t.js(grayItem('#map path.district', 'state'));
  await t.js("document.getElementById('view-states').click()");
  const grayStates = await t.js(grayItem('#map path.statefill', 'postal'));
  await t.js("document.getElementById('view-districts').click()");
  t.check('the legend of the districts and of the drawing effect names the gray of the six states with one seat',
    grayDistricts && grayStates, JSON.stringify({ grayDistricts, grayStates }));
  const fills = "[...document.querySelectorAll('#map path.district')].slice(0, 30).map((p) => p.getAttribute('fill')).join()";
  const party = await t.js(fills);
  await t.js("document.getElementById('palette-neutral').click()");
  t.check('"Teal and brown" repaints the map', (await t.js(fills)) !== party);
  await t.js("document.getElementById('palette-party').click()");
  t.check('"Red and blue" brings the party colors back', (await t.js(fills)) === party);
  await t.screenshot('map-1280');

  // "Districts: close races": the close districts from the purple of a tie toward the party ahead, the rest, the six
  // one-seat states too, in a pale tint of its party, gray state lines, no rings; the numbers come from results.json.
  await t.js("document.getElementById('view-close').click()");
  const closeWant = await t.js(`${DATA}.then((r) => {
    const close = Object.values(r.states).flatMap((s) => s.districts).filter((d) => d.share >= 0.45 && d.share <= 0.55)
      .sort((a, b) => Math.abs(a.share - 0.5) - Math.abs(b.share - 0.5));
    return { close: close.length, enacted: r.national.competitive.enacted, closest: close[0].id, label: close[0].label ?? null };
  })`);
  const closeSeen = await t.js(`(() => {
    const css = getComputedStyle(document.documentElement);
    const rgb = (color) => { const i = document.createElement('i'); i.style.color = color; document.body.append(i); const v = getComputedStyle(i).color; i.remove(); return v; };
    const near = (a, b) => { const x = rgb(a).match(/\\d+/g).map(Number), y = rgb(b).match(/\\d+/g).map(Number); return x.slice(0, 3).every((v, k) => Math.abs(v - y[k]) <= 6); };
    const party = ['--party-d', '--party-r'].map((n) => rgb(css.getPropertyValue(n).trim()));
    const tie = css.getPropertyValue('--party-tie').trim();
    const paths = [...document.querySelectorAll('#map path.district')];
    const loud = paths.filter((p) => !p.classList.contains('quiet'));
    const quiet = new Set(paths.filter((p) => p.classList.contains('quiet')).map((p) => rgb(p.getAttribute('fill'))));
    const closest = paths.find((p) => p.__data__.properties.id === ${JSON.stringify('__CLOSEST__')});
    return { loud: loud.length, loudParty: loud.some((p) => party.includes(rgb(p.getAttribute('fill')))),
      quiet: quiet.size, quietParty: party.some((c) => quiet.has(c)), closestTie: !!closest && near(closest.getAttribute('fill'), tie),
      listTie: near(document.querySelector('#sheet .dlist .sw').style.background, tie), rings: !!document.querySelector('#map .dots'),
      lines: getComputedStyle(document.querySelector('#map path.state')).stroke, title: document.getElementById('map-title').textContent,
      pressed: ['districts', 'states', 'close'].map((v) => document.getElementById('view-' + v).getAttribute('aria-pressed')).join() };
  })()`.replace('"__CLOSEST__"', JSON.stringify(closeWant.closest)));
  t.check('"Districts: close races" colors the close districts from the purple of a tie, the rest pale, gray state lines, no rings',
    closeSeen.loud === closeWant.close && closeWant.close === closeWant.enacted && !closeSeen.loudParty
    && closeSeen.quiet === 2 && !closeSeen.quietParty && closeSeen.closestTie && closeSeen.listTie && !closeSeen.rings
    && closeSeen.lines === 'rgb(163, 170, 165)' && closeSeen.title === 'Close districts' && closeSeen.pressed === 'false,false,true',
    JSON.stringify({ closeSeen, closeWant }));
  t.check('the close-races legend shows the bar from 45% to 55%, the pale rest and the counts, without rings or swing states', await t.js(
    "((el) => ['45%', '50%', '55%', 'Republicans ahead', 'Democrats ahead'].every((x) => [...el.querySelectorAll('svg text')].some((s) => s.textContent === x))"
    + " && el.querySelector('svg rect').getAttribute('fill') === 'url(#legend-close)' && el.textContent.includes('Pale: not close, more than 10 points apart')"
    + " && !/ring|swing/i.test(el.textContent))(document.getElementById('legend'))"));
  await t.mouse('mouseMoved', await t.center(districtOf('TX')));
  t.check('pointing at a district in this view adds the close districts of its state',
    /^Close districts in Texas: \d+ on the enacted map, a median of \d+ on neutral maps$/.test(await t.js("[...document.querySelectorAll('#tip span')].at(-1)?.textContent ?? ''")));
  t.check('the district under the mouse is outlined in this view, over the state lines', await t.js(`(() => {
    const line = document.querySelector('#map path.hoverline'), d = line.getAttribute('d');
    const under = [...document.querySelectorAll('#map path.district')].filter((p) => p.getAttribute('d') === d);
    return line.getAttribute('display') !== 'none' && under.length === 1 && under[0].__data__.properties.state === 'TX'
      && getComputedStyle(line).strokeWidth === '1.6px'
      && !!(line.compareDocumentPosition(document.querySelector('#map path.coast')) & Node.DOCUMENT_POSITION_PRECEDING); })()`));
  await t.js("document.getElementById('view-districts').click()");
  t.check('back to "Districts: Democratic share" drops the outline under the mouse and the purple', await t.js(
    "document.querySelector('#map path.hoverline').getAttribute('display') === 'none' && !document.querySelector('#map path.district.quiet')"
    + " && document.getElementById('legend').querySelector('svg rect').getAttribute('fill') === 'url(#legend-share)'"));

  // A phone: a tap writes the tap line without a tooltip, one finger is left to the page, two fingers zoom.
  await t.tab('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await t.load('', { width: 375, height: 800 });
  await t.js("document.getElementById('view-districts').click()");
  const tap = await t.center(districtOf('TX'));
  await t.tab('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...tap, id: 1 }] });
  await t.tab('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  t.check('a tap on a district writes the tap line and chooses its state',
    await t.until("location.hash === '#TX'", 3000) && /^TX-\d+: .+ Democratic$/.test(await t.text('#tapline')));
  t.check('a tap shows no tooltip', await t.js("document.getElementById('tip').hidden"));
  await t.load('', { width: 375, height: 800 });
  const middle = await t.center("document.getElementById('map')");
  const place = "document.querySelector('#map > g').getAttribute('transform')";
  const before = await t.js(place);
  await t.tab('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...middle, id: 1 }] });
  for (let dx = 8; dx <= 64; dx += 8) {
    await t.tab('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: middle.x + dx, y: middle.y, id: 1 }] });
  }
  await t.tab('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  t.check('one finger sideways shows "... two fingers to move the map" and leaves the map in place',
    !(await t.js("document.getElementById('gesture').hidden")) && (await t.text('#gesture')).endsWith('two fingers to move the map')
    && (await t.js(place)) === before);
  await t.tab('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: middle.x - 20, y: middle.y, id: 1 }] });
  await t.tab('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: middle.x - 20, y: middle.y, id: 1 }, { x: middle.x + 20, y: middle.y, id: 2 }] });
  for (let d = 30; d <= 90; d += 10) {
    await t.tab('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: middle.x - d, y: middle.y, id: 1 }, { x: middle.x + d, y: middle.y, id: 2 }] });
  }
  await t.tab('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  t.check('two fingers moving apart zoom the map', await t.until(`${ZOOM} > 1.5`, 2000));
  await t.tab('Emulation.setTouchEmulationEnabled', { enabled: false });
}

// --- Task 6.6: the list and the sheet ------------------------------------------------------------
async function list(t) {
  await t.load();
  // Without a state the column follows the view of the map. The districts first: a bar per
  // five points of Democratic share from the lowest district (18.3%, bin 15%) to the highest (92.0%, bin 90%).
  t.check('without a state, in the view of the districts, the column shows the districts by share',
    await t.until(`${HEADING} === 'Districts by Democratic share'`)
    && (await t.text('#sheet .count')) === 'With the 2016 and 2020 votes, Democrats win 213 of 429 districts. '
      + 'The six states with one seat add 2 Democratic seats, for 215 of 435.'
    && await t.js(`(() => { const bars = [...document.querySelectorAll('#sheet .bins rect')];
      const blue = getComputedStyle(document.documentElement).getPropertyValue('--party-d').trim();
      return bars.length === 16 && bars.reduce((n, b) => n + Number(b.querySelector('title').textContent.match(/: (\\d+) district/)[1]), 0) === 429
        && bars.map((b) => b.getAttribute('fill') === blue).join() === Array.from({ length: 16 }, (_, i) => i >= 7).join(); })()`)
    && (await t.text('#sheet > p.note')) === 'Click a state on the map for its record.');
  // and above it "All states together", as in the list of states: the net large, the bar of both sides, the sums
  t.check('above the districts by share the net of all states, large, as in the list', await t.js(
    "(() => { const net = document.querySelector('#sheet .net'); return !!net && net.querySelector('h3').textContent === 'All states together' && /^Net (0|[RD]\\+\\d+)$/.test(net.querySelector('.big').textContent) && !!net.querySelector('svg') && /Net: .+\\.$/.test(net.querySelector('p.note').textContent) && document.getElementById('sheet').firstElementChild === net; })()"));
  // the box is as high as its content; title and legend in the map box
  t.check('a short column box ends after its content, above the bottom of the map column', await t.js(`(() => {
    const record = document.getElementById('sheet').getBoundingClientRect(), col = document.querySelector('.atlas > .mapcol').getBoundingClientRect();
    return record.bottom < col.bottom - 100 && Math.abs(record.top - col.top) < 1; })()`));
  t.check('the title above the map and the legend under it, both in the map box', await t.js(`(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect(), box = r('mapbox'), map = r('map'), title = r('map-title'), legend = r('legend');
    return document.getElementById('mapbox').contains(document.getElementById('legend')) && !document.querySelector('.mapfoot .legend')
      && title.top >= box.top && title.bottom <= map.top + 1 && legend.top >= map.bottom - 1 && legend.bottom <= box.bottom; })()`));
  await t.js("document.querySelector('#states .tools').scrollIntoView()");
  await t.screenshot('districts-1280', { viewport: true });
  await t.js("document.getElementById('view-close').click()");
  t.check('in the view of the close races the column lists the 81 close districts, closest first',
    await t.until(`${HEADING} === 'Close districts, 45 to 55%'`) && (await t.text('#sheet .count')) === '81 on the 2026 maps.'
    && await t.js(`(() => { const v = [...document.querySelectorAll('#sheet .drow .v')].map((s) => Math.abs(parseFloat(s.textContent) - 50));
      return v.length === 81 && v.every((x, i) => i === 0 || x >= v[i - 1] - 0.051); })()`));
  t.check('above the close districts the net of all states as well', await t.js(
    "(() => { const net = document.querySelector('#sheet .net'); return !!net && net.querySelector('h3').textContent === 'All states together' && document.getElementById('sheet').firstElementChild === net; })()"));
  await t.js("document.querySelector('#states .tools').scrollIntoView()");
  await t.screenshot('close-1280', { viewport: true });
  const close = await t.js("document.querySelector('#sheet .drow').dataset.postal");
  await t.js("document.querySelector('#sheet .drow').click()");
  t.check('a click on a close district opens its state', await t.until(`location.hash === '#${close}' && ${HEADING} !== 'Close districts, 45 to 55%'`));
  t.check('the record starts with "Back" and an arrow', await t.js(
    "document.querySelector('#sheet .back').textContent === 'Back' && !!document.querySelector('#sheet .back svg path')"));
  await t.js("document.querySelector('#states .tools').scrollIntoView()");
  await t.screenshot('record-back-1280', { viewport: true });
  await t.js("document.querySelector('#sheet .back').click()");
  t.check('"Back" goes back to the close districts', await t.until(`${HEADING} === 'Close districts, 45 to 55%'`));
  await t.js("document.getElementById('view-states').click()");
  t.check('with "States: drawing effect" the sheet shows "Drawing effect by state"', await t.until(`${HEADING} === 'Drawing effect by state'`));
  t.check('one row per state, 44 in all', await t.js("document.querySelectorAll('#sheet .row').length === 44"));
  t.check('rows show the effect as R+n, D+n or 0', await t.js("[...document.querySelectorAll('#sheet .row .v')].every((v) => /^(0|[RD]\\+\\d+)$/.test(v.textContent))"));
  t.check('the states without a drawing effect are folded behind one line', await t.js(
    "(() => { const d = document.querySelector('#sheet details.zeros'); return d !== null && !d.open && /neutral median$/.test(d.querySelector('summary').textContent); })()"));
  t.check('the zero states sit inside the folded line and are not rendered while it is closed', await t.js(`(() => {
    const d = document.querySelector('#sheet details.zeros');
    const n = Number(d.querySelector('summary').textContent.match(/^\\d+/)[0]);
    const inside = [...d.querySelectorAll('.row')];
    const outside = [...document.querySelectorAll('#sheet .row')].filter((r) => !d.contains(r));
    return !d.open && inside.length === n && inside.every((r) => !r.checkVisibility())
      && inside.every((r) => r.querySelector('.v').textContent === '0')
      && outside.every((r) => r.querySelector('.v').textContent !== '0');
  })()`));
  await t.js("document.querySelector('#sheet details.zeros summary').click()");
  t.check('the line with the arrow unfolds them', await t.js("document.querySelector('#sheet details.zeros').open"));
  t.check('the net bar names both sides without a marker under it, and the net stands large above it, on top of the list', await t.js(
    "(() => { const net = document.querySelector('#sheet .net'), s = net?.querySelector('svg'); return s != null && s.textContent.includes('toward Republicans') && s.textContent.includes('toward Democrats') && !s.querySelector('path') && !/Net/.test(s.textContent) && /^Net (0|[RD]\\+\\d+)$/.test(net.querySelector('.big').textContent) && document.getElementById('sheet').firstElementChild === net; })()"));
  t.check('the net bar puts Republicans left in their color and Democrats right', await t.js(`(() => {
    const s = document.querySelector('#sheet .net svg');
    const [l, r] = s.querySelectorAll('rect');
    const css = getComputedStyle(document.documentElement);
    const c = s.viewBox.baseVal.width / 2;
    const [left, right] = s.querySelectorAll('text');
    return l.getAttribute('fill') === css.getPropertyValue('--party-r').trim()
      && r.getAttribute('fill') === css.getPropertyValue('--party-d').trim()
      && Number(l.getAttribute('x')) + Number(l.getAttribute('width')) <= c + 0.01 && Number(r.getAttribute('x')) >= c - 0.01
      && left.textContent.endsWith('toward Republicans') && right.textContent.endsWith('toward Democrats');
  })()`));
  t.check('a sentence under the net bar gives the sums', /Net: .+\.$/.test(await t.text('#sheet .net p.note')));
  await t.screenshot('list-1280');
}

async function sheet(t) {
  await t.load('#TX');
  t.check('#TX opens the sheet for Texas', await t.until(`${HEADING} === 'Texas'`));
  await t.js("document.getElementById('view-states').click()"); // back from a state, the column shows the list of states
  const texas = await t.text('#sheet');
  for (const part of ['State record', 'Back', 'Legal status as of ', 'Vote-proportional', 'Neutral-map median', 'Enacted maps', 'Geographic effect',
    'Drawing effect', 'neutral maps,', 'Districts, sorted', 'Efficiency gap', 'Mean-median', 'Notes', 'Map file:']) {
    t.check(`the Texas sheet has "${part}"`, texas.includes(part));
  }
  t.check('the status reads "In effect" or "Challenged in court"', /In effect|Challenged in court/.test(texas));
  t.check('effects show their direction', /([RD]\+\d+: \d+ seats? toward (Republicans|Democrats)|0: no difference)/.test(texas));
  t.check('the headline gives the drawing effect and says what it compares', await t.js(`(() => {
    const big = document.querySelector('#sheet .headline .big')?.textContent ?? '';
    const line = document.querySelector('#sheet .headline p')?.textContent ?? '';
    return /^(0|[RD]\\+\\d+)$/.test(big) && /(compared with the state's neutral-map median|No difference from the neutral-map median)\\.$/.test(line);
  })()`));
  const strip = await t.js(`(() => { const s = document.querySelector('#sheet svg.dotrows');
    return s && { role: s.getAttribute('role'), label: s.getAttribute('aria-label'), rows: [...s.querySelectorAll('text.lbl')].map((x) => x.textContent),
      band: s.querySelectorAll('rect.bandr').length, filled: s.querySelectorAll('circle.mk.filled').length }; })()`);
  t.check('the seat strip has three rows, the neutral band and Enacted as the filled dot',
    strip?.role === 'img' && strip.label.startsWith('Democratic seats in Texas:') && strip.rows.join() === 'Proportional,Neutral median,Enacted'
    && strip.band === 1 && strip.filled === 1, JSON.stringify(strip));
  t.check('efficiency gap in points toward a party', /points toward (Republicans|Democrats)|less than 0\.05 points either way/.test(texas));
  t.check('the seat axis and the sorted chart have a text alternative', await t.js(
    "[...document.querySelectorAll('#sheet svg.chart')].filter((s) => s.getAttribute('role') === 'img' && s.getAttribute('aria-label')).length === 2"));
  // The font size on screen, as in the layout group: the CSS size times the scale of the chart's viewBox.
  const sizes = await t.js("[...document.querySelectorAll('#sheet svg.chart text')].map((el) => parseFloat(getComputedStyle(el).fontSize) * el.getScreenCTM().a)");
  const small = sizes.filter((size) => !(size >= 10));
  t.check('chart text is at least 10px on screen', sizes.length > 0 && small.length === 0, sizes.length
    ? `${sizes.length} texts, smallest ${Math.min(...sizes).toFixed(1)}px${small.length ? `, ${small.length} below 10px` : ''}` : 'no chart text found');
  await t.js("location.hash = '#MO'");
  t.check('Missouri has the row for the blocked map', await t.until(`${HEADING} === 'Missouri'`)
    && /Blocked map.*Blocked.*would give/s.test(await t.text('#sheet')));
  t.check('in Missouri the neutral efficiency gap names the party once',
    /\(neutral maps: \d+\.\d points; 90% between \d+\.\d and \d+\.\d points, all toward Republicans\)/.test(await t.text('#sheet')));
  await t.js("location.hash = '#HI'");
  t.check('Hawaii shows "Not defined for two districts"', await t.until(`${HEADING} === 'Hawaii'`)
    && (await t.text('#sheet')).includes('Not defined for two districts'));
  t.check('a band of one seat count reads "90% of maps give 2" in Hawaii', (await t.text('#sheet')).includes('90% of maps give 2'));
  // Escape from the text outside the sheet and the map, such as the page heading, keeps the state.
  await t.js("(() => { const h = document.querySelector('header h1'); h.tabIndex = -1; h.focus(); })()");
  await t.key('Escape', 27);
  await t.sleep(300);
  t.check('Escape outside the sheet and the map keeps the state', await t.js(`${HEADING} === 'Hawaii' && location.hash === '#HI'`));
  await t.js("(() => { const h = document.querySelector('header h1'); h.blur(); h.removeAttribute('tabindex'); })()");
  await t.js("document.getElementById('sheet').scrollIntoView({ block: 'center' })"); // as a reader scrolls to the sheet
  await t.key('Escape', 27);
  t.check('Escape goes back to the list and drops the state from the link', await t.until(`${HEADING} === 'Drawing effect by state' && location.hash === ''`));
  await t.load();
  await t.js("document.getElementById('view-states').click()");
  await t.until(`${HEADING} === 'Drawing effect by state'`);
  const folded =await t.js("document.querySelector('#sheet details.zeros .row').dataset.postal");
  await t.js(`location.hash = '#${folded}'`);
  await t.until(`location.hash === '#${folded}' && ${HEADING} !== 'Drawing effect by state'`);
  await t.js("document.getElementById('sheet').scrollIntoView({ block: 'center' })"); // as a reader scrolls to the sheet
  await t.key('Escape', 27);
  await t.until(`${HEADING} === 'Drawing effect by state'`);
  t.check('Escape from a folded state puts focus on the heading of the list', await t.until("document.activeElement?.id === 'sheet-title'", 2000));
  await t.js("document.querySelector('#sheet .row').focus()");
  const first = await t.js("document.querySelector('#sheet .row').dataset.postal");
  await t.key('Enter', 13, '\r');
  t.check('Enter on a row opens that state', await t.until(`location.hash === '#${first}'`));
  t.check('focus moves to the heading of the sheet', await t.js("document.activeElement?.id === 'sheet-title'"));
  await t.key('Escape', 27);
  t.check('Escape puts focus back on the row of that state', await t.until(`document.activeElement?.dataset?.postal === '${first}'`));
  await t.js("document.querySelector('#sheet .row').click()");
  await t.until(`${HEADING} !== 'Drawing effect by state'`);
  await t.js("document.querySelector('#sheet .back').click()");
  t.check('the button "Back" goes back to the list', await t.until(`${HEADING} === 'Drawing effect by state'`));
  await t.js("document.querySelector('#sheet details.zeros summary').click()");
  await t.js("document.querySelector('#sheet .row').click()");
  await t.until(`${HEADING} !== 'Drawing effect by state'`);
  await t.js("document.querySelector('#sheet .back').click()");
  await t.until(`${HEADING} === 'Drawing effect by state'`);
  t.check('the zero states stay unfolded after a state and "Back"', await t.js("document.querySelector('#sheet details.zeros').open"));
  await t.load('#TX');
  await t.until(`${HEADING} === 'Texas'`);
  await t.screenshot('texas-1280');
  const before = await t.js("document.querySelector('#sheet svg.chart').getAttribute('viewBox')");
  await t.tab('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });
  const redrawn = await t.until(`document.querySelector('#sheet svg.chart').getAttribute('viewBox') !== '${before}'`, 3000);
  const fits = await t.js(`(() => { const s = document.querySelector('#sheet svg.chart'); const box = s.parentElement.getBoundingClientRect().width;
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Math.abs(s.viewBox.baseVal.width - Math.round(Math.max(280, Math.min(560, box * 15 / root)))) <= 1; })()`);
  t.check('a new window width draws the charts again at the new width', redrawn && fits);
  await t.tab('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await t.load('#WY');
  t.check('#WY opens the short record of Wyoming', await t.until(`${HEADING} === 'Wyoming'`)
    && (await t.text('#sheet')).includes(AT_LARGE) && (await t.text('#sheet .headline .big')) === '1 seat'
    && (await t.js("document.getElementById('pick').value")) === 'WY');
  await t.js("document.getElementById('view-states').click()");
  await t.js("document.getElementById('sheet').scrollIntoView({ block: 'center' })");
  await t.key('Escape', 27);
  t.check('Escape goes from Wyoming back to the list', await t.until(`${HEADING} === 'Drawing effect by state' && location.hash === ''`));
}

// A marker line stops at the labels of the other markers (Step 6: no line through the text).
const crossings = (scope) => `(() => {
  const hits = [];
  for (const svg of document.querySelectorAll('${scope} svg.chart')) {
    const labels = [...svg.querySelectorAll(':scope > text.mark-label')].map((node) => ({
      node, x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')), box: node.getBBox() }));
    if (!labels.length) continue;
    for (const line of svg.querySelectorAll(':scope > line')) {
      const x = Number(line.getAttribute('x1'));
      const half = Number(line.getAttribute('stroke-width') || 1) / 2;
      const [y1, y2] = [Number(line.getAttribute('y1')), Number(line.getAttribute('y2'))].sort((a, b) => a - b);
      // the line's own label is the nearest one above it at the same x
      const own = labels.filter((l) => Math.abs(l.x - x) < 1e-6 && l.y <= y1).sort((a, b) => b.y - a.y)[0];
      for (const l of labels) {
        if (l === own) continue;
        // the stroke reaches the label or its 1.5-unit halo
        const across = x + half > l.box.x - 1.5 && x - half < l.box.x + l.box.width + 1.5;
        const overlap = Math.min(y2, l.box.y + l.box.height) - Math.max(y1, l.box.y);
        if (across && overlap > 0.5) hits.push((own ? own.node.textContent : 'a line') + ' runs through ' + l.node.textContent);
      }
    }
  }
  return hits;
})()`;
// Text that should never reach a visitor: an em dash, a value that failed to format, an empty fill (Task 6.15).
const broken = `(() => {
  const bad = /\\u2014|undefined|NaN|\\[object|Infinity|[<>]\\d+%/;
  const texts = [document.body.textContent, ...[...document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'))];
  const hits = texts.flatMap((text) => text.split('\\n')).filter((line) => bad.test(line)).map((line) => line.trim().slice(0, 80));
  const empty = [...document.querySelectorAll('[data-fill]')].filter((el) => el.textContent.trim() === '').map((el) => 'empty ' + el.dataset.fill);
  return [...hits, ...empty];
})()`;

// --- Task 7.9: the page and the records of all states, for text that failed to format (was "national") ---
async function sweep(t) {
  await t.load('', { width: 1280, height: 900 });
  const hits = (await t.js(broken)).map((hit) => `page: ${hit}`);
  const states = await t.js(`${DATA}.then((r) => Object.keys(r.states))`);
  for (const postal of states) {
    await t.js(`location.hash = '#${postal}'`);
    await t.until(`document.getElementById('pick').value === '${postal}' && document.querySelector('#sheet svg.dotrows') !== null`);
    hits.push(...(await t.js(broken)).map((hit) => `${postal}: ${hit}`));
  }
  t.check(`no em dash, "undefined", "NaN", "<1%", ">99%" or empty fill on the page or on the records of all ${states.length} states`,
    hits.length === 0, hits.join('; '));
  t.check('the national strip is gone; its blocks are in chapters 01 and 03',
    await t.js("document.getElementById('national') === null && document.getElementById('decide') !== null"));
}

// --- Task 7.9: chapter 03 ------------------------------------------------------------------------
async function decide(t) {
  await t.load();
  t.check('chapter 03 is "In detail", without an intro, with five cards and the Senate last', await t.js(
    "[...document.querySelectorAll('#decide .grid3 > section')].map((s) => s.id).join() === 'competitive,redraws,control,legal,senate'")
    && (await t.text('#decide .chead h2')) === 'In detail' && await t.js("!document.getElementById('decide-intro')")
    && (await t.text('#senate .kicker')) === 'Beyond district lines');
  const figs = await t.js("[...document.querySelectorAll('#decide .figs b')].map((b) => b.textContent)");
  // competitive districts have three: the enacted maps, the neutral median and the vote-proportional count, which has
  // no districts; the maps in court and the Senate have two each: the challenged maps and their drawing effect, the
  // share needed and the seats of 100 at the slider
  t.check('nine large figures, each a formatted number', figs.length === 9
    && figs.every((v) => /^(\d+(\.\d+)?%|\d+|\d+ to \d+|\d+ of 100|0|[RD]\+\d+)$/.test(v)), figs.join(' | '));
  const axes = await t.js(`[...document.querySelectorAll('#decide svg.dotrows')].map((s) => ({ id: s.parentElement.id, role: s.getAttribute('role'),
    label: s.getAttribute('aria-label'), rows: [...s.querySelectorAll('text.lbl')].map((x) => x.textContent), base: s.querySelectorAll('line.base').length }))`);
  t.check('one chart of rows of dots, with a text alternative', axes.length === 1 && axes.every((a) => a.role === 'img' && a.label),
    JSON.stringify(axes));
  t.check('competitive districts have Neutral median and Enacted',
    axes[0]?.id === 'competitive-axis' && axes[0].rows.join() === 'Neutral median,Enacted' && axes[0].base === 0);
  for (const width of [375, 1280]) {
    await t.load('', { width, height: 900 });
    await t.screenshot(`decide-${width}`);
  }
}

// --- Task 6.8: the method and the footer ----------------------------------------------------------
async function method(t) {
  await t.load();
  t.check('the method is folded at the start', await t.js("document.getElementById('method-details')?.open === false"));
  t.check('chapter 04 has its heading and its fold', (await t.text('#method .chead h2')) === 'Methodology'
    && (await t.text('#method-details > summary')).startsWith('How the seats are calculated'));
  // the effect size of enacted maps is the first part of the fold, not a block of its own
  t.check('the effect size is the first part of the method fold', await t.js(
    "document.querySelector('#method-details .mbody').firstElementChild === document.getElementById('effect-size') && !document.querySelector('#method > .wrap > #effect-size')"));
  await t.js("document.getElementById('method-details').open = true");
  await t.sleep(300);
  t.check('opened, the chart of the effect size takes the width of the fold', await t.js(
    "(() => { const svg = document.querySelector('#byvote-chart svg'); return svg.getBoundingClientRect().width >= 0.9 * document.getElementById('byvote-chart').clientWidth && svg.getBoundingClientRect().width > 500; })()"));
  await t.js("document.getElementById('method').scrollIntoView()");
  await t.screenshot('method-open-1280', { viewport: true });
  await t.js("document.getElementById('method-details').open = false");
  t.check('every number in the method and the footer is filled in', await t.js("[...document.querySelectorAll('[data-fill]')].every((el) => el.textContent.trim() !== '')"));
  const text = await t.text('#method');
  for (const part of ['How to read the three numbers.', 'Why neutral maps are not proportional.', 'Votes.', 'The Voting Rights Act.',
    'Neutral maps that keep old district cores.', 'The national band.', 'Known limits.', 'Sources.']) {
    t.check(`the method has "${part}"`, text.includes(part));
  }
  // eleven since the point on ALARM's separate runs
  t.check('"Known limits" has eleven points', await t.js("document.querySelectorAll('#method ul > li').length === 11"));
  // ALARM asks to cite its paper in Scientific Data as well as the dataset, and points to its overview page
  t.check('the sources cite the ALARM dataset and its paper in Scientific Data', text.includes('ALARM describes the data in McCartan, Kenny, Simko, Garcia, Wang, Wu, Kuriwaki and Imai')
    && await t.js("['https://doi.org/10.7910/DVN/SLCD3E', 'https://doi.org/10.1038/s41597-022-01808-2', 'https://imai.fas.harvard.edu/research/50states/'].every((href) => !!document.querySelector(`#method a[href=\"${href}\"]`))"));
  t.check('the method says both ends of the competitive range count', text.includes('Competitive districts have a Democratic share from 45% to 55%, both included.'));
  t.check('the Louisiana limit gives the plan share in words or as a plain percent',
    /Of the [\d,]+ neutral maps, (more than 99%|less than 1%|\d+%) give \d+ Democratic seats?\./.test(text));
  t.check('TX-15, TX-28 and TX-34 in the known limits stay on one line', await t.js(`(() => {
    const names = [...document.querySelectorAll('#method li .nowrap')].filter((el) => getComputedStyle(el).whiteSpace === 'nowrap').map((el) => el.textContent);
    return names.join(' ') === 'TX-15 TX-28 TX-34';
  })()`));
  t.check('the footer names the data date, the legal status date and the ALARM version',
    /Data generated .+\. Legal status as of .+\. ALARM dataset version \d+\./.test(await t.text('footer')));
  t.check('the footer links to the Geodienst with its logo',
    await t.js("(() => { const a = document.querySelector('footer a[href=\"https://rug.nl/geo\"]'); const img = a && a.querySelector('img'); return !!a && a.textContent.trim() === 'Geodienst, University of Groningen' && !!img && img.complete && img.naturalWidth > 0; })()"));
  t.check('the footer links to the University of Groningen with its logo',
    await t.js("(() => { const img = document.querySelector('footer a[href=\"https://www.rug.nl/\"] img'); return !!img && img.alt === 'University of Groningen' && img.complete && img.naturalWidth > 0; })()"));
  t.check('on a wide screen the University of Groningen logo stands in the middle of the space between the text and the Geodienst',
    await t.js(`(() => {
      const text = document.querySelector('footer .wrap > div').getBoundingClientRect();
      const logo = document.querySelector('footer .rug img').getBoundingClientRect();
      const geo = document.querySelector('footer .credit').getBoundingClientRect();
      const mid = (text.right + geo.left) / 2;
      return Math.abs((logo.left + logo.right) / 2 - mid) <= 2 && logo.left > text.right && logo.right < geo.left && geo.height < logo.height;
    })()`));
  await t.js("location.hash = '#method'");
  t.check('a link to #method unfolds the method', await t.until("document.getElementById('method-details').open"));
  t.check('the open method shows the national seat axis as a figure', await t.until(
    "document.querySelector('#method-axis svg')?.getAttribute('aria-label')?.startsWith('Democratic seats in the House of 435') === true"));
  for (const width of [375, 2560, 1280]) {
    await t.load('#method', { width, height: 900 });
    await t.until("document.querySelector('#method-axis text.mark-label') !== null");
    const hits = await t.js(crossings('#method'));
    t.check(`${width}px: no marker line in the method figure runs through another label`, hits.length === 0, hits.join('; '));
    if (width !== 2560) {
      const top = await t.js("Math.round(document.getElementById('method').getBoundingClientRect().top) || 0"); // -0 does not come back as a value
      t.check(`${width}px: a fresh load of #method puts the method at the top of the window`, Math.abs(top) <= 2, `top ${top}px`);
    }
  }
  await t.load();
  await t.js("document.querySelector('#method-details summary').focus()");
  await t.key('Enter', 13, '\r');
  t.check('Enter on the summary unfolds the method', await t.until("document.getElementById('method-details').open", 2000));
  // A click on plain text leaves the focus on the body; Escape then acts only while the map or the sheet is in view.
  await t.load('#TX');
  await t.until(`${HEADING} === 'Texas'`);
  await t.js("document.getElementById('method-details').open = true");
  await t.click(await t.center("document.querySelector('#method .mbody p')"));
  const reading = await t.js('scrollY');
  await t.key('Escape', 27);
  await t.sleep(300);
  const after = await t.js(`({ body: document.activeElement === document.body, heading: ${HEADING}, hash: location.hash, y: scrollY })`);
  const kept = after.body && after.heading === 'Texas' && after.hash === '#TX' && after.y === reading;
  t.check('Escape after a click in the method keeps the state and the place on the page', kept,
    kept ? '' : `${JSON.stringify(after)}, scrollY before ${reading}`);
}

// --- Task 6.9: layout, keyboard, dark mode, reduced motion -----------------------------------------
async function layout(t) {
  for (const [width, height, place, rowsPlace, font] of [
    [375, 812, 'below', 'below', '15px'], [1280, 800, 'beside', 'beside', '15px'], [2560, 1440, 'beside', 'beside', '20.52px']]) {
    await t.load('#CA', { width, height });
    await t.until(`${HEADING} === 'California'`);
    // clientWidth leaves out the scrollbar and, unlike innerWidth, does not grow with the overflow on a phone.
    const sideways = await t.js('({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })');
    t.check(`${width}px: no sideways scrolling`, sideways.scrollWidth <= sideways.clientWidth, JSON.stringify(sideways));
    // a rule the browser skipped once left the chapters without room above their heads
    const pads = await t.js("[...document.querySelectorAll('.chapter')].map((c) => parseFloat(getComputedStyle(c).paddingTop))");
    t.check(`${width}px: every chapter has room above its head`, pads.length === 4 && pads.every((p) => p >= 24), pads.join());
    const where = await t.js("(() => { const m = document.querySelector('.mapcol').getBoundingClientRect(); const s = document.getElementById('sheet').getBoundingClientRect(); return s.left >= m.right - 1 ? 'beside' : s.top >= m.bottom - 1 ? 'below' : 'overlap'; })()");
    t.check(`${width}px: the sheet is ${place} the map`, where === place, where);
    const rowsWhere = await t.js("(() => { const r = document.getElementById('scen').getBoundingClientRect(); const w = document.querySelector('.waffle').getBoundingClientRect(); return w.left >= r.right - 1 ? 'beside' : w.top >= r.bottom - 1 ? 'below' : 'overlap'; })()");
    t.check(`${width}px: the waffle is ${rowsPlace} the three rows`, rowsWhere === rowsPlace, rowsWhere);
    const houseRows = await t.js("new Set([...document.querySelectorAll('#waffle rect.seat')].map((r) => r.getAttribute('y'))).size");
    t.check(`${width}px: the House has ${width < 768 ? 14 : 7} rows of squares`, houseRows === (width < 768 ? 14 : 7), String(houseRows));
    t.check(`${width}px: root font size ${font}`, (await t.js('getComputedStyle(document.documentElement).fontSize')) === font);
    // The font size on screen: the CSS size times the scale of the chart's viewBox.
    const sizes = await t.js("[...document.querySelectorAll('svg.chart text')].map((el) => parseFloat(getComputedStyle(el).fontSize) * el.getScreenCTM().a)");
    const small = sizes.filter((size) => !(size >= 10));
    t.check(`${width}px: chart text is at least 10px on screen`, sizes.length > 0 && small.length === 0, sizes.length
      ? `${sizes.length} texts, smallest ${Math.min(...sizes).toFixed(1)}px${small.length ? `, ${small.length} below 10px` : ''}` : 'no chart text found');
    // The paragraphs of the page keep a readable measure on wide screens (Task 6.15): characters per rendered line.
    const lines = await t.js(`(() => {
      const most = [];
      for (const p of document.querySelectorAll('main p')) {
        const perLine = new Map();
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (let i = 0; i < n.length; i += 1) {
            const range = document.createRange(); range.setStart(n, i); range.setEnd(n, i + 1);
            const box = range.getClientRects()[0];
            if (box) perLine.set(Math.round(box.top), (perLine.get(Math.round(box.top)) ?? 0) + 1);
          }
        }
        most.push({ id: p.id || p.className, chars: Math.max(0, ...perLine.values()) });
      }
      return most;
    })()`);
    const long = lines.filter((p) => p.chars > 100);
    t.check(`${width}px: no line on the page is longer than 100 characters`, lines.length > 0 && long.length === 0,
      `longest ${Math.max(...lines.map((p) => p.chars))}${long.length ? `: ${long.map((p) => `${p.id} ${p.chars}`).join(', ')}` : ''}`);
    await t.screenshot(`california-${width}`);
  }

  await t.load();
  await t.js("document.getElementById('view-states').click()"); // the list of states, with its rows
  await t.js('document.activeElement?.blur()');
  const order = [];
  for (let i = 0; i < 32; i += 1) {
    await t.key('Tab', 9);
    order.push(await t.js("(() => { const el = document.activeElement; return el.closest('#map') ? 'map shape' : el.id || el.getAttribute('class') || el.tagName; })()"));
  }
  t.check('the chapters run 01 the national count, 02 State by state, 03 In detail, 04 Methodology', await t.js(
    "[...document.querySelectorAll('main > .chapter')].map((c) => `${c.id} ${c.querySelector('.chead .no').textContent}`).join() === 'outcomes 01,states 02,decide 03,method 04'"));
  const heads = await t.js(`(() => {
    const size = (el) => parseFloat(getComputedStyle(el).fontSize);
    return { titles: [...document.querySelectorAll('.chapter .chead h2')].map(size), lead: size(document.getElementById('outcomes-lead')) };
  })()`);
  t.check('the four chapter titles have one size, at least a quarter larger than the lead sentence of chapter 01',
    heads.titles.length === 4 && heads.titles.every((s) => s === heads.titles[0]) && heads.titles[0] >= 1.25 * heads.lead, JSON.stringify(heads));
  // the national count comes first; State by state follows with its menu, views, zoom, colors and the list
  const wanted = ['pick', 'view-districts', 'view-states', 'view-close', 'zoom-in', 'zoom-out', 'zoom-reset', 'palette-party', 'palette-neutral', 'row'];
  t.check('Tab reaches the State menu, the view buttons, the zoom buttons, the color buttons and the list, in that order',
    wanted.every((id, i) => order.indexOf(id) > (i === 0 ? -1 : order.indexOf(wanted[i - 1]))), order.join(' '));
  t.check('no shape on the map is a tab stop', !order.includes('map shape'));
  t.check('focus reached with Tab is visible', (await t.js('getComputedStyle(document.activeElement).outlineStyle')) === 'solid',
    await t.js('document.activeElement.id || document.activeElement.className || document.activeElement.tagName'));
  await t.load();
  await t.key('Tab', 9);
  t.check('the first Tab lands on the name in the byline, with a visible outline', await t.js(
    "document.activeElement === document.querySelector('.mast .byline a.author') && getComputedStyle(document.activeElement).outlineStyle === 'solid'"));
  await t.key('Tab', 9);
  t.check('the second Tab lands on the Methodology link', await t.js("document.activeElement === document.querySelector('.mast .byline a[href=\"#method\"]')"));
  await t.key('Tab', 9);
  t.check('the third Tab lands on the Videos link', await t.js("document.activeElement === document.querySelector('.mast .byline a[href=\"#videos\"]')"));
  await t.key('Tab', 9);
  t.check('the fourth Tab lands on Share by the key findings', await t.js("document.activeElement === document.getElementById('share-site')"));
  await t.key('Tab', 9);
  // chapter 01 is the national count: the chosen row of its radio group is the one tab stop of the rows
  t.check('the fifth Tab lands on the chosen count of chapter 01', await t.js(
    "document.activeElement === document.querySelector('#scen [aria-checked=true]') && !!document.activeElement.closest('#outcomes')"));
  await t.js("document.querySelector('#scen [aria-checked=true]').focus()");
  const radio = await t.js(`(() => { const el = document.activeElement; return { cls: el.className, checked: el.getAttribute('aria-checked'),
    outline: getComputedStyle(el).outlineStyle, group: el.parentElement.getAttribute('role'), name: el.parentElement.getAttribute('aria-label') }; })()`);
  t.check('the chosen row of the radio group "Way of counting" takes the focus, with a visible outline',
    radio.cls === 'choice' && radio.checked === 'true' && radio.outline === 'solid' && radio.group === 'radiogroup' && radio.name === 'Way of counting',
    JSON.stringify(radio));
  await t.key('Home', 36);
  t.check('Home chooses the first row', await t.js("document.activeElement.querySelector('.lab')?.textContent === 'Vote-proportional' && document.activeElement.getAttribute('aria-checked') === 'true'"));

  // The State menu keeps the focus (Task 6.6); a polite live region reads the heading of the new sheet.
  await t.load();
  await t.js("(() => { const pick = document.getElementById('pick'); pick.focus(); pick.value = 'NV'; pick.dispatchEvent(new Event('change')); })()");
  const heard = (await t.until(`${HEADING} === 'Nevada'`)) && await t.js(
    "(() => { const s = document.getElementById('sheet-status'); return { focus: document.activeElement.id, live: s.getAttribute('aria-live'), text: s.textContent }; })()");
  t.check('a state chosen with the State menu keeps the focus there and is announced',
    heard.focus === 'pick' && heard.live === 'polite' && heard.text === 'Nevada', JSON.stringify(heard));
  await t.js("document.querySelector('#sheet .back').click()");
  // back to the column of the default view, the districts by share
  const cleared = (await t.until(`${HEADING} === 'Districts by Democratic share'`)) && await t.text('#sheet-status');
  t.check('"Back" empties the live region', cleared === '', JSON.stringify(cleared));

  await t.load('', { dark: true });
  await t.js("document.getElementById('view-districts').click()"); // the gradient belongs to the district legend
  t.check('dark mode uses the dark tokens', (await t.js('getComputedStyle(document.body).backgroundColor')) === 'rgb(15, 21, 19)'
    && (await t.js("getComputedStyle(document.querySelector('header.mast')).backgroundColor")) === 'rgb(11, 41, 32)');
  t.check('dark mode paints the map and the waffle with the dark poles',
    (await t.js("document.querySelector('#legend linearGradient stop:last-child').getAttribute('stop-color')")) === 'rgb(57, 135, 229)'
    && (await t.js("document.querySelector('#waffle rect.seat').getAttribute('fill')")) === '#3987e5');
  await t.screenshot('dark-1280');

  for (const reduce of [true, false]) {
    await t.load('', { reduce });
    // Choose Neutral-map median: the square right after the enacted count turns Democratic. Its transition is that of
    // the style sheet (0.35s), or none with reduced motion; the first paint after loading never animates.
    // Seats of 435 start with the two Democratic one-seat states.
    const enacted = Number(await t.js("document.querySelector('#readout b').textContent")) + 2;
    await t.js("document.querySelectorAll('#scen [role=radio]')[1].click()");
    const seat = await t.js(`getComputedStyle(document.querySelectorAll('#waffle rect.seat')[${enacted}]).transitionDuration`);
    t.check(reduce ? 'with reduced motion the waffle has no transition' : 'without reduced motion the waffle fades its squares',
      reduce ? seat === '0s' : seat === '0.35s', seat);
    await t.js("location.hash = '#NV'");
    await t.sleep(150);
    const early = await t.js(ZOOM);
    await t.sleep(900);
    const late = await t.js(ZOOM);
    t.check(reduce ? 'with reduced motion the zoom jumps without animation' : 'without reduced motion the zoom animates',
      reduce ? early === late && late > 1 : early < late, `${early} then ${late}`);
  }
  for (const [width, height, dark] of [[375, 812, false], [1280, 800, false], [2560, 1440, false], [375, 812, true], [1280, 800, true], [2560, 1440, true]]) {
    await t.load('#TX', { width, height, dark });
    await t.until(`${HEADING} === 'Texas'`);
    await t.screenshot(`page-${width}${dark ? '-dark' : ''}`);
  }
}

// --- Task 6.11: redraws since 2024 ---------------------------------------------------------------
async function redraws(t) {
  await t.load('#TX');
  t.check('the national redraw sentence', /^With the 2016 and 2020 votes, the maps of the 2024 election give Democrats \d+ seats and the 2026 maps \d+\. Net change: (0, no difference|[RD]\+\d+, .+)\.$/.test(await t.text('#redraw-text')));
  const changed = await t.js(`${DATA}.then((r) => Object.values(r.states).filter((s) => s.redraw.change !== 0).length)`);
  t.check('one line per state with another seat count', await t.js(`document.querySelectorAll('#redraw-list li').length === ${changed}`));
  await t.until(`${HEADING} === 'Texas'`);
  t.check('the Texas sheet has the redraw line', /(Map unchanged since 2024\.|2024 map: \d+ Democratic seats? with the 2016 and 2020 votes\. 2026 map: \d+ \((\d+ (fewer|more)|the same number)\)\.)/.test(await t.text('#sheet')));
}

// --- Task 6.12: competitive districts ------------------------------------------------------------
async function competitive(t) {
  await t.load('#TX');
  t.check('the national line on competitive districts', /^Competitive districts \(45 to 55%\): \d+ on the enacted maps, \d+ on neutral maps( \(90% of neutral maps: \d+ to \d+\))?\.$/.test(await t.text('#competitive-text')));
  await t.until(`${HEADING} === 'Texas'`);
  t.check('the Texas sheet has the line on competitive districts', /Competitive districts \(45 to 55%\): \d+ on the enacted map, \d+ on neutral maps( \(90% of neutral maps: \d+ to \d+\))?\./.test(await t.text('#sheet')));
}

// --- Task 6.13: who adopted the maps -------------------------------------------------------------
async function control(t) {
  await t.load('#TX');
  t.check('the table by control has four rows and the one by body three', await t.js("document.querySelectorAll('#by-control tr').length === 4 && document.querySelectorAll('#by-body tr').length === 3"));
  t.check('the seven drawing effects in the tables show their direction', await t.js("((cells) => cells.length === 7 && cells.every((td) => /^(0|[RD]\\+\\d+)$/.test(td.textContent)))([...document.querySelectorAll('#control tbody td:last-child')])"));
  // the maps in court: the number of challenged maps and their drawing effect, a row per legal status in the party
  // colors chosen under the map, and the note with the status date
  const legal = `(() => { const s = document.getElementById('legal'), rects = [...s.querySelectorAll('#legal-bars svg rect')];
    return { title: s.querySelector('h3').textContent, figs: [...s.querySelectorAll('#legal-figures b')].map((b) => b.textContent),
      rects: rects.length, fills: [...new Set(rects.map((r) => r.getAttribute('fill')))], note: document.getElementById('legal-note').textContent }; })()`;
  const court = await t.js(legal);
  t.check('Maps in court: the challenged maps and their drawing effect, a row per status in two colors, and the status date',
    court.title === 'Maps in court' && court.figs.length === 2 && /^\d+$/.test(court.figs[0]) && /^(0|[RD]\+\d+)$/.test(court.figs[1])
    && court.rects === 4 && court.fills.length === 2 && /^All \d+ maps are the ones used on November 3, 2026\. On [A-Z][a-z]+ \d+, 2026, a court case against the map was pending in \d+ states?\. A pending case is not a ruling\./.test(court.note),
    JSON.stringify(court));
  await t.js("document.getElementById('palette-neutral').click()");
  const neutral = await t.js(legal);
  await t.js("document.getElementById('palette-party').click()");
  t.check('Maps in court follows the colors chosen under the map', neutral.fills.length === 2 && neutral.fills.every((f) => !court.fills.includes(f)),
    JSON.stringify([court.fills, neutral.fills]));
  t.check('on a wide screen the last card of chapter 03, the Senate, takes the whole row', await t.js(
    "Math.abs(document.getElementById('senate').getBoundingClientRect().width - document.querySelector('.grid3').clientWidth) < 2"));
  await t.until(`${HEADING} === 'Texas'`);
  t.check('the Texas sheet says who adopted the map', /Adopted by: (Legislature|Commission|Court) \((Republican control|Democratic control|bipartisan|nonpartisan)\)\./.test(await t.text('#sheet')));
}

// --- Task 6.14: the Senate -----------------------------------------------------------------------
async function senate(t) {
  await t.load();
  // the seats on the ballot in 2026, following the vote slider
  t.check('the Senate block is about the seats on the ballot in 2026', (await t.text('#senate-title')) === 'Senate in 2026'
    && /^On November 3, \d+ of the 100 seats are on the ballot\. .+ Democrats would need \d+\.\d% of the two-party vote\. Ranked by that vote, the \d+(st|nd|rd|th) seat is in [A-Z][a-z]+/
      .test(await t.text('#senate-text')), await t.text('#senate-text'));
  t.check('the Senate block says it is not an effect of maps', (await t.text('#senate-note')).endsWith('none of this is an effect of maps.'));
  const at = await t.text('#senate-at');
  t.check('at the start the Senate block shows the 2016 and 2020 votes', /^With the 2016 and 2020 votes \(\d+\.\d%\), as on the vote slider in chapter 01, Democrats would win \d+ of the \d+ seats on the ballot and hold \d+ of 100\./.test(at), at);
  const stops = await t.js('document.getElementById("vote").max');
  await t.js(`(() => { const s = document.getElementById('vote'); s.value = '${stops}'; s.dispatchEvent(new Event('input')); })()`);
  const moved = await t.text('#senate-at');
  const figure = await t.text('#senate-figures');
  t.check('the Senate block follows the vote slider', moved.startsWith('At 56.0% of the vote,') && figure.includes('Democratic seats at 56.0%'),
    `${moved} | ${figure}`);
}

// --- Task 7.6: the masthead and chapter 01 -------------------------------------------------------
async function masthead(t) {
  await t.load();
  t.check('the title and the heading read "Some votes are more equal than others"', await t.js(
    "document.title === 'Some votes are more equal than others' && document.querySelector('header.mast h1')?.textContent === 'Some votes are more equal than others'"));
  // Justitia at the top right: decorative, loaded from the site itself, clear of the title, the line under it and the byline
  t.check('the drawing in the masthead is decorative and stays clear of the text', await t.js(`(() => {
    const art = document.querySelector('.mast .mast-art');
    const a = art.getBoundingClientRect();
    // the text itself, not the block around it: a paragraph's box runs the full width
    const apart = (el) => { const r = document.createRange(); r.selectNodeContents(el);
      return [...r.getClientRects()].every((b) => b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom); };
    return art.getAttribute('alt') === '' && art.complete && art.naturalWidth > 0 && new URL(art.src).origin === location.origin
      && ['.mast h1', '.mast .sub', '.mast .byline'].every((s) => apart(document.querySelector(s)));
  })()`));
  // no labels in capitals and no middle dots
  t.check('no text is set in capitals', await t.js(
    "![...document.querySelectorAll('body *')].some((el) => getComputedStyle(el).textTransform === 'uppercase' && el.textContent.trim())"));
  t.check('the byline gives the author, the date and links to the method and the videos, apart by space',
    (await t.js("[...document.querySelectorAll('.mast .byline > *')].map((e) => e.textContent).join('|')")) === 'By Govert Schoof, October 8, 2026|Methodology|Videos'
    && await t.js("!!document.querySelector('.mast .byline a[href=\"#method\"]') && document.querySelector('meta[name=author]').content === 'Govert Schoof'")
    && await t.js(`(() => { const [method, videos] = ['#method', '#videos'].map((h) => document.querySelector('.mast .byline a[href="' + h + '"]'));
      const a = getComputedStyle(method), b = getComputedStyle(videos);
      return method.nextElementSibling === videos && ['color', 'fontSize', 'fontWeight', 'textDecorationLine'].every((p) => a[p] === b[p]); })()`));
  t.check('the name links to About this project, with the bio, the thanks, independence and contact', await t.js(`(() => {
    const about = document.getElementById('about')?.textContent ?? '';
    return document.querySelector('.mast .byline a.author')?.getAttribute('href') === '#about'
      && ['founder of the Geodienst', 'Thanks to scholars Mark Thompson and Jelte Olthof from American Studies in Groningen.',
        'Thanks to Vincent, JW, Elmeri and Bart Campman for reviewing the work and for their feedback.',
        'Thanks to the ALARM team (McCartan and others, Scientific Data, 2022), PlanScore and all other open data projects.',
        'no client and no funding', 'press office'].every((x) => about.includes(x))
      && [...document.querySelectorAll('#about a')].some((a) => a.textContent === 'ALARM team' && a.getAttribute('href') === 'https://alarm-redist.org/')
      && [...document.querySelectorAll('#about a, #method a')].filter((a) => a.textContent === 'PlanScore' && a.getAttribute('href') === 'https://planscore.org/').length === 2
      && [...document.querySelectorAll('#about a')].some((a) => a.textContent === 'American Studies'
        && a.getAttribute('href') === 'https://www.rug.nl/let/onze-faculteit/organisatie/vakgebieden/american-studies/');
  })()`));
  t.check('the bio links the Geodienst, Jantina Tammes School and Geominds.nl', await t.js(
    "[...document.querySelectorAll('#about p:first-of-type a')].map((a) => `${a.textContent} ${a.getAttribute('href')}`).join() === "
    + "'Geodienst https://rug.nl/geo,Jantina Tammes School https://www.rug.nl/jantina-tammes-school/,Geominds.nl https://geominds.nl'"));
  t.check('the contact line links the press office of the University of Groningen', await t.js(
    "[...document.querySelectorAll('#about p')].at(-1).querySelector('a')?.getAttribute('href') === "
    + "'https://www.rug.nl/about-ug/latest-news/press-information/contact-persvoorlichting'"));
  await t.js("document.querySelector('.mast .byline a[href=\"#method\"]').click()");
  t.check('the Methodology link opens the method', await t.until("location.hash === '#method' && document.getElementById('method-details').open"));
  t.check('the meta description is the line under the title',
    await t.js("document.querySelector('meta[name=description]').content === document.querySelector('.mast .sub')?.textContent"));
  // the question under the title and its answer right below the masthead
  t.check('the line under the title asks the question', (await t.text('.mast .sub')).endsWith('Would the outcome change?')
    && await t.js("!document.querySelector('.mast .eyebrow') && !document.querySelector('.metastrip')"));
  const facts = await t.js("[...document.querySelectorAll('#keyfacts li')].map((li) => li.textContent)");
  t.check('three key findings follow the masthead, before State by state, the third on the vote basis', facts.length === 3
    && facts[2] === 'All numbers use the 2016 and 2020 presidential votes together, 51.8% Democratic. They are not a '
      + 'prediction for November 3.'
    // the first without the neutral-map threshold
    && /^With the maps the states drew for 2026, Democrats need \d+\.\d% of the two-party vote for a House majority\.$/.test(facts[0])
    && /^The enacted maps move \d+ seats? toward Republicans and \d+ toward Democrats\. Net effect: (0|[RD]\+\d+)\.$/.test(facts[1])
    && await t.js("document.querySelector('header.mast').nextElementSibling?.classList.contains('keyfacts') === true"), facts.join(' | '));
}

async function outcomes(t) {
  await t.load();
  // The numbers the rows should show, formatted with the site's own format.ts (the built page bundles it, so it is
  // imported here in Node) from the results.json the page loads.
  const want = ((r) => {
    const n = r.national;
    // every count is shown in the House of 435: the districts plus the 2 Democratic single seats (Delaware, Vermont)
    const plus = (v) => f.seats(v + 2);
    return { values: [n.proportional, n.neutral.median, n.enacted].map(plus), lo: n.neutral.p5, hi: n.neutral.p95,
      total: n.seats, enacted: n.enacted, neutralSeats: n.neutral.median, steps: [f.effect(n.effects.geographic), f.effect(n.effects.drawing)],
      finding: 'In this comparison, with the 2016 and 2020 votes (' + f.sliderShare(n.majority.base_share) + ' for Democrats), the enacted maps shift '
        + f.effectWords(n.effects.drawing) + '. They give Democrats ' + plus(n.enacted) + ' seats, where the neutral-map median gives '
        + plus(n.neutral.median) + '.' };
  })(await t.js(DATA));
  const rows = await t.js(`[...document.querySelectorAll('#scen [role=radio]')].map((b) => ({ label: b.querySelector('.lab').textContent,
    value: b.querySelector('.big .n').textContent, checked: b.getAttribute('aria-checked'), tab: b.tabIndex }))`);
  t.check('three rows labeled Vote-proportional, Neutral-map median and Enacted maps, with the numbers of results.json plus Delaware and Vermont',
    rows.map((r) => r.label).join() === 'Vote-proportional,Neutral-map median,Enacted maps' && rows.map((r) => r.value).join() === want.values.join(),
    JSON.stringify(rows));
  t.check('a block in the Democratic color under each number of the three rows, and words for screen readers', await t.js(`(() => {
    const legend = getComputedStyle(document.querySelector('#readout .who .sw')).backgroundColor;
    const blocks = [...document.querySelectorAll('#scen .big .sw.d')];
    return blocks.length === 3 && blocks.every((b) => getComputedStyle(b).backgroundColor === legend)
      && [...document.querySelectorAll('#scen .big .visually-hidden')].every((s) => s.textContent.trim() === 'Democratic seats');
  })()`));
  // the large sentence, and the 99% sentence under the House
  t.check('the chapter opens with the seats on the 2026 maps and the neutral median', /^Democrats would win \d+ seats on the 2026 maps, (\d+ short of a majority|a majority)\. The result on a neutral map is \d+\.$/
    .test(await t.text('#outcomes-lead')), await t.text('#outcomes-lead'));
  t.check('under the House the share of neutral maps that give Democrats more seats', /^(More than 99%|Less than 1%|\d+%) of the simulated neutral maps give Democrats more seats than the 2026 maps do\.$/
    .test(await t.text('#outcomes-beats')), await t.text('#outcomes-beats'));
  t.check('Enacted maps is chosen at the start and is the only tab stop', rows.map((r) => `${r.checked}/${r.tab}`).join() === 'false/-1,false/-1,true/0');
  t.check('the two differences stand between the rows, without labels',
    await t.js(`[...document.querySelectorAll('#scen .step')].map((s) => s.textContent).join() === ${JSON.stringify(want.steps.join())}`));
  const blue = "getComputedStyle(document.documentElement).getPropertyValue('--party-d').trim()";
  const democratic = `[...document.querySelectorAll('#waffle rect.seat')].filter((r) => r.getAttribute('fill') === ${blue}).length`;
  // the House of 435: these districts plus the six one-seat states, two of them Democratic
  t.check(`the waffle has 435 squares, ${want.enacted} + 2 of them Democratic`,
    await t.js(`document.querySelectorAll('#waffle rect.seat').length === 435 && ${democratic} === ${want.enacted} + 2`));
  t.check('the line above the waffle counts both parties of the House of 435 and is a polite live region', await t.js(`(() => {
    const r = document.getElementById('readout');
    return r.getAttribute('aria-live') === 'polite' && r.textContent === 'Democrats${want.enacted + 2}Republicans${435 - want.enacted - 2}';
  })()`));
  // seat 218 is the top square of the middle column; the framed one-seat states show their names on hover
  t.check('the square at the top of the middle column is seat 218, Republican with the enacted maps', await t.js(`(() => {
    const seats = [...document.querySelectorAll('#waffle rect.seat')];
    const mid = seats[217];
    const ys = seats.map((r) => Number(r.getAttribute('y')));
    const xs = seats.map((r) => Number(r.getAttribute('x')));
    return mid.classList.contains('middle') && Number(mid.getAttribute('y')) === Math.min(...ys)
      && Number(mid.getAttribute('x')) === (Math.min(...xs) + Math.max(...xs)) / 2 && mid.getAttribute('fill') !== ${blue};
  })()`));
  const frameAt = (i) => `document.querySelectorAll('#waffle .frames rect')[${i}]`;
  t.check('two frames, around 2 Democratic and 4 Republican one-seat states', await t.js(`(() => {
    const fr = document.querySelectorAll('#waffle .frames rect');
    const inside = (f) => [...document.querySelectorAll('#waffle rect.seat')].filter((r) => {
      const a = f.getBBox(), b = r.getBBox();
      return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
    });
    return fr.length === 2 && inside(fr[0]).length === 2 && inside(fr[1]).length === 4
      && inside(fr[0]).every((r) => r.getAttribute('fill') === ${blue}) && inside(fr[1]).every((r) => r.getAttribute('fill') !== ${blue});
  })()`));
  await t.mouse('mouseMoved', await t.center(frameAt(0)));
  t.check('pointing at the Democratic frame names Delaware and Vermont', await t.until(
    "!document.getElementById('waffle-tip').hidden && document.getElementById('waffle-tip').textContent.startsWith('Delaware and Vermont: one seat each')"));
  await t.mouse('mouseMoved', { x: 2, y: 2 });
  t.check('the tooltip goes when the pointer leaves', await t.until("document.getElementById('waffle-tip').hidden"));
  t.check('the band is hidden while Enacted maps is chosen',
    await t.js("document.querySelector('#waffle .band').getAttribute('display') === 'none' && document.getElementById('key-band').hidden"));
  await t.js("document.querySelector('#scen [aria-checked=true]').focus()");
  await t.key('ArrowUp', 38);
  const neutral = await t.js(`(() => { const on = document.activeElement; return { label: on.querySelector('.lab')?.textContent,
    checked: on.getAttribute('aria-checked'), band: document.querySelectorAll('#waffle .band rect').length,
    shown: document.querySelector('#waffle .band').getAttribute('display'), key: !document.getElementById('key-band').hidden,
    title: document.getElementById('waffle-label').textContent }; })()`);
  t.check('Arrow up chooses Neutral-map median and the focus moves with it', neutral.label === 'Neutral-map median' && neutral.checked === 'true', JSON.stringify(neutral));
  t.check('the seats that changed from Enacted maps to Neutral-map median carry a dot, and the key counts them', await t.js(`(() => {
    const dots = document.querySelectorAll('#waffle .changed polygon').length;
    return dots === ${want.neutralSeats} - ${want.enacted} && !document.getElementById('key-changed').hidden
      && document.getElementById('key-changed-text').textContent === 'Star: the ' + dots + ' seats that changed with this choice';
  })()`));
  t.check(`with Neutral-map median the seats ${want.lo} to ${want.hi} are outlined and the key says so`,
    neutral.band === want.hi - want.lo + 1 && neutral.shown !== 'none' && neutral.key, JSON.stringify(neutral));
  t.check('the title of the waffle names the chosen row in numbers and the majority', /^Neutral-map median: \d+ Democratic and \d+ Republican seats of 435: a (Democratic|Republican) majority\.$/.test(neutral.title), neutral.title);
  await t.key('End', 35);
  t.check('End chooses the last row', (await t.js("document.activeElement.querySelector('.lab')?.textContent")) === 'Enacted maps');
  await t.key('ArrowDown', 40);
  t.check('Arrow down on the last row goes round to the first', (await t.js("document.activeElement.querySelector('.lab')?.textContent")) === 'Vote-proportional');
  await t.js("document.querySelectorAll('#scen [role=radio]')[2].click()");
  t.check('a click chooses a row and repaints the waffle', await t.until(`${democratic} === ${want.enacted} + 2`, 2000));
  t.check('under the rows the explanation of the two comparisons', (await t.text('#effects-note')) === 'The first comparison shows what '
    + 'changes when votes are counted in districts rather than translated into proportional seats. The second shows what changes '
    + 'when we use the 2026 maps instead of neutral maps.');
  t.check('the spread sentence places the enacted maps against the band', /^90% of neutral outcomes give Democrats \d+( to \d+)? seats\. The enacted maps give \d+, (below|within|above) that range\.$/
    .test(await t.js("document.querySelector('#spread p').textContent")));

  // The vote slider (plan 2026-10-08-vote-slider): it starts at the base share and moves every count. A grid point
  // that reads like the base share (51.8% next to 0.51797) is left out, so no two stops carry the same label.
  const swing = await t.js(`${DATA}.then((r) => ({ points: r.national.swing.points, needed: r.national.majority.seats_needed }))`);
  const baseShare = swing.points.find((p) => p.base).share;
  const stops = swing.points.filter((p) => p.base || Math.abs(p.share - baseShare) >= 0.0005);
  const baseAt = stops.findIndex((p) => p.base);
  const setSlider = (index) => t.js(`(() => { const s = document.getElementById('vote'); s.value = '${index}'; s.dispatchEvent(new Event('input')); })()`);
  const slider = await t.js(`(() => { const s = document.getElementById('vote'); return { value: Number(s.value), max: Number(s.max),
    label: document.getElementById('vote-label').textContent, out: document.getElementById('vote-out').textContent,
    text: s.getAttribute('aria-valuetext'), back: document.getElementById('vote-back').hidden,
    ticks: [...document.querySelectorAll('#vote-ticks .tk')].map((x) => ({ text: x.textContent, base: x.classList.contains('base'),
      at: Number(x.style.getPropertyValue('--at')) })), base: document.getElementById('vote-base').textContent,
    caption: document.getElementById('vote-how').textContent, fill: Number(s.style.getPropertyValue('--at')),
    marks: document.querySelectorAll('.vote .mk').length }; })()`);
  t.check('the vote slider starts at the 2016 and 2020 votes, one step per point',
    slider.value === baseAt && slider.max === stops.length - 1 && slider.back
    && slider.label === 'Democratic share of the national two-party vote' && /^\d+\.\d%$/.test(slider.out) && slider.base === '2016 and 2020 votes'
    && slider.text.endsWith('of the two-party vote for Democrats, the 2016 and 2020 result'), JSON.stringify(slider));
  // a plain scale: every whole percent from 47% to 56% under the stop with that share
  const scale = slider.ticks;
  t.check('under the slider a plain scale from 47% to 56%, each number under its stop',
    scale.map((x) => x.text).join() === Array.from({ length: 10 }, (_, k) => `${47 + k}%`).join()
    && scale.every((x) => Math.abs(stops[Math.round(x.at * (stops.length - 1))].share * 100 - Number.parseInt(x.text, 10)) < 1e-6),
    JSON.stringify(slider.ticks));
  t.check('no markers on the slider, the track filled up to the thumb, and only the note that it is not a forecast',
    slider.marks === 0 && Math.abs(slider.fill - baseAt / (stops.length - 1)) < 1e-9
    && slider.caption === 'The slider moves every district by the same amount; it is not a forecast.',
    JSON.stringify({ marks: slider.marks, fill: slider.fill, caption: slider.caption }));
  // at the first stop where the enacted maps (the row shown) reach 218 of 435 the middle square turns; one stop lower not
  const enactedStop = stops.findIndex((p) => p.enacted >= swing.needed);
  const middleBlue = "document.querySelector('#waffle rect.middle').getAttribute('fill') === getComputedStyle(document.documentElement).getPropertyValue('--party-d').trim()";
  await setSlider(enactedStop);
  const atStop = await t.js(`({ blue: ${middleBlue}, democratic: ${democratic} })`);
  await setSlider(enactedStop - 1);
  const below = await t.js(`({ blue: ${middleBlue}, democratic: ${democratic} })`);
  t.check('at the first stop where the enacted maps reach seat 218 the middle square turns blue, one stop lower not',
    enactedStop > 0 && atStop.blue && atStop.democratic >= swing.needed + 2 && !below.blue && below.democratic < swing.needed + 2,
    JSON.stringify({ enactedStop, atStop, below }));
  // the drawing effect at every stop of the slider: a bar per stop, up for Democrats and down for Republicans
  const bars = await t.js(`[...document.querySelectorAll('#byvote-chart rect.col')].map((r) => ({ d: r.classList.contains('d'),
    h: Number(r.getAttribute('height')), x: Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2 }))`);
  const wantBars = stops.map((p) => p.enacted - p.neutral.median);
  t.check('one bar per stop of the slider, each pointing the way of its drawing effect', bars.length === stops.length
    && bars.every((b, i) => (wantBars[i] > 0) === b.d && (wantBars[i] === 0) === (b.h === 0)), `${bars.length} bars for ${stops.length} stops`);
  t.check('the examples under the chart name 2024 and the 2016 and 2020 votes', await t.js(
    "/\\(2024\\): D\\+\\d+/.test(document.getElementById('byvote-examples').textContent) && /\\(2016 \\+ 2020\\): R\\+\\d+/.test(document.getElementById('byvote-examples').textContent)"));
  const half = stops.findIndex((p) => Math.abs(p.share - 0.5) < 1e-9);
  await setSlider(half);
  const moved = await t.js(`(() => ({ rows: [...document.querySelectorAll('#scen .big .n')].map((b) => Number(b.textContent)),
    out: document.getElementById('vote-out').textContent, back: document.getElementById('vote-back').hidden,
    democratic: ${democratic} }))()`);
  t.check('the line in the chart of drawing effects follows the slider', await t.js(
    "Math.abs(Number(document.querySelector('#byvote-chart line.here').getAttribute('x1')) - " + bars[half].x + ") < 0.5"));
  const p = stops[half];
  t.check('at 50.0% the rows and the waffle follow the slider',
    moved.rows.join() === [p.proportional, p.neutral.median, p.enacted].map((v) => v + 2).join() && moved.out === '50.0%' && !moved.back
    && moved.democratic === p.enacted + 2,
    JSON.stringify(moved));
  await t.js("document.getElementById('vote-back').click()");
  t.check('"Back to the 2016 and 2020 votes" returns to the base point and focuses the slider', await t.js(
    `Number(document.getElementById('vote').value) === ${baseAt} && document.activeElement.id === 'vote' && document.getElementById('vote-back').hidden`
    + ` && ${democratic} === ${stops[baseAt].enacted} + 2`));
  await t.key('ArrowLeft', 37);
  t.check('the arrow keys move the slider one point', await t.until(`Number(document.getElementById('vote').value) === ${baseAt - 1}`));
  // a change of row dots the seats that changed; a move of the slider clears the dots
  await t.js("document.querySelectorAll('#scen [role=radio]')[1].click()");
  const dotted = await t.js("document.querySelectorAll('#waffle .changed polygon').length");
  await setSlider(baseAt);
  t.check('a slider move clears the dots of the last change of row', dotted > 0 && await t.js(
    "document.querySelectorAll('#waffle .changed polygon').length === 0 && document.getElementById('key-changed').hidden"), `${dotted} dots before`);
  // a tap shows the tooltip of a frame and keeps it; a tap elsewhere closes it
  await t.js(`(() => { const f = document.querySelectorAll('#waffle .frames rect')[1];
    for (const type of ['pointerenter', 'pointerleave']) f.dispatchEvent(new PointerEvent(type, { pointerType: 'touch' }));
    f.dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`);
  const tapped = await t.js("({ hidden: document.getElementById('waffle-tip').hidden, text: document.getElementById('waffle-tip').textContent })");
  await t.js("document.getElementById('outcomes-lead').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))");
  t.check('a tap on a frame shows its tooltip, a tap elsewhere closes it',
    !tapped.hidden && tapped.text.startsWith('Alaska, North Dakota, South Dakota and Wyoming') && await t.js("document.getElementById('waffle-tip').hidden"),
    JSON.stringify(tapped));

  for (const [width, dark] of [[375, false], [1280, false], [1280, true]]) {
    await t.load('', { width, height: 900, dark });
    await t.screenshot(`outcomes-${width}${dark ? '-dark' : ''}`);
  }
}

// --- The explainer of chapter 01 ------------------------
async function tour(t) {
  // ?notour, the default of t.load, leaves the explainer out
  await t.load();
  t.check('with ?notour the explainer is left out', await t.js("document.getElementById('tour').hidden"));
  // 400 ms a step for the check; it plays once the rows and the waffle are in view
  await t.load('', { query: 'tourms=400' });
  await t.js("document.querySelector('#outcomes .outcomes').scrollIntoView({ block: 'center' })");
  const state = `(() => ({ count: document.getElementById('tour-count').textContent, play: document.getElementById('tour-play').textContent,
    text: document.getElementById('tour-text').textContent, row: document.querySelector('#scen [aria-checked=true] .lab').textContent,
    out: document.getElementById('vote-out').textContent, base: document.getElementById('vote-base').textContent,
    skip: document.getElementById('tour-skip').hidden, next: document.getElementById('tour-next').hidden,
    done: document.getElementById('tour').classList.contains('done') }))()`;
  // the step number of a state: '3 / 5' gives 3
  const at = (s) => Number(s.count.split(' / ')[0]);
  t.check('the explainer starts by itself in view, with Pause, Next and Skip', await t.until(
    "document.getElementById('tour-count').textContent === '1 / 5' && document.getElementById('tour-play').textContent === 'Pause' && !document.getElementById('tour-next').hidden && !document.getElementById('tour-skip').hidden", 4000));
  const first = await t.js(state);
  t.check('the explainer starts on the vote-proportional row', first.row === 'Vote-proportional', JSON.stringify(first));
  await t.until("document.getElementById('tour-count').textContent === '3 / 5'", 4000);
  const third = await t.js(state);
  t.check('step 3 explains the neutral maps and chooses their row', third.row === 'Neutral-map median' && third.text.startsWith('Neutral-map median: a computer drew'), JSON.stringify(third));
  await t.until("document.getElementById('tour-count').textContent === '5 / 5'", 4000);
  const fifth = await t.js(state);
  t.check('step 5 moves the slider to the 2024 share and says so', fifth.out === '49.2%' && fifth.text.includes('the Democratic share of the 2024 presidential vote'), JSON.stringify(fifth));
  await t.until("document.getElementById('tour-play').textContent === 'Replay'", 4000);
  const end = await t.js(state);
  t.check('at the end the chapter returns to the enacted maps at the 2016 and 2020 votes, with Replay',
    end.row === 'Enacted maps' && end.base === '2016 and 2020 votes' && end.count === '' && end.skip && end.next && end.done
    && end.text === 'That is the comparison. Choose a row or move the slider to explore it yourself.', JSON.stringify(end));
  // Replay, Pause holds the step, Skip ends it
  await t.js("document.getElementById('tour-play').click()");
  await t.until("document.getElementById('tour-count').textContent === '2 / 5'", 4000);
  await t.js("document.getElementById('tour-play').click()");
  const paused = await t.js(state);
  await t.sleep(900);
  const later = await t.js(state);
  t.check('Pause holds the step', paused.play === 'Play' && later.count === paused.count, JSON.stringify({ paused, later }));
  await t.js("document.getElementById('tour-next').click()");
  const ahead = await t.js(state);
  await t.sleep(900);
  const held = await t.js(state);
  t.check('Next while paused shows the next step and stays paused', at(ahead) === at(paused) + 1 && held.count === ahead.count
    && held.play === 'Play', JSON.stringify({ ahead, held }));
  await t.js("document.getElementById('tour-skip').click()");
  const skipped = await t.js(state);
  t.check('Skip ends the explainer at the enacted maps', skipped.play === 'Replay' && skipped.row === 'Enacted maps', JSON.stringify(skipped));
  // a reader who chooses a row takes over: the explainer stops and the choice stays
  await t.js("document.getElementById('tour-play').click()");
  await t.until("document.getElementById('tour-count').textContent === '1 / 5'", 4000);
  const before = await t.js(state);
  await t.js("document.getElementById('tour-next').click()");
  const moved = await t.js(state);
  t.check('Next while playing goes one step ahead and plays on', at(moved) === at(before) + 1 && moved.play === 'Pause', JSON.stringify({ before, moved }));
  await t.js("document.querySelectorAll('#scen [role=radio]')[1].click()");
  await t.sleep(900);
  const taken = await t.js(state);
  t.check('a click on a row stops the explainer and keeps the row', taken.play === 'Replay' && taken.row === 'Neutral-map median', JSON.stringify(taken));
  // with reduced motion it waits for Play
  await t.load('', { query: 'tourms=400', reduce: true });
  await t.js("document.querySelector('#outcomes .outcomes').scrollIntoView({ block: 'center' })");
  await t.sleep(1200);
  const still = await t.js(state);
  t.check('with reduced motion the explainer waits for Play', still.count === '' && still.play === 'Play'
    && still.text === 'A short tour of this chapter in five steps.', JSON.stringify(still));
}

// --- The map in full screen -------------------------------------------------------------------
async function fullscreen(t) {
  await t.load('', { width: 1280, height: 800 });
  const state = `(() => { const col = document.querySelector('.atlas'); const box = document.getElementById('mapbox').getBoundingClientRect();
    return { full: document.fullscreenElement === col || col.classList.contains('is-full'), pressed: document.getElementById('map-full').getAttribute('aria-pressed'),
      label: document.getElementById('map-full').getAttribute('aria-label'), height: Math.round(box.height), window: innerHeight,
      legend: document.getElementById('legend').getBoundingClientRect().bottom <= innerHeight + 1,
      sheet: document.getElementById('sheet').getBoundingClientRect().top < innerHeight && document.getElementById('sheet').getBoundingClientRect().left > box.right - 1 }; })()`;
  const before = await t.js(state);
  t.check('the map has a full-screen button, not pressed at the start', !before.full && before.pressed === 'false' && before.label === 'Full screen', JSON.stringify(before));
  await t.js("document.getElementById('map-full').click()");
  await t.sleep(300);
  const on = await t.js(state);
  t.check('the button puts the map, its legend and the sheet beside it over the whole window', on.full && on.pressed === 'true'
    && on.label === 'Exit full screen' && on.height > 0.6 * on.window && on.legend && on.sheet, JSON.stringify(on));
  await t.screenshot('map-full-1280');
  // map large with title, legend and Share inside, Share beside the zoom buttons, the record on the right in its own
  // order ending with map, status and adoption, a strip under both with the folds under the record; no district line
  // and colors in full screen
  await t.load('#TX', { width: 2560, height: 1440 });
  await t.until(`${HEADING} === 'Texas'`);
  await t.js("document.getElementById('map-full').click()");
  await t.sleep(400);
  const wide = await t.js(`(() => { const r = (el) => (typeof el === 'string' ? document.getElementById(el) : el).getBoundingClientRect();
    const map = r('mapbox'), col = r(document.querySelector('.atlas > .mapcol')), side = r('sheet'), more = r('sheet-more');
    const title = r('map-title'), legend = r('legend'), share = r('map-share'), folds = r(document.querySelector('#sheet-more .fs-folds'));
    const zoom = r(document.querySelector('.zoombar'));
    const foot = document.querySelector('#sheet .foot');
    return { sideRight: side.left >= map.right - 1,
      stripUnderBoth: more.top >= Math.max(col.bottom, side.bottom) - 1 && more.left <= map.left + 1 && more.right >= side.right - 1,
      foldsUnderRecord: folds.left >= side.left - 1 && folds.right <= side.right + 1,
      sorted: !!document.querySelector('#sheet-more .fs-chart svg') && !document.querySelector('#sheet .stack.sorted'),
      folds: [...document.querySelectorAll('#sheet-more details.fold summary')].map((s) => s.textContent).join() === 'Other measures,Notes',
      foot: !!foot && foot.textContent.includes(' \u00b7 Challenged in court \u00b7 Legal status as of') && foot.textContent.includes('Adopted by'),
      kept: !!document.querySelector('#sheet .headline') && !!document.querySelector('#sheet .k'),
      noHints: !document.getElementById('tapline').checkVisibility() && !document.querySelector('.colors').checkVisibility(),
      shareInMap: document.getElementById('map-share').checkVisibility() && share.top >= map.top && share.bottom <= zoom.top + 64
        && share.right <= zoom.left && share.left >= map.left,
      sideFits: document.getElementById('sheet').scrollHeight <= document.getElementById('sheet').clientHeight + 2,
      stripFits: document.getElementById('sheet-more').scrollHeight <= document.getElementById('sheet-more').clientHeight + 2,
      inMap: title.top >= map.top && title.left >= map.left && legend.bottom <= map.bottom + 1 && legend.top >= map.top }; })()`);
  t.check('2560 x 1440: full screen: the whole Texas record on the right, a strip under both with the folds under the record, title, legend and Share in the map',
    Object.values(wide).every(Boolean), JSON.stringify(wide));
  await t.screenshot('map-full-2560-texas', { viewport: true });
  // a record too long for the room above the strip, such as Arizona at 1920 x 1080,
  // takes the whole height, and the strip stays under the map
  await t.load('#AZ', { width: 1920, height: 1080 });
  await t.until(`${HEADING} === 'Arizona'`);
  await t.js("document.getElementById('map-full').click()");
  await t.sleep(1500); // the zoom to the state has ended
  const long = await t.js(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
    const map = r('mapbox'), side = r('sheet'), more = r('sheet-more'), s = document.getElementById('sheet');
    return { long: document.querySelector('.atlas').classList.contains('long'), fits: s.scrollHeight <= s.clientHeight + 2,
      sideDown: side.bottom >= more.bottom - 1, stripUnderMap: more.top >= map.bottom - 1 && more.right <= side.left + 1 }; })()`);
  t.check('1920 x 1080: the longer Arizona record takes the whole height and the strip stays under the map',
    Object.values(long).every(Boolean), JSON.stringify(long));
  await t.screenshot('map-full-1920-arizona', { viewport: true });
  // in full screen there is no page to scroll, so a plain scroll zooms the map, without the hint
  const zoomed = await t.js(ZOOM);
  await t.mouse('mouseWheel', await t.center("document.getElementById('map')"), { deltaX: 0, deltaY: -300 });
  t.check('in full screen a plain scroll zooms the map, without the Ctrl hint',
    await t.until(`${ZOOM} > ${zoomed} * 1.2`, 3000) && await t.js("document.getElementById('gesture').hidden"));
  // the list of close districts runs down to the foot of the record
  await t.load('', { width: 1920, height: 1080 });
  await t.js("document.getElementById('view-close').click(); document.getElementById('map-full').click()");
  await t.sleep(600);
  const list = await t.js(`(() => { const s = document.getElementById('sheet'), l = s.querySelector('.dlist').getBoundingClientRect();
    return { below: Math.round(s.getBoundingClientRect().bottom - l.bottom), rows: Math.round(l.height), fits: s.scrollHeight <= s.clientHeight + 2 }; })()`);
  t.check('1920 x 1080: in full screen the list of close districts runs down to the foot of the record',
    list.below < 90 && list.rows > 500 && list.fits, JSON.stringify(list));
  await t.js("document.getElementById('map-full').click()");
  // under 900px the full-screen map and the record lie one under the other: a plain scroll is for scrolling, and the
  // tap line keeps its line, so a tap does not shrink the map
  await t.load('', { width: 820, height: 600 });
  await t.js("document.getElementById('map-full').click()");
  await t.sleep(400);
  await t.mouse('mouseWheel', await t.center("document.getElementById('map')"), { deltaX: 0, deltaY: -300 });
  t.check('820 x 600: in full screen a plain scroll does not zoom the map and shows the hint',
    await t.until("!document.getElementById('gesture').hidden", 2000) && await t.js(`${ZOOM} === 1`));
  t.check('820 x 600: in full screen the empty tap line keeps its line', await t.js(
    "document.getElementById('tapline').textContent === '' && document.getElementById('tapline').getBoundingClientRect().height > 15"));
  await t.js("document.getElementById('map-full').click()");
  // every state record fits whole in full screen, at 1920 x 1080 and at 2560 x 1440; on the larger screen the strip
  // runs on under every record
  for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
    await t.load('#TX', { width, height });
    await t.until(`${HEADING} === 'Texas'`);
    await t.js("document.getElementById('map-full').click()");
    await t.sleep(400);
    const over = [];
    const under = [];
    for (const postal of await t.js("[...document.querySelectorAll('#pick option')].map((o) => o.value).filter(Boolean)")) {
      await t.js(`location.hash = '#${postal}'`);
      await t.sleep(60);
      const [scroll, client, isLong] = await t.js("(() => { const s = document.getElementById('sheet'); return [s.scrollHeight, s.clientHeight, document.querySelector('.atlas').classList.contains('long')]; })()");
      if (scroll > client + 2) over.push(`${postal} ${scroll - client}px`);
      if (isLong) under.push(postal);
    }
    t.check(`${width} x ${height}: every state record fits whole in full screen${width === 2560 ? ', with the strip under each record' : ''}`,
      over.length === 0 && (width !== 2560 || under.length === 0), `${over.join(', ')}; strip under the map only: ${under.join(' ') || 'none'}`);
  }
  await t.js("location.hash = '#TX'");
  await t.until(`${HEADING} === 'Texas'`);
  await t.key('Escape', 27);
  t.check('back from full screen the record is whole again, with the tap line, the colors and Share under the map', await t.js(
    "!!document.querySelector('#sheet .stack.sorted') && document.getElementById('sheet-more').hidden && document.getElementById('tapline').checkVisibility() && document.querySelector('.colors').checkVisibility() && document.querySelector('.mapfoot .mapbar').contains(document.getElementById('map-share')) && document.getElementById('map-share').checkVisibility()"));
  await t.load('', { width: 1280, height: 800 });
  await t.js("document.getElementById('map-full').click()");
  await t.sleep(300);
  await t.key('Escape', 27);
  await t.sleep(300);
  const off = await t.js(state);
  t.check('Escape brings the map back into the page', !off.full && off.pressed === 'false' && off.height < on.height, JSON.stringify(off));
}

// --- Share: by the key findings, under the map and above the House in chapter 01 ------------
async function sharing(t) {
  await t.load('', { width: 1280, height: 800 });
  // a catcher in place of the device's share sheet, so the checks see the link each button gives
  await t.js("Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.shared = data.url; } })");
  const place = await t.js(`(() => { const r = (el) => (typeof el === 'string' ? document.getElementById(el) : el).getBoundingClientRect();
    const band = r(document.querySelector('.keyfacts')), list = r('keyfacts'), site = r('share-site');
    const map = document.getElementById('map-share'), out = document.getElementById('outcomes-share');
    return { siteRight: site.left >= list.right - 1 && site.top >= band.top && site.bottom <= band.bottom && !document.querySelector('.mast button'),
      mapUnder: document.querySelector('.mapfoot').contains(map) && r(map).top >= r('mapbox').bottom && r(map).right > r('palette-neutral').right
        && map.checkVisibility() && !document.querySelector('.zoombar #map-share'),
      outcomesRight: document.querySelector('#outcomes .whead').contains(out) && r(out).left >= r('readout').right && r(out).bottom <= r('waffle').top
        && r(out).right <= r('waffle').right + 1,
      dots: document.querySelectorAll('#icon-share circle').length === 3
        && [...document.querySelectorAll('#share-site, #map-share, #outcomes-share')].map((b) => Boolean(b.querySelector('svg use[href="#icon-share"]')) && b.textContent === 'Share').join() === 'true,true,true' };
  })()`);
  t.check('Share sits at the right of the key findings, under the map and at the right above the House, each with three dots',
    Object.values(place).every(Boolean), JSON.stringify(place));
  const link = async (id) => {
    await t.js(`window.shared = ''; document.getElementById('${id}').click()`);
    await t.sleep(100);
    return t.js('window.shared');
  };
  const page = 'https://somevotes.org/'; // the site's address, also when the page runs elsewhere
  t.check('Share by the key findings gives the address of the site', (await link('share-site')) === page);
  await t.js("location.hash = '#TX'");
  await t.until(`${HEADING} === 'Texas'`);
  t.check('Share under the map gives the map with its state', (await link('map-share')) === `${page}#TX`);
  // chapter 01 on the neutral maps at 49.2% of the vote
  await t.js("document.querySelectorAll('#scen [role=radio]')[1].click()");
  await t.js(`(() => { const s = document.getElementById('vote');
    s.value = String([...Array(Number(s.max) + 1).keys()].find((i) => { s.value = String(i); s.dispatchEvent(new Event('input')); return document.getElementById('vote-out').textContent === '49.2%'; }));
  })()`);
  // Share above the House opens a panel with the image at this vote share, the link, the image file and the text
  await t.js("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copied = text; } } }); "
    + "window.saved = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.saved.push(this.download); }");
  await t.js("window.shared = ''; document.getElementById('outcomes-share').click()");
  await t.sleep(200);
  const panel = await t.js(`(() => { const box = document.getElementById('outcomes-sharebox'), canvas = box.querySelector('canvas');
    return { open: !box.hidden && document.getElementById('outcomes-share').getAttribute('aria-expanded') === 'true', shared: window.shared,
      image: canvas.width === 2400 && canvas.height > 600 && canvas.getBoundingClientRect().width > 200,
      buttons: [...box.querySelectorAll('button')].filter((b) => !b.hidden).map((b) => b.textContent).filter((x) => x !== 'Share image').join() }; })()`);
  t.check('Share above the House opens a panel with the image and Copy link, Download image and Copy text, and shares nothing yet',
    panel.open && panel.shared === '' && panel.image && panel.buttons === 'Copy link,Download image,Copy text', JSON.stringify(panel));
  const press = async (action) => {
    await t.js(`window.copied = ''; document.querySelector('#outcomes-sharebox [data-action="${action}"]').click()`);
    await t.sleep(150);
    return t.js("({ copied: window.copied, note: document.querySelector('.share-note:last-of-type')?.textContent, saved: window.saved.join() })");
  };
  const chosen = `${page}?count=neutral&vote=49.2#outcomes`;
  const linked = await press('link');
  t.check('Copy link gives the chosen row and vote share, with a short note', linked.copied === chosen && linked.note === 'Link copied', JSON.stringify(linked));
  const saved = await press('download');
  t.check('Download image saves the image at that vote share', saved.saved === 'somevotes-national-49-2.png', JSON.stringify(saved));
  const texted = await press('text');
  t.check('Copy text gives the caption of the image with the link', texted.copied.startsWith('With Democrats at 49.2% of the two-party vote, ')
    && texted.copied.endsWith(` ${chosen}`) && texted.note === 'Text copied', JSON.stringify(texted));
  await t.js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
  t.check('Escape closes the panel', await t.js("document.getElementById('outcomes-sharebox').hidden && document.getElementById('outcomes-share').getAttribute('aria-expanded') === 'false'"));
  // on a phone the panel stays within the screen
  await t.load('', { width: 375, height: 812 });
  await t.js("document.getElementById('outcomes-share').click()");
  await t.sleep(200);
  const narrow = await t.js("(() => { const b = document.getElementById('outcomes-sharebox').getBoundingClientRect(); return { left: b.left, right: b.right, width: innerWidth }; })()");
  t.check('on a phone the Share panel stays within the screen', narrow.left >= 0 && narrow.right <= narrow.width, JSON.stringify(narrow));
  await t.load('', { width: 1280, height: 800 });
  await t.js("Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.shared = data.url; } })");
  // without a share sheet the link goes to the clipboard, with a short note
  await t.js("Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); "
    + "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copied = text; } } })");
  await t.js("document.getElementById('share-site').click()");
  await t.sleep(100);
  t.check('without a share sheet the link goes to the clipboard and a short note says so', await t.js(
    "window.copied === 'https://somevotes.org/' && document.querySelector('.share-note')?.textContent === 'Link copied'"));
  // the shared link opens chapter 01 as it was shared; the explainer waits for Play and the Senate block follows
  await t.load('#outcomes', { query: 'count=neutral&vote=49.2' });
  await t.sleep(1500);
  const opened = await t.js(`({ row: document.querySelector('#scen [aria-checked=true] .lab')?.textContent, vote: document.getElementById('vote-out').textContent,
    tour: document.getElementById('tour-count').textContent === '' && document.getElementById('tour-play').textContent === 'Play',
    senate: document.getElementById('senate-figures').textContent.includes('49.2%'),
    inView: Math.abs(document.getElementById('outcomes').getBoundingClientRect().top) < 4 })`);
  t.check('a shared link opens chapter 01 on its row and vote share, with the explainer waiting', opened.row === 'Neutral-map median'
    && opened.vote === '49.2%' && opened.tour && opened.senate && opened.inView, JSON.stringify(opened));
}

// --- Task 7.7: chapter 02, the map and the list beside it ------------------------------------------------------
async function largest(t) {
  await t.load();
  // the row of the largest effects above the map is gone: the list beside the map shows them
  t.check('chapter 02 holds the tools, the map and the sheet, and no row of buttons above the map', await t.js(`(() => {
    const ch = document.getElementById('states');
    return !!ch && ['pick', 'map', 'legend', 'sheet'].every((id) => ch.contains(document.getElementById(id)))
      && !document.getElementById('largest') && !document.querySelector('.chip')
      && ch.querySelector('.chead h2')?.textContent === 'State by state' && document.getElementById('sheet').tagName === 'ASIDE';
  })()`));
}

// --- The tap line and the tooltip follow the state and the view ----------------------------------------------------
async function tapline(t) {
  await t.load('', { width: 1280, height: 800 });
  await t.click(await t.center(districtOf('TX')));
  const named = await t.text('#tapline');
  t.check('a click on a district names it under the map and outlines it', /^TX-\d+: /.test(named)
    && await t.js("(() => { const p = document.querySelectorAll('#map path.district.picked'); return p.length === 1 && p[0].__data__.properties.state === 'TX'; })()"), named);
  await t.js("{ const p = document.getElementById('pick'); p.value = 'CA'; p.dispatchEvent(new Event('change')) }");
  t.check('another state from the menu clears the line and the outline', await t.until(`${HEADING} === 'California'`)
    && (await t.text('#tapline')) === '' && await t.js("!document.querySelector('#map path.district.picked')"));
  await t.sleep(1200); // the zoom to California
  await t.click(await t.center(districtOf('CA')));
  const before = await t.text('#tapline');
  await t.js("document.getElementById('view-states').click()");
  t.check('another view clears the line', before.startsWith('CA-') && (await t.text('#tapline')) === '', before);
  await t.js("document.getElementById('view-districts').click()");
  await t.click(await t.center(districtOf('CA')));
  await t.js("document.querySelector('#sheet .back').click()");
  t.check('Back to all states clears the line', await t.until(`${HEADING} === 'Districts by Democratic share'`) && (await t.text('#tapline')) === '');
  // the gray edge of the country lies over every state line that is not marked, also after a state was chosen and
  // after the close races
  const coastOnTop = "(() => { const c = document.querySelector('#map path.coast'), kids = [...c.parentNode.children], i = kids.indexOf(c);"
    + " return kids.every((p, k) => k < i || p === c || p.matches('.on')); })()";
  const afterBack = await t.js(coastOnTop);
  await t.js("document.getElementById('view-close').click()");
  await t.js("document.getElementById('view-districts').click()");
  t.check('after Back and after the close races the edge of the country still lies over the plain state lines',
    afterBack && await t.js(coastOnTop));
  await t.sleep(1200);
  await t.mouse('mouseMoved', await t.center(districtOf('TX')));
  const shown = await t.js("!document.getElementById('tip').hidden");
  await t.js("document.getElementById('view-close').click()");
  t.check('a tooltip of the old view goes when the view changes under a resting mouse', shown && await t.js("document.getElementById('tip').hidden"));
}

// --- Links: a state, back to a chapter, a shared row and vote share --------------------------------------------------
async function links(t) {
  await t.load('#TX', { width: 1280, height: 800 });
  t.check('a link to a state opens on chapter 02 with that state', await t.until(`${HEADING} === 'Texas'`)
    && await t.js("scrollY > 0 && Math.abs(document.getElementById('states').getBoundingClientRect().top) < 4"));
  await t.load('#TX', { width: 390, height: 844 });
  t.check('on a phone a link to a state opens on its record', await t.until(`${HEADING} === 'Texas'`)
    && await t.js("Math.abs(document.getElementById('sheet').getBoundingClientRect().top) < 4"));
  await t.load('#method', { width: 1280, height: 800 });
  await t.js("{ const p = document.getElementById('pick'); p.value = 'TX'; p.dispatchEvent(new Event('change')) }");
  await t.until("location.hash === '#TX'");
  await t.js('history.back()');
  t.check('back from a state to #method shows the whole map again', await t.until(`location.hash === '#method' && ${HEADING} === 'Districts by Democratic share'`));
  await t.load('#outcomes', { width: 1280, height: 800, query: 'notour&count=neutral&vote=49.2' });
  const kept = await t.js("location.search.includes('count=neutral') && location.search.includes('vote=49.2')");
  await t.js("document.querySelectorAll('#scen [role=radio]')[0].click()");
  t.check('a shared row and vote share leave the address once the reader changes chapter 01', kept
    && await t.js("!location.search.includes('count=') && !location.search.includes('vote=') && location.search.includes('notour')"));
}

// --- A phone: the map under the fingers, the slider by its thumb, the House and the slider together -----------------
async function phone(t) {
  await t.tab('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await t.load('', { width: 390, height: 844 });
  t.check('on a phone the zoom buttons form a row under the map, not over it', await t.js(`(() => {
    const bar = document.querySelector('.zoombar'), map = document.getElementById('map').getBoundingClientRect();
    return getComputedStyle(bar).position === 'static' && bar.getBoundingClientRect().top >= map.bottom - 1; })()`));
  // a hit test: the thumb takes a finger, the track around it does not
  t.check('on a touch screen the slider takes the finger on its thumb only', await t.js(`(() => {
    const s = document.getElementById('vote');
    s.scrollIntoView({ block: 'center' });
    const r = s.getBoundingClientRect(), y = r.top + r.height / 2;
    const at = (v) => r.left + r.height / 2 + ((v - Number(s.min)) / (Number(s.max) - Number(s.min))) * (r.width - r.height);
    const far = Number(s.value) > (Number(s.min) + Number(s.max)) / 2 ? Number(s.min) : Number(s.max);
    return matchMedia('(pointer: coarse)').matches && getComputedStyle(s).pointerEvents === 'none'
      && document.elementFromPoint(at(Number(s.value)), y) === s && document.elementFromPoint(at(far), y) !== s;
  })()`));
  t.check('in one column the key of the House goes under the slider', await t.js(
    "document.querySelector('.waffle .wkey').getBoundingClientRect().top > document.getElementById('vote').getBoundingClientRect().bottom"));
  await t.js("{ const p = document.getElementById('pick'); p.scrollIntoView({ block: 'center' }); p.value = 'NC'; p.dispatchEvent(new Event('change')) }");
  t.check('on a phone a state from the menu brings its record up', await t.until(`${HEADING} === 'North Carolina'`)
    && await t.until("Math.abs(document.getElementById('sheet').getBoundingClientRect().top) < 4", 3000));
  // arrow keys on the menu choose at each press, so they leave the menu where it is
  await t.js("document.getElementById('pick').scrollIntoView({ block: 'center' }); document.getElementById('pick').focus()");
  const menuTop = await t.js("Math.round(document.getElementById('pick').getBoundingClientRect().top)");
  await t.js("{ const p = document.getElementById('pick'); p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); p.value = 'NE'; p.dispatchEvent(new Event('change')) }");
  t.check('a state chosen with the keys on the menu keeps the menu in view', await t.until(`${HEADING} === 'Nebraska'`)
    && Math.abs((await t.js("document.getElementById('pick').getBoundingClientRect().top")) - menuTop) < 4);
  // in full screen the zoom buttons stay on the map
  await t.js("document.getElementById('map-full').click()");
  await t.sleep(400);
  t.check('in full screen on a phone the zoom buttons lie on the map', await t.js(`(() => {
    const bar = document.querySelector('.zoombar').getBoundingClientRect(), box = document.getElementById('mapbox').getBoundingClientRect();
    return bar.bottom <= box.bottom + 1 && bar.top >= box.top - 1; })()`));
  await t.js("document.getElementById('map-full').click()");
  await t.tab('Emulation.setTouchEmulationEnabled', { enabled: false });
}

// --- Graphics to reuse: two images with their captions, a download and a copy each, and the terms -------------------
async function graphics(t) {
  await t.load('', { width: 1280, height: 800 });
  const drawn = await t.js(`[...document.querySelectorAll('#graphics .gcard canvas')].map((c) => [c.width, c.height,
    c.toDataURL('image/png').length, c.getAttribute('aria-label')?.length ?? 0])`);
  t.check('two images are drawn at 2400 pixels wide, each with a text alternative', drawn.length === 2
    && drawn.every(([w, h, size, alt]) => w === 2400 && h > 1000 && size > 50000 && alt > 40), JSON.stringify(drawn));
  const captions = await t.js("[...document.querySelectorAll('#graphics .caption')].map((p) => p.textContent)");
  t.check('each image has a caption that names the votes, the credit, the address and the license',
    captions.length === 2 && captions.every((c) => c.endsWith('Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).'))
    && captions[0].startsWith('With the 2016 and 2020 presidential votes, the maps used on November 3, 2026 give Democrats '), JSON.stringify(captions));
  t.check('the terms name CC BY 4.0 with a link to the license and the credit', await t.js(`(() => { const p = document.querySelector('#graphics .terms');
    return p.querySelector('a').getAttribute('href') === 'https://creativecommons.org/licenses/by/4.0/' && p.textContent.includes('Credit: Govert Schoof, Geodienst, University of Groningen, somevotes.org.'); })()`));
  // a catcher for the file the browser would save
  await t.js(`window.saved = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.saved.push([this.download, this.href.slice(0, 5)]); }`);
  await t.js("document.querySelectorAll('#graphics [data-action=download]').forEach((b) => b.click())");
  t.check('Download PNG saves each image under its own name', await t.until('window.saved.length === 2', 3000)
    && await t.js("window.saved.map((s) => s.join(' ')).join() === 'somevotes-national-51-8.png blob:,somevotes-drawing-effect-by-state.png blob:'"),
    await t.js('JSON.stringify(window.saved)'));
  await t.js("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copied = text; } } })");
  await t.js("document.querySelector('#graphic-states [data-action=copy]').click()");
  t.check('Copy caption puts the caption on the clipboard, with a short note', await t.until("document.querySelector('.share-note')?.textContent === 'Caption copied'", 2000)
    && await t.js("window.copied === document.querySelector('#graphic-states .caption').textContent"));
  // both images keep the 2016 and 2020 votes, whatever the slider of chapter 01 shows
  const national = "[document.querySelector('#graphic-national canvas').toDataURL('image/png'), document.querySelector('#graphic-national .caption').textContent,"
    + " document.querySelector('#graphic-national canvas').getAttribute('aria-label')].join('|')";
  await t.js(`window.nationalBefore = ${national}; window.leadBefore = document.getElementById('outcomes-lead').textContent; true`);
  await t.js("{ const s = document.getElementById('vote'); s.value = '0'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')) }");
  await t.sleep(600);
  t.check('the slider of chapter 01 leaves the national image, its caption and its text alternative at the 2016 and 2020 votes',
    await t.js("document.getElementById('outcomes-lead').textContent !== window.leadBefore")
    && await t.js(`${national} === window.nationalBefore`)
    && await t.js("document.querySelector('#graphic-national .caption').textContent.startsWith('With the 2016 and 2020 presidential votes, ')"));
  await t.js("window.saved = []; document.querySelector('#graphic-national [data-action=download]').click()");
  t.check('after the slider moves, Download PNG still saves the image of the 2016 and 2020 votes',
    await t.until('window.saved.length === 1', 3000) && await t.js("window.saved[0][0] === 'somevotes-national-51-8.png'"),
    await t.js('JSON.stringify(window.saved)'));
  // More: the district map as a static image, closed at first; its preview loads only when More opens
  const mapCaption = 'Votes: the 2016 and 2020 presidential results. Maps used on November 3, 2026. '
    + 'Graphic: Govert Schoof, Geodienst, University of Groningen, somevotes.org (CC BY 4.0).';
  const closed = await t.js(`(() => { const d = document.querySelector('#graphics details.gmore'); const img = d?.querySelector('img');
    return !!img && !d.open && d.querySelector('summary').textContent === 'More' && img.naturalWidth === 0; })()`);
  await t.js("{ const d = document.querySelector('#graphics details.gmore'); d.open = true; d.scrollIntoView({ block: 'center' }); }");
  const opened = await t.until("document.querySelector('#graphic-map img').naturalWidth > 0", 3000);
  await t.js("window.copied = ''; document.querySelector('#graphic-map [data-action=copy]').click()");
  t.check('More is closed at first and opens on the district map, with its caption, the full-size PNG and Copy caption',
    closed && opened && await t.js(`document.querySelector('#graphic-map .gcaption').textContent === ${JSON.stringify(mapCaption)}`)
    && await t.js("document.querySelector('#graphic-map a[download]').getAttribute('href') === 'img/somevotes-map-all-states.png'")
    && await t.until(`window.copied === ${JSON.stringify(mapCaption)}`, 2000), JSON.stringify({ closed, opened }));
  await t.screenshot('graphics-1280', { viewport: false });
}

// --- Videos, above Graphics to reuse: three players that load only their posters, side by side on a wide screen -----
async function videos(t) {
  // each player: its box, the box of its title, its name, length, downloads and the text under it
  const players = `[...document.querySelectorAll('main video')].map((v) => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width),
      h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
    const card = v.closest('.vcard'), head = card.querySelector('.vcard-head');
    return { box: r(v), head: r(head), col: Math.round(card.getBoundingClientRect().width),
      name: document.getElementById(v.getAttribute('aria-labelledby'))?.textContent, time: head.querySelector('time')?.textContent,
      links: [...card.querySelectorAll('.gbar a')].map((a) => a.textContent + ' ' + a.getAttribute('href').split('/').slice(-2).join('/')),
      text: card.querySelector('details.why summary')?.textContent, preload: v.preload, autoplay: v.autoplay, inVideos: !!v.closest('#videos') };
  })`;
  const fetched = "performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.endsWith('.mp4'))";

  await t.load('', { width: 1280, height: 800 });
  t.check('Videos stands between the method and Graphics to reuse, with its heading and no intro line', await t.js(`(() => {
    const s = document.getElementById('videos');
    return s.tagName === 'SECTION' && s.previousElementSibling?.id === 'method' && s.nextElementSibling?.id === 'graphics'
      && s.querySelector('h2')?.textContent === 'Videos' && !s.querySelector('.intro'); })()`));
  const style = await t.js(`(() => {
    const look = (el, props) => props.map((p) => getComputedStyle(el)[p]).join(' ');
    return ['videos', 'graphics'].map((id) => { const s = document.getElementById(id), w = s.querySelector('.wrap');
      return [look(s, ['borderTopWidth', 'borderTopStyle', 'paddingTop', 'paddingBottom']), look(w, ['maxWidth', 'paddingLeft']),
        look(s.querySelector('h2'), ['fontFamily', 'fontSize', 'fontWeight', 'marginBottom']),
        look(s.querySelector('.terms'), ['fontSize', 'maxWidth', 'marginTop'])].join(' | '); }); })()`);
  t.check('Videos has the wrap, heading and terms of Graphics to reuse', style[0] === style[1], style.join(' || '));
  t.check('Graphics to reuse keeps its two images and has no videos of its own', await t.js(
    "document.querySelectorAll('#graphics .gcard').length === 2 && !document.querySelector('#graphics video, #graphics .vcard, #graphics a[href$=\".mp4\"]')"));
  t.check('the videos have their own terms, CC BY 4.0 with a link to the license and the credit', await t.js(`(() => {
    const p = document.querySelector('#videos .terms'), a = p && p.querySelector('a');
    return !!p && p.textContent === 'You may reuse the videos, also commercially, under CC BY 4.0. Credit: Govert Schoof, Geodienst, University of Groningen, somevotes.org.'
      && !!a && a.href === 'https://creativecommons.org/licenses/by/4.0/' && a.textContent === 'CC BY 4.0'; })()`));
  t.check('the terms of Graphics to reuse are about the images, as before', (await t.text('#graphics .terms')).startsWith('You may reuse the images and their captions, also commercially, under CC BY 4.0.'));

  const wide = await t.js(players);
  t.check('three players, all in Videos: Teaser, How House elections work and How to rig a map, with their lengths',
    wide.length === 3 && wide.every((p) => p.inVideos) && wide.map((p) => `${p.name} ${p.time}`).join()
      === 'Teaser 0:57,How House elections work 1:40,How to rig a map 1:07', JSON.stringify(wide.map((p) => [p.name, p.time])));
  t.check('each has Download MP4 from the release, and the text in the video',
    JSON.stringify(wide.map((p) => p.links)) === JSON.stringify([
      ['Download MP4 videos-2026-10-27/1-somevotes-teaser-9x16-v6.2.mp4'],
      ['Download MP4 videos-2026-10-27/2-somevotes-house-elections-explainer-9x16-v2.8.mp4'],
      ['Download MP4 videos-2026-10-27/3-somevotes-how-to-rig-a-map-9x16-v2.1.mp4'],
    ]) && wide.every((p) => p.text === 'Text in the video'), JSON.stringify(wide.map((p) => p.links)));
  t.check('on a wide screen the three stand side by side, level, each 300 to 420 px wide with its title above it and within 80% of the screen height',
    wide.length === 3 && wide.every((p, i) => p.box.y === wide[0].box.y && (i === 0 || p.box.x > wide[i - 1].box.right)
      && p.box.w >= 300 && p.box.w <= 420 && p.box.h <= 0.8 * 800 + 2 && p.head.bottom <= p.box.y && p.box.w >= p.col - 2),
    JSON.stringify(wide.map((p) => p.box)));
  await t.js("document.getElementById('videos').scrollIntoView()");
  await t.sleep(500);
  t.check('in view, a player loads its poster and none of its video', wide.every((p) => p.preload === 'none' && !p.autoplay)
    && (await t.js(fetched)).length === 0 && await t.js("[...document.querySelectorAll('main video')].every((v) => v.readyState === 0)")
    && await t.js("performance.getEntriesByType('resource').filter((e) => e.name.includes('/video/') && e.name.endsWith('-poster.webp')).length === 3"),
    JSON.stringify(await t.js(fetched)));
  await t.screenshot('videos-1280', { viewport: true });

  // on a tablet every download button keeps one line and the same height
  await t.load('', { width: 768, height: 1024 });
  const tablet = await t.js(players);
  const buttons = await t.js("[...document.querySelectorAll('#videos .gbar a')].map((a) => Math.round(a.getBoundingClientRect().height))");
  t.check('on a tablet the three stand side by side and every download button has the same height',
    tablet.length === 3 && tablet.every((p, i) => p.box.y === tablet[0].box.y && (i === 0 || p.box.x > tablet[i - 1].box.right))
      && buttons.length === 3 && buttons.every((h) => h === buttons[0]), JSON.stringify({ boxes: tablet.map((p) => p.box), buttons }));

  await t.load('', { width: 375, height: 812 });
  const phone = await t.js(players);
  t.check('on a phone the three stand one under the other, each with its title above it, as wide as the column and within 80% of the screen height',
    phone.length === 3 && phone.every((p, i) => p.box.x === phone[0].box.x && (i === 0 || p.head.y > phone[i - 1].box.bottom)
      && p.head.bottom <= p.box.y && p.box.w >= p.col - 2 && p.box.h <= 0.8 * 812 + 2), JSON.stringify(phone.map((p) => p.box)));
  await t.js("document.getElementById('videos').scrollIntoView()");
  await t.sleep(300);
  await t.screenshot('videos-375', { viewport: true });

  // the Videos link of the byline goes to the section
  await t.load('', { width: 1280, height: 800 });
  await t.js("document.querySelector('.mast .byline a[href=\"#videos\"]').click()");
  t.check('the Videos link in the byline goes to Videos', await t.until(
    "location.hash === '#videos' && Math.abs(document.getElementById('videos').getBoundingClientRect().top) < 4", 3000));
}

export const GROUPS = [
  { name: 'masthead', run: masthead },
  { name: 'outcomes', run: outcomes },
  { name: 'map', run: map },
  { name: 'largest', run: largest },
  { name: 'fullscreen', run: fullscreen },
  { name: 'list', run: list },
  { name: 'sheet', run: sheet },
  { name: 'sweep', run: sweep },
  { name: 'decide', run: decide },
  { name: 'method', run: method },
  { name: 'layout', run: layout },
  { name: 'redraws', run: redraws },
  { name: 'competitive', run: competitive },
  { name: 'control', run: control },
  { name: 'senate', run: senate },
  { name: 'tour', run: tour },
  { name: 'share', run: sharing },
  { name: 'tapline', run: tapline },
  { name: 'links', run: links },
  { name: 'phone', run: phone },
  { name: 'graphics', run: graphics },
  { name: 'videos', run: videos },
];
