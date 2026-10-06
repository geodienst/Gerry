import zipfile

import numpy as np
import pandas as pd
import pytest

from gerry.blocks import PL_GEO_FIELDS, BlocksError, read_bef, read_pl_blocks
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
    fields[87] = name
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
    assert list(blocks.columns) == ["block_id", "vap", "vtd", "lat", "lon"]
    assert blocks["block_id"].tolist() == ["320010001001000", "320010001001001"]
    assert blocks["vap"].dtype == np.int64 and blocks["vap"].tolist() == [8, 0]
    assert blocks["vtd"].tolist() == ["000010", "008-03"]
    assert blocks["lat"].tolist() == [39.5, 39.0] and blocks["lon"].tolist() == [-117.25, -117.0]


def test_read_pl_blocks_checks_the_state_record(tmp_path):
    with pytest.raises(BlocksError, match="8.*9"):
        read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip", state_vap=9), "nv")


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
    assert blocks["block_id"].str.len().eq(15).all() and blocks["vtd"].str.len().eq(6).all()


@pytest.mark.data
@pytest.mark.skipif(not (CD120.exists() and CD118.exists()), reason="needs census/cd120.zip and cd118.zip")
def test_nevada_block_equivalency_files():
    cd120 = read_bef(CD120, "cd120", "32", "NV")
    cd118 = read_bef(CD118, "cd118", "32", "NV")
    assert len(cd120) == 57409
    assert cd120.value_counts().sort_index().to_dict() == {"01": 7655, "02": 27405, "03": 7124, "04": 15225}
    assert cd118.sort_index().equals(cd120.sort_index())   # Nevada has not redrawn since 2021
