// Headless check of the site in Edge or Chrome over the DevTools protocol, without extra packages.
// The checks themselves are in tools/site_checks.mjs, one group per task of the site plan.
//
//   node tools/check_site.mjs                             serves site/ itself on 127.0.0.1
//   node tools/check_site.mjs --url http://127.0.0.1:8000/   checks a running server (make serve)
//   node tools/check_site.mjs --only map,sheet            runs only these groups
//   node tools/check_site.mjs --shots <folder>            writes full-page screenshots for a person to look at
//
// The browser is the environment variable BROWSER, or else the first of Edge and Chrome in their
// usual places. Exit code 0 when every check passes, 1 otherwise.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from './site_checks.mjs';

const SITE = resolve(fileURLToPath(new URL('../site/', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.topojson': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const BROWSERS = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge',
].filter(Boolean);
const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

/** A static server for site/, so the check needs no other process. */
function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(SITE, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(SITE + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
  });
  return new Promise((done) => { server.listen(0, '127.0.0.1', () => done(server)); });
}

/** Start the browser headless and connect to it. */
async function launch() {
  const exe = BROWSERS.find((path) => existsSync(path));
  if (!exe) throw new Error('No Edge or Chrome found; set BROWSER to the path of one');
  const profile = mkdtempSync(join(tmpdir(), 'site-check-'));
  // Without __COMPAT_LAYER (Git Bash sets it), Edge does not relaunch itself, so `child` is the browser
  // and child.kill() stops it even when launching fails before DevTools answers.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toUpperCase() !== '__COMPAT_LAYER'));
  const child = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: 'ignore', env });
  let ws = null;
  const close = async () => {
    // Ask the browser itself to quit. When Edge relaunches itself (as it does with __COMPAT_LAYER set),
    // `child` is a stub that has already exited, and child.kill() alone would leave the browser running.
    if (ws?.readyState === WebSocket.OPEN) {
      await new Promise((done) => {
        const timer = setTimeout(done, 5000);
        ws.addEventListener('close', () => { clearTimeout(timer); done(); });
        ws.send(JSON.stringify({ id: 0, method: 'Browser.close' }));
      });
    }
    ws?.close();
    child.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* left for the OS */ }
  };
  try {
    // The browser writes its port to DevToolsActivePort; the file can be locked while it writes.
    let lines = [];
    for (let i = 0; i < 150 && lines.length < 2; i += 1) {
      await sleep(100);
      try { lines = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n').filter(Boolean); } catch { lines = []; }
    }
    if (lines.length < 2) throw new Error(`${exe} opened no DevTools port`);
    ws = new WebSocket(`ws://127.0.0.1:${lines[0]}${lines[1]}`);
    await new Promise((done, fail) => { ws.onopen = done; ws.onerror = fail; });
  } catch (error) {
    await close();
    throw error;
  }
  return { ws, close };
}

/** One tab with its own session; `on` holds the event listeners. */
async function openTab(ws) {
  let next = 1;
  const pending = new Map();
  const on = {};
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const { done, fail } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) fail(new Error(data.error.message)); else done(data.result);
    } else if (data.method && on[data.method]) on[data.method](data.params);
  };
  const send = (method, params = {}, sessionId = undefined) => new Promise((done, fail) => {
    const id = next++;
    pending.set(id, { done, fail });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const tab = (method, params) => send(method, params, sessionId);
  for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await tab(`${domain}.enable`);
  return { tab, on };
}

async function main() {
  const only = option('--only')?.split(',');
  const shots = option('--shots');
  const server = option('--url') ? null : await serve();
  const base = option('--url') ?? `http://127.0.0.1:${server.address().port}/`;
  const origin = new URL(base).origin;
  const browser = await launch();
  const { tab, on } = await openTab(browser.ws).catch(async (error) => { await browser.close(); throw error; });
  const requests = [];
  const errors = [];
  on['Network.requestWillBeSent'] = (p) => requests.push(p.request.url);
  on['Runtime.consoleAPICalled'] = (p) => { if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' ')); };
  on['Runtime.exceptionThrown'] = (p) => errors.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text);
  on['Log.entryAdded'] = (p) => { if (p.entry.level === 'error') errors.push(`${p.entry.text} ${p.entry.url ?? ''}`); };

  let failed = 0;
  let total = 0;
  const js = async (expression) => {
    const r = await tab('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression}\n${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const t = {
    /** A DevTools command for the page, such as Input.dispatchTouchEvent. */
    tab,
    sleep,
    js,
    check(name, ok, detail = '') {
      total += 1;
      if (!ok) failed += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
    },
    async until(expression, ms = 10000) {
      for (let waited = 0; waited < ms; waited += 100) {
        if (await js(expression)) return true;
        await sleep(100);
      }
      return false;
    },
    text: (selector) => js(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`),
    /**
     * Open the page at `hash` with a window size and media features; waits until the map is drawn. `query` goes before
     * the hash: by default ?notour, so the explainer of chapter 01 does not play while the other checks run.
     */
    async load(hash = '', { width = 1280, height = 800, dark = false, reduce = false, query = 'notour' } = {}) {
      await tab('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
      await tab('Emulation.setEmulatedMedia', { features: [
        { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
        { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
      ] });
      // A URL that differs from the current one only after # is a same-document navigation, which
      // keeps the old page; leave it first so every load starts fresh.
      await tab('Page.navigate', { url: 'about:blank' });
      await tab('Page.navigate', { url: `${base}${query ? `?${query}` : ''}${hash}` });
      await sleep(300);
      return this.until("document.querySelectorAll('#map path.district').length > 0 && document.querySelector('#map > g') !== null");
    },
    /** Viewport point at the center of the element that `expression` returns, after scrolling it into view. */
    center: (expression) => js(`(() => { const el = ${expression}; el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`),
    mouse: (type, { x, y }, extra = {}) => tab('Input.dispatchMouseEvent', { type, x, y, ...extra }),
    async click(point) {
      await this.mouse('mousePressed', point, { button: 'left', clickCount: 1 });
      await this.mouse('mouseReleased', point, { button: 'left', clickCount: 1 });
    },
    async key(key, code, text = undefined) {
      await tab('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, text });
      await tab('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
    },
    async screenshot(name, { viewport = false } = {}) {
      if (!shots) return;
      mkdirSync(shots, { recursive: true });
      const { cssContentSize: content, cssLayoutViewport: view } = await tab('Page.getLayoutMetrics');
      const size = viewport ? { width: view.clientWidth, height: view.clientHeight } : content;
      const at = viewport ? { x: view.pageX, y: view.pageY } : { x: 0, y: 0 }; // the screen where it is scrolled to
      const { data } = await tab('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: at.x, y: at.y, width: size.width, height: size.height, scale: 1 } });
      writeFileSync(join(shots, `${name}.png`), Buffer.from(data, 'base64'));
    },
  };

  try {
    for (const group of GROUPS) {
      if (only && !only.includes(group.name)) continue;
      console.log(`-- ${group.name}`);
      await group.run(t);
    }
    console.log('-- requests and console');
    const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && url !== 'about:blank');
    t.check('no requests to other hosts', foreign.length === 0, foreign.join(' '));
    t.check('no errors in the console', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server?.close();
  }
  console.log(`\n${total} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
