// The Share panel of chapter 01. The button opens it with the image of the three counts at the vote share on screen,
// as it will be shared, and the ways to share: the link to this row and vote share, the image as a file, the image
// through the device's share sheet (only where that takes files, as on a phone) and the caption with the link.
// Escape, a click outside or the button again closes it. No outside services.
import { download, drawNational } from './graphics.ts';
import { copy } from './share.ts';
import type { NationalGraphic } from '../lib/graphics.ts';
import type { Colors } from '../lib/colors.ts';

interface ShareBoxOptions {
  button: HTMLButtonElement;
  box: HTMLElement;
  /** the image at the vote share on screen */
  graphic: () => NationalGraphic;
  /** the link to the row and vote share on screen */
  link: () => string;
  /** the scales of the palette chosen under the map, in the light colors of the images */
  colors: () => Colors;
}

/** Whether the share sheet of this device takes an image file. */
function sharesFiles(): boolean {
  try {
    return navigator.canShare?.({ files: [new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })] }) ?? false;
  } catch {
    return false;
  }
}

export function createShareBox({ button, box, graphic, link, colors }: ShareBoxOptions) {
  const canvas = box.querySelector('canvas')!;
  const action = (name: string) => box.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  let shown = graphic();
  // made when the panel opens, so the share sheet opens at once on the click (a phone allows it only then)
  let file: File | null = null;
  const text = () => `${shown.caption} ${link()}`;
  action('share').hidden = !sharesFiles();

  function open() {
    shown = graphic();
    drawNational(canvas, shown, colors());
    file = null;
    canvas.toBlob((blob) => { if (blob) file = new File([blob], shown.file, { type: 'image/png' }); }, 'image/png');
    box.hidden = false;
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(!box.hidden && box.contains(document.activeElement)); });
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as Node;
    if (!box.contains(target) && !button.contains(target)) close(false);
  });
  action('link').addEventListener('click', () => { void copy(link(), 'Link copied'); });
  action('download').addEventListener('click', () => download(canvas, shown.file));
  action('share').addEventListener('click', () => {
    if (!file) return;
    navigator.share({ files: [file], text: text() }).catch(() => { /* the reader closed the share sheet */ });
  });
  action('text').addEventListener('click', () => { void copy(text(), 'Text copied'); });
}
