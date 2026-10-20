import dataclasses
import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from gerry.checks import CheckError
from gerry.config import AtLargeState, data_dir, load_config

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
    assert join.maps_of(cfg.states["MO"]) == [("enacted", "cd118"), ("mo_hb1", "cd120_2026_08"), ("check_2022", "cd118"),
                                              ("map_2024", "cd119")]


# Senate block (extensions design, chapter 7): two single-seat states in the layout of the MIT file
MEDSL = """year,state,state_po,state_fips,state_cen,state_ic,office,candidate,party_detailed,writein,candidatevotes,totalvotes,version,notes,party_simplified
2016,WYOMING,WY,56,83,68.0,US PRESIDENT,"CLINTON, HILLARY",DEMOCRAT,False,10,0,20210113,,DEMOCRAT
2016,WYOMING,WY,56,83,68.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,30,0,20210113,,REPUBLICAN
2020,WYOMING,WY,56,83,68.0,US PRESIDENT,"BIDEN, JOSEPH R. JR",DEMOCRAT,False,20,0,20210113,,DEMOCRAT
2020,WYOMING,WY,56,83,68.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,40,0,20210113,,REPUBLICAN
2016,DELAWARE,DE,10,51,11.0,US PRESIDENT,"CLINTON, HILLARY",DEMOCRAT,False,50,0,20210113,,DEMOCRAT
2016,DELAWARE,DE,10,51,11.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,40,0,20210113,,REPUBLICAN
2020,DELAWARE,DE,10,51,11.0,US PRESIDENT,"BIDEN, JOSEPH R. JR",DEMOCRAT,False,60,0,20210113,,DEMOCRAT
2020,DELAWARE,DE,10,51,11.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,30,0,20210113,,REPUBLICAN
"""


def test_single_seat_votes_reads_the_single_seat_states_in_order(tmp_path):
    (tmp_path / "medsl").mkdir()
    (tmp_path / "medsl" / "1976-2024-president.csv").write_text(MEDSL, encoding="utf-8")
    cfg = SimpleNamespace(at_large={"WY": AtLargeState("WY", "Wyoming", "56"),
                                    "DE": AtLargeState("DE", "Delaware", "10")})
    votes = load_script().single_seat_votes(cfg, tmp_path)
    # sorted by postal code: DE 50 + 60 Democratic, 40 + 30 Republican; WY 10 + 20 and 30 + 40
    assert votes[["state", "d", "r"]].values.tolist() == [["DE", 110, 70], ["WY", 30, 70]]


def tiny_result(join, postal):
    """What join_state returns for one state, cut down to one district: enough for write_outputs and the log line."""
    votes = dict.fromkeys(["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20", "d", "r"], 1.0)
    def frame(**keys):
        return pd.DataFrame([{**keys, **votes}])
    return join.StateResult(
        units=frame(unit_id="1"), enacted=frame(state=postal, map_id="enacted", method="block", district="01"),
        ensemble=frame(state=postal, draw="1", district="01"), reference=frame(state=postal, district="01"),
        log={"units": 1, "units_zero_vap": 0, "blocks": 1, "plans": 1,
             "maps": {"enacted": {"split_units": 0, "zero_vap_split_units": 0, "block_count_votes": 0.0}}})


@pytest.fixture
def main_run(tmp_path, monkeypatch):
    """run(argv, ...) calls main() with the data folder and data/interim inside tmp_path and join_state replaced by a
    stand-in that returns one tiny district, or raises a CheckError for the state in `fail`. It returns the exit
    code, the states join_state was asked for and the interim folder. `medsl` is written as the MIT file;
    `wy_and_de` makes WY and DE the single-seat states, as in MEDSL, instead of the six of config.yaml."""
    join = load_script()
    interim = tmp_path / "interim"
    monkeypatch.setenv("GERRY_DATA_DIR", str(tmp_path / "raw"))
    monkeypatch.setattr(join, "interim_dir", lambda: interim)
    asked = []

    def run(argv, *, medsl=None, fail=None, wy_and_de=False):
        if wy_and_de:
            cfg = dataclasses.replace(load_config(), at_large={"WY": AtLargeState("WY", "Wyoming", "56"),
                                                               "DE": AtLargeState("DE", "Delaware", "10")})
            monkeypatch.setattr(join, "load_config", lambda: cfg)
        (tmp_path / "raw" / "medsl").mkdir(parents=True, exist_ok=True)
        if medsl is not None:
            (tmp_path / "raw" / "medsl" / "1976-2024-president.csv").write_text(medsl, encoding="utf-8")

        def join_state(cfg, postal, root):
            asked.append(postal)
            if postal == fail:
                raise CheckError("join", postal, "forced")
            return tiny_result(join, postal)

        monkeypatch.setattr(join, "join_state", join_state)
        return join.main(argv), asked, interim
    return run


def test_main_stops_before_the_first_state_when_the_mit_file_is_missing(main_run, capsys):
    code, asked, interim = main_run(["--states", "NV"])
    err = capsys.readouterr().err
    assert code == 1 and asked == [] and not interim.exists()
    assert err.startswith("ERROR missing ")
    assert err.endswith("1976-2024-president.csv; run pipeline/01_download.py first\n")


def test_main_stops_before_the_first_state_when_a_single_seat_state_is_not_in_the_file(main_run, capsys):
    # config.yaml lists AK first of its six single-seat states; the file of MEDSL only has DE and WY
    code, asked, interim = main_run(["--states", "NV"], medsl=MEDSL)
    assert code == 1 and asked == [] and not interim.exists()
    assert capsys.readouterr().err == "ERROR single-seat states: AK 2016: no rows in the file\n"


def test_main_writes_no_interim_file_when_a_state_fails(main_run):
    # the single-seat votes are fine and AL fails its checks: not even single_seat_votes.parquet is written
    code, asked, interim = main_run(["--states", "NV", "AL"], medsl=MEDSL, fail="AL", wy_and_de=True)
    assert code == 1 and asked == ["NV", "AL"] and not interim.exists()


@pytest.mark.parametrize("argv", [[], ["--states", "NV"]])
def test_main_writes_the_single_seat_votes_in_a_full_and_in_a_partial_run(main_run, capsys, argv):
    code, asked, interim = main_run(argv, medsl=MEDSL, wy_and_de=True)
    assert code == 0 and asked == (["NV"] if argv else sorted(load_config().states))
    table = pd.read_parquet(interim / "single_seat_votes.parquet")
    # MEDSL: DE 50 + 60 Democratic and 40 + 30 Republican, WY 10 + 20 and 30 + 40; whole numbers
    assert table.to_dict("list") == {"state": ["DE", "WY"], "d_pre_16": [50, 10], "r_pre_16": [40, 30],
                                     "d_pre_20": [60, 20], "r_pre_20": [30, 40], "d": [110, 30], "r": [70, 70]}
    assert table.drop(columns="state").dtypes.astype(str).unique().tolist() == ["int64"]
    # DE 110 / 180 = 0.6111, WY 30 / 100 = 0.3000; the line stands just before the last one
    lines = capsys.readouterr().out.splitlines()
    assert lines[-2] == ("Single-seat states, Democratic share of the 2016 and 2020 presidential votes: "
                         "DE 0.6111, WY 0.3000")
    assert lines[-1].startswith(f"Wrote {len(asked)} states to ")


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
    def pick(map_id, method):
        return enacted[(enacted["map_id"] == map_id) & (enacted["method"] == method)]
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
    def pick(map_id):
        return enacted[(enacted["map_id"] == map_id) & (enacted["method"] == "block")]
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
    def pick(map_id):
        return enacted[(enacted["map_id"] == map_id) & (enacted["method"] == "block")]
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
