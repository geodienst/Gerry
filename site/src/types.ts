// The shape of site/public/data/results.json and site/public/data/map.topojson, written by pipeline/04_export.py
// (pipeline/gerry/export.py). The contract test in site/test/contract.test.ts checks the real files against it.
import type { GeometryCollection, Topology } from 'topojson-specification';

export type Postal = string;
export type Party = 'D' | 'R';
export type CountKey = 'proportional' | 'neutral' | 'enacted';
export type MapView = 'districts' | 'states' | 'close';
export type Palette = 'party' | 'neutral';

/** Median and 5th to 95th percentile of a count over the neutral maps; dist[k] is the share of maps with k. */
export interface Band {
  median: number;
  p5: number;
  p95: number;
}
export interface Distribution extends Band {
  dist: number[];
}

/** Where the enacted map sits among the neutral maps, as shares of maps. */
export interface Position {
  fewer: number;
  equal: number;
  more: number;
  midrank: number;
}

export interface Effects {
  geographic: number;
  drawing: number;
}

/** Efficiency gap or mean-median: the enacted value and the band of the neutral maps. */
export interface Measure extends Band {
  value: number;
}

export interface Competitive extends Band {
  enacted: number;
  neutral_dist: number[];
}

export interface District {
  id: string;
  share: number;
  d: number;
  r: number;
}

export interface Source {
  label: string;
  url: string;
}

export interface Note {
  key: string;
  text: string;
}

export interface Sorted {
  enacted: number[];
  p5: number[];
  p50: number[];
  p95: number[];
}

export type Status = 'In effect' | 'Challenged' | 'Blocked' | 'At-large';
export type AdoptedBy = 'Commission' | 'Legislature' | 'Court';
export type Control = 'Bipartisan' | 'Nonpartisan' | 'Republican' | 'Democratic';

export interface BlockedMap {
  name: string;
  status: Status;
  source: Source;
  enacted: number;
  districts: District[];
  position: Position;
}

export interface StateResult {
  name: string;
  fips: string;
  seats: number;
  map_name: string;
  status: Status;
  source: Source;
  adopted: { by: AdoptedBy; control: Control; note: string | null };
  notes: Note[];
  d_share: number;
  proportional: number;
  enacted: number;
  neutral: Distribution;
  position: Position;
  effects: Effects;
  outside_band: boolean;
  eg: Measure;
  /** null for a state with two districts */
  mm: Measure | null;
  districts: District[];
  sorted: Sorted;
  competitive: Competitive;
  redraw: { change: number; map_changed: boolean; seats_2024: number };
  blocked_map?: BlockedMap;
}

export interface SingleSeat {
  postal: Postal;
  fips: string;
  name: string;
}

export interface Tally {
  states: number;
  seats: number;
  drawing: number;
}

export interface SwingPoint {
  share: number;
  base: boolean;
  proportional: number;
  enacted: number;
  neutral: Band;
  more: number;
  senate: number;
}

export interface Majority {
  base_share: number;
  seats_needed: number;
  proportional: { share: number };
  enacted: { share: number; seats_at_base: number };
  neutral: { share: number; low: number; high: number; probability_at_base: number };
}

export interface SenateAll {
  base_share: number;
  share: number;
  seats_at_base: number;
  states_at_base: number;
  states_needed: number;
  tipping: { postal: Postal; share: number }[];
}

export interface Senate2026 {
  checked: string;
  base_share: number;
  share: number;
  majority: number;
  needed: number;
  up: number;
  held: Record<Party, number>;
  not_up: Record<Party, number>;
  seats: { postal: Postal; held: Party; share: number }[];
  seats_at_base: number;
  won_at_base: number;
}

export interface National {
  seats: number;
  proportional: number;
  enacted: number;
  neutral: Distribution;
  position: Position;
  effects: Effects;
  outside_band: boolean;
  competitive: Competitive;
  redraw: { change: number; seats_2024: number };
  by_control: Record<Control, Tally>;
  by_body: Record<AdoptedBy, Tally>;
  majority: Majority;
  senate: SenateAll;
  senate_2026: Senate2026;
  single_seat: SingleSeat[];
  swing: { points: SwingPoint[] };
  president?: Record<'2016' | '2020' | '2024', number>;
}

export interface Meta {
  generated: string;
  status_checked: string;
  census_vest_commit: string;
  vote_basis: string[];
  ensemble: { name: string; doi: string; version: number };
}

export interface Results {
  meta: Meta;
  national: National;
  states: Record<Postal, StateResult>;
}

export interface DistrictProps {
  id: string;
  state: Postal;
}
export interface StateProps {
  id: string;
  postal: Postal;
}
export type MapTopology = Topology<{
  districts: GeometryCollection<DistrictProps>;
  states: GeometryCollection<StateProps>;
}>;
