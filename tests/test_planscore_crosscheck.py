"""PlanScore cross-check (spec chapter 6): PlanScore's printed EG must follow from its own
district votes with its own formula, the equal-turnout form, to the rounding of the printed value.
Reads data/crosscheck/planscore.csv, which is in git. Skipped until Task 2.13 has made
the file; Task 4.4 checks that these tests run."""
import pytest

from gerry.config import REPO_ROOT
from gerry.validation import PLANSCORE_COLUMNS, planscore_comparison, read_crosscheck

PLANSCORE = REPO_ROOT / "data" / "crosscheck" / "planscore.csv"
pytestmark = pytest.mark.skipif(not PLANSCORE.exists(),
                                reason="data/crosscheck/planscore.csv does not exist yet; Task 2.13 makes it")


@pytest.fixture(scope="module")
def rows():
    return planscore_comparison(read_crosscheck(PLANSCORE, PLANSCORE_COLUMNS))


def test_at_least_three_states(rows):
    assert len({r["state"] for r in rows}) >= 3
    # the brief asks for three states whose PlanScore plan is our Enacted map
    assert len({r["state"] for r in rows if r["same_map"]}) >= 3


def _wasted_votes_gap(d, r):
    """Written out apart from gerry.metrics: the winner wastes the votes above half, the loser all."""
    import numpy as np
    d, r = np.asarray(d, dtype=float), np.asarray(r, dtype=float)
    half = (d + r) / 2
    return (np.where(d > r, d - half, d).sum() - np.where(d > r, r, r - half).sum()) / (d + r).sum()


def test_ours_on_planscore_votes_is_the_wasted_votes_gap(rows):
    # review of October 2026: an efficiency_gap that returned 0 passed the test below; it fails here
    for r in rows:
        dem = [v[0] for v in r["districts"].values()]
        rep = [v[1] for v in r["districts"].values()]
        assert r["reproduced"] == pytest.approx(_wasted_votes_gap(dem, rep), abs=1e-12), (r["state"], r["election"])


ENACTED = REPO_ROOT / "data" / "interim" / "enacted_districts.parquet"


@pytest.mark.skipif(not ENACTED.exists(), reason="run 02_join.py first")
def test_our_district_votes_match_planscore_on_the_same_map(rows):
    # our own votes of the same election on the enacted map: each district within 3% of PlanScore's, and our EG
    # on them within 0.1 point of our EG on PlanScore's votes (largest difference on 2026-10-17: 0.04 point)
    import pandas as pd
    enacted = pd.read_parquet(ENACTED)
    enacted = enacted[(enacted["map_id"] == "enacted") & (enacted["method"] == "block")]
    checked = 0
    for r in rows:
        year = "16" if "2016" in r["election"] else "20"
        if not r["same_map"]:
            continue
        ours = {str(int(k)): row for k, row in enacted[enacted["state"] == r["state"]].set_index("district").iterrows()}
        assert set(ours) == set(r["districts"]), r["state"]
        keys = sorted(ours)
        d = [ours[k][f"d_pre_{year}"] for k in keys]
        rep = [ours[k][f"r_pre_{year}"] for k in keys]
        ps_d = [r["districts"][k][0] for k in keys]
        ps_r = [r["districts"][k][1] for k in keys]
        largest = max(max(abs(a / b - 1) for a, b in zip(d, ps_d)), max(abs(a / b - 1) for a, b in zip(rep, ps_r)))
        assert largest <= 0.03, (r["state"], r["election"], largest)
        assert abs(_wasted_votes_gap(d, rep) - _wasted_votes_gap(ps_d, ps_r)) <= 0.001, (r["state"], r["election"])
        checked += 1
    assert checked >= 3  # the brief asks for at least three states


def test_efficiency_gap_reproduces_planscore(rows):
    misses = [(r["state"], r["election"], round(100 * r["planscore"], 2), round(100 * r["equal_turnout"], 3),
               round(100 * r["reproduced"], 3))
              for r in rows if abs(r["equal_turnout"] - r["planscore"]) > r["tolerance"] + 1e-12]
    # each miss: state, election, PlanScore, equal-turnout formula, ours (points)
    assert misses == []
