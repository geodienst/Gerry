"""Votes per unit (VTD, block or county): column choice, loading, align_to_alarm and the composite."""
from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Sequence
from pathlib import Path

import pandas as pd

from gerry.config import AlignEntry, StateConfig
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


def _county_id_column(table: pd.DataFrame, st: StateConfig) -> str:
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


def _read_table(st: StateConfig, root: Path) -> tuple[pd.DataFrame, str]:
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


def load_units(st: StateConfig, root: Path) -> pd.DataFrame:
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


def align_to_alarm(units: pd.DataFrame, alarm_table: pd.DataFrame, entry: AlignEntry,
                   elections: Sequence[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Scale the unit votes inside each of entry.units, per column, to ALARM's total for that unit.

    Returns (scaled copy of units, table with columns column, before, after summed over entry.units)."""
    out = units.copy()
    out.attrs = dict(units.attrs)
    key = out["unit_id"].str[: entry.unit_len]
    listed = alarm_table[alarm_table[entry.unit_column].isin(entry.units)]
    counts = listed[entry.unit_column].value_counts()
    wrong = [u for u in entry.units if counts.get(u, 0) != 1]
    if wrong:
        raise UnitsError(f"{entry.state}: expected one row per unit in column {entry.unit_column} "
                         f"of {entry.rds}: {', '.join(wrong)}")
    alarm = listed.set_index(entry.unit_column)
    rows = []
    for e in elections:
        dem, rep = select_columns(alarm_table.columns, e)
        for col, alarm_col in ((f"d_{e}", dem), (f"r_{e}", rep)):
            before = after = 0.0
            for unit in entry.units:
                inside = key == unit
                if not inside.any():
                    raise UnitsError(f"{entry.state}: no units inside {unit}")
                current = float(out.loc[inside, col].sum())
                target = float(alarm.at[unit, alarm_col])
                if current == 0 and target != 0:
                    raise UnitsError(f"{entry.state}: {unit} has no {col} votes to scale to {target}")
                if current != 0:
                    out.loc[inside, col] = out.loc[inside, col] * (target / current)
                before += current
                after += target
            rows.append({"column": col, "before": before, "after": after})
            log.info("%s: align_to_alarm %s %.1f -> %.1f", entry.state, col, before, after)
    return out, pd.DataFrame(rows, columns=["column", "before", "after"])
