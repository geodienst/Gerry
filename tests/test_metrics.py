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
