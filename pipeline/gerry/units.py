"""Votes per unit (VTD, block or county): column choice, loading, align_to_alarm and the composite."""
from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Sequence
from pathlib import Path

import pandas as pd

from gerry.rds import read_rds_table

log = logging.getLogger(__name__)


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


def _county_id_column(table: pd.DataFrame, st) -> str:
    """The one text column that holds 5-character county GEOIDs of this state."""
    hits = []
    for name in table.columns:
        col = table[name]
        if (pd.api.types.is_string_dtype(col) and col.notna().all() and col.str.len().eq(5).all()
                and col.str.startswith(st.fips).all() and col.is_unique):
            hits.append(name)
    if len(hits) != 1:
        raise UnitsError(f"{st.postal}: expected one county GEOID column (5 characters, starting with "
                         f"{st.fips}) in {st.postal}_cd_2020_map.rds, found {hits}")
    return hits[0]


def _read_table(st, root: Path) -> tuple[pd.DataFrame, str]:
    """Raw unit table and the name of its id column."""
    if st.unit_source in ("vtd", "block"):
        path = Path(root) / "census_vest" / f"{st.postal.lower()}_2020_{st.unit_source}.csv"
        header = pd.read_csv(path, nrows=0, encoding="utf-8").columns
        wanted = ["GEOID20", "vap"] + [c for e in st.elections for c in select_columns(header, e)]
        return pd.read_csv(path, usecols=wanted, dtype={"GEOID20": str}, encoding="utf-8"), "GEOID20"
    if st.unit_source == "rds_county":
        table = read_rds_table(Path(root) / "alarm" / f"{st.postal}_cd_2020_map.rds")
        return table, _county_id_column(table, st)
    raise UnitsError(f"{st.postal}: unknown unit_source {st.unit_source!r}")


def load_units(st, root: Path) -> pd.DataFrame:
    """unit_id (str), vap (int64) and d_<e>, r_<e> (float64) for each election of the state.

    Empty vote fields become 0; their number is in .attrs["empty_vote_fields"] and
    .attrs["empty_vote_units"], and in the log."""
    table, id_col = _read_table(st, root)
    ids = table[id_col]
    if ids.isna().any():
        raise UnitsError(f"{st.postal}: {int(ids.isna().sum())} units without id in column {id_col}")
    dup = ids[ids.duplicated()]
    if len(dup):
        raise UnitsError(f"{st.postal}: duplicate unit ids: {', '.join(dup.head(5))}")
    vap = table["vap"]
    if vap.isna().any() or (vap % 1 != 0).any():
        raise UnitsError(f"{st.postal}: vap is missing or not a whole number in some units")
    out = pd.DataFrame({"unit_id": ids.astype(str), "vap": vap.round().astype("int64")})
    for e in st.elections:
        dem, rep = select_columns(table.columns, e)
        out[f"d_{e}"] = table[dem].astype("float64")
        out[f"r_{e}"] = table[rep].astype("float64")
    vote_cols = [f"{p}_{e}" for e in st.elections for p in ("d", "r")]
    empty = out[vote_cols].isna()
    n_fields, n_units = int(empty.sum().sum()), int(empty.any(axis=1).sum())
    out[vote_cols] = out[vote_cols].fillna(0.0)
    if n_fields:
        log.info("%s: %d empty vote fields in %d units set to 0", st.postal, n_fields, n_units)
    out.attrs = {"empty_vote_fields": n_fields, "empty_vote_units": n_units}
    return out


def add_composite(df: pd.DataFrame, elections: Sequence[str]) -> pd.DataFrame:
    """Copy of df with d = sum of d_<e> and r = sum of r_<e> over the elections."""
    out = df.copy()
    out.attrs = dict(df.attrs)
    out["d"] = out[[f"d_{e}" for e in elections]].sum(axis=1)
    out["r"] = out[[f"r_{e}" for e in elections]].sum(axis=1)
    return out
