import pandas as pd
import pytest

from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_units_linked, check_vap)


def units_table():
    return pd.DataFrame({"unit_id": ["U1", "U2", "U3"], "vap": [30, 0, 5],
                         "d_pre_20": [30.0, 6.0, 0.0], "r_pre_20": [60.0, 0.0, 0.0],
                         "d": [30.0, 6.0, 0.0], "r": [60.0, 0.0, 0.0]})


def blocks_table():
    return pd.DataFrame({"block_id": ["b1", "b2", "b3", "b4"], "vap": [10, 20, 0, 5]})


UNIT_OF = pd.Series(["U1", "U1", "U2", "U3"], index=["b1", "b2", "b3", "b4"])
DISTRICT_OF = pd.Series(["01", "02", "01", "ZZ"], index=["b1", "b2", "b3", "b4"])


# ---- check_units_linked ----

def test_units_linked_passes_when_units_with_votes_have_a_block():
    # U3 has only a ZZ block, but no votes
    check_units_linked(units_table(), UNIT_OF, DISTRICT_OF, "NV")


def test_units_linked_fails_for_a_unit_with_votes_in_zz_only():
    district_of = DISTRICT_OF.copy()
    district_of["b3"] = "ZZ"
    with pytest.raises(CheckError, match="units_linked failed for NV.*U2"):
        check_units_linked(units_table(), UNIT_OF, district_of, "NV")


def test_units_linked_fails_for_a_unit_with_votes_without_blocks():
    units = pd.concat([units_table(), pd.DataFrame({"unit_id": ["U4"], "vap": [0], "d_pre_20": [1.0],
                                                    "r_pre_20": [0.0], "d": [1.0], "r": [0.0]})],
                      ignore_index=True)
    with pytest.raises(CheckError, match="U4"):
        check_units_linked(units, UNIT_OF, DISTRICT_OF, "NV")


# ---- check_vap ----

def test_vap_passes_when_blocks_add_up_to_units():
    check_vap(units_table(), blocks_table(), UNIT_OF, "NV")


def test_vap_fails_when_a_unit_differs():
    blocks = blocks_table()
    blocks.loc[1, "vap"] = 21
    with pytest.raises(CheckError, match="vap failed for NV.*U1.*30.*31"):
        check_vap(units_table(), blocks, UNIT_OF, "NV")


def test_vap_fails_for_block_vap_outside_the_unit_file():
    blocks = pd.concat([blocks_table(), pd.DataFrame({"block_id": ["b5"], "vap": [3]})], ignore_index=True)
    unit_of = pd.concat([UNIT_OF, pd.Series(["U9"], index=["b5"])])
    with pytest.raises(CheckError, match="U9"):
        check_vap(units_table(), blocks, unit_of, "NV")


def test_vap_fails_for_block_vap_without_a_unit():
    blocks = pd.concat([blocks_table(), pd.DataFrame({"block_id": ["b5"], "vap": [3]})], ignore_index=True)
    with pytest.raises(CheckError, match="vap failed for NV.*b5"):
        check_vap(units_table(), blocks, UNIT_OF, "NV")


# ---- check_conservation ----

def test_conservation_passes_within_tolerance():
    totals = pd.DataFrame({"district": ["01", "02"], "d": [12.0, 24.0 + 1e-9]})
    check_conservation(units_table(), totals, ["d"], "NV")


def test_conservation_fails_when_votes_go_missing():
    totals = pd.DataFrame({"district": ["01", "02"], "d": [12.0, 23.9]})
    with pytest.raises(CheckError, match="conservation failed for NV: d"):
        check_conservation(units_table(), totals, ["d"], "NV")


# ---- check_ensemble_totals ----

def ensemble_table(draw2_d):
    # two plans with two districts; unit totals are d_pre_20 36, r_pre_20 60
    return pd.DataFrame({"draw": ["1", "1", "2", "2"], "district": ["01", "02", "01", "02"],
                         "d_pre_20": [20.0, 16.0, 20.0, draw2_d], "r_pre_20": [30.0, 30.0, 30.0, 30.0]})


def test_ensemble_totals_pass_within_half_a_vote_per_district():
    # limit 0.5 * 2 districts = 1 vote; draw 2 is 1 vote off
    check_ensemble_totals(ensemble_table(17.0), units_table(), ["pre_20"], 2, "NV")


def test_ensemble_totals_fail_beyond_the_limit():
    with pytest.raises(CheckError, match="ensemble_totals failed for NV: d_pre_20.*draw 2"):
        check_ensemble_totals(ensemble_table(17.5), units_table(), ["pre_20"], 2, "NV")


# ---- check_district_count ----

def test_district_count_passes_for_01_to_seats():
    check_district_count(pd.DataFrame({"district": ["02", "01"]}), 2, "NV")


def test_district_count_fails_for_a_missing_district():
    with pytest.raises(CheckError, match="district_count failed for NV"):
        check_district_count(pd.DataFrame({"district": ["01", "03"]}), 2, "NV")


# ---- check_geoids ----

def test_geoids_pass_for_15_digit_text_with_state_fips():
    check_geoids(pd.Series(["010010201001000", "010010201001001"]), "01", "AL")


@pytest.mark.parametrize("ids", [["10010201001000"], ["320010201001000"], ["01001020100100A"],
                                 ["010010201001000", "010010201001000"]])
def test_geoids_fail_for_bad_ids(ids):
    with pytest.raises(CheckError, match="geoids failed for AL"):
        check_geoids(pd.Series(ids), "01", "AL")


def test_geoids_fail_for_numbers():
    with pytest.raises(CheckError, match="text"):
        check_geoids(pd.Series([10010201001000]), "01", "AL")
