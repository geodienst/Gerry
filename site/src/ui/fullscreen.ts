// Full screen for the map, the block under it and the sheet: the browser's full screen where
// the page may use it, otherwise the map column covers the window (.is-full). The same button or Escape goes back.

export interface FullScreen {
  /** The atlas fills the screen, either way. */
  isFull(): boolean;
  /** Back from either kind of full screen. */
  leave(): void;
  /** The atlas covers the window without the browser's full screen; Escape is then the page's to handle. */
  covers(): boolean;
}

/**
 * @param atlas the map, the block under it and the sheet beside it
 * @param button the toggle in the zoom bar
 * @param onChange called after every change, to lay out the sheet again
 */
export function createFullScreen(atlas: HTMLElement, button: HTMLButtonElement, onChange: () => void): FullScreen {
  const isFull = () => document.fullscreenElement === atlas || atlas.classList.contains('is-full');
  const covers = () => atlas.classList.contains('is-full');
  const show = () => {
    onChange();
    const on = isFull();
    const label = on ? 'Exit full screen' : 'Full screen';
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', label);
    button.title = label;
    document.body.classList.toggle('map-full', covers());
  };
  const leave = () => {
    if (document.fullscreenElement === atlas) document.exitFullscreen().catch(() => {});
    atlas.classList.remove('is-full');
    show();
  };
  button.addEventListener('click', async () => {
    if (isFull()) { leave(); return; }
    try {
      if (!atlas.requestFullscreen) throw new Error('no full screen here');
      await atlas.requestFullscreen();
    } catch {
      atlas.classList.add('is-full');
    }
    show();
    button.focus();
  });
  document.addEventListener('fullscreenchange', show);
  return { isFull, leave, covers };
}
