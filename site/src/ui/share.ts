// Share (owner, October 14, 2026): the device's share sheet where there is one, else the link goes to the clipboard
// with a short note. No outside services.

export async function share(url: string): Promise<void> {
  try {
    if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    const note = document.createElement('p');
    note.className = 'share-note';
    note.setAttribute('role', 'status');
    note.textContent = 'Link copied';
    (document.fullscreenElement || document.body).append(note);
    setTimeout(() => note.remove(), 2000);
  } catch { /* the reader closed the share sheet */ }
}
