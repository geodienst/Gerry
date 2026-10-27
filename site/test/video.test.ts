// The videos: the web copies in site/public/video play from the site itself, load nothing but their posters before the
// reader presses play, and start before the whole file is in. The full-quality copies are release assets on GitHub.
// The page budget of page.test.ts leaves video/ out; these tests set its limits. Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const VIDEO = join(SITE, 'public', 'video');
const html = readFileSync(join(SITE, 'index.html'), 'utf8');
const RELEASE = 'https://github.com/geodienst/Gerry/releases/download/videos-2026-10-27/';

const files = readdirSync(VIDEO).sort();
const webVideos = files.filter((file) => file.endsWith('.mp4'));
const posters = files.filter((file) => file.endsWith('.jpg'));

/** The types of the top-level boxes of an MP4 file, in their order in the file: ftyp, moov, mdat and so on. */
function boxes(path: string): string[] {
  const fd = openSync(path, 'r');
  try {
    const end = fstatSync(fd).size;
    const head = Buffer.alloc(16);
    const types: string[] = [];
    for (let at = 0; at + 8 <= end;) {
      readSync(fd, head, 0, 16, at);
      let size = head.readUInt32BE(0);
      if (size === 1) size = Number(head.readBigUInt64BE(8)); // a 64-bit size after the type
      else if (size === 0) size = end - at; // the box runs to the end of the file
      types.push(head.toString('latin1', 4, 8));
      if (size < 8) break; // not a box: the order so far is all there is
      at += size;
    }
    return types;
  } finally {
    closeSync(fd);
  }
}

/** Width and height of a JPEG, from its first start-of-frame segment. */
function jpegSize(path: string): [number, number] {
  const data = readFileSync(path);
  assert.equal(data.readUInt16BE(0), 0xffd8, `${path} is not a JPEG`);
  for (let at = 2; at + 9 < data.length;) {
    const marker = data.readUInt16BE(at);
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return [data.readUInt16BE(at + 7), data.readUInt16BE(at + 5)];
    }
    at += 2 + data.readUInt16BE(at + 2);
  }
  throw new Error(`${path} has no start-of-frame segment`);
}

/** Each <video> of the page: its attributes, its <source> and the text of the element that names it. */
const players = [...html.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)].map(([, attrs, inner]) => {
  const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
  const label = attr('aria-labelledby');
  return {
    attrs,
    poster: attr('poster'),
    source: /<source\b[^>]*\bsrc="([^"]+)"[^>]*\btype="video\/mp4"/.exec(inner)?.[1],
    name: label ? new RegExp(`id="${label}"[^>]*>([^<]+)<`).exec(html)?.[1] : attr('aria-label'),
  };
});

test('each web video is under 6 MB and has its index (moov) before its media data (mdat)', () => {
  assert.ok(webVideos.length > 0, 'no videos in site/public/video');
  for (const file of webVideos) {
    const path = join(VIDEO, file);
    assert.ok(statSync(path).size < 6_000_000, `${file}: ${statSync(path).size} bytes`);
    const order = boxes(path);
    assert.equal(order[0], 'ftyp', `${file}: ${order.join(' ')}`);
    assert.ok(order.includes('moov') && order.includes('mdat') && order.indexOf('moov') < order.indexOf('mdat'), `${file}: ${order.join(' ')}`);
  }
});

test('each poster is a JPEG of 540 by 960 pixels under 60 KB', () => {
  assert.ok(posters.length > 0, 'no posters in site/public/video');
  for (const file of posters) {
    const path = join(VIDEO, file);
    assert.ok(statSync(path).size < 60_000, `${file}: ${statSync(path).size} bytes`);
    assert.deepEqual(jpegSize(path), [540, 960], file);
  }
});

test('two players, each with controls, preload="none", playsinline, no autoplay, a poster, an MP4 of the site and a name', () => {
  // the teaser ends on the site's address, so it is only a download, not a player on the site itself
  assert.deepEqual(players.map((p) => p.source), ['video/how-house-elections-work-720.mp4', 'video/how-to-rig-a-map-720.mp4']);
  assert.deepEqual(players.map((p) => p.name), ['How House elections work', 'How to rig a map']);
  for (const { attrs, poster, source = '' } of players) {
    assert.match(attrs, /\bcontrols\b/, source);
    assert.match(attrs, /\bpreload="none"/, source);
    assert.match(attrs, /\bplaysinline\b/, source);
    assert.doesNotMatch(attrs, /\bautoplay\b/, source);
    assert.ok(poster && existsSync(join(SITE, 'public', poster)), `${source}: poster ${poster}`);
    assert.ok(existsSync(join(SITE, 'public', source)), source);
  }
});

test('the videos come from the site itself: no frames, embeds or players of other services', () => {
  assert.doesNotMatch(html, /<(?:iframe|embed|object|audio)\b/);
  assert.doesNotMatch(html, /youtube|youtu\.be|vimeo/i);
  // every <source> and poster is a file of the site
  for (const [, url] of html.matchAll(/<(?:source|video)\b[^>]*\b(?:src|poster)="([^"]+)"/g)) {
    assert.match(url, /^video\/[\w-]+\.(mp4|jpg)$/, url);
  }
});

test('each player has the text of its video under it', () => {
  const texts = [...html.matchAll(/<\/video>\s*<details class="why clip-text">\s*<summary>Text in the video<\/summary>([\s\S]*?)<\/details>/g)];
  assert.equal(texts.length, players.length);
  for (const [, body] of texts) assert.ok((body.match(/<p class="note">/g) ?? []).length >= 5, body);
});

test('every download link of a video points at the release videos-2026-10-27', () => {
  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+\.mp4)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ['how-house-elections-work-9x16.mp4', 'how-to-rig-a-map-9x16.mp4', 'the-line-moved-9x16.mp4',
    'the-line-moved-9x16-tv.mp4'].map((file) => `${RELEASE}${file}`));
});

test('the posters of the downloads load when they come into view', () => {
  const images = [...html.matchAll(/<img\b[^>]*\bsrc="video\/[^"]+"[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.length, 3);
  for (const img of images) assert.match(img, /\bloading="lazy"/, img);
});

test('every file in site/public/video is used by the page', () => {
  for (const file of files) assert.ok(html.includes(`video/${file}`), `${file} is not on the page`);
});
