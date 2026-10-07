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
  t.check('the line under the title gives the key figures as one sentence',
    /^Of \d+ seats, Democrats win \d+ if seats follow the votes, \d+ on neutral maps and \d+ on the 2026 maps\. Drawing effect: (0|[RD]\+\d+)\.National pictureMethod$/.test(await t.text('#keyline')));
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
  const textHits = [];
  for (const width of [375, 2560, 1280]) {
    await t.load('', { width, height: 900 });
    const hits = (await t.js(crossings('#national'))).map((hit) => `national: ${hit}`);
    if (width === 1280) textHits.push(...(await t.js(broken)).map((hit) => `national: ${hit}`));
    const states = await t.js("[...document.querySelectorAll('#pick option')].map((o) => o.value).filter(Boolean)");
    for (const postal of states) {
      await t.js(`location.hash = '#${postal}'`);
      await t.until(`document.getElementById('pick').value === '${postal}' && document.querySelector('#sheet text.mark-label') !== null`);
      hits.push(...(await t.js(crossings('#sheet'))).map((hit) => `${postal}: ${hit}`));
      if (width === 1280) textHits.push(...(await t.js(broken)).map((hit) => `${postal}: ${hit}`));
    }
    t.check(`${width} px: no marker line runs through another label (national axis and ${states.length} states)`,
      hits.length === 0, hits.length ? `${hits.length} crossings: ${hits.join('; ')}` : '');
    if (width === 1280) {
      t.check(`no em dash, "undefined", "NaN", "<1%", ">99%" or empty fill on the page or on the sheets of all ${states.length} states`,
        textHits.length === 0, textHits.join('; '));
    }
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
  t.check('the method says both ends of the competitive range count', text.includes('Competitive districts have a Democratic share from 45% to 55%, both included.'));
  t.check('the Louisiana limit gives the plan share in words or as a plain percent',
    /Of the [\d,]+ neutral maps, (more than 99%|less than 1%|\d+%) give \d+ Democratic seats?\./.test(text));
  t.check('TX-15, TX-28 and TX-34 in the known limits stay on one line', await t.js(`(() => {
    const names = [...document.querySelectorAll('#method li .nowrap')].filter((el) => getComputedStyle(el).whiteSpace === 'nowrap').map((el) => el.textContent);
    return names.join(' ') === 'TX-15 TX-28 TX-34';
  })()`));
  await t.js("document.querySelector('#keyline a[href=\"#method\"]').click()");
  t.check('"Method" under the title leads to the method', await t.until("location.hash === '#method'"));
  t.check('the footer names the data date, the legal status date and the ALARM version',
    /Data generated .+\. Legal status as of .+\. ALARM dataset version \d+\./.test(await t.text('footer')));
  t.check('the footer links to the Geodienst with its logo',
    await t.js("(() => { const a = document.querySelector('footer a[href=\"https://rug.nl/geo\"]'); const img = a && a.querySelector('img'); return !!a && a.textContent.trim() === 'Geodienst' && !!img && img.complete && img.naturalWidth > 0; })()"));
  // A click on plain text leaves the focus on the body; Escape then acts only while the map or the sheet is in view.
  await t.load('#TX');
  await t.until(`${HEADING} === 'Texas'`);
  await t.click(await t.center("document.querySelector('#method p')"));
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
  for (const [width, height, place, font] of [[375, 812, 'below', '15px'], [1280, 800, 'beside', '15px'], [2560, 1440, 'beside', '20.52px']]) {
    await t.load('#CA', { width, height });
    await t.until(`${HEADING} === 'California'`);
    // clientWidth leaves out the scrollbar and, unlike innerWidth, does not grow with the overflow on a phone.
    const sideways = await t.js('({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })');
    t.check(`${width}px: no sideways scrolling`, sideways.scrollWidth <= sideways.clientWidth, JSON.stringify(sideways));
    const where = await t.js("(() => { const m = document.querySelector('.main > section').getBoundingClientRect(); const s = document.getElementById('sheet').getBoundingClientRect(); return s.left >= m.right - 1 ? 'beside' : s.top >= m.bottom - 1 ? 'below' : 'overlap'; })()");
    t.check(`${width}px: the sheet is ${place} the map`, where === place, where);
    t.check(`${width}px: root font size ${font}`, (await t.js('getComputedStyle(document.documentElement).fontSize')) === font);
    // The font size on screen: the CSS size times the scale of the chart's viewBox.
    const sizes = await t.js("[...document.querySelectorAll('svg.chart text')].map((el) => parseFloat(getComputedStyle(el).fontSize) * el.getScreenCTM().a)");
    const small = sizes.filter((size) => !(size >= 10));
    t.check(`${width}px: chart text is at least 10px on screen`, sizes.length > 0 && small.length === 0, sizes.length
      ? `${sizes.length} texts, smallest ${Math.min(...sizes).toFixed(1)}px${small.length ? `, ${small.length} below 10px` : ''}` : 'no chart text found');
    // The paragraphs of the national strip keep a readable measure on wide screens (Task 6.15): characters per rendered line.
    const lines = await t.js(`(() => {
      const most = [];
      for (const p of document.querySelectorAll('#national p')) {
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
    t.check(`${width}px: no line in the national strip is longer than 100 characters`, lines.length > 0 && long.length === 0,
      `longest ${Math.max(...lines.map((p) => p.chars))}${long.length ? `: ${long.map((p) => `${p.id} ${p.chars}`).join(', ')}` : ''}`);
    await t.screenshot(`california-${width}`);
  }

  await t.load();
  const order = [];
  for (let i = 0; i < 16; i += 1) {
    await t.key('Tab', 9);
    order.push(await t.js("(() => { const el = document.activeElement; return el.closest('#map') ? 'map shape' : el.id || el.getAttribute('class') || el.tagName; })()"));
  }
  const wanted = ['view-districts', 'view-states', 'palette-party', 'palette-neutral', 'pick', 'zoom-in', 'zoom-out', 'zoom-reset', 'row'];
  t.check('Tab reaches the view, color and zoom buttons, the State menu and the list, in that order',
    wanted.every((id, i) => order.indexOf(id) > (i === 0 ? -1 : order.indexOf(wanted[i - 1]))), order.join(' '));
  t.check('no shape on the map is a tab stop', !order.includes('map shape'));
  t.check('focus reached with Tab is visible', order.at(-1) === 'row'
    && (await t.js('getComputedStyle(document.activeElement).outlineStyle')) === 'solid');

  // The State menu keeps the focus (Task 6.6); a polite live region reads the heading of the new sheet.
  await t.load();
  await t.js("(() => { const pick = document.getElementById('pick'); pick.focus(); pick.value = 'NV'; pick.dispatchEvent(new Event('change')); })()");
  const heard = (await t.until(`${HEADING} === 'Nevada'`)) && await t.js(
    "(() => { const s = document.getElementById('sheet-status'); return { focus: document.activeElement.id, live: s.getAttribute('aria-live'), text: s.textContent }; })()");
  t.check('a state chosen with the State menu keeps the focus there and is announced',
    heard.focus === 'pick' && heard.live === 'polite' && heard.text === 'Nevada', JSON.stringify(heard));
  await t.js("document.querySelector('#sheet .back').click()");
  const cleared = (await t.until(`${HEADING} === 'Drawing effect by state'`)) && await t.text('#sheet-status');
  t.check('"All states" empties the live region', cleared === '', JSON.stringify(cleared));

  await t.load('', { dark: true });
  t.check('dark mode uses the dark tokens', (await t.js('getComputedStyle(document.body).backgroundColor')) === 'rgb(17, 19, 22)');
  t.check('dark mode paints the map with the dark poles', (await t.js("document.querySelector('#legend linearGradient stop:last-child').getAttribute('stop-color')")) === 'rgb(57, 135, 229)');
  await t.screenshot('dark-1280');

  for (const reduce of [true, false]) {
    await t.load('', { reduce });
    await t.js("location.hash = '#NV'");
    await t.sleep(150);
    const early = await t.js(ZOOM);
    await t.sleep(900);
    const late = await t.js(ZOOM);
    t.check(reduce ? 'with reduced motion the zoom jumps without animation' : 'without reduced motion the zoom animates',
      reduce ? early === late && late > 1 : early < late, `${early} then ${late}`);
  }
}

// --- Task 6.10: the House majority (after Phase 5) --------------------------------------------------
async function majority(t) {
  await t.load();
  t.check('the House majority sentence', /^With these votes, Democrats need .+ of the two-party vote for a House majority under the enacted maps, .+ under neutral maps and .+ if seats followed the vote\. They have .+\.$/.test(await t.text('#majority-text')));
  const axis = await t.text('#majority-axis');
  t.check('the vote axis marks Enacted, Neutral, Proportional and the vote', ['Enacted', 'Neutral', 'Proportional', 'Vote'].every((p) => axis.includes(p)));
  t.check('the vote axis has a text alternative', await t.js("document.querySelector('#majority-axis svg')?.getAttribute('aria-label')?.startsWith('Share of the two-party vote that Democrats need') === true"));
  const note = await t.text('#majority-note');
  const below = await t.js(`${DATA}.then((r) => r.national.majority.proportional.share < 0.5)`);
  t.check('the sentence about Proportional below 50% appears exactly when it applies', below === note.includes('Proportional needs less than half of the vote'));
  t.check('the note gives the six single-seat states their fixed party', /Delaware and Vermont for Democrats; Alaska, North Dakota, South Dakota and Wyoming for Republicans\. So Democrats need \d+ of the \d+ districts\.$/.test(note));
}

// --- Task 6.11: redraws since 2024 ---------------------------------------------------------------
async function redraws(t) {
  await t.load('#TX');
  t.check('the national redraw sentence', /^With these votes, the maps of the 2024 election give Democrats \d+ seats and the 2026 maps \d+\. Net change: (0 · no difference|[RD]\+\d+ · .+)\.$/.test(await t.text('#redraw-text')));
  const changed = await t.js(`${DATA}.then((r) => Object.values(r.states).filter((s) => s.redraw.change !== 0).length)`);
  t.check('one line per state with another seat count', await t.js(`document.querySelectorAll('#redraw-list li').length === ${changed}`));
  await t.until(`${HEADING} === 'Texas'`);
  t.check('the Texas sheet has the redraw line', /(Map unchanged since 2024\.|2024 map: \d+ Democratic seats? with these votes\. 2026 map: \d+ \((\d+ (fewer|more)|the same number)\)\.)/.test(await t.text('#sheet')));
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
  t.check('the national strip links to the tables', await t.js("document.querySelector('#national a[href=\"#control\"]') !== null"));
  await t.until(`${HEADING} === 'Texas'`);
  t.check('the Texas sheet says who adopted the map', /Adopted by: (Legislature|Commission|Court) \((Republican control|Democratic control|bipartisan|nonpartisan)\)\./.test(await t.text('#sheet')));
}

// --- Task 6.14: the Senate -----------------------------------------------------------------------
async function senate(t) {
  await t.load();
  t.check('the Senate sentence', /^If each state's two senators went to the party that won its presidential vote, Democrats would need .+ of the two-party vote for a Senate majority\. They have .+ and would win \d+ states?\.$/.test(await t.text('#senate-text')));
  t.check('the Senate block says it is not an effect of maps', (await t.text('#senate-note')).startsWith('The Senate has no districts'));
}

// --- Owner decision of October 7, 2026: working title, lede, keyline sentence, "How to read this" ---
async function explainer(t) {
  await t.load();
  t.check('the title and the heading read "Some votes are more equal than others"', await t.js("document.title === 'Some votes are more equal than others' && document.querySelector('header h1').textContent === 'Some votes are more equal than others'"));
  t.check('the lede asks the question and names the three ways',
    (await t.text('header .lede')).startsWith('How many U.S. House seats would Democrats win with the same votes on different maps?'));
  t.check('the meta description is the lede', await t.js("document.querySelector('meta[name=description]').content === document.querySelector('header .lede').textContent"));
  // The numbers the page shows, formatted in the page with its own format.js, against results.json.
  const want = await t.js(`Promise.all([${DATA}, import(new URL('js/format.js', location.href))]).then(([r, f]) => {
    const n = r.national;
    const s = r.states.TX;
    const plans = s.neutral.dist.reduce((a, b) => a + b, 0);
    const band = s.neutral.p5 === s.neutral.p95 ? f.seats(s.neutral.p5) : f.seats(s.neutral.p5) + ' to ' + f.seats(s.neutral.p95);
    const g = s.effects.geographic;
    const d = s.effects.drawing;
    return {
      keyline: 'Of ' + n.seats + ' seats, Democrats win ' + n.proportional + ' if seats follow the votes, ' + n.neutral.median
        + ' on neutral maps and ' + n.enacted + ' on the 2026 maps. Drawing effect: ' + f.effect(n.effects.drawing) + '.',
      parts: ['Texas has ' + s.seats + ' seats, and ' + f.share(s.d_share) + ' of its two-party vote went to Democrats.',
        'Proportional: ' + s.proportional + ' seats.', 'Neutral baseline: ' + s.neutral.median + ' seats.',
        'The typical result of ' + f.count(plans) + " maps a computer drew under Texas's rules", '90% of those maps give ' + band + '.',
        'Enacted: ' + s.enacted + ' seats.',
        'Geographic effect, ' + f.effect(g) + (g === 0 ? ': no difference.' : ': from ' + s.proportional + ' to ' + s.neutral.median + '.'),
        'Drawing effect, ' + f.effect(d) + (d === 0 ? ': no difference.' : ': from ' + s.neutral.median + ' to ' + s.enacted + '.')],
    };
  })`);
  t.check('the keyline sentence has the national numbers of results.json', (await t.text('#keyline')).startsWith(want.keyline), want.keyline);
  const body = await t.text('#explainer');
  const missing = want.parts.filter((part) => !body.includes(part));
  t.check('"How to read this" has the Texas numbers of results.json', missing.length === 0, missing.join(' | '));
  const box = "document.getElementById('explainer')";
  t.check('"How to read this" sits between the header and the map, open, with five items', await t.js(`(() => {
    const d = ${box};
    return d.tagName === 'DETAILS' && d.open && !d.hidden && d.checkVisibility()
      && d.previousElementSibling.tagName === 'HEADER' && !!(d.compareDocumentPosition(document.getElementById('map')) & Node.DOCUMENT_POSITION_FOLLOWING)
      && d.querySelector('summary').textContent === 'How to read this' && d.querySelectorAll('#explainer-items li').length === 5;
  })()`));
  await t.js(`${box}.querySelector('summary').click()`);
  t.check('a click on "How to read this" folds it', await t.js(`!${box}.open && !document.getElementById('explainer-intro').checkVisibility()`));
  await t.js(`${box}.querySelector('summary').focus()`);
  t.check('the summary takes keyboard focus', await t.js(`document.activeElement === ${box}.querySelector('summary')`));
  await t.key('Enter', 13, '\r');
  t.check('Enter on the summary unfolds it', await t.until(`${box}.open`, 2000));
  await t.key(' ', 32, ' ');
  t.check('Space on the summary folds it again', await t.until(`!${box}.open`, 2000));
  await t.key('Tab', 9);
  t.check('Tab moves on from the summary to the map controls', await t.js("document.activeElement?.id === 'view-districts'"));
  for (const [width, height] of [[375, 812], [1280, 800]]) {
    for (const dark of [false, true]) {
      await t.load('', { width, height, dark });
      const fit = await t.js(`(() => { const d = ${box}.getBoundingClientRect();
        return { open: ${box}.open, inside: d.left >= 0 && d.right <= document.documentElement.clientWidth,
          wide: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          card: getComputedStyle(${box}).backgroundColor === getComputedStyle(document.getElementById('sheet')).backgroundColor }; })()`);
      t.check(`${width}px${dark ? ' dark' : ''}: "How to read this" is open, fits the width and has the card background`,
        fit.open && fit.inside && fit.wide && fit.card, JSON.stringify(fit));
      await t.screenshot(`explainer-${width}${dark ? '-dark' : ''}`);
    }
  }
}

export const GROUPS = [
  { name: 'explainer', run: explainer },
  { name: 'map', run: map },
  { name: 'list', run: list },
  { name: 'sheet', run: sheet },
  { name: 'national', run: national },
  { name: 'method', run: method },
  { name: 'layout', run: layout },
  { name: 'majority', run: majority },
  { name: 'redraws', run: redraws },
  { name: 'competitive', run: competitive },
  { name: 'control', run: control },
  { name: 'senate', run: senate },
];
