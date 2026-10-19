"""Smoke test: the pinned packages import and the gerry package is on the path."""
import importlib
import sys

import pytest

PINNED = {
    "geopandas": "1.2.0",
    "numpy": "2.5.3",
    "openpyxl": "3.1.5",
    "pandas": "3.0.6",
    "pyarrow": "25.0.1",
    "pyogrio": "0.13.0",
    "pytest": "9.1.1",
    "rdata": "1.1.0",
    "yaml": "6.0.3",
}


def test_python_is_3_12():
    assert sys.version_info[:2] == (3, 12)


@pytest.mark.parametrize("module, version", sorted(PINNED.items()))
def test_pinned_version(module, version):
    assert importlib.import_module(module).__version__ == version


def test_gerry_package_is_importable():
    gerry = importlib.import_module("gerry")
    assert gerry.__file__ is not None, "pipeline/gerry/__init__.py is missing"
    assert gerry.__file__.replace("\\", "/").endswith("pipeline/gerry/__init__.py")
