"""ALARM stats files: votes per district per plan for the ensemble and for ALARM's reference map."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from gerry.checks import CheckError
from gerry.config import StateConfig
from gerry.units import add_composite, select_columns

N_PLANS = 5000
REFERENCE_DRAW = "cd_2020"   # the map in effect in 2022, not part of the ensemble


def read_stats(path: Path) -> pd.DataFrame:
    """The stats CSV. R pads numbers with spaces, hence skipinitialspace. Draw ids are text."""
    return pd.read_csv(path, skipinitialspace=True, dtype={"draw": str}, low_memory=False, encoding="utf-8")


def _district_codes(values: pd.Series, postal: str) -> pd.Series:
    numbers = pd.to_numeric(values)
    if numbers.isna().any() or (numbers % 1 != 0).any():
        raise CheckError("ensemble_structure", postal, "district numbers are not whole numbers")
    return numbers.astype("int64").map("{:02d}".format)


def _check_plans(plans: pd.DataFrame, seats: int, postal: str, label: str) -> None:
    """Each draw has the districts 01..seats exactly once."""
    expected = {f"{k:02d}" for k in range(1, seats + 1)}
    odd = plans[~plans["district"].isin(expected)]
    if len(odd):
        raise CheckError("ensemble_structure", postal,
                         f"{label} draw {odd['draw'].iloc[0]} has district {odd['district'].iloc[0]}")
    twice = plans[plans.duplicated(["draw", "district"])]
    if len(twice):
        raise CheckError("ensemble_structure", postal,
                         f"{label} draw {twice['draw'].iloc[0]} has district {twice['district'].iloc[0]} twice")
    rows = plans.groupby("draw").size()
    short = rows[rows != seats]
    if len(short):
        raise CheckError("ensemble_structure", postal,
                         f"{label} draw {short.index[0]} has {short.iloc[0]} districts, expected {seats}")


def district_votes(stats: pd.DataFrame, st: StateConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(ensemble, reference) with columns state, draw, district, d_<e>, r_<e>, d, r. The ensemble also keeps
    ALARM's chain, the separate run each plan comes from (review of October 2026, finding 2)."""
    out = pd.DataFrame({"state": st.postal, "draw": stats["draw"].astype(str).str.strip(),
                        "chain": pd.to_numeric(stats["chain"], errors="coerce").astype("Int64"),
                        "district": _district_codes(stats["district"], st.postal)})
    for e in st.elections:
        dem, rep = select_columns(stats.columns, e)
        for col, source in ((f"d_{e}", dem), (f"r_{e}", rep)):
            values = pd.to_numeric(stats[source])
            if values.isna().any():
                raise CheckError("ensemble_votes", st.postal, f"{source} has {int(values.isna().sum())} empty values")
            out[col] = values.astype("float64")
    out = add_composite(out, st.elections)
    is_reference = out["draw"] == REFERENCE_DRAW
    ensemble = out[~is_reference].reset_index(drop=True)
    reference = out[is_reference].drop(columns="chain").reset_index(drop=True)
    no_chain = ensemble[ensemble["chain"].isna()]
    if len(no_chain):
        raise CheckError("ensemble_structure", st.postal, f"draw {no_chain['draw'].iloc[0]} has no chain")
    _check_plans(ensemble, st.seats, st.postal, "ensemble")
    _check_plans(reference, st.seats, st.postal, "reference")
    if reference.empty:
        raise CheckError("ensemble_structure", st.postal, f"no rows with draw {REFERENCE_DRAW}")
    n_plans = ensemble["draw"].nunique()
    if n_plans != N_PLANS:
        raise CheckError("ensemble_structure", st.postal, f"{n_plans} plans, expected {N_PLANS}")
    return ensemble, reference


def reference_labels(stats: pd.DataFrame, map_pop: pd.Series, postal: str) -> dict[str, str]:
    """Label of each cd_2020 district in the stats file -> label of the map.rds district with exactly the
    same population. map_pop: population per cd_2020 label of map.rds ("01" -> int). The two files do not
    always number the districts alike (Oregon)."""
    ref = stats[stats["draw"].astype(str).str.strip() == REFERENCE_DRAW]
    labels = {}
    for label, pop in zip(_district_codes(ref["district"], postal), pd.to_numeric(ref["total_pop"])):
        hits = list(map_pop.index[map_pop == pop])
        if len(hits) != 1:
            raise CheckError("reference_labels", postal, f"cd_2020 district {label} (population {int(pop)}) "
                                                         f"matches {len(hits)} districts of map.rds")
        labels[label] = hits[0]
    for target in sorted(set(labels.values())):
        sources = sorted(k for k, v in labels.items() if v == target)
        if len(sources) > 1:
            raise CheckError("reference_labels", postal, f"cd_2020 districts {', '.join(sources)} all match "
                                                         f"district {target} of map.rds")
    return labels
