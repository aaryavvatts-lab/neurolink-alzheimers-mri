"""JSON writing that a browser can actually parse.

Python's json.dumps serialises float('nan') as the bare token `NaN`, and
Infinity as `Infinity`. Neither is valid JSON. Python reads them back happily,
so the files look fine from the Python side -- but JSON.parse() in the browser
throws, and a site that fetches the file renders nothing at all with only an
opaque syntax error in the console.

This bites here because NaN is a legitimate result: ROC-AUC is undefined when a
fold's test set contains a single class, and sensitivity is undefined when no
positive cases are present. Those cases are real and must be representable --
as null, which is valid JSON and which the TypeScript side reads as "not
measurable", distinct from zero.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


def sanitise(obj: Any) -> Any:
    """Recursively replace NaN/Inf floats with None."""
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: sanitise(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitise(v) for v in obj]
    return obj


def dumps(obj: Any, **kw: Any) -> str:
    """json.dumps, but NaN/Inf become null and the result is strict JSON."""
    text = json.dumps(sanitise(obj), allow_nan=False, **kw)
    return text


def write(path: str | Path, obj: Any, indent: int = 2) -> None:
    Path(path).write_text(dumps(obj, indent=indent))
