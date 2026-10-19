import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box

from gerry.checks import CheckError, check_geometry
from gerry.config import data_dir

# Nevada (FIPS 32) with two square districts side by side. Utah's "4903" covers the same area and
# must be ignored: it belongs to another state.
DISTRICTS = gpd.GeoDataFrame(
    {"id": ["3201", "3202", "4903"], "state": ["NV", "NV", "UT"]},
    geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1), box(-5, -5, 5, 5)],
    crs="EPSG:4326",
)


def blocks(points):
    """P.L. 94-171 block table; points: {block_id: (lon, lat)}."""
    return pd.DataFrame({
        "block_id": list(points),
        "vap": [10] * len(points),
        "vtd": ["000001"] * len(points),
        "lat": [lat for _, lat in points.values()],
        "lon": [lon for lon, _ in points.values()],
    })


def bef(assignment):
    s = pd.Series(assignment, name="district")
    s.index.name = "block_id"
    return s


POINTS = {
    "320010001001000": (0.5, 0.5),
    "320010001001001": (0.2, 0.8),
    "320010001001002": (1.5, 0.5),
    "320010001001003": (1.7, 0.1),
}
NAMED = {"320010001001000": "01", "320010001001001": "01", "320010001001002": "02", "320010001001003": "02"}


def test_check_geometry_passes_when_every_point_is_in_its_district():
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(NAMED), "NV") == 1.0


def test_check_geometry_ignores_zz_blocks():
    points = {**POINTS, "320010001001004": (9.0, 9.0)}       # water block outside every district
    named = {**NAMED, "320010001001004": "ZZ"}
    assert check_geometry(DISTRICTS, blocks(points), bef(named), "NV") == 1.0


def test_check_geometry_stops_when_district_codes_differ():
    named = {**NAMED, "320010001001003": "03"}
    with pytest.raises(CheckError) as err:
        check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV")
    assert (err.value.check, err.value.state) == ("geometry_codes", "NV")


def test_check_geometry_stops_when_geometry_has_a_district_the_block_file_lacks():
    third = gpd.GeoDataFrame({"id": ["3203"], "state": ["NV"]}, geometry=[box(2, 0, 3, 1)], crs="EPSG:4326")
    extra = pd.concat([DISTRICTS, third], ignore_index=True)
    with pytest.raises(CheckError) as err:
        check_geometry(extra, blocks(POINTS), bef(NAMED), "NV")
    assert (err.value.check, err.value.state) == ("geometry_codes", "NV")


def test_check_geometry_stops_below_min_share():
    named = {**NAMED, "320010001001003": "01"}                 # point lies in 02, block file says 01
    with pytest.raises(CheckError) as err:
        check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV")
    assert err.value.check == "geometry_points"
    assert "320010001001003" in err.value.detail


def test_check_geometry_lists_only_the_first_five_misses_in_id_order():
    points = {f"3200100010020{i:02d}": (0.5, 0.5) for i in range(7)}     # all lie in district 01
    named = {k: "02" for k in points}                                      # the block file says 02
    points["320010001009999"] = (0.5, 0.5)
    named["320010001009999"] = "01"                                        # one confirmed block, so both codes occur
    with pytest.raises(CheckError) as err:
        check_geometry(DISTRICTS, blocks(points), bef(named), "NV")
    assert [b for b in sorted(points) if b in err.value.detail] == sorted(points)[:5]


def test_check_geometry_returns_share_when_above_min_share():
    named = {**NAMED, "320010001001003": "01"}
    # 3 of 4 points in the named district
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV", min_share=0.7) == 0.75


def test_check_geometry_accepts_a_share_equal_to_min_share():
    named = {**NAMED, "320010001001003": "01"}                             # 3 of 4 points confirmed
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV", min_share=0.75) == 0.75


def test_check_geometry_counts_a_block_without_point_as_a_miss():
    named = {**NAMED, "320010001001009": "02"}                 # in the block file, not in P.L. 94-171
    # 4 of 5 blocks confirmed
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV", min_share=0.5) == 0.8


GPKG = data_dir() / "census" / "tiger" / "tlgpkg_2026_us_legislative.gpkg.zip"
MO_2022 = data_dir() / "census" / "tiger" / "tl_2025_29_cd119.zip"


@pytest.mark.data
@pytest.mark.parametrize("postal, fips, bef_kind", [("NV", "32", "cd120"), ("MO", "29", "cd118")])
def test_check_geometry_on_real_files(postal, fips, bef_kind, tmp_path):
    from gerry.blocks import read_bef, read_pl_blocks
    from gerry.geometry import load_districts

    pl_zip = data_dir() / "census" / "pl" / f"{postal.lower()}2020.pl.zip"
    bef_zip = data_dir() / "census" / f"{bef_kind}.zip"
    if not all(p.exists() for p in (GPKG, MO_2022, pl_zip, bef_zip)):
        pytest.skip("real files missing in the data directory")
    districts = load_districts(GPKG, MO_2022, data_dir() / "census" / "tiger")
    share = check_geometry(districts, read_pl_blocks(pl_zip, postal.lower()),
                           read_bef(bef_zip, bef_kind, fips, postal), postal)
    assert share >= 0.999
