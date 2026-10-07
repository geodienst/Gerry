// Browser checks for tools/check_site.mjs, one group per task of docs/superpowers/plans/2026-10-07-site.md.
// A group gets `t` with: load, js, text, until, center, mouse, click, key, tab, sleep, check, screenshot.
// The checks test structure and the form of the texts, not numbers that change with the data.

const AT_LARGE = 'One at-large seat. No districts, so nothing to compare.';
const HEADING = "document.querySelector('#sheet h2')?.textContent";
const ZOOM = "Number((document.querySelector('#map > g').getAttribute('transform') || '').match(/scale\\(([\\d.e-]+)\\)/)?.[1] ?? 1)";
const DATA = "fetch('data/results.json').then((r) => r.json())";
const districtOf = (postal) => `[...document.querySelectorAll('#map path.district')].find((p) => p.__data__.properties.state === '${postal}')`;
const stateOf = (postal) => `[...document.querySelectorAll('#map path.statefill')].find((p) => p.__data__.properties.postal === '${postal}')`;

// --- Task 6.3: the map ---------------------------------------------------------------------------
async function map(t) {
  t.check('the page loads and draws the map', await t.load());
  t.check('435 districts and 50 states on the map',
    await t.js("document.querySelectorAll('#map path.district').length === 435 && document.querySelectorAll('#map path.statefill').length === 50"));
  t.check('the zoom hint is hidden at the start', await t.js("getComputedStyle(document.getElementById('gesture')).display === 'none'"));
  t.check('the State menu lists the 44 states', await t.js("document.querySelectorAll('#pick option').length === 45"));

  const wyoming = await t.center(districtOf('WY'));
  await t.mouse('mouseMoved', wyoming);
  t.check('pointing at Wyoming shows the at-large text', (await t.text('#tip')).includes(AT_LARGE));
  await t.click(wyoming);
  t.check('clicking Wyoming writes the tap line and keeps the whole map',
    (await t.text('#tapline')) === `Wyoming: ${AT_LARGE}` && (await t.js('location.hash')) === '');

  const texas = await t.center(districtOf('TX'));
  await t.mouse('mouseMoved', texas);
  t.check('pointing at a district shows its name and share',
    /^TX-\d+ · Texas$/.test(await t.text('#tip b')) && (await t.text('#tip')).includes('Democratic share'));
  await t.click(texas);
  t.check('clicking a district writes the tap line', /^TX-\d+: .+ Democratic$/.test(await t.text('#tapline')));
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
  await t.until(`${ZOOM} === 1`);
  await t.mouse('mouseMoved', await t.center(stateOf('TX')));
  t.check('pointing at a state shows its drawing effect',
    /^Drawing effect (0|[RD]\+\d+) · /.test(await t.js("document.querySelector('#tip span')?.textContent ?? ''")));
  await t.js("document.getElementById('view-districts').click()");
  const legend = await t.text('#legend');
  t.check('the district legend runs from 20% to 80% with both ends named',
    ['20%', '80%', 'More Republican', 'More Democratic'].every((part) => legend.includes(part)));
  const fills = "[...document.querySelectorAll('#map path.district')].slice(0, 30).map((p) => p.getAttribute('fill')).join()";
  const party = await t.js(fills);
  await t.js("document.getElementById('palette-neutral').click()");
  t.check('"Neutral colors" repaints the map', (await t.js(fills)) !== party);
  await t.js("document.getElementById('palette-party').click()");
  t.check('"Party colors" brings the party colors back', (await t.js(fills)) === party);
  await t.screenshot('map-1280');

  // A phone: a tap writes the tap line without a tooltip, one finger is left to the page, two fingers zoom.
  await t.tab('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await t.load('', { width: 375, height: 800 });
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
  t.check('without a state the sheet shows "Drawing effect by state"', await t.until(`${HEADING} === 'Drawing effect by state'`));
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
  t.check('the net bar names both sides and the net', await t.js(
    "(() => { const s = document.querySelector('#sheet .net svg'); return s !== null && s.textContent.includes('toward Republicans') && s.textContent.includes('toward Democrats') && /Net (0|[RD]\\+\\d+)/.test(s.textContent); })()"));
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
  t.check('a sentence under the net bar gives the sums', /Net: .+\.$/.test(await t.text('#sheet .net p')));
  await t.screenshot('list-1280');
}

async function sheet(t) {
  await t.load('#TX');
  t.check('#TX opens the sheet for Texas', await t.until(`${HEADING} === 'Texas'`));
  const texas = await t.text('#sheet');
  for (const part of ['All states', 'Legal status as of ', 'Proportional', 'Neutral baseline', 'Enacted', 'Geographic effect',
    'Drawing effect', 'neutral maps,', 'Districts, sorted', 'Efficiency gap', 'Mean-median', 'Notes', 'Map file:']) {
    t.check(`the Texas sheet has "${part}"`, texas.includes(part));
  }
  t.check('the status reads "In effect" or "Challenged in court"', /In effect|Challenged in court/.test(texas));
  t.check('effects show their direction', /([RD]\+\d+ · \d+ seats? toward (Republicans|Democrats)|0 · no difference)/.test(texas));
  t.check('efficiency gap in points toward a party', /points toward (Republicans|Democrats)|less than 0\.05 points either way/.test(texas));
  t.check('the seat axis and the sorted chart have a text alternative', await t.js(
    "[...document.querySelectorAll('#sheet svg.chart')].filter((s) => s.getAttribute('role') === 'img' && s.getAttribute('aria-label')).length === 2"));
  t.check('chart text stays at least 10px tall', await t.js("[...document.querySelectorAll('#sheet svg.chart text')].every((el) => el.getBoundingClientRect().height >= 10)"));
  await t.js("location.hash = '#MO'");
  t.check('Missouri has the row for the blocked map', await t.until(`${HEADING} === 'Missouri'`)
    && /Blocked map.*Blocked.*would give/s.test(await t.text('#sheet')));
  await t.js("location.hash = '#HI'");
  t.check('Hawaii shows "Not defined for two districts"', await t.until(`${HEADING} === 'Hawaii'`)
    && (await t.text('#sheet')).includes('Not defined for two districts'));
  // Escape from the text outside the sheet and the map, such as the page heading, keeps the state.
  await t.js("(() => { const h = document.querySelector('header h1'); h.tabIndex = -1; h.focus(); })()");
  await t.key('Escape', 27);
  await t.sleep(300);
  t.check('Escape outside the sheet and the map keeps the state', await t.js(`${HEADING} === 'Hawaii' && location.hash === '#HI'`));
  await t.js("(() => { const h = document.querySelector('header h1'); h.blur(); h.removeAttribute('tabindex'); })()");
  await t.key('Escape', 27);
  t.check('Escape goes back to the list and drops the state from the link', await t.until(`${HEADING} === 'Drawing effect by state' && location.hash === ''`));
  await t.load();
  await t.until(`${HEADING} === 'Drawing effect by state'`);
  const folded = await t.js("document.querySelector('#sheet details.zeros .row').dataset.postal");
  await t.js(`location.hash = '#${folded}'`);
  await t.until(`location.hash === '#${folded}' && ${HEADING} !== 'Drawing effect by state'`);
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
  t.check('the button "All states" goes back to the list', await t.until(`${HEADING} === 'Drawing effect by state'`));
  await t.js("document.querySelector('#sheet details.zeros summary').click()");
  await t.js("document.querySelector('#sheet .row').click()");
  await t.until(`${HEADING} !== 'Drawing effect by state'`);
  await t.js("document.querySelector('#sheet .back').click()");
  await t.until(`${HEADING} === 'Drawing effect by state'`);
  t.check('the zero states stay unfolded after a state and "All states"', await t.js("document.querySelector('#sheet details.zeros').open"));
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
}

// --- Task 6.7: the national section ---------------------------------------------------------------
async function national(t) {
  await t.load('#TX');
  await t.until(`${HEADING} === 'Texas'`);
  t.check('the line under the title has the four key figures', /^Democratic seats of \d+:\s*Proportional\s*\d+\s*Neutral baseline\s*\d+\s*Enacted\s*\d+\s*Drawing effect\s*(0|[RD]\+\d+)/.test(await t.text('#keyline')));
  await t.js("document.querySelector('#keyline a[href=\"#national\"]').click()");
  t.check('"National picture" leads to the national strip and keeps the state',
    await t.until("location.hash === '#national'") && (await t.js("document.getElementById('pick').value")) === 'TX'
    && await t.js("(() => { const top = document.getElementById('national').getBoundingClientRect().top; return top > -5 && top < innerHeight; })()"));
  const strip = await t.text('#national');
  t.check('the strip has the three numbers, the band and both effects',
    ['Proportional', 'Neutral baseline', 'Enacted', '90% of outcomes', 'Geographic effect', 'Drawing effect', 'of neutral outcomes'].every((p) => strip.includes(p)));
  t.check('the national seat axis has a text alternative', await t.js(
    "document.querySelector('#national-axis svg')?.getAttribute('aria-label')?.startsWith('Democratic seats in all states with more than one seat') === true"));
  // A marker line stops at the labels of the other markers (Step 6: no line through the text).
  const crossings = (scope) => `(() => {
    const hits = [];
    for (const svg of document.querySelectorAll('${scope} svg.chart')) {
      const labels = [...svg.querySelectorAll(':scope > text.mark-label')].map((node) => ({
        node, x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')), box: node.getBBox() }));
      if (!labels.length) continue;
      for (const line of svg.querySelectorAll(':scope > line')) {
        const x = Number(line.getAttribute('x1'));
        const [y1, y2] = [Number(line.getAttribute('y1')), Number(line.getAttribute('y2'))].sort((a, b) => a - b);
        // the line's own label is the nearest one above it at the same x
        const own = labels.filter((l) => Math.abs(l.x - x) < 1e-6 && l.y <= y1).sort((a, b) => b.y - a.y)[0];
        for (const l of labels) {
          if (l === own) continue;
          const across = x > l.box.x + 0.5 && x < l.box.x + l.box.width - 0.5;
          const overlap = Math.min(y2, l.box.y + l.box.height) - Math.max(y1, l.box.y);
          if (across && overlap > 0.5) hits.push((own ? own.node.textContent : 'a line') + ' runs through ' + l.node.textContent);
        }
      }
    }
    return hits;
  })()`;
  for (const width of [375, 2560, 1280]) {
    await t.load('', { width, height: 900 });
    const hits = (await t.js(crossings('#national'))).map((hit) => `national: ${hit}`);
    const states = await t.js("[...document.querySelectorAll('#pick option')].map((o) => o.value).filter(Boolean)");
    for (const postal of states) {
      await t.js(`location.hash = '#${postal}'`);
      await t.until(`document.getElementById('pick').value === '${postal}' && document.querySelector('#sheet text.mark-label') !== null`);
      hits.push(...(await t.js(crossings('#sheet'))).map((hit) => `${postal}: ${hit}`));
    }
    t.check(`${width} px: no marker line runs through another label (national axis and ${states.length} states)`,
      hits.length === 0, hits.length ? `${hits.length} crossings: ${hits.join('; ')}` : '');
  }
}

// --- Task 6.8: the method and the footer ----------------------------------------------------------
async function method(t) {
  await t.load();
  t.check('every number in the method and the footer is filled in', await t.js("[...document.querySelectorAll('[data-fill]')].every((el) => el.textContent.trim() !== '')"));
  const text = await t.text('#method');
  for (const part of ['How to read the three numbers.', 'Why neutral maps are not proportional.', 'Votes.', 'The Voting Rights Act.',
    'Neutral maps that keep old district cores.', 'The national band.', 'Known limits.', 'Sources.']) {
    t.check(`the method has "${part}"`, text.includes(part));
  }
  t.check('"Known limits" has ten points', await t.js("document.querySelectorAll('#method ul > li').length === 10"));
  await t.js("document.querySelector('#keyline a[href=\"#method\"]').click()");
  t.check('"Method" under the title leads to the method', await t.until("location.hash === '#method'"));
  t.check('the footer names the data date, the legal status date and the ALARM version',
    /Data generated .+\. Legal status as of .+\. ALARM dataset version \d+\./.test(await t.text('footer')));
  t.check('the footer links to the Geodienst with its logo',
    await t.js("(() => { const a = document.querySelector('footer a[href=\"https://rug.nl/geo\"]'); const img = a && a.querySelector('img'); return !!a && a.textContent.trim() === 'Geodienst' && !!img && img.complete && img.naturalWidth > 0; })()"));
}

export const GROUPS = [
  { name: 'map', run: map },
  { name: 'list', run: list },
  { name: 'sheet', run: sheet },
  { name: 'national', run: national },
  { name: 'method', run: method },
];
