"""Reference numbers from the feasibility check (plan, Interfaces). Needs
data/interim/metrics.json from 02_join.py and 03_metrics.py on the real data."""
import json

import pytest

from gerry.config import interim_dir, load_config

METRICS = interim_dir() / "metrics.json"
pytestmark = [pytest.mark.data,
              pytest.mark.skipif(not METRICS.exists(), reason="run 02_join.py and 03_metrics.py first")]

# state: proportional, enacted, plans per D seat count, median, p5, p95
REFERENCE = {
    "NV": (2, 3, {1: 13, 2: 1901, 3: 3086}, 3, 2, 3),
    "TX": (18, 11, {12: 1, 13: 1, 14: 62, 15: 264, 16: 1027, 17: 1197, 18: 1213, 19: 755, 20: 452, 21: 28},
           17, 15, 20),
    "CA": (34, 48, {43: 112, 44: 763, 45: 3258, 46: 802, 47: 58, 48: 7}, 45, 44, 46),
    "IA": (2, 0, {0: 78, 1: 3214, 2: 1708}, 1, 1, 2),
    "WV": (1, 0, {0: 5000}, 0, 0, 0),
    "UT": (2, 1, {0: 1387, 1: 3613}, 1, 0, 1),
    "NC": (7, 3, {3: 1, 4: 156, 5: 1752, 6: 1875, 7: 1118, 8: 98}, 6, 5, 7),
    "LA": (2, 1, {0: 1, 1: 4989, 2: 10}, 1, 1, 1),
}


@pytest.fixture(scope="module")
def metrics():
    return json.loads(METRICS.read_text(encoding="utf-8"))


@pytest.mark.parametrize("postal", sorted(REFERENCE))
def test_reference_numbers(metrics, postal):
    proportional, enacted, plans, median, p5, p95 = REFERENCE[postal]
    s = metrics["states"][postal]
    assert s["proportional"] == proportional
    assert s["enacted"] == enacted
    assert {seats: n for seats, n in enumerate(s["neutral"]["dist"]) if n} == plans
    assert (s["neutral"]["median"], s["neutral"]["p5"], s["neutral"]["p95"]) == (median, p5, p95)
    assert metrics["checks"]["plans"][postal] == 5000


def test_nevada_enacted_districts(metrics):
    shares = {d["id"]: d["share"] for d in metrics["states"]["NV"]["districts"]}
    assert shares == pytest.approx({"3201": 0.547901, "3202": 0.436352, "3203": 0.534711, "3204": 0.548082},
                                   abs=5e-7)


def test_nevada_position(metrics):
    # 1914 of 5000 plans give fewer D seats than 3, 3086 the same, none more
    assert metrics["states"]["NV"]["position"] == pytest.approx(
        {"fewer": 0.3828, "equal": 0.6172, "more": 0.0, "midrank": 0.6914})


def test_nevada_cd118_against_alarm(metrics):
    rows = metrics["checks"]["cd118_vs_alarm"]["NV"]["districts"]
    assert max(abs(r["ours"] - r["alarm"]) for r in rows) == pytest.approx(0.00042, abs=5e-6)


def test_narrow_ensembles(metrics):
    # LA: 4989 of 5000 plans give 1 seat; WV: all give 0; NV: largest share 62%
    assert metrics["states"]["LA"]["computed_notes"] == ["narrow_ensemble"]
    assert metrics["states"]["WV"]["computed_notes"] == ["narrow_ensemble"]
    assert metrics["states"]["NV"]["computed_notes"] == []


def test_national_totals(metrics):
    nat = metrics["national"]
    states = metrics["states"].values()
    assert nat["seats"] == 429
    assert [s["postal"] for s in nat["single_seat"]] == ["AK", "DE", "ND", "SD", "VT", "WY"]
    assert nat["proportional"] == sum(s["proportional"] for s in states)
    assert nat["enacted"] == sum(s["enacted"] for s in states)
    assert len(nat["neutral"]["dist"]) == 430
    assert sum(nat["neutral"]["dist"]) == pytest.approx(1.0)


# Extensions: numbers from the prototype run of 2026-10-06 (plan 2026-10-06-extensions.md, "Proefrun").
# state: competitive districts (45 to 55%) on the enacted map, and median, p5 and p95 over the plans
COMPETITIVE = {
    "AZ": (4, 4, 2, 5), "CA": (1, 9, 6, 12), "FL": (14, 7, 4, 9), "NC": (2, 4, 3, 6), "NV": (3, 2, 1, 2),
    "TX": (5, 9, 4, 12), "WV": (0, 0, 0, 0),
}
# state: Democratic seats on the 2024 map and the change to the enacted map (enacted minus 2024)
REDRAW = {
    "AL": (2, -1), "CA": (44, 4), "FL": (10, -1), "LA": (2, -1), "NC": (4, -1), "OH": (4, -1), "TN": (1, -1),
    "TX": (14, -3), "UT": (0, 1),
}


@pytest.mark.parametrize("postal", sorted(COMPETITIVE))
def test_competitive_districts(metrics, postal):
    c = metrics["states"][postal]["competitive"]
    assert (c["enacted"], c["median"], c["p5"], c["p95"]) == COMPETITIVE[postal]
    assert sum(c["neutral_dist"]) == 5000


def test_competitive_upper_bound_is_inclusive(metrics):
    # Florida plan 136, district 21 has 387,981 D of 705,420 votes: exactly 0.55 (705,420 * 0.55 = 387,981), the only
    # plan district in any state that sits on a bound. With the bound included the plan has 5 competitive districts;
    # an exclusive bound would make it 4 and read [217, 686] here.
    assert metrics["states"]["FL"]["competitive"]["neutral_dist"][4:6] == [216, 687]


def test_redraws_since_2024(metrics):
    states = metrics["states"]
    # the nine states with another map than in 2024; Missouri votes on its 2022 map, as in 2024
    assert {p for p, s in states.items() if s["redraw"]["map_changed"]} == set(REDRAW)
    for postal, s in states.items():
        assert (s["redraw"]["seats_2024"], s["redraw"]["change"]) == REDRAW.get(postal, (s["enacted"], 0)), postal


def test_redraws_for_the_nation(metrics):
    # 217 Democratic districts on the 2024 maps, 213 on the enacted maps
    assert metrics["national"]["redraw"] == {"seats_2024": 217, "change": -4}


def test_majority_thresholds(metrics):
    maj = metrics["national"]["majority"]
    assert maj["seats_needed"] == 216
    assert maj["base_share"] == pytest.approx(0.5179747, abs=5e-7)
    # enacted: the 216th highest district share is 0.4949420 -> 0.5179747 + 0.5 - 0.4949420
    assert maj["enacted"] == pytest.approx({"share": 0.5230328, "seats_at_base": 213}, abs=5e-7)
    # neutral: grid swings -0.0064 (50%), -0.0114 (5%) and -0.0020 (95%)
    assert maj["neutral"] == pytest.approx({"share": 0.5115747, "low": 0.5065747, "high": 0.5159747,
                                            "probability_at_base": 0.9853454}, abs=5e-7)
    # proportional: grid swing -0.0201, where IN and NY both gain a seat (214 -> 216)
    assert maj["proportional"] == pytest.approx({"share": 0.4978747}, abs=5e-7)


def test_competitive_districts_for_the_nation(metrics):
    c = metrics["national"]["competitive"]
    assert (c["enacted"], c["median"], c["p5"], c["p95"]) == (81, 96, 87, 105)
    assert c["enacted"] == sum(s["competitive"]["enacted"] for s in metrics["states"].values())
    assert len(c["neutral_dist"]) == 430 and sum(c["neutral_dist"]) == pytest.approx(1.0)


def test_overview_per_control_and_body(metrics):
    cfg = load_config()
    states = metrics["states"]
    for field, attr in (("by_control", "control"), ("by_body", "adopted_by")):
        table = metrics["national"][field]
        for value, entry in table.items():
            members = [p for p, st in cfg.states.items() if getattr(st, attr) == value]
            assert entry == {"states": len(members), "seats": sum(cfg.states[p].seats for p in members),
                             "drawing": sum(states[p]["effects"]["drawing"] for p in members)}, (field, value)
        assert sum(e["states"] for e in table.values()) == 44
        assert sum(e["seats"] for e in table.values()) == 429
        # the sum of the state drawing effects: -10 on 2026-10-06
        drawing = sum(e["drawing"] for e in table.values())
        assert drawing == sum(s["effects"]["drawing"] for s in states.values()) == -10
    # the totals approved by the owner on 2026-10-07 (config.yaml after Task 5.10), in the order of the design
    assert metrics["national"]["by_control"] == {
        "Republican": {"states": 16, "seats": 165, "drawing": -17},
        "Democratic": {"states": 8, "seats": 118, "drawing": 9},
        "Bipartisan": {"states": 10, "seats": 61, "drawing": -3},
        "Nonpartisan": {"states": 10, "seats": 85, "drawing": 1},
    }
    assert metrics["national"]["by_body"] == {
        "Legislature": {"states": 28, "seats": 301, "drawing": -9},
        "Commission": {"states": 9, "seats": 73, "drawing": -1},
        "Court": {"states": 7, "seats": 55, "drawing": 0},
    }
    assert list(metrics["national"]["by_control"]) == ["Republican", "Democratic", "Bipartisan", "Nonpartisan"]
    assert list(metrics["national"]["by_body"]) == ["Legislature", "Commission", "Court"]


def test_senate(metrics):
    sen = metrics["national"]["senate"]
    # prototype run of 2026-10-07: the 44 states of the vote basis and the six single-seat states (MIT file)
    assert (sen["states_needed"], sen["states_at_base"], sen["seats_at_base"]) == (26, 22, 44)
    assert sen["base_share"] == pytest.approx(0.5169609, abs=5e-7)
    # the 26th highest state share is Florida's 0.4878762: 0.5169609 + 0.5 - 0.4878762
    assert sen["share"] == pytest.approx(0.5290847, abs=5e-7)
    assert [t["postal"] for t in sen["tipping"]] == ["AZ", "GA", "FL", "NC", "TX"]
    assert [t["share"] for t in sen["tipping"]] == pytest.approx(
        [0.4929715, 0.4888521, 0.4878762, 0.4876063, 0.4635184], abs=5e-7)
    # one vote base: a multi-seat state has the share behind its proportional seats
    for t in sen["tipping"]:
        assert t["share"] == metrics["states"][t["postal"]]["d_share"]
