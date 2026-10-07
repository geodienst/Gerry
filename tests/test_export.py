import dataclasses
import json
from datetime import date

import pytest

from gerry.checks import CheckError
from gerry.config import (
    COMPUTED_NOTE_KEYS, ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, AtLargeState, Config,
    ConfigError, EnsembleConfig, ExtraMap, StateConfig, load_config,
)
from gerry.export import NOTE_TEXTS, build_results, resolve_notes

SPEC = REPO_ROOT / "docs" / "superpowers" / "specs" / "2026-10-05-gerrymandering-map-design.md"

HB1 = ExtraMap(id="mo_hb1", name="HB 1 of 2025", status="Blocked", bef="cd120",
               source_label="Redistricting Data Hub (Missouri House)",
               source_url="https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/")


def state(postal, name, fips, seats, notes=(), extra_maps=(), adopted_by="Legislature", control="Republican",
          adopted_note=None):
    return StateConfig(
        postal=postal, name=name, fips=fips, seats=seats, map_name=f"{name} map", status="In effect",
        source_label=f"{name} source", source_url=f"https://example.org/{postal.lower()}", bef="cd120",
        elections=("pre_16", "pre_20"), unit_kind="vtd", extra_maps=tuple(extra_maps), notes=tuple(notes),
        adopted_by=adopted_by, control=control, adopted_note=adopted_note,
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


def test_resolve_notes_uses_the_fill_of_its_own_state():
    cfg = toy_config(
        [state("NM", "New Mexico", "35", 3), state("LA", "Louisiana", "22", 6)],
        ens_notes={"NM": ("core_preservation_prior_map",), "LA": ("core_preservation_prior_map",)},
        fill={"NM": {"reference_map": "the 2021 map", "consequence": "NM consequence."},
              "LA": {"reference_map": "the 2022 map", "consequence": "LA consequence."}},
    )
    text = resolve_notes("LA", cfg, [])[0]["text"]
    assert "in the 2022 map." in text and text.endswith("LA consequence.")
    assert "2021" not in text and "NM consequence" not in text


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


def test_repo_config_notes_for_texas_michigan_and_ohio_resolve_in_order():
    cfg = load_config()
    if cfg.ensemble.name != "alarm_v15":
        pytest.skip("the note lists in the spec describe alarm_v15")
    # the ensemble notes in the order of config.yaml, then the notes of the state itself
    expected = {
        "TX": ["vra_constraint_cvap", "alarm_method_update_pending", "adopted_after_2024_election"],
        "MI": ["vra_constraint", "vra_filter_minority_majority", "alarm_rerun_unpublished"],
        "OH": ["vra_constraint", "vra_fixed_district", "alarm_rerun_unpublished", "adopted_after_2024_election"],
    }
    for postal, keys in expected.items():
        notes = resolve_notes(postal, cfg, [])
        assert [n["key"] for n in notes] == keys, postal
        assert [n["text"] for n in notes] == [NOTE_TEXTS[key] for key in keys], postal


# --- build_results -------------------------------------------------------------------------------

def toy_state_metrics(fips, computed_notes=()):
    """Numeric fields for a 2-seat state, shaped like data/interim/metrics.json."""
    return {
        "d_share": 0.55,
        "proportional": 1,
        "enacted": 1,
        "neutral": {"median": 1, "p5": 1, "p95": 2, "dist": [0, 4000, 1000]},
        "position": {"fewer": 0.0, "equal": 0.8, "more": 0.2, "midrank": 0.4},
        "effects": {"geographic": 0, "drawing": 0},
        "outside_band": False,
        "eg": {"value": 0.031, "median": 0.02, "p5": -0.05, "p95": 0.09},
        "mm": None,
        "districts": [
            {"id": f"{fips}02", "share": 0.4, "d": 1000.5, "r": 1500.4999},
            {"id": f"{fips}01", "share": 0.7, "d": 2100.0, "r": 900.25},
        ],
        "sorted": {"enacted": [0.4, 0.7], "p5": [0.38, 0.6], "p50": [0.45, 0.65], "p95": [0.5, 0.71]},
        "computed_notes": list(computed_notes),
        # extensions (Task 5.6): competitive districts and the 2024 map
        "competitive": {"enacted": 0, "median": 1, "p5": 0, "p95": 1, "neutral_dist": [2000, 3000, 0]},
        "redraw": {"seats_2024": 2, "change": -1, "map_changed": True},
    }


def toy_metrics():
    mo = toy_state_metrics("29")
    mo["blocked_map"] = {
        "enacted": 0,
        "districts": [{"id": "2901", "share": 0.45, "d": 10.0, "r": 12.2},
                      {"id": "2902", "share": 0.48, "d": 20.0, "r": 21.7}],
        "position": {"fewer": 0.1, "equal": 0.3, "more": 0.6, "midrank": 0.25},
    }
    return {
        "national": {
            "seats": 4, "proportional": 2, "enacted": 2,
            "neutral": {"median": 2, "p5": 2, "p95": 3, "dist": [0.0, 0.0, 0.7, 0.3, 0.0]},
            "position": {"fewer": 0.0, "equal": 0.7, "more": 0.3, "midrank": 0.35},
            "effects": {"geographic": 0, "drawing": 0},
            "outside_band": False,
            # extensions (Tasks 5.7 and 5.12), passed through unchanged
            "majority": {"seats_needed": 3, "base_share": 0.55,
                         "enacted": {"share": 0.56, "seats_at_base": 2},
                         "neutral": {"share": 0.53, "low": 0.5, "high": 0.57, "probability_at_base": 0.8},
                         "proportional": {"share": 0.52}},
            "competitive": {"enacted": 0, "median": 2, "p5": 1, "p95": 2, "neutral_dist": [0.16, 0.48, 0.36, 0.0, 0.0]},
            "redraw": {"seats_2024": 4, "change": -2},
            "by_control": {"Republican": {"states": 2, "seats": 4, "drawing": 0},
                           "Democratic": {"states": 0, "seats": 0, "drawing": 0},
                           "Bipartisan": {"states": 0, "seats": 0, "drawing": 0},
                           "Nonpartisan": {"states": 0, "seats": 0, "drawing": 0}},
            "by_body": {"Legislature": {"states": 2, "seats": 4, "drawing": 0},
                        "Commission": {"states": 0, "seats": 0, "drawing": 0},
                        "Court": {"states": 0, "seats": 0, "drawing": 0}},
        },
        "states": {"HI": toy_state_metrics("15", ["narrow_ensemble"]), "MO": mo},
        "checks": {"anything": "not exported"},
    }


def toy_results_config():
    return toy_config(
        [state("HI", "Hawaii", "15", 2),
         state("MO", "Missouri", "29", 2, notes=["blocked_map"], extra_maps=[HB1])],
        ens_notes={"MO": ("vra_constraint",)},
    )


def test_build_results_meta():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    assert results["meta"] == {
        "generated": "2026-10-06",
        "ensemble": {"name": "alarm_v15", "doi": "doi:10.7910/DVN/SLCD3E", "version": 15},
        "census_vest_commit": "243c8a8134ecf8151777a9388c48323e274767e2",
        "vote_basis": ["pre_16", "pre_20"],
        "status_checked": "2026-10-03",
    }


def test_build_results_national_adds_single_seat_states_sorted_by_postal():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    national = results["national"]
    assert national["seats"] == 4
    assert national["neutral"]["dist"] == [0.0, 0.0, 0.7, 0.3, 0.0]
    assert national["single_seat"] == [{"postal": "AK", "fips": "02", "name": "Alaska"},
                                       {"postal": "DE", "fips": "10", "name": "Delaware"}]
    assert list(national) == ["seats", "proportional", "enacted", "neutral", "position", "effects",
                              "outside_band", "majority", "competitive", "redraw", "by_control", "by_body",
                              "single_seat"]
    # the extensions pass through unchanged
    for key in ("majority", "competitive", "redraw", "by_control", "by_body"):
        assert national[key] == toy_metrics()["national"][key], key


def test_build_results_state_entry():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    m = toy_state_metrics("15")
    assert results["states"]["HI"] == {
        "name": "Hawaii", "fips": "15", "seats": 2, "map_name": "Hawaii map", "status": "In effect",
        "source": {"label": "Hawaii source", "url": "https://example.org/hi"},
        # from config.yaml (Task 5.10): the toy state's defaults
        "adopted": {"by": "Legislature", "control": "Republican", "note": None},
        "notes": [{"key": "narrow_ensemble", "text": NOTE_TEXTS["narrow_ensemble"]}],
        "d_share": 0.55, "proportional": 1, "enacted": 1,
        "neutral": m["neutral"], "position": m["position"], "effects": m["effects"],
        "outside_band": False, "eg": m["eg"], "mm": None,
        # sorted by id, votes rounded half up: 1000.5 -> 1001, 1500.4999 -> 1500, 900.25 -> 900
        "districts": [{"id": "1501", "share": 0.7, "d": 2100, "r": 900},
                      {"id": "1502", "share": 0.4, "d": 1001, "r": 1500}],
        "sorted": m["sorted"],
        "competitive": m["competitive"], "redraw": m["redraw"],
    }
    assert "blocked_map" not in results["states"]["HI"]


def test_build_results_blocked_map_for_missouri():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    mo = results["states"]["MO"]
    assert [n["key"] for n in mo["notes"]] == ["vra_constraint", "blocked_map"]
    assert mo["blocked_map"] == {
        "name": "HB 1 of 2025", "status": "Blocked",
        "source": {"label": "Redistricting Data Hub (Missouri House)",
                   "url": "https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/"},
        "enacted": 0,
        "districts": [{"id": "2901", "share": 0.45, "d": 10, "r": 12},
                      {"id": "2902", "share": 0.48, "d": 20, "r": 22}],
        "position": {"fewer": 0.1, "equal": 0.3, "more": 0.6, "midrank": 0.25},
    }


def test_build_results_is_valid_json_without_nan():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    text = json.dumps(results, allow_nan=False)
    assert '"mm": null' in text


def test_build_results_stops_when_states_differ():
    metrics = toy_metrics()
    del metrics["states"]["HI"]
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.check == "export_states"


def test_build_results_stops_on_wrong_district_ids():
    metrics = toy_metrics()
    metrics["states"]["HI"]["districts"][0]["id"] = "1503"
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_districts", "HI")


def test_build_results_stops_when_national_seats_differ_from_config():
    metrics = toy_metrics()
    metrics["national"]["seats"] = 5
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.check == "export_seats"


def test_build_results_stops_when_blocked_map_is_missing():
    metrics = toy_metrics()
    del metrics["states"]["MO"]["blocked_map"]
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_blocked_map", "MO")


# Ordering, vote basis, status and guards

def test_states_sorted_by_postal_even_when_config_lists_them_otherwise():
    cfg = toy_config(
        [state("MO", "Missouri", "29", 2, notes=["blocked_map"], extra_maps=[HB1]), state("HI", "Hawaii", "15", 2)],
        ens_notes={"MO": ("vra_constraint",)},
    )
    results = build_results(toy_metrics(), cfg, "2026-10-06")
    assert list(results["states"]) == ["HI", "MO"]


@pytest.mark.parametrize("only_2020", ["HI", "MO"])
def test_vote_basis_is_the_union_over_states(only_2020):
    cfg = toy_results_config()
    narrowed = dataclasses.replace(cfg.states[only_2020], elections=("pre_20",))
    cfg = dataclasses.replace(cfg, states={**cfg.states, only_2020: narrowed})
    results = build_results(toy_metrics(), cfg, "2026-10-06")
    assert results["meta"]["vote_basis"] == ["pre_16", "pre_20"]


def test_state_status_is_passed_through():
    cfg = toy_results_config()
    challenged = dataclasses.replace(cfg.states["HI"], status="Challenged")
    cfg = dataclasses.replace(cfg, states={**cfg.states, "HI": challenged})
    results = build_results(toy_metrics(), cfg, "2026-10-06")
    assert results["states"]["HI"]["status"] == "Challenged"


def test_stops_when_metrics_has_a_blocked_map_the_config_lacks():
    metrics = toy_metrics()
    metrics["states"]["HI"]["blocked_map"] = metrics["states"]["MO"]["blocked_map"]
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_blocked_map", "HI")


def test_stops_on_two_blocked_maps_in_the_config():
    cfg = toy_results_config()
    two = dataclasses.replace(cfg.states["MO"], extra_maps=(HB1, dataclasses.replace(HB1, id="mo_hb2")))
    cfg = dataclasses.replace(cfg, states={**cfg.states, "MO": two})
    with pytest.raises(CheckError) as err:
        build_results(toy_metrics(), cfg, "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_blocked_map", "MO")


def test_stops_on_an_extra_map_that_is_not_blocked():
    cfg = toy_results_config()
    odd = dataclasses.replace(cfg.states["MO"], extra_maps=(HB1, dataclasses.replace(HB1, id="mo_x", status="Challenged")))
    cfg = dataclasses.replace(cfg, states={**cfg.states, "MO": odd})
    with pytest.raises(CheckError) as err:
        build_results(toy_metrics(), cfg, "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_blocked_map", "MO")


def test_stops_when_metrics_has_a_state_the_config_lacks():
    metrics = toy_metrics()
    metrics["states"]["TX"] = toy_state_metrics("48")
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.check == "export_states"


@pytest.mark.parametrize("wrong", [3, 5])
def test_stops_when_national_seats_differ_in_either_direction(wrong):
    metrics = toy_metrics()
    metrics["national"]["seats"] = wrong
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.check == "export_seats"


def test_national_and_state_checks_use_state_us():
    metrics = toy_metrics()
    metrics["national"]["seats"] = 5
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.state == "US"
    metrics = toy_metrics()
    del metrics["states"]["HI"]
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.state == "US"


def test_adopted_comes_from_the_config_with_its_note():
    cfg = toy_results_config()
    hawaii = dataclasses.replace(cfg.states["HI"], adopted_by="Commission", control="Bipartisan",
                                 adopted_note="Made-up note.")
    cfg = dataclasses.replace(cfg, states={**cfg.states, "HI": hawaii})
    results = build_results(toy_metrics(), cfg, "2026-10-06")
    assert results["states"]["HI"]["adopted"] == {"by": "Commission", "control": "Bipartisan", "note": "Made-up note."}
    assert results["states"]["MO"]["adopted"] == {"by": "Legislature", "control": "Republican", "note": None}


def test_blocked_map_district_ids_are_checked_too():
    metrics = toy_metrics()
    metrics["states"]["MO"]["blocked_map"]["districts"][1]["id"] = "2903"
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_districts", "MO")
