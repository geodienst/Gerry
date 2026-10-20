"""docs/validation.md: method checks and cross-checks, rebuilt on every run of 03_metrics.

An exceedance is open until data/validation_notes.yaml explains it for that state and
check. A cross-check file that does not exist yet is pending.

Input files (UTF-8, comma-separated, header row, every value read as text):
- data/crosscheck/planscore.csv, PLANSCORE_COLUMNS, one row per district. The plan-level
  columns (url, accessed, same_map, planscore_eg_pct, planscore_favors) repeat on every
  row of a state and election. planscore_eg_pct is the size exactly as PlanScore prints it
  ("4.2"), planscore_favors is "Republicans" or "Democrats", same_map is "yes" or "no".
- data/crosscheck/state_files.csv, STATE_FILES_COLUMNS, one row per compared map, written by
  tools/compare_state_files.py (Phase 3). source_kind is "block_file" or "shapes"; the
  blocks_* and only_* columns are block counts; one_to_one is "True" or "False".
- data/validation_notes.yaml: state postal code -> check name (CHECK_KEYS) -> explanation.
"""
from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from gerry.metrics import dem_wins, efficiency_gap

SHARE_TOLERANCE = 0.005       # 0.5 percentage point, as a fraction
EXPECTED_PLANS = 5000
CHECK_KEYS = ("cd118_vs_alarm", "whole_unit", "plans", "planscore_reproduction", "planscore", "planscore_votes",
              "state_files")
# PlanScore against our own district votes of the same election, on the same map:
PLANSCORE_VOTE_TOLERANCE = 0.03   # largest relative difference of a district's Democratic or Republican votes
PLANSCORE_EG_TOLERANCE = 0.001    # 0.1 point between our EG on our votes and our EG on PlanScore's votes
PLANSCORE_COLUMNS = ("state", "election", "url", "accessed", "same_map", "planscore_eg_pct",
                     "planscore_favors", "district", "dem_votes", "rep_votes")
# tools/compare_state_files.py (Phase 3) imports this tuple and writes state_files.csv with it.
STATE_FILES_COLUMNS = ("state", "map", "source_kind", "source_url", "retrieved", "blocks_census", "blocks_state",
                       "only_census", "only_state", "blocks_matching", "share_blocks", "share_vap",
                       "district_mapping", "one_to_one", "result")
_PLAN_LEVEL = ("url", "accessed", "same_map", "planscore_eg_pct", "planscore_favors")


def load_notes(path: Path) -> dict[tuple[str, str], str]:
    """{(state, check): explanation} from data/validation_notes.yaml (state -> check -> text)."""
    if not path.exists():
        return {}
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    notes = {}
    for state, checks in raw.items():
        if not isinstance(checks, dict):
            raise ValueError(f"{path}: {state} must map check names to explanations")
        for check, text in checks.items():
            if check not in CHECK_KEYS:
                raise ValueError(f"{path}: unknown check {check!r} for {state}; use one of {CHECK_KEYS}")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"{path}: empty explanation for {state} {check}")
            notes[(str(state), check)] = " ".join(text.split())
    return notes


def read_crosscheck(path: Path, columns: Sequence[str]) -> pd.DataFrame | None:
    """A cross-check CSV as text columns, or None when the file does not exist yet."""
    if not path.exists():
        return None
    df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")
    if list(df.columns) != list(columns):
        raise ValueError(f"{path}: columns {list(df.columns)}, expected {list(columns)}")
    return df.apply(lambda col: col.str.strip())


def equal_turnout_gap(d, r, dem_win) -> float:
    """EG with every district weighted equally: 2(V - 0.5) - (S - 0.5), positive favors
    Republicans. PlanScore's current code uses this form with the opposite sign."""
    d = np.asarray(d, dtype=float)
    r = np.asarray(r, dtype=float)
    vote_share = d.sum() / (d + r).sum()
    seat_share = float(np.mean(np.asarray(dem_win, dtype=bool)))
    return float(2 * (vote_share - 0.5) - (seat_share - 0.5))


def planscore_comparison(df: pd.DataFrame) -> list[dict]:
    """One dict per state and election: PlanScore's EG in our sign, the rounding tolerance of
    the printed value, and two EGs on PlanScore's district votes: ours (wasted votes) as
    "reproduced" and PlanScore's equal-turnout formula as "equal_turnout". The report judges
    "equal_turnout" against PlanScore."""
    out = []
    for (state, election), rows in df.groupby(["state", "election"], sort=False):
        for col in _PLAN_LEVEL:
            if rows[col].nunique() != 1:
                raise ValueError(f"planscore.csv: {state} {election} has more than one {col}")
        first = rows.iloc[0]
        if first["planscore_favors"] not in ("Republicans", "Democrats"):
            raise ValueError("planscore.csv: planscore_favors must be Republicans or Democrats, "
                             f"got {first['planscore_favors']!r}")
        if first["same_map"] not in ("yes", "no"):
            raise ValueError(f"planscore.csv: same_map must be yes or no, got {first['same_map']!r}")
        text = first["planscore_eg_pct"]
        decimals = len(text.split(".")[1]) if "." in text else 0
        sign = 1.0 if first["planscore_favors"] == "Republicans" else -1.0
        d = rows["dem_votes"].astype(float).to_numpy()
        r = rows["rep_votes"].astype(float).to_numpy()
        wins = dem_wins(d, r)
        out.append({
            "state": state, "election": election, "url": first["url"], "accessed": first["accessed"],
            "same_map": first["same_map"] == "yes",
            "planscore": sign * float(text) / 100,
            "tolerance": 0.5 * 10.0 ** -decimals / 100,
            "reproduced": efficiency_gap(d, r, wins),
            "equal_turnout": equal_turnout_gap(d, r, wins),
            "districts": {_district_key(k): (float(dv), float(rv))
                          for k, dv, rv in zip(rows["district"], d, r, strict=True)},
        })
    return out


def _district_key(value) -> str:
    """"01", "1" and 1 give "1", so PlanScore's numbers and ours meet."""
    text = str(value).strip()
    return str(int(text)) if text.isdigit() else text


def _year_of(election: str) -> str | None:
    """"16" or "20" for the presidential election of 2016 or 2020, else None."""
    if "president" not in election.lower():
        return None
    return next((year[2:] for year in ("2016", "2020") if year in election), None)


def vote_comparison(c: dict, ours: list[dict], state: dict, year: str) -> dict:
    """Our enacted district votes of one election against PlanScore's, for a plan that is our map.

    largest: the largest relative difference of a district's Democratic or Republican votes;
    eg: our wasted-votes EG on our own votes of that election; composite: our composite EG computed
    again from the district list in metrics.json, ties to the 2020 winner as in 03_metrics.
    matched is False when the district numbers differ."""
    by_key = {_district_key(row["district"]): row for row in ours}
    keys = sorted(c["districts"])
    if set(keys) != set(by_key):
        return {"matched": False, "largest": float("inf"), "eg": float("nan"), "composite": float("nan")}
    d = np.array([by_key[k][f"d_pre_{year}"] for k in keys], dtype=float)
    r = np.array([by_key[k][f"r_pre_{year}"] for k in keys], dtype=float)
    ps_d = np.array([c["districts"][k][0] for k in keys])
    ps_r = np.array([c["districts"][k][1] for k in keys])
    largest = float(max(np.max(np.abs(d / ps_d - 1)), np.max(np.abs(r / ps_r - 1))))
    rows = state["districts"]
    cd = np.array([x["d"] for x in rows], dtype=float)
    cr = np.array([x["r"] for x in rows], dtype=float)
    d20 = np.array([by_key[_district_key(x["id"][2:])]["d_pre_20"] for x in rows], dtype=float)
    r20 = np.array([by_key[_district_key(x["id"][2:])]["r_pre_20"] for x in rows], dtype=float)
    return {"matched": True, "largest": largest, "eg": efficiency_gap(d, r, dem_wins(d, r)),
            "composite": efficiency_gap(cd, cr, dem_wins(cd, cr, d20, r20))}


class _Ledger:
    """Tracks open, explained and pending items while the report is built."""

    def __init__(self, notes: dict[tuple[str, str], str]):
        self.notes = notes
        self.used: set[tuple[str, str]] = set()
        self.open: list[str] = []
        self.pending: list[str] = []

    def judge(self, state: str, check: str, ok: bool, what: str) -> str:
        if ok:
            return "ok"
        if (state, check) in self.notes:
            self.used.add((state, check))
            return "explained"
        self.open.append(f"{state} {check}: {what}")
        return "open"


def _cell(value) -> str:
    return str(value).replace("|", "\\|")


def _table(headers: Sequence[str], rows: Sequence[Sequence]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(_cell(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def _pct(x: float) -> str:
    return f"{100 * x:.2f}%"


def _pts(x: float) -> str:
    return f"{100 * x:.3f}"


def _eg(x: float) -> str:
    return f"{100 * x:+.2f}"


def _seat_totals(metrics: dict) -> str:
    nat = metrics["national"]
    at_large = [s["postal"] for s in nat["single_seat"]]
    n = nat["seats"]
    rows = [(label, value, n - value) for label, value in
            (("Proportional", nat["proportional"]), ("Neutral baseline (median)", nat["neutral"]["median"]),
             ("Enacted", nat["enacted"]))]
    return "\n\n".join([
        "## Seat totals",
        f"District seats: {n} in {len(metrics['states'])} states. At-large seats: {len(at_large)} "
        f"({', '.join(at_large)}). Together: {n + len(at_large)}.",
        _table(["Scenario", "Democratic seats", "Other seats"], rows),
    ])


def _cd118(metrics: dict, ledger: _Ledger) -> str:
    rows, details = [], []
    for state, chk in sorted(metrics["checks"]["cd118_vs_alarm"].items()):
        diffs = [abs(d["ours"] - d["alarm"]) for d in chk["districts"]]
        worst = max(diffs)
        ok = worst <= SHARE_TOLERANCE + 1e-12 and chk["seats_ours"] == chk["seats_alarm"]
        what = f"largest difference {_pts(worst)} points, D seats {chk['seats_ours']} against {chk['seats_alarm']}"
        status = ledger.judge(state, "cd118_vs_alarm", ok, what)
        rows.append((state, len(diffs), _pts(worst), chk["seats_ours"], chk["seats_alarm"], status))
        details += [(state, d["district"], _pct(d["ours"]), _pct(d["alarm"]), _pts(abs(d["ours"] - d["alarm"])))
                    for d in chk["districts"] if abs(d["ours"] - d["alarm"]) > SHARE_TOLERANCE + 1e-12]
    parts = [
        "## CD118 maps against ALARM cd_2020",
        "Our block allocation on the 2022 maps (Census CD118) against ALARM's reference plan `cd_2020`, "
        "same vote basis. Threshold: at most 0.5 points per district and the same number of Democratic seats.",
        _table(["State", "Districts", "Largest difference (points)", "D seats, ours", "D seats, ALARM", "Status"],
               rows),
    ]
    if details:
        parts += ["Districts above the threshold:",
                  _table(["State", "District", "Ours", "ALARM", "Difference (points)"], details)]
    return "\n\n".join(parts)


def _whole_unit(metrics: dict, ledger: _Ledger) -> str:
    rows = []
    for state, items in sorted(metrics["checks"]["whole_unit"].items()):
        for map_id in dict.fromkeys(i["map_id"] for i in items):
            sub = [i for i in items if i["map_id"] == map_id]
            worst = max(abs(i["block"] - i["whole"]) for i in sub)
            flipped = [i["district"] for i in sub if i["block_dem"] != i["whole_dem"]]
            if len(flipped) == 1:
                what = f"{map_id} district {flipped[0]} has another winner"
            else:
                what = f"{map_id} districts {', '.join(flipped)} have another winner"
            status = ledger.judge(state, "whole_unit", not flipped, what)
            rows.append((state, map_id, _pts(worst), ", ".join(flipped) or "none", status))
    return "\n\n".join([
        "## Whole-unit assignment against block allocation",
        "Each unit assigned whole to the district with most of its voting-age population, against the "
        "block allocation used for the numbers on the site: the enacted map, a blocked map and the map of the "
        "2024 election. A district with another winner is open until explained.",
        _table(["State", "Map", "Largest difference (points)", "Districts with another winner", "Status"], rows),
    ])


def _maps_2024(metrics: dict) -> str:
    rows = [(state, m["districts"], m["changed_blocks"], m["seats_2024"], m["seats_enacted"])
            for state, m in sorted(metrics["checks"]["map_2024"].items())]
    return "\n\n".join([
        "## Maps of the 2024 election",
        "The maps used in November 2024 (Census CD119), with the same votes and the same checks as the other "
        "maps. 02_join.py stops unless every unit with votes lies in a district, the votes add up to the state "
        "totals and the map has the state's number of districts. The whole-unit check above covers these maps "
        "too. The third column counts the blocks that lie in another district on the enacted map.",
        _table(["State", "Districts", "Blocks in another district now", "D seats, 2024 map", "D seats, enacted map"],
               rows),
    ])


def _plans_and_ties(metrics: dict, ledger: _Ledger) -> str:
    rows = []
    for state, plans in sorted(metrics["checks"]["plans"].items()):
        ties = metrics["checks"]["ties"][state]
        status = ledger.judge(state, "plans", plans == EXPECTED_PLANS, f"{plans} plans, expected {EXPECTED_PLANS}")
        rows.append((state, plans, ties["ensemble"], ties["enacted"], status))
    return "\n\n".join([
        "## Plans and ties",
        "Ties are districts where D equals R in the composite; the 2020 result decided them.",
        _table(["State", "Plans", "Ties in plans", "Ties in maps", "Status"], rows),
    ])


def _log_value(value) -> str:
    """A join-log count as table text: votes (floats) with one decimal, whole numbers as they are."""
    return f"{value:.1f}" if isinstance(value, float) else str(value)


def _join_log(metrics: dict) -> str:
    log = metrics["checks"]["join_log"]
    # counts per state: every whole-number field (units, blocks, unlinked_blocks, plans, ...)
    keys = list(dict.fromkeys(k for entry in log.values() for k, val in entry.items()
                              if isinstance(val, int) and not isinstance(val, bool)))
    rows = [(state, *[entry.get(k, "") for k in keys],
             _pct(entry["reference_share"]) if "reference_share" in entry else "")
            for state, entry in sorted(log.items())]
    # per-map counts: {"maps": {map_id: {count: value}}}; block_count_votes is a number of votes
    map_keys = list(dict.fromkeys(k for entry in log.values() for counts in entry.get("maps", {}).values()
                                  for k in counts))
    map_rows = [(state, map_id, *[_log_value(counts.get(k, "")) for k in map_keys])
                for state, entry in sorted(log.items()) for map_id, counts in entry.get("maps", {}).items()]
    relabeled = [f"- {state}: " + ", ".join(f"{k} -> {v}" for k, v in sorted(entry["reference_labels"].items()))
                 for state, entry in sorted(log.items()) if entry.get("reference_labels")]
    parts = ["## Join log",
             "Counts from 02_join.py. `unlinked_blocks` are census blocks whose unit is not in ALARM's map.rds "
             "(water); they have no voting-age population and no people. `reference_share` is the share of the "
             "population with the same district on ALARM's reference plan and on the 2022 map (Census CD118)."]
    if keys:
        parts.append(_table(["State", *keys, "reference_share"], rows))
    if map_rows:
        parts += ["Counts per map (block allocation). `block_count_votes` are the votes of split units without "
                  "voting-age population, spread over their blocks by block count.",
                  _table(["State", "Map", *map_keys], map_rows)]
    parts += ["ALARM's `cd_2020` districts that take the label of the matching district in map.rds:",
              "\n".join(relabeled) if relabeled else "None."]
    return "\n\n".join(parts)


def _planscore(metrics: dict, crosscheck_dir: Path, ledger: _Ledger) -> str:
    head = ["## PlanScore",
            "EG in percentage points, positive favors Republicans. PlanScore's own sign is the opposite; "
            "the CSV records the size and the party PlanScore names. \"Equal-turnout formula\" is PlanScore's "
            "own formula on its own district votes; it must match PlanScore to the rounding of its printed "
            "value. \"Ours on PlanScore's votes\" is our wasted-votes EG on the same votes; the two differ "
            "when turnout differs between districts. \"Ours on our votes\" is our wasted-votes EG on our own "
            "district votes of the same election. When the plan is our enacted map, column \"Votes\" requires "
            f"that no district's Democratic or Republican votes differ from PlanScore's by more than "
            f"{PLANSCORE_VOTE_TOLERANCE:.0%}, that ours on our votes lies within {100 * PLANSCORE_EG_TOLERANCE:.1f} "
            "point of ours on PlanScore's votes, and that our composite follows from our district votes. "
            "The composite adds 2016 and 2020, so it differs from PlanScore's single elections by design; "
            "column \"Composite\" needs an explanation."]
    df = read_crosscheck(crosscheck_dir / "planscore.csv", PLANSCORE_COLUMNS)
    if df is None:
        ledger.pending.append("data/crosscheck/planscore.csv not found")
        return "\n\n".join(head + ["Pending: data/crosscheck/planscore.csv not found."])
    votes_all = metrics.get("checks", {}).get("district_votes", {})
    rows = []
    for c in planscore_comparison(df):
        state = c["state"]
        if state not in metrics["states"]:
            raise ValueError(f"planscore.csv: {state} is not a state in metrics.json")
        repro_ok = abs(c["equal_turnout"] - c["planscore"]) <= c["tolerance"] + 1e-12
        repro = ledger.judge(state, "planscore_reproduction", repro_ok,
                             f"PlanScore {_eg(c['planscore'])}, equal-turnout formula {_eg(c['equal_turnout'])}")
        ours = metrics["states"][state]["eg"]["value"]
        year = _year_of(c["election"])
        on_ours, largest = "", ""
        if not c["same_map"]:
            votes = "different map"
        elif year is None:
            votes = "not 2016 or 2020"
        elif state not in votes_all or "districts" not in metrics["states"][state]:
            ledger.pending.append(f"{state} {c['election']}: our district votes are not in metrics.json")
            votes = "pending"
        else:
            cmp = vote_comparison(c, votes_all[state], metrics["states"][state], year)
            ok = (cmp["matched"] and cmp["largest"] <= PLANSCORE_VOTE_TOLERANCE
                  and abs(cmp["eg"] - c["reproduced"]) <= PLANSCORE_EG_TOLERANCE + 1e-12
                  and abs(cmp["composite"] - ours) <= 1e-9)
            what = (f"{c['election']}: districts do not match PlanScore's" if not cmp["matched"] else
                    f"{c['election']}: largest district vote difference {cmp['largest']:.2%}, our EG on our votes "
                    f"{_eg(cmp['eg'])} against {_eg(c['reproduced'])} on PlanScore's, our composite {_eg(ours)} "
                    f"against {_eg(cmp['composite'])} from our district votes")
            votes = ledger.judge(state, "planscore_votes", ok, what)
            if cmp["matched"]:
                on_ours, largest = _eg(cmp["eg"]), f"{cmp['largest']:.2%}"
        composite = ledger.judge(state, "planscore", False,
                                 f"PlanScore {_eg(c['planscore'])}, our composite {_eg(ours)}")
        rows.append((state, c["election"], _eg(c["planscore"]), _eg(c["reproduced"]), _eg(c["equal_turnout"]),
                     repro, on_ours, largest, votes, _eg(ours), "yes" if c["same_map"] else "no", composite,
                     f"{c['url']} ({c['accessed']})"))
    return "\n\n".join(head + [_table(
        ["State", "Election", "PlanScore", "Ours on PlanScore's votes", "Equal-turnout formula", "Reproduced",
         "Ours on our votes", "Largest district difference", "Votes", "Our composite, enacted map", "Same map",
         "Composite", "Source"], rows)])


def _runs(metrics: dict) -> str:
    """ALARM's separate runs per state and for the nation. For information."""
    head = ["## ALARM runs",
            "ALARM draws the neutral maps of each state in two or four separate runs (chains). The table lists the "
            "states where a run has another median of Democratic seats than all runs together, with the median and "
            "the 5th to 95th percentile per run. Under it, the nation on the first and on the second half of each "
            "state's runs. For information: nothing here is judged."]
    checks = metrics.get("checks", {})
    runs = checks.get("runs")
    if not runs:
        return "\n\n".join(head + ["Not in metrics.json."])
    rows = []
    for postal in sorted(runs):
        median = metrics["states"][postal]["neutral"]["median"]
        chains = runs[postal]["chains"]
        if any(c["median"] != median for c in chains.values()):
            per_run = (f"run {k}: {c['median']} ({c['p5']} to {c['p95']}, {c['plans']} plans)"
                       for k, c in sorted(chains.items(), key=lambda kv: int(kv[0])))
            rows.append((postal, median, "; ".join(per_run)))
    table = (_table(["State", "All runs", "Per run"], rows) if rows
             else "Every run gives the same median in every state.")
    nat = metrics["national"]["neutral"]
    halves = checks.get("runs_national", [])
    nation = _table(["Plans", "Median", "5th percentile", "95th percentile"],
                    [("All runs", nat["median"], nat.get("p5", ""), nat.get("p95", ""))]
                    + [(f"Half {i + 1} of the runs", h["median"], h["p5"], h["p95"]) for i, h in enumerate(halves)])
    return "\n\n".join(head + [table, "District seats of the nation, without the six single-seat states:", nation])


def _dra_not_used() -> str:
    """The DRA section, a fixed text: DRA is not used, as its terms of use forbid automated access, so nothing
    here is open or pending, and a dra.csv in data/crosscheck/ is ignored."""
    return "\n\n".join([
        "## Dave's Redistricting App",
        "Not used. DRA's terms of use, updated July 31, 2026, do not allow automated access to the site, or copying "
        "material from it without prior written consent. This report therefore has no comparison with DRA. The "
        "comparison with an outside source is the PlanScore section above.",
    ])


def _state_files(crosscheck_dir: Path, ledger: _Ledger) -> str:
    head = ["## CD120 against state files",
            "From tools/compare_state_files.py. `block_file`: the state's block file, block for block; "
            "`shapes`: block internal points in the state's district shapes. District numbers are matched "
            "by largest overlap first. In order when every CD120 block lies in the matching district, no "
            "block is only in the state source, and the matching is one-to-one."]
    df = read_crosscheck(crosscheck_dir / "state_files.csv", STATE_FILES_COLUMNS)
    if df is None:
        ledger.pending.append("data/crosscheck/state_files.csv not found")
        return "\n\n".join(head + ["Pending: data/crosscheck/state_files.csv not found."])
    rows = []
    for row in df.sort_values("state").itertuples(index=False):
        if row.source_kind not in ("block_file", "shapes"):
            raise ValueError(f"state_files.csv: source_kind must be block_file or shapes, got {row.source_kind!r}")
        if row.one_to_one not in ("True", "False"):
            raise ValueError(f"state_files.csv: one_to_one must be True or False, got {row.one_to_one!r}")
        census, matching, only_state = int(row.blocks_census), int(row.blocks_matching), int(row.only_state)
        one_to_one = row.one_to_one == "True"
        what = (f"{census - matching} of {census} blocks outside the matching district, "
                f"{only_state} only in the state source")
        if not one_to_one:
            what += ", district matching not one-to-one"
        status = ledger.judge(row.state, "state_files", matching == census and only_state == 0 and one_to_one, what)
        rows.append((row.state, row.map, row.source_kind, census, census - matching, only_state, row.result,
                     status, f"{row.source_url} ({row.retrieved})"))
    return "\n\n".join(head + [_table(
        ["State", "Map", "Source", "CD120 blocks", "Outside matching district", "Only in state source",
         "Result", "Status", "Link"], rows)])


def build_report(metrics: dict, crosscheck_dir: Path, notes_path: Path) -> str:
    """The full text of docs/validation.md."""
    ledger = _Ledger(load_notes(notes_path))
    sections = [
        _seat_totals(metrics),
        _cd118(metrics, ledger),
        _whole_unit(metrics, ledger),
        _maps_2024(metrics),
        _plans_and_ties(metrics, ledger),
        _runs(metrics),
        _join_log(metrics),
        _planscore(metrics, crosscheck_dir, ledger),
        _dra_not_used(),
        _state_files(crosscheck_dir, ledger),
    ]
    used = [f"- **{s}, {c}.** {ledger.notes[(s, c)]}" for s, c in sorted(ledger.used)]
    unused = [f"- **{s}, {c}.** {t}" for (s, c), t in sorted(ledger.notes.items()) if (s, c) not in ledger.used]
    sections.append("## Explanations\n\n" + ("\n".join(used) if used else "None."))
    sections.append("## Explanations without an exceedance\n\nThese notes match nothing in this run. "
                    "Remove them or check the state and check name.\n\n" + ("\n".join(unused) if unused else "None."))
    summary = [
        "# Validation report",
        "Generated by `pipeline/03_metrics.py` from `data/interim/metrics.json`, `data/crosscheck/` and "
        "`data/validation_notes.yaml`. Do not edit by hand.",
        "Shares are Democratic two-party shares. Differences are in percentage points. An exceedance stays "
        "open until `data/validation_notes.yaml` explains it.",
        f"**Open items: {len(ledger.open)}.** Pending: {len(ledger.pending)}.",
    ]
    if ledger.open:
        summary.append("\n".join(f"- {item}" for item in ledger.open))
    if ledger.pending:
        summary.append("Pending:\n\n" + "\n".join(f"- {item}" for item in ledger.pending))
    return "\n\n".join(summary + sections) + "\n"
