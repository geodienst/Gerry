"""Step 1: download every source file into the data directory (spec chapter 3).

Usage: python pipeline/01_download.py [--only ST [ST ...]] [--dry-run]

Files that are already there and match data/manifest.json (or the Dataverse md5) are kept.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from gerry.config import REPO_ROOT, data_dir, load_config
from gerry.sources import Download, DownloadError, Manifest, dataverse_files, fetch, open_session, plan_downloads

MANIFEST = REPO_ROOT / "data" / "manifest.json"
PER_STATE_DIRS = ("alarm/", "census_vest/", "census/pl/")


def state_of(key: str) -> str | None:
    """Postal code of a per-state file; None for files every state uses."""
    if key.startswith(PER_STATE_DIRS):
        return key.rsplit("/", 1)[1][:2].upper()
    return None


def select(plan: list[Download], only: list[str]) -> list[Download]:
    """With --only: the files of those states plus the shared files."""
    if not only:
        return plan
    wanted = {s.upper() for s in only}
    return [dl for dl in plan if state_of(dl.key) is None or state_of(dl.key) in wanted]


def _stamp(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    st = path.stat()
    return st.st_size, st.st_mtime_ns


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", nargs="+", default=[], metavar="ST", help="postal codes, e.g. NV WV")
    parser.add_argument("--dry-run", action="store_true", help="list the planned files and stop")
    args = parser.parse_args(argv)

    cfg = load_config()
    unknown = sorted({s.upper() for s in args.only} - set(cfg.states))
    if unknown:
        parser.error(f"not a multi-seat state in config.yaml: {', '.join(unknown)}")
    root = data_dir()
    session = open_session()
    print(f"Data directory: {root}")
    try:
        dv_files = dataverse_files(cfg.sources["dataverse_api"], cfg.ensemble.doi, cfg.ensemble.version,
                                   session=session)
        plan = select(plan_downloads(cfg, dv_files), args.only)
    except DownloadError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1
    if args.dry_run:
        for dl in plan:
            print(f"{dl.key}  {dl.size if dl.size is not None else ''}")
        known = sum(dl.size for dl in plan if dl.size is not None)
        print(f"{len(plan)} files planned, {known:,} bytes known in advance (Dataverse)")
        return 0

    manifest = Manifest(MANIFEST)
    counts = {"downloaded": 0, "present": 0}
    total_bytes = 0
    start = time.monotonic()
    for i, dl in enumerate(plan, 1):
        before = _stamp(root / dl.key)
        print(f"[{i:3d}/{len(plan)}] {dl.key} ", end="", flush=True)
        try:
            path = fetch(dl, root, manifest, session=session)
        except DownloadError as exc:
            print("FAILED")
            print(f"ERROR {exc}", file=sys.stderr)
            return 1
        finally:
            # also on Ctrl-C or an unexpected error: keep the checksums recorded so far
            manifest.save()
        size = path.stat().st_size
        total_bytes += size
        status = "present" if _stamp(path) == before else "downloaded"
        counts[status] += 1
        print(f"{status} ({size / 1e6:,.1f} MB)")
    minutes = (time.monotonic() - start) / 60
    print(f"{len(plan)} files: {counts['downloaded']} downloaded, {counts['present']} present, "
          f"{total_bytes:,} bytes, {minutes:.1f} min")
    recorded = sum(1 for dl in plan if manifest.get(dl.key) is not None)
    print(f"Manifest {MANIFEST} has entries for {recorded} of these files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
