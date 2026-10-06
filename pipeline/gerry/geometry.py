"""District and outline geometry for the site map: TIGER GeoPackage, Missouri 2022, mapshaper."""
from __future__ import annotations

import os
import shutil
import subprocess
import warnings
import zipfile
from collections.abc import Sequence
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio

from gerry.checks import CheckError
from gerry.config import REPO_ROOT

GPKG_LAYER = "Congressional Districts"   # with a space; checked against the file on 2026-10-05
GPKG_FIELD = "CD120FP"
MO_FIPS = "29"
MAPSHAPER_JS = REPO_ROOT / "node_modules" / "mapshaper" / "bin" / "mapshaper"

# The 50 states. DC, Puerto Rico and the island areas are left out of the map.
STATE_POSTAL = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS",
    "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
    "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
    "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY",
}


def _extract_once(zip_path: Path, workdir: Path) -> Path:
    """Unzip the single .gpkg member into workdir, unless a file of the same size is already there."""
    with zipfile.ZipFile(zip_path) as zf:
        members = [m for m in zf.infolist() if m.filename.endswith(".gpkg")]
        if len(members) != 1:
            raise CheckError("geopackage", "US", f"{zip_path.name} holds {len(members)} .gpkg files, expected 1")
        member = members[0]
        target = workdir / Path(member.filename).name
        if target.exists() and target.stat().st_size == member.file_size:
            return target
        workdir.mkdir(parents=True, exist_ok=True)
        part = target.with_name(target.name + ".part")
        with zf.open(member) as src, open(part, "wb") as dst:
            shutil.copyfileobj(src, dst, length=1 << 20)
    os.replace(part, target)
    return target


def load_districts(gpkg_zip: Path, mo_zip: Path, workdir: Path) -> gpd.GeoDataFrame:
    """Districts for November 2026: CD120 from the GeoPackage, Missouri from the 2022 map.

    Columns id (state FIPS + district, "4809"), state (postal code) and geometry, in EPSG:4326.
    """
    gpkg = _extract_once(gpkg_zip, workdir)
    with warnings.catch_warnings():
        # The TIGER GeoPackage stores measured (M) geometries; pyogrio drops M and says so.
        warnings.filterwarnings("ignore", message="Measured \\(M\\) geometry types", category=UserWarning)
        layers = [str(name) for name, _ in pyogrio.list_layers(gpkg)]
        if GPKG_LAYER not in layers:
            raise CheckError("geopackage", "US", f"layer {GPKG_LAYER!r} not in {gpkg.name}; layers: {layers}")
        fields = [str(f) for f in pyogrio.read_info(gpkg, layer=GPKG_LAYER)["fields"]]
        missing = sorted({"STATEFP", GPKG_FIELD} - set(fields))
        if missing:
            raise CheckError("geopackage", "US", f"layer {GPKG_LAYER!r} lacks {missing}; fields: {fields}")
        cd = gpd.read_file(gpkg, layer=GPKG_LAYER, columns=["STATEFP", GPKG_FIELD])
    cd = cd.rename(columns={GPKG_FIELD: "district"})
    keep = cd["STATEFP"].isin(list(STATE_POSTAL)) & (cd["STATEFP"] != MO_FIPS) & ~cd["district"].isin(["ZZ", "98"])
    cd = cd[keep]

    mo = gpd.read_file(mo_zip, columns=["STATEFP", "CD119FP"]).rename(columns={"CD119FP": "district"})
    if not (mo["STATEFP"] == MO_FIPS).all():
        raise CheckError("geopackage", "MO", f"{mo_zip.name} has STATEFP {sorted(mo['STATEFP'].unique())}")
    mo = mo.to_crs(cd.crs)

    out = gpd.GeoDataFrame(pd.concat([cd, mo], ignore_index=True), geometry="geometry", crs=cd.crs)
    out["id"] = out["STATEFP"] + out["district"]
    out["state"] = out["STATEFP"].map(STATE_POSTAL)
    out["geometry"] = out.geometry.force_2d()
    out = out[["id", "state", "geometry"]].sort_values("id").reset_index(drop=True)
    duplicated = out.loc[out["id"].duplicated(), "id"].tolist()
    if duplicated:
        raise CheckError("geopackage", "US", f"district ids occur more than once: {duplicated}")
    return out.to_crs("EPSG:4326")


def national_outline(cb_zip: Path) -> gpd.GeoDataFrame:
    """The 50 states from the cartographic boundary file, merged into one shape (EPSG:4326)."""
    states = gpd.read_file(cb_zip, columns=["STATEFP"])
    states = states[states["STATEFP"].isin(list(STATE_POSTAL))]
    if len(states) != len(STATE_POSTAL):
        raise CheckError("outline", "US", f"{cb_zip.name} has {len(states)} of the {len(STATE_POSTAL)} states")
    shape = states.to_crs("EPSG:4326").union_all()
    return gpd.GeoDataFrame({"name": ["US"]}, geometry=[shape], crs="EPSG:4326")


def mapshaper_cmd(args: Sequence[str]) -> list[str]:
    """Command line for the repo's mapshaper. Not npx: on Windows that is a .cmd file."""
    return ["node", str(MAPSHAPER_JS), *args]


def build_topojson(districts_path: Path, outline_path: Path, out_path: Path, simplify_pct: float) -> Path:
    """Clip, dissolve and simplify with mapshaper; write TopoJSON with layers districts and states."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    args = [
        "-i", str(districts_path), "snap", "name=districts",
        "-clip", str(outline_path), "remove-slivers",
        "-each", "fips = id.slice(0, 2)",
        "-dissolve", "fips", "copy-fields=state", "+", "name=states",
        "-rename-fields", "id=fips,postal=state", "target=states",
        "-filter-fields", "id,state", "target=districts",
        "-simplify", f"{simplify_pct}%", "keep-shapes", "target=districts,states",
        "-o", "format=topojson", "target=districts,states", str(out_path),
    ]
    subprocess.run(mapshaper_cmd(args), check=True)
    return out_path
