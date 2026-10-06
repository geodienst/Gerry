"""Counting rules from chapter 5 of the spec.

Sign conventions: effects are in Democratic seats (positive = more Democratic seats);
efficiency gap and mean-median are positive when they favor Republicans.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd


class TieError(ValueError):
    """D equals R in the composite and again in the 2020 presidential result."""

    def __init__(self, message: str, positions: Sequence[int] = ()):
        super().__init__(message)
        self.positions = tuple(int(p) for p in positions)


def dem_wins(d, r, d20=None, r20=None) -> np.ndarray:
    """True where the Democrat wins. D > R wins, R > D loses, D == R goes to the
    2020 winner (d20, r20). A tie in both raises TieError with the positions."""
    d = np.asarray(d, dtype=float)
    r = np.asarray(r, dtype=float)
    if d.shape != r.shape:
        raise ValueError(f"d and r differ in shape: {d.shape} and {r.shape}")
    if np.isnan(d).any() or np.isnan(r).any():
        raise ValueError("missing votes in d or r")
    wins = d > r
    tied = d == r
    if not tied.any():
        return wins
    if d20 is None or r20 is None:
        pos = np.flatnonzero(tied)
        raise TieError(f"D equals R at position(s) {pos.tolist()} and no 2020 votes were given", pos)
    d20 = np.asarray(d20, dtype=float)
    r20 = np.asarray(r20, dtype=float)
    double = tied & (d20 == r20)
    if double.any():
        pos = np.flatnonzero(double)
        raise TieError(f"D equals R in the composite and in 2020 at position(s) {pos.tolist()}", pos)
    return np.where(tied, d20 > r20, wins)


def largest_remainder(d_votes: float, r_votes: float, seats: int) -> int:
    """Democratic seats under largest remainder with two parties. Equal remainders
    go to the party with more votes; equal votes as well raise TieError."""
    total = d_votes + r_votes
    if seats < 1 or total <= 0:
        raise ValueError(f"need seats >= 1 and votes > 0, got seats={seats}, votes={total}")
    quota_d = d_votes * seats / total
    quota_r = seats - quota_d
    floor_d = int(np.floor(quota_d))
    floor_r = int(np.floor(quota_r))
    if floor_d + floor_r == seats:
        return floor_d
    rest_d = quota_d - floor_d
    rest_r = quota_r - floor_r
    if rest_d != rest_r:
        return floor_d + 1 if rest_d > rest_r else floor_d
    if d_votes != r_votes:
        return floor_d + 1 if d_votes > r_votes else floor_d
    raise TieError(f"equal remainders and equal votes ({d_votes} each) for {seats} seats")


def seats_by_plan(ensemble: pd.DataFrame) -> pd.Series:
    """Democratic seats per draw. Needs columns state, draw, district, d, r, d_pre_20, r_pre_20."""
    try:
        wins = dem_wins(ensemble["d"], ensemble["r"], ensemble["d_pre_20"], ensemble["r_pre_20"])
    except TieError as err:
        rows = ensemble.iloc[list(err.positions)]
        where = "; ".join(f"{row.state} plan {row.draw} district {row.district}"
                          for row in rows.itertuples(index=False))
        raise TieError(f"{where}: {err}", err.positions) from err
    seats = pd.Series(wins.astype(np.int64), index=ensemble.index).groupby(ensemble["draw"], sort=False).sum()
    seats.name = "dem_seats"
    return seats


def distribution(seat_samples, seats: int) -> np.ndarray:
    """Number of plans with 0, 1, ..., seats Democratic seats."""
    samples = np.asarray(seat_samples, dtype=np.int64)
    if samples.size == 0 or samples.min() < 0 or samples.max() > seats:
        raise ValueError(f"seat counts must lie in 0..{seats}")
    return np.bincount(samples, minlength=seats + 1)


# Cumulative shares from a convolution of 44 distributions carry float error near 1e-15.
CUM_TOLERANCE = 1e-9


def _check_q(q: float) -> None:
    if not 0 <= q <= 100:
        raise ValueError(f"q must lie in 0..100, got {q}")


def _normalize(pmf) -> np.ndarray:
    p = np.asarray(pmf, dtype=float)
    if p.ndim != 1 or p.size == 0 or (p < 0).any() or p.sum() <= 0:
        raise ValueError("a distribution needs non-negative counts or probabilities with a positive sum")
    return p / p.sum()


def sample_percentile(samples, q: float) -> int:
    """Smallest seat count k with share of samples <= k at least q/100 (inverse CDF)."""
    _check_q(q)
    values = np.asarray(samples)
    if values.size == 0:
        raise ValueError("no samples")
    return int(np.percentile(values, q, method="inverted_cdf"))


def pmf_percentile(pmf, q: float) -> int:
    """Smallest seat count k that occurs and has cumulative share >= q/100."""
    _check_q(q)
    p = _normalize(pmf)
    cum = np.cumsum(p)
    hits = np.flatnonzero((p > 0) & (cum >= q / 100 - CUM_TOLERANCE))
    return int(hits[0])


def _position(fewer: float, equal: float, more: float) -> dict:
    return {"fewer": fewer, "equal": equal, "more": more, "midrank": fewer + equal / 2}


def position(samples, value: int) -> dict:
    """Share of plans with fewer, equal and more Democratic seats than value."""
    values = np.asarray(samples)
    if values.size == 0:
        raise ValueError("no samples")
    return _position(float(np.mean(values < value)), float(np.mean(values == value)),
                     float(np.mean(values > value)))


def pmf_position(pmf, value: int) -> dict:
    """position() for a distribution given as counts or probabilities per seat count."""
    p = _normalize(pmf)
    if not 0 <= value < p.size:
        raise ValueError(f"value {value} outside 0..{p.size - 1}")
    return _position(float(p[:value].sum()), float(p[value]), float(p[value + 1:].sum()))


def effects(proportional: int, median: int, enacted: int) -> dict:
    """Geographic effect = median - proportional; drawing effect = enacted - median."""
    return {"geographic": int(median - proportional), "drawing": int(enacted - median)}


def outside_band(enacted: int, p5: int, p95: int) -> bool:
    """True when enacted lies below the 5th or above the 95th percentile."""
    return bool(enacted < p5 or enacted > p95)


def efficiency_gap(d, r, dem_win) -> float:
    """(wasted D - wasted R) / all votes. The winner wastes votes above T/2, the loser
    all votes. Positive favors Republicans. dem_win comes from dem_wins()."""
    d = np.asarray(d, dtype=float)
    r = np.asarray(r, dtype=float)
    win = np.asarray(dem_win, dtype=bool)
    half = (d + r) / 2
    wasted_d = np.where(win, d - half, d)
    wasted_r = np.where(win, r, r - half)
    return float((wasted_d.sum() - wasted_r.sum()) / (d + r).sum())
