from datetime import date

import pytest

from gerry.config import (
    COMPUTED_NOTE_KEYS, ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, AtLargeState, Config,
    ConfigError, EnsembleConfig, ExtraMap, StateConfig, load_config,
)
from gerry.export import NOTE_TEXTS, resolve_notes

SPEC = REPO_ROOT / "docs" / "superpowers" / "specs" / "2026-10-05-gerrymandering-map-design.md"

HB1 = ExtraMap(id="mo_hb1", name="HB 1 of 2025", status="Blocked", bef="cd120",
               source_label="Redistricting Data Hub (Missouri House)",
               source_url="https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/")


def state(postal, name, fips, seats, notes=(), extra_maps=()):
    return StateConfig(
        postal=postal, name=name, fips=fips, seats=seats, map_name=f"{name} map", status="In effect",
        source_label=f"{name} source", source_url=f"https://example.org/{postal.lower()}", bef="cd120",
        elections=("pre_16", "pre_20"), unit_kind="vtd", extra_maps=tuple(extra_maps), notes=tuple(notes),
    )


def toy_config(states, ens_notes=None, fill=None):
    """A small hand-made Config. Seat counts are made small on purpose."""
    return Config(
        status_checked=date(2026, 10, 3),
        census_vest_commit="243c8a8134ecf8151777a9388c48323e274767e2",
        ensemble=EnsembleConfig(name="alarm_v15", doi="doi:10.7910/DVN/SLCD3E", version=15,
                                notes=ens_notes or {}, fill=fill or {}),
        sources={},
        states={s.postal: s for s in states},
        at_large={"DE": AtLargeState(postal="DE", name="Delaware", fips="10"),
                  "AK": AtLargeState(postal="AK", name="Alaska", fips="02")},
    )


def table_after(marker):
    """Rows (header and separator dropped) of the first Markdown table after the line starting with marker."""
    lines = SPEC.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith(marker))
    rows, in_table = [], False
    for line in lines[start + 1:]:
        if line.startswith("|"):
            in_table = True
            rows.append([cell.strip() for cell in line.strip().strip("|").split("|")])
        elif in_table:
            break
    return rows[2:]


def test_note_texts_cover_every_note_key():
    assert set(NOTE_TEXTS) == set(ENSEMBLE_NOTE_KEYS + STATE_NOTE_KEYS + COMPUTED_NOTE_KEYS)


def test_note_texts_match_the_spec_table():
    spec = {row[0].strip("`"): row[3] for row in table_after("### Noten")}
    assert NOTE_TEXTS == spec


def test_note_texts_have_no_dashes_used_as_punctuation():
    for key, text in NOTE_TEXTS.items():
        assert "\u2014" not in text and "\u2013" not in text, key


def test_resolve_notes_orders_ensemble_then_state_then_computed():
    cfg = toy_config([state("MO", "Missouri", "29", 2, notes=["blocked_map"], extra_maps=[HB1])],
                     ens_notes={"MO": ("vra_constraint", "vra_filter_bvap")})
    notes = resolve_notes("MO", cfg, ["narrow_ensemble"])
    assert [n["key"] for n in notes] == ["vra_constraint", "vra_filter_bvap", "blocked_map", "narrow_ensemble"]
    assert notes[2]["text"] == NOTE_TEXTS["blocked_map"]


def test_resolve_notes_fills_reference_map_and_consequence():
    cfg = toy_config([state("NM", "New Mexico", "35", 3)],
                     ens_notes={"NM": ("core_preservation_prior_map",)},
                     fill={"NM": {"reference_map": "the 2021 map",
                                  "consequence": "The current map is that 2021 map."}})
    notes = resolve_notes("NM", cfg, [])
    assert notes == [{
        "key": "core_preservation_prior_map",
        "text": "ALARM's neutral maps for this state keep the core of each district in the 2021 map. "
                "So they look more like that map than neutral maps drawn without this rule would. "
                "The current map is that 2021 map.",
    }]


def test_resolve_notes_without_notes_is_empty():
    cfg = toy_config([state("HI", "Hawaii", "15", 2)])
    assert resolve_notes("HI", cfg, []) == []


def test_resolve_notes_stops_on_missing_fill_value():
    cfg = toy_config([state("NM", "New Mexico", "35", 3)],
                     ens_notes={"NM": ("core_preservation_prior_map",)},
                     fill={"NM": {"reference_map": "the 2021 map"}})
    with pytest.raises(ConfigError, match="NM.*consequence"):
        resolve_notes("NM", cfg, [])


def test_resolve_notes_stops_on_unknown_key():
    cfg = toy_config([state("HI", "Hawaii", "15", 2)])
    with pytest.raises(ConfigError, match="HI.*no_such_note"):
        resolve_notes("HI", cfg, ["no_such_note"])


def test_repo_config_note_lists_match_the_spec():
    cfg = load_config()
    if cfg.ensemble.name != "alarm_v15":
        pytest.skip("the note lists in the spec describe alarm_v15")
    for key, _, states, _ in table_after("### Noten"):
        key = key.strip("`")
        if key in COMPUTED_NOTE_KEYS:
            continue
        if key in ENSEMBLE_NOTE_KEYS:
            actual = {st for st, keys in cfg.ensemble.notes.items() if key in keys}
        else:
            actual = {st for st, s in cfg.states.items() if key in s.notes}
        assert actual == set(states.split(", ")), key
    fill = {row[0]: {"reference_map": row[1], "consequence": row[2]} for row in table_after("Invulwaarden voor")}
    assert cfg.ensemble.fill == fill
