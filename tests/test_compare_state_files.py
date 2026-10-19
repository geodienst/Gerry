import importlib.util

import pandas as pd
import pytest

from gerry.config import REPO_ROOT
from gerry.validation import STATE_FILES_COLUMNS

spec = importlib.util.spec_from_file_location("compare_state_files", REPO_ROOT / "tools" / "compare_state_files.py")
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


def series(d):
    s = pd.Series(d, dtype="str")
    s.index.name = "block_id"
    return s


CENSUS = series({"b1": "01", "b2": "01", "b3": "02", "b4": "02", "b5": "ZZ"})


def test_identical_block_files():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2", "b4": "2"}))
    assert out == {"blocks_census": 4, "blocks_state": 4, "only_census": 0, "only_state": 0,
                   "blocks_matching": 4, "share_blocks": 1.0, "share_vap": None,
                   "district_mapping": "01=01;02=02", "one_to_one": True}


def test_renumbered_districts_are_matched_by_largest_overlap():
    census = series({"c1": "01", "c2": "01", "c3": "01", "c4": "02", "c5": "02", "c6": "02"})
    # the state calls district 01 "2" and district 02 "1"; c3 sits in the other district
    official = series({"c1": "2", "c2": "2", "c3": "1", "c4": "1", "c5": "1", "c6": "1"})
    out = tool.compare_assignments(census, official)
    assert out["district_mapping"] == "01=02;02=01"
    assert out["blocks_matching"] == 5
    assert out["share_blocks"] == pytest.approx(5 / 6)
    assert out["one_to_one"] is True


def test_blocks_missing_on_either_side_are_counted():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2", "x9": "2"}))
    assert (out["only_census"], out["only_state"], out["blocks_matching"]) == (1, 1, 3)
    assert out["share_blocks"] == 0.75


def test_share_vap_weights_blocks_by_voting_age_population():
    vap = pd.Series({"b1": 10, "b2": 0, "b3": 30, "b4": 60})
    # b4 lies outside every official shape: 40 of 100 adults confirmed
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2"}), vap)
    assert out["share_vap"] == pytest.approx(0.4)
    assert out["only_census"] == 1


def test_mapping_that_is_not_one_to_one_is_flagged():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "1", "b4": "1"}))
    assert out["district_mapping"] == "01=01;02=01"
    assert out["one_to_one"] is False


def test_a_block_in_another_district_is_neither_missing_nor_confirmed():
    # c1 is the first block of 01 and lies in the state's district 2; most of 01 is state district 1.
    # c7 is a CD120 water block (ZZ): its VAP is not part of the denominator.
    census = series({"c1": "01", "c2": "01", "c3": "01", "c4": "02", "c5": "02", "c6": "02", "c7": "ZZ"})
    official = series({"c1": "2", "c2": "1", "c3": "1", "c4": "2", "c5": "2", "c6": "2"})
    vap = pd.Series({"c1": 50, "c2": 10, "c3": 10, "c4": 10, "c5": 10, "c6": 10, "c7": 900})
    out = tool.compare_assignments(census, official, vap)
    assert out["district_mapping"] == "01=01;02=02"
    assert (out["only_census"], out["only_state"], out["blocks_matching"]) == (0, 0, 5)
    assert out["share_vap"] == pytest.approx(0.5)


def test_a_district_with_no_block_in_the_state_source_is_not_one_to_one():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1"}))
    assert (out["district_mapping"], out["one_to_one"]) == ("01=01", False)
    assert tool.result_text("block_file", out) == (
        "2 of 4 blocks differ; 2 only in CD120, 0 only in the state file. The district mapping is not one-to-one")


def test_result_text():
    same = {"blocks_census": 4, "blocks_state": 4, "only_census": 0, "only_state": 0, "blocks_matching": 4,
            "share_blocks": 1.0, "share_vap": None, "district_mapping": "01=01;02=02", "one_to_one": True}
    assert tool.result_text("block_file", same) == "Identical, block for block (4 blocks)"
    shapes = {**same, "blocks_matching": 3, "share_blocks": 0.75, "share_vap": 0.999991, "only_census": 1}
    assert tool.result_text("shapes", shapes) == (
        "75.0000% of 4 block points (99.9991% of voting-age population) lie in the matching district. "
        "Outside every district shape: 1")
    renumbered = {**same, "district_mapping": "01=02;02=01"}
    assert tool.result_text("block_file", renumbered) == (
        "Identical, block for block (4 blocks), with other district numbers: 01=02;02=01")


def test_a_block_file_that_merges_districts_is_not_called_identical():
    # every block matches once both CD120 districts map to state district 1, but the two are one there
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "1", "b4": "1"}))
    assert (out["blocks_matching"], out["one_to_one"]) == (4, False)
    assert tool.result_text("block_file", out) == (
        "0 of 4 blocks differ; 0 only in CD120, 0 only in the state file, "
        "with other district numbers: 01=01;02=01. The district mapping is not one-to-one")


def test_rows_have_the_columns_the_report_reads():
    # gerry.validation.read_crosscheck accepts exactly STATE_FILES_COLUMNS, in this order
    result = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2", "b4": "2"}))
    row = tool.make_row("MO", tool.SOURCES["MO"], "2026-10-05", result)
    assert list(row) == list(STATE_FILES_COLUMNS)
    assert (row["state"], row["map"], row["source_kind"], row["retrieved"]) == (
        "MO", "HB 1 of 2025", "block_file", "2026-10-05")
    assert row["result"] == "Identical, block for block (4 blocks)"
