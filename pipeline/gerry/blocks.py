"""Census blocks: P.L. 94-171 (VAP, VTD code, interior point) and the block equivalency files."""
from __future__ import annotations

import csv
import functools
import zipfile
from pathlib import Path

import pandas as pd

# 0-based field positions in the pipe-delimited 2020 P.L. 94-171 files
PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "POP100": 90, "INTPTLAT": 92, "INTPTLON": 93}
PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}


class BlocksError(ValueError):
    pass


def _read_pipe(zf: zipfile.ZipFile, member: str, fields: dict[str, int]) -> pd.DataFrame:
    with zf.open(member) as fh:
        table = pd.read_csv(fh, sep="|", header=None, usecols=sorted(fields.values()), dtype=str,
                            encoding="latin-1", keep_default_na=False, quoting=csv.QUOTE_NONE, engine="c")
    return table.rename(columns={pos: name for name, pos in fields.items()})


def read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame:
    """block_id (str 15), vap (int64), vtd (str), lat, lon (float64) for every block (SUMLEV 750).

    Read from the zip without extracting. The block VAP must add up to the state record (SUMLEV 040)."""
    st = st.lower()
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st}geo2020.pl", PL_GEO_FIELDS)
        seg2 = _read_pipe(zf, f"{st}000022020.pl", PL_SEG2_FIELDS)
    if not seg2["LOGRECNO"].is_unique:
        raise BlocksError(f"{st}: LOGRECNO is not unique in segment 2")
    vap_of = pd.to_numeric(seg2.set_index("LOGRECNO")["P0030001"]).astype("int64")
    state = geo[geo["SUMLEV"] == "040"]
    blocks = geo[geo["SUMLEV"] == "750"]
    if len(state) != 1 or blocks.empty:
        raise BlocksError(f"{st}: expected one state record and some blocks, found {len(state)} and {len(blocks)}")
    vap = blocks["LOGRECNO"].map(vap_of)
    if vap.isna().any():
        raise BlocksError(f"{st}: {int(vap.isna().sum())} blocks have no segment 2 record")
    out = pd.DataFrame({
        "block_id": blocks["GEOCODE"].to_numpy(),
        "vap": vap.astype("int64").to_numpy(),
        "vtd": blocks["VTD"].to_numpy(),
        "lat": pd.to_numeric(blocks["INTPTLAT"]).to_numpy(),
        "lon": pd.to_numeric(blocks["INTPTLON"]).to_numpy(),
    })
    pop = pd.to_numeric(blocks["POP100"]).to_numpy()
    if not out["block_id"].str.len().eq(15).all() or not out["block_id"].is_unique:
        raise BlocksError(f"{st}: block GEOCODE is not a unique 15-character code")
    if (out["vap"].to_numpy() > pop).any():
        raise BlocksError(f"{st}: VAP above POP100 in {int((out['vap'].to_numpy() > pop).sum())} blocks; "
                          "check PL_GEO_FIELDS and PL_SEG2_FIELDS")
    state_vap = int(vap_of[state["LOGRECNO"].iloc[0]])
    if int(out["vap"].sum()) != state_vap:
        raise BlocksError(f"{st}: block VAP adds up to {int(out['vap'].sum())}, state record says {state_vap}")
    return out


@functools.lru_cache(maxsize=1)
def _national_cd120(zip_path: str) -> dict[str, pd.DataFrame]:
    """NationalCD120.txt, read once and split by state FIPS (first two GEOID characters)."""
    with zipfile.ZipFile(zip_path) as zf, zf.open("NationalCD120.txt") as fh:
        table = pd.read_csv(fh, engine="c", usecols=["GEOID", "CDFP"], dtype=str, keep_default_na=False)
    return {fips: part for fips, part in table.groupby(table["GEOID"].str[:2], sort=False)}


def read_bef(zip_path: Path, kind: str, fips: str, postal: str) -> pd.Series:
    """Block -> district code for one state. cd120: national file; cd118: {fips}_{postal}_CD118.txt."""
    if kind == "cd120":
        table = _national_cd120(str(Path(zip_path).resolve())).get(fips)
        if table is None:
            raise BlocksError(f"{postal}: no blocks with FIPS {fips} in {zip_path}")
    elif kind == "cd118":
        with zipfile.ZipFile(zip_path) as zf, zf.open(f"{fips}_{postal}_CD118.txt") as fh:
            # the header is "GEOID, CDFP", with a space
            table = pd.read_csv(fh, engine="c", usecols=["GEOID", "CDFP"], dtype=str, keep_default_na=False,
                                skipinitialspace=True)
    else:
        raise BlocksError(f"{postal}: unknown block equivalency file {kind!r}")
    geoid, cdfp = table["GEOID"], table["CDFP"]
    if not (geoid.str.len().eq(15).all() and geoid.str.startswith(fips).all() and geoid.is_unique):
        raise BlocksError(f"{postal}: {kind} GEOIDs are not unique 15-character codes starting with {fips}")
    if not cdfp.str.len().eq(2).all():
        raise BlocksError(f"{postal}: {kind} has district codes that are not 2 characters")
    return pd.Series(cdfp.to_numpy(), index=pd.Index(geoid.to_numpy(), name="block_id"), name="district")
