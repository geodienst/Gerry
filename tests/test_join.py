import importlib.util
import sys
from pathlib import Path

import pandas as pd
import pytest

from gerry.config import data_dir, load_config

SCRIPT = Path(__file__).resolve().parents[1] / "pipeline" / "02_join.py"


def load_script():
    """Import pipeline/02_join.py (its name starts with a digit, so no normal import)."""
    spec = importlib.util.spec_from_file_location("join_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module      # dataclasses look the module up here
    spec.loader.exec_module(module)
    return module


def test_replace_states_keeps_other_states_and_column_order():
    old = pd.DataFrame({"state": ["AL", "NV", "NV"], "district": ["01", "01", "02"], "d": [1.0, 2.0, 3.0]})
    new = pd.DataFrame({"state": ["NV"], "district": ["01"], "d": [9.0]})
    out = load_script().replace_states(old, new, {"NV"})
    assert out.to_dict("records") == [{"state": "AL", "district": "01", "d": 1.0},
                                      {"state": "NV", "district": "01", "d": 9.0}]


def test_replace_states_without_old_file():
    new = pd.DataFrame({"state": ["NV"], "district": ["01"], "d": [9.0]})
    assert load_script().replace_states(None, new, {"NV"}).equals(new)


def test_maps_of_lists_enacted_extra_check_and_2024_maps():
    cfg = load_config()
    join = load_script()
    assert join.maps_of(cfg.states["NV"]) == [("enacted", "cd120"), ("check_2022", "cd118"), ("map_2024", "cd119")]
    assert join.maps_of(cfg.states["MO"]) == [("enacted", "cd118"), ("mo_hb1", "cd120"), ("check_2022", "cd118"),
                                              ("map_2024", "cd119")]


def files_of(postal, *extra):
    st = postal.lower()
    return [data_dir() / p for p in (f"alarm/{postal}_cd_2020_map.rds", f"alarm/{postal}_cd_2020_stats.csv",
                                     f"census/pl/{st}2020.pl.zip", "census/cd120.zip", "census/cd118.zip",
                                     "census/cd119.zip", *extra)]


def shares(frame):
    frame = frame.set_index("district")
    return frame["d"] / (frame["d"] + frame["r"])


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("NV")), reason="needs the Nevada files")
def test_nevada_join_reproduces_the_reference_numbers():
    result = load_script().join_state(load_config(), "NV", data_dir())
    enacted = result.enacted
    pick = lambda map_id, method: enacted[(enacted["map_id"] == map_id) & (enacted["method"] == method)]
    block = shares(pick("enacted", "block"))
    # plan skeleton, "Referentiegetallen": Nevada, Enacted per district (block method)
    assert block.round(6).to_dict() == {"01": 0.547901, "02": 0.436352, "03": 0.534711, "04": 0.548082}
    whole = shares(pick("enacted", "whole_unit"))
    assert ((whole > 0.5) == (block > 0.5)).all()
    # CD118 against ALARM's cd_2020: largest difference 0.00042
    reference = shares(result.reference)
    assert round(float((shares(pick("check_2022", "block")) - reference).abs().max()), 5) == 0.00042
    log = result.log
    assert (log["units"], log["blocks"], log["unlinked_blocks"], log["plans"]) == (2102, 57409, 0, 5000)
    assert log["reference_labels"] == {}
    # one split VTD without VAP holds votes: 32003001906, 20.3 votes by block count
    assert log["maps"]["enacted"]["split_units"] == 40
    assert round(log["maps"]["enacted"]["block_count_votes"], 1) == 20.3
    assert len(result.ensemble) == 20000 and result.ensemble["draw"].nunique() == 5000
    assert list(result.units.columns) == ["unit_id", "vap", "pop", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20",
                                          "d", "r"]
    # Nevada has not redrawn since 2021: the 2024 map (CD119) is the enacted map, block for block
    assert log["map_2024_changed_blocks"] == 0
    assert shares(pick("map_2024", "block")).equals(block)
    assert log["maps"]["map_2024"] == log["maps"]["enacted"]
    assert shares(pick("map_2024", "whole_unit")).equals(shares(pick("enacted", "whole_unit")))


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("AL")), reason="needs the Alabama files")
def test_alabama_join_has_another_map_in_2024():
    result = load_script().join_state(load_config(), "AL", data_dir())
    enacted = result.enacted
    pick = lambda map_id: enacted[(enacted["map_id"] == map_id) & (enacted["method"] == "block")]
    # the 2024 court map (CD119) against the legislature's 2023 plan (CD120): 23,529 blocks moved
    assert result.log["map_2024_changed_blocks"] == 23529
    # prototype on the real data: two districts above one half on the 2024 map, one on the 2026 map
    assert int((shares(pick("map_2024")) > 0.5).sum()) == 2
    assert int((shares(pick("enacted")) > 0.5).sum()) == 1
    # the same votes on both maps
    assert pick("map_2024")["d"].sum() == pytest.approx(pick("enacted")["d"].sum(), rel=1e-9)


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("MO")), reason="needs the Missouri files")
def test_missouri_2024_map_is_its_enacted_2022_map():
    result = load_script().join_state(load_config(), "MO", data_dir())
    enacted = result.enacted
    pick = lambda map_id: enacted[(enacted["map_id"] == map_id) & (enacted["method"] == "block")]
    # Missouri votes on its 2022 map (CD118), the map of 2024 (CD119): no block moved. CD120 holds HB 1 of 2025,
    # which is blocked; against CD120 the log would say 53,433 blocks.
    assert result.log["map_2024_changed_blocks"] == 0
    assert shares(pick("map_2024")).equals(shares(pick("enacted")))


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("OR", "census_vest/or_2020_block.csv")),
                    reason="needs the Oregon files")
def test_oregon_join_relabels_alarms_reference_map():
    result = load_script().join_state(load_config(), "OR", data_dir())
    # spec chapter 4: the stats file numbers Oregon's cd_2020 districts differently from map.rds
    assert result.log["reference_labels"] == {"01": "02", "02": "04", "03": "05", "04": "06", "05": "03", "06": "01"}
    assert result.reference["district"].tolist() == ["01", "02", "03", "04", "05", "06"]
    assert (result.log["units"], result.log["unlinked_blocks"]) == (1001, 0)
    # after the new labels each district of ALARM's reference map lies within 0.5 points of CD118
    enacted = result.enacted
    check = enacted[(enacted["map_id"] == "check_2022") & (enacted["method"] == "block")]
    assert (shares(check) - shares(result.reference)).abs().max() < 0.005
