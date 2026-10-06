"""Step 2: votes per unit -> blocks -> districts, plus ALARM's plans; writes data/interim/ (spec chapter 4).

Usage: python pipeline/02_join.py [--states ST [ST ...]]

Without --states all states are joined and the interim files are rewritten. With --states only those
states are joined and their rows replace the earlier rows in the interim files.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from gerry.blocks import (BlocksError, block_weighted, read_bef, read_pl_blocks, read_pl_counties, unit_of_block,
                          whole_unit)
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_reference_labels, check_units_linked, check_vap_pop)
from gerry.config import data_dir, interim_dir, load_config
from gerry.ensemble import district_votes, read_stats, reference_labels
from gerry.units import UnitsError, add_composite, load_units, read_block_votes

log = logging.getLogger("join")


@dataclass
class StateResult:
    units: pd.DataFrame       # unit_id, vap, pop, d_<e>, r_<e>, d, r
    enacted: pd.DataFrame     # state, map_id, method, district, vote columns
    ensemble: pd.DataFrame    # state, draw, district, vote columns
    reference: pd.DataFrame   # state, district, vote columns (draw cd_2020, with the labels of map.rds)
    log: dict


def maps_of(st) -> list[tuple[str, str]]:
    """(map_id, block equivalency file): the enacted map, extra maps, and the 2022 map for the check."""
    return [("enacted", st.bef), *((m.id, m.bef) for m in st.extra_maps), ("check_2022", "cd118")]


def join_state(cfg, postal: str, root: Path) -> StateResult:
    st = cfg.states[postal]
    parts = [f"{p}_{e}" for e in st.elections for p in ("d", "r")]
    vote_cols = parts + ["d", "r"]
    pl_zip = root / "census" / "pl" / f"{postal.lower()}2020.pl.zip"
    counties = read_pl_counties(pl_zip, postal) if st.unit_kind == "county" else None
    units = add_composite(load_units(st, root, counties), st.elections)
    weights = read_block_votes(st, root) if st.unit_kind == "tract" else None
    info = {"units": len(units), "empty_vote_fields": units.attrs["empty_vote_fields"],
            "empty_vote_units": units.attrs["empty_vote_units"],
            "empty_weight_fields": weights.attrs["empty_vote_fields"] if weights is not None else 0}

    blocks = read_pl_blocks(pl_zip, postal)
    check_geoids(blocks["block_id"], st.fips, postal)
    unit_of = unit_of_block(blocks, st.unit_kind, st.fips)
    unlinked_blocks, unlinked_keys = check_vap_pop(units, blocks, unit_of, postal)
    if unlinked_blocks:
        log.info("%s: %d blocks in %d keys are not in map.rds; all have VAP 0 and population 0",
                 postal, unlinked_blocks, unlinked_keys)
    info.update({"blocks": len(blocks), "units_zero_vap": int((units["vap"] == 0).sum()),
                 "unlinked_blocks": unlinked_blocks, "unlinked_keys": unlinked_keys, "maps": {}})

    rows = []
    for map_id, bef in maps_of(st):
        district_of = read_bef(root / "census" / f"{bef}.zip", bef, st.fips, postal)
        check_units_linked(units, unit_of, district_of, postal)
        # distribute the votes per election; the composite follows from the distributed parts
        block = block_weighted(units, blocks, unit_of, district_of, parts, weights)
        info["maps"][map_id] = dict(block.attrs)
        whole = whole_unit(units, blocks, unit_of, district_of, parts)
        for method, totals in (("block", block), ("whole_unit", whole)):
            totals = add_composite(totals, st.elections)
            check_conservation(units, totals, vote_cols, postal)
            check_district_count(totals, st.seats, postal)
            rows.append(totals.assign(state=postal, map_id=map_id, method=method))
        if map_id == "check_2022":
            labels = unit_of.map(units.set_index("unit_id")["cd_2020"])
            info["reference_share"] = check_reference_labels(labels, district_of,
                                                             blocks.set_index("block_id")["pop"], postal)
    enacted = pd.concat(rows, ignore_index=True)

    stats = read_stats(root / "alarm" / f"{postal}_cd_2020_stats.csv")
    ensemble, reference = district_votes(stats, st)
    labels = reference_labels(stats, units.groupby("cd_2020")["pop"].sum(), postal)
    reference = (reference.assign(district=reference["district"].map(labels))
                 .sort_values("district", ignore_index=True))
    info["reference_labels"] = {k: v for k, v in labels.items() if k != v}
    if info["reference_labels"]:
        log.info("%s: ALARM's cd_2020 districts get the labels of map.rds: %s", postal,
                 ", ".join(f"{k} -> {v}" for k, v in info["reference_labels"].items()))
    check_ensemble_totals(ensemble, units, st.elections, st.seats, postal)
    check_ensemble_totals(reference, units, st.elections, st.seats, postal)
    info["plans"] = int(ensemble["draw"].nunique())
    return StateResult(units.drop(columns="cd_2020"), enacted, ensemble, reference.drop(columns="draw"), info)


def replace_states(old: pd.DataFrame | None, new: pd.DataFrame, states: set[str]) -> pd.DataFrame:
    """Rows of `old` for other states, then the rows of `new`, sorted by state (stable)."""
    if old is None:
        return new
    combined = pd.concat([old[~old["state"].isin(states)], new], ignore_index=True)
    return combined.sort_values("state", kind="stable").reset_index(drop=True)


def _ordered(frames: list[pd.DataFrame], key_cols: list[str], vote_cols: list[str]) -> pd.DataFrame:
    return pd.concat(frames, ignore_index=True).reindex(columns=key_cols + vote_cols)


def write_outputs(results: dict[str, StateResult], cfg, out_dir: Path, partial: bool) -> None:
    elections = list(dict.fromkeys(e for st in cfg.states.values() for e in st.elections))
    vote_cols = [f"{p}_{e}" for e in elections for p in ("d", "r")] + ["d", "r"]
    (out_dir / "units").mkdir(parents=True, exist_ok=True)
    for postal, res in results.items():
        res.units.to_parquet(out_dir / "units" / f"{postal}.parquet", index=False)
    tables = {
        "enacted_districts.parquet": _ordered([r.enacted for r in results.values()],
                                              ["state", "map_id", "method", "district"], vote_cols),
        "ensemble_districts.parquet": _ordered([r.ensemble for r in results.values()],
                                               ["state", "draw", "district"], vote_cols),
        "alarm_reference.parquet": _ordered([r.reference for r in results.values()], ["state", "district"], vote_cols),
    }
    states = set(results)
    for name, table in tables.items():
        path = out_dir / name
        old = pd.read_parquet(path) if partial and path.exists() else None
        replace_states(old, table, states).to_parquet(path, index=False)
    log_path = out_dir / "join_log.json"
    previous = json.loads(log_path.read_text(encoding="utf-8")) if partial and log_path.exists() else {}
    previous.update({postal: res.log for postal, res in results.items()})
    log_path.write_text(json.dumps(dict(sorted(previous.items())), indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--states", nargs="+", default=[], metavar="ST", help="postal codes, e.g. NV WV")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="  %(message)s", stream=sys.stdout)
    cfg = load_config()
    states = [s.upper() for s in args.states] or sorted(cfg.states)
    unknown = sorted(set(states) - set(cfg.states))
    if unknown:
        parser.error(f"not a multi-seat state in config.yaml: {', '.join(unknown)}")
    root = data_dir()
    results = {}
    for postal in states:
        start = time.monotonic()
        try:
            res = join_state(cfg, postal, root)
        except (CheckError, UnitsError, BlocksError) as exc:
            print(f"ERROR {postal}: {exc}", file=sys.stderr)
            return 1
        except FileNotFoundError as exc:
            print(f"ERROR {postal}: missing {exc.filename}; run pipeline/01_download.py first", file=sys.stderr)
            return 1
        results[postal] = res
        enacted = res.log["maps"]["enacted"]
        print(f"{postal}: {res.log['units']} units ({res.log['units_zero_vap']} without VAP), "
              f"{res.log['blocks']} blocks, enacted map splits {enacted['split_units']} units "
              f"({enacted['zero_vap_split_units']} without VAP, {enacted['block_count_votes']:.1f} votes "
              f"by block count), {res.log['plans']} plans, {time.monotonic() - start:.1f} s", flush=True)
    write_outputs(results, cfg, interim_dir(), partial=bool(args.states))
    print(f"Wrote {len(results)} states to {interim_dir()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
