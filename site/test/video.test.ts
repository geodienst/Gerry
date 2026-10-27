// The videos: the section Videos above Graphics to reuse, with three players in the owner's order. The web copies in
// site/public/video play from the site itself, load nothing but their posters before the reader presses play, and
// start before the whole file is in. The full-quality copies are release assets on GitHub. The page budget of
// page.test.ts leaves the MP4 files out; these tests set their limits. Run with: pnpm test
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

/** The section Videos, from its opening tag to its end. */
const section = /<section class="videos" id="videos"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';

/** Each video of the section: its title, length, player, download links and the text in the video. */
const cards = [...section.matchAll(/<div class="vcard" id="([\w-]+)">([\s\S]*?)<\/details>\s*<\/div>/g)].map(([, id, body]) => {
  const video = /<video\b([^>]*)>([\s\S]*?)<\/video>/.exec(body);
  const attrs = video?.[1] ?? '';
  const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
  const label = attr('aria-labelledby');
  return {
    id,
    title: /<h3 id="([\w-]+)">([^<]+)<\/h3>/.exec(body),
    time: /<time datetime="([^"]+)">([^<]+)<\/time>/.exec(body)?.slice(1),
    attrs,
    poster: attr('poster'),
    source: /<source\b[^>]*\bsrc="([^"]+)"[^>]*\btype="video\/mp4"/.exec(video?.[2] ?? '')?.[1],
    name: label ? new RegExp(`id="${label}"[^>]*>([^<]+)<`).exec(html)?.[1] : undefined,
    links: [...body.matchAll(/<a class="sharebtn" href="([^"]+)">[\s\S]*?<\/svg>([^<]+)<\/a>/g)].map(([, href, text]) => [text, href]),
    text: /<details class="why">\s*<summary>Text in the video<\/summary>([\s\S]*)$/.exec(body)?.[1] ?? '',
    after: video ? body.slice(video.index + video[0].length) : '',
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

test('the section Videos stands right above Graphics to reuse, and the byline links to it after Methodology', () => {
  assert.match(html, /<\/section>\s*<section class="videos" id="videos" aria-labelledby="videos-title">[\s\S]*?<\/section>\s*<section class="graphics" id="graphics"/);
  assert.match(section, /<h2 id="videos-title">Videos<\/h2>\s*<p class="intro">Three short videos to watch and share\.<\/p>/);
  assert.match(html, /<p class="byline"><span>[\s\S]*?<\/span><a href="#method">Methodology<\/a><a href="#videos">Videos<\/a><\/p>/);
});

test('three videos in the order teaser, explainer, How to rig a map, each with its title and length', () => {
  assert.deepEqual(cards.map((c) => [c.id, c.title?.[2], ...(c.time ?? [])]), [
    ['video-teaser', 'The Line Moved', 'PT57S', '0:57'],
    ['video-house', 'How House elections work', 'PT1M40S', '1:40'],
    ['video-rig', 'How to rig a map', 'PT1M7S', '1:07'],
  ]);
  // the players are the only ones on the page
  assert.equal((html.match(/<video\b/g) ?? []).length, cards.length);
});

test('each player has controls, preload="none", playsinline, no autoplay, a poster, an MP4 of the site and its title as name', () => {
  assert.deepEqual(cards.map((c) => c.source), ['video/1-somevotes-teaser-720.mp4', 'video/2-somevotes-house-elections-explainer-720.mp4',
    'video/3-somevotes-how-to-rig-a-map-720.mp4']);
  assert.deepEqual(cards.map((c) => c.poster), ['video/1-somevotes-teaser-poster.jpg', 'video/2-somevotes-house-elections-explainer-poster.jpg',
    'video/3-somevotes-how-to-rig-a-map-poster.jpg']);
  for (const { attrs, poster = '', source = '', name, title } of cards) {
    assert.match(attrs, /\bcontrols\b/, source);
    assert.match(attrs, /\bpreload="none"/, source);
    assert.match(attrs, /\bplaysinline\b/, source);
    assert.doesNotMatch(attrs, /\bautoplay\b/, source);
    assert.ok(existsSync(join(SITE, 'public', poster)), `${source}: poster ${poster}`);
    assert.ok(existsSync(join(SITE, 'public', source)), source);
    assert.equal(name, title?.[2], source);
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

test('under each player Download MP4 from the release videos-2026-10-27, for the teaser also Download MP4 for TV', () => {
  assert.deepEqual(cards.map((c) => c.links), [
    [['Download MP4', `${RELEASE}1-somevotes-teaser-9x16-v6.2.mp4`], ['Download MP4 for TV', `${RELEASE}1-somevotes-teaser-9x16-v6.2-tv.mp4`]],
    [['Download MP4', `${RELEASE}2-somevotes-house-elections-explainer-9x16-v2.8.mp4`]],
    [['Download MP4', `${RELEASE}3-somevotes-how-to-rig-a-map-9x16-v2.1.mp4`]],
  ]);
  // these are all the links to video files on the page: Graphics to reuse has none of its own
  assert.equal([...html.matchAll(/<a\b[^>]*\bhref="[^"]+\.mp4"/g)].length, 4);
});

test('each video has the text in the video under its buttons', () => {
  assert.equal(cards.length, 3);
  for (const { id, text, after } of cards) {
    assert.match(after, /^\s*<div class="gbar">[\s\S]*?<\/div>\s*<details class="why">/, id);
    assert.ok((text.match(/<p class="note">/g) ?? []).length >= 5, id);
  }
});

test('every file in site/public/video is used by the page', () => {
  for (const file of files) assert.ok(html.includes(`video/${file}`), `${file} is not on the page`);
});
