"""Load and validate pipeline/config.yaml, and derive the repository paths."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT: Path = Path(__file__).resolve().parents[2]

STATUS_VALUES = ("In effect", "Challenged", "Blocked", "At-large")
ENSEMBLE_NOTE_KEYS = (
    "vra_constraint", "vra_constraint_cvap", "core_preservation_prior_map", "core_preservation_2010",
    "competitiveness_rule", "vra_filter_with_votes", "vra_filter_bvap", "vra_filter_minority_majority",
    "vra_fixed_district", "alarm_rerun_unpublished", "alarm_method_update_pending",
)
STATE_NOTE_KEYS = ("adopted_after_2024_election", "composite_2020_only", "blocked_map")
COMPUTED_NOTE_KEYS = ("narrow_ensemble",)

_STATE_STATUS = ("In effect", "Challenged")
_EXTRA_MAP_STATUS = ("Blocked",)
_BEF = ("cd120", "cd118")
_UNIT_KINDS = ("vtd", "tract", "county")
_FILL_KEYS = ("reference_map", "consequence")
_RESERVED_MAP_IDS = ("enacted", "check_2022", "map_2024")
_SOURCE_KEYS = (
    "dataverse_api", "cd118", "cd119", "cd120", "pl94171", "census_vest",
    "tiger_gpkg", "tiger_mo_cd119", "cb_states", "medsl_president",
)
_TOP_KEYS = (
    "status_checked", "census_vest_commit", "ensemble", "sources", "states", "at_large",
)
_STATE_REQUIRED = (
    "name", "fips", "seats", "map_name", "status", "source_label", "source_url",
    "bef", "elections", "unit_kind",
)
_STATE_KEYS = _STATE_REQUIRED + ("extra_maps", "notes")
_EXTRA_MAP_KEYS = ("name", "status", "bef", "source_label", "source_url")
_ELECTION = re.compile(r"[a-z]{3}_\d{2}")
_POSTAL = re.compile(r"[A-Z]{2}")


class ConfigError(ValueError):
    """config.yaml misses a field or holds a value outside the allowed set."""


@dataclass(frozen=True)
class ExtraMap:
    id: str
    name: str
    status: str
    bef: str
    source_label: str
    source_url: str


@dataclass(frozen=True)
class StateConfig:
    postal: str
    name: str
    fips: str
    seats: int
    map_name: str
    status: str
    source_label: str
    source_url: str
    bef: str
    elections: tuple[str, ...]
    unit_kind: str
    extra_maps: tuple[ExtraMap, ...]
    notes: tuple[str, ...]


@dataclass(frozen=True)
class AtLargeState:
    postal: str
    name: str
    fips: str


@dataclass(frozen=True)
class EnsembleConfig:
    name: str
    doi: str
    version: int
    notes: dict[str, tuple[str, ...]]
    fill: dict[str, dict[str, str]]


@dataclass(frozen=True)
class Config:
    status_checked: date
    census_vest_commit: str
    ensemble: EnsembleConfig
    sources: dict[str, str]
    states: dict[str, StateConfig]
    at_large: dict[str, AtLargeState]


def data_dir() -> Path:
    """GERRY_DATA_DIR if set, else data/raw in the repository."""
    value = os.environ.get("GERRY_DATA_DIR", "").strip()
    if value:
        return Path(value).expanduser().resolve()
    return REPO_ROOT / "data" / "raw"


def interim_dir() -> Path:
    """data/interim in the repository. Callers create it when they write."""
    return REPO_ROOT / "data" / "interim"


def load_config(path: Path | None = None) -> Config:
    """Read config.yaml (default pipeline/config.yaml) and validate every field."""
    path = REPO_ROOT / "pipeline" / "config.yaml" if path is None else Path(path)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    _mapping(raw, "config.yaml")
    _only_keys(raw, _TOP_KEYS, "config.yaml", required=_TOP_KEYS)

    states_raw = _mapping(raw["states"], "states")
    states = {postal: _state(postal, value) for postal, value in states_raw.items()}
    at_large_raw = _mapping(raw["at_large"], "at_large")
    at_large = {postal: _at_large(postal, value) for postal, value in at_large_raw.items()}

    both = sorted(set(states) & set(at_large))
    if both:
        raise ConfigError(f"states and at_large both list {both}")
    fips = [s.fips for s in states.values()] + [s.fips for s in at_large.values()]
    dupes = sorted({f for f in fips if fips.count(f) > 1})
    if dupes:
        raise ConfigError(f"fips used more than once: {dupes}")

    return Config(
        status_checked=_date(raw["status_checked"], "status_checked"),
        census_vest_commit=_commit(raw["census_vest_commit"]),
        ensemble=_ensemble(raw["ensemble"], states),
        sources=_sources(raw["sources"]),
        states=states,
        at_large=at_large,
    )


# --- helpers ---------------------------------------------------------------

def _mapping(value: Any, where: str) -> dict:
    if not isinstance(value, dict):
        raise ConfigError(f"{where}: expected a mapping, got {type(value).__name__}")
    return value


def _only_keys(raw: dict, allowed: tuple[str, ...], where: str, required: tuple[str, ...]) -> None:
    unknown = sorted(str(k) for k in raw if k not in allowed)
    if unknown:
        raise ConfigError(f"{where}: unknown keys {unknown}")
    missing = [k for k in required if k not in raw]
    if missing:
        raise ConfigError(f"{where}: missing keys {missing}")


def _text(raw: dict, key: str, where: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{where}.{key}: expected non-empty text, got {value!r}")
    return value


def _choice(raw: dict, key: str, where: str, allowed: tuple[str, ...]) -> str:
    value = _text(raw, key, where)
    if value not in allowed:
        raise ConfigError(f"{where}.{key}: {value!r} is not one of {list(allowed)}")
    return value


def _url(raw: dict, key: str, where: str) -> str:
    value = _text(raw, key, where)
    if not value.startswith("https://"):
        raise ConfigError(f"{where}.{key}: expected an https URL, got {value!r}")
    return value


def _fips(raw: dict, where: str) -> str:
    value = raw.get("fips")
    if not isinstance(value, str) or not re.fullmatch(r"\d{2}", value):
        raise ConfigError(f"{where}.fips: expected two digits as quoted text, got {value!r}")
    return value


def _postal(postal: Any, where: str) -> str:
    if not isinstance(postal, str) or not _POSTAL.fullmatch(postal):
        raise ConfigError(f"{where}: {postal!r} is not a two-letter postal code")
    return postal


def _int(value: Any, where: str, minimum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ConfigError(f"{where}: expected an integer of at least {minimum}, got {value!r}")
    return value


def _keys(values: Any, allowed: tuple[str, ...], where: str) -> tuple[str, ...]:
    if values is None:
        return ()
    if not isinstance(values, list):
        raise ConfigError(f"{where}: expected a list, got {values!r}")
    unknown = [v for v in values if v not in allowed]
    if unknown:
        raise ConfigError(f"{where}: unknown note keys {unknown}")
    if len(set(values)) != len(values):
        raise ConfigError(f"{where}: a note key appears twice in {values}")
    return tuple(values)


def _date(value: Any, where: str) -> date:
    if isinstance(value, datetime) or not isinstance(value, date):
        raise ConfigError(f"{where}: expected a date like 2026-10-03, got {value!r}")
    return value


def _commit(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ConfigError(f"census_vest_commit: expected a 40-character commit hash, got {value!r}")
    return value


def _state(postal: Any, raw: Any) -> StateConfig:
    where = f"states.{_postal(postal, 'states')}"
    _mapping(raw, where)
    _only_keys(raw, _STATE_KEYS, where, required=_STATE_REQUIRED)
    elections = raw["elections"]
    if (not isinstance(elections, list) or not elections
            or any(not isinstance(e, str) or not _ELECTION.fullmatch(e) for e in elections)
            or len(set(elections)) != len(elections)):
        raise ConfigError(f"{where}.elections: expected a list like [pre_16, pre_20], got {elections!r}")
    extra_raw = raw.get("extra_maps") or {}
    _mapping(extra_raw, f"{where}.extra_maps")
    return StateConfig(
        postal=postal,
        name=_text(raw, "name", where),
        fips=_fips(raw, where),
        seats=_int(raw["seats"], f"{where}.seats", 2),
        map_name=_text(raw, "map_name", where),
        status=_choice(raw, "status", where, _STATE_STATUS),
        source_label=_text(raw, "source_label", where),
        source_url=_url(raw, "source_url", where),
        bef=_choice(raw, "bef", where, _BEF),
        elections=tuple(elections),
        unit_kind=_choice(raw, "unit_kind", where, _UNIT_KINDS),
        extra_maps=tuple(_extra_map(k, v, f"{where}.extra_maps") for k, v in extra_raw.items()),
        notes=_keys(raw.get("notes"), STATE_NOTE_KEYS, f"{where}.notes"),
    )


def _extra_map(map_id: Any, raw: Any, where: str) -> ExtraMap:
    if not isinstance(map_id, str) or not re.fullmatch(r"[a-z0-9_]+", map_id) or map_id in _RESERVED_MAP_IDS:
        raise ConfigError(f"{where}: {map_id!r} is not a valid map id")
    where = f"{where}.{map_id}"
    _mapping(raw, where)
    _only_keys(raw, _EXTRA_MAP_KEYS, where, required=_EXTRA_MAP_KEYS)
    return ExtraMap(
        id=map_id,
        name=_text(raw, "name", where),
        status=_choice(raw, "status", where, _EXTRA_MAP_STATUS),
        bef=_choice(raw, "bef", where, _BEF),
        source_label=_text(raw, "source_label", where),
        source_url=_url(raw, "source_url", where),
    )


def _at_large(postal: Any, raw: Any) -> AtLargeState:
    where = f"at_large.{_postal(postal, 'at_large')}"
    _mapping(raw, where)
    _only_keys(raw, ("name", "fips"), where, required=("name", "fips"))
    return AtLargeState(postal=postal, name=_text(raw, "name", where), fips=_fips(raw, where))


def _ensemble(raw: Any, states: dict[str, StateConfig]) -> EnsembleConfig:
    where = "ensemble"
    _mapping(raw, where)
    keys = ("name", "doi", "version", "notes", "fill")
    _only_keys(raw, keys, where, required=keys)
    doi = _text(raw, "doi", where)
    if not doi.startswith("doi:"):
        raise ConfigError(f"ensemble.doi: expected 'doi:...', got {doi!r}")

    notes: dict[str, tuple[str, ...]] = {}
    for postal, values in _mapping(raw["notes"] or {}, "ensemble.notes").items():
        if postal not in states:
            raise ConfigError(f"ensemble.notes: {postal!r} is not in states")
        notes[postal] = _keys(values, ENSEMBLE_NOTE_KEYS, f"ensemble.notes.{postal}")

    fill: dict[str, dict[str, str]] = {}
    for postal, values in _mapping(raw["fill"] or {}, "ensemble.fill").items():
        w = f"ensemble.fill.{postal}"
        _mapping(values, w)
        _only_keys(values, _FILL_KEYS, w, required=_FILL_KEYS)
        fill[postal] = {k: _text(values, k, w) for k in _FILL_KEYS}

    need_fill = {p for p, keys_ in notes.items() if "core_preservation_prior_map" in keys_}
    if need_fill != set(fill):
        raise ConfigError(
            "ensemble.fill must cover exactly the states with core_preservation_prior_map: "
            f"missing {sorted(need_fill - set(fill))}, extra {sorted(set(fill) - need_fill)}"
        )
    return EnsembleConfig(
        name=_text(raw, "name", where),
        doi=doi,
        version=_int(raw["version"], "ensemble.version", 1),
        notes=notes,
        fill=fill,
    )


def _sources(raw: Any) -> dict[str, str]:
    _mapping(raw, "sources")
    _only_keys(raw, _SOURCE_KEYS, "sources", required=_SOURCE_KEYS)
    return {key: _url(raw, key, "sources") for key in _SOURCE_KEYS}
