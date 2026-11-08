from __future__ import annotations

import re
from collections import Counter

MOJIBAKE_MARKERS = ("â€™", "â€œ", "â€", "â€”", "â€“", "Ã", "Â")
WORD_RE = re.compile(r"\S+")


def word_count(text: str) -> int:
    return len(WORD_RE.findall(text or ""))


def repair_mojibake(text: str) -> tuple[str, bool]:
    """Reverse common UTF-8-as-Windows-1252 decoding errors, conservatively."""
    if not text or not any(marker in text for marker in MOJIBAKE_MARKERS):
        return text, False
    try:
        repaired = text.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text, False
    if sum(text.count(marker) for marker in MOJIBAKE_MARKERS) <= sum(repaired.count(marker) for marker in MOJIBAKE_MARKERS):
        return text, False
    return repaired, repaired != text


def length_group(words: int) -> str:
    if words <= 500:
        return "short"
    if words <= 1000:
        return "medium"
    if words <= 2000:
        return "long"
    return "very_long"


def detect_language_hint(text: str) -> str:
    """A transparent heuristic, reported as a hint rather than a language claim."""
    letters = [char.lower() for char in text if char.isalpha()]
    if not letters:
        return "unknown"
    latin = sum("a" <= char <= "z" for char in letters)
    return "mostly_latin" if latin / len(letters) >= 0.8 else "non_latin_or_mixed"


def duplicate_counts(values: list[str]) -> Counter[str]:
    return Counter(values)
