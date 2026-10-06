"""Note texts and the contents of site/data/results.json."""
from __future__ import annotations

from collections.abc import Sequence

from gerry.config import Config, ConfigError

# English note texts, identical to the notes table in chapter 5 of the spec.
# Change a text in both places; tests/test_export.py compares them.
NOTE_TEXTS: dict[str, str] = {
    "vra_constraint": (
        "ALARM's neutral maps for this state aim for about as many districts with a large minority share "
        "of voting-age adults as the 2022 map had. This follows the Voting Rights Act as courts applied it "
        "before Louisiana v. Callais (April 2026). The law can require such districts. In seat counts they "
        "can look like packing, which means putting many voters of one party into a few districts."
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
        "neutral baseline has little or no spread."
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
