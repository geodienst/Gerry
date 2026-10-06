import zipfile

import numpy as np
import pandas as pd
import pytest

from gerry.blocks import (PL_GEO_FIELDS, BlocksError, block_weighted, read_bef, read_pl_blocks, read_pl_counties,
                          unit_of_block, whole_unit)
from gerry.config import data_dir


# ---- P.L. 94-171 fixtures: geo header with 97 fields, segment 2 with 152 fields ----

def geo_line(sumlev, logrecno, geocode, vtd="", pop100="0", lat="+39.0000000", lon="-117.0000000", name=""):
    fields = [""] * 97
    fields[0], fields[1] = "PLST", "NV"
    fields[PL_GEO_FIELDS["SUMLEV"]] = sumlev
    fields[PL_GEO_FIELDS["LOGRECNO"]] = logrecno
    fields[PL_GEO_FIELDS["GEOCODE"]] = geocode
    fields[PL_GEO_FIELDS["VTD"]] = vtd
    fields[PL_GEO_FIELDS["POP100"]] = pop100
    fields[PL_GEO_FIELDS["INTPTLAT"]] = lat
    fields[PL_GEO_FIELDS["INTPTLON"]] = lon
    fields[PL_GEO_FIELDS["NAME"]] = name
    return "|".join(fields)


def seg2_line(logrecno, vap):
    return "|".join(["PLST", "NV", "000", "02", logrecno, str(vap)] + ["0"] * 146)


def make_pl_zip(path, state_vap=8, block2_pop="0"):
    geo = [
        geo_line("040", "0000001", "32", pop100="10", name="Nevada"),
        geo_line("050", "0000002", "32001", pop100="10", name="Doña Ana County"),   # latin-1 byte
        geo_line("750", "0000003", "320010001001000", vtd="000010", pop100="10", lat="+39.5", lon="-117.25"),
        geo_line("750", "0000004", "320010001001001", vtd="008-03", pop100=block2_pop),
    ]
    seg2 = [seg2_line("0000001", state_vap), seg2_line("0000002", 8), seg2_line("0000003", 8),
            seg2_line("0000004", 0)]
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("nvgeo2020.pl", ("\r\n".join(geo) + "\r\n").encode("latin-1"))
        zf.writestr("nv000022020.pl", ("\r\n".join(seg2) + "\r\n").encode("latin-1"))
    return path


def test_read_pl_blocks_returns_blocks_with_vap(tmp_path):
    blocks = read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip"), "nv")
    assert list(blocks.columns) == ["block_id", "vap", "pop", "vtd", "lat", "lon"]
    assert blocks["block_id"].tolist() == ["320010001001000", "320010001001001"]
    assert blocks["vap"].dtype == np.int64 and blocks["vap"].tolist() == [8, 0]
    assert blocks["pop"].dtype == np.int64 and blocks["pop"].tolist() == [10, 0]
    assert blocks["vtd"].tolist() == ["000010", "008-03"]
    assert blocks["lat"].tolist() == [39.5, 39.0] and blocks["lon"].tolist() == [-117.25, -117.0]


def test_read_pl_counties_returns_fips_and_name(tmp_path):
    counties = read_pl_counties(make_pl_zip(tmp_path / "nv2020.pl.zip"), "NV")
    # the county name holds a Latin-1 byte, as in the real files
    assert counties.to_dict("records") == [{"county_id": "32001", "name": "Doña Ana County"}]


def test_read_pl_blocks_checks_the_state_record(tmp_path):
    with pytest.raises(BlocksError, match="8.*9"):
        read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip", state_vap=9), "nv")


def test_read_pl_blocks_checks_the_state_population(tmp_path):
    # block POP100 adds up to 10 + 3 = 13; the state record says 10
    with pytest.raises(BlocksError, match="POP100 adds up to 13, state record says 10"):
        read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip", block2_pop="3"), "nv")


def test_read_pl_blocks_rejects_vap_above_population(tmp_path):
    # block 1 has POP100 10 and VAP 8; with POP100 5 the field positions must be wrong
    path = make_pl_zip(tmp_path / "nv2020.pl.zip")
    with zipfile.ZipFile(path) as zf:
        geo = zf.read("nvgeo2020.pl").decode("latin-1").replace("|10|", "|5|")
        seg2 = zf.read("nv000022020.pl")
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("nvgeo2020.pl", geo.encode("latin-1"))
        zf.writestr("nv000022020.pl", seg2)
    with pytest.raises(BlocksError, match="POP100"):
        read_pl_blocks(path, "nv")


# ---- block equivalency files ----

def make_cd120_zip(path):
    text = ("GEOID,STATEFP,COUNTYFP,TRACTCE,BLOCKCE,CDFP\r\n"
            "010010201001000,01,001,020100,1000,07\r\n"
            "010010201001001,01,001,020100,1001,02\r\n"
            "320010001001000,32,001,000100,1000,02\r\n"
            "090019900000100,09,001,990000,0100,ZZ\r\n")
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("NationalCD120.txt", text)
        zf.writestr("CD120_01.txt", "not read")
    return path


def test_read_bef_cd120_keeps_leading_zeros(tmp_path):
    bef = read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd120", "01", "AL")
    assert bef.name == "district" and bef.index.name == "block_id"
    assert bef.to_dict() == {"010010201001000": "07", "010010201001001": "02"}


def test_read_bef_cd120_keeps_zz(tmp_path):
    bef = read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd120", "09", "CT")
    assert bef.to_dict() == {"090019900000100": "ZZ"}


def test_read_bef_cd118_reads_the_state_file(tmp_path):
    path = tmp_path / "cd118.zip"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("29_MO_CD118.txt", "GEOID, CDFP\r\n290019501001000,06\r\n290019501001001,06\r\n")
        zf.writestr("32_NV_CD118.txt", "GEOID, CDFP\r\n320010001001000,02\r\n")
    bef = read_bef(path, "cd118", "29", "MO")
    assert bef.to_dict() == {"290019501001000": "06", "290019501001001": "06"}


def test_read_bef_rejects_an_unknown_kind(tmp_path):
    with pytest.raises(BlocksError, match="cd119"):
        read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd119", "01", "AL")


NV_PL = data_dir() / "census" / "pl" / "nv2020.pl.zip"
CD120 = data_dir() / "census" / "cd120.zip"
CD118 = data_dir() / "census" / "cd118.zip"


@pytest.mark.data
@pytest.mark.skipif(not NV_PL.exists(), reason="needs census/pl/nv2020.pl.zip")
def test_nevada_blocks():
    blocks = read_pl_blocks(NV_PL, "nv")
    assert len(blocks) == 57409
    assert blocks["vap"].sum() == 2413326
    assert blocks["pop"].sum() == 3104614
    assert blocks["block_id"].str.len().eq(15).all() and blocks["vtd"].str.len().eq(6).all()


@pytest.mark.data
@pytest.mark.skipif(not (CD120.exists() and CD118.exists()), reason="needs census/cd120.zip and cd118.zip")
def test_nevada_block_equivalency_files():
    cd120 = read_bef(CD120, "cd120", "32", "NV")
    cd118 = read_bef(CD118, "cd118", "32", "NV")
    assert len(cd120) == 57409
    assert cd120.value_counts().sort_index().to_dict() == {"01": 7655, "02": 27405, "03": 7124, "04": 15225}
    assert cd118.sort_index().equals(cd120.sort_index())   # Nevada has not redrawn since 2021


# ---- Task 1.8: blocks to units, votes to districts ----

def pl_blocks(ids, vtds=None, vaps=None):
    n = len(ids)
    return pd.DataFrame({"block_id": ids, "vap": vaps or [0] * n, "vtd": vtds or [""] * n,
                         "lat": [0.0] * n, "lon": [0.0] * n})


def test_unit_of_block_for_vtd_states_is_county_plus_vtd():
    blocks = pl_blocks(["320010001001000", "320039501001000"], vtds=["000010", "008-03"])
    unit_of = unit_of_block(blocks, "vtd", "32")
    assert unit_of.index.name == "block_id"
    assert unit_of.to_dict() == {"320010001001000": "32001000010", "320039501001000": "32003008-03"}


def test_unit_of_block_rejects_a_blank_vtd_code():
    blocks = pl_blocks(["320010001001000", "320010001001001"], vtds=["000010", "      "])
    with pytest.raises(BlocksError, match="320010001001001"):
        unit_of_block(blocks, "vtd", "32")


def test_unit_of_block_for_tract_states_is_the_tract():
    blocks = pl_blocks(["060014001001000", "060014001002003"])
    assert unit_of_block(blocks, "tract", "06").tolist() == ["06001400100", "06001400100"]


def test_unit_of_block_for_county_units_is_the_county():
    blocks = pl_blocks(["540630001001000", "540370001001000"])
    assert unit_of_block(blocks, "county", "54").tolist() == ["54063", "54037"]


def test_unit_of_block_rejects_an_unknown_kind():
    with pytest.raises(BlocksError, match="'block'"):
        unit_of_block(pl_blocks(["060014001001000"]), "block", "06")


def test_unit_of_block_rejects_blocks_of_another_state():
    with pytest.raises(BlocksError, match="32"):
        unit_of_block(pl_blocks(["060014001001000"]), "tract", "32")


VOTES = ["d", "r"]


def weighted_case():
    # U1: VAP 30 in two districts. U2: no VAP, three blocks. U3: one block in 02 and one ZZ block.
    blocks = pl_blocks(["b1", "b2", "b3", "b4", "b5", "b6", "b7"], vaps=[10, 20, 0, 0, 0, 5, 5])
    unit_of = pd.Series(["U1", "U1", "U2", "U2", "U2", "U3", "U3"], index=blocks["block_id"])
    district_of = pd.Series(["01", "02", "01", "02", "02", "02", "ZZ"], index=blocks["block_id"])
    units = pd.DataFrame({"unit_id": ["U1", "U2", "U3"], "vap": [30, 0, 10],
                          "d": [30.0, 6.0, 10.0], "r": [60.0, 0.0, 10.0]})
    return units, blocks, unit_of, district_of


def test_block_weighted_splits_by_vap_and_by_block_count():
    out = block_weighted(*weighted_case(), VOTES)
    # 01: U1 gets 10/30 of (30, 60) = (10, 20); U2 has no VAP, 1 of 3 blocks: (2, 0).
    # 02: U1 20/30 = (20, 40); U2 2 of 3 blocks = (4, 0); U3 all of (10, 10) since ZZ goes first.
    assert out["district"].tolist() == ["01", "02"]
    assert out["d"].tolist() == pytest.approx([12.0, 34.0])
    assert out["r"].tolist() == pytest.approx([20.0, 50.0])
    # U2 is split and its 6 + 0 votes went by block count
    assert out.attrs == {"split_units": 2, "zero_vap_units": 1, "zero_vap_split_units": 1,
                         "units_without_blocks": 0, "block_count_votes": 6.0, "weight_fallback_units": 0}


def tract_case():
    # T1: VAP 40 over t1 (01), t2 (02) and t3 (ZZ). T2: no VAP, t4 (01) and t5 (02).
    blocks = pl_blocks(["t1", "t2", "t3", "t4", "t5"], vaps=[10, 30, 0, 0, 0])
    unit_of = pd.Series(["T1", "T1", "T1", "T2", "T2"], index=blocks["block_id"])
    district_of = pd.Series(["01", "02", "ZZ", "01", "02"], index=blocks["block_id"])
    units = pd.DataFrame({"unit_id": ["T1", "T2"], "vap": [40, 0], "d": [100.0, 8.0], "r": [50.0, 4.0]})
    # census-vest block votes: the weight of a block within its tract, per column
    weights = pd.DataFrame({"d": [3.0, 1.0, 96.0, 0.0, 0.0], "r": [0.0, 0.0, 5.0, 0.0, 0.0]},
                           index=pd.Index(["t1", "t2", "t3", "t4", "t5"], name="block_id"))
    return units, blocks, unit_of, district_of, weights


def test_block_weighted_uses_block_weights_per_column():
    units, blocks, unit_of, district_of, weights = tract_case()
    out = block_weighted(units, blocks, unit_of, district_of, VOTES, weights=weights)
    # T1 d: weights 3 and 1 outside ZZ (t3 goes first): 75 to 01, 25 to 02.
    # T1 r: weights add up to 0 outside ZZ, so VAP: 10/40 = 12.5 to 01, 30/40 = 37.5 to 02.
    # T2: no weight and no VAP, so block count: d 4 and 4, r 2 and 2.
    assert out["d"].tolist() == pytest.approx([79.0, 29.0])
    assert out["r"].tolist() == pytest.approx([14.5, 39.5])
    # T1 (r) and T2 (d, r) have votes but no weight; T2's 8 + 4 votes went by block count
    assert out.attrs["weight_fallback_units"] == 2
    assert out.attrs["block_count_votes"] == pytest.approx(12.0)


def test_block_weighted_needs_a_weight_for_every_block():
    units, blocks, unit_of, district_of, weights = tract_case()
    with pytest.raises(BlocksError, match="t4"):
        block_weighted(units, blocks, unit_of, district_of, VOTES, weights=weights.drop("t4"))


def test_block_weighted_needs_a_block_for_every_unit_with_votes():
    units, blocks, unit_of, district_of = weighted_case()
    district_of["b6"] = "ZZ"
    with pytest.raises(BlocksError, match="U3"):
        block_weighted(units, blocks, unit_of, district_of, VOTES)


def test_block_weighted_logs_a_unit_without_votes_or_blocks():
    units, blocks, unit_of, district_of = weighted_case()
    district_of["b6"] = "ZZ"
    units.loc[2, ["d", "r"]] = 0.0
    out = block_weighted(units, blocks, unit_of, district_of, VOTES)
    assert out.attrs["units_without_blocks"] == 1
    assert out["d"].sum() == pytest.approx(36.0)


def test_block_weighted_needs_every_block_in_the_equivalency_file():
    units, blocks, unit_of, district_of = weighted_case()
    with pytest.raises(BlocksError, match="b7"):
        block_weighted(units, blocks, unit_of, district_of.drop("b7"), VOTES)


def test_whole_unit_assigns_by_vap_then_blocks_then_lowest_district():
    blocks = pl_blocks([f"b{i}" for i in range(1, 11)], vaps=[10, 20, 0, 0, 0, 5, 5, 5, 5, 0])
    unit_of = pd.Series(["A", "A", "B", "B", "B", "C", "C", "D", "D", "D"], index=blocks["block_id"])
    district_of = pd.Series(["01", "02", "01", "02", "02", "01", "03", "03", "02", "02"], index=blocks["block_id"])
    units = pd.DataFrame({"unit_id": ["A", "B", "C", "D"], "vap": [30, 0, 10, 10],
                          "d": [1.0, 3.0, 5.0, 7.0], "r": [2.0, 4.0, 6.0, 8.0]})
    out = whole_unit(units, blocks, unit_of, district_of, VOTES)
    # A -> 02 (VAP 20 against 10). B has no VAP -> 02 (two blocks against one).
    # C: VAP 5 and 5, one block each -> 01, the lowest. D: VAP 5 and 5 -> 02 (two blocks against one).
    assert out["district"].tolist() == ["01", "02", "03"]
    assert out["d"].tolist() == [5.0, 11.0, 0.0]
    assert out["r"].tolist() == [6.0, 14.0, 0.0]
