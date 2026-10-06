"""Read the attribute table of an ALARM redist_map (.rds) in Python, without R.

Uses the low-level parser of the `rdata` package. Only atomic columns (text, integer, double,
logical) are returned; list columns such as `geometry` and `adj` are skipped.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import rdata

_T = rdata.parser.RObjectType


def _text(char) -> str | None:
    """R CHARSXP -> str, following its encoding flags (UTF-8, Latin-1, ASCII).

    Unmarked strings are in R's native encoding; ALARM's files are written in UTF-8.
    """
    return rdata.conversion.convert_char(char, default_encoding="utf-8")


def _attributes(obj) -> dict:
    """R attribute pairlist -> {name: object}."""
    out = {}
    cur = obj.attributes
    while cur is not None and cur.info.type == _T.LIST:
        tag = cur.tag
        if tag is not None and tag.info.type == _T.REF:
            tag = tag.referenced_object
        out[_text(tag.value)] = cur.value[0]
        cur = cur.value[1]
    return out


def _strings(obj) -> list[str | None]:
    return [_text(x) for x in obj.value]


def _column(obj):
    """Atomic R vector -> numpy array or pandas extension array; None for other types."""
    kind = obj.info.type
    if kind == _T.STR:
        return pd.array(_strings(obj), dtype="str")
    if kind == _T.REAL:
        return np.asarray(obj.value, dtype=np.float64)
    if kind in (_T.INT, _T.LGL):
        # rdata returns R's NA as a masked array; the data under the mask is not reliable.
        missing = np.ma.getmaskarray(obj.value)
        data = np.ma.getdata(obj.value)
        if kind == _T.LGL:
            flags = data.astype(bool)
            return pd.arrays.BooleanArray(flags, missing) if missing.any() else flags
        values = data.astype(np.int64)
        return pd.arrays.IntegerArray(values, missing) if missing.any() else values
    return None


def read_rds_table(path: Path) -> pd.DataFrame:
    """All atomic columns of the data frame in an .rds file, in their original order."""
    obj = rdata.parser.parse_file(Path(path)).object
    attrs = _attributes(obj)
    if obj.info.type != _T.VEC or "names" not in attrs:
        raise ValueError(f"{path}: not a data frame or named list")
    columns = {}
    for name, col in zip(_strings(attrs["names"]), obj.value):
        values = _column(col)
        if values is not None:
            columns[name] = values
    return pd.DataFrame(columns)
