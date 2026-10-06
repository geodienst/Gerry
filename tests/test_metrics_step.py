"""Tests for pipeline/03_metrics.py on a made-up state with 3 seats and 4 plans.
Every expected value is worked out by hand in the comments."""
import dataclasses
import importlib.util
from pathlib import Path

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
    notes=())

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
    assert checks["plans"] == 4
    # one tied district in the plans (plan 2, district 02), none in the maps
    assert checks["ties"] == {"ensemble": 1, "enacted": 0}
    ref = checks["cd118_vs_alarm"]
    # ours 0.61 / 0.30 / 0.39 against ALARM 0.612 / 0.299 / 0.389; one D seat each
    assert [r["district"] for r in ref["districts"]] == ["01", "02", "03"]
    assert ref["districts"][0] == pytest.approx({"district": "01", "ours": 0.61, "alarm": 0.612})
    assert (ref["seats_ours"], ref["seats_alarm"]) == (1, 1)
    whole = checks["whole_unit"]
    assert len(whole) == 6
    flipped = [w for w in whole if w["block_dem"] != w["whole_dem"]]
    assert flipped == [pytest.approx({"map_id": "xx_new", "district": "02", "block": 0.51, "whole": 0.495,
                                      "block_dem": True, "whole_dem": False})]
    # 2020 shares on the enacted map are half the composite on both sides: 0.6, 0.3, 0.4
    assert checks["pre_20"] == pytest.approx({"01": 0.6, "02": 0.3, "03": 0.4})


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
