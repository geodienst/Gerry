import hashlib
import http.server
import json
import threading
from collections import Counter
from pathlib import Path

import pytest

from gerry import sources
from gerry.sources import Download, DownloadError, Manifest, fetch


class LocalServer:
    """HTTP server on 127.0.0.1 that serves files from `root` and records each request."""

    def __init__(self, root: Path):
        self.root = root
        self.hits = Counter()      # path without leading "/" and without query -> number of GETs
        self.requests = []         # full request paths, query included
        self.user_agents = []
        self.failures = {}         # path -> number of 503 answers before the file is served
        self.routes = {}           # path -> bytes, served instead of a file
        self.truncated = {}        # path -> bytes, sent with a Content-Length larger than the body
        srv = self

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(root), **kwargs)

            def do_GET(self):
                path = self.path.split("?", 1)[0].lstrip("/")
                srv.hits[path] += 1
                srv.requests.append(self.path)
                srv.user_agents.append(self.headers.get("User-Agent"))
                if srv.failures.get(path, 0) > 0:
                    srv.failures[path] -= 1
                    self.send_error(503)
                    return
                if path in srv.routes:
                    body = srv.routes[path]
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                if path in srv.truncated:
                    body = srv.truncated[path]
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body) + 10))
                    self.end_headers()
                    self.wfile.write(body)
                    self.close_connection = True
                    return
                super().do_GET()

            def log_message(self, *args):
                pass

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.thread = threading.Thread(
            target=self.httpd.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()

    def url(self, path: str) -> str:
        return f"{self.base}/{path}"

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


@pytest.fixture
def server(tmp_path):
    root = tmp_path / "srv"
    root.mkdir()
    srv = LocalServer(root)
    yield srv
    srv.close()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def publish(server: LocalServer, name: str, content: bytes) -> Download:
    """Put a file on the server; return a Census-style download (no size or md5 known)."""
    (server.root / name).write_bytes(content)
    return Download(key=f"census/{name}", url=server.url(name), size=None, md5=None)


def test_manifest_starts_empty_without_file(tmp_path):
    assert Manifest(tmp_path / "manifest.json").get("census/cd120.zip") is None


def test_manifest_saves_sorted_and_reloads(tmp_path):
    path = tmp_path / "data" / "manifest.json"
    m = Manifest(path)
    m.record("census/b.zip", "https://example.org/b.zip", 3, "bb")
    m.record("census/a.zip", "https://example.org/a.zip", 5, "aa")
    m.save()
    text = path.read_text(encoding="utf-8")
    assert text.endswith("\n")
    assert list(json.loads(text)) == ["census/a.zip", "census/b.zip"]
    assert Manifest(path).get("census/a.zip") == {"url": "https://example.org/a.zip", "size": 5, "sha256": "aa"}


def test_manifest_is_written_with_lf_line_endings(tmp_path):
    # The manifest is tracked in git; Windows must not turn its newlines into CRLF.
    path = tmp_path / "manifest.json"
    m = Manifest(path)
    m.record("census/a.zip", "https://example.org/a.zip", 5, "aa")
    m.save()
    assert b"\r" not in path.read_bytes()


def test_fetch_downloads_and_records_sha256(tmp_path, server):
    content = b"GEOID,CDFP\n320019601001000,02\n"
    dl = publish(server, "cd.txt", content)
    manifest = Manifest(tmp_path / "manifest.json")
    path = fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert path == tmp_path / "raw" / "census" / "cd.txt"
    assert path.read_bytes() == content
    assert not (tmp_path / "raw" / "census" / "cd.txt.part").exists()
    assert manifest.get("census/cd.txt") == {"url": dl.url, "size": len(content), "sha256": sha256(content)}


def test_fetch_skips_a_verified_file(tmp_path, server):
    dl = publish(server, "cd.txt", b"abc")
    manifest = Manifest(tmp_path / "manifest.json")
    fetch(dl, tmp_path / "raw", manifest, wait=0)
    fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert server.hits["cd.txt"] == 1


def test_fetch_replaces_a_damaged_file(tmp_path, server):
    dl = publish(server, "cd.txt", b"abc")
    manifest = Manifest(tmp_path / "manifest.json")
    path = fetch(dl, tmp_path / "raw", manifest, wait=0)
    path.write_bytes(b"abX")
    fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert path.read_bytes() == b"abc"
    assert server.hits["cd.txt"] == 2


def test_fetch_stops_when_the_source_changed(tmp_path, server):
    dl = publish(server, "cd.txt", b"new content")
    manifest = Manifest(tmp_path / "manifest.json")
    manifest.record(dl.key, dl.url, 11, sha256(b"old content"))
    with pytest.raises(DownloadError, match=dl.url):
        fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert not (tmp_path / "raw" / "census" / "cd.txt").exists()
    assert not (tmp_path / "raw" / "census" / "cd.txt.part").exists()
    assert manifest.get(dl.key)["sha256"] == sha256(b"old content")


def test_fetch_checks_size_and_md5_from_dataverse(tmp_path, server):
    content = b"draw,district\ncd_2020,1\n"
    (server.root / "stats.csv").write_bytes(content)
    manifest = Manifest(tmp_path / "manifest.json")
    good = Download("alarm/NV_cd_2020_stats.csv", server.url("stats.csv"), len(content), md5(content))
    assert fetch(good, tmp_path / "raw", manifest, wait=0).read_bytes() == content
    bad = Download("alarm/UT_cd_2020_stats.csv", server.url("stats.csv"), len(content), "0" * 32)
    with pytest.raises(DownloadError, match="md5"):
        fetch(bad, tmp_path / "raw", manifest, retries=2, wait=0)
    assert not (tmp_path / "raw" / "alarm" / "UT_cd_2020_stats.csv").exists()
    assert manifest.get(bad.key) is None


def test_fetch_checks_the_size_from_dataverse(tmp_path, server):
    content = b"draw,district\ncd_2020,1\n"
    (server.root / "stats.csv").write_bytes(content)
    manifest = Manifest(tmp_path / "manifest.json")
    wrong_size = Download("alarm/NV_cd_2020_stats.csv", server.url("stats.csv"), len(content) + 1, md5(content))
    with pytest.raises(DownloadError, match=rf"size {len(content)}, expected {len(content) + 1}"):
        fetch(wrong_size, tmp_path / "raw", manifest, retries=2, wait=0)
    assert server.hits["stats.csv"] == 2
    assert not (tmp_path / "raw" / "alarm" / "NV_cd_2020_stats.csv").exists()
    assert not (tmp_path / "raw" / "alarm" / "NV_cd_2020_stats.csv.part").exists()
    assert manifest.get(wrong_size.key) is None


def test_fetch_rejects_a_truncated_download(tmp_path, server):
    # Census and GitHub give no size or md5, so Content-Length is the only check on these files.
    server.truncated["cd.txt"] = b"GEOID,CDFP\n3200"
    dl = Download("census/cd.txt", server.url("cd.txt"), None, None)
    manifest = Manifest(tmp_path / "manifest.json")
    with pytest.raises(DownloadError, match="Content-Length"):
        fetch(dl, tmp_path / "raw", manifest, retries=2, wait=0)
    assert server.hits["cd.txt"] == 2
    assert not (tmp_path / "raw" / "census" / "cd.txt").exists()
    assert not (tmp_path / "raw" / "census" / "cd.txt.part").exists()
    assert manifest.get(dl.key) is None


def test_fetch_accepts_existing_file_with_matching_md5(tmp_path, server):
    content = b"x" * 10
    dl = Download("alarm/WV_cd_2020_map.rds", server.url("map.rds"), 10, md5(content))
    target = tmp_path / "raw" / "alarm" / "WV_cd_2020_map.rds"
    target.parent.mkdir(parents=True)
    target.write_bytes(content)
    manifest = Manifest(tmp_path / "manifest.json")
    assert fetch(dl, tmp_path / "raw", manifest, wait=0) == target
    assert server.hits["map.rds"] == 0
    assert manifest.get(dl.key) == {"url": dl.url, "size": 10, "sha256": sha256(content)}


def test_fetch_retries_with_wait(tmp_path, server, monkeypatch):
    sleeps = []
    monkeypatch.setattr(sources.time, "sleep", sleeps.append)
    dl = publish(server, "cd.txt", b"abc")
    server.failures["cd.txt"] = 2
    fetch(dl, tmp_path / "raw", Manifest(tmp_path / "m.json"), retries=3, wait=5.0)
    assert server.hits["cd.txt"] == 3
    assert sleeps == [5.0, 5.0]


def test_fetch_gives_up_after_the_last_attempt(tmp_path, server, monkeypatch):
    monkeypatch.setattr(sources.time, "sleep", lambda seconds: None)
    dl = publish(server, "cd.txt", b"abc")
    server.failures["cd.txt"] = 5
    with pytest.raises(DownloadError, match="3 attempts"):
        fetch(dl, tmp_path / "raw", Manifest(tmp_path / "m.json"), retries=3, wait=5.0)
    assert server.hits["cd.txt"] == 3


def test_fetch_sends_its_own_user_agent(tmp_path, server):
    # Dataverse answers 403 to the default "Python-urllib" user agent.
    dl = publish(server, "cd.txt", b"abc")
    fetch(dl, tmp_path / "raw", Manifest(tmp_path / "m.json"), wait=0)
    assert server.user_agents == [sources.USER_AGENT]
