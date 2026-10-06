"""Pipeline checks. Every failed check raises CheckError naming the check, the state and the values."""
from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date
from pathlib import Path

import pandas as pd

from gerry.config import Config


class CheckError(RuntimeError):
    """A pipeline check failed. The pipeline stops; the message names check, state and values."""

    def __init__(self, check: str, state: str, detail: str):
        self.check = check
        self.state = state
        self.detail = detail
        super().__init__(f"{check} failed for {state}: {detail}")


# --- data/sources.md ---------------------------------------------------------

_SECTIONS = {"multi": "Multi-seat states", "blocked": "Blocked maps", "at_large": "At-large states"}
_DATE_LINE = re.compile(r"Status checked on (\d{4}-\d{2}-\d{2})\b")
_LINK = re.compile(r"\[([^\]]+)\]\(([^()\s]+)\)")
_AT_LARGE_ROW = {"seats": 1, "map_name": "At large", "url": None, "status": "At-large", "pipeline_file": "CD120"}


def parse_sources_md(path: Path) -> dict:
    """Read the date line and the three status tables of data/sources.md.

    Returns {"status_checked": date, "multi": {ST: row}, "blocked": {ST: [row, ...]},
    "at_large": {ST: row}}. A row is {"map_name", "url", "status", "pipeline_file"}
    plus "seats" (int) in "multi" and "at_large". "url" is None when the map cell has no link.
    """
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    body = [line for line in lines if line.strip() and not line.startswith("#")]
    match = _DATE_LINE.match(body[0]) if body else None
    if match is None:
        raise CheckError("sources_md", "US", "the first line under the title does not start with "
                         "'Status checked on YYYY-MM-DD'")
    parsed: dict = {"status_checked": date.fromisoformat(match.group(1))}
    for key, heading in _SECTIONS.items():
        header, cells = _table(lines, heading)
        rows = [_row(header, raw, heading, with_seats=key != "blocked") for raw in cells]
        if key == "blocked":
            grouped: dict[str, list[dict]] = {}
            for postal, row in rows:
                grouped.setdefault(postal, []).append(row)
            parsed[key] = grouped
        else:
            seen: dict[str, dict] = {}
            for postal, row in rows:
                if postal in seen:
                    raise CheckError("sources_md", postal, f"two rows under '{heading}'")
                seen[postal] = row
            parsed[key] = seen
    return parsed


def check_sources_md(cfg: Config, path: Path) -> None:
    """config.yaml and data/sources.md must agree on every compared field (spec chapter 6)."""
    parsed = parse_sources_md(path)
    problems: list[tuple[str, str]] = []

    if parsed["status_checked"] != cfg.status_checked:
        problems.append(("US", f"sources.md says status checked on {parsed['status_checked']}, "
                               f"config.yaml status_checked is {cfg.status_checked}"))

    multi = parsed["multi"]
    for postal in sorted(set(cfg.states) | set(multi)):
        if postal not in cfg.states:
            problems.append((postal, "row under 'Multi-seat states' but not in config.yaml states"))
        elif postal not in multi:
            problems.append((postal, "in config.yaml states but no row under 'Multi-seat states'"))
        else:
            st = cfg.states[postal]
            expected = {"seats": st.seats, "map_name": st.map_name, "url": st.source_url,
                        "status": st.status, "pipeline_file": st.bef.upper()}
            problems += _compare(postal, multi[postal], expected)

    blocked = parsed["blocked"]
    for postal in sorted(set(blocked) | {p for p, s in cfg.states.items() if s.extra_maps}):
        rows = {row["map_name"]: row for row in blocked.get(postal, [])}
        maps = {m.name: m for m in cfg.states[postal].extra_maps} if postal in cfg.states else {}
        for name in sorted(set(rows) - set(maps)):
            problems.append((postal, f"blocked map {name!r} in sources.md but not in config.yaml extra_maps"))
        for name in sorted(set(maps) - set(rows)):
            problems.append((postal, f"extra map {name!r} in config.yaml but no row under 'Blocked maps'"))
        for name in sorted(set(rows) & set(maps)):
            m = maps[name]
            expected = {"map_name": m.name, "url": m.source_url, "status": m.status,
                        "pipeline_file": m.bef.upper()}
            problems += _compare(postal, rows[name], expected)

    at_large = parsed["at_large"]
    for postal in sorted(set(cfg.at_large) | set(at_large)):
        if postal not in cfg.at_large:
            problems.append((postal, "row under 'At-large states' but not in config.yaml at_large"))
        elif postal not in at_large:
            problems.append((postal, "in config.yaml at_large but no row under 'At-large states'"))
        else:
            problems += _compare(postal, at_large[postal], _AT_LARGE_ROW)

    if problems:
        states = ",".join(sorted({postal for postal, _ in problems}))
        raise CheckError("sources_md", states, "; ".join(f"{p}: {d}" for p, d in problems))


def _compare(postal: str, row: dict, expected: dict) -> list[tuple[str, str]]:
    return [(postal, f"{field}: sources.md has {row[field]!r}, config.yaml has {want!r}")
            for field, want in expected.items() if row[field] != want]


def _cells(line: str) -> list[str]:
    inner = line.strip()
    inner = inner[1:] if inner.startswith("|") else inner
    inner = inner[:-1] if inner.endswith("|") else inner
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", inner)]


def _table(lines: list[str], heading: str) -> tuple[list[str], list[dict[str, str]]]:
    """Header and rows ({header: cell}) of the first table under '## heading'."""
    starts = [i for i, line in enumerate(lines) if line.strip() == f"## {heading}"]
    if len(starts) != 1:
        raise CheckError("sources_md", "US", f"expected one heading '## {heading}', found {len(starts)}")
    table: list[str] = []
    for line in lines[starts[0] + 1:]:
        if line.startswith("#"):
            break
        if line.startswith("|"):
            table.append(line)
        elif table:
            break
    if len(table) < 2 or not all(re.fullmatch(r":?-{3,}:?", c) for c in _cells(table[1])):
        raise CheckError("sources_md", "US", f"no table under '## {heading}'")
    header = _cells(table[0])
    rows = []
    for line in table[2:]:
        cells = _cells(line)
        if len(cells) != len(header):
            raise CheckError("sources_md", "US", f"row under '{heading}' has {len(cells)} cells, "
                                                 f"header has {len(header)}: {line}")
        rows.append(dict(zip(header, cells)))
    return header, rows


def _column(header: list[str], raw: dict, name: str, heading: str) -> str:
    if name not in header:
        raise CheckError("sources_md", "US", f"table under '{heading}' has no column '{name}'")
    return raw[name]


def _row(header: list[str], raw: dict, heading: str, with_seats: bool) -> tuple[str, dict]:
    postal = _column(header, raw, "State", heading)
    if not re.fullmatch(r"[A-Z]{2}", postal):
        raise CheckError("sources_md", "US", f"'{postal}' under '{heading}' is not a postal code")
    map_columns = [h for h in header if h == "Map" or h.startswith("Map ")]
    if len(map_columns) != 1:
        raise CheckError("sources_md", "US", f"table under '{heading}' needs one column named 'Map...', "
                                             f"found {map_columns}")
    cell = raw[map_columns[0]]
    link = _LINK.fullmatch(cell)
    if link:
        map_name, url = link.group(1), link.group(2)
    elif "[" in cell or "](" in cell:
        raise CheckError("sources_md", postal, f"map cell is neither one link nor plain text: {cell!r}")
    else:
        map_name, url = cell, None
    row = {"map_name": map_name, "url": url, "status": _column(header, raw, "Status", heading),
           "pipeline_file": _column(header, raw, "Pipeline file", heading)}
    if with_seats:
        seats = _column(header, raw, "Seats", heading)
        if not seats.isdigit():
            raise CheckError("sources_md", postal, f"Seats is not a whole number: {seats!r}")
        row = {"seats": int(seats), **row}
    return postal, row


# --- data checks (phase 1) ------------------------------------------------------

def _vote_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c in ("d", "r") or c.startswith(("d_", "r_"))]


def check_units_linked(units: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series, state: str) -> None:
    """Every unit with votes has at least one block outside ZZ."""
    district = district_of.reindex(unit_of.index)
    linked = set(unit_of[district.notna() & (district != "ZZ")])
    has_votes = (units[_vote_columns(units)] != 0).any(axis=1)
    bad = units.loc[has_votes & ~units["unit_id"].isin(linked), "unit_id"]
    if len(bad):
        raise CheckError("units_linked", state,
                         f"{len(bad)} units with votes have no block outside ZZ, e.g. {bad.iloc[0]}")


def check_vap_pop(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, state: str) -> tuple[int, int]:
    """Per unit, block VAP (P0030001) and POP100 add up to vap and pop of map.rds. Blocks whose key
    (unit_of) is not a unit must have VAP 0 and POP100 0. Returns (number of those blocks, of their keys)."""
    keys = blocks["block_id"].map(unit_of)
    if keys.isna().any():
        raise CheckError("vap_pop", state, f"{int(keys.isna().sum())} blocks have no key, "
                                           f"e.g. {blocks.loc[keys.isna(), 'block_id'].iloc[0]}")
    known = keys.isin(units["unit_id"]).to_numpy()
    outside = blocks[~known]
    people = outside[(outside["vap"] > 0) | (outside["pop"] > 0)]
    if len(people):
        first = people.iloc[0]
        raise CheckError("vap_pop", state, f"{len(people)} blocks with VAP or population belong to no unit, "
                                           f"e.g. {first['block_id']} (VAP {int(first['vap'])}, "
                                           f"population {int(first['pop'])})")
    sums = blocks[known].groupby(keys[known].to_numpy())[["vap", "pop"]].sum()
    expected = units.set_index("unit_id")
    for col in ("vap", "pop"):
        got = sums[col].reindex(expected.index, fill_value=0)
        bad = expected.index[(got != expected[col]).to_numpy()]
        if len(bad):
            first = bad[0]
            raise CheckError("vap_pop", state, f"{col}: {len(bad)} units differ, e.g. {first}: "
                                               f"map {int(expected.at[first, col])}, blocks {int(got[first])}")
    return int((~known).sum()), int(keys[~known].nunique())


def check_reference_labels(labels: pd.Series, district_of: pd.Series, pop: pd.Series, state: str,
                           min_share: float = 0.97) -> float:
    """ALARM's reference map in map.rds against CD118, by block population, without ZZ blocks.

    labels: block_id -> cd_2020 label of the block's unit (blocks without unit are left out);
    district_of: block_id -> CD118 district; pop: block_id -> POP100. Each label must overlap most with
    the CD118 district of the same code, without a tie, every CD118 district must be a label, and at least
    min_share of the population must have the same code in both. Returns that share."""
    labels = labels.dropna()
    df = pd.DataFrame({"label": labels, "district": district_of.reindex(labels.index),
                       "pop": pop.reindex(labels.index)})
    if df[["district", "pop"]].isna().any().any():
        raise CheckError("reference_labels", state, "blocks with a label are missing from CD118 or P.L. 94-171")
    df = df[df["district"] != "ZZ"]
    overlap = df.groupby(["label", "district"])["pop"].sum().unstack(fill_value=0)
    missing = sorted(set(overlap.columns) - set(overlap.index))
    extra = sorted(set(overlap.index) - set(overlap.columns))
    if missing or extra:
        raise CheckError("reference_labels", state, f"CD118 districts without a map.rds district: "
                                                    f"{', '.join(missing) or 'none'}; map.rds districts not "
                                                    f"in CD118: {', '.join(extra) or 'none'}")
    for label, row in overlap.iterrows():
        top = list(row.index[row == row.max()])
        if len(top) > 1:
            raise CheckError("reference_labels", state, f"district {label} of map.rds overlaps equally with "
                                                        f"CD118 districts {', '.join(top)}")
        if top[0] != label:
            raise CheckError("reference_labels", state, f"district {label} of map.rds overlaps most with "
                                                        f"CD118 district {top[0]}")
    share = float(sum(overlap.at[k, k] for k in overlap.index) / overlap.to_numpy().sum())
    if share < min_share:
        raise CheckError("reference_labels", state, f"{share:.4f} of the population has the same district in "
                                                    f"map.rds and CD118, below {min_share}")
    return share


def check_conservation(units: pd.DataFrame, district_totals: pd.DataFrame, vote_cols: Sequence[str],
                       state: str, rel_tol: float = 1e-9) -> None:
    """The district totals of a map add up to the unit totals, per vote column."""
    for col in vote_cols:
        want, got = float(units[col].sum()), float(district_totals[col].sum())
        if abs(got - want) > rel_tol * max(abs(want), 1.0):
            raise CheckError("conservation", state, f"{col}: districts {got:.6f}, units {want:.6f}")


def check_ensemble_totals(ensemble: pd.DataFrame, units: pd.DataFrame, elections: Sequence[str], seats: int,
                          state: str) -> None:
    """Per plan and per election column: |plan total - unit total| <= 0.5 x seats (ALARM rounds per district)."""
    limit = 0.5 * seats
    cols = [f"{p}_{e}" for e in elections for p in ("d", "r")]
    plan_totals = ensemble.groupby("draw")[cols].sum()
    for col in cols:
        want = float(units[col].sum())
        deviation = (plan_totals[col] - want).abs()
        worst = deviation.idxmax()
        if deviation[worst] > limit:
            raise CheckError("ensemble_totals", state,
                             f"{col}: draw {worst} has {plan_totals.at[worst, col]:.1f}, units {want:.1f}, "
                             f"difference {deviation[worst]:.1f} above {limit}")


def check_district_count(district_totals: pd.DataFrame, seats: int, state: str) -> None:
    """The map has exactly the districts 01..seats."""
    got = sorted(district_totals["district"])
    if got != [f"{k:02d}" for k in range(1, seats + 1)]:
        raise CheckError("district_count", state, f"districts {', '.join(got)}; expected 01 to {seats:02d}")


def check_geoids(block_ids: pd.Series, fips: str, state: str) -> None:
    """Block GEOIDs are unique text of 15 digits that starts with the state FIPS code."""
    ids = pd.Series(block_ids)
    if not pd.api.types.is_string_dtype(ids):
        raise CheckError("geoids", state, f"block ids are not text but {ids.dtype}")
    ok = ids.str.fullmatch(r"\d{15}") & ids.str.startswith(fips)
    if not ok.all():
        raise CheckError("geoids", state, f"{int((~ok).sum())} block ids are not 15 digits starting with {fips}, "
                                          f"e.g. {ids[~ok].iloc[0]}")
    if not ids.is_unique:
        raise CheckError("geoids", state, f"block id {ids[ids.duplicated()].iloc[0]} occurs twice")
