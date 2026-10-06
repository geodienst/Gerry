import json
import shutil
import zipfile

import geopandas as gpd
import pytest
from shapely.geometry import box

from gerry.checks import CheckError
from gerry.config import REPO_ROOT
from gerry.geometry import (
    MAPSHAPER_JS, STATE_POSTAL, build_topojson, load_districts, mapshaper_cmd, national_outline,
)

GPKG_NAME = "tlgpkg_2026_us_legislative.gpkg"


def write_gpkg_zip(tmp_path, rows, layer="Congressional Districts", field="CD120FP"):
    """Zip a one-layer GeoPackage like the TIGER 2026 file. rows: (STATEFP, district, geometry)."""
    src = tmp_path / "src"
    src.mkdir(exist_ok=True)
    gdf = gpd.GeoDataFrame(
        {"STATEFP": [r[0] for r in rows], field: [r[1] for r in rows], "NAMELSAD": ["x"] * len(rows)},
        geometry=[r[2] for r in rows], crs="EPSG:4269",
    )
    gdf.to_file(src / GPKG_NAME, layer=layer, driver="GPKG")
    zip_path = tmp_path / f"{GPKG_NAME}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(src / GPKG_NAME, GPKG_NAME)
    shutil.rmtree(src)
    return zip_path


def write_mo_zip(tmp_path):
    """Zip a Missouri shapefile like tl_2025_29_cd119.zip, with two districts."""
    src = tmp_path / "mo"
    src.mkdir()
    gdf = gpd.GeoDataFrame({"STATEFP": ["29", "29"], "CD119FP": ["01", "02"]},
                           geometry=[box(5, 0, 6, 1), box(6, 0, 7, 1)], crs="EPSG:4269")
    gdf.to_file(src / "tl_2025_29_cd119.shp")
    zip_path = tmp_path / "tl_2025_29_cd119.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for f in src.iterdir():
            zf.write(f, f.name)
    shutil.rmtree(src)
    return zip_path


NATIONAL_ROWS = [
    ("01", "01", box(0, 0, 1, 1)),
    ("01", "02", box(1, 0, 2, 1)),
    ("02", "00", box(10, 10, 11, 11)),
    ("09", "ZZ", box(20, 0, 21, 1)),     # water, no district
    ("11", "98", box(22, 0, 23, 1)),     # DC delegate
    ("72", "98", box(24, 0, 25, 1)),     # Puerto Rico
    ("66", "98", box(26, 0, 27, 1)),     # Guam
    ("29", "01", box(50, 50, 51, 51)),   # Missouri HB 1, replaced by the 2022 map
]


def test_load_districts_keeps_states_and_takes_missouri_from_2022_file(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS)
    mo_zip = write_mo_zip(tmp_path)
    districts = load_districts(gpkg_zip, mo_zip, tmp_path / "work")
    assert districts["id"].tolist() == ["0101", "0102", "0200", "2901", "2902"]
    assert districts["state"].tolist() == ["AL", "AL", "AK", "MO", "MO"]
    assert list(districts.columns) == ["id", "state", "geometry"]
    assert districts.crs.to_epsg() == 4326
    mo1 = districts.loc[districts["id"] == "2901", "geometry"].iloc[0]
    assert mo1.bounds == pytest.approx((5, 0, 6, 1))


def test_load_districts_extracts_the_geopackage_once(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS)
    mo_zip = write_mo_zip(tmp_path)
    work = tmp_path / "work"
    load_districts(gpkg_zip, mo_zip, work)
    first = (work / GPKG_NAME).stat().st_mtime_ns
    load_districts(gpkg_zip, mo_zip, work)
    assert (work / GPKG_NAME).stat().st_mtime_ns == first
    assert sorted(p.name for p in work.iterdir()) == [GPKG_NAME]


def test_load_districts_stops_when_layer_is_missing(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS, layer="Congressional_Districts")
    with pytest.raises(CheckError) as err:
        load_districts(gpkg_zip, write_mo_zip(tmp_path), tmp_path / "work")
    assert err.value.check == "geopackage"
    assert "Congressional Districts" in err.value.detail


def test_load_districts_stops_when_cd120fp_is_missing(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS, field="CD119FP")
    with pytest.raises(CheckError) as err:
        load_districts(gpkg_zip, write_mo_zip(tmp_path), tmp_path / "work")
    assert err.value.check == "geopackage"
    assert "CD120FP" in err.value.detail


def write_cb_zip(tmp_path, fips_codes):
    """Zip a states shapefile like cb_2025_us_state_500k.zip: one unit square per state in a row."""
    src = tmp_path / "cb"
    src.mkdir()
    gdf = gpd.GeoDataFrame({"STATEFP": list(fips_codes)},
                           geometry=[box(i, 0, i + 1, 1) for i in range(len(fips_codes))], crs="EPSG:4269")
    gdf.to_file(src / "cb_2025_us_state_500k.shp")
    zip_path = tmp_path / "cb_2025_us_state_500k.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for f in src.iterdir():
            zf.write(f, f.name)
    shutil.rmtree(src)
    return zip_path


def test_national_outline_is_one_shape_of_the_50_states(tmp_path):
    cb_zip = write_cb_zip(tmp_path, [*sorted(STATE_POSTAL), "72", "11"])
    outline = national_outline(cb_zip)
    assert len(outline) == 1
    assert outline.crs.to_epsg() == 4326
    # 50 adjacent unit squares; Puerto Rico and DC (squares 51 and 52) are left out
    assert outline.geometry.iloc[0].area == pytest.approx(50)
    assert outline.geometry.iloc[0].bounds == pytest.approx((0, 0, 50, 1))


def test_national_outline_stops_when_a_state_is_missing(tmp_path):
    cb_zip = write_cb_zip(tmp_path, sorted(STATE_POSTAL)[1:])
    with pytest.raises(CheckError) as err:
        national_outline(cb_zip)
    assert err.value.check == "outline"


def test_mapshaper_cmd_runs_the_repo_copy_with_node():
    assert mapshaper_cmd(["-v"]) == ["node", str(REPO_ROOT / "node_modules" / "mapshaper" / "bin" / "mapshaper"), "-v"]


def topojson_bounds(topo):
    """Bounding box of all arcs of a quantized TopoJSON file, in input coordinates."""
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    xs, ys = [], []
    for arc in topo["arcs"]:
        x = y = 0
        for dx, dy in arc:
            x, y = x + dx, y + dy
            xs.append(x * sx + tx)
            ys.append(y * sy + ty)
    return min(xs), min(ys), max(xs), max(ys)


@pytest.mark.skipif(shutil.which("node") is None or not MAPSHAPER_JS.exists(),
                    reason="needs node and npm install (node_modules/mapshaper)")
def test_build_topojson_writes_district_and_state_layers(tmp_path):
    districts = gpd.GeoDataFrame({"id": ["0101", "0102", "0200"], "state": ["AL", "AL", "AK"]},
                                 geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1), box(3, 0, 4, 1)], crs="EPSG:4326")
    districts.to_file(tmp_path / "districts.geojson", driver="GeoJSON")
    outline = gpd.GeoDataFrame({"name": ["US"]}, geometry=[box(0, 0, 3.5, 0.5)], crs="EPSG:4326")
    outline.to_file(tmp_path / "outline.geojson", driver="GeoJSON")

    out = build_topojson(tmp_path / "districts.geojson", tmp_path / "outline.geojson",
                         tmp_path / "site" / "map.topojson", simplify_pct=50)

    topo = json.loads(out.read_text(encoding="utf-8"))
    assert set(topo["objects"]) == {"districts", "states"}
    assert [g["properties"] for g in topo["objects"]["districts"]["geometries"]] == [
        {"id": "0101", "state": "AL"}, {"id": "0102", "state": "AL"}, {"id": "0200", "state": "AK"}]
    assert sorted((g["properties"]["id"], g["properties"]["postal"])
                  for g in topo["objects"]["states"]["geometries"]) == [("01", "AL"), ("02", "AK")]
    # clipped to the outline: nothing above y = 0.5 or right of x = 3.5
    assert topojson_bounds(topo) == pytest.approx((0, 0, 3.5, 0.5), abs=1e-4)
