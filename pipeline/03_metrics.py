"""Step 3: seats, neutral baseline, EG and MM per state and for the nation.

Reads data/interim/ (written by 02_join.py), pipeline/config.yaml, data/crosscheck/ and
data/validation_notes.yaml. Writes data/interim/metrics.json and docs/validation.md.
Run from the repo root: python pipeline/03_metrics.py
"""
from __future__ import annotations

import json
from typing import Mapping

import numpy as np
import pandas as pd

from gerry.checks import CheckError
from gerry.config import REPO_ROOT, AtLargeState, StateConfig, interim_dir, load_config
from gerry.metrics import (MAX_SWING_STEPS, SWING_GRID, SwingRangeError, TieError, competitive, convolve,
                           dem_wins, distribution, effects, efficiency_gap, enacted_threshold, is_narrow,
                           largest_remainder, linear_band, mean_median, neutral_threshold, outside_band,
                           pmf_percentile, pmf_position, position, proportional_threshold, sample_percentile,
                           seats_by_plan, sorted_band)
from gerry.validation import build_report

HOUSE_SEATS = 435
HOUSE_MAJORITY = 218
# Owner decision 1 (extensions design, chapter 6): each single-seat state goes to the party that won it in
# both the 2016 and the 2020 presidential election.
SINGLE_SEAT_PARTY = {"AK": "R", "DE": "D", "ND": "R", "SD": "R", "VT": "D", "WY": "R"}
WIN_COLS = ["d", "r", "d_pre_20", "r_pre_20"]


def district_wins(rows: pd.DataFrame, label: str) -> np.ndarray:
    """dem_wins() on district rows; a double tie names the map and the district."""
    try:
        return dem_wins(rows["d"], rows["r"], rows["d_pre_20"], rows["r_pre_20"])
    except TieError as err:
        where = ", ".join(f"district {rows['district'].iloc[p]}" for p in err.positions)
        raise TieError(f"{label}, {where}: {err}", err.positions) from err


def map_rows(enacted: pd.DataFrame, map_id: str, method: str = "block") -> pd.DataFrame:
    rows = enacted[(enacted["map_id"] == map_id) & (enacted["method"] == method)]
    return rows.sort_values("district").reset_index(drop=True)


def map_result(rows: pd.DataFrame, st: StateConfig, map_id: str) -> dict:
    """Seats, shares and the district list of one map."""
    if len(rows) != st.seats or rows["district"].duplicated().any():
        raise CheckError("district_count", st.postal,
                         f"{map_id}: {len(rows)} district rows, expected {st.seats} distinct districts")
    wins = district_wins(rows, f"{st.postal} {map_id}")
    d = rows["d"].to_numpy(dtype=float)
    r = rows["r"].to_numpy(dtype=float)
    shares = d / (d + r)
    districts = [{"id": st.fips + district, "share": float(share), "d": float(dv), "r": float(rv)}
                 for district, share, dv, rv in zip(rows["district"], shares, d, r)]
    return {"enacted": int(wins.sum()), "districts": districts, "shares": shares, "wins": wins, "d": d, "r": r}


def plan_matrices(ensemble: pd.DataFrame, st: StateConfig) -> dict[str, np.ndarray]:
    """Plans as rows, districts as columns, one matrix per vote column in WIN_COLS."""
    wide = ensemble.pivot(index="draw", columns="district", values=WIN_COLS)
    if wide.isna().to_numpy().any() or wide.shape[1] != len(WIN_COLS) * st.seats:
        raise CheckError("plan_structure", st.postal,
                         f"plans do not all have districts 01..{st.seats:02d} with votes")
    return {col: wide[col].sort_index(axis=1).to_numpy(dtype=float) for col in WIN_COLS}


def state_metrics(st: StateConfig, d_total: float, r_total: float,
                  enacted: pd.DataFrame, ensemble: pd.DataFrame) -> dict:
    """All numbers for one state. enacted and ensemble hold this state's rows only."""
    proportional = largest_remainder(d_total, r_total, st.seats)
    main = map_result(map_rows(enacted, "enacted"), st, "enacted")

    samples = seats_by_plan(ensemble).to_numpy()
    dist = distribution(samples, st.seats)
    median = sample_percentile(samples, 50)
    p5 = sample_percentile(samples, 5)
    p95 = sample_percentile(samples, 95)

    mats = plan_matrices(ensemble, st)
    d, r = mats["d"], mats["r"]
    wins = dem_wins(d.ravel(), r.ravel(), mats["d_pre_20"].ravel(), mats["r_pre_20"].ravel()).reshape(d.shape)
    shares = d / (d + r)
    eg_plans = [efficiency_gap(d[i], r[i], wins[i]) for i in range(len(d))]
    eg = {"value": efficiency_gap(main["d"], main["r"], main["wins"]), **linear_band(eg_plans)}
    mm = None
    if st.seats >= 3:
        mm = {"value": mean_median(main["shares"]), **linear_band([mean_median(row) for row in shares])}

    result = {
        "d_share": d_total / (d_total + r_total),
        "proportional": proportional,
        "enacted": main["enacted"],
        "neutral": {"median": median, "p5": p5, "p95": p95, "dist": [int(n) for n in dist]},
        "position": position(samples, main["enacted"]),
        "effects": effects(proportional, median, main["enacted"]),
        "outside_band": outside_band(main["enacted"], p5, p95),
        "eg": eg,
        "mm": mm,
        "districts": main["districts"],
        "sorted": {"enacted": sorted(float(s) for s in main["shares"]), **sorted_band(shares)},
    }
    blocked = [m for m in st.extra_maps if m.status == "Blocked"]
    if len(blocked) > 1:
        raise CheckError("blocked_map", st.postal, "results.json holds one blocked map per state")
    if blocked:
        extra = map_result(map_rows(enacted, blocked[0].id), st, blocked[0].id)
        result["blocked_map"] = {"enacted": extra["enacted"], "districts": extra["districts"],
                                 "position": position(samples, extra["enacted"])}
    result["computed_notes"] = ["narrow_ensemble"] if is_narrow(dist) else []
    return result


def plan_shares(ensemble: pd.DataFrame, st: StateConfig) -> np.ndarray:
    """Democratic share per plan (rows) and district (columns, 01 first)."""
    mats = plan_matrices(ensemble, st)
    return mats["d"] / (mats["d"] + mats["r"])


def state_competitive(st: StateConfig, enacted: pd.DataFrame, ensemble: pd.DataFrame) -> dict:
    """Competitive districts (45% to 55%) on the enacted map and over the plans (extensions design, ch. 3)."""
    main = map_result(map_rows(enacted, "enacted"), st, "enacted")
    counts = competitive(plan_shares(ensemble, st))
    return {
        "enacted": int(competitive(main["shares"])),
        "median": sample_percentile(counts, 50),
        "p5": sample_percentile(counts, 5),
        "p95": sample_percentile(counts, 95),
        "neutral_dist": [int(n) for n in distribution(counts, st.seats)],
    }


def state_redraw(st: StateConfig, enacted: pd.DataFrame, enacted_seats: int, changed_blocks: int) -> dict:
    """Democratic seats on the map of the 2024 election with the same votes, and the change to the enacted
    map (extensions design, ch. 2). changed_blocks comes from join_log.json (02_join.py)."""
    seats_2024 = map_result(map_rows(enacted, "map_2024"), st, "map_2024")["enacted"]
    if changed_blocks == 0 and seats_2024 != enacted_seats:
        raise CheckError("redraw", st.postal, f"no block changed district since 2024, yet the 2024 map gives "
                                              f"{seats_2024} seats and the enacted map {enacted_seats}")
    return {"seats_2024": seats_2024, "change": enacted_seats - seats_2024, "map_changed": changed_blocks > 0}


def _shares(rows: pd.DataFrame) -> np.ndarray:
    return (rows["d"] / (rows["d"] + rows["r"])).to_numpy(dtype=float)


def state_checks(st: StateConfig, enacted: pd.DataFrame, ensemble: pd.DataFrame,
                 reference: pd.DataFrame) -> dict:
    """Numbers for docs/validation.md: plans, ties, CD118 against ALARM cd_2020 and
    whole units against block allocation."""
    ours = map_rows(enacted, "check_2022")
    alarm = reference.sort_values("district").reset_index(drop=True)
    if len(ours) != st.seats or ours["district"].tolist() != alarm["district"].tolist():
        raise CheckError("cd118_vs_alarm", st.postal,
                         f"districts differ: ours {ours['district'].tolist()}, ALARM {alarm['district'].tolist()}")
    reference_check = {
        "districts": [{"district": dist, "ours": float(a), "alarm": float(b)}
                      for dist, a, b in zip(ours["district"], _shares(ours), _shares(alarm))],
        "seats_ours": int(district_wins(ours, f"{st.postal} check_2022").sum()),
        "seats_alarm": int(district_wins(alarm, f"{st.postal} ALARM cd_2020").sum()),
    }

    whole_unit = []
    for map_id in ["enacted", *(m.id for m in st.extra_maps), "map_2024"]:
        block = map_rows(enacted, map_id, "block")
        whole = map_rows(enacted, map_id, "whole_unit")
        if len(block) != st.seats or block["district"].tolist() != whole["district"].tolist():
            raise CheckError("whole_unit", st.postal, f"{map_id}: block and whole-unit districts differ")
        block_wins = district_wins(block, f"{st.postal} {map_id} block")
        whole_wins = district_wins(whole, f"{st.postal} {map_id} whole_unit")
        for i, (b_share, w_share) in enumerate(zip(_shares(block), _shares(whole))):
            whole_unit.append({"map_id": map_id, "district": block["district"].iloc[i],
                               "block": float(b_share), "whole": float(w_share),
                               "block_dem": bool(block_wins[i]), "whole_dem": bool(whole_wins[i])})

    return {
        "plans": int(ensemble["draw"].nunique()),
        "ties": {"ensemble": int((ensemble["d"] == ensemble["r"]).sum()),
                 "enacted": int((enacted["d"] == enacted["r"]).sum())},
        "cd118_vs_alarm": reference_check,
        "whole_unit": whole_unit,
    }


def national_metrics(states: Mapping[str, dict], at_large: Mapping[str, AtLargeState]) -> dict:
    """Sums over states and the convolved neutral distribution (states independent)."""
    seats = sum(len(s["neutral"]["dist"]) - 1 for s in states.values())
    if seats + len(at_large) != HOUSE_SEATS:
        raise CheckError("house_total", "US",
                         f"{seats} district seats plus {len(at_large)} at-large seats, expected {HOUSE_SEATS}")
    proportional = sum(s["proportional"] for s in states.values())
    enacted = sum(s["enacted"] for s in states.values())
    pmf = convolve([np.asarray(s["neutral"]["dist"]) for s in states.values()])
    median = pmf_percentile(pmf, 50)
    p5 = pmf_percentile(pmf, 5)
    p95 = pmf_percentile(pmf, 95)
    return {
        "seats": seats,
        "proportional": proportional,
        "enacted": enacted,
        "neutral": {"median": median, "p5": p5, "p95": p95, "dist": [float(p) for p in pmf]},
        "position": pmf_position(pmf, enacted),
        "effects": effects(proportional, median, enacted),
        "outside_band": outside_band(enacted, p5, p95),
        "single_seat": [{"postal": a.postal, "fips": a.fips, "name": a.name}
                        for a in sorted(at_large.values(), key=lambda a: a.postal)],
    }


def seats_needed(at_large: Mapping[str, AtLargeState]) -> int:
    """Districts Democrats need for a House majority: 218 minus the single-seat states fixed as Democratic."""
    if set(at_large) != set(SINGLE_SEAT_PARTY):
        raise CheckError("single_seat_party", "US", f"config.yaml has single-seat states {sorted(at_large)}, "
                                                    f"03_metrics.py fixes {sorted(SINGLE_SEAT_PARTY)}")
    return HOUSE_MAJORITY - sum(1 for postal in at_large if SINGLE_SEAT_PARTY[postal] == "D")


def national_majority(*, base_share: float, needed: int, enacted_shares, plan_shares, state_shares,
                      state_seats, seats_at_base: int, neutral_pmf) -> dict:
    """The national two-party share Democrats need for `needed` districts under a uniform swing (extensions
    design, ch. 1): exact for the enacted maps; on the grid of 0.01 point for the neutral maps (half of the
    outcomes, and 5% and 95%) and for proportional seats. Stops when a threshold lies 5 points or more from
    base_share, so the fixed result of the single-seat states still holds."""
    enacted = enacted_threshold(enacted_shares, needed)
    if abs(enacted) > MAX_SWING_STEPS / SWING_GRID:
        raise CheckError("majority_threshold", "US", f"enacted maps: Democrats need {base_share + enacted:.4f}, "
                                                     f"more than 5 points from {base_share:.4f}")
    try:
        low, middle, high = [neutral_threshold(plan_shares, needed, q) for q in (0.05, 0.5, 0.95)]
    except SwingRangeError as err:
        raise CheckError("majority_threshold", "US", f"neutral maps: {err}, 5 points or more from "
                                                     f"{base_share:.4f}") from err
    try:
        proportional = proportional_threshold(state_shares, state_seats, needed)
    except SwingRangeError as err:
        raise CheckError("majority_threshold", "US", f"proportional seats: {err}, 5 points or more from "
                                                     f"{base_share:.4f}") from err
    return {
        "seats_needed": needed,
        "base_share": base_share,
        "enacted": {"share": base_share + enacted, "seats_at_base": seats_at_base},
        "neutral": {"share": base_share + middle, "low": base_share + low, "high": base_share + high,
                    "probability_at_base": float(np.sum(np.asarray(neutral_pmf, dtype=float)[needed:]))},
        "proportional": {"share": base_share + proportional},
    }


def national_competitive(states: Mapping[str, dict]) -> dict:
    """Competitive districts for the nation: the sum over the enacted maps, and the convolution of the
    states' plan distributions (states independent, as for the seats)."""
    pmf = convolve([np.asarray(s["competitive"]["neutral_dist"]) for s in states.values()])
    return {
        "enacted": sum(s["competitive"]["enacted"] for s in states.values()),
        "median": pmf_percentile(pmf, 50),
        "p5": pmf_percentile(pmf, 5),
        "p95": pmf_percentile(pmf, 95),
        "neutral_dist": [float(p) for p in pmf],
    }


def national_redraw(states: Mapping[str, dict]) -> dict:
    """Democratic seats on the maps of the 2024 election, and the net change to the enacted maps."""
    seats_2024 = sum(s["redraw"]["seats_2024"] for s in states.values())
    return {"seats_2024": seats_2024, "change": sum(s["enacted"] for s in states.values()) - seats_2024}


def compute(cfg, idir) -> dict:
    enacted_all = pd.read_parquet(idir / "enacted_districts.parquet")
    ensemble_all = pd.read_parquet(idir / "ensemble_districts.parquet")
    reference_all = pd.read_parquet(idir / "alarm_reference.parquet")
    join_log = json.loads((idir / "join_log.json").read_text(encoding="utf-8"))

    states = {}
    checks = {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "map_2024": {}, "join_log": join_log}
    # inputs of the majority thresholds, one entry per state
    votes = {"d": 0.0, "r": 0.0, "enacted_shares": [], "plan_shares": [], "state_shares": [], "state_seats": []}
    for postal in sorted(cfg.states):
        st = cfg.states[postal]
        enacted = enacted_all[enacted_all["state"] == postal]
        ensemble = ensemble_all[ensemble_all["state"] == postal]
        reference = reference_all[reference_all["state"] == postal]
        if enacted.empty or ensemble.empty or reference.empty:
            raise CheckError("interim_files", postal, "state missing from the interim Parquet files")
        units = pd.read_parquet(idir / "units" / f"{postal}.parquet", columns=["d", "r"])
        d_total, r_total = float(units["d"].sum()), float(units["r"].sum())
        states[postal] = state_metrics(st, d_total, r_total, enacted, ensemble)
        votes["d"] += d_total
        votes["r"] += r_total
        votes["enacted_shares"].append(_shares(map_rows(enacted, "enacted")))
        votes["plan_shares"].append(plan_shares(ensemble, st))
        votes["state_shares"].append(d_total / (d_total + r_total))
        votes["state_seats"].append(st.seats)
        changed = join_log.get(postal, {}).get("map_2024_changed_blocks")
        if changed is None:
            raise CheckError("interim_files", postal, "join_log.json has no map_2024_changed_blocks; "
                                                      "run pipeline/02_join.py again")
        states[postal]["competitive"] = state_competitive(st, enacted, ensemble)
        states[postal]["redraw"] = state_redraw(st, enacted, states[postal]["enacted"], changed)
        for key, value in state_checks(st, enacted, ensemble, reference).items():
            checks[key][postal] = value
        # docs/validation.md: one row per state for the map of the 2024 election
        checks["map_2024"][postal] = {"districts": len(map_rows(enacted, "map_2024")), "changed_blocks": changed,
                                      "seats_2024": states[postal]["redraw"]["seats_2024"],
                                      "seats_enacted": states[postal]["enacted"]}
        s = states[postal]
        print(f"{postal}: proportional {s['proportional']}, neutral {s['neutral']['median']} "
              f"({s['neutral']['p5']}-{s['neutral']['p95']}), enacted {s['enacted']}")
    national = national_metrics(states, cfg.at_large)
    checks["totals"] = {"district_seats": national["seats"], "at_large": len(cfg.at_large)}
    print(f"US: proportional {national['proportional']}, neutral {national['neutral']['median']} "
          f"({national['neutral']['p5']}-{national['neutral']['p95']}), enacted {national['enacted']}")
    national["majority"] = national_majority(
        base_share=votes["d"] / (votes["d"] + votes["r"]), needed=seats_needed(cfg.at_large),
        enacted_shares=np.concatenate(votes["enacted_shares"]), plan_shares=votes["plan_shares"],
        state_shares=votes["state_shares"], state_seats=votes["state_seats"],
        seats_at_base=national["enacted"], neutral_pmf=national["neutral"]["dist"])
    national["competitive"] = national_competitive(states)
    national["redraw"] = national_redraw(states)
    maj, comp, red = national["majority"], national["competitive"], national["redraw"]
    print(f"US majority: {maj['seats_needed']} of {national['seats']} districts; Democrats have "
          f"{maj['base_share']:.4f} and need {maj['enacted']['share']:.4f} (enacted), {maj['neutral']['share']:.4f} "
          f"({maj['neutral']['low']:.4f}-{maj['neutral']['high']:.4f}, neutral), {maj['proportional']['share']:.4f} "
          f"(proportional); at {maj['base_share']:.4f}: {maj['enacted']['seats_at_base']} districts enacted, "
          f"{maj['neutral']['probability_at_base']:.4f} of neutral outcomes with a majority")
    print(f"US competitive (45 to 55%): enacted {comp['enacted']}, neutral {comp['median']} "
          f"({comp['p5']}-{comp['p95']})")
    print(f"US 2024 maps: {red['seats_2024']}, enacted {national['enacted']}, change {red['change']:+d}")
    return {"national": national, "states": states, "checks": checks}


def main() -> None:
    cfg = load_config()
    idir = interim_dir()
    metrics = compute(cfg, idir)
    out = idir / "metrics.json"
    out.write_text(json.dumps(metrics, indent=1, allow_nan=False), encoding="utf-8")
    print(f"Wrote {out}")
    report = build_report(metrics, REPO_ROOT / "data" / "crosscheck", REPO_ROOT / "data" / "validation_notes.yaml")
    report_path = REPO_ROOT / "docs" / "validation.md"
    report_path.write_text(report, encoding="utf-8", newline="\n")   # tracked in git: LF on Windows too
    status = next(line for line in report.splitlines() if line.startswith("**Open items"))
    print(f"Wrote {report_path}: {status.replace('**', '')}")


if __name__ == "__main__":
    main()
