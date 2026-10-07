"""Tests for gerry/validation.py on a small made-up metrics dict and cross-check files."""
import copy

import pytest

from gerry import validation as v
from gerry.metrics import efficiency_gap

PLANSCORE_HEADER = "state,election,url,accessed,same_map,planscore_eg_pct,planscore_favors,district,dem_votes,rep_votes\n"
DRA_HEADER = "state,map_name,url,accessed,district,dem,rep\n"
STATE_FILES_HEADER = ("state,map,source_kind,source_url,retrieved,blocks_census,blocks_state,only_census,"
                      "only_state,blocks_matching,share_blocks,share_vap,district_mapping,one_to_one,result\n")

METRICS = {
    "national": {"seats": 5, "proportional": 2, "enacted": 3, "neutral": {"median": 2},
                 "single_seat": [{"postal": "WY", "fips": "56", "name": "Wyoming"}]},
    "states": {"AA": {"eg": {"value": 0.05}}, "BB": {"eg": {"value": -0.01}}},
    "checks": {
        "plans": {"AA": 5000, "BB": 4999},
        "ties": {"AA": {"ensemble": 2, "enacted": 0}, "BB": {"ensemble": 0, "enacted": 0}},
        "cd118_vs_alarm": {
            # AA: largest difference 0.001 (0.100 points), seats equal -> ok
            "AA": {"districts": [{"district": "01", "ours": 0.401, "alarm": 0.400},
                                 {"district": "02", "ours": 0.620, "alarm": 0.620},
                                 {"district": "03", "ours": 0.550, "alarm": 0.5505}],
                   "seats_ours": 2, "seats_alarm": 2},
            # BB: district 02 differs by 0.007 (0.700 points) -> exceedance
            "BB": {"districts": [{"district": "01", "ours": 0.450, "alarm": 0.451},
                                 {"district": "02", "ours": 0.507, "alarm": 0.500}],
                   "seats_ours": 1, "seats_alarm": 0},
        },
        "whole_unit": {
            "AA": [{"map_id": "enacted", "district": "01", "block": 0.400, "whole": 0.401, "block_dem": False, "whole_dem": False},
                   {"map_id": "enacted", "district": "02", "block": 0.620, "whole": 0.618, "block_dem": True, "whole_dem": True},
                   {"map_id": "enacted", "district": "03", "block": 0.501, "whole": 0.499, "block_dem": True, "whole_dem": False}],
            "BB": [{"map_id": "enacted", "district": "01", "block": 0.45, "whole": 0.45, "block_dem": False, "whole_dem": False},
                   {"map_id": "enacted", "district": "02", "block": 0.51, "whole": 0.51, "block_dem": True, "whole_dem": True}],
        },
        "pre_20": {"AA": {"01": 0.40, "02": 0.62, "03": 0.55}, "BB": {"01": 0.45, "02": 0.51}},
        # same shape as 02_join.py writes: counts, counts per map, ALARM's reference map
        "join_log": {"AA": {"units": 30, "empty_weight_fields": 4, "units_zero_vap": 3,
                            "unlinked_blocks": 5, "unlinked_keys": 2,
                            "maps": {"enacted": {"split_units": 7, "zero_vap_split_units": 1,
                                                 "block_count_votes": 20.3, "weight_fallback_units": 0},
                                     "check_2022": {"split_units": 5, "zero_vap_split_units": 0,
                                                    "block_count_votes": 0.0, "weight_fallback_units": 0}},
                            "reference_share": 0.9812, "reference_labels": {"01": "02", "02": "01"},
                            "plans": 5000},
                     "BB": {"units": 12, "empty_weight_fields": 0, "units_zero_vap": 0,
                            "unlinked_blocks": 0, "unlinked_keys": 0,
                            "maps": {"enacted": {"split_units": 1, "zero_vap_split_units": 0,
                                                 "block_count_votes": 0.0, "weight_fallback_units": 2},
                                     "check_2022": {"split_units": 1, "zero_vap_split_units": 0,
                                                    "block_count_votes": 0.0, "weight_fallback_units": 2}},
                            "reference_share": 1.0, "reference_labels": {},
                            "plans": 4999}},
        "totals": {"district_seats": 5, "at_large": 1},
    },
}


@pytest.fixture
def crosscheck(tmp_path):
    d = tmp_path / "crosscheck"
    d.mkdir()
    # AA: (60, 40) D wins, (30, 70) R, (45, 55) R
    # wasted D = 10 + 30 + 45 = 85, wasted R = 40 + 20 + 5 = 65, all votes 300
    # EG = 20 / 300 = 0.0667: 6.67 points, PlanScore prints 6.7 favoring Republicans
    rows = ["AA,2024 U.S. House,https://planscore.org/x,2026-10-12,yes,6.7,Republicans,%s,%d,%d" % r
            for r in (("01", 60, 40), ("02", 30, 70), ("03", 45, 55))]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    # AA 2020 two-party shares from DRA: 40.0, 62.0 and 55.8 (0.8 points above our 55.0)
    rows = ["AA,Plan A,https://davesredistricting.org/x,2026-10-12,%s,%s,%s" % r
            for r in (("01", "40.00", "60.00"), ("02", "62.00", "38.00"), ("03", "55.80", "44.20"))]
    (d / "dra.csv").write_text(DRA_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    return d


@pytest.fixture
def notes(tmp_path):
    p = tmp_path / "validation_notes.yaml"
    p.write_text("BB:\n  cd118_vs_alarm: >\n    ALARM's reference plan for BB is the 2021 map.\n"
                 "AA:\n  planscore: PlanScore uses 2024 House votes; we use 2016 and 2020 president.\n"
                 "CC:\n  dra: Left over from an earlier run.\n", encoding="utf-8")
    return p


def test_report_counts_open_and_pending(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # open: AA whole_unit (district 03 flips), AA dra (0.800 points), BB plans (4999)
    # explained: BB cd118_vs_alarm, AA planscore; pending: state_files.csv
    assert "**Open items: 3.** Pending: 1." in report
    assert "- AA whole_unit: enacted district 03 has another winner" in report
    assert "- AA dra: largest difference 0.800 points" in report
    assert "- BB plans: 4999 plans, expected 5000" in report
    assert "- data/crosscheck/state_files.csv not found" in report


def test_report_cd118_section(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    assert "| AA | 3 | 0.100 | 2 | 2 | ok |" in report
    assert "| BB | 2 | 0.700 | 1 | 0 | explained |" in report
    # districts above 0.5 points are listed with both shares
    assert "| BB | 02 | 50.70% | 50.00% | 0.700 |" in report


def test_report_planscore_section(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # PlanScore +6.70, ours on their votes +6.67, equal-turnout +6.67, our composite +5.00
    assert "| AA | 2024 U.S. House | +6.70 | +6.67 | +6.67 | ok | +5.00 | yes | explained | https://planscore.org/x (2026-10-12) |" in report
    # the sentence above the table names the column that has to match PlanScore
    assert ("\"Equal-turnout formula\" is PlanScore's own formula on its own district votes; "
            "it must match PlanScore to the rounding of its printed value") in report


def test_report_lists_explanations_and_unused_notes(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    assert "- **BB, cd118_vs_alarm.** ALARM's reference plan for BB is the 2021 map." in report
    assert "- **CC, dra.** Left over from an earlier run." in report.split("## Explanations without an exceedance")[1]


def test_report_tables_for_logs(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # counts per state: the whole-number fields in log order, then reference_share as a percentage
    assert ("| State | units | empty_weight_fields | units_zero_vap | unlinked_blocks | unlinked_keys | plans | "
            "reference_share |") in report
    assert "| AA | 30 | 4 | 3 | 5 | 2 | 5000 | 98.12% |" in report
    assert "| BB | 12 | 0 | 0 | 0 | 0 | 4999 | 100.00% |" in report
    # per map: split_units, zero_vap_split_units, block_count_votes (votes, one decimal), weight_fallback_units
    assert "| AA | enacted | 7 | 1 | 20.3 | 0 |" in report
    assert "| BB | check_2022 | 1 | 0 | 0.0 | 2 |" in report
    # only states whose cd_2020 districts take another label from map.rds
    assert "- AA: 01 -> 02, 02 -> 01" in report
    assert "- BB:" not in report
    assert "| AA | 5000 | 2 | 0 | ok |" in report


def test_report_state_files_section(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    rows = [
        # AA, shapes: 200 CD120 blocks, 197 in the matching district (2 outside every shape, 1 elsewhere)
        "AA,Plan A,shapes,https://example.org/a,2026-10-05,200,198,2,0,197,0.985,0.999,01=01;02=02;03=03,True,"
        "98.5000% of 200 block points lie in the matching district",
        # BB, block file: identical; the result text holds a comma, so it is quoted
        'BB,Plan B,block_file,https://example.org/b,2026-10-05,100,100,0,0,100,1.0,,01=01;02=02,True,'
        '"Identical, block for block (100 blocks)"',
    ]
    (d / "state_files.csv").write_text(STATE_FILES_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    report = v.build_report(METRICS, d, notes)
    # 200 - 197 = 3 blocks outside the matching district; no note for AA state_files -> open
    assert "- AA state_files: 3 of 200 blocks outside the matching district, 0 only in the state source" in report
    assert ("| BB | Plan B | block_file | 100 | 0 | 0 | Identical, block for block (100 blocks) | ok | "
            "https://example.org/b (2026-10-05) |") in report
    # planscore.csv and dra.csv are missing from this folder
    assert "Pending: 2." in report


def test_report_without_crosscheck_files(tmp_path):
    report = v.build_report(METRICS, tmp_path, tmp_path / "missing.yaml")
    assert "Pending: 3." in report


def test_report_has_no_em_dash(crosscheck, notes):
    em_dash = chr(0x2014)
    assert em_dash not in v.build_report(METRICS, crosscheck, notes)


def test_failed_reproduction_is_open(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    rows = ["AA,2024 U.S. House,https://planscore.org/x,2026-10-12,yes,5.0,Republicans,%s,%d,%d" % r
            for r in (("01", 60, 40), ("02", 30, 70), ("03", 45, 55))]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    report = v.build_report(METRICS, d, notes)
    assert "- AA planscore_reproduction: PlanScore +5.00, equal-turnout formula +6.67" in report


def test_planscore_comparison_signs_and_tolerance(tmp_path):
    p = tmp_path / "planscore.csv"
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,01,40,60",
            "AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,02,70,30",
            "AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,03,55,45"]
    p.write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    [row] = v.planscore_comparison(v.read_crosscheck(p, v.PLANSCORE_COLUMNS))
    # mirror of the fixture: our EG = -20 / 300; PlanScore "6.7 favoring Democrats" -> -0.067
    assert row["planscore"] == pytest.approx(-0.067)
    assert row["reproduced"] == pytest.approx(-20 / 300)
    # one decimal in percent: half of 0.1 point = 0.0005 as a fraction
    assert row["tolerance"] == pytest.approx(0.0005)


def test_planscore_rows_must_agree_within_a_plan(tmp_path):
    p = tmp_path / "planscore.csv"
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,01,40,60",
            "AA,2024 U.S. House,u,2026-10-12,yes,6.8,Democrats,02,70,30"]
    p.write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="planscore_eg_pct"):
        v.planscore_comparison(v.read_crosscheck(p, v.PLANSCORE_COLUMNS))


def test_equal_turnout_gap_differs_from_wasted_votes():
    # (80, 20) T 100 D wins; (10, 30) T 40 R wins; (25, 35) T 60 R wins
    # wasted votes: D 30 + 10 + 25 = 65, R 20 + 10 + 5 = 35 -> (65 - 35) / 200 = 0.15
    # equal turnout: V = 115 / 200 = 0.575, S = 1/3 -> 2 * 0.075 - (1/3 - 0.5) = 0.31667
    d, r = [80, 10, 25], [20, 30, 35]
    win = [True, False, False]
    assert efficiency_gap(d, r, win) == pytest.approx(0.15)
    assert v.equal_turnout_gap(d, r, win) == pytest.approx(0.15 + 1 / 6)


def test_read_crosscheck_rejects_wrong_columns(tmp_path):
    p = tmp_path / "dra.csv"
    p.write_text("state,district,dem\nAA,01,40\n", encoding="utf-8")
    with pytest.raises(ValueError, match="columns"):
        v.read_crosscheck(p, v.DRA_COLUMNS)
    assert v.read_crosscheck(tmp_path / "none.csv", v.DRA_COLUMNS) is None


def test_load_notes_rejects_unknown_check(tmp_path):
    p = tmp_path / "notes.yaml"
    p.write_text("AA:\n  typo_check: text\n", encoding="utf-8")
    with pytest.raises(ValueError, match="typo_check"):
        v.load_notes(p)


def test_dra_unknown_district_raises(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    (d / "dra.csv").write_text(DRA_HEADER + "AA,Plan A,u,2026-10-12,09,40,60\n", encoding="utf-8")
    with pytest.raises(ValueError, match="AA district 09"):
        v.build_report(copy.deepcopy(METRICS), d, notes)


# --- every status condition and report number pinned on its own ------------------------------


def _with(**checks):
    """A copy of METRICS with some of its checks replaced."""
    m = copy.deepcopy(METRICS)
    m["checks"].update(checks)
    return m


def _cd118_only(districts, seats_ours, seats_alarm):
    return _with(cd118_vs_alarm={"AA": {"districts": districts, "seats_ours": seats_ours,
                                        "seats_alarm": seats_alarm}})


def _dra_dir(tmp_path, rows):
    d = tmp_path / "cc"
    d.mkdir()
    (d / "dra.csv").write_text(DRA_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    return d


def test_report_seat_totals_section(crosscheck, notes):
    m = copy.deepcopy(METRICS)
    m["national"].update(proportional=1, enacted=3)
    m["national"]["neutral"]["median"] = 4
    report = v.build_report(m, crosscheck, notes)
    # 5 district seats in 2 states plus 1 at-large seat (WY) is 6; other seats = 5 minus Democratic seats
    assert "District seats: 5 in 2 states. At-large seats: 1 (WY). Together: 6." in report
    assert "| Proportional | 1 | 4 |" in report
    assert "| Neutral baseline (median) | 4 | 1 |" in report
    assert "| Enacted | 3 | 2 |" in report


def test_report_sections_come_in_the_order_of_the_brief(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    headings = [line[3:] for line in report.splitlines() if line.startswith("## ")]
    assert headings == ["Seat totals", "CD118 maps against ALARM cd_2020",
                        "Whole-unit assignment against block allocation", "Plans and ties", "Join log",
                        "PlanScore", "Dave's Redistricting App", "CD120 against state files",
                        "Explanations", "Explanations without an exceedance"]


def test_cd118_other_seat_count_is_open_although_shares_agree(tmp_path):
    # 0.5005 against 0.4995 is 0.100 points, inside the threshold, but only ours has the Democratic win
    m = _cd118_only([{"district": "01", "ours": 0.5005, "alarm": 0.4995}], 1, 0)
    report = v.build_report(m, tmp_path, tmp_path / "none.yaml")
    assert "- AA cd118_vs_alarm: largest difference 0.100 points, D seats 1 against 0" in report
    assert "| AA | 1 | 0.100 | 1 | 0 | open |" in report


def test_cd118_share_difference_is_open_although_seats_agree(tmp_path):
    # the Tennessee case: the same seats, one district 0.7 points apart (0.757 - 0.750)
    m = _cd118_only([{"district": "01", "ours": 0.757, "alarm": 0.750}], 1, 1)
    report = v.build_report(m, tmp_path, tmp_path / "none.yaml")
    assert "- AA cd118_vs_alarm: largest difference 0.700 points, D seats 1 against 1" in report


@pytest.mark.parametrize("ours, points, status", [(0.505, "0.500", "ok"), (0.5051, "0.510", "open")])
def test_cd118_threshold_is_at_most_half_a_point(tmp_path, ours, points, status):
    # 0.505 - 0.500 is exactly 0.5 points ("at most": in order); 0.5051 - 0.500 is 0.51 points: open
    m = _cd118_only([{"district": "01", "ours": ours, "alarm": 0.500}], 1, 1)
    report = v.build_report(m, tmp_path, tmp_path / "none.yaml")
    assert f"| AA | 1 | {points} | 1 | 1 | {status} |" in report


def test_more_than_5000_plans_is_open_too(tmp_path):
    m = _with(plans={"AA": 5001, "BB": 5000})
    report = v.build_report(m, tmp_path, tmp_path / "none.yaml")
    assert "- AA plans: 5001 plans, expected 5000" in report
    assert "| BB | 5000 | 0 | 0 | ok |" in report


def test_whole_unit_is_judged_per_map(tmp_path):
    m = _with(whole_unit={"AA": [
        # enacted: nobody changes winner; differences +1.0 and -2.0 points, so the largest is 2.000
        {"map_id": "enacted", "district": "01", "block": 0.520, "whole": 0.510, "block_dem": True, "whole_dem": True},
        {"map_id": "enacted", "district": "02", "block": 0.400, "whole": 0.420, "block_dem": False, "whole_dem": False},
        # alt: both districts change winner; 0.4 points each
        {"map_id": "alt", "district": "01", "block": 0.502, "whole": 0.498, "block_dem": True, "whole_dem": False},
        {"map_id": "alt", "district": "02", "block": 0.499, "whole": 0.503, "block_dem": False, "whole_dem": True}]})
    report = v.build_report(m, tmp_path, tmp_path / "none.yaml")
    assert "| AA | enacted | 2.000 | none | ok |" in report
    assert "| AA | alt | 0.400 | 01, 02 | open |" in report
    assert "- AA whole_unit: alt districts 01, 02 have another winner" in report


def test_dra_section_rows_and_districts_above_the_threshold(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # 55.80 / (55.80 + 44.20) = 55.80% against our 55.00%: 0.800 points
    assert "| AA | Plan A | 3 of 3 | 0.800 | open | https://davesredistricting.org/x (2026-10-12) |" in report
    assert "| AA | 03 | 55.80% | 55.00% | 0.800 |" in report


def test_dra_takes_votes_as_well_as_percentages(tmp_path, notes):
    # only dem / (dem + rep) counts: 4000 / 10000 = 0.40, 6200 / 10000 = 0.62, 5500 / 10000 = 0.55
    d = _dra_dir(tmp_path, ["AA,Plan A,https://dra.example/a,2026-10-12,%s,%d,%d" % r
                            for r in (("01", 4000, 6000), ("02", 6200, 3800), ("03", 5500, 4500))])
    report = v.build_report(METRICS, d, notes)
    assert "| AA | Plan A | 3 of 3 | 0.000 | ok | https://dra.example/a (2026-10-12) |" in report


def test_dra_missing_district_is_open_although_the_rest_agrees(tmp_path, notes):
    d = _dra_dir(tmp_path, ["AA,Plan A,u,2026-10-12,%s,%d,%d" % r for r in (("01", 40, 60), ("02", 62, 38))])
    report = v.build_report(METRICS, d, notes)
    assert "- AA dra: largest difference 0.000 points, 2 of 3 districts" in report
    assert "| AA | Plan A | 2 of 3 | 0.000 | open |" in report


def test_dra_district_listed_twice_raises(tmp_path, notes):
    d = _dra_dir(tmp_path, ["AA,Plan A,u,2026-10-12,%s,%d,%d" % r
                            for r in (("01", 40, 60), ("01", 40, 60), ("02", 62, 38))])
    with pytest.raises(ValueError, match="AA lists a district twice"):
        v.build_report(METRICS, d, notes)


def test_state_files_each_condition_alone_is_open(tmp_path):
    d = tmp_path / "cc"
    d.mkdir()
    rows = [
        # only_state alone: all 100 blocks match, the state's file has 5 more
        "AA,Plan A,block_file,https://example.org/a,2026-10-05,100,105,0,5,100,1.0,,01=01,True,Five extra | blocks",
        # one_to_one alone
        "AA,Plan B,shapes,https://example.org/b,2026-10-05,100,100,0,0,100,1.0,,01=01;02=01,False,Two districts to one",
        # blocks_matching alone: 3 of 100 blocks lie elsewhere
        "AA,Plan C,shapes,https://example.org/c,2026-10-05,100,100,0,0,97,0.97,,01=01,True,Three blocks elsewhere"]
    (d / "state_files.csv").write_text(STATE_FILES_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    report = v.build_report(METRICS, d, d / "none.yaml")
    assert "- AA state_files: 0 of 100 blocks outside the matching district, 5 only in the state source\n" in report
    assert ("- AA state_files: 0 of 100 blocks outside the matching district, 0 only in the state source, "
            "district matching not one-to-one\n") in report
    assert "- AA state_files: 3 of 100 blocks outside the matching district, 0 only in the state source\n" in report
    # columns: CD120 blocks, outside the matching district, only in the state source; a pipe is escaped
    assert "| AA | Plan A | block_file | 100 | 0 | 5 | Five extra \\| blocks | open |" in report


def test_note_on_a_check_that_is_in_order_is_listed_as_unused(crosscheck, tmp_path):
    p = tmp_path / "notes.yaml"
    p.write_text("AA:\n  cd118_vs_alarm: Left over from an earlier run.\n", encoding="utf-8")
    report = v.build_report(METRICS, crosscheck, p)          # AA cd118_vs_alarm is in order in METRICS
    assert "| AA | 3 | 0.100 | 2 | 2 | ok |" in report
    used, unused = report.split("## Explanations without an exceedance")
    assert "Left over from an earlier run." not in used
    assert "- **AA, cd118_vs_alarm.** Left over from an earlier run." in unused


def test_planscore_equal_turnout_column_is_its_own_number(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    # (80, 20), (10, 30), (25, 35): wasted-votes EG 0.15, equal-turnout 0.15 + 1/6 = 0.31667
    # PlanScore prints 31.7, the equal-turnout number: "Reproduced" judges that column, not ours (+15.00)
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,31.7,Republicans,%s,%d,%d" % r
            for r in (("01", 80, 20), ("02", 10, 30), ("03", 25, 35))]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    [row] = v.planscore_comparison(v.read_crosscheck(d / "planscore.csv", v.PLANSCORE_COLUMNS))
    assert row["reproduced"] == pytest.approx(0.15)
    assert row["equal_turnout"] == pytest.approx(0.15 + 1 / 6)
    report = v.build_report(METRICS, d, notes)
    assert "| AA | 2024 U.S. House | +31.70 | +15.00 | +31.67 | ok | +5.00 | yes | explained | u (2026-10-12) |" in report


def test_reproduction_is_judged_on_the_equal_turnout_number_not_on_ours(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    # same votes as above, but PlanScore prints 15.0: that is our wasted-votes number (+15.00),
    # not the equal-turnout number (+31.67), so the reproduction is open
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,15.0,Republicans,%s,%d,%d" % r
            for r in (("01", 80, 20), ("02", 10, 30), ("03", 25, 35))]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    report = v.build_report(METRICS, d, notes)
    assert "- AA planscore_reproduction: PlanScore +15.00, equal-turnout formula +31.67" in report
    assert "| AA | 2024 U.S. House | +15.00 | +15.00 | +31.67 | open | +5.00 | yes | explained | u (2026-10-12) |" in report


def _planscore_csv(tmp_path, printed, votes):
    d = tmp_path / "cc"
    d.mkdir()
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,%s,Republicans,%s,%d,%d" % (printed, *r) for r in votes]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    return d


@pytest.mark.parametrize("printed, status", [("31.7", "ok"), ("31.6", "open")])
def test_reproduction_limit_is_half_the_last_printed_decimal(tmp_path, notes, printed, status):
    # (80,20),(10,30),(25,35): equal-turnout 31.667 points; one printed decimal allows 0.05
    d = _planscore_csv(tmp_path, printed, (("01", 80, 20), ("02", 10, 30), ("03", 25, 35)))
    assert "| +31.67 | %s | +5.00 |" % status in v.build_report(METRICS, d, notes)


def test_reproduction_exactly_half_a_decimal_away_is_in_order(tmp_path, notes):
    # (21000,9000) wins, (2010,7990) loses: V = 23010/40000 = 0.57525, S = 0.5, so equal-turnout
    # is 0.1505 (15.05 points), exactly 0.05 from the printed 15.0; wasted votes (8010-11990)/40000 = -9.95
    d = _planscore_csv(tmp_path, "15.0", (("01", 21000, 9000), ("02", 2010, 7990)))
    assert "| +15.00 | -9.95 | +15.05 | ok | +5.00 |" in v.build_report(METRICS, d, notes)


@pytest.mark.parametrize("printed, tolerance", [("7", 0.005), ("6.7", 0.0005), ("6.75", 0.00005)])
def test_planscore_tolerance_is_half_the_last_printed_decimal(tmp_path, printed, tolerance):
    p = tmp_path / "planscore.csv"
    rows = [f"AA,2024 U.S. House,u,2026-10-12,yes,{printed},Democrats,{d},{dv},{rv}"
            for d, dv, rv in (("01", 40, 60), ("02", 70, 30), ("03", 55, 45))]
    p.write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    [row] = v.planscore_comparison(v.read_crosscheck(p, v.PLANSCORE_COLUMNS))
    assert row["tolerance"] == pytest.approx(tolerance)


@pytest.mark.parametrize("text, message", [("AA:\n  plans: ''\n", "empty explanation for AA plans"),
                                           ("AA: just text\n", "AA must map check names")])
def test_load_notes_rejects_empty_text_and_flat_layout(tmp_path, text, message):
    p = tmp_path / "notes.yaml"
    p.write_text(text, encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        v.load_notes(p)


def test_read_crosscheck_strips_spaces_around_values(tmp_path):
    p = tmp_path / "dra.csv"
    p.write_text(DRA_HEADER + "AA, Plan A , https://dra.example/a , 2026-10-12 , 01 , 40 , 60 \n", encoding="utf-8")
    df = v.read_crosscheck(p, v.DRA_COLUMNS)
    assert df.iloc[0].tolist() == ["AA", "Plan A", "https://dra.example/a", "2026-10-12", "01", "40", "60"]


@pytest.mark.parametrize("column, other", [("url", "u2"), ("accessed", "2026-10-13"), ("same_map", "no"),
                                           ("planscore_eg_pct", "6.8"), ("planscore_favors", "Democrats")])
def test_planscore_rows_must_agree_on_every_plan_level_column(tmp_path, column, other):
    first = ["AA", "2024 U.S. House", "u", "2026-10-12", "yes", "6.7", "Republicans", "01", "40", "60"]
    second = ["AA", "2024 U.S. House", "u", "2026-10-12", "yes", "6.7", "Republicans", "02", "70", "30"]
    second[v.PLANSCORE_COLUMNS.index(column)] = other
    p = tmp_path / "planscore.csv"
    p.write_text(PLANSCORE_HEADER + ",".join(first) + "\n" + ",".join(second) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match=column):
        v.planscore_comparison(v.read_crosscheck(p, v.PLANSCORE_COLUMNS))


def test_note_text_is_folded_to_one_line(tmp_path):
    p = tmp_path / "notes.yaml"
    p.write_text("BB:\n  cd118_vs_alarm: |\n    District 02 differs by 0.7 points.\n    ALARM assigns whole VTDs.\n",
                 encoding="utf-8")
    assert v.load_notes(p) == {("BB", "cd118_vs_alarm"): "District 02 differs by 0.7 points. ALARM assigns whole VTDs."}


@pytest.mark.parametrize("check", ["cd118_vs_alarm", "whole_unit", "plans", "planscore_reproduction",
                                   "planscore", "dra", "state_files"])
def test_load_notes_accepts_each_check_of_the_brief(tmp_path, check):
    p = tmp_path / "notes.yaml"
    p.write_text(f"AA:\n  {check}: Text.\n", encoding="utf-8")
    assert v.load_notes(p) == {("AA", check): "Text."}
