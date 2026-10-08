"""Note texts and the contents of site/data/results.json."""
from __future__ import annotations

import math
from collections.abc import Sequence

from gerry.checks import CheckError
from gerry.config import Config, ConfigError

NATIONAL_FIELDS = ("seats", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
                   "majority", "competitive", "redraw", "by_control", "by_body", "senate")
STATE_FIELDS = ("d_share", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
                "eg", "mm", "districts", "sorted", "competitive", "redraw")

# English note texts, identical to the notes table in chapter 5 of the spec.
# Change a text in both places; tests/test_export.py compares them.
NOTE_TEXTS: dict[str, str] = {
    "vra_constraint": (
        "ALARM's neutral maps for this state favor districts with a large minority share of voting-age "
        "adults, following the Voting Rights Act as courts applied it before Louisiana v. Callais "
        "(April 2026). The law can require such districts. In seat counts they can look like packing, "
        "which means putting many voters of one party into a few districts."
    ),
    "vra_constraint_cvap": (
        "ALARM's neutral maps for this state favor districts with a large Hispanic or Black share of "
        "adult citizens, following the Voting Rights Act as courts applied it before Louisiana v. Callais "
        "(April 2026). The law can require such districts. In seat counts they can look like packing, "
        "which means putting many voters of one party into a few districts."
    ),
    "core_preservation_prior_map": (
        "ALARM's neutral maps for this state keep the core of each district in {reference_map}. So they "
        "look more like that map than neutral maps drawn without this rule would. {consequence}"
    ),
    "core_preservation_2010": (
        "ALARM's neutral maps for this state keep the core of each district drawn after the 2010 census."
    ),
    "competitiveness_rule": (
        "This state's redistricting rules call for competitive districts, so ALARM's neutral maps for this "
        "state favor them. Measuring competitiveness requires party vote data."
    ),
    "vra_filter_with_votes": (
        "ALARM filtered the neutral maps for this state to follow the Voting Rights Act. It kept only maps "
        "with at least one district where more than 30% of voting-age adults are Black and Democrats win a "
        "majority in ALARM's vote data."
    ),
    "vra_filter_bvap": (
        "ALARM filtered the neutral maps for this state to follow the Voting Rights Act. It kept only maps "
        "with at least one district where more than 30% of voting-age adults are Black."
    ),
    "vra_filter_minority_majority": (
        "ALARM kept only neutral maps for this state with at least two districts where more than half of "
        "voting-age adults belong to a minority group."
    ),
    "vra_fixed_district": (
        "Every neutral map for this state has a district in Cuyahoga County, which includes Cleveland, "
        "where more than 40% of voting-age adults are Black. ALARM drew that district first and the rest "
        "of the state around it."
    ),
    "alarm_rerun_unpublished": (
        "ALARM has rerun the simulations for this state because the version 15 run did not meet its current "
        "convergence check. The new run is not yet in ALARM's dataset on Harvard Dataverse. We use version 15 "
        "of that dataset (February 2026)."
    ),
    "alarm_method_update_pending": (
        "ALARM is preparing new simulations for this state with an updated method. They are not yet "
        "published. We use version 15 of ALARM's dataset (February 2026)."
    ),
    "narrow_ensemble": (
        "At least 95% of the neutral maps for this state give the same number of Democratic seats, so the "
        "neutral band has little or no spread."
    ),
    "adopted_after_2024_election": (
        "This map was adopted after the 2024 election, so the people who drew it could use 2024 results. "
        "Our vote basis is the 2016 and 2020 presidential elections and does not include 2024."
    ),
    "composite_2020_only": (
        "ALARM's data for this state has 2020 presidential results only, by county. All three numbers here "
        "use 2020 alone, not 2016 and 2020 combined."
    ),
    "blocked_map": (
        "The legislature adopted a new map in 2025 (HB 1). Courts have blocked it until voters decide on it. "
        "It is on the November 3, 2026 ballot as Proposition A. The November 2026 election uses the 2022 map."
    ),
}


def resolve_notes(postal: str, cfg: Config, computed: Sequence[str]) -> list[dict]:
    """Notes for one state as [{"key", "text"}]: ensemble notes, then state notes, then computed notes."""
    keys = [*cfg.ensemble.notes.get(postal, ()), *cfg.states[postal].notes, *computed]
    fill = cfg.ensemble.fill.get(postal, {})
    notes = []
    for key in keys:
        if key not in NOTE_TEXTS:
            raise ConfigError(f"{postal}: unknown note key {key!r}")
        try:
            text = NOTE_TEXTS[key].format_map(fill)
        except KeyError as err:
            raise ConfigError(
                f"{postal}: note {key!r} needs {err.args[0]!r} under ensemble.fill.{postal} in config.yaml"
            ) from None
        notes.append({"key": key, "text": text})
    return notes


def _votes(value: float) -> int:
    """Round a vote count half up to a whole number."""
    return int(math.floor(value + 0.5))


def _districts(rows: list[dict], fips: str, seats: int, postal: str) -> list[dict]:
    expected = [f"{fips}{n:02d}" for n in range(1, seats + 1)]
    ids = sorted(row["id"] for row in rows)
    if ids != expected:
        raise CheckError("export_districts", postal, f"district ids {ids}, expected {expected}")
    return [{"id": row["id"], "share": row["share"], "d": _votes(row["d"]), "r": _votes(row["r"])}
            for row in sorted(rows, key=lambda row: row["id"])]


def _blocked_map(postal: str, cfg: Config, m: dict) -> dict | None:
    st = cfg.states[postal]
    others = [x.id for x in st.extra_maps if x.status != "Blocked"]
    if others:
        raise CheckError("export_blocked_map", postal, f"extra maps {others} are not Blocked; results.json "
                         "only has a field for a blocked map")
    blocked = [x for x in st.extra_maps if x.status == "Blocked"]
    if len(blocked) > 1 or bool(blocked) != ("blocked_map" in m):
        raise CheckError("export_blocked_map", postal, f"config.yaml has {len(blocked)} blocked map(s), "
                         f"metrics.json {'has' if 'blocked_map' in m else 'has no'} blocked_map")
    if not blocked:
        return None
    x, b = blocked[0], m["blocked_map"]
    return {
        "name": x.name,
        "status": x.status,
        "source": {"label": x.source_label, "url": x.source_url},
        "enacted": b["enacted"],
        "districts": _districts(b["districts"], st.fips, st.seats, postal),
        "position": b["position"],
    }


def _state_entry(postal: str, cfg: Config, m: dict) -> dict:
    st = cfg.states[postal]
    entry = {
        "name": st.name,
        "fips": st.fips,
        "seats": st.seats,
        "map_name": st.map_name,
        "status": st.status,
        "source": {"label": st.source_label, "url": st.source_url},
        # extensions design, chapter 4: who adopted the map, under whose control
        "adopted": {"by": st.adopted_by, "control": st.control, "note": st.adopted_note},
        "notes": resolve_notes(postal, cfg, m["computed_notes"]),
    }
    entry.update({key: m[key] for key in STATE_FIELDS})
    entry["districts"] = _districts(m["districts"], st.fips, st.seats, postal)
    blocked = _blocked_map(postal, cfg, m)
    if blocked is not None:
        entry["blocked_map"] = blocked
    return entry


def build_results(metrics: dict, cfg: Config, generated: str) -> dict:
    """The contents of site/data/results.json (chapter 7 of the spec)."""
    if set(metrics["states"]) != set(cfg.states):
        raise CheckError("export_states", "US", f"metrics.json has {sorted(metrics['states'])}, "
                         f"config.yaml has {sorted(cfg.states)}")
    national = {key: metrics["national"][key] for key in NATIONAL_FIELDS}
    seats = sum(st.seats for st in cfg.states.values())
    if national["seats"] != seats:
        raise CheckError("export_seats", "US", f"metrics.json has {national['seats']} seats, "
                         f"config.yaml {seats}")
    national["single_seat"] = [{"postal": a.postal, "fips": a.fips, "name": a.name}
                               for a in sorted(cfg.at_large.values(), key=lambda a: a.postal)]
    vote_basis = sorted({e for st in cfg.states.values() for e in st.elections})
    return {
        "meta": {
            "generated": generated,
            "ensemble": {"name": cfg.ensemble.name, "doi": cfg.ensemble.doi, "version": cfg.ensemble.version},
            "census_vest_commit": cfg.census_vest_commit,
            "vote_basis": vote_basis,
            "status_checked": cfg.status_checked.isoformat(),
        },
        "national": national,
        "states": {postal: _state_entry(postal, cfg, metrics["states"][postal]) for postal in sorted(cfg.states)},
    }
