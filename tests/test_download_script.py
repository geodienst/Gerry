import importlib.util
import json
import sys
from pathlib import Path

from gerry.sources import Download, Manifest

SCRIPT = Path(__file__).resolve().parents[1] / "pipeline" / "01_download.py"


def load_script():
    """Import pipeline/01_download.py (its name starts with a digit, so no normal import)."""
    spec = importlib.util.spec_from_file_location("download_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def dl(key: str) -> Download:
    return Download(key, f"https://example.org/{key}", None, None)


PLAN = [dl("alarm/NV_cd_2020_stats.csv"), dl("alarm/WV_cd_2020_map.rds"), dl("census_vest/nv_2020_vtd.csv"),
        dl("census/cd120.zip"), dl("census/pl/nv2020.pl.zip"), dl("census/pl/wv2020.pl.zip"),
        dl("census/tiger/tl_2025_29_cd119.zip")]


def test_state_of_reads_the_postal_code_from_the_key():
    script = load_script()
    assert script.state_of("alarm/WV_cd_2020_map.rds") == "WV"
    assert script.state_of("census_vest/nv_2020_vtd.csv") == "NV"
    assert script.state_of("census/pl/nv2020.pl.zip") == "NV"
    assert script.state_of("census/tiger/tl_2025_29_cd119.zip") is None
    assert script.state_of("census/cd120.zip") is None
    # one file for all states: --only keeps it (Senate block, extensions design chapter 7)
    assert script.state_of("medsl/1976-2024-president.csv") is None


def test_select_without_only_keeps_everything():
    assert load_script().select(PLAN, []) == PLAN


def test_select_keeps_shared_files_and_the_named_states():
    keys = [d.key for d in load_script().select(PLAN, ["nv"])]
    assert keys == ["alarm/NV_cd_2020_stats.csv", "census_vest/nv_2020_vtd.csv", "census/cd120.zip",
                    "census/pl/nv2020.pl.zip", "census/tiger/tl_2025_29_cd119.zip"]


# ---- Task 1.12: manifest entries for files that left the plan ----

NEW_PLAN = [dl("alarm/NV_cd_2020_map.rds"), dl("census/cd120.zip"), dl("census/pl/wv2020.pl.zip")]
OLD_KEYS = ["census/cd120.zip", "census/pl/wv2020.pl.zip", "census_vest/nv_2020_vtd.csv"]


def offline_script(tmp_path, monkeypatch):
    """The script with a manifest in tmp_path and no network: a fixed plan, fetch writes a small file."""
    script = load_script()
    manifest = Manifest(tmp_path / "manifest.json")
    for key in OLD_KEYS:
        manifest.record(key, f"https://example.org/{key}", 1, "0" * 64)
    manifest.save()

    def fake_fetch(dl, root, manifest, session=None):
        path = Path(root) / dl.key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"x")
        manifest.record(dl.key, dl.url, 1, "1" * 64)
        return path

    monkeypatch.setenv("GERRY_DATA_DIR", str(tmp_path / "raw"))
    monkeypatch.setattr(script, "MANIFEST", tmp_path / "manifest.json")
    monkeypatch.setattr(script, "dataverse_files", lambda *args, **kwargs: {})
    monkeypatch.setattr(script, "plan_downloads", lambda cfg, dv_files: NEW_PLAN)
    monkeypatch.setattr(script, "fetch", fake_fetch)
    return script


def manifest_keys(tmp_path):
    return list(json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8")))


def test_download_removes_manifest_entries_that_left_the_plan(tmp_path, monkeypatch):
    script = offline_script(tmp_path, monkeypatch)
    # --only NV fetches only the NV and shared files, but the WV entry stays: it is still in the plan
    assert script.main(["--only", "NV"]) == 0
    assert manifest_keys(tmp_path) == ["alarm/NV_cd_2020_map.rds", "census/cd120.zip", "census/pl/wv2020.pl.zip"]


def test_dry_run_leaves_the_manifest_alone(tmp_path, monkeypatch, capsys):
    script = offline_script(tmp_path, monkeypatch)
    assert script.main(["--dry-run"]) == 0
    assert manifest_keys(tmp_path) == OLD_KEYS
    assert "census_vest/nv_2020_vtd.csv" in capsys.readouterr().out
