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
    assert "- AA planscore_reproduction: PlanScore +5.00, ours +6.67" in report


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
