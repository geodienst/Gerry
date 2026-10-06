"""Census blocks: P.L. 94-171 (VAP, population, VTD code, interior point, county names) and the block
equivalency files; the unit of each block and the votes per district."""
from __future__ import annotations

import csv
import functools
import zipfile
from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pandas as pd

# 0-based field positions in the pipe-delimited 2020 P.L. 94-171 files
PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "NAME": 87, "POP100": 90,
                 "INTPTLAT": 92, "INTPTLON": 93}
PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}
_BLOCK_FIELDS = ("SUMLEV", "LOGRECNO", "GEOCODE", "VTD", "POP100", "INTPTLAT", "INTPTLON")
_COUNTY_FIELDS = ("SUMLEV", "GEOCODE", "NAME")


class BlocksError(ValueError):
    pass


def _read_pipe(zf: zipfile.ZipFile, member: str, fields: dict[str, int]) -> pd.DataFrame:
    with zf.open(member) as fh:
        table = pd.read_csv(fh, sep="|", header=None, usecols=sorted(fields.values()), dtype=str,
                            encoding="latin-1", keep_default_na=False, quoting=csv.QUOTE_NONE, engine="c")
    return table.rename(columns={pos: name for name, pos in fields.items()})


def _fields(names: Sequence[str]) -> dict[str, int]:
    return {name: PL_GEO_FIELDS[name] for name in names}


def read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame:
    """block_id (str 15), vap, pop (int64), vtd (str), lat, lon (float64) for every block (SUMLEV 750).

    Read from the zip without extracting. The block VAP and POP100 must add up to the state record (SUMLEV 040)."""
    st = st.lower()
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st}geo2020.pl", _fields(_BLOCK_FIELDS))
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
    pop = pd.to_numeric(blocks["POP100"], errors="coerce")
    if pop.isna().any():
        raise BlocksError(f"{st}: {int(pop.isna().sum())} blocks have no POP100")
    out = pd.DataFrame({
        "block_id": blocks["GEOCODE"].to_numpy(),
        "vap": vap.astype("int64").to_numpy(),
        "pop": pop.astype("int64").to_numpy(),
        "vtd": blocks["VTD"].to_numpy(),
        "lat": pd.to_numeric(blocks["INTPTLAT"]).to_numpy(),
        "lon": pd.to_numeric(blocks["INTPTLON"]).to_numpy(),
    })
    if not out["block_id"].str.len().eq(15).all() or not out["block_id"].is_unique:
        raise BlocksError(f"{st}: block GEOCODE is not a unique 15-character code")
    if (out["vap"] > out["pop"]).any():
        raise BlocksError(f"{st}: VAP above POP100 in {int((out['vap'] > out['pop']).sum())} blocks; "
                          "check PL_GEO_FIELDS and PL_SEG2_FIELDS")
    state_vap = int(vap_of[state["LOGRECNO"].iloc[0]])
    if int(out["vap"].sum()) != state_vap:
        raise BlocksError(f"{st}: block VAP adds up to {int(out['vap'].sum())}, state record says {state_vap}")
    state_pop = int(state["POP100"].iloc[0])
    if int(out["pop"].sum()) != state_pop:
        raise BlocksError(f"{st}: block POP100 adds up to {int(out['pop'].sum())}, state record says {state_pop}")
    return out


def read_pl_counties(zip_path: Path, st: str) -> pd.DataFrame:
    """county_id (str 5) and name (str, e.g. "Adair County") of every county record (SUMLEV 050)."""
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st.lower()}geo2020.pl", _fields(_COUNTY_FIELDS))
    counties = geo[geo["SUMLEV"] == "050"]
    out = pd.DataFrame({"county_id": counties["GEOCODE"].to_numpy(), "name": counties["NAME"].to_numpy()})
    if out.empty or not out["county_id"].str.len().eq(5).all() or not out["county_id"].is_unique:
        raise BlocksError(f"{st}: county records are missing or their GEOCODE is not a unique 5-character code")
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


def unit_of_block(blocks: pd.DataFrame, unit_kind: str, fips: str) -> pd.Series:
    """block_id -> key of the unit the block lies in: vtd: county (GEOCODE[:5]) + VTD code;
    tract: GEOCODE[:11]; county: GEOCODE[:5]. A key need not be a unit of map.rds (water)."""
    ids = blocks["block_id"]
    if not ids.str.startswith(fips).all():
        raise BlocksError(f"blocks that do not start with FIPS {fips}, e.g. {ids[~ids.str.startswith(fips)].iloc[0]}")
    if unit_kind == "vtd":
        blank = blocks["vtd"].str.strip() == ""
        if blank.any():
            raise BlocksError(f"{fips}: {int(blank.sum())} blocks without VTD code, e.g. {ids[blank].iloc[0]}")
        units = ids.str[:5] + blocks["vtd"]
    elif unit_kind == "tract":
        units = ids.str[:11]
    elif unit_kind == "county":
        units = ids.str[:5]
    else:
        raise BlocksError(f"unknown unit_kind {unit_kind!r}")
    return pd.Series(units.to_numpy(), index=pd.Index(ids.to_numpy(), name="block_id"), name="unit_id")


def _linked_blocks(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
                   vote_cols: Sequence[str]) -> tuple[pd.DataFrame, pd.DataFrame, list[str], int]:
    """Blocks outside ZZ with unit_id and district, the votes per unit, the district codes of the map,
    and the number of units without votes and without blocks. Units with votes must keep a block."""
    b = pd.DataFrame({"block_id": blocks["block_id"].to_numpy(), "vap": blocks["vap"].to_numpy()})
    b["unit_id"] = b["block_id"].map(unit_of)
    b["district"] = b["block_id"].map(district_of)
    for col, source in (("unit_id", "unit_of"), ("district", "the block equivalency file")):
        missing = b.loc[b[col].isna(), "block_id"]
        if len(missing):
            raise BlocksError(f"{len(missing)} blocks missing from {source}, e.g. {missing.iloc[0]}")
    b = b[b["district"] != "ZZ"]
    votes = units.set_index("unit_id")[list(vote_cols)]
    has_votes = (votes != 0).any(axis=1)
    linked = votes.index.isin(b["unit_id"].unique())
    orphans = votes.index[has_votes.to_numpy() & ~linked]
    if len(orphans):
        raise BlocksError(f"{len(orphans)} units with votes have no block outside ZZ, e.g. {orphans[0]}")
    without_blocks = int((~has_votes.to_numpy() & ~linked).sum())
    b = b[b["unit_id"].isin(votes.index)]
    districts = sorted(set(district_of.unique()) - {"ZZ"})
    return b, votes, districts, without_blocks


def block_weighted(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
                   vote_cols: Sequence[str], weights: pd.DataFrame | None = None) -> pd.DataFrame:
    """Votes per district: each unit's votes go to its blocks outside ZZ.

    With `weights` (tract states: census-vest block votes, index block_id, a column per vote column) a block
    gets its share of the unit's weight in that column. Where those weights add up to 0, and without
    `weights`, a block gets its share of the unit's VAP; in a unit without VAP every block gets the same
    share. Counts for the log are in .attrs; block_count_votes sums the votes of split units that went by
    block count, over vote_cols."""
    b, votes, districts, without_blocks = _linked_blocks(units, blocks, unit_of, district_of, vote_cols)
    per_unit = b.groupby("unit_id").agg(unit_vap=("vap", "sum"), n_blocks=("vap", "size"))
    b = b.join(per_unit, on="unit_id")
    has_vap = (b["unit_vap"] > 0).to_numpy()
    by_vap = np.where(has_vap, b["vap"].to_numpy() / np.where(has_vap, b["unit_vap"].to_numpy(), 1),
                      1.0 / b["n_blocks"].to_numpy())
    unit_votes = votes.loc[b["unit_id"]].to_numpy()
    by_count = np.repeat(~has_vap[:, None], len(vote_cols), axis=1)   # block x column: weight from block count
    weight = np.repeat(by_vap[:, None], len(vote_cols), axis=1)
    fallback_units = set()
    if weights is not None:
        own = weights.reindex(b["block_id"].to_numpy())[list(vote_cols)]
        missing = own.isna().any(axis=1).to_numpy()
        if missing.any():
            first = b["block_id"].iloc[missing.argmax()]
            raise BlocksError(f"{int(missing.sum())} blocks have no weight, e.g. {first}")
        own = own.to_numpy()
        unit_total = pd.DataFrame(own).groupby(b["unit_id"].to_numpy()).transform("sum").to_numpy()
        usable = unit_total > 0
        weight = np.where(usable, own / np.where(usable, unit_total, 1), weight)
        by_count &= ~usable
        no_weight = ~usable & (unit_votes != 0)
        fallback_units = set(b["unit_id"].to_numpy()[no_weight.any(axis=1)])
    block_votes = unit_votes * weight
    totals = (pd.DataFrame(block_votes, columns=list(vote_cols)).groupby(b["district"].to_numpy()).sum()
              .reindex(districts, fill_value=0.0))
    out = totals.rename_axis("district").reset_index()
    n_districts = b.groupby("unit_id")["district"].nunique()
    split = n_districts.index[n_districts > 1]
    zero_vap = per_unit.index[per_unit["unit_vap"] == 0]
    in_split = b["unit_id"].isin(split).to_numpy()[:, None]
    out.attrs = {"split_units": len(split), "zero_vap_units": len(zero_vap),
                 "zero_vap_split_units": int(split.isin(zero_vap).sum()), "units_without_blocks": without_blocks,
                 "block_count_votes": float(block_votes[by_count & in_split].sum()),
                 "weight_fallback_units": len(fallback_units)}
    return out


def whole_unit(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
               vote_cols: Sequence[str]) -> pd.DataFrame:
    """Votes per district with each unit wholly in one district: most block VAP, then most blocks,
    then the lowest district code."""
    b, votes, districts, _ = _linked_blocks(units, blocks, unit_of, district_of, vote_cols)
    per = b.groupby(["unit_id", "district"]).agg(vap=("vap", "sum"), n=("vap", "size")).reset_index()
    per = per.sort_values(["unit_id", "vap", "n", "district"], ascending=[True, False, False, True])
    choice = per.drop_duplicates("unit_id").set_index("unit_id")["district"]
    totals = votes.loc[choice.index].groupby(choice.to_numpy()).sum().reindex(districts, fill_value=0.0)
    return totals.rename_axis("district").reset_index()
