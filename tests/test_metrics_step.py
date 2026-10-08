"""Tests for pipeline/03_metrics.py on a made-up state with 3 seats and 4 plans.
Every expected value is worked out by hand in the comments."""
import dataclasses
import importlib.util
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from gerry.checks import CheckError
from gerry.config import AtLargeState, ExtraMap, StateConfig
from gerry.metrics import TieError

_PATH = Path(__file__).resolve().parents[1] / "pipeline" / "03_metrics.py"
_SPEC = importlib.util.spec_from_file_location("metrics_step", _PATH)
step = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(step)

XX = StateConfig(
    postal="XX", name="Example", fips="99", seats=3, map_name="Plan A", status="In effect",
    source_label="Example source", source_url="https://example.org", bef="cd120",
    elections=("pre_16", "pre_20"), unit_kind="vtd",
    extra_maps=(ExtraMap(id="xx_new", name="Plan B", status="Blocked", bef="cd120",
                         source_label="Example source", source_url="https://example.org/b"),),
    notes=(), adopted_by="Legislature", control="Republican", adopted_note=None)

COLS = ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20", "d", "r"]


def _votes(d, r, d20=None, r20=None):
    # 2020 is half of the composite unless given; 2016 is the rest
    d20 = d / 2 if d20 is None else d20
    r20 = r / 2 if r20 is None else r20
    return [d - d20, r - r20, d20, r20, d, r]


def _enacted():
    rows = []
    maps = {
        # enacted, block: 01 D (600 > 400), 02 R, 03 R -> 1 seat; shares 0.6, 0.3, 0.4
        ("enacted", "block"): [("01", 600, 400), ("02", 300, 700), ("03", 400, 600)],
        ("enacted", "whole_unit"): [("01", 590, 410), ("02", 310, 690), ("03", 400, 600)],
        # blocked map: 01 D, 02 D, 03 R -> 2 seats
        ("xx_new", "block"): [("01", 520, 480), ("02", 510, 490), ("03", 270, 730)],
        # whole units flip district 02: 495 < 505
        ("xx_new", "whole_unit"): [("01", 530, 470), ("02", 495, 505), ("03", 275, 725)],
        ("check_2022", "block"): [("01", 610, 390), ("02", 300, 700), ("03", 390, 610)],
        # the map of the 2024 election: 01 D, 02 D, 03 R -> 2 seats; whole units give the same winners
        ("map_2024", "block"): [("01", 560, 440), ("02", 520, 480), ("03", 300, 700)],
        ("map_2024", "whole_unit"): [("01", 555, 445), ("02", 515, 485), ("03", 305, 695)],
    }
    for (map_id, method), districts in maps.items():
        for district, d, r in districts:
            rows.append(["XX", map_id, method, district] + _votes(d, r))
    return pd.DataFrame(rows, columns=["state", "map_id", "method", "district"] + COLS)


def _ensemble():
    plans = {
        "1": [(650, 350), (350, 650), (300, 700)],              # 1 seat
        "2": [(550, 450), (500, 500, 300, 200), (250, 750)],    # tie in 02, 2020 300 > 200 -> D: 2 seats
        "3": [(450, 550), (450, 550), (400, 600)],              # 0 seats
        "4": [(600, 400), (400, 600), (300, 700)],              # 1 seat
    }
    rows = []
    for draw, districts in plans.items():
        for i, v in enumerate(districts, start=1):
            rows.append(["XX", draw, f"{i:02d}"] + _votes(*v))
    return pd.DataFrame(rows, columns=["state", "draw", "district"] + COLS)


def _reference():
    rows = [["XX", "01"] + _votes(612, 388), ["XX", "02"] + _votes(299, 701), ["XX", "03"] + _votes(389, 611)]
    return pd.DataFrame(rows, columns=["state", "district"] + COLS)


def test_state_metrics_hand_example():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    # d_share = 1300 / 3000
    assert res["d_share"] == pytest.approx(1300 / 3000)
    # quota D = 1300 * 3 / 3000 = 1.3, quota R = 1.7; floors 1 + 1, rest 0.3 vs 0.7 -> R
    assert res["proportional"] == 1
    assert res["enacted"] == 1
    # seats per plan 1, 2, 0, 1 -> plans per seat count [1, 2, 1, 0]
    # cumulative 0.25, 0.75, 1.0: p5 0, median 1, p95 2
    assert res["neutral"] == {"median": 1, "p5": 0, "p95": 2, "dist": [1, 2, 1, 0]}
    # enacted 1: fewer 1/4, equal 2/4, more 1/4, midrank 0.25 + 0.25 = 0.5
    assert res["position"] == pytest.approx({"fewer": 0.25, "equal": 0.5, "more": 0.25, "midrank": 0.5})
    # geographic = median 1 - proportional 1 = 0; drawing = enacted 1 - median 1 = 0
    assert res["effects"] == {"geographic": 0, "drawing": 0}
    assert res["outside_band"] is False
    assert res["computed_notes"] == []


def test_state_metrics_eg_and_mm_with_neutral_context():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    # enacted: wasted D = 100 + 300 + 400 = 800, wasted R = 400 + 200 + 100 = 700 -> 100 / 3000
    # plans: 1 -> (800 - 700) / 3000 = 1/30; 2 -> (300 - 1200) / 3000 = -0.3 (the tied
    # district counts as a D win, as in the seat count); 3 -> (1300 - 200) / 3000 = 11/30; 4 -> 1/30
    # sorted -0.3, 1/30, 1/30, 11/30; linear positions 3 * q / 100
    # p5: 0.15 -> -0.3 + 0.15 * (1/30 + 0.3) = -0.25; median: 1.5 -> 1/30
    # p95: 2.85 -> 1/30 + 0.85 * (11/30 - 1/30) = 19/60
    assert res["eg"] == pytest.approx({"value": 1 / 30, "median": 1 / 30, "p5": -0.25, "p95": 19 / 60})
    # enacted shares 0.6, 0.3, 0.4: mean 13/30, median 0.4 -> MM = 1/30
    # plans all have mean 13/30; medians 0.35, 0.5, 0.45, 0.4 -> MM 5/60, -4/60, -1/60, 2/60
    # sorted -4/60, -1/60, 2/60, 5/60: p5 = (-4 + 0.15 * 3) / 60; median = 0.5 / 60; p95 = (2 + 0.85 * 3) / 60
    assert res["mm"] == pytest.approx({"value": 1 / 30, "median": 0.5 / 60, "p5": -3.55 / 60, "p95": 4.55 / 60})


def test_state_metrics_districts_and_sorted_band():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    assert [d["id"] for d in res["districts"]] == ["9901", "9902", "9903"]
    assert res["districts"][0] == pytest.approx({"id": "9901", "share": 0.6, "d": 600.0, "r": 400.0})
    # plans sorted low to high: (.30 .35 .65) (.25 .50 .55) (.40 .45 .45) (.30 .40 .60)
    # lowest: .25 .30 .30 .40 -> p5 .25 + .15 * .05 = .2575; p50 .30; p95 .30 + .85 * .10 = .385
    # middle: .35 .40 .45 .50 -> p5 .3575; p50 .425; p95 .4925
    # highest: .45 .55 .60 .65 -> p5 .465; p50 .575; p95 .6425
    assert res["sorted"]["enacted"] == pytest.approx([0.3, 0.4, 0.6])
    assert res["sorted"]["p5"] == pytest.approx([0.2575, 0.3575, 0.465])
    assert res["sorted"]["p50"] == pytest.approx([0.30, 0.425, 0.575])
    assert res["sorted"]["p95"] == pytest.approx([0.385, 0.4925, 0.6425])


def test_state_metrics_blocked_map():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    # Plan B: 2 seats; plans 1, 2, 0, 1 -> fewer 3/4, equal 1/4, more 0, midrank 0.875
    assert res["blocked_map"]["enacted"] == 2
    assert res["blocked_map"]["position"] == pytest.approx(
        {"fewer": 0.75, "equal": 0.25, "more": 0.0, "midrank": 0.875})
    assert [d["id"] for d in res["blocked_map"]["districts"]] == ["9901", "9902", "9903"]


def test_state_metrics_two_seats_has_no_mm():
    two = dataclasses.replace(XX, seats=2, extra_maps=())
    enacted = _enacted()
    enacted = enacted[(enacted.district != "03") & (enacted.map_id == "enacted")]
    ens = _ensemble()
    ens = ens[ens.district != "03"]
    res = step.state_metrics(two, 1000.0, 1000.0, enacted, ens)
    assert res["mm"] is None
    # seats per plan: 1 (650 > 350, 350 < 650), 2, 0, 1 -> no seat count has 95%
    assert res["computed_notes"] == []
    assert "blocked_map" not in res


def test_state_metrics_flags_narrow_ensemble():
    ens = _ensemble()
    ens = ens[ens.draw.isin(["1", "4"])]   # both plans give 1 seat -> 100% of plans
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), ens)
    assert res["computed_notes"] == ["narrow_ensemble"]


def test_state_metrics_double_tie_in_enacted_names_district():
    enacted = _enacted()
    hit = (enacted.map_id == "enacted") & (enacted.method == "block") & (enacted.district == "02")
    enacted.loc[hit, COLS] = _votes(500, 500, 250, 250)
    with pytest.raises(TieError, match="XX enacted, district 02"):
        step.state_metrics(XX, 1300.0, 1700.0, enacted, _ensemble())


def test_state_metrics_rejects_wrong_district_count():
    enacted = _enacted()
    enacted = enacted[~((enacted.map_id == "enacted") & (enacted.district == "03"))]
    with pytest.raises(CheckError, match="district_count"):
        step.state_metrics(XX, 1300.0, 1700.0, enacted, _ensemble())


def test_state_checks():
    checks = step.state_checks(XX, _enacted(), _ensemble(), _reference())
    # no 2020 shares any more: they were for the DRA comparison (Task 2.14x)
    assert set(checks) == {"plans", "ties", "cd118_vs_alarm", "whole_unit"}
    assert checks["plans"] == 4
    # one tied district in the plans (plan 2, district 02), none in the maps
    assert checks["ties"] == {"ensemble": 1, "enacted": 0}
    ref = checks["cd118_vs_alarm"]
    # ours 0.61 / 0.30 / 0.39 against ALARM 0.612 / 0.299 / 0.389; one D seat each
    assert [r["district"] for r in ref["districts"]] == ["01", "02", "03"]
    assert ref["districts"][0] == pytest.approx({"district": "01", "ours": 0.61, "alarm": 0.612})
    assert (ref["seats_ours"], ref["seats_alarm"]) == (1, 1)
    whole = checks["whole_unit"]
    # three districts each on the enacted map, the blocked map and the 2024 map (Task 5.8)
    assert len(whole) == 9
    assert [w["map_id"] for w in whole[6:]] == ["map_2024"] * 3
    flipped = [w for w in whole if w["block_dem"] != w["whole_dem"]]
    # 2024 map: blocks 560-440, 520-480, 300-700 and whole units 555-445, 515-485, 305-695 have the same winners
    assert flipped == [pytest.approx({"map_id": "xx_new", "district": "02", "block": 0.51, "whole": 0.495,
                                      "block_dem": True, "whole_dem": False})]


def test_state_checks_requires_check_2022_rows():
    enacted = _enacted()
    enacted = enacted[enacted.map_id != "check_2022"]
    with pytest.raises(CheckError, match="cd118_vs_alarm"):
        step.state_checks(XX, enacted, _ensemble(), _reference())


def test_national_metrics(monkeypatch):
    # three states as in the convolution test: A 1 seat [1, 3], B 1 seat [2, 2], C 2 seats [0, 1, 1]
    def state(dist, prop, enacted):
        return {"proportional": prop, "enacted": enacted, "neutral": {"dist": dist}}

    states = {"AA": state([1, 3], 1, 0), "BB": state([2, 2], 0, 1), "CC": state([0, 1, 1], 1, 2)}
    at_large = {"WY": AtLargeState("WY", "Wyoming", "56"), "AK": AtLargeState("AK", "Alaska", "02")}
    monkeypatch.setattr(step, "HOUSE_SEATS", 4 + 2)
    nat = step.national_metrics(states, at_large)
    assert nat["seats"] == 4
    assert nat["proportional"] == 2      # 1 + 0 + 1
    assert nat["enacted"] == 3           # 0 + 1 + 2
    # P = [0, 0.0625, 0.3125, 0.4375, 0.1875]; cumulative 0, .0625, .375, .8125, 1
    assert nat["neutral"]["dist"] == pytest.approx([0, 0.0625, 0.3125, 0.4375, 0.1875])
    assert (nat["neutral"]["median"], nat["neutral"]["p5"], nat["neutral"]["p95"]) == (3, 1, 4)
    # enacted 3: fewer .375, equal .4375, more .1875, midrank .375 + .21875 = .59375
    assert nat["position"] == pytest.approx({"fewer": 0.375, "equal": 0.4375, "more": 0.1875, "midrank": 0.59375})
    # geographic = 3 - 2 = 1; drawing = 3 - 3 = 0
    assert nat["effects"] == {"geographic": 1, "drawing": 0}
    assert nat["outside_band"] is False
    assert nat["single_seat"] == [{"postal": "AK", "fips": "02", "name": "Alaska"},
                                  {"postal": "WY", "fips": "56", "name": "Wyoming"}]


def test_national_metrics_checks_house_total():
    states = {"AA": {"proportional": 1, "enacted": 0, "neutral": {"dist": [1, 3]}}}
    with pytest.raises(CheckError, match="house_total"):
        step.national_metrics(states, {})


# Wiring of effects, position, band and checks


def _with_main_map(enacted, votes):
    """enacted with its enacted/block rows replaced: one district per (d, r) pair."""
    keep = enacted[~((enacted.map_id == "enacted") & (enacted.method == "block"))]
    rows = [["XX", "enacted", "block", f"{i:02d}"] + _votes(d, r) for i, (d, r) in enumerate(votes, start=1)]
    return pd.concat([keep, pd.DataFrame(rows, columns=keep.columns)], ignore_index=True)


def test_state_metrics_effects_position_and_band_with_distinct_values():
    # 1700 D / 1300 R: quota D 1.7, quota R 1.3, floors 1 + 1, rest 0.7 vs 0.3 -> D: proportional 2
    # all three enacted districts D: enacted 3; plans give 1, 2, 0, 1 seats: median 1, p5 0, p95 2
    res = step.state_metrics(XX, 1700.0, 1300.0, _with_main_map(_enacted(), [(600, 400)] * 3), _ensemble())
    assert (res["proportional"], res["enacted"], res["neutral"]["median"]) == (2, 3, 1)
    # geographic = median 1 - proportional 2 = -1; drawing = enacted 3 - median 1 = 2
    assert res["effects"] == {"geographic": -1, "drawing": 2}
    # all 4 plans give fewer than 3 seats: fewer 1, equal 0, more 0, midrank 1
    assert res["position"] == pytest.approx({"fewer": 1.0, "equal": 0.0, "more": 0.0, "midrank": 1.0})
    assert res["outside_band"] is True            # 3 > p95 (2)


@pytest.mark.parametrize("votes, outside", [
    ([(450, 550)] * 3, False),                         # 0 seats = p5 (0): not below the band
    ([(600, 400), (600, 400), (400, 600)], False),     # 2 seats = p95 (2): not above the band
    ([(600, 400)] * 3, True),                          # 3 seats > p95 (2)
])
def test_state_metrics_outside_band_edges(votes, outside):
    # plans give 1, 2, 0, 1 seats: median 1, p5 0, p95 2
    res = step.state_metrics(XX, 1300.0, 1700.0, _with_main_map(_enacted(), votes), _ensemble())
    assert res["outside_band"] is outside


def _states(enacted):
    # as test_national_metrics: A 1 seat [1, 3], B 1 seat [2, 2], C 2 seats [0, 1, 1]
    def state(dist, prop, e):
        return {"proportional": prop, "enacted": e, "neutral": {"dist": dist}}
    return {"AA": state([1, 3], 1, enacted[0]), "BB": state([2, 2], 0, enacted[1]),
            "CC": state([0, 1, 1], 1, enacted[2])}


@pytest.mark.parametrize("enacted, geographic, drawing, position, outside", [
    # P = [0, 0.0625, 0.3125, 0.4375, 0.1875], proportional 2, median 3, p5 1, p95 4
    ((0, 1, 0), 1, -2, {"fewer": 0.0, "equal": 0.0625, "more": 0.9375, "midrank": 0.03125}, False),   # 1 = p5
    ((1, 1, 2), 1, 1, {"fewer": 0.8125, "equal": 0.1875, "more": 0.0, "midrank": 0.90625}, False),    # 4 = p95
    ((0, 0, 0), 1, -3, {"fewer": 0.0, "equal": 0.0, "more": 1.0, "midrank": 0.0}, True),              # 0 < p5
])
def test_national_metrics_effects_position_and_band_edges(monkeypatch, enacted, geographic, drawing, position, outside):
    monkeypatch.setattr(step, "HOUSE_SEATS", 4 + 2)
    at_large = {"WY": AtLargeState("WY", "Wyoming", "56"), "AK": AtLargeState("AK", "Alaska", "02")}
    nat = step.national_metrics(_states(enacted), at_large)
    assert nat["effects"] == {"geographic": geographic, "drawing": drawing}
    assert nat["position"] == pytest.approx(position)
    assert nat["outside_band"] is outside


# --- validation-report numbers ---------------------------------------------------------------


def test_state_checks_counts_tied_enacted_rows():
    enacted = _enacted()
    hit = (enacted.map_id == "xx_new") & (enacted.method == "whole_unit") & (enacted.district == "03")
    enacted.loc[hit, COLS] = _votes(500, 500, 300, 200)     # tie, decided by 2020 for D
    checks = step.state_checks(XX, enacted, _ensemble(), _reference())
    assert checks["ties"] == {"ensemble": 1, "enacted": 1}


def test_state_checks_counts_alarm_seats_from_the_reference():
    ref = _reference()
    ref.loc[ref.district == "01", COLS] = _votes(388, 612)      # ALARM: R wins district 01
    cd118 = step.state_checks(XX, _enacted(), _ensemble(), ref)["cd118_vs_alarm"]
    assert (cd118["seats_ours"], cd118["seats_alarm"]) == (1, 0)


def _interim(tmp_path, join_log='{"XX": {"map_2024_changed_blocks": 12}}'):
    """The interim files of 02_join.py for the made-up state XX."""
    (tmp_path / "units").mkdir()
    pd.DataFrame({"d": [1300.0], "r": [1700.0]}).to_parquet(tmp_path / "units" / "XX.parquet")
    _enacted().to_parquet(tmp_path / "enacted_districts.parquet")
    _ensemble().to_parquet(tmp_path / "ensemble_districts.parquet")
    _reference().to_parquet(tmp_path / "alarm_reference.parquet")
    (tmp_path / "join_log.json").write_text(join_log, encoding="utf-8")
    # the single-seat state WY, 2016 and 2020 added up (02_join.py, Task 5.17)
    pd.DataFrame({"state": ["WY"], "d_pre_16": [150], "r_pre_16": [350], "d_pre_20": [250], "r_pre_20": [250],
                  "d": [400], "r": [600]}).to_parquet(tmp_path / "single_seat_votes.parquet")
    return SimpleNamespace(states={"XX": XX}, at_large={"WY": AtLargeState("WY", "Wyoming", "56")})


def _small_house(monkeypatch):
    """A House of the 3 districts of XX plus WY: majority 3, WY fixed as Republican. national_majority is
    replaced by a stand-in that records its arguments (its own tests are under Task 5.7). The Senate has the
    two states XX and WY; senate_majority is replaced in the same way (Task 5.18 tests it)."""
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    monkeypatch.setattr(step, "HOUSE_MAJORITY", 3)
    monkeypatch.setattr(step, "SINGLE_SEAT_PARTY", {"WY": "R"})
    monkeypatch.setattr(step, "SENATE_STATES", 2)
    seen = {}

    def stand_in(**kwargs):
        seen.update(kwargs)
        return {"seats_needed": kwargs["needed"], "base_share": 0.0, "enacted": {"share": 0.0, "seats_at_base": 0},
                "neutral": {"share": 0.0, "low": 0.0, "high": 0.0, "probability_at_base": 0.0},
                "proportional": {"share": 0.0}}

    def senate_stand_in(votes, needed):
        seen["senate"] = (dict(votes), needed)
        return {"base_share": 0.0, "states_needed": needed, "share": 0.0, "states_at_base": 0,
                "seats_at_base": 0, "tipping": []}

    def swing_stand_in(**kwargs):
        seen["swing"] = kwargs
        return {"points": []}

    monkeypatch.setattr(step, "national_majority", stand_in)
    monkeypatch.setattr(step, "senate_majority", senate_stand_in)
    monkeypatch.setattr(step, "national_swing", swing_stand_in)   # its own tests: test_national_swing_*
    return seen


def test_compute_passes_the_slider_grid_and_the_base(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    seen = _small_house(monkeypatch)
    national = step.compute(cfg, tmp_path)["national"]
    assert seen["swing"]["grid"] == step.SWING_SHARES
    assert seen["swing"]["base"] is national and seen["swing"]["base_share"] == 0.0   # from the majority stand-in
    assert national["swing"] == {"points": []}
    # 47.0% to 56.0% in steps of 0.1 point
    assert (step.SWING_SHARES[0], step.SWING_SHARES[-1], len(step.SWING_SHARES)) == (0.47, 0.56, 91)


def test_compute_assembles_states_national_and_checks(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    _small_house(monkeypatch)
    out = step.compute(cfg, tmp_path)
    assert set(out) == {"national", "states", "checks"}
    # no 2020 shares (pre_20) in the checks since the DRA comparison is gone (Task 2.14x)
    assert set(out["checks"]) == {"plans", "ties", "cd118_vs_alarm", "whole_unit", "map_2024", "join_log", "totals"}
    assert out["states"]["XX"]["proportional"] == 1             # units 1300 D / 1700 R, as in the hand example
    assert out["checks"]["plans"] == {"XX": 4}
    assert out["checks"]["totals"] == {"district_seats": 3, "at_large": 1}
    assert out["checks"]["join_log"] == {"XX": {"map_2024_changed_blocks": 12}}
    # Task 5.6: the hand examples of state_competitive and state_redraw below
    assert out["states"]["XX"]["competitive"] == {"enacted": 0, "median": 0, "p5": 0, "p95": 2,
                                                  "neutral_dist": [2, 0, 2, 0]}
    assert out["states"]["XX"]["redraw"] == {"seats_2024": 2, "change": -1, "map_changed": True}
    # Task 5.8: the row of the 2024 map in docs/validation.md
    # 3 districts on the 2024 map, 12 moved blocks from join_log.json; 2 seats on the 2024 map and 1 on the
    # enacted map, as in test_state_redraw_compares_with_the_2024_map
    assert out["checks"]["map_2024"] == {"XX": {"districts": 3, "changed_blocks": 12, "seats_2024": 2,
                                                "seats_enacted": 1}}


def test_compute_needs_the_changed_blocks_of_02_join(tmp_path, monkeypatch):
    # a join_log.json from before the extensions has no map_2024_changed_blocks
    cfg = _interim(tmp_path, join_log='{"XX": {"units": 3}}')
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    with pytest.raises(CheckError, match="map_2024_changed_blocks"):
        step.compute(cfg, tmp_path)


def test_compute_takes_zero_changed_blocks_as_a_count(tmp_path, monkeypatch):
    # 0 is a count (35 of the 44 real states have it), not a missing value: it reaches the redraw check, which
    # stops here because the 2024 rows of XX give 2 seats against 1 on the enacted map
    cfg = _interim(tmp_path, join_log='{"XX": {"map_2024_changed_blocks": 0}}')
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    with pytest.raises(CheckError, match="redraw failed"):
        step.compute(cfg, tmp_path)


def test_main_writes_metrics_and_report(tmp_path, monkeypatch):
    import json

    metrics = {"national": {"seats": 0, "proportional": 0, "enacted": 0, "neutral": {"median": 0},
                            "single_seat": []},
               "states": {},
               "checks": {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "map_2024": {},
                          "join_log": {}}}
    (tmp_path / "data" / "interim").mkdir(parents=True)
    (tmp_path / "docs").mkdir()
    monkeypatch.setattr(step, "load_config", lambda: None)
    monkeypatch.setattr(step, "interim_dir", lambda: tmp_path / "data" / "interim")
    monkeypatch.setattr(step, "compute", lambda cfg, idir: metrics)
    monkeypatch.setattr(step, "REPO_ROOT", tmp_path)
    step.main()
    written = json.loads((tmp_path / "data" / "interim" / "metrics.json").read_text(encoding="utf-8"))
    assert written == metrics
    report = (tmp_path / "docs" / "validation.md").read_text(encoding="utf-8")
    assert report.startswith("# Validation report")


# --- main(): where it reads its inputs and how it writes the report --------------------------


def _main_setup(tmp_path, monkeypatch):
    metrics = {"national": {"seats": 0, "proportional": 0, "enacted": 0, "neutral": {"median": 0},
                            "single_seat": []},
               "states": {},
               "checks": {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "map_2024": {},
                          "join_log": {}}}
    (tmp_path / "data" / "interim").mkdir(parents=True)
    (tmp_path / "docs").mkdir()
    monkeypatch.setattr(step, "load_config", lambda: None)
    monkeypatch.setattr(step, "interim_dir", lambda: tmp_path / "data" / "interim")
    monkeypatch.setattr(step, "compute", lambda cfg, idir: metrics)
    monkeypatch.setattr(step, "REPO_ROOT", tmp_path)
    return metrics


def test_main_reads_notes_and_cross_check_files_from_the_repo_data_folder(tmp_path, monkeypatch, capsys):
    _main_setup(tmp_path, monkeypatch)
    (tmp_path / "data" / "validation_notes.yaml").write_text("AA:\n  planscore: A note kept in the repo.\n",
                                                             encoding="utf-8")
    (tmp_path / "data" / "crosscheck").mkdir()
    (tmp_path / "data" / "crosscheck" / "planscore.csv").write_text(
        "state,election,url,accessed,same_map,planscore_eg_pct,planscore_favors,district,dem_votes,rep_votes\n",
        encoding="utf-8")
    step.main()
    report = (tmp_path / "docs" / "validation.md").read_text(encoding="utf-8")
    # planscore.csv is found (header only); state_files.csv is not
    assert "Pending: 1." in report
    # AA is not in this made-up run, so its note is listed as one without an exceedance
    assert "- **AA, planscore.** A note kept in the repo." in report
    assert "Open items: 0. Pending: 1." in capsys.readouterr().out


def test_main_writes_the_report_with_lf_line_ends(tmp_path, monkeypatch):
    # docs/validation.md is tracked in git: LF on Windows too, as for results.json and the manifest
    _main_setup(tmp_path, monkeypatch)
    step.main()
    raw = (tmp_path / "docs" / "validation.md").read_bytes()
    assert b"\r" not in raw
    assert raw.endswith(b"\n") and not raw.endswith(b"\n\n")


# --- Task 5.6: competitive districts and redraws per state -------------------------------------


def test_state_competitive_counts_the_enacted_map_and_the_plans():
    res = step.state_competitive(XX, _enacted(), _ensemble())
    # enacted shares 0.6, 0.3, 0.4: none from 0.45 to 0.55
    # plans: (.65 .35 .30) -> 0; (.55 .50 .25) -> 2; (.45 .45 .40) -> 2; (.60 .40 .30) -> 0
    # plans per count 0..3: [2, 0, 2, 0]; sorted 0 0 2 2: p5 0, median 0 (2 of 4 plans reach 0), p95 2
    assert res == {"enacted": 0, "median": 0, "p5": 0, "p95": 2, "neutral_dist": [2, 0, 2, 0]}


def test_state_competitive_counts_the_bounds_on_the_enacted_map():
    # shares 0.45, 0.55 and 0.6: both bounds count -> 2
    enacted = _with_main_map(_enacted(), [(450, 550), (550, 450), (600, 400)])
    assert step.state_competitive(XX, enacted, _ensemble())["enacted"] == 2


def test_state_redraw_compares_with_the_2024_map():
    # 2024 map: 560-440 D, 520-480 D, 300-700 R -> 2 seats; enacted 1 -> change 1 - 2 = -1
    assert step.state_redraw(XX, _enacted(), 1, 12) == {"seats_2024": 2, "change": -1, "map_changed": True}


def test_state_redraw_of_an_unchanged_map():
    # the 2024 rows are a copy of the enacted rows: 1 seat on both, no block changed district
    enacted = _enacted()
    copy = enacted[enacted.map_id == "enacted"].assign(map_id="map_2024")
    enacted = pd.concat([enacted[enacted.map_id != "map_2024"], copy], ignore_index=True)
    assert step.state_redraw(XX, enacted, 1, 0) == {"seats_2024": 1, "change": 0, "map_changed": False}


def test_state_redraw_stops_when_an_unchanged_map_gives_other_seats():
    # no block changed district, yet the 2024 rows give 2 seats against 1: they belong to another map
    with pytest.raises(CheckError, match="redraw"):
        step.state_redraw(XX, _enacted(), 1, 0)


def test_state_redraw_needs_the_2024_rows():
    enacted = _enacted()
    with pytest.raises(CheckError, match="district_count"):
        step.state_redraw(XX, enacted[enacted.map_id != "map_2024"], 1, 12)


# --- Task 5.6, review: map_changed, the 2024 block rows, the redraw check, percentile levels, plan_shares ---


def _same_2024_as_enacted():
    enacted = _enacted()
    copy = enacted[enacted.map_id == "enacted"].assign(map_id="map_2024")
    return pd.concat([enacted[enacted.map_id != "map_2024"], copy], ignore_index=True)


def test_state_redraw_marks_a_changed_map_that_keeps_its_seats():
    # one block changed district, the 2024 rows are a copy of the enacted rows: 1 seat on both
    # (map_changed follows the moved blocks, not the seat difference)
    assert step.state_redraw(XX, _same_2024_as_enacted(), 1, 1) == {"seats_2024": 1, "change": 0, "map_changed": True}


def test_state_redraw_takes_other_seats_after_one_moved_block():
    # a single moved block is a redraw: it may change the seats (2 on the 2024 rows against 1)
    assert step.state_redraw(XX, _enacted(), 1, 1) == {"seats_2024": 2, "change": -1, "map_changed": True}


def test_state_redraw_takes_the_2024_seats_from_the_block_rows():
    # the whole-unit rows of 2024 flip district 02 (495 < 505); the block rows keep it (520 > 480): 2 seats
    enacted = _enacted()
    hit = (enacted.map_id == "map_2024") & (enacted.method == "whole_unit") & (enacted.district == "02")
    enacted.loc[hit, COLS] = _votes(495, 505)
    assert step.state_redraw(XX, enacted, 1, 12)["seats_2024"] == 2


def test_state_redraw_stops_when_an_unchanged_map_gains_seats():
    # the 2024 rows give 2 seats: an enacted map without moved blocks cannot have 3 either
    # (test_state_redraw_stops_when_an_unchanged_map_gives_other_seats has 1 seat, the other direction)
    with pytest.raises(CheckError, match="redraw"):
        step.state_redraw(XX, _enacted(), 3, 0)


def test_plan_shares_has_plans_as_rows_and_districts_as_columns():
    shares = step.plan_shares(_ensemble(), XX)
    # plans as rows (draw 1..4), districts as columns (01 first): plan 1 is .65 .35 .30, plan 2 .55 .50 .25 (the tie
    # in 02 is 500 of 1000), plan 3 .45 .45 .40, plan 4 .60 .40 .30
    expected = [[.65, .35, .30], [.55, .50, .25], [.45, .45, .40], [.60, .40, .30]]
    np.testing.assert_allclose(shares, expected)


def _spread_ensemble():
    # plans with 0, 1, 2 and 3 competitive districts
    plans = {
        "1": [(700, 300), (300, 700), (200, 800)],     # .70 .30 .20 -> 0
        "2": [(500, 500), (300, 700), (200, 800)],     # .50 .30 .20 -> 1
        "3": [(500, 500), (500, 500, 300, 200), (200, 800)],   # .50 .50 .20 -> 2
        "4": [(500, 500), (500, 500, 300, 200), (500, 500, 300, 200)],   # .50 .50 .50 -> 3
    }
    rows = []
    for draw, districts in plans.items():
        for i, v in enumerate(districts, start=1):
            rows.append(["XX", draw, f"{i:02d}"] + _votes(*v))
    return pd.DataFrame(rows, columns=["state", "draw", "district"] + COLS)


def test_state_competitive_percentile_levels():
    # sorted counts 0 1 2 3: p5 is the first (0), the median needs 2 of 4 plans (1), p95 needs 3.8 of 4 (3)
    res = step.state_competitive(XX, _enacted(), _spread_ensemble())
    assert (res["p5"], res["median"], res["p95"]) == (0, 1, 3)
    assert res["neutral_dist"] == [1, 1, 1, 1]


# --- Task 5.7: majority thresholds, competitive districts and redraws for the nation ------------


def test_seats_needed_counts_the_single_seat_states_fixed_as_democratic():
    at_large = {p: AtLargeState(p, p, "00") for p in ("AK", "DE", "ND", "SD", "VT", "WY")}
    # 218 of 435 for a majority; DE and VT are fixed as Democratic -> 216 of the 429 districts
    assert step.seats_needed(at_large) == 216


def test_seats_needed_stops_on_other_single_seat_states():
    with pytest.raises(CheckError, match="single_seat_party"):
        step.seats_needed({"WY": AtLargeState("WY", "Wyoming", "56")})


# The two made-up states of Task 5.5 in tests/test_metrics.py, with their turning points.
AA_PLANS = np.array([[0.60005, 0.40005], [0.55005, 0.52005], [0.45505, 0.30005], [0.51005, 0.49005]])
BB_PLANS = np.array([[0.70005, 0.47005], [0.48995, 0.46005]])
MAJORITY_ARGS = {"base_share": 0.5, "needed": 3, "enacted_shares": [0.6, 0.47005, 0.52, 0.4],
                 "plan_shares": [AA_PLANS, BB_PLANS], "state_shares": [0.72005, 0.40005], "state_seats": [2, 2],
                 "seats_at_base": 2, "neutral_pmf": [0.125, 0.375, 0.375, 0.125, 0.0]}


def test_national_majority_hand_example():
    res = step.national_majority(**MAJORITY_ARGS)
    assert (res["seats_needed"], res["base_share"]) == (3, 0.5)
    # enacted: high to low 0.6, 0.52, 0.47005, 0.4; the third is 0.47005 -> swing 0.02995, share 0.52995
    assert res["enacted"] == pytest.approx({"share": 0.52995, "seats_at_base": 2})
    # neutral (Task 5.5): 5% at -0.02, 50% at +0.0101, 95% at +0.045; at the base 3 or more: 0.125 + 0
    assert res["neutral"] == pytest.approx({"share": 0.5101, "low": 0.48, "high": 0.545, "probability_at_base": 0.125})
    # proportional (Task 5.5): +0.03
    assert res["proportional"] == pytest.approx({"share": 0.53})


def test_national_majority_stops_when_the_enacted_threshold_is_far_off():
    # needed 4: the fourth share is 0.4 -> swing +0.1, 10 points from the base share
    with pytest.raises(CheckError, match="majority_threshold.*enacted maps"):
        step.national_majority(**{**MAJORITY_ARGS, "needed": 4, "enacted_shares": [0.6, 0.47005, 0.52, 0.4]})


# The guard on the enacted threshold, both signs, just inside and just outside 5 points (Task 5.7 review)
def _third(share):
    # needed 3: the third highest enacted share decides the swing 0.5 - share
    return {**MAJORITY_ARGS, "enacted_shares": [0.9, 0.8, share, 0.4]}


@pytest.mark.parametrize("third, share", [(0.45005, 0.54995), (0.54995, 0.45005)])
def test_enacted_guard_lets_4_995_points_through(third, share):
    # swing +0.04995 and -0.04995 from the base share 0.5
    assert step.national_majority(**_third(third))["enacted"]["share"] == pytest.approx(share)


@pytest.mark.parametrize("third", [0.44995, 0.55005])
def test_enacted_guard_stops_at_5_005_points(third):
    # swing +0.05005 and -0.05005
    with pytest.raises(CheckError, match="majority_threshold.*enacted maps"):
        step.national_majority(**_third(third))


def test_national_majority_stops_when_a_grid_threshold_is_far_off():
    # plans with both districts at 0.3 and 0.2: no plan reaches 3 districts within +5 points
    low = np.array([[0.30005, 0.20005]])
    with pytest.raises(CheckError, match="majority_threshold.*neutral maps"):
        step.national_majority(**{**MAJORITY_ARGS, "plan_shares": [low, low]})
    # proportional: the second state at 0.15005 + 0.05 = 0.20005 keeps 0 seats (2 * 0.20005 = 0.4001), the first
    # reaches 2: 3 seats are out of reach within +5 points
    with pytest.raises(CheckError, match="majority_threshold.*proportional"):
        step.national_majority(**{**MAJORITY_ARGS, "state_shares": [0.72005, 0.15005]})


# The vote slider (plan 2026-10-08-vote-slider): the grid, the base point and the checks
SWING_BASE = {"proportional": 2, "enacted": 2, "neutral": {"median": 1, "p5": 0, "p95": 3}, "position": {"more": 0.125}}
SWING_ARGS = {"base_share": 0.5, "base": SWING_BASE, "state_shares": [0.72005, 0.40005], "state_seats": [2, 2],
              "plan_shares": [AA_PLANS, BB_PLANS], "enacted_shares": [0.6, 0.47005, 0.52, 0.4], "grid": [0.52, 0.485]}


def test_national_swing_hand_example():
    points = step.national_swing(**SWING_ARGS)["points"]
    # sorted by share, the base point between the two grid points
    assert [p["share"] for p in points] == [0.485, 0.5, 0.52]
    assert [p["base"] for p in points] == [False, True, False]
    low, base, high = points
    # -0.015: enacted 0.585, 0.45505, 0.505, 0.385 -> 2; proportional 2 * 0.70505 -> 1, 2 * 0.38505 = 0.7701 -> 1
    # AA plans 1, 2, 0, 0 -> [0.5, 0.25, 0.25]; BB 1, 0 -> [0.5, 0.5]; sum [0.25, 0.375, 0.25, 0.125, 0]
    # cumulative 0.25, 0.625, 0.875, 1 -> 5th 0, median 1, 95th 3; more than 2: 0.125
    assert (low["proportional"], low["enacted"], low["neutral"]) == (2, 2, {"median": 1, "p5": 0, "p95": 3})
    assert low["more"] == pytest.approx(0.125)
    # the base point takes the main numbers
    assert (base["proportional"], base["enacted"], base["neutral"], base["more"]) == (2, 2, SWING_BASE["neutral"], 0.125)
    # +0.02: enacted 0.62, 0.49005, 0.54, 0.42 -> 2; proportional 2 * 0.74005 = 1.4801 -> 1, 2 * 0.42005 -> 1
    # neutral as in test_majority_probability_convolves_the_states at +0.02: [0, 0.25, 0.25, 0.5, 0]
    assert (high["proportional"], high["enacted"], high["neutral"]) == (2, 2, {"median": 2, "p5": 1, "p95": 3})
    assert high["more"] == pytest.approx(0.5)


def test_national_swing_stops_when_a_count_falls_as_the_share_rises():
    # a base with 3 enacted districts lies above the 2 at 0.52
    with pytest.raises(CheckError, match="swing_monotone.*enacted"):
        step.national_swing(**{**SWING_ARGS, "base": {**SWING_BASE, "enacted": 3}})


def test_national_swing_stops_at_5_points_from_the_base_share():
    # 0.44 lies 6 points below 0.5, outside the range of the fixed one-seat states
    with pytest.raises(CheckError, match="swing_range"):
        step.national_swing(**{**SWING_ARGS, "grid": [0.44, 0.52]})


def test_national_competitive_convolves_the_states():
    # competitive counts per plan, as in test_national_metrics: A [1, 3], B [2, 2], C [0, 1, 1]
    # P = [0, 0.0625, 0.3125, 0.4375, 0.1875]; cumulative 0, .0625, .375, .8125, 1 -> median 3, p5 1, p95 4
    def state(dist, enacted):
        return {"competitive": {"enacted": enacted, "neutral_dist": dist}}

    res = step.national_competitive({"AA": state([1, 3], 1), "BB": state([2, 2], 0), "CC": state([0, 1, 1], 2)})
    assert (res["enacted"], res["median"], res["p5"], res["p95"]) == (3, 3, 1, 4)    # enacted 1 + 0 + 2
    assert res["neutral_dist"] == pytest.approx([0, 0.0625, 0.3125, 0.4375, 0.1875])


def test_national_redraw_sums_the_states():
    states = {"AA": {"enacted": 3, "redraw": {"seats_2024": 5}}, "BB": {"enacted": 2, "redraw": {"seats_2024": 1}}}
    # 2024 maps: 5 + 1 = 6; enacted 3 + 2 = 5; change 5 - 6 = -1
    assert step.national_redraw(states) == {"seats_2024": 6, "change": -1}


def test_compute_adds_majority_competitive_and_redraw(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    seen = _small_house(monkeypatch)
    out = step.compute(cfg, tmp_path)
    nat = out["national"]
    # 4 seats, majority 3, WY Republican -> 3 of the 3 districts
    assert seen["needed"] == 3 and nat["majority"]["seats_needed"] == 3
    # units: 1300 D and 1700 R
    assert seen["base_share"] == pytest.approx(1300 / 3000)
    assert seen["state_shares"] == pytest.approx([1300 / 3000]) and seen["state_seats"] == [3]
    # enacted shares 0.6, 0.3, 0.4; one Democratic district at the base
    assert sorted(seen["enacted_shares"]) == pytest.approx([0.3, 0.4, 0.6])
    assert seen["seats_at_base"] == 1
    assert [shares.shape for shares in seen["plan_shares"]] == [(4, 3)]
    # the neutral distribution of the seats: plans give 1, 2, 0, 1 -> [0.25, 0.5, 0.25, 0]
    assert seen["neutral_pmf"] == pytest.approx([0.25, 0.5, 0.25, 0.0])
    # one state: the national numbers are those of XX (Task 5.6), with probabilities
    assert nat["competitive"] == {"enacted": 0, "median": 0, "p5": 0, "p95": 2,
                                  "neutral_dist": pytest.approx([0.5, 0.0, 0.5, 0.0])}
    assert nat["redraw"] == {"seats_2024": 2, "change": -1}


# --- Task 5.7, review: the base share, the levels, the wiring of compute and the single-seat parties -------------


def test_national_majority_adds_the_swings_to_the_base_share():
    # every published share starts from base_share (the hand example has base_share 0.5)
    res = step.national_majority(**{**MAJORITY_ARGS, "base_share": 0.52})
    assert res["base_share"] == 0.52
    # the swings of the hand example (+0.02995, +0.0101, -0.02, +0.045, +0.03) on 0.52
    assert res["enacted"]["share"] == pytest.approx(0.54995)
    assert res["neutral"] == pytest.approx({"share": 0.5301, "low": 0.5, "high": 0.565, "probability_at_base": 0.125})
    assert res["proportional"]["share"] == pytest.approx(0.55)


def test_probability_at_base_is_read_from_the_given_distribution():
    # plan choice 6: the plans give P(3 or more) = 0.125 at swing 0; the given distribution (tie rule) says 1.0
    res = step.national_majority(**{**MAJORITY_ARGS, "neutral_pmf": [0.0, 0.0, 0.0, 0.5, 0.5]})
    assert res["neutral"]["probability_at_base"] == 1.0


def test_national_majority_levels_are_5_50_and_95_percent():
    # one state, one district, 20 plans: plan j (0..19) turns Democratic at grid step 10 j (share 0.50005 - 0.001 j),
    # so P(1 district) at step k is (k // 10 + 1) / 20: 5% at step 0, 50% at step 90, 95% at step 180
    plans = np.array([[0.50005 - 0.001 * j] for j in range(20)])
    res = step.national_majority(base_share=0.5, needed=1, enacted_shares=[0.52], plan_shares=[plans],
                                 state_shares=[0.50005], state_seats=[1], seats_at_base=0, neutral_pmf=[0.95, 0.05])
    assert res["neutral"] == pytest.approx({"share": 0.509, "low": 0.5, "high": 0.518, "probability_at_base": 0.05})


def test_compute_passes_needed_enacted_seats_and_plan_shares(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    _with_main_map(_enacted(), [(600, 400)] * 3).to_parquet(tmp_path / "enacted_districts.parquet")   # enacted 3
    seen = _small_house(monkeypatch)
    monkeypatch.setattr(step, "SINGLE_SEAT_PARTY", {"WY": "D"})     # one Democratic single-seat state: 3 - 1 = 2
    nat = step.compute(cfg, tmp_path)["national"]
    assert (nat["enacted"], nat["proportional"], nat["neutral"]["median"]) == (3, 1, 1)
    assert (seen["seats_at_base"], seen["needed"]) == (3, 2)
    np.testing.assert_allclose(seen["plan_shares"][0],
                               [[.65, .35, .30], [.55, .50, .25], [.45, .45, .40], [.60, .40, .30]])


def test_seats_needed_stops_on_an_extra_single_seat_state():
    six = {p: AtLargeState(p, p, "00") for p in ("AK", "DE", "ND", "SD", "VT", "WY")}
    with pytest.raises(CheckError, match="single_seat_party"):
        step.seats_needed({**six, "MT": AtLargeState("MT", "Montana", "30")})


def test_single_seat_party_is_owner_decision_1():
    assert step.SINGLE_SEAT_PARTY == {"AK": "R", "DE": "D", "ND": "R", "SD": "R", "VT": "D", "WY": "R"}


def test_national_competitive_p95_is_the_95th_percentile():
    # one state, P = [0.1, 0.8, 0.1]; cumulative 0.1, 0.9, 1: p95 is 2 (0.9 < 0.95), the 90th percentile would be 1
    res = step.national_competitive({"AA": {"competitive": {"enacted": 1, "neutral_dist": [1, 8, 1]}}})
    assert (res["p5"], res["median"], res["p95"]) == (0, 1, 2)


def test_compute_collects_the_inputs_of_every_state(tmp_path, monkeypatch):
    # the national inputs are collected state by state: a second state YY, a copy of XX with the votes turned around
    cfg = _interim(tmp_path)
    yy = dataclasses.replace(XX, postal="YY", fips="98")
    pd.DataFrame({"d": [1700.0], "r": [1300.0]}).to_parquet(tmp_path / "units" / "YY.parquet")      # XX has 1300 D, 1700 R
    for name, frame in {"enacted_districts": _enacted(), "ensemble_districts": _ensemble(),
                        "alarm_reference": _reference()}.items():
        both = pd.concat([frame, frame.assign(state="YY")], ignore_index=True)
        both.to_parquet(tmp_path / f"{name}.parquet")
    (tmp_path / "join_log.json").write_text('{"XX": {"map_2024_changed_blocks": 12}, '
                                            '"YY": {"map_2024_changed_blocks": 12}}', encoding="utf-8")
    cfg = SimpleNamespace(states={"XX": XX, "YY": yy}, at_large=cfg.at_large)
    seen = _small_house(monkeypatch)
    monkeypatch.setattr(step, "HOUSE_SEATS", 6 + 1)
    monkeypatch.setattr(step, "HOUSE_MAJORITY", 6)
    monkeypatch.setattr(step, "SENATE_STATES", 2 + 1)      # Task 5.19: XX, YY and WY
    step.compute(cfg, tmp_path)
    # 3000 D of 6000 votes; XX first (1300 / 3000), then YY (1700 / 3000)
    assert seen["base_share"] == pytest.approx(0.5)
    assert seen["state_shares"] == pytest.approx([1300 / 3000, 1700 / 3000]) and seen["state_seats"] == [3, 3]
    assert len(seen["enacted_shares"]) == 6 and [shares.shape for shares in seen["plan_shares"]] == [(4, 3), (4, 3)]
    # the Senate block gets the unit votes of both states and WY from single_seat_votes.parquet
    assert seen["senate"][0] == {"XX": (1300.0, 1700.0), "YY": (1700.0, 1300.0), "WY": (400.0, 600.0)}


# --- Task 5.12: the overview per control and per body ----------------------------------------


def test_national_by_sums_states_seats_and_drawing_effects():
    cfg_states = {
        "AA": dataclasses.replace(XX, postal="AA", seats=4, adopted_by="Legislature", control="Republican"),
        "BB": dataclasses.replace(XX, postal="BB", seats=6, adopted_by="Legislature", control="Republican"),
        "CC": dataclasses.replace(XX, postal="CC", seats=2, adopted_by="Court", control="Nonpartisan"),
    }
    states = {"AA": {"effects": {"drawing": -2}}, "BB": {"effects": {"drawing": 1}}, "CC": {"effects": {"drawing": 0}}}
    # Republican: AA and BB, 4 + 6 = 10 seats, drawing -2 + 1 = -1; Nonpartisan: CC, 2 seats, 0
    # every value of the design's table is listed, in that order, also without states
    assert step.national_by(states, cfg_states, "control") == {
        "Republican": {"states": 2, "seats": 10, "drawing": -1},
        "Democratic": {"states": 0, "seats": 0, "drawing": 0},
        "Bipartisan": {"states": 0, "seats": 0, "drawing": 0},
        "Nonpartisan": {"states": 1, "seats": 2, "drawing": 0},
    }
    # dict equality ignores the order; results.json keeps it (plan, choice 8)
    assert list(step.national_by(states, cfg_states, "control")) == ["Republican", "Democratic", "Bipartisan",
                                                                      "Nonpartisan"]
    by_body = step.national_by(states, cfg_states, "adopted_by")
    assert list(by_body) == ["Legislature", "Commission", "Court"]
    assert by_body["Legislature"] == {"states": 2, "seats": 10, "drawing": -1}
    assert by_body["Court"] == {"states": 1, "seats": 2, "drawing": 0}


def test_compute_adds_the_overview_per_control_and_body(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    _small_house(monkeypatch)
    nat = step.compute(cfg, tmp_path)["national"]
    # XX: Legislature, Republican, 3 seats, drawing effect enacted 1 - median 1 = 0
    assert nat["by_control"]["Republican"] == {"states": 1, "seats": 3, "drawing": 0}
    assert nat["by_body"]["Legislature"] == {"states": 1, "seats": 3, "drawing": 0}
    assert sum(v["states"] for v in nat["by_control"].values()) == 1


# --- Task 5.19: the Senate block ------------------------------------------------------------------


def test_senate_needs_26_of_the_50_states():
    # 51 of 100 seats; at 50-50 the vice president, a Republican since January 2025, decides; two seats per state
    assert (step.SENATE_STATES, step.SENATE_STATES_NEEDED) == (50, 26)


def test_read_single_seat_votes(tmp_path):
    pd.DataFrame({"state": ["WY"], "d": [400], "r": [600]}).to_parquet(tmp_path / "single_seat_votes.parquet")
    wyoming = {"WY": AtLargeState("WY", "Wyoming", "56")}
    assert step.read_single_seat_votes(tmp_path, wyoming) == {"WY": (400.0, 600.0)}
    # config.yaml and the file of 02_join.py must name the same states
    with pytest.raises(CheckError, match="senate_states"):
        step.read_single_seat_votes(tmp_path, {**wyoming, "AK": AtLargeState("AK", "Alaska", "02")})


def test_read_single_seat_votes_needs_the_file_of_02_join(tmp_path):
    with pytest.raises(CheckError, match="interim_files"):
        step.read_single_seat_votes(tmp_path, {"WY": AtLargeState("WY", "Wyoming", "56")})


def test_national_senate_needs_every_state():
    with pytest.raises(CheckError, match="senate_states"):
        step.national_senate({"AA": (1.0, 2.0)})


def test_national_senate_uses_the_number_of_states_needed(monkeypatch):
    # the five states of the Senate tests in tests/test_metrics.py, as if they were all the states
    monkeypatch.setattr(step, "SENATE_STATES", 5)
    monkeypatch.setattr(step, "SENATE_STATES_NEEDED", 3)
    votes = {"AA": (600, 400), "BB": (300, 700), "CC": (550, 450), "DD": (480, 520), "EE": (450, 550)}
    res = step.national_senate(votes)
    # 0.476 + 0.5 - 0.48 = 0.496; ranks 3 - 2 to 3 + 2, high to low
    assert (res["states_needed"], res["share"]) == (3, pytest.approx(0.496))
    assert [t["postal"] for t in res["tipping"]] == ["AA", "CC", "DD", "EE", "BB"]


def test_compute_adds_the_senate(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    seen = _small_house(monkeypatch)
    nat = step.compute(cfg, tmp_path)["national"]
    # XX: the votes of its units, 1300 D and 1700 R; WY: 400 D and 600 R from single_seat_votes.parquet
    assert seen["senate"] == ({"XX": (1300.0, 1700.0), "WY": (400.0, 600.0)}, 26)
    assert nat["senate"]["states_needed"] == 26


# --- Task 5.19, review: the Senate state checks in both directions and the read order ----------------------


def test_read_single_seat_votes_needs_exactly_the_states_of_config(tmp_path):
    wyoming = {"WY": AtLargeState("WY", "Wyoming", "56")}
    path = tmp_path / "single_seat_votes.parquet"
    # an extra state (here one with districts), another state with the same count, a state twice
    for states in (["WY", "XX"], ["AK"], ["WY", "WY"]):
        pd.DataFrame({"state": states, "d": [400] * len(states), "r": [600] * len(states)}).to_parquet(path)
        with pytest.raises(CheckError, match="senate_states"):
            step.read_single_seat_votes(tmp_path, wyoming)


def test_national_senate_needs_exactly_50_states():
    for n in (49, 51):
        votes = {f"S{i:02d}": (float(i + 1), 60.0) for i in range(n)}
        with pytest.raises(CheckError, match="senate_states"):
            step.national_senate(votes)


def test_compute_reads_single_seat_votes_before_the_states(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    (tmp_path / "single_seat_votes.parquet").unlink()
    _small_house(monkeypatch)

    def no_state(*args, **kwargs):
        raise AssertionError("compute reached the state loop")

    monkeypatch.setattr(step, "state_metrics", no_state)
    with pytest.raises(CheckError, match="interim_files"):
        step.compute(cfg, tmp_path)


def test_compute_puts_the_senate_after_by_body(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    _small_house(monkeypatch)
    assert list(step.compute(cfg, tmp_path)["national"])[-3:] == ["by_control", "by_body", "senate"]
