"""Tests for gerry/metrics.py. Every expected value is worked out by hand in the comments."""
import numpy as np
import pandas as pd
import pytest

from gerry import metrics as m


# Task 2.1: dem_wins

def test_dem_wins_majority_decides():
    # district 1: D 60 > R 40 -> D; district 2: D 30 < R 70 -> R
    assert m.dem_wins([60, 30], [40, 70]).tolist() == [True, False]


def test_dem_wins_tie_goes_to_2020_winner():
    # district 1: composite 100-100, 2020 alone D 55 > R 45 -> D
    # district 2: composite 100-100, 2020 alone D 40 < R 60 -> R
    # district 3: composite D 120 > R 80 -> D; its 2020 votes (10-90) do not count
    wins = m.dem_wins([100, 100, 120], [100, 100, 80], d20=[55, 40, 10], r20=[45, 60, 90])
    assert wins.tolist() == [True, False, True]


def test_dem_wins_double_tie_names_position():
    # position 1 is tied in the composite (50-50) and in 2020 (25-25)
    with pytest.raises(m.TieError, match=r"position\(s\) \[1\]") as err:
        m.dem_wins([60, 50], [40, 50], d20=[30, 25], r20=[20, 25])
    assert err.value.positions == (1,)


def test_dem_wins_tie_without_2020_votes_raises():
    with pytest.raises(m.TieError, match=r"position\(s\) \[0\]"):
        m.dem_wins([50], [50])


def test_dem_wins_rejects_missing_votes():
    with pytest.raises(ValueError, match="missing"):
        m.dem_wins([np.nan, 10], [5, 20])


# Task 2.2: largest_remainder

def test_largest_remainder_larger_remainder_wins():
    # 60 to 40, 4 seats: quota D = 60 * 4 / 100 = 2.4, quota R = 4 - 2.4 = 1.6
    # floors 2 + 1 = 3, one seat left; remainders 0.4 (D) and 0.6 (R) -> R
    assert m.largest_remainder(60, 40, 4) == 2


def test_largest_remainder_nevada():
    # Nevada composite: D 1,242,313.3, R 1,181,550.1, 4 seats
    # quota D = 4 * 0.5125344 = 2.0501, quota R = 1.9499
    # floors 2 + 1, remainders 0.0501 (D) and 0.9499 (R) -> R; D keeps 2
    assert m.largest_remainder(1242313.3, 1181550.1, 4) == 2


def test_largest_remainder_whole_quotas():
    # 75 to 25, 4 seats: quotas 3.0 and 1.0, no seat left over
    assert m.largest_remainder(75, 25, 4) == 3


def test_largest_remainder_equal_remainders_go_to_more_votes():
    # 5 to 3, 4 seats: quota D = 5 * 4 / 8 = 2.5, quota R = 1.5, both remainders 0.5
    # D has more votes (5 > 3) and gets the last seat: 2 + 1 = 3
    assert m.largest_remainder(5, 3, 4) == 3
    # mirrored: R has more votes, D keeps its floor of 1
    assert m.largest_remainder(3, 5, 4) == 1


def test_largest_remainder_full_tie_raises():
    # 10 to 10, 3 seats: quotas 1.5 and 1.5, equal remainders and equal votes
    with pytest.raises(m.TieError):
        m.largest_remainder(10, 10, 3)


def test_largest_remainder_rejects_bad_input():
    with pytest.raises(ValueError):
        m.largest_remainder(0, 0, 4)
    with pytest.raises(ValueError):
        m.largest_remainder(10, 20, 0)
