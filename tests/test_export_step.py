"""Tests for pipeline/04_export.py with every slow step replaced by a stand-in. They pin the order of the
checks, that nothing reaches site/data/ before all of them have passed, and the LF line ends of results.json."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from gerry.checks import CheckError

_PATH = Path(__file__).resolve().parents[1] / "pipeline" / "04_export.py"
_SPEC = importlib.util.spec_from_file_location("export_step", _PATH)
step = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(step)

CHECKS = ["check_sources_md", "build_results", "load_districts", "check_all_geometry", "build_topojson",
          "check_map_ids"]


def national(seats=429):
    return {"seats": seats, "single_seat": [{"postal": p} for p in "ABCDEF"]}


class FakeFrame:
    """Stands in for a GeoDataFrame: to_file writes a tiny file."""

    def to_file(self, path, **kwargs):
        Path(path).write_text("{}", encoding="utf-8")


def stub_steps(tmp_path, monkeypatch, *, results=None, map_text="{}", fail=None):
    """Replace the steps of main() by stand-ins that record their name; the one named in `fail` raises
    CheckError. Returns the recorded calls and the site/data folder (not created yet)."""
    calls = []
    site = tmp_path / "site" / "data"
    interim = tmp_path / "interim"
    interim.mkdir()
    (interim / "metrics.json").write_text("{}", encoding="utf-8")
    if results is None:
        results = {"national": national(), "states": {"XX": {}}}

    def stand_in(name, result=None):
        def fn(*args, **kwargs):
            calls.append(name)
            if fail == name:
                raise CheckError(name, "US", "forced")
            return result
        return fn

    record_topojson = stand_in("build_topojson")

    def fake_topojson(districts_path, outline_path, out_path, pct):
        record_topojson()
        Path(out_path).write_text(map_text, encoding="utf-8")
        return Path(out_path)

    monkeypatch.setattr(step, "SITE_DATA", site)
    monkeypatch.setattr(step, "data_dir", lambda: tmp_path / "raw")
    monkeypatch.setattr(step, "interim_dir", lambda: interim)
    monkeypatch.setattr(step, "load_config", stand_in("load_config", SimpleNamespace()))
    monkeypatch.setattr(step, "check_sources_md", stand_in("check_sources_md"))
    monkeypatch.setattr(step, "build_results", stand_in("build_results", results))
    monkeypatch.setattr(step, "load_districts", stand_in("load_districts", FakeFrame()))
    monkeypatch.setattr(step, "check_all_geometry", stand_in("check_all_geometry"))
    monkeypatch.setattr(step, "national_outline", stand_in("national_outline", FakeFrame()))
    monkeypatch.setattr(step, "build_topojson", fake_topojson)
    monkeypatch.setattr(step, "check_map_ids", stand_in("check_map_ids"))
    return calls, site


def test_the_checks_run_in_order_and_both_files_are_written(tmp_path, monkeypatch):
    calls, site = stub_steps(tmp_path, monkeypatch)
    step.main()
    assert [c for c in calls if c in CHECKS] == CHECKS
    assert (site / "map.topojson").exists() and (site / "results.json").exists()


@pytest.mark.parametrize("failing", CHECKS)
def test_nothing_is_written_to_site_data_when_a_check_fails(tmp_path, monkeypatch, failing):
    calls, site = stub_steps(tmp_path, monkeypatch, fail=failing)
    with pytest.raises(CheckError):
        step.main()
    assert not site.exists()


def test_nothing_is_written_when_the_seat_total_is_not_435(tmp_path, monkeypatch):
    results = {"national": national(seats=428), "states": {}}
    calls, site = stub_steps(tmp_path, monkeypatch, results=results)
    with pytest.raises(CheckError) as err:
        step.main()
    assert err.value.check == "export_seats"
    assert "load_districts" not in calls          # stops before the slow geometry work
    assert not site.exists()


def test_nothing_is_written_when_the_map_is_over_the_size_limit(tmp_path, monkeypatch):
    calls, site = stub_steps(tmp_path, monkeypatch, map_text=json.dumps("x" * 48))   # 50 bytes
    monkeypatch.setattr(step, "MAX_MAP_BYTES", 50)      # size >= limit stops
    with pytest.raises(SystemExit) as err:
        step.main()
    assert "SIMPLIFY_PCT" in str(err.value)
    assert "check_map_ids" not in calls                 # the size check comes before check_map_ids
    assert not site.exists()


def test_a_map_exactly_one_byte_under_the_limit_is_written(tmp_path, monkeypatch):
    calls, site = stub_steps(tmp_path, monkeypatch, map_text=json.dumps("x" * 47))   # valid JSON, 49 bytes
    monkeypatch.setattr(step, "MAX_MAP_BYTES", 50)
    step.main()
    assert (site / "map.topojson").stat().st_size == 49


def test_nothing_is_written_when_results_cannot_be_serialised(tmp_path, monkeypatch):
    results = {"national": national(), "states": {"XX": {"d_share": float("nan")}}}
    calls, site = stub_steps(tmp_path, monkeypatch, results=results)
    with pytest.raises(ValueError):
        step.main()
    assert not site.exists()


def test_results_json_is_written_with_lf_newlines(tmp_path, monkeypatch):
    calls, site = stub_steps(tmp_path, monkeypatch)
    step.main()
    raw = (site / "results.json").read_bytes()
    assert b"\r" not in raw
    assert raw.endswith(b"\n") and not raw.endswith(b"\n\n")
    assert json.loads(raw)["national"]["seats"] == 429


def test_map_topojson_is_copied_byte_for_byte(tmp_path, monkeypatch):
    calls, site = stub_steps(tmp_path, monkeypatch, map_text='{"type":"Topology"}')
    step.main()
    assert (site / "map.topojson").read_bytes() == b'{"type":"Topology"}'
