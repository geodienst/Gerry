import logging

import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.blocks import read_pl_counties
from gerry.config import StateConfig, data_dir
from gerry.units import UnitsError, add_composite, load_units, read_block_votes, select_columns, unit_ids


def make_state(postal, fips, unit_kind, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name="Test", fips=fips, seats=2, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_kind=unit_kind, extra_maps=(), notes=(),
                       adopted_by="Legislature", control="Republican", adopted_note=None)


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


# ---- unit_ids (spec chapter 4, "Eenheid-ID's in map.rds") ----

NV = make_state("NV", "32", "vtd")
CA = make_state("CA", "06", "tract")
ME = make_state("ME", "23", "tract")
IA = make_state("IA", "19", "county")


def test_unit_ids_of_a_vtd_state_are_geoid():
    # VTD codes can hold letters and dashes, as in New Hampshire (ALTO01) and Alabama (008-03)
    table = pd.DataFrame({"GEOID": ["32001000001", "32003ALTO01", "32003008-03"],
                          "vtd": ["000001", "ALTO01", "008-03"]})
    assert unit_ids(table, NV).tolist() == ["32001000001", "32003ALTO01", "32003008-03"]


def test_unit_ids_of_a_vtd_state_must_be_county_plus_vtd():
    table = pd.DataFrame({"GEOID": ["32001000001", "32001000002"], "vtd": ["000001", "000003"]})
    with pytest.raises(UnitsError, match="32001000002"):
        unit_ids(table, NV)


def test_unit_ids_of_ca_and_hi_come_from_the_tract_column():
    # CA and HI have no GEOID column; tract holds the 11-character tract GEOID
    table = pd.DataFrame({"tract": ["06001400100", "06049000300"], "county": ["Alameda County", "Modoc County"]})
    assert unit_ids(table, CA).tolist() == ["06001400100", "06049000300"]


def test_unit_ids_prefer_geoid_over_a_short_tract_column():
    # Maine: GEOID is the tract GEOID, tract only the 6-digit tract code
    table = pd.DataFrame({"GEOID": ["23019000500"], "tract": ["000500"]})
    assert unit_ids(table, ME).tolist() == ["23019000500"]


COUNTIES = pd.DataFrame({"county_id": ["19001", "19003", "19005"],
                         "name": ["Adair County", "Adams County", "Allamakee County"]})


def test_unit_ids_of_iowa_come_from_the_county_names():
    table = pd.DataFrame({"county": ["Adams County", "Adair County"]})
    assert unit_ids(table, IA, COUNTIES).tolist() == ["19003", "19001"]


def test_unit_ids_of_iowa_need_a_matching_county_name():
    table = pd.DataFrame({"county": ["Adair County", "Adair"]})
    with pytest.raises(UnitsError, match="'Adair' \\(0 matches\\)"):
        unit_ids(table, IA, COUNTIES)


def test_unit_ids_of_iowa_need_a_unique_county_name():
    counties = pd.concat([COUNTIES, pd.DataFrame({"county_id": ["19007"], "name": ["Adams County"]})])
    table = pd.DataFrame({"county": ["Adair County", "Adams County"]})
    with pytest.raises(UnitsError, match="'Adams County' \\(2 matches\\)"):
        unit_ids(table, IA, counties)


def test_unit_ids_of_iowa_need_the_county_records():
    with pytest.raises(UnitsError, match="county records"):
        unit_ids(pd.DataFrame({"county": ["Adair County"]}), IA)


@pytest.mark.parametrize("ids, message", [
    (["0600140010", "06001400200"], "11 characters"),      # ten characters
    (["32001400100", "06001400200"], "starting with 06"),  # another state
    (["06001400100", "06001400100"], "duplicate"),
    (["06001400100", None], "without id"),
])
def test_unit_ids_are_checked(ids, message):
    table = pd.DataFrame({"tract": pd.array(ids, dtype="str")})
    with pytest.raises(UnitsError, match=message):
        unit_ids(table, CA)


def test_unit_ids_need_an_id_column():
    with pytest.raises(UnitsError, match="no id column"):
        unit_ids(pd.DataFrame({"vtd": ["000001"]}), NV)


# ---- load_units ----

def write_map(path, **columns):
    """A small map.rds: the given columns plus a list column, as in ALARM's redist_map."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n = len(next(iter(columns.values())))
    columns["adj"] = [np.array([0], dtype=np.int32)] * n
    rdata.write_rds(path, columns)


def nv_map(tmp_path, vap=(1334.0, 8.0), d16=(164.7, np.nan)):
    write_map(tmp_path / "alarm" / "NV_cd_2020_map.rds",
              GEOID=np.array(["32001000001", "32003008-03"], dtype=object),
              vtd=np.array(["000001", "008-03"], dtype=object),
              cd_2020=np.array([2, 1], dtype=np.int32),
              pop=np.array([1741.0, 10.0]), vap=np.array(vap),
              pre_16_dem_cli=np.array(d16), pre_16_rep_tru=np.array([529.2, 2.5]),
              uss_16_dem_cor=np.array([1.0, 2.0]),
              pre_20_dem_bid=np.array([172.8, 3.0]), pre_20_rep_tru=np.array([510.4, 4.0]))


def test_load_units_reads_the_alarm_map(tmp_path, caplog):
    nv_map(tmp_path)
    with caplog.at_level(logging.INFO, logger="gerry.units"):
        units = load_units(NV, tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "pop", "cd_2020", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["32001000001", "32003008-03"]
    assert units["vap"].dtype == np.int64 and units["vap"].tolist() == [1334, 8]
    assert units["pop"].dtype == np.int64 and units["pop"].tolist() == [1741, 10]
    assert units["cd_2020"].tolist() == ["02", "01"]
    assert units["d_pre_16"].tolist() == [164.7, 0.0]          # the empty field became 0
    assert units["r_pre_20"].dtype == np.float64 and units["r_pre_20"].tolist() == [510.4, 4.0]
    assert units.attrs == {"empty_vote_fields": 1, "empty_vote_units": 1}
    assert "NV: 1 empty vote fields in 1 units set to 0" in caplog.text


def test_load_units_rejects_fractional_vap(tmp_path):
    nv_map(tmp_path, vap=(1334.5, 8.0))
    with pytest.raises(UnitsError, match="vap"):
        load_units(NV, tmp_path)


def test_load_units_with_one_election_and_county_geoids(tmp_path):
    write_map(tmp_path / "alarm" / "WV_cd_2020_map.rds",
              GEOID=np.array(["54063", "54037"], dtype=object), county=np.array(["063", "037"], dtype=object),
              cd_2020=np.array([1, 2], dtype=np.int32), pop=np.array([12376.0, 57701.0]),
              vap=np.array([9895.0, 44965.0]),
              pre_20_rep_tru=np.array([5068.0, 15033.0]), pre_20_dem_bid=np.array([1345.0, 12127.0]))
    units = load_units(make_state("WV", "54", "county", elections=("pre_20",)), tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "pop", "cd_2020", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["54063", "54037"]
    assert units["d_pre_20"].tolist() == [1345.0, 12127.0]


# ---- read_block_votes (census-vest, tract states only) ----

BLOCK_CSV = """GEOID20,state,county,pop,vap,pre_16_dem_cli,pre_16_rep_tru,pre_20_dem_bid,pre_20_rep_tru,arv_16
060014001001000,CA,Alameda County,0,0,0,0,0,0,NA
060490003001452,CA,Modoc County,0,0,NA,NA,NA,NA,NA
060014001001001,CA,Alameda County,12,10,2.5,1.25,3,1,0
"""


def test_read_block_votes_sets_empty_fields_to_zero(tmp_path, caplog):
    write(tmp_path / "census_vest" / "ca_2020_block.csv", BLOCK_CSV)
    with caplog.at_level(logging.INFO, logger="gerry.units"):
        votes = read_block_votes(CA, tmp_path)
    assert votes.index.name == "block_id"
    assert votes.index.tolist() == ["060014001001000", "060490003001452", "060014001001001"]
    assert list(votes.columns) == ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    assert votes.loc["060490003001452"].tolist() == [0.0, 0.0, 0.0, 0.0]
    assert votes.loc["060014001001001"].tolist() == [2.5, 1.25, 3.0, 1.0]
    assert votes.attrs == {"empty_vote_fields": 4, "empty_vote_units": 1}
    assert "CA: 4 empty vote fields in 1 census-vest blocks set to 0" in caplog.text


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


# ---- the real map.rds files ----

IA_MAP = data_dir() / "alarm" / "IA_cd_2020_map.rds"
IA_PL = data_dir() / "census" / "pl" / "ia2020.pl.zip"
CA_MAP = data_dir() / "alarm" / "CA_cd_2020_map.rds"


@pytest.mark.data
@pytest.mark.skipif(not (IA_MAP.exists() and IA_PL.exists()), reason="needs the Iowa map.rds and P.L. 94-171 files")
def test_iowa_counties_match_the_census_names():
    units = load_units(make_state("IA", "19", "county"), data_dir(), read_pl_counties(IA_PL, "IA"))
    assert len(units) == 99
    assert units["unit_id"].str.startswith("19").all() and units["unit_id"].is_unique
    assert units.loc[0, ["unit_id", "vap", "cd_2020"]].tolist() == ["19001", 5834, "03"]   # Adair County


@pytest.mark.data
@pytest.mark.skipif(not CA_MAP.exists(), reason="needs alarm/CA_cd_2020_map.rds")
def test_california_tracts_follow_alarm():
    units = load_units(make_state("CA", "06", "tract"), data_dir())
    assert len(units) == 9129
    # spec chapter 10: two tracts in Modoc and Siskiyou County have no votes in ALARM's map.rds
    two = units[units["unit_id"].isin(["06049000300", "06093000200"])]
    assert two[["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]].to_numpy().sum() == 0.0
