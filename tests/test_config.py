"""Tests for gerry.config: the loader on small configs, then the real config.yaml."""
from datetime import date
from pathlib import Path

import pytest
import yaml

from gerry.config import (
    ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, ConfigError, ExtraMap,
    data_dir, interim_dir, load_config,
)

SOURCE_KEYS = ("dataverse_api", "cd118", "cd119", "cd120", "pl94171", "census_vest",
               "tiger_gpkg", "tiger_mo_cd119", "cb_states")


def minimal() -> dict:
    """A small valid config: two multi-seat states and one at-large state."""
    return {
        "status_checked": date(2026, 10, 3),
        "census_vest_commit": "243c8a8134ecf8151777a9388c48323e274767e2",
        "ensemble": {
            "name": "alarm_v15",
            "doi": "doi:10.7910/DVN/SLCD3E",
            "version": 15,
            "notes": {"NM": ["core_preservation_prior_map"], "MO": ["vra_constraint", "vra_filter_bvap"]},
            "fill": {"NM": {"reference_map": "the 2021 map", "consequence": "It is closer to zero."}},
        },
        "sources": {key: f"https://example.org/{key}" for key in SOURCE_KEYS},
        "states": {
            "MO": {
                "name": "Missouri", "fips": "29", "seats": 8, "map_name": "HB 2909 of 2022",
                "status": "In effect", "source_label": "Redistricting Data Hub",
                "source_url": "https://example.org/mo-2022", "bef": "cd118",
                "elections": ["pre_16", "pre_20"], "unit_kind": "vtd",
                "extra_maps": {"mo_hb1": {
                    "name": "HB 1 of 2025", "status": "Blocked", "bef": "cd120",
                    "source_label": "Redistricting Data Hub", "source_url": "https://example.org/mo-2025"}},
                "notes": ["blocked_map"],
            },
            "NM": {
                "name": "New Mexico", "fips": "35", "seats": 3, "map_name": "SB 1 of 2021",
                "status": "In effect", "source_label": "New Mexico Legislature",
                "source_url": "https://example.org/nm", "bef": "cd120",
                "elections": ["pre_16", "pre_20"], "unit_kind": "tract",
            },
        },
        "at_large": {"VT": {"name": "Vermont", "fips": "50"}},
    }


def write(tmp_path: Path, raw: dict) -> Path:
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(raw, sort_keys=False), encoding="utf-8")
    return path


def test_minimal_config_loads_with_types(tmp_path):
    cfg = load_config(write(tmp_path, minimal()))
    assert cfg.status_checked == date(2026, 10, 3)
    assert cfg.ensemble.version == 15
    assert cfg.ensemble.notes["MO"] == ("vra_constraint", "vra_filter_bvap")
    assert cfg.ensemble.fill["NM"]["reference_map"] == "the 2021 map"
    mo = cfg.states["MO"]
    assert (mo.postal, mo.fips, mo.seats, mo.bef) == ("MO", "29", 8, "cd118")
    assert mo.elections == ("pre_16", "pre_20")
    assert (mo.unit_kind, cfg.states["NM"].unit_kind) == ("vtd", "tract")
    assert mo.notes == ("blocked_map",)
    assert mo.extra_maps == (ExtraMap(
        id="mo_hb1", name="HB 1 of 2025", status="Blocked", bef="cd120",
        source_label="Redistricting Data Hub", source_url="https://example.org/mo-2025"),)
    assert cfg.states["NM"].extra_maps == ()
    assert cfg.states["NM"].notes == ()
    assert cfg.at_large["VT"].fips == "50"


def set_path(raw: dict, path: str, value) -> None:
    """Set raw[a][b][c] = value for path 'a.b.c'; value None deletes the key."""
    *parents, last = path.split(".")
    node = raw
    for key in parents:
        node = node[key]
    if value is None:
        del node[last]
    else:
        node[last] = value


BAD_VALUES = [
    ("states.NM.status", "Blocked", "status"),
    ("states.NM.bef", "cd119", "bef"),
    ("states.NM.unit_kind", "block", "unit_kind"),
    ("states.NM.unit_source", "vtd", "unknown keys"),     # the key before unit_kind
    ("align_to_alarm", [], "unknown keys"),               # replaced by the weights within a tract
    ("states.NM.fips", 35, "fips"),
    ("states.NM.seats", 1, "seats"),
    ("states.NM.elections", [], "elections"),
    ("states.NM.elections", ["pre_2020"], "elections"),
    ("states.NM.notes", ["vra_constraint"], "unknown note keys"),
    ("states.NM.seat", 3, "unknown keys"),
    ("states.NM.map_name", None, "missing keys"),
    ("states.NM.source_url", "http://example.org/nm", "https"),
    ("states.MO.extra_maps.mo_hb1.status", "In effect", "status"),
    ("states.MO.extra_maps.mo_hb1.bef", "cd118x", "bef"),
    ("ensemble.notes.MO", ["packing"], "unknown note keys"),
    ("ensemble.notes.TX", ["vra_constraint"], "not in states"),
    ("ensemble.fill", {}, "core_preservation_prior_map"),
    ("ensemble.fill.MO", {"reference_map": "x", "consequence": "y"}, "core_preservation_prior_map"),
    ("ensemble.doi", "10.7910/DVN/SLCD3E", "doi"),
    ("status_checked", "October 3", "status_checked"),
    ("census_vest_commit", "main", "census_vest_commit"),
    ("sources.cd120", None, "missing keys"),
    ("at_large.NM", {"name": "New Mexico", "fips": "35"}, "both list"),
    ("at_large.VT.fips", "29", "more than once"),
    # map_2024 is the map id of the 2024 map in 02_join.py (Task 5.3)
    ("states.MO.extra_maps.map_2024", {"name": "x", "status": "Blocked", "bef": "cd120", "source_label": "x",
                                       "source_url": "https://example.org/x"}, "not a valid map id"),
]


@pytest.mark.parametrize("path, value, message", BAD_VALUES)
def test_invalid_config_raises(tmp_path, path, value, message):
    raw = minimal()
    set_path(raw, path, value)
    with pytest.raises(ConfigError, match=message):
        load_config(write(tmp_path, raw))


def test_repo_root_holds_the_pipeline():
    assert (REPO_ROOT / "pipeline" / "gerry" / "config.py").is_file()


def test_data_dir_defaults_to_data_raw(monkeypatch):
    monkeypatch.delenv("GERRY_DATA_DIR", raising=False)
    assert data_dir() == REPO_ROOT / "data" / "raw"


def test_data_dir_follows_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("GERRY_DATA_DIR", str(tmp_path))
    assert data_dir() == tmp_path.resolve()


def test_interim_dir():
    assert interim_dir() == REPO_ROOT / "data" / "interim"


# --- the real pipeline/config.yaml ------------------------------------------

AT_LARGE = {"AK", "DE", "ND", "SD", "VT", "WY"}
TRACT_STATES = {"CA", "HI", "ME", "OR"}
# Spec chapter 5, notes table: which states get which note.
ENSEMBLE_NOTES = {
    "vra_constraint": {"AL", "AZ", "CA", "FL", "GA", "LA", "MI", "MO", "MS", "NC", "OH", "RI", "SC", "WA"},
    "vra_constraint_cvap": {"TX"},
    "core_preservation_prior_map": {"LA", "NM", "UT"},
    "core_preservation_2010": {"KS", "NE"},
    "competitiveness_rule": {"AZ", "CO"},
    "vra_filter_with_votes": {"AL", "SC"},
    "vra_filter_bvap": {"MO"},
    "vra_filter_minority_majority": {"MI"},
    "vra_fixed_district": {"OH"},
    "alarm_rerun_unpublished": {"AL", "CO", "KS", "MI", "MS", "NC", "NY", "OH", "PA", "SC", "WA"},
    "alarm_method_update_pending": {"CA", "FL", "TX"},
}
STATE_NOTES = {
    "adopted_after_2024_election": {"CA", "FL", "LA", "NC", "OH", "TN", "TX", "UT"},
    "composite_2020_only": {"WV"},
    "blocked_map": {"MO"},
}


@pytest.fixture(scope="module")
def cfg():
    return load_config()


def test_real_config_has_44_states_with_429_seats(cfg):
    assert len(cfg.states) == 44
    assert sum(s.seats for s in cfg.states.values()) == 429
    assert all(postal == s.postal for postal, s in cfg.states.items())


def test_real_config_has_six_at_large_states(cfg):
    assert set(cfg.at_large) == AT_LARGE


def test_real_config_status_values(cfg):
    assert {s.status for s in cfg.states.values()} <= {"In effect", "Challenged"}
    extra = [m for s in cfg.states.values() for m in s.extra_maps]
    assert [(m.id, m.status, m.bef) for m in extra] == [("mo_hb1", "Blocked", "cd120")]


def test_real_config_ensemble_notes_match_spec(cfg):
    for key, expected in ENSEMBLE_NOTES.items():
        got = {postal for postal, keys in cfg.ensemble.notes.items() if key in keys}
        assert got == expected, key
    assert {k for keys in cfg.ensemble.notes.values() for k in keys} <= set(ENSEMBLE_NOTE_KEYS)


def test_real_config_state_notes_match_spec(cfg):
    for key, expected in STATE_NOTES.items():
        assert {p for p, s in cfg.states.items() if key in s.notes} == expected, key
    assert {k for s in cfg.states.values() for k in s.notes} <= set(STATE_NOTE_KEYS)


def test_real_config_fill_for_core_preservation(cfg):
    assert set(cfg.ensemble.fill) == ENSEMBLE_NOTES["core_preservation_prior_map"]
    assert cfg.ensemble.fill["NM"]["reference_map"] == "the 2021 map"


def test_real_config_bef_and_unit_kind(cfg):
    assert {p for p, s in cfg.states.items() if s.bef == "cd118"} == {"MO"}
    assert {s.bef for s in cfg.states.values()} == {"cd120", "cd118"}
    # the units of ALARM's map.rds (spec chapter 3)
    assert {p for p, s in cfg.states.items() if s.unit_kind == "tract"} == TRACT_STATES
    assert {p for p, s in cfg.states.items() if s.unit_kind == "county"} == {"IA", "WV"}
    vtd = {p for p, s in cfg.states.items() if s.unit_kind == "vtd"}
    assert len(vtd) == 38 and "NH" in vtd


def test_real_config_elections(cfg):
    assert cfg.states["WV"].elections == ("pre_20",)
    others = {s.elections for p, s in cfg.states.items() if p != "WV"}
    assert others == {("pre_16", "pre_20")}


def test_real_config_globals(cfg):
    assert cfg.status_checked >= date(2026, 10, 3)  # moves forward with every status re-check
    assert cfg.ensemble.name == "alarm_v15" and cfg.ensemble.version == 15


def test_real_config_has_the_block_file_of_the_2024_maps(cfg):
    # extensions design, chapter 2: the maps of the 2024 election, Census CD119 (2024-07-29)
    assert cfg.sources["cd119"] == ("https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/"
                                    "119-congressional-district-befs/cd119.zip")
