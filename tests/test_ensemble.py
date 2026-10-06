import pandas as pd
import pytest

from gerry.checks import CheckError
from gerry.config import StateConfig, data_dir
from gerry.ensemble import N_PLANS, district_votes, read_stats


def make_state(postal="NV", seats=2, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name="Test", fips="32", seats=seats, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_kind="vtd", extra_maps=(), notes=())


def write_stats(path, draws, seats=2, skip=None):
    """ALARM-style stats file: values padded with spaces as R's format() writes them.
    `skip` = (draw, district) to leave out."""
    lines = ["draw,district,total_pop,chain,pre_16_dem_cli,pre_16_rep_tru,uss_16_dem_x,pre_20_dem_bid,pre_20_rep_tru"]
    for k in range(1, seats + 1):
        lines.append(f'cd_2020,{k},  1000,"NA",  {100 + k},   {200 + k},  5,  {300 + k},   {400 + k}')
    for draw in draws:
        for k in range(1, seats + 1):
            if (draw, k) != skip:
                lines.append(f"{draw},{k},  1000, 1,  {10 + k},   {20 + k},  5,  {30 + k},   {40 + k}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def test_read_stats_keeps_draw_as_text(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=[2, 3]))
    assert stats["draw"].tolist()[:3] == ["cd_2020", "cd_2020", "2"]
    assert stats["pre_16_dem_cli"].tolist()[:2] == [101, 102]


def test_district_votes_splits_ensemble_and_reference(tmp_path):
    # Draw ids start at 2, as in Texas: what counts is 5,000 distinct draws.
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(2, N_PLANS + 2)))
    ensemble, reference = district_votes(stats, make_state())
    cols = ["state", "draw", "district", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20", "d", "r"]
    assert list(ensemble.columns) == cols and list(reference.columns) == cols
    assert len(ensemble) == 2 * N_PLANS
    assert ensemble["draw"].iloc[0] == "2" and ensemble["draw"].iloc[-1] == "5001"
    assert reference.to_dict("records") == [
        # d = 101 + 301, r = 201 + 401
        {"state": "NV", "draw": "cd_2020", "district": "01", "d_pre_16": 101.0, "r_pre_16": 201.0,
         "d_pre_20": 301.0, "r_pre_20": 401.0, "d": 402.0, "r": 602.0},
        {"state": "NV", "draw": "cd_2020", "district": "02", "d_pre_16": 102.0, "r_pre_16": 202.0,
         "d_pre_20": 302.0, "r_pre_20": 402.0, "d": 404.0, "r": 604.0},
    ]


def test_district_votes_with_one_election(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(1, N_PLANS + 1)))
    ensemble, _ = district_votes(stats, make_state(postal="WV", elections=("pre_20",)))
    assert list(ensemble.columns) == ["state", "draw", "district", "d_pre_20", "r_pre_20", "d", "r"]
    assert ensemble[["d", "r"]].iloc[0].tolist() == [31.0, 41.0]


def test_district_votes_needs_every_district_in_every_plan(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(1, N_PLANS + 1), skip=(17, 2)))
    with pytest.raises(CheckError, match="draw 17"):
        district_votes(stats, make_state())


def test_district_votes_needs_5000_plans(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(1, N_PLANS)))
    with pytest.raises(CheckError, match="4999 plans"):
        district_votes(stats, make_state())


def test_district_votes_rejects_a_repeated_draw(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=[*range(1, N_PLANS + 1), 9]))
    with pytest.raises(CheckError, match="draw 9"):
        district_votes(stats, make_state())


NV_STATS = data_dir() / "alarm" / "NV_cd_2020_stats.csv"


@pytest.mark.data
@pytest.mark.skipif(not NV_STATS.exists(), reason="needs alarm/NV_cd_2020_stats.csv")
def test_nevada_ensemble_matches_the_feasibility_check():
    ensemble, reference = district_votes(read_stats(NV_STATS), make_state(seats=4))
    assert len(ensemble) == 4 * N_PLANS and len(reference) == 4
    seats = (ensemble["d"] > ensemble["r"]).groupby(ensemble["draw"]).sum()
    assert seats.value_counts().sort_index().to_dict() == {1: 13, 2: 1901, 3: 3086}
