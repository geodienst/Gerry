"""Step 4: write site/public/data/results.json and site/public/data/map.topojson.

Reads data/interim/metrics.json, pipeline/config.yaml and the TIGER geometry. Checks every multi-seat
map against its block file before anything is written to site/public/data/.
"""
from __future__ import annotations

import json
import shutil
import time
from datetime import date
from pathlib import Path

import geopandas as gpd

from gerry.blocks import read_bef, read_pl_blocks
from gerry.checks import CheckError, check_geometry, check_map_ids, check_sources_md
from gerry.config import REPO_ROOT, Config, data_dir, interim_dir, load_config
from gerry.export import build_results
from gerry.geometry import build_topojson, load_districts, national_outline

# Share of removable vertices mapshaper keeps. 3 gave 683,120 bytes on 2026-10-05.
SIMPLIFY_PCT = 3
MAX_MAP_BYTES = 1_000_000
HOUSE_SEATS = 435
SITE_DATA = REPO_ROOT / "site" / "public" / "data"


def check_all_geometry(cfg: Config, districts: gpd.GeoDataFrame, root: Path) -> None:
    """check_geometry for every multi-seat state, against the block file the pipeline uses."""
    for postal, st in sorted(cfg.states.items()):
        start = time.perf_counter()
        blocks = read_pl_blocks(root / "census" / "pl" / f"{postal.lower()}2020.pl.zip", postal.lower())
        district_of = read_bef(root / "census" / f"{st.bef}.zip", st.bef, st.fips, postal)
        share = check_geometry(districts, blocks, district_of, postal)
        print(f"  {postal} ({st.bef.upper()}): {share:.4%} of block points in their district, "
              f"{time.perf_counter() - start:.0f} s")


def main() -> None:
    cfg = load_config()
    root = data_dir()
    tiger = root / "census" / "tiger"
    check_sources_md(cfg, REPO_ROOT / "data" / "sources.md")

    metrics = json.loads((interim_dir() / "metrics.json").read_text(encoding="utf-8"))
    results = build_results(metrics, cfg, date.today().isoformat())
    national = results["national"]
    total = national["seats"] + len(national["single_seat"])
    if total != HOUSE_SEATS:
        raise CheckError("export_seats", "US", f"{national['seats']} seats plus {len(national['single_seat'])} "
                         f"single-seat states is {total}, expected {HOUSE_SEATS}")
    # Serialise now: a NaN (allow_nan=False) stops the export here, before the slow work and before
    # anything is written to site/public/data/.
    text = json.dumps(results, ensure_ascii=False, indent=1, allow_nan=False) + "\n"

    print("Loading district geometry")
    districts = load_districts(tiger / "tlgpkg_2026_us_legislative.gpkg.zip", tiger / "tl_2025_29_cd119.zip", tiger)
    print("Checking the geometry against the block files")
    check_all_geometry(cfg, districts, root)

    work = interim_dir()
    work.mkdir(parents=True, exist_ok=True)
    districts.to_file(work / "districts.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    national_outline(tiger / "cb_2025_us_state_500k.zip").to_file(
        work / "outline.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    print(f"Running mapshaper, simplify {SIMPLIFY_PCT}%")
    map_tmp = build_topojson(work / "districts.geojson", work / "outline.geojson", work / "map.topojson",
                             SIMPLIFY_PCT)
    size = map_tmp.stat().st_size
    if size >= MAX_MAP_BYTES:
        raise SystemExit(f"map.topojson is {size:,} bytes, limit {MAX_MAP_BYTES:,}. "
                         f"Lower SIMPLIFY_PCT ({SIMPLIFY_PCT}) in pipeline/04_export.py.")
    check_map_ids(json.loads(map_tmp.read_text(encoding="utf-8")), results)

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(map_tmp, SITE_DATA / "map.topojson")
    # tracked in git: LF on Windows too
    (SITE_DATA / "results.json").write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote site/public/data/results.json ({len(results['states'])} states) "
          f"and site/public/data/map.topojson ({size:,} bytes)")


if __name__ == "__main__":
    main()
