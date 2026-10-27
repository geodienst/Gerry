// The explainer at the top of chapter 01: a few steps that play by
// themselves once the chapter is in view and drive the rows, the waffle and the slider. Pause, Next and Skip while it plays,
// as symbols on one line with the text; at rest, before and after, Play or Replay beside Watch the video, which opens the
// explainer video in a dialog. A click on a row or a move of the slider hands the controls to the reader. With reduced motion it
// waits for Play. Texts come from lib/chapters.ts (outcomesView().tour); this module only plays them.
// ?notour leaves the explainer out (the site checks use it); ?tourms=N sets the time per step in milliseconds.
// A shared link to the chapter (?count=neutral&vote=49.2) keeps its row and vote share: the explainer then waits for Play.
import { stepTime } from '../lib/tour.ts';
import { byId as $ } from './dom.ts';
import type { OutcomesControl } from './outcomes.ts';
import type { OutcomesView } from '../lib/chapters.ts';

/** The parts of chapter 01 the explainer drives. */
type Driven = Pick<OutcomesControl, 'select' | 'moveTo' | 'onUser'>;

/**
 * @param tour outcomesView(results).tour
 * @param hold a shared link set the chapter, so do not play by itself
 */
export function createTour(tour: OutcomesView['tour'], outcomes: Driven, { reduceMotion, hold = false }: { reduceMotion: () => boolean; hold?: boolean }) {
  const box = $('tour');
  const params = new URLSearchParams(window.location.search);
  if (params.has('notour')) {
    box.hidden = true;
    return;
  }
  const fixed = Number(params.get('tourms')) || 0;
  const text = $('tour-text');
  const count = $('tour-count');
  const play = $<HTMLButtonElement>('tour-play');
  const ahead = $<HTMLButtonElement>('tour-next');
  const skip = $<HTMLButtonElement>('tour-skip');
  const watchVideo = $<HTMLButtonElement>('tour-video');
  openVideo(watchVideo);
  let step = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let state: 'idle' | 'playing' | 'paused' | 'done' = 'idle';

  function show(i: number) {
    step = i;
    const s = tour.steps[i];
    outcomes.select(s.key, true);
    outcomes.moveTo(s.index);
    text.textContent = s.text;
    count.textContent = `${i + 1} / ${tour.steps.length}`;
  }
  function next() {
    if (step + 1 < tour.steps.length) {
      show(step + 1);
      timer = setTimeout(next, stepTime(tour.steps[step].text, fixed));
    } else {
      finish(true);
    }
  }
  // While it plays the text keeps the height of its longest step, so the rows and the slider under it stay in place.
  function holdHeight() {
    text.style.minHeight = '';
    let tallest = 0;
    for (const s of tour.steps) {
      text.textContent = s.text;
      tallest = Math.max(tallest, text.offsetHeight);
    }
    text.style.minHeight = `${tallest}px`;
  }
  function start() {
    box.classList.remove('done');
    state = 'playing';
    label(play, 'Pause', 'pause');
    watchVideo.hidden = true;
    ahead.hidden = false;
    skip.hidden = false;
    holdHeight();
    step = -1;
    next();
  }
  function pause() {
    state = 'paused';
    clearTimeout(timer);
    label(play, 'Play', 'play');
  }
  function resume() {
    state = 'playing';
    label(play, 'Pause', 'pause');
    step -= 1; // the step that was paused starts again
    next();
  }
  // At the end or on Skip the chapter returns to the enacted maps at the 2016 and 2020 votes; when the reader takes
  // over, their choice stays.
  function finish(restore: boolean) {
    clearTimeout(timer);
    state = 'done';
    if (restore) {
      outcomes.select('enacted', true);
      outcomes.moveTo(tour.base);
    }
    text.textContent = tour.end;
    text.style.minHeight = '';
    count.textContent = '';
    label(play, 'Replay');
    box.classList.add('done'); // a slim line: only the two buttons stay
    watchVideo.hidden = false;
    ahead.hidden = true;
    skip.hidden = true;
  }

  play.addEventListener('click', () => {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    else start();
  });
  // Next shows the following step at once; while paused it stays paused there.
  ahead.addEventListener('click', () => {
    clearTimeout(timer);
    if (state === 'playing') next();
    else if (step + 1 < tour.steps.length) show(step + 1);
    else finish(true);
  });
  skip.addEventListener('click', () => finish(true));
  outcomes.onUser(() => { if (state === 'playing' || state === 'paused') finish(false); });

  text.textContent = tour.intro;
  const chapter = document.querySelector('#outcomes .outcomes');
  if (!chapter || !('IntersectionObserver' in window)) return;
  // Out of view it pauses, so it does not play on while the reader is further down the page.
  new IntersectionObserver((entries) => {
    if (state === 'playing' && entries.every((e) => !e.isIntersecting)) pause();
  }).observe(chapter);
  if (hold || reduceMotion()) return;
  // Play once the rows and the waffle are in view, the first time only.
  const watch = new IntersectionObserver((entries) => {
    if (state === 'idle' && entries.some((e) => e.isIntersecting)) {
      watch.disconnect();
      start();
    }
  }, { threshold: 0.3 });
  watch.observe(chapter);
}

/** A tour button as a word (Play, Replay) or, while the tour runs, as a symbol that keeps its word for screen readers. */
function label(button: HTMLButtonElement, word: string, icon?: 'play' | 'pause') {
  button.classList.toggle('icon', Boolean(icon));
  if (icon) {
    button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#icon-${icon}"/></svg><span class="visually-hidden">${word}</span>`;
    button.title = word;
  } else {
    button.textContent = word;
    button.removeAttribute('title');
  }
}

/**
 * Watch the video opens the explainer video in a dialog and plays it, as the reader asked for it. Escape, the close
 * cross and a click beside the video close it; closing pauses the video and gives the focus back to the button.
 */
function openVideo(button: HTMLButtonElement) {
  const dialog = $<HTMLDialogElement>('explainer');
  const video = dialog.querySelector('video');
  if (!video) return;
  button.addEventListener('click', () => {
    dialog.showModal();
    video.play().catch(() => { /* the controls stay for the reader to start it */ });
  });
  $<HTMLButtonElement>('explainer-close').addEventListener('click', () => dialog.close());
  // the dialog itself is only hit beside its box, on the backdrop
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    video.pause();
    button.focus();
  });
}
