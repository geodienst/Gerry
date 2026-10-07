"""Tests for pipeline/03_metrics.py on a made-up state with 3 seats and 4 plans.
Every expected value is worked out by hand in the comments."""
import dataclasses
import importlib.util
from pathlib import Path
from types import SimpleNamespace

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


def test_state_checks_pre_20_uses_2020_columns():
    enacted = _enacted()
    hit = (enacted.map_id == "enacted") & (enacted.method == "block") & (enacted.district == "01")
    enacted.loc[hit, COLS] = _votes(600, 400, 270, 230)     # 2020: 270 / 500 = 0.54, composite 0.6
    checks = step.state_checks(XX, enacted, _ensemble(), _reference())
    assert checks["pre_20"]["01"] == pytest.approx(0.54)


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
    return SimpleNamespace(states={"XX": XX}, at_large={"WY": AtLargeState("WY", "Wyoming", "56")})


def test_compute_assembles_states_national_and_checks(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    out = step.compute(cfg, tmp_path)
    assert set(out) == {"national", "states", "checks"}
    assert out["states"]["XX"]["proportional"] == 1             # units 1300 D / 1700 R, as in the hand example
    assert out["checks"]["plans"] == {"XX": 4}
    assert out["checks"]["totals"] == {"district_seats": 3, "at_large": 1}
    assert out["checks"]["join_log"] == {"XX": {"map_2024_changed_blocks": 12}}
    # Task 5.6: the hand examples of state_competitive and state_redraw below
    assert out["states"]["XX"]["competitive"] == {"enacted": 0, "median": 0, "p5": 0, "p95": 2,
                                                  "neutral_dist": [2, 0, 2, 0]}
    assert out["states"]["XX"]["redraw"] == {"seats_2024": 2, "change": -1, "map_changed": True}


def test_compute_needs_the_changed_blocks_of_02_join(tmp_path, monkeypatch):
    # a join_log.json from before the extensions has no map_2024_changed_blocks
    cfg = _interim(tmp_path, join_log='{"XX": {"units": 3}}')
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    with pytest.raises(CheckError, match="map_2024_changed_blocks"):
        step.compute(cfg, tmp_path)


def test_main_writes_metrics_and_report(tmp_path, monkeypatch):
    import json

    metrics = {"national": {"seats": 0, "proportional": 0, "enacted": 0, "neutral": {"median": 0},
                            "single_seat": []},
               "states": {},
               "checks": {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {},
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
               "checks": {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {},
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
    (tmp_path / "data" / "validation_notes.yaml").write_text("AA:\n  dra: A note kept in the repo.\n",
                                                             encoding="utf-8")
    (tmp_path / "data" / "crosscheck").mkdir()
    (tmp_path / "data" / "crosscheck" / "dra.csv").write_text(
        "state,map_name,url,accessed,district,dem,rep\n", encoding="utf-8")
    step.main()
    report = (tmp_path / "docs" / "validation.md").read_text(encoding="utf-8")
    # dra.csv is found (header only); planscore.csv and state_files.csv are not
    assert "Pending: 2." in report
    # AA is not in this made-up run, so its note is listed as one without an exceedance
    assert "- **AA, dra.** A note kept in the repo." in report
    assert "Open items: 0. Pending: 2." in capsys.readouterr().out


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
