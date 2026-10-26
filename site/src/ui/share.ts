// Share: the device's share sheet where there is one, else the link goes to the clipboard
// with a short note. No outside services.

/** A short note at the bottom of the screen, such as "Link copied". */
export function notify(text: string) {
  const note = document.createElement('p');
  note.className = 'share-note';
  note.setAttribute('role', 'status');
  note.textContent = text;
  // in an open Share dialog, which lies over the page, else over the map in full screen or the page
  (document.querySelector('dialog[open]') ?? document.fullscreenElement ?? document.body).append(note);
  setTimeout(() => note.remove(), 2000);
}

/** Copy `text` to the clipboard and say so with `note`. Without a clipboard nothing happens. */
export async function copy(text: string, note: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    notify(note);
  } catch { /* no clipboard */ }
}

export async function share(url: string): Promise<void> {
  try {
    if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    notify('Link copied');
  } catch { /* the reader closed the share sheet */ }
}
