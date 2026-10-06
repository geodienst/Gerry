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
