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
    # quota D 2.8, R 1.2, floors 2 + 1, remainders 0.8 vs 0.2 -> leftover seat to D
    assert m.largest_remainder(70, 30, 4) == 3


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


# Task 2.3: seats_by_plan and distribution

def _ensemble(rows):
    return pd.DataFrame(rows, columns=["state", "draw", "district", "d", "r", "d_pre_20", "r_pre_20"])


def test_seats_by_plan_counts_dem_districts_per_draw():
    ens = _ensemble([
        # draw "1": 01 D (60 > 40), 02 R (30 < 70) -> 1 seat
        ("NV", "1", "01", 60, 40, 30, 20),
        ("NV", "1", "02", 30, 70, 15, 35),
        # draw "2": both tied 50-50; 2020 gives 01 to D (30 > 20), 02 to R (10 < 40) -> 1 seat
        ("NV", "2", "01", 50, 50, 30, 20),
        ("NV", "2", "02", 50, 50, 10, 40),
        # draw "7": 01 D (80 > 20), 02 D (55 > 45) -> 2 seats
        ("NV", "7", "01", 80, 20, 40, 10),
        ("NV", "7", "02", 55, 45, 30, 20),
    ])
    assert m.seats_by_plan(ens).to_dict() == {"1": 1, "2": 1, "7": 2}


def test_seats_by_plan_double_tie_names_state_plan_and_district():
    ens = _ensemble([
        ("NV", "1", "01", 60, 40, 30, 20),
        ("NV", "1", "02", 30, 70, 15, 35),
        ("NV", "9", "01", 50, 50, 25, 25),  # tied in the composite and in 2020
        ("NV", "9", "02", 30, 70, 15, 35),
    ])
    with pytest.raises(m.TieError, match="NV plan 9 district 01"):
        m.seats_by_plan(ens)


def test_distribution_counts_plans_per_seat_count():
    # 4 seats, so counts for 0 to 4 seats; samples 1, 1, 2, 3, 3, 3 -> [0, 2, 1, 3, 0]
    assert m.distribution([1, 1, 2, 3, 3, 3], 4).tolist() == [0, 2, 1, 3, 0]


def test_distribution_rejects_impossible_counts():
    with pytest.raises(ValueError):
        m.distribution([5], 4)
    with pytest.raises(ValueError):
        m.distribution([], 4)


# Task 2.4: sample_percentile and pmf_percentile

def test_sample_percentile_takes_lower_middle_value():
    # samples 1, 1, 2, 2: share of plans with at most 1 seat = 2/4 = 0.5 >= 0.5
    # so the median is 1, never the average 1.5
    assert m.sample_percentile([1, 1, 2, 2], 50) == 1
    # 1, 1, 3, 3: share with at most 1 seat = 0.5 >= 0.5 -> 1; averaging would give 2
    assert m.sample_percentile([1, 1, 3, 3], 50) == 1
    # q = 51: 0.5 < 0.51 <= 1.0 -> 2; a "lower" rule would give 1
    assert m.sample_percentile([1, 1, 2, 2], 51) == 2


def test_sample_percentile_with_many_equal_values():
    # 7 plans with 2 seats, 3 with 3: cumulative share 0.7 at 2 seats, 1.0 at 3
    # p5: 0.7 >= 0.05 -> 2; median: 0.7 >= 0.5 -> 2; p95: 0.7 < 0.95 <= 1.0 -> 3
    samples = [2] * 7 + [3] * 3
    assert [m.sample_percentile(samples, q) for q in (5, 50, 95)] == [2, 2, 3]


def test_sample_percentile_all_equal():
    # West Virginia: every plan gives 0 seats
    assert [m.sample_percentile([0] * 5000, q) for q in (5, 50, 95)] == [0, 0, 0]


def test_sample_percentile_rejects_q_out_of_range():
    with pytest.raises(ValueError):
        m.sample_percentile([1, 2], 101)


def test_pmf_percentile_matches_hand_cdf():
    # plans per seat count 0..3: 1, 3, 4, 2 (10 plans); cumulative 0.1, 0.4, 0.8, 1.0
    # p5: 0.1 >= 0.05 -> 0; median: 0.4 < 0.5 <= 0.8 -> 2; p95: 0.8 < 0.95 <= 1.0 -> 3
    assert [m.pmf_percentile([1, 3, 4, 2], q) for q in (5, 50, 95)] == [0, 2, 3]


def test_pmf_percentile_skips_seat_counts_without_plans():
    # no plan has 0 seats, so the 0th percentile is 1, as numpy gives for the samples
    assert m.pmf_percentile([0, 5, 5], 0) == 1
    assert m.sample_percentile([1] * 5 + [2] * 5, 0) == 1


def test_pmf_percentile_tolerates_float_error():
    # twelve seat counts with one plan each: in floats the cumulative share at 5 is
    # 0.49999999999999994, just under 0.5; by hand it is 6/12 = 0.5, so the median is 5
    assert np.cumsum(np.ones(12) / 12)[5] < 0.5
    assert m.pmf_percentile(np.ones(12), 50) == 5
    assert m.sample_percentile(range(12), 50) == 5


def test_percentiles_at_exact_boundaries_take_the_lower_value():
    # 5000 plans; the cumulative share at 0 seats hits q exactly, so the answer is 0
    # p5: 250 / 5000 = 0.05; median: 2500 / 5000 = 0.5; p95: 4750 / 5000 = 0.95
    for zeros, q in ((250, 5), (2500, 50), (4750, 95)):
        samples = [0] * zeros + [1] * (5000 - zeros)
        assert m.sample_percentile(samples, q) == 0
        assert m.pmf_percentile([zeros, 5000 - zeros], q) == 0


def test_pmf_percentile_agrees_with_samples():
    # Nevada's distribution: 13 plans with 1 seat, 1901 with 2, 3086 with 3
    samples = [1] * 13 + [2] * 1901 + [3] * 3086
    pmf = m.distribution(samples, 4)
    for q in (0, 1, 5, 25, 50, 75, 95, 100):
        assert m.pmf_percentile(pmf, q) == m.sample_percentile(samples, q)


# Task 2.5: position and pmf_position

def test_position_counts_fewer_equal_more():
    # 10 plans with seats 1, 2, 2, 3, 3, 3, 3, 4, 4, 5; enacted 3
    # fewer: 1, 2, 2 = 3/10 = 0.3; equal: 4/10 = 0.4; more: 4, 4, 5 = 0.3
    # midrank = 0.3 + 0.4 / 2 = 0.5
    pos = m.position([1, 2, 2, 3, 3, 3, 3, 4, 4, 5], 3)
    assert pos == pytest.approx({"fewer": 0.3, "equal": 0.4, "more": 0.3, "midrank": 0.5})


def test_position_nevada():
    # Nevada: enacted 3; 13 + 1901 = 1914 plans fewer (0.3828), 3086 equal (0.6172), none more
    # midrank = 0.3828 + 0.6172 / 2 = 0.6914
    samples = [1] * 13 + [2] * 1901 + [3] * 3086
    pos = m.position(samples, 3)
    assert pos == pytest.approx({"fewer": 0.3828, "equal": 0.6172, "more": 0.0, "midrank": 0.6914})


def test_pmf_position_from_counts():
    # plans per seat count 0..3: 1, 3, 4, 2; value 2
    # fewer = (1 + 3) / 10 = 0.4; equal = 4/10 = 0.4; more = 2/10 = 0.2; midrank = 0.4 + 0.2 = 0.6
    pos = m.pmf_position([1, 3, 4, 2], 2)
    assert pos == pytest.approx({"fewer": 0.4, "equal": 0.4, "more": 0.2, "midrank": 0.6})


def test_pmf_position_rejects_value_outside_range():
    with pytest.raises(ValueError):
        m.pmf_position([1, 3, 4, 2], 4)


# Task 2.6: effects and outside_band

def test_effects_geographic_and_drawing():
    # California: proportional 34, median 45, enacted 48
    # geographic = 45 - 34 = 11; drawing = 48 - 45 = 3
    assert m.effects(34, 45, 48) == {"geographic": 11, "drawing": 3}
    # Texas: proportional 18, median 17, enacted 11 -> geographic -1, drawing -6
    assert m.effects(18, 17, 11) == {"geographic": -1, "drawing": -6}


def test_outside_band():
    # Texas band 15..20: 11 is below it; 15 and 20 are on the edges and count as inside; 21 is above
    assert m.outside_band(11, 15, 20) is True
    # 14 lies just below the band 15..20
    assert m.outside_band(14, 15, 20) is True
    assert m.outside_band(15, 15, 20) is False
    assert m.outside_band(20, 15, 20) is False
    assert m.outside_band(21, 15, 20) is True


# Task 2.7: efficiency_gap

def test_efficiency_gap_five_districts():
    # district  D   R   T    winner  wasted D       wasted R
    # 1         80  20  100  D       80 - 50 = 30   20
    # 2         55  45  100  D       55 - 50 = 5    45
    # 3         30  70  100  R       30             70 - 50 = 20
    # 4         48  72  120  R       48             72 - 60 = 12
    # 5         35  45   80  R       35             45 - 40 = 5
    # wasted D = 148, wasted R = 102, all votes = 500
    # EG = (148 - 102) / 500 = 0.092, positive: more Democratic votes wasted, favors Republicans
    d = [80, 55, 30, 48, 35]
    r = [20, 45, 70, 72, 45]
    assert m.efficiency_gap(d, r, m.dem_wins(d, r)) == pytest.approx(0.092)


def test_efficiency_gap_mirror_favors_democrats():
    # swap the parties of the five-district example: wasted D 102, wasted R 148
    # EG = (102 - 148) / 500 = -0.092
    d = [20, 45, 70, 72, 45]
    r = [80, 55, 30, 48, 35]
    assert m.efficiency_gap(d, r, m.dem_wins(d, r)) == pytest.approx(-0.092)


def test_efficiency_gap_uses_given_winners():
    # district 1 is 50-50; district 2 is D 30, R 70 (R wins: wasted D 30, wasted R 70 - 50 = 20)
    # D declared winner of district 1: wasted D 50 - 50 = 0, wasted R 50
    #   EG = ((0 + 30) - (50 + 20)) / 200 = -0.2
    # R declared winner of district 1: wasted D 50, wasted R 0
    #   EG = ((50 + 30) - (0 + 20)) / 200 = 0.3
    assert m.efficiency_gap([50, 30], [50, 70], [True, False]) == pytest.approx(-0.2)
    assert m.efficiency_gap([50, 30], [50, 70], [False, False]) == pytest.approx(0.3)


# Task 2.8: mean_median

def test_mean_median_odd_count():
    # shares 0.30, 0.45, 0.50, 0.60, 0.80: mean = 2.65 / 5 = 0.53, median = 0.50
    # MM = 0.53 - 0.50 = 0.03, positive: favors Republicans
    assert m.mean_median([0.30, 0.45, 0.50, 0.60, 0.80]) == pytest.approx(0.03)


def test_mean_median_three_districts():
    # 0.20, 0.50, 0.50: mean = 1.2 / 3 = 0.4, median 0.5 -> MM = -0.1, favors Democrats
    assert m.mean_median([0.20, 0.50, 0.50]) == pytest.approx(-0.1)


def test_mean_median_even_count_averages_the_middle_two():
    # 0.35, 0.40, 0.55, 0.70 (given unsorted): mean = 2.0 / 4 = 0.5
    # median = (0.40 + 0.55) / 2 = 0.475; MM = 0.5 - 0.475 = 0.025
    assert m.mean_median([0.70, 0.35, 0.55, 0.40]) == pytest.approx(0.025)


def test_mean_median_none_for_two_districts():
    assert m.mean_median([0.3, 0.6]) is None


# Task 2.9: linear_band and sorted_band

def test_linear_band_interpolates():
    # five values 0.10 .. 0.50; numpy's linear rule puts q at position (n - 1) * q / 100
    # p5: 4 * 0.05 = 0.2 -> 0.10 + 0.2 * (0.20 - 0.10) = 0.12
    # median: position 2 -> 0.30
    # p95: 4 * 0.95 = 3.8 -> 0.40 + 0.8 * (0.50 - 0.40) = 0.48
    band = m.linear_band([0.50, 0.10, 0.40, 0.20, 0.30])
    assert band == pytest.approx({"median": 0.30, "p5": 0.12, "p95": 0.48})


def test_sorted_band_sorts_each_plan_first():
    # plan A: 0.6, 0.4 -> sorted 0.4, 0.6
    # plan B: 0.3, 0.5 -> 0.3, 0.5
    # plan C: 0.7, 0.2 -> 0.2, 0.7
    # lowest district: 0.2, 0.3, 0.4; position (3 - 1) * q / 100
    #   p5: 0.1 -> 0.2 + 0.1 * 0.1 = 0.21; p50: 0.3; p95: 1.9 -> 0.3 + 0.9 * 0.1 = 0.39
    # highest district: 0.5, 0.6, 0.7
    #   p5: 0.5 + 0.1 * 0.1 = 0.51; p50: 0.6; p95: 0.6 + 0.9 * 0.1 = 0.69
    band = m.sorted_band(np.array([[0.6, 0.4], [0.3, 0.5], [0.7, 0.2]]))
    assert band["p5"] == pytest.approx([0.21, 0.51])
    assert band["p50"] == pytest.approx([0.3, 0.6])
    assert band["p95"] == pytest.approx([0.39, 0.69])
    assert isinstance(band["p50"], list)
