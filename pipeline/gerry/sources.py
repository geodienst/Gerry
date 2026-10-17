"""Downloads with size, md5 and sha256 checks, recorded in data/manifest.json (spec chapter 3)."""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import shutil
import time
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from gerry.config import Config

USER_AGENT = "gerry-pipeline/1.0"   # Dataverse answers 403 to the default "Python-urllib/3.x"
TIMEOUT = 120                       # seconds per connection attempt
CHUNK = 1 << 20


@dataclass(frozen=True)
class Download:
    key: str            # path relative to the data directory, with "/"
    url: str
    size: int | None    # expected size in bytes, known for Dataverse files only
    md5: str | None     # expected md5, known for Dataverse files only


class DownloadError(RuntimeError):
    pass


class Manifest:
    """data/manifest.json: {key: {"url", "size", "sha256"}} for every downloaded file."""

    def __init__(self, path: Path):
        self.path = Path(path)
        if self.path.exists():
            self._entries = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            self._entries = {}

    def get(self, key: str) -> dict | None:
        return self._entries.get(key)

    def record(self, key: str, url: str, size: int, sha256: str) -> None:
        self._entries[key] = {"url": url, "size": int(size), "sha256": sha256}

    def prune(self, keep: Iterable[str]) -> list[str]:
        """Drop the entries whose key is not in `keep`; return the dropped keys, sorted. Call save() to write."""
        keep = set(keep)
        removed = sorted(key for key in self._entries if key not in keep)
        for key in removed:
            del self._entries[key]
        return removed

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(dict(sorted(self._entries.items())), indent=2) + "\n"
        tmp = self.path.with_name(self.path.name + ".part")
        tmp.write_text(text, encoding="utf-8", newline="\n")   # tracked in git: LF on Windows too
        os.replace(tmp, self.path)


def open_session() -> urllib.request.OpenerDirector:
    """The default `session`: a urllib opener that sends USER_AGENT."""
    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", USER_AGENT)]
    return opener


def _digests(path: Path) -> tuple[int, str, str]:
    """(size, md5, sha256) of a file, read once."""
    md5, sha = hashlib.md5(), hashlib.sha256()
    size = 0
    with open(path, "rb") as fh:
        while block := fh.read(CHUNK):
            size += len(block)
            md5.update(block)
            sha.update(block)
    return size, md5.hexdigest(), sha.hexdigest()


def _expected_problem(dl: Download, size: int, md5: str) -> str | None:
    """Mismatch with the size and md5 that Dataverse publishes, or None."""
    if dl.size is not None and size != dl.size:
        return f"size {size}, expected {dl.size}"
    if dl.md5 is not None and md5 != dl.md5:
        return f"md5 {md5}, expected {dl.md5}"
    return None


def _is_verified(path: Path, dl: Download, entry: dict | None) -> tuple[bool, int, str]:
    """An existing file counts as verified if it matches the manifest entry, or (without
    an entry) the Dataverse size and md5. A Census or GitHub file without entry is not."""
    size, md5, sha = _digests(path)
    if _expected_problem(dl, size, md5) is not None:
        return False, size, sha
    if entry is not None:
        return (size == entry["size"] and sha == entry["sha256"]), size, sha
    return dl.md5 is not None, size, sha


def fetch(dl: Download, root: Path, manifest: Manifest, retries: int = 3, wait: float = 5.0,
          session=None) -> Path:
    """Download `dl` to root/dl.key unless a verified copy is there. Records sha256 in the manifest.

    `session` is an object with .open(url, timeout=...) such as urllib's OpenerDirector."""
    target = Path(root) / dl.key
    entry = manifest.get(dl.key)
    if target.exists():
        ok, size, sha = _is_verified(target, dl, entry)
        if ok:
            if entry is None:
                manifest.record(dl.key, dl.url, size, sha)
            return target
    session = session or open_session()
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name(target.name + ".part")
    last_error = ""
    for attempt in range(1, retries + 1):
        try:
            with session.open(dl.url, timeout=TIMEOUT) as response, open(part, "wb") as fh:
                announced = getattr(response, "headers", {}).get("Content-Length")
                shutil.copyfileobj(response, fh, CHUNK)
            size, md5, sha = _digests(part)
            problem = _expected_problem(dl, size, md5)
            # copyfileobj does not raise when the server closes early; Census and GitHub give
            # no size or md5, so Content-Length is the only check against a short file.
            if problem is None and announced is not None and announced.isdigit() and int(announced) != size:
                problem = f"size {size}, Content-Length {announced}"
        except (OSError, http.client.HTTPException) as exc:
            problem = f"{type(exc).__name__}: {exc}"
        if problem is None:
            break
        last_error = problem
        part.unlink(missing_ok=True)
        if attempt < retries:
            time.sleep(wait)
    else:
        raise DownloadError(f"{dl.url}: failed after {retries} attempts; last error: {last_error}")
    if entry is not None and (sha != entry["sha256"] or size != entry["size"]):
        part.unlink()
        raise DownloadError(
            f"{dl.url}: content differs from data/manifest.json ({dl.key}: size {entry['size']}, "
            f"sha256 {entry['sha256']}; downloaded size {size}, sha256 {sha}). The file at the source "
            "has changed. Find out why before you remove the entry from the manifest.")
    os.replace(part, target)
    manifest.record(dl.key, dl.url, size, sha)
    return target


def dataverse_files(api_base: str, doi: str, version: int, session=None) -> dict[str, dict]:
    """File name -> {"id", "size", "md5", "tabular"} for one published version of a dataset.

    For ingested tables Dataverse serves the original CSV with ?format=original; its size is
    originalFileSize. The md5 is that of the original upload in both cases."""
    url = f"{api_base}/datasets/:persistentId/versions/{version}/files?persistentId={doi}"
    session = session or open_session()
    try:
        with session.open(url, timeout=TIMEOUT) as response:
            payload = json.load(response)
    except (OSError, http.client.HTTPException, ValueError) as exc:
        raise DownloadError(f"{url}: {type(exc).__name__}: {exc}") from exc
    if payload.get("status") != "OK":
        raise DownloadError(f"{url}: status {payload.get('status')}: {payload.get('message')}")
    items = payload["data"]
    if payload.get("totalCount", len(items)) != len(items):
        raise DownloadError(f"{url}: listing has {len(items)} of {payload['totalCount']} files")
    files: dict[str, dict] = {}
    for item in items:
        df = item["dataFile"]
        tabular = bool(df.get("tabularData"))
        name = df["filename"]
        if name in files:
            raise DownloadError(f"{url}: file name {name} occurs twice")
        files[name] = {"id": int(df["id"]), "size": int(df["originalFileSize"] if tabular else df["filesize"]),
                       "md5": df["md5"], "tabular": tabular}
    return files


def _dataverse_download(cfg: Config, dv_files: dict[str, dict], name: str, key: str) -> Download:
    f = dv_files.get(name)
    if f is None:
        raise DownloadError(f"{name} is not in {cfg.ensemble.doi} version {cfg.ensemble.version}")
    url = f"{cfg.sources['dataverse_api']}/access/datafile/{f['id']}"
    if f["tabular"]:
        url += "?format=original"
    return Download(key, url, f["size"], f["md5"])


def plan_downloads(cfg: Config, dv_files: dict[str, dict]) -> list[Download]:
    """Every file the pipeline reads, keyed by its path in the data directory (Interfaces, "Datamap")."""
    src = cfg.sources
    postals = sorted(cfg.states)
    plan = [_dataverse_download(cfg, dv_files, f"{p}_cd_2020_stats.tab", f"alarm/{p}_cd_2020_stats.csv")
            for p in postals]
    # map.rds holds the votes per unit for all three scenarios (spec chapter 3)
    plan += [_dataverse_download(cfg, dv_files, f"{p}_cd_2020_map.rds", f"alarm/{p}_cd_2020_map.rds")
             for p in postals]
    # census-vest: only the block files of CA, HI, ME and OR, as weights within a tract
    for p in postals:
        if cfg.states[p].unit_kind == "tract":
            st = p.lower()
            url = src["census_vest"].format(commit=cfg.census_vest_commit, st=st, kind="block")
            plan.append(Download(f"census_vest/{st}_2020_block.csv", url, None, None))
    plan.append(Download("census/cd118.zip", src["cd118"], None, None))
    # the maps of the 2024 election, reference for the redraws (extensions design, chapter 2)
    plan.append(Download("census/cd119.zip", src["cd119"], None, None))
    plan.append(Download("census/cd120.zip", src["cd120"], None, None))
    # CD120 as Census published it on August 31, 2026, with Missouri's blocked HB 1 (regenerated without it on
    # October 6, 2026); the pipeline reads only its Missouri file
    plan.append(Download("census/cd120_2026_08.zip", src["cd120_2026_08"], None, None))
    for p in postals:
        folder = cfg.states[p].name.replace(" ", "_")
        st = p.lower()
        plan.append(Download(f"census/pl/{st}2020.pl.zip", src["pl94171"].format(folder=folder, st=st), None, None))
    for name in ("tiger_gpkg", "tiger_mo_cd119", "cb_states"):
        url = src[name]
        plan.append(Download(f"census/tiger/{url.rsplit('/', 1)[1]}", url, None, None))
    # statewide presidential votes for the Senate block (extensions design, chapter 7): one Dataverse file,
    # checked against data/manifest.json like the Census files
    plan.append(Download("medsl/1976-2024-president.csv", src["medsl_president"], None, None))
    keys = [dl.key for dl in plan]
    if len(set(keys)) != len(keys):
        raise DownloadError("download plan has duplicate keys")
    return plan
