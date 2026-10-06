import importlib.util
import sys
from pathlib import Path

from gerry.sources import Download

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


def test_select_without_only_keeps_everything():
    assert load_script().select(PLAN, []) == PLAN


def test_select_keeps_shared_files_and_the_named_states():
    keys = [d.key for d in load_script().select(PLAN, ["nv"])]
    assert keys == ["alarm/NV_cd_2020_stats.csv", "census_vest/nv_2020_vtd.csv", "census/cd120.zip",
                    "census/pl/nv2020.pl.zip", "census/tiger/tl_2025_29_cd119.zip"]
