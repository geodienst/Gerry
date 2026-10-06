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
_R_NA_INTEGER = np.iinfo(np.int32).min    # R stores NA_integer_ and NA (logical) as this value


def _attributes(obj) -> dict:
    """R attribute pairlist -> {name: object}."""
    out = {}
    cur = obj.attributes
    while cur is not None and cur.info.type == _T.LIST:
        tag = cur.tag
        if tag is not None and tag.info.type == _T.REF:
            tag = tag.referenced_object
        out[tag.value.value.decode("utf-8")] = cur.value[0]
        cur = cur.value[1]
    return out


def _strings(obj) -> list[str | None]:
    return [x.value.decode("utf-8") if x.value is not None else None for x in obj.value]


def _column(obj):
    """Atomic R vector -> numpy array or pandas extension array; None for other types."""
    kind = obj.info.type
    if kind == _T.STR:
        return pd.array(_strings(obj), dtype="str")
    if kind == _T.REAL:
        return np.asarray(obj.value, dtype=np.float64)
    if kind in (_T.INT, _T.LGL):
        values = np.asarray(obj.value).astype(np.int64)
        missing = values == _R_NA_INTEGER
        if kind == _T.LGL:
            return pd.arrays.BooleanArray(values != 0, missing) if missing.any() else values != 0
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
