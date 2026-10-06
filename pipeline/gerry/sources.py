"""Downloads with size, md5 and sha256 checks, recorded in data/manifest.json (spec chapter 3)."""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import shutil
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

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
