import logging

import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.config import StateConfig
from gerry.units import UnitsError, add_composite, load_units, select_columns


def make_state(postal, fips, unit_source, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name="Test", fips=fips, seats=2, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_source=unit_source, extra_maps=(), notes=())


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# ---- select_columns ----

def test_select_columns_returns_the_dem_and_rep_column():
    cols = ["GEOID20", "pre_16_rep_tru", "pre_16_dem_cli", "uss_16_dem_cor", "pre_20_dem_bid", "pre_20_rep_tru"]
    assert select_columns(cols, "pre_16") == ("pre_16_dem_cli", "pre_16_rep_tru")


def test_select_columns_matches_only_at_the_start():
    cols = ["pre_20_dem_bid", "pre_20_rep_tru", "xpre_20_dem_a", "sos_r20_rep_b"]
    assert select_columns(cols, "pre_20") == ("pre_20_dem_bid", "pre_20_rep_tru")


def test_select_columns_without_a_match_fails():
    with pytest.raises(UnitsError, match="pre_16"):
        select_columns(["pre_20_dem_bid", "pre_20_rep_tru"], "pre_16")


def test_select_columns_with_two_matches_fails():
    with pytest.raises(UnitsError, match="pre_16_dem_cli, pre_16_dem_oth"):
        select_columns(["pre_16_dem_cli", "pre_16_dem_oth", "pre_16_rep_tru"], "pre_16")


# ---- load_units ----

VTD_CSV = """GEOID20,state,county,vtd,pop,vap,pre_16_rep_tru,pre_16_dem_cli,uss_16_dem_x,uss_16_rep_y,pre_20_dem_bid,pre_20_rep_tru
01001000010,AL,Autauga County,000010,1741,1334,529.2,164.7,1,2,172.8,510.4
01003008-03,AL,Baldwin County,008-03,10,8,2.5,1.5,1,2,3,4
"""


def test_load_units_reads_a_vtd_file(tmp_path):
    write(tmp_path / "census_vest" / "al_2020_vtd.csv", VTD_CSV)
    units = load_units(make_state("AL", "01", "vtd"), tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["01001000010", "01003008-03"]   # text, leading zero kept
    assert units["vap"].dtype == np.int64 and units["vap"].tolist() == [1334, 8]
    assert units["d_pre_16"].tolist() == [164.7, 1.5]
    assert units["r_pre_20"].dtype == np.float64 and units["r_pre_20"].tolist() == [510.4, 4.0]
    assert units.attrs["empty_vote_fields"] == 0


BLOCK_CSV = """GEOID20,state,county,pop,vap,pre_16_dem_cli,pre_16_rep_tru,pre_20_dem_bid,pre_20_rep_tru,arv_16
060014001001000,CA,Alameda County,0,0,0,0,0,0,NA
060490003001452,CA,Modoc County,0,0,NA,NA,NA,NA,NA
060014001001001,CA,Alameda County,12,10,2.5,1.25,3,1,0
"""


def test_load_units_sets_empty_vote_fields_of_a_block_file_to_zero(tmp_path, caplog):
    write(tmp_path / "census_vest" / "ca_2020_block.csv", BLOCK_CSV)
    with caplog.at_level(logging.INFO, logger="gerry.units"):
        units = load_units(make_state("CA", "06", "block"), tmp_path)
    assert units["unit_id"].tolist() == ["060014001001000", "060490003001452", "060014001001001"]
    assert units.loc[1, ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]].tolist() == [0.0, 0.0, 0.0, 0.0]
    assert units.attrs["empty_vote_fields"] == 4
    assert units.attrs["empty_vote_units"] == 1
    assert "CA: 4 empty vote fields in 1 units set to 0" in caplog.text


def test_load_units_rejects_duplicate_unit_ids(tmp_path):
    write(tmp_path / "census_vest" / "al_2020_vtd.csv", VTD_CSV + VTD_CSV.splitlines()[1] + "\n")
    with pytest.raises(UnitsError, match="01001000010"):
        load_units(make_state("AL", "01", "vtd"), tmp_path)


def write_county_map(path, ids, vap=(9895.0, 44965.0)):
    path.parent.mkdir(parents=True, exist_ok=True)
    rdata.write_rds(path, {
        "GEOID": np.array(ids, dtype=object),
        "NAME": np.array(["Monroe County, West Virginia", "Jefferson County, West Virginia"], dtype=object),
        "state": np.array(["WV", "WV"], dtype=object),
        "county": np.array(["063", "037"], dtype=object),
        "vap": np.array(vap),
        "pre_20_rep_tru": np.array([5068.0, 15033.0]),
        "pre_20_dem_bid": np.array([1345.0, 12127.0]),
        "adj": [np.array([1], dtype=np.int32), np.array([0], dtype=np.int32)],
    })


def test_load_units_reads_counties_from_the_alarm_map(tmp_path):
    write_county_map(tmp_path / "alarm" / "WV_cd_2020_map.rds", ["54063", "54037"])
    units = load_units(make_state("WV", "54", "rds_county", elections=("pre_20",)), tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["54063", "54037"]
    assert units["vap"].tolist() == [9895, 44965]
    assert units["d_pre_20"].tolist() == [1345.0, 12127.0]


def test_load_units_needs_one_county_id_column(tmp_path):
    write_county_map(tmp_path / "alarm" / "WV_cd_2020_map.rds", ["Monroe", "Jefferson"])
    with pytest.raises(UnitsError, match="county GEOID"):
        load_units(make_state("WV", "54", "rds_county", elections=("pre_20",)), tmp_path)


def test_load_units_rejects_fractional_vap(tmp_path):
    write_county_map(tmp_path / "alarm" / "WV_cd_2020_map.rds", ["54063", "54037"], vap=(9895.5, 44965.0))
    with pytest.raises(UnitsError, match="vap"):
        load_units(make_state("WV", "54", "rds_county", elections=("pre_20",)), tmp_path)


# ---- add_composite ----

def test_add_composite_sums_two_elections():
    df = pd.DataFrame({"unit_id": ["a"], "d_pre_16": [10.0], "r_pre_16": [20.0], "d_pre_20": [1.5], "r_pre_20": [2.5]})
    out = add_composite(df, ["pre_16", "pre_20"])
    # d = 10 + 1.5, r = 20 + 2.5
    assert (out.loc[0, "d"], out.loc[0, "r"]) == (11.5, 22.5)
    assert "d" not in df.columns


def test_add_composite_with_one_election_copies_it():
    df = pd.DataFrame({"unit_id": ["a"], "d_pre_20": [1345.0], "r_pre_20": [5068.0]})
    out = add_composite(df, ["pre_20"])
    assert (out.loc[0, "d"], out.loc[0, "r"]) == (1345.0, 5068.0)
