// The Share panels of chapter 01 and of the map in chapter 02. The button opens one with the image of what is on
// screen, as it will be shared, and the ways to share: the link, the image as a file, the image through the device's
// share sheet (only where that takes files, as on a phone), the caption with the link and, under the map, the data as
// CSV. Escape, a click outside or the button again closes it. No outside services.
import { download } from './graphics.ts';
import { copy } from './share.ts';
import type { CsvFile } from '../lib/csv.ts';

interface ShareBoxOptions {
  button: HTMLButtonElement;
  box: HTMLElement;
  /** draw the image on the panel's canvas; returns its file name and caption */
  draw: (canvas: HTMLCanvasElement) => { file: string; caption: string };
  /** the link to what is on screen */
  link: () => string;
  /** the file behind Download data, null where there is none */
  data?: () => CsvFile | null;
  /** set the panel's place under the button from a script, for a panel that does not sit in the button's own box */
  place?: boolean;
}

/** Whether the share sheet of this device takes an image file. */
function sharesFiles(): boolean {
  try {
    return navigator.canShare?.({ files: [new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })] }) ?? false;
  } catch {
    return false;
  }
}

/** Save `text` as a file with this name. */
function save(file: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function createShareBox({ button, box, draw, link, data, place = false }: ShareBoxOptions) {
  const canvas = box.querySelector('canvas')!;
  const action = (name: string) => box.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
  let shown = { file: '', caption: '' };
  // made when the panel opens, so the share sheet opens at once on the click (a phone allows it only then)
  let file: File | null = null;
  const text = () => `${shown.caption} ${link()}`;
  action('share')!.hidden = !sharesFiles();

  /** Under the button, its right edge on the button's right edge, in the box the panel is placed in. */
  function setPlace() {
    const host = box.offsetParent as HTMLElement | null;
    if (!host) return;
    const b = button.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    box.style.top = `${b.bottom - h.top + host.scrollTop + 6}px`;
    box.style.right = `${Math.max(0, h.right - b.right - (host.offsetWidth - host.clientWidth))}px`;
  }
  function open() {
    shown = draw(canvas);
    file = null;
    canvas.toBlob((blob) => { if (blob) file = new File([blob], shown.file, { type: 'image/png' }); }, 'image/png');
    const csv = data?.();
    const dataButton = action('data');
    if (dataButton) dataButton.hidden = !csv;
    box.hidden = false;
    if (place) setPlace();
    button.setAttribute('aria-expanded', 'true');
    box.focus(); // the panel itself, so a click shows no focus ring; Tab goes on to its buttons
  }
  function close(refocus: boolean) {
    if (box.hidden) return;
    box.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  }

  button.addEventListener('click', () => { if (box.hidden) open(); else close(false); });
  // Escape closes the panel and nothing else: the map's own Escape (back to all states) sees defaultPrevented
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || box.hidden) return;
    e.preventDefault();
    close(box.contains(document.activeElement));
  });
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as Node;
    if (!box.contains(target) && !button.contains(target)) close(false);
  });
  if (place) {
    window.addEventListener('resize', () => { if (!box.hidden) setPlace(); });
    // a scroll of the column beside the map moves the button away from the panel
    document.addEventListener('scroll', (e) => { if (e.target !== document && (e.target as Node).contains(button)) close(false); }, true);
  }
  action('link')!.addEventListener('click', () => { void copy(link(), 'Link copied'); });
  action('download')!.addEventListener('click', () => download(canvas, shown.file));
  action('share')!.addEventListener('click', () => {
    if (!file) return;
    navigator.share({ files: [file], text: text() }).catch(() => { /* the reader closed the share sheet */ });
  });
  action('text')!.addEventListener('click', () => { void copy(text(), 'Text copied'); });
  action('data')?.addEventListener('click', () => {
    const csv = data?.();
    if (csv) save(csv.file, csv.text, 'text/csv');
  });
}
