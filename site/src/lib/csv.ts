// The data behind the Share panel of chapter 02 as CSV files: the districts of one state on the 2016 and 2020 votes,
// or the three counts of every state. A header row, then one line per district or state.
import { effect } from './format.ts';
import { slug } from './graphics.ts';
import { districtLabel, STATUS_LABELS } from './model.ts';
import type { Postal, Results } from '../types.ts';

export interface CsvFile { file: string; text: string }

const cell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const table = (rows: (string | number)[][]): string => rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';

/** The districts of a state with more than one seat, in order of their number; null for a state with one seat. */
export function stateCsv(results: Results, postal: Postal): CsvFile | null {
  const s = results.states[postal];
  if (!s) return null;
  const districts = [...s.districts].sort((a, b) => Number.parseInt(a.id.slice(2), 10) - Number.parseInt(b.id.slice(2), 10));
  return {
    file: `somevotes-${slug(s.name)}-districts.csv`,
    text: table([
      ['district', 'democratic_votes_2016_2020', 'republican_votes_2016_2020', 'democratic_share'],
      ...districts.map((d) => [districtLabel(d.id, postal), d.d, d.r, d.share.toFixed(4)]),
    ]),
  };
}

/** Every state with more than one seat: its seats, legal status and the three counts on the 2016 and 2020 votes. */
export function statesCsv(results: Results): CsvFile {
  const states = Object.entries(results.states).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'en'));
  return {
    file: 'somevotes-states.csv',
    text: table([
      ['state', 'postal', 'seats', 'status', 'democratic_share', 'vote_proportional', 'neutral_median', 'neutral_p5',
        'neutral_p95', 'enacted', 'geographic_effect', 'drawing_effect'],
      ...states.map(([postal, s]) => [s.name, postal, s.seats, STATUS_LABELS[s.status], s.d_share.toFixed(4), s.proportional,
        s.neutral.median, s.neutral.p5, s.neutral.p95, s.enacted, effect(s.effects.geographic), effect(s.effects.drawing)]),
    ]),
  };
}
