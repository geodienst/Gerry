"""One-time comparison of the Census CD120 block file with the states' own files.

Needs network and is not part of `make all`. Downloads go to <data dir>/state_files/ and are reused.
Writes data/crosscheck/state_files.csv. Run from the repo root:

    .venv\\Scripts\\python tools/compare_state_files.py [STATE ...]
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import geopandas as gpd
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from gerry.blocks import read_bef, read_pl_blocks  # noqa: E402
from gerry.config import REPO_ROOT, data_dir  # noqa: E402
from gerry.validation import STATE_FILES_COLUMNS  # noqa: E402  (the columns docs/validation.md reads)

UA = {"User-Agent": "Mozilla/5.0 (gerrymandering-map; compare_state_files)"}
OUT = REPO_ROOT / "data" / "crosscheck" / "state_files.csv"

# Ohio's site blocks requests from outside the US; the URL is the Internet Archive copy of
# https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx
SOURCES = {
    "AL": {"fips": "01", "map": "Livingston Congressional Plan 3-2023", "kind": "shapes", "field": "DISTRICT",
           "url": "https://services7.arcgis.com/jF2q3LPxL7PETdYk/arcgis/rest/services/"
                  "2023_CONG_LEGISLATIVE_PLAN/FeatureServer/0"},
    "MO": {"fips": "29", "map": "HB 1 of 2025", "kind": "block_file", "columns": ["Block", "DistrictID"],
           "url": "https://www.arcgis.com/sharing/rest/content/items/c340c9dd07384cc6b1457a3fce96df19/data"},
    "OH": {"fips": "39", "map": "Ohio Redistricting Commission plan of 2025-10-31", "kind": "block_file",
           "columns": ["Block", "DistrictID:1"],
           "url": "https://web.archive.org/web/20260422123848id_/https://www.ohiosos.gov/assets/"
                  "uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx"},
    "TN": {"fips": "47", "map": "HB 7003 / SB 7004 of 2026", "kind": "shapes", "field": "DISTRICT",
           "url": "https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/"
                  "CONGRESSIONAL_DISTRICTS/FeatureServer/2"},
    "UT": {"fips": "49", "map": "Map 1A (UGRC layer us_congress_districts_2026_to_2032)", "kind": "shapes",
           "field": "DISTRICT",
           "url": "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/"
                  "political_us_congress_districts_2026_to_2032/FeatureServer/0"},
}


def compare_assignments(census: pd.Series, official: pd.Series, vap: pd.Series | None = None) -> dict:
    """Compare two block -> district assignments. District numbers may differ: each CD120 district is
    matched to the state district that holds most of its blocks."""
    census = census[census != "ZZ"]
    official = official.dropna().astype(str).str.strip().str.zfill(2)
    both = census.index.intersection(official.index)
    table = pd.crosstab(census.loc[both].to_numpy(), official.loc[both].to_numpy())
    mapping = {c: table.loc[c].idxmax() for c in table.index}
    matching = both[(official.loc[both].to_numpy() == census.loc[both].map(mapping).to_numpy())]
    share_vap = None
    if vap is not None:
        share_vap = float(vap.reindex(matching).sum() / vap.reindex(census.index).fillna(0).sum())
    return {
        "blocks_census": len(census),
        "blocks_state": len(official),
        "only_census": len(census.index.difference(official.index)),
        "only_state": len(official.index.difference(census.index)),
        "blocks_matching": len(matching),
        "share_blocks": len(matching) / len(census),
        "share_vap": share_vap,
        "district_mapping": ";".join(f"{c}={o}" for c, o in sorted(mapping.items())),
        "one_to_one": len(set(mapping.values())) == len(mapping) == census.nunique(),
    }


def result_text(kind: str, r: dict) -> str:
    """One line for the comparison table in data/sources.md."""
    pairs = [pair.split("=") for pair in r["district_mapping"].split(";") if pair]
    renumbered = any(c != o for c, o in pairs)
    if kind == "block_file":
        n = r["blocks_census"]
        if r["blocks_matching"] == n == r["blocks_state"] and r["only_state"] == 0 and r["one_to_one"]:
            text = f"Identical, block for block ({n:,} blocks)"
        else:
            text = (f"{n - r['blocks_matching']:,} of {n:,} blocks differ; {r['only_census']:,} only in CD120, "
                    f"{r['only_state']:,} only in the state file")
    else:
        text = (f"{r['share_blocks']:.4%} of {r['blocks_census']:,} block points ({r['share_vap']:.4%} of "
                f"voting-age population) lie in the matching district")
        if r["only_census"]:
            text += f". Outside every district shape: {r['only_census']:,}"
    if renumbered:
        text += f", with other district numbers: {r['district_mapping']}"
    if not r["one_to_one"]:
        text += ". The district mapping is not one-to-one"
    return text


def make_row(postal: str, src: dict, retrieved: str, result: dict) -> dict:
    """One row of state_files.csv, with the keys of STATE_FILES_COLUMNS in that order."""
    row = {"state": postal, "map": src["map"], "source_kind": src["kind"], "source_url": src["url"],
           "retrieved": retrieved, **result, "result": result_text(src["kind"], result)}
    if list(row) != list(STATE_FILES_COLUMNS):
        raise ValueError(f"{postal}: row keys {list(row)} differ from STATE_FILES_COLUMNS")
    return row


def download(url: str, target: Path) -> Path:
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as response:
        data = response.read()
    part = target.with_name(target.name + ".part")
    part.write_bytes(data)
    os.replace(part, target)
    return target


def read_block_xlsx(path: Path, columns: list[str]) -> pd.Series:
    df = pd.read_excel(path, dtype=str, usecols=[0, 1])
    if list(df.columns) != columns:
        raise ValueError(f"{path.name}: columns {list(df.columns)}, expected {columns}")
    return pd.Series(df[columns[1]].to_numpy(), index=pd.Index(df[columns[0]].to_numpy(), name="block_id"))


def fetch_layer(url: str, field: str, target: Path) -> gpd.GeoDataFrame:
    """All features of an ArcGIS feature layer as GeoJSON in EPSG:4326, cached in target."""
    if not target.exists():
        features, offset = [], 0
        while True:
            query = urllib.parse.urlencode({"where": "1=1", "outFields": field, "outSR": 4326, "f": "geojson",
                                            "resultOffset": offset, "resultRecordCount": 1000})
            request = urllib.request.Request(f"{url}/query?{query}", headers=UA)
            with urllib.request.urlopen(request, timeout=300) as response:
                page = json.load(response)
            if "error" in page:
                raise RuntimeError(f"{url}: {page['error']}")
            features += page["features"]
            more = page.get("exceededTransferLimit") or page.get("properties", {}).get("exceededTransferLimit")
            if not more:
                break
            offset += len(page["features"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    shapes = gpd.read_file(target)
    shapes["district"] = shapes[field].map(lambda v: str(int(v)).zfill(2))
    return shapes[["district", "geometry"]].to_crs("EPSG:4326")


def shape_assignment(shapes: gpd.GeoDataFrame, blocks: pd.DataFrame) -> pd.Series:
    """block_id -> district of the state shape that contains the block's internal point."""
    points = gpd.GeoDataFrame({"block_id": blocks["block_id"].to_numpy()},
                              geometry=gpd.points_from_xy(blocks["lon"], blocks["lat"]), crs="EPSG:4326")
    hits = gpd.sjoin(points, shapes, how="inner", predicate="within").drop_duplicates("block_id")
    return pd.Series(hits["district"].to_numpy(), index=pd.Index(hits["block_id"].to_numpy(), name="block_id"))


def compare_state(postal: str, root: Path) -> dict:
    src = SOURCES[postal]
    cache = root / "state_files"
    census = read_bef(root / "census" / "cd120.zip", "cd120", src["fips"], postal)
    if src["kind"] == "block_file":
        path = download(src["url"], cache / f"{postal}_block_file.xlsx")
        result = compare_assignments(census, read_block_xlsx(path, src["columns"]))
    else:
        path = cache / f"{postal}_districts.geojson"
        shapes = fetch_layer(src["url"], src["field"], path)
        blocks = read_pl_blocks(root / "census" / "pl" / f"{postal.lower()}2020.pl.zip", postal.lower())
        result = compare_assignments(census, shape_assignment(shapes, blocks), blocks.set_index("block_id")["vap"])
    return make_row(postal, src, date.fromtimestamp(path.stat().st_mtime).isoformat(), result)


def main(states: list[str]) -> None:
    rows = []
    for postal in states:
        rows.append(compare_state(postal, data_dir()))
        print(f"{postal}: {rows[-1]['result']}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=list(STATE_FILES_COLUMNS)).to_csv(OUT, index=False, lineterminator="\n")
    print(f"Wrote {OUT.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main([s.upper() for s in sys.argv[1:]] or sorted(SOURCES))
