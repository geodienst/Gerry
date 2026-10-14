// The explainer at the top of chapter 01 (Mark Thompson's feedback, October 12, 2026): a few steps that play by
// themselves once the chapter is in view and drive the rows, the waffle and the slider. Pause and Skip while it plays,
// Replay afterwards. A click on a row or a move of the slider hands the controls to the reader. With reduced motion it
// waits for Play. Texts come from chapters.js (outcomesView().tour); this module only plays them.
// ?notour leaves the explainer out (the site checks use it); ?tourms=N sets the time per step in milliseconds.
// A shared link to the chapter (?count=neutral&vote=49.2) keeps its row and vote share: the explainer then waits for Play.
const $ = (id) => document.getElementById(id);

/** Reading time for one step: about 20 characters a second plus a pause, at most 11 seconds. */
export function stepTime(text, fixed = 0) {
  return fixed > 0 ? fixed : Math.min(11000, 1500 + 50 * text.length);
}

/**
 * @param {object} tour outcomesView(results).tour
 * @param {{select(key: string, animate?: boolean): void, moveTo(index: number): void, onUser(fn: () => void): void}} outcomes
 * @param {{reduceMotion: () => boolean, hold?: boolean}} o hold: a shared link set the chapter, so do not play by itself
 */
export function createTour(tour, outcomes, { reduceMotion, hold = false }) {
  const box = $('tour');
  const params = new URLSearchParams(window.location.search);
  if (params.has('notour')) {
    box.hidden = true;
    return;
  }
  const fixed = Number(params.get('tourms')) || 0;
  const text = $('tour-text');
  const count = $('tour-count');
  const play = $('tour-play');
  const skip = $('tour-skip');
  const bar = $('tour-progress');
  let step = -1;
  let timer = null;
  let state = 'idle'; // idle, playing, paused or done

  function progress(ms) {
    bar.style.animation = 'none';
    void bar.offsetWidth; // restart the animation
    bar.style.animation = `tourbar ${ms}ms linear forwards`;
  }
  function show(i) {
    step = i;
    const s = tour.steps[i];
    outcomes.select(s.key, true);
    outcomes.moveTo(s.index);
    text.textContent = s.text;
    count.textContent = `${i + 1} / ${tour.steps.length}`;
    progress(stepTime(s.text, fixed));
  }
  function next() {
    if (step + 1 < tour.steps.length) {
      show(step + 1);
      timer = setTimeout(next, stepTime(tour.steps[step].text, fixed));
    } else {
      finish(true);
    }
  }
  function start() {
    box.classList.remove('done');
    state = 'playing';
    play.textContent = 'Pause';
    skip.hidden = false;
    step = -1;
    next();
  }
  function pause() {
    state = 'paused';
    clearTimeout(timer);
    play.textContent = 'Play';
    bar.style.animationPlayState = 'paused';
  }
  function resume() {
    state = 'playing';
    play.textContent = 'Pause';
    step -= 1; // the step that was paused starts again
    next();
  }
  // At the end or on Skip the chapter returns to the enacted maps at the 2016 and 2020 votes; when the reader takes
  // over, their choice stays.
  function finish(restore) {
    clearTimeout(timer);
    state = 'done';
    if (restore) {
      outcomes.select('enacted', true);
      outcomes.moveTo(tour.base);
    }
    text.textContent = tour.end;
    count.textContent = '';
    play.textContent = 'Replay';
    box.classList.add('done'); // a slim line: only the button stays
    skip.hidden = true;
    bar.style.animation = 'none';
  }

  play.addEventListener('click', () => {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    else start();
  });
  skip.addEventListener('click', () => finish(true));
  outcomes.onUser(() => { if (state === 'playing' || state === 'paused') finish(false); });

  text.textContent = tour.intro;
  if (hold || reduceMotion() || !('IntersectionObserver' in window)) return;
  // Play once the rows and the waffle are in view, the first time only.
  const watch = new IntersectionObserver((entries) => {
    if (state === 'idle' && entries.some((e) => e.isIntersecting)) {
      watch.disconnect();
      start();
    }
  }, { threshold: 0.3 });
  watch.observe(document.querySelector('#outcomes .outcomes'));
}
