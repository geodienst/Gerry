"""Tests for CheckError and the data/sources.md reader in gerry.checks.

The tests read the real data/sources.md and change one cell at a time in a copy.
They do not depend on the current statuses or date, so they keep working after
a status re-check.
"""
import re
from datetime import date, timedelta
from pathlib import Path

import pytest

from gerry.checks import CheckError, check_sources_md, parse_sources_md
from gerry.config import REPO_ROOT, load_config

SOURCES_MD = REPO_ROOT / "data" / "sources.md"


def real_text() -> str:
    return SOURCES_MD.read_text(encoding="utf-8")


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "sources.md"
    path.write_text(text, encoding="utf-8")
    return path


def split(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def table_start(lines: list[str], heading: str) -> int:
    """Index of the header row of the first table under '## heading'."""
    i = lines.index(f"## {heading}") + 1
    while not lines[i].startswith("|"):
        i += 1
    return i


def change_cell(text: str, heading: str, postal: str, column: str, change) -> str:
    """Apply change(old_cell) -> new_cell to one cell. column 'Map' matches 'Map...'."""
    lines = text.splitlines()
    i = table_start(lines, heading)
    header = split(lines[i])
    col = next(k for k, h in enumerate(header) if h == column or (column == "Map" and h.startswith("Map")))
    for j in range(i + 2, len(lines)):
        if not lines[j].startswith("|"):
            break
        cells = split(lines[j])
        if cells[header.index("State")] == postal:
            cells[col] = change(cells[col])
            lines[j] = "| " + " | ".join(cells) + " |"
            return "\n".join(lines) + "\n"
    raise AssertionError(f"no row for {postal} under {heading}")


def swap_columns(text: str, heading: str, a: str, b: str) -> str:
    """Swap two columns of the first table under '## heading', header and rows."""
    lines = text.splitlines()
    i = table_start(lines, heading)
    header = split(lines[i])
    ia, ib = header.index(a), header.index(b)
    while i < len(lines) and lines[i].startswith("|"):
        cells = split(lines[i])
        cells[ia], cells[ib] = cells[ib], cells[ia]
        lines[i] = "| " + " | ".join(cells) + " |"
        i += 1
    return "\n".join(lines) + "\n"


def test_check_error_carries_its_parts():
    err = CheckError("vap", "NV", "block VAP 10 differs from unit VAP 11")
    assert (err.check, err.state, err.detail) == ("vap", "NV", "block VAP 10 differs from unit VAP 11")
    assert str(err) == "vap failed for NV: block VAP 10 differs from unit VAP 11"
    assert isinstance(err, RuntimeError)


def test_parse_real_sources_md():
    parsed = parse_sources_md(SOURCES_MD)
    assert parsed["status_checked"] >= date(2026, 10, 3)
    assert len(parsed["multi"]) == 44
    assert sum(row["seats"] for row in parsed["multi"].values()) == 429
    tx = parsed["multi"]["TX"]
    assert tx["seats"] == 38
    assert tx["map_name"] == "PLANC2333 (HB 4)"
    assert tx["url"] == "https://data.capitol.texas.gov/dataset/planc2333"
    assert tx["pipeline_file"] == "CD120"
    assert tx["status"] in {"In effect", "Challenged"}
    assert parsed["multi"]["MO"]["pipeline_file"] == "CD118"
    [hb1] = parsed["blocked"]["MO"]
    assert hb1["map_name"] == "HB 1 of 2025"
    assert hb1["url"] == "https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/"
    assert set(parsed["blocked"]) == {"MO"}
    assert set(parsed["at_large"]) == {"AK", "DE", "ND", "SD", "VT", "WY"}
    assert parsed["at_large"]["VT"] == {
        "seats": 1, "map_name": "At large", "url": None, "status": "At-large", "pipeline_file": "CD120",
    }


def test_real_sources_md_matches_real_config():
    check_sources_md(load_config(), SOURCES_MD)


def test_columns_are_found_by_header_name(tmp_path):
    text = swap_columns(real_text(), "Multi-seat states", "Status", "Pipeline file")
    assert "| Pipeline file | Status |" in text
    check_sources_md(load_config(), write(tmp_path, text))


def test_tables_under_other_headings_are_ignored(tmp_path):
    text = real_text() + (
        "\n## Notes per state\n\n| State | Seats | Map | Status | Pipeline file |\n"
        "|---|---|---|---|---|\n| XX | 9 | Some map | Blocked | CD118 |\n"
    )
    parsed = parse_sources_md(write(tmp_path, text))
    assert "XX" not in parsed["multi"] and "XX" not in parsed["blocked"] and "XX" not in parsed["at_large"]
    check_sources_md(load_config(), write(tmp_path, text))


def other_status(value: str) -> str:
    return "Challenged" if value == "In effect" else "In effect"


MISMATCHES = [
    # (table heading, state, column, change to the cell, state in the error, words in the detail)
    ("Multi-seat states", "MO", "Status", other_status, "MO", "status"),
    ("Multi-seat states", "NV", "Seats", lambda v: str(int(v) + 1), "NV", "seats"),
    ("Multi-seat states", "MO", "Pipeline file", lambda v: "CD120" if v == "CD118" else "CD118",
     "MO", "pipeline_file"),
    ("Multi-seat states", "AL", "Map", lambda v: v.replace("](", " changed](", 1), "AL", "map_name"),
    ("Multi-seat states", "TX", "Map", lambda v: v[:-1] + "x)", "TX", "url"),
    ("Blocked maps", "MO", "Status", lambda v: "In effect", "MO", "status"),
    ("Blocked maps", "MO", "Map", lambda v: v.replace("](", " changed](", 1), "MO", "extra_maps"),
    ("At-large states", "VT", "Status", lambda v: "In effect", "VT", "status"),
]


@pytest.mark.parametrize("heading, postal, column, change, state, words", MISMATCHES)
def test_mismatch_raises(tmp_path, heading, postal, column, change, state, words):
    text = change_cell(real_text(), heading, postal, column, change)
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text))
    assert info.value.check == "sources_md"
    assert info.value.state == state
    assert words in info.value.detail


def test_date_mismatch_raises(tmp_path):
    text = real_text()
    found = re.search(r"Status checked on (\d{4}-\d{2}-\d{2})", text)
    later = (date.fromisoformat(found.group(1)) + timedelta(days=1)).isoformat()
    text = text.replace(found.group(0), f"Status checked on {later}", 1)
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text))
    assert info.value.state == "US"
    assert later in info.value.detail


def test_missing_row_raises(tmp_path):
    text = real_text()
    ks_line = next(line for line in text.splitlines(keepends=True) if line.startswith("| KS |"))
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text.replace(ks_line, "")))
    assert info.value.state == "KS"
    assert "no row" in info.value.detail


def test_missing_heading_raises(tmp_path):
    text = real_text().replace("## Blocked maps", "## Blocked plans")
    with pytest.raises(CheckError, match="Blocked maps"):
        parse_sources_md(write(tmp_path, text))


def test_map_cell_with_link_and_text_raises(tmp_path):
    text = change_cell(real_text(), "Multi-seat states", "NM", "Map", lambda v: v + " and amendments")
    with pytest.raises(CheckError) as info:
        parse_sources_md(write(tmp_path, text))
    assert info.value.state == "NM"
