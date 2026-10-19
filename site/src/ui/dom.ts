// DOM helpers shared by the modules that draw the page.
export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number | boolean>;

/** The element with this id; throws when the page has none, so a renamed id fails at once. */
export function byId<T extends Element = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from the page`);
  return el as unknown as T;
}

/** An HTML element with attributes and, if given, text. */
export function node<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, text: string | null = null): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  if (text !== null) el.textContent = text;
  return el;
}

/** An SVG element with attributes and, if given, text. */
export function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, text: string | null = null): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  if (text !== null) el.textContent = text;
  return el;
}
