// Small helpers for the sentences and sums of the view models, shared by model.ts, extensions.ts and chapters.ts.
import { seats } from './format.ts';

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** `one` for exactly 1, else `many`: plural(2, 'seat', 'seats') -> "seats". */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** "217 to 229", or one number if both ends are equal. */
export const seatSpan = (lo: number, hi: number): string => (lo === hi ? seats(lo) : `${seats(lo)} to ${seats(hi)}`);

/** "Ohio", "Ohio and Texas", "Iowa, Ohio and Texas". */
export const nameList = (list: readonly string[]): string => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

/** The text with its first letter in upper case, for a phrase that starts a sentence. */
export const capitalize = (text: string): string => `${text[0].toUpperCase()}${text.slice(1)}`;
