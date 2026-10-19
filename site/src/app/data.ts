// The two data files of the page, written by pipeline/04_export.py into site/public/data/. They are the only requests
// the page makes; d3 and topojson-client are bundled into the page script.
import type { MapTopology, Results } from '../types.ts';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json() as Promise<T>;
}

export interface PageData {
  results: Results;
  topology: MapTopology;
}

/** Both files, or null after writing the reason into `errorBox` (a page opened as a file cannot fetch). */
export async function loadData(errorBox: HTMLElement): Promise<PageData | null> {
  try {
    const [results, topology] = await Promise.all([getJson<Results>('data/results.json'), getJson<MapTopology>('data/map.topojson')]);
    return { results, topology };
  } catch (error) {
    errorBox.textContent = `The map data did not load (${error instanceof Error ? error.message : String(error)}). `
      + 'Open the page through a web server, for example with pnpm dev or pnpm preview, not as a file.';
    errorBox.hidden = false;
    return null;
  }
}
