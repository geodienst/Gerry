"""Counting rules from chapter 5 of the spec.

Sign conventions: effects are in Democratic seats (positive = more Democratic seats);
efficiency gap and mean-median are positive when they favor Republicans.
"""
from __future__ import annotations

from typing import Callable, Mapping, Sequence

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


def mean_median(shares) -> float | None:
    """Unweighted mean minus median of the district D shares; None below 3 districts.
    Positive favors Republicans."""
    values = np.asarray(shares, dtype=float)
    if values.size < 3:
        return None
    return float(np.mean(values) - np.median(values))


def linear_band(values) -> dict:
    """Median, 5th and 95th percentile with linear interpolation (EG and MM context)."""
    data = np.asarray(values, dtype=float)
    if data.size == 0:
        raise ValueError("no values")
    p5, p50, p95 = np.percentile(data, [5, 50, 95])
    return {"median": float(p50), "p5": float(p5), "p95": float(p95)}


def sorted_band(share_matrix: np.ndarray) -> dict:
    """Rows are plans, columns districts. Sort each plan's shares from low to high, then
    take the 5th, 50th and 95th percentile per position (linear interpolation)."""
    ordered = np.sort(np.asarray(share_matrix, dtype=float), axis=1)
    p5, p50, p95 = np.percentile(ordered, [5, 50, 95], axis=0)
    return {"p5": p5.tolist(), "p50": p50.tolist(), "p95": p95.tolist()}


def convolve(pmfs: Sequence[np.ndarray]) -> np.ndarray:
    """Distribution of the sum of independent seat counts. Each input may be counts
    or probabilities; the result is probabilities for 0..sum of seats."""
    if len(pmfs) == 0:
        raise ValueError("no distributions")
    total = np.array([1.0])
    for pmf in pmfs:
        total = np.convolve(total, _normalize(pmf))
    return total


def is_narrow(dist_counts) -> bool:
    """True when one seat count has at least 95% of the plans (integer arithmetic)."""
    counts = np.asarray(dist_counts, dtype=np.int64)
    total = int(counts.sum())
    if total <= 0:
        raise ValueError("no plans")
    return int(counts.max()) * 20 >= 19 * total


# --- Extensions (docs/superpowers/specs/2026-10-06-extensions-design.md) ---------------------------

COMPETITIVE_LOW = 0.45       # chapter 3: a Democratic share from 45% to 55%, bounds included
COMPETITIVE_HIGH = 0.55


def competitive(shares) -> np.ndarray:
    """Districts with a Democratic share from 45% to 55%, bounds included, counted along the last axis:
    one number for a map, one per plan for a matrix with plans as rows."""
    values = np.asarray(shares, dtype=float)
    return ((values >= COMPETITIVE_LOW) & (values <= COMPETITIVE_HIGH)).sum(axis=-1)


def seats_at_swing(shares, swing: float) -> np.ndarray:
    """Democratic seats when `swing` is added to every district share: districts above one half, counted
    along the last axis. A district that lands exactly on one half does not count."""
    return (np.asarray(shares, dtype=float) + swing > 0.5).sum(axis=-1)


def enacted_threshold(shares, needed: int) -> float:
    """The swing 0.5 - h, with h the needed-th highest district share (chapter 1). Any larger swing gives at
    least `needed` Democratic districts; at the threshold itself district `needed` sits on one half."""
    ordered = np.sort(np.asarray(shares, dtype=float))[::-1]
    if not 1 <= needed <= ordered.size:
        raise ValueError(f"needed must lie in 1..{ordered.size}, got {needed}")
    return float(0.5 - ordered[needed - 1])


SWING_GRID = 10_000          # grid steps per unit of share: one step is 0.0001, or 0.01 percentage point
MAX_SWING_STEPS = 500        # 5 percentage points (chapters 1 and 5)


class SwingRangeError(ValueError):
    """A threshold lies 5 percentage points or more from the base share."""


def smallest_swing(holds: Callable[[float], bool], max_steps: int = MAX_SWING_STEPS) -> float:
    """Smallest swing k / SWING_GRID with -max_steps < k <= max_steps at which holds(swing) is true. holds must
    stay true once it is true (bisection). SwingRangeError when it is already true at -max_steps or still
    false at +max_steps."""
    lo, hi = -max_steps, max_steps
    if holds(lo / SWING_GRID):
        raise SwingRangeError(f"already true at a swing of {lo / SWING_GRID:+.4f}")
    if not holds(hi / SWING_GRID):
        raise SwingRangeError(f"still false at a swing of {hi / SWING_GRID:+.4f}")
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if holds(mid / SWING_GRID):
            hi = mid
        else:
            lo = mid
    return hi / SWING_GRID


def majority_probability(plan_shares: Sequence[np.ndarray], swing: float, needed: int) -> float:
    """Share of neutral outcomes with at least `needed` Democratic districts when `swing` is added to every
    district share. One matrix per state with plans as rows; states convolved as independent (spec chapter 5)."""
    pmfs = [np.bincount(seats_at_swing(shares, swing), minlength=shares.shape[1] + 1) for shares in plan_shares]
    return float(convolve(pmfs)[needed:].sum())


def neutral_threshold(plan_shares: Sequence[np.ndarray], needed: int, q: float) -> float:
    """Smallest grid swing at which a share q of the neutral outcomes has at least `needed` districts."""
    return smallest_swing(lambda swing: majority_probability(plan_shares, swing, needed) >= q - CUM_TOLERANCE)


def proportional_at_swing(state_shares: Sequence[float], seats: Sequence[int], swing: float) -> int:
    """Democratic seats summed over states, each by largest remainder on its two-party share plus swing."""
    total = 0
    for share, n in zip(state_shares, seats, strict=True):
        d = share + swing
        if not 0 <= d <= 1:
            raise ValueError(f"share {share} plus swing {swing} lies outside 0..1")
        total += largest_remainder(d, 1 - d, n)
    return total


def swing_point(swing: float, *, state_shares: Sequence[float], state_seats: Sequence[int],
                plan_shares: Sequence[np.ndarray], enacted_shares) -> dict:
    """All three counts when `swing` is added to every share (plan 2026-10-08-vote-slider): proportional seats,
    enacted districts, the neutral median and 5th and 95th percentile (states convolved as independent), and the
    share of neutral outcomes with more Democratic districts than the enacted maps."""
    pmf = convolve([np.bincount(seats_at_swing(shares, swing), minlength=shares.shape[1] + 1)
                    for shares in plan_shares])
    enacted = int(seats_at_swing(enacted_shares, swing))
    return {
        "proportional": proportional_at_swing(state_shares, state_seats, swing),
        "enacted": enacted,
        "neutral": {"median": pmf_percentile(pmf, 50), "p5": pmf_percentile(pmf, 5), "p95": pmf_percentile(pmf, 95)},
        "more": pmf_position(pmf, enacted)["more"],
    }


def proportional_threshold(state_shares: Sequence[float], seats: Sequence[int], needed: int) -> float:
    """Smallest grid swing at which largest remainder per state gives at least `needed` seats in total."""
    return smallest_swing(lambda swing: proportional_at_swing(state_shares, seats, swing) >= needed)


# --- Senate block (extensions design, chapter 7) ----------------------------------------------------


def senate_majority(votes: Mapping[str, tuple[float, float]], needed: int, around: int = 2,
                    base_share: float | None = None) -> dict:
    """Each state's two senators go to the party with more of its two-party vote. `votes` maps every state to its
    (Democratic, Republican) votes. Under a uniform swing on the state shares Democrats need `needed` states: the
    threshold is the national share plus 0.5 - h, with h the needed-th highest state share (exact, as
    enacted_threshold). A state exactly on one half does not count. Also the states and seats at the real votes,
    and the states ranked needed - around to needed + around, from high to low (equal shares by postal code).
    The national share is `base_share` if given (the House share of the vote slider, owner, October 13, 2026),
    else the share of all the votes in `votes`."""
    postals = sorted(votes)
    first, last = needed - around, needed + around
    if not 1 <= first <= last <= len(postals):
        raise ValueError(f"ranks {first} to {last} must lie within 1..{len(postals)}")
    d = np.array([votes[p][0] for p in postals], dtype=float)
    r = np.array([votes[p][1] for p in postals], dtype=float)
    shares = d / (d + r)
    base = float(d.sum() / (d + r).sum()) if base_share is None else float(base_share)
    ranked = sorted(range(len(postals)), key=lambda i: (-shares[i], postals[i]))
    states = int(seats_at_swing(shares, 0.0))
    return {
        "base_share": base,
        "states_needed": needed,
        "share": base + enacted_threshold(shares, needed),
        "states_at_base": states,
        "seats_at_base": 2 * states,
        "tipping": [{"postal": postals[i], "share": float(shares[i])} for i in ranked[first - 1:last]],
    }


def senate_election(shares: Mapping[str, float], held: Mapping[str, str], not_up: Mapping[str, int], majority: int,
                    base_share: float) -> dict:
    """The Senate seats on one ballot (owner, October 13, 2026). `shares` maps each state with a seat on the ballot
    to its Democratic share of the two-party presidential vote, `held` to the party ("D" or "R") that holds that
    seat now; `not_up` gives the seats of each party that are not on the ballot. A seat goes to the party with
    more of its state's vote, as in senate_majority. Democrats need `majority` seats in all: the seats on the
    ballot they need are majority - not_up["D"], and under a uniform swing the national share they need is
    base_share + 0.5 - h, with h the share of the state ranked at that number. Also the seats won at
    base_share, and every seat on the ballot from the highest Democratic share to the lowest (equal shares by
    postal code)."""
    if sorted(shares) != sorted(held):
        raise ValueError(f"shares has {sorted(shares)}, held has {sorted(held)}")
    postals = sorted(shares, key=lambda p: (-shares[p], p))
    up = np.array([shares[p] for p in postals], dtype=float)
    needed = majority - not_up["D"]
    if not 1 <= needed <= len(postals):
        raise ValueError(f"Democrats need {needed} of the {len(postals)} seats on the ballot")
    won = int(seats_at_swing(up, 0.0))
    return {
        "base_share": float(base_share),
        "up": len(postals),
        "held": {party: sum(held[p] == party for p in postals) for party in ("D", "R")},
        "not_up": {party: int(not_up[party]) for party in ("D", "R")},
        "majority": majority,
        "needed": needed,
        "share": float(base_share) + enacted_threshold(up, needed),
        "won_at_base": won,
        "seats_at_base": int(not_up["D"]) + won,
        "seats": [{"postal": p, "share": float(shares[p]), "held": held[p]} for p in postals],
    }


def senate_seats_at(election: dict, share: float) -> int:
    """Democratic seats in the whole Senate when Democrats win `share` of the national vote: the seats not on the
    ballot plus the seats on it whose state share, moved by share - base_share, lies above one half."""
    up = np.array([s["share"] for s in election["seats"]], dtype=float)
    return election["not_up"]["D"] + int(seats_at_swing(up, share - election["base_share"]))
