"""Reference numbers from the feasibility check (plan, Interfaces). Needs
data/interim/metrics.json from 02_join.py and 03_metrics.py on the real data."""
import json

import pytest

from gerry.config import interim_dir

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
