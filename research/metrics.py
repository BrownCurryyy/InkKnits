from __future__ import annotations

import math
import statistics
from collections.abc import Iterable


def summarize_numbers(values: Iterable[float]) -> dict[str, float | int | None]:
    numbers = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    if not numbers:
        return {"count": 0, "mean": None, "median": None, "stddev": None, "min": None, "max": None, "p25": None, "p75": None, "p90": None, "p95": None}
    ordered = sorted(numbers)
    def percentile(fraction: float) -> float:
        position = (len(ordered) - 1) * fraction
        lower, upper = math.floor(position), math.ceil(position)
        return ordered[lower] if lower == upper else ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)
    return {"count": len(numbers), "mean": statistics.mean(numbers), "median": statistics.median(numbers), "stddev": statistics.stdev(numbers) if len(numbers) > 1 else 0.0, "min": min(numbers), "max": max(numbers), "p25": percentile(.25), "p75": percentile(.75), "p90": percentile(.90), "p95": percentile(.95)}


def safe_ratio(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator else None
