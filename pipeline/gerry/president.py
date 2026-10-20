"""Statewide presidential votes from the MIT Election Data and Science Lab, "U.S. President 1976-2024"
(Harvard Dataverse, doi:10.7910/DVN/42MVDX, version 10.1). The Senate block (extensions design, chapter 7)
takes the votes of the six single-seat states from it."""
from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pandas as pd

# The elections of the vote basis (config.yaml: pre_16, pre_20) and each party's nominee, named as in the file.
ELECTIONS = {"pre_16": "2016", "pre_20": "2020"}
NOMINEES = {
    "2016": {"d": "CLINTON, HILLARY", "r": "TRUMP, DONALD J."},
    "2020": {"d": "BIDEN, JOSEPH R. JR", "r": "TRUMP, DONALD J."},
    "2024": {"d": "HARRIS, KAMALA D.", "r": "TRUMP, DONALD J."},
}
PARTY_LINES = {"d": "DEMOCRAT", "r": "REPUBLICAN"}
COLUMNS = ["year", "state_po", "candidate", "party_detailed", "writein", "candidatevotes"]


class PresidentError(ValueError):
    """The file lacks the rows the Senate block needs for a state and an election."""


def read_president(path: Path) -> pd.DataFrame:
    """The columns of the MIT file that the Senate block uses, as text; candidatevotes as integers."""
    table = pd.read_csv(path, usecols=COLUMNS, dtype=str, keep_default_na=False, engine="c")
    table["candidatevotes"] = table["candidatevotes"].astype("int64")
    return table


def national_share(table: pd.DataFrame, year: str, states: int = 51) -> float:
    """The Democratic share of the national two-party vote in `year`: the nominees' rows that are not write-ins, on
    every party line (some states name the line DEMOCRATIC, DFL or leave it empty), in all states and DC. For the
    2024 example on the vote slider; the vote basis of the maps stays 2016 and 2020."""
    part = table[table["year"] == year]
    found = part["state_po"].nunique()
    if found != states:
        raise PresidentError(f"{year}: {found} states in the file, expected {states}")
    ballot = part[part["writein"].str.upper() == "FALSE"]
    d, r = (int(ballot.loc[ballot["candidate"] == NOMINEES[year][party], "candidatevotes"].sum())
            for party in ("d", "r"))
    if d == 0 or r == 0:
        raise PresidentError(f"{year}: no votes for a nominee")
    return d / (d + r)


def two_party_votes(table: pd.DataFrame, postals: Iterable[str]) -> pd.DataFrame:
    """Democratic and Republican votes per state, in the order of `postals`: columns state, d_pre_16, r_pre_16,
    d_pre_20, r_pre_20, d and r. A party's votes are the rows of its nominee that are not write-ins, on every
    party line: the codebook gives a candidate one row per party line, to be added up for two-party totals.
    Write-in rows hold votes for write-in candidates and never count. The nominee must have exactly one row
    on the party's own line (DEMOCRAT or REPUBLICAN); otherwise PresidentError."""
    rows = []
    for postal in postals:
        out = {"state": postal}
        for election, year in ELECTIONS.items():
            part = table[(table["state_po"] == postal) & (table["year"] == year)]
            if part.empty:
                raise PresidentError(f"{postal} {year}: no rows in the file")
            writein = part["writein"].str.upper()
            if not writein.isin(["TRUE", "FALSE"]).all():
                raise PresidentError(f"{postal} {year}: writein must be TRUE or FALSE in every row")
            ballot = part[writein == "FALSE"]
            for party, nominee in NOMINEES[year].items():
                mine = ballot[ballot["candidate"] == nominee]
                own_line = int((mine["party_detailed"] == PARTY_LINES[party]).sum())
                if own_line != 1:
                    raise PresidentError(f"{postal} {year}: {nominee} has {own_line} rows on the "
                                         f"{PARTY_LINES[party]} line, expected 1")
                out[f"{party}_{election}"] = int(mine["candidatevotes"].sum())
        out["d"] = sum(out[f"d_{election}"] for election in ELECTIONS)
        out["r"] = sum(out[f"r_{election}"] for election in ELECTIONS)
        rows.append(out)
    columns = ["state", *(f"{party}_{election}" for election in ELECTIONS for party in ("d", "r")), "d", "r"]
    return pd.DataFrame(rows, columns=columns)
