"""Pipeline checks. Every failed check raises CheckError naming the check, the state and the values."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

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
