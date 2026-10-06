"""Votes per unit from ALARM's map.rds (VTD, tract or county): unit ids, column choice, loading,
the census-vest block votes that weigh blocks within a tract, and the composite."""
from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Sequence
from pathlib import Path

import pandas as pd

from gerry.config import StateConfig
from gerry.rds import read_rds_table

log = logging.getLogger(__name__)

ID_LENGTH = {"vtd": 11, "tract": 11, "county": 5}   # county (5) + VTD code (6); tract GEOID; county FIPS


class UnitsError(ValueError):
    pass


def select_columns(columns: Iterable[str], election: str) -> tuple[str, str]:
    """(dem, rep): the one column matching ^<election>_dem_ and the one matching ^<election>_rep_."""
    columns = list(columns)
    found = []
    for party in ("dem", "rep"):
        pattern = re.compile(rf"^{re.escape(election)}_{party}_")
        hits = [c for c in columns if pattern.match(c)]
        if len(hits) != 1:
            raise UnitsError(f"{election}: expected one column matching ^{election}_{party}_, "
                             f"found {len(hits)}: {', '.join(hits) or 'none'}")
        found.append(hits[0])
    return found[0], found[1]


def _county_fips(names: pd.Series, counties: pd.DataFrame | None, st: StateConfig) -> pd.Series:
    """County names such as "Adair County" -> FIPS codes, through the P.L. 94-171 county records."""
    if counties is None:
        raise UnitsError(f"{st.postal}: the map has no GEOID column; its county names need the "
                         "P.L. 94-171 county records")
    matches = names.map(counties["name"].value_counts()).fillna(0).astype("int64")
    bad = names[matches != 1]
    if len(bad):
        raise UnitsError(f"{st.postal}: {len(bad)} county names do not match exactly one P.L. 94-171 county, "
                         f"e.g. {bad.iloc[0]!r} ({int(matches[bad.index[0]])} matches)")
    return names.map(counties.drop_duplicates("name", keep=False).set_index("name")["county_id"])


def unit_ids(table: pd.DataFrame, st: StateConfig, counties: pd.DataFrame | None = None) -> pd.Series:
    """Text id of every unit in a map.rds table (spec chapter 4): GEOID; without GEOID the column tract
    (CA, HI) or the county name looked up in `counties` (IA, columns county_id and name)."""
    if "GEOID" in table.columns:
        ids, source = table["GEOID"], "GEOID"
    elif st.unit_kind == "tract" and "tract" in table.columns:
        ids, source = table["tract"], "tract"
    elif st.unit_kind == "county" and "county" in table.columns:
        ids, source = _county_fips(table["county"], counties, st), "county"
    else:
        raise UnitsError(f"{st.postal}: no id column for {st.unit_kind} units")
    if ids.isna().any():
        raise UnitsError(f"{st.postal}: {int(ids.isna().sum())} units without id in column {source}")
    if not pd.api.types.is_string_dtype(ids):
        raise UnitsError(f"{st.postal}: column {source} is not text but {ids.dtype}")
    length = ID_LENGTH[st.unit_kind]
    bad = ids[(ids.str.len() != length) | ~ids.str.startswith(st.fips)]
    if len(bad):
        raise UnitsError(f"{st.postal}: {len(bad)} ids in column {source} are not {length} characters "
                         f"starting with {st.fips}, e.g. {bad.iloc[0]}")
    dup = ids[ids.duplicated()]
    if len(dup):
        raise UnitsError(f"{st.postal}: duplicate unit ids: {', '.join(dup.head(5))}")
    if st.unit_kind == "vtd":
        if "vtd" not in table.columns:
            raise UnitsError(f"{st.postal}: the map has no vtd column")
        off = (ids != ids.str[:5] + table["vtd"]).to_numpy()
        if off.any():
            raise UnitsError(f"{st.postal}: {int(off.sum())} GEOIDs are not county + vtd, e.g. "
                             f"{ids[off].iloc[0]} with vtd {table['vtd'][off].iloc[0]}")
    return ids.astype(str).reset_index(drop=True).rename("unit_id")


def _whole(values: pd.Series, name: str, st: StateConfig) -> pd.Series:
    numbers = pd.to_numeric(values)
    if numbers.isna().any() or (numbers % 1 != 0).any():
        raise UnitsError(f"{st.postal}: {name} is missing or not a whole number in some units")
    return numbers.astype("int64")


def _zero_empty(df: pd.DataFrame, cols: list[str]) -> tuple[int, int]:
    """Set empty vote fields to 0 in place; return (fields, rows) that were empty."""
    empty = df[cols].isna()
    n_fields, n_rows = int(empty.sum().sum()), int(empty.any(axis=1).sum())
    df[cols] = df[cols].fillna(0.0)
    return n_fields, n_rows


def load_units(st: StateConfig, root: Path, counties: pd.DataFrame | None = None) -> pd.DataFrame:
    """unit_id (str), vap and pop (int64), cd_2020 (district of ALARM's reference map, str "01") and
    d_<e>, r_<e> (float64) per election, from alarm/{ST}_cd_2020_map.rds.

    `counties` (from read_pl_counties) is needed for a county map without GEOID (Iowa).
    Empty vote fields become 0; their number is in .attrs["empty_vote_fields"] and
    .attrs["empty_vote_units"], and in the log."""
    table = read_rds_table(Path(root) / "alarm" / f"{st.postal}_cd_2020_map.rds")
    missing = [c for c in ("vap", "pop", "cd_2020") if c not in table.columns]
    if missing:
        raise UnitsError(f"{st.postal}: map.rds has no column {', '.join(missing)}")
    out = pd.DataFrame({"unit_id": unit_ids(table, st, counties)})
    out["vap"] = _whole(table["vap"], "vap", st).to_numpy()
    out["pop"] = _whole(table["pop"], "pop", st).to_numpy()
    out["cd_2020"] = _whole(table["cd_2020"], "cd_2020", st).map("{:02d}".format).to_numpy()
    for e in st.elections:
        dem, rep = select_columns(table.columns, e)
        out[f"d_{e}"] = pd.to_numeric(table[dem]).astype("float64").to_numpy()
        out[f"r_{e}"] = pd.to_numeric(table[rep]).astype("float64").to_numpy()
    n_fields, n_units = _zero_empty(out, [f"{p}_{e}" for e in st.elections for p in ("d", "r")])
    if n_fields:
        log.info("%s: %d empty vote fields in %d units set to 0", st.postal, n_fields, n_units)
    out.attrs = {"empty_vote_fields": n_fields, "empty_vote_units": n_units}
    return out


def read_block_votes(st: StateConfig, root: Path) -> pd.DataFrame:
    """Votes per census block from census-vest/{st}_2020_block.csv (tract states): index block_id,
    columns d_<e>, r_<e> (float64). They only weigh the blocks within a tract (spec chapter 4).
    Empty fields become 0; counted in .attrs as in load_units, and logged."""
    path = Path(root) / "census_vest" / f"{st.postal.lower()}_2020_block.csv"
    header = pd.read_csv(path, nrows=0, encoding="utf-8").columns
    names = {}
    for e in st.elections:
        dem, rep = select_columns(header, e)
        names[dem], names[rep] = f"d_{e}", f"r_{e}"
    table = pd.read_csv(path, usecols=["GEOID20", *names], dtype={"GEOID20": str}, encoding="utf-8")
    ids = table["GEOID20"]
    if ids.isna().any() or not ids.str.len().eq(15).all() or not ids.is_unique:
        raise UnitsError(f"{st.postal}: GEOID20 in {path.name} is not a unique 15-character block code")
    out = table.rename(columns=names).set_index("GEOID20").rename_axis("block_id")[list(names.values())]
    out = out.astype("float64")
    n_fields, n_blocks = _zero_empty(out, list(names.values()))
    if n_fields:
        log.info("%s: %d empty vote fields in %d census-vest blocks set to 0", st.postal, n_fields, n_blocks)
    out.attrs = {"empty_vote_fields": n_fields, "empty_vote_units": n_blocks}
    return out


def add_composite(df: pd.DataFrame, elections: Sequence[str]) -> pd.DataFrame:
    """Copy of df with d = sum of d_<e> and r = sum of r_<e> over the elections."""
    out = df.copy()
    out.attrs = dict(df.attrs)
    out["d"] = out[[f"d_{e}" for e in elections]].sum(axis=1)
    out["r"] = out[[f"r_{e}" for e in elections]].sum(axis=1)
    return out
