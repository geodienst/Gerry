// The Share dialogs of chapter 01 and of the map in chapter 02. The button opens one over the page with the image of
// what is on screen, as large as the screen allows, and the ways to share it: the link, the image as a file, the image
// through the device's share sheet (only where that takes files, as on a phone), the caption with the link and, by the
// map, the data as CSV. Close, Escape or a click beside the dialog closes it. No outside services.
import { download } from './graphics.ts';
import { copy } from './share.ts';
import type { CsvFile } from '../lib/csv.ts';

interface ShareBoxOptions {
  button: HTMLButtonElement;
  box: HTMLDialogElement;
  /** draw the image on the dialog's canvas; returns its file name and caption */
  draw: (canvas: HTMLCanvasElement) => { file: string; caption: string };
  /** the link to what is on screen */
  link: () => string;
  /** the file behind Download data, null where there is none */
  data?: () => CsvFile | null;
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

export function createShareBox({ button, box, draw, link, data }: ShareBoxOptions) {
  const canvas = box.querySelector('canvas')!;
  const action = (name: string) => box.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
  // Everything the dialog shares is fixed when it opens, so the link, the text and the data always go with the image,
  // also when the page changes under the dialog (the explainer of chapter 01 plays on; Back in the browser).
  interface Shown { file: string; caption: string; link: string; csv: CsvFile | null; png: Promise<File | null> }
  let shown: Shown | null = null;
  const text = (s: Shown) => `${s.caption} ${s.link}`;
  action('share')!.hidden = !sharesFiles();

  function open() {
    const image = draw(canvas);
    const png = new Promise<File | null>((done) => {
      canvas.toBlob((blob) => done(blob && new File([blob], image.file, { type: 'image/png' })), 'image/png');
    });
    shown = { ...image, link: link(), csv: data?.() ?? null, png };
    const dataButton = action('data');
    if (dataButton) dataButton.hidden = !shown.csv;
    box.showModal();
    button.setAttribute('aria-expanded', 'true');
  }
  const close = () => { if (box.open) box.close(); };
  box.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false');
    button.focus({ preventScroll: true });
  });

  button.addEventListener('click', open);
  action('close')!.addEventListener('click', close);
  // a click on the backdrop lands on the dialog itself, outside its inner box
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  // Escape closes the dialog and nothing else: the map's own Escape (back to all states) sees defaultPrevented
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !box.open) return;
    e.preventDefault();
    close();
  });
  action('link')!.addEventListener('click', () => { if (shown) void copy(shown.link, 'Link copied'); });
  action('download')!.addEventListener('click', () => { if (shown) download(canvas, shown.file); });
  // The file of this opening, as soon as it is made (well within the time a click allows a share sheet); a file of an
  // earlier opening is never sent, since each opening has its own.
  action('share')!.addEventListener('click', () => {
    const s = shown;
    if (!s) return;
    void s.png.then((file) => {
      if (!file || s !== shown || !box.open) return;
      navigator.share({ files: [file], text: text(s) }).catch(() => { /* the reader closed the share sheet */ });
    });
  });
  action('text')!.addEventListener('click', () => { if (shown) void copy(text(shown), 'Text copied'); });
  action('data')?.addEventListener('click', () => { if (shown?.csv) save(shown.csv.file, shown.csv.text, 'text/csv'); });
}
