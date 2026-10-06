import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.config import data_dir
from gerry.rds import read_rds_table


def test_reads_atomic_columns_and_skips_list_columns(tmp_path):
    path = tmp_path / "map.rds"
    # A named list like a redist_map: text, numbers and a list column (as geometry and adj are).
    rdata.write_rds(path, {
        "GEOID": np.array(["54001", "54003"], dtype=object),
        "vap": np.array([9895.0, 44965.0]),
        "cd_2020": np.array([1, 2], dtype=np.int32),
        "adj": [np.array([1], dtype=np.int32), np.array([0], dtype=np.int32)],
    })
    table = read_rds_table(path)
    assert list(table.columns) == ["GEOID", "vap", "cd_2020"]
    assert table["GEOID"].tolist() == ["54001", "54003"]
    assert table["vap"].dtype == np.float64
    assert table["cd_2020"].dtype == np.int64
    assert table["cd_2020"].tolist() == [1, 2]


def test_r_missing_values_become_pandas_missing_values(tmp_path):
    path = tmp_path / "na.rds"
    rdata.write_rds(path, pd.DataFrame({
        "cd": pd.array([1, None], dtype="Int32"),
        "muni": pd.Series(["53000", None], dtype=object),
    }))
    table = read_rds_table(path)
    assert table["cd"].dtype == "Int64"
    assert table["cd"].isna().tolist() == [False, True]
    assert table["muni"].isna().tolist() == [False, True]


def test_logical_na_stays_missing_and_complete_logical_stays_bool(tmp_path):
    path = tmp_path / "lgl.rds"
    rdata.write_rds(path, pd.DataFrame({
        "with_na": pd.array([True, None, False], dtype="boolean"),
        "complete": np.array([True, False, True]),
    }))
    table = read_rds_table(path)
    assert table["with_na"].dtype == "boolean"
    assert table["with_na"].isna().tolist() == [False, True, False]
    assert table["with_na"].dropna().tolist() == [True, False]
    assert table["complete"].dtype == np.bool_
    assert table["complete"].tolist() == [True, False, True]


def test_strings_flagged_latin1_are_decoded(tmp_path):
    path = tmp_path / "latin1.rds"
    # cp1252 makes rdata write the strings with R's LATIN1 flag and one byte per character.
    rdata.write_rds(path, {"name": np.array(["café", "abc"], dtype=object)}, encoding="cp1252")
    table = read_rds_table(path)
    assert table["name"].tolist() == ["café", "abc"]


WV_MAP = data_dir() / "alarm" / "WV_cd_2020_map.rds"
CA_MAP = data_dir() / "alarm" / "CA_cd_2020_map.rds"


@pytest.mark.data
@pytest.mark.skipif(not WV_MAP.exists(), reason="needs alarm/WV_cd_2020_map.rds")
def test_west_virginia_map_has_55_counties():
    table = read_rds_table(WV_MAP)
    assert len(table) == 55
    assert table["GEOID"].str.len().eq(5).all() and table["GEOID"].str.startswith("54").all()
    assert "geometry" not in table.columns and "adj" not in table.columns
    assert round(table["pre_20_dem_bid"].sum()) == 235984
    assert round(table["pre_20_rep_tru"].sum()) == 545382


@pytest.mark.data
@pytest.mark.skipif(not CA_MAP.exists(), reason="needs alarm/CA_cd_2020_map.rds")
def test_california_map_has_9129_tracts():
    table = read_rds_table(CA_MAP)
    assert len(table) == 9129
    assert table["tract"].str.len().eq(11).all() and table["tract"].is_unique
    # The two tracts of align_to_alarm: ALARM's tract data has no votes there.
    votes = table.set_index("tract").loc[["06049000300", "06093000200"],
                                         ["pre_16_dem_cli", "pre_16_rep_tru", "pre_20_dem_bid", "pre_20_rep_tru"]]
    assert (votes == 0).all().all()
