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


def test_efficiency_gap_reproduces_planscore(rows):
    misses = [(r["state"], r["election"], round(100 * r["planscore"], 2), round(100 * r["equal_turnout"], 3),
               round(100 * r["reproduced"], 3))
              for r in rows if abs(r["equal_turnout"] - r["planscore"]) > r["tolerance"] + 1e-12]
    # each miss: state, election, PlanScore, equal-turnout formula, ours (points)
    assert misses == []
