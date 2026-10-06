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
from gerry.metrics import (TieError, convolve, dem_wins, distribution, effects, efficiency_gap,
                           is_narrow, largest_remainder, linear_band, mean_median, outside_band,
                           pmf_percentile, pmf_position, position, sample_percentile, seats_by_plan,
                           sorted_band)
from gerry.validation import build_report

HOUSE_SEATS = 435
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


def _shares(rows: pd.DataFrame) -> np.ndarray:
    return (rows["d"] / (rows["d"] + rows["r"])).to_numpy(dtype=float)


def state_checks(st: StateConfig, enacted: pd.DataFrame, ensemble: pd.DataFrame,
                 reference: pd.DataFrame) -> dict:
    """Numbers for docs/validation.md: plans, ties, CD118 against ALARM cd_2020,
    whole units against block allocation, and 2020 shares for the DRA comparison."""
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
    for map_id in ["enacted"] + [m.id for m in st.extra_maps]:
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

    main = map_rows(enacted, "enacted")
    pre_20 = {dist: float(dv / (dv + rv)) for dist, dv, rv in zip(main["district"], main["d_pre_20"], main["r_pre_20"])}
    return {
        "plans": int(ensemble["draw"].nunique()),
        "ties": {"ensemble": int((ensemble["d"] == ensemble["r"]).sum()),
                 "enacted": int((enacted["d"] == enacted["r"]).sum())},
        "cd118_vs_alarm": reference_check,
        "whole_unit": whole_unit,
        "pre_20": pre_20,
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


def compute(cfg, idir) -> dict:
    enacted_all = pd.read_parquet(idir / "enacted_districts.parquet")
    ensemble_all = pd.read_parquet(idir / "ensemble_districts.parquet")
    reference_all = pd.read_parquet(idir / "alarm_reference.parquet")
    join_log = json.loads((idir / "join_log.json").read_text(encoding="utf-8"))

    states = {}
    checks = {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {}, "join_log": join_log}
    for postal in sorted(cfg.states):
        st = cfg.states[postal]
        enacted = enacted_all[enacted_all["state"] == postal]
        ensemble = ensemble_all[ensemble_all["state"] == postal]
        reference = reference_all[reference_all["state"] == postal]
        if enacted.empty or ensemble.empty or reference.empty:
            raise CheckError("interim_files", postal, "state missing from the interim Parquet files")
        units = pd.read_parquet(idir / "units" / f"{postal}.parquet", columns=["d", "r"])
        states[postal] = state_metrics(st, float(units["d"].sum()), float(units["r"].sum()), enacted, ensemble)
        for key, value in state_checks(st, enacted, ensemble, reference).items():
            checks[key][postal] = value
        s = states[postal]
        print(f"{postal}: proportional {s['proportional']}, neutral {s['neutral']['median']} "
              f"({s['neutral']['p5']}-{s['neutral']['p95']}), enacted {s['enacted']}")
    national = national_metrics(states, cfg.at_large)
    checks["totals"] = {"district_seats": national["seats"], "at_large": len(cfg.at_large)}
    print(f"US: proportional {national['proportional']}, neutral {national['neutral']['median']} "
          f"({national['neutral']['p5']}-{national['neutral']['p95']}), enacted {national['enacted']}")
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
