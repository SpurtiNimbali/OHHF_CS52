from __future__ import annotations

from collections.abc import Callable, Iterable, MutableMapping
from dataclasses import dataclass
from typing import Any

from normalize import text_fingerprint


@dataclass
class DedupeStats:
    input_count: int = 0
    by_canonical_url: int = 0
    by_text_fingerprint: int = 0
    output_count: int = 0


def _score_web_row(row: MutableMapping[str, Any]) -> tuple[int, int, int]:
    """Higher is better: URL present, title length, description length."""
    link = row.get("link") or row.get("url") or ""
    title = row.get("name") or row.get("title") or ""
    desc = row.get("description") or row.get("section") or ""
    return (1 if link else 0, len(title), len(desc))


def dedupe_by_key(
    rows: Iterable[MutableMapping[str, Any]],
    key_fn: Callable[[MutableMapping[str, Any]], str | None],
    score_fn: Callable[[MutableMapping[str, Any]], tuple[int, ...]] = _score_web_row,
) -> tuple[list[dict[str, Any]], DedupeStats]:
    """Keep a single best row per non-None key (deterministic tie-break)."""
    stats = DedupeStats()
    buckets: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    stats.input_count = 0
    for raw in rows:
        stats.input_count += 1
        row = dict(raw)
        k = key_fn(row)
        if not k:
            continue
        if k not in buckets:
            buckets[k] = row
            order.append(k)
        else:
            stats.by_canonical_url += 1
            if score_fn(row) > score_fn(buckets[k]):
                buckets[k] = row
    out = [buckets[k] for k in order]
    stats.output_count = len(out)
    return out, stats


def dedupe_fingerprint_after_url(
    rows: list[dict[str, Any]],
    title_field: str,
    url_field: str,
) -> tuple[list[dict[str, Any]], int]:
    """Secondary dedupe when titles collide without same URL (rare for this dataset)."""
    seen_url: set[str] = set()
    seen_fp: set[str] = set()
    out: list[dict[str, Any]] = []
    dup_fp = 0
    for row in rows:
        url = row.get(url_field) or ""
        fp = text_fingerprint(str(row.get(title_field) or ""))
        if url:
            if url in seen_url:
                continue
            seen_url.add(url)
        if fp and fp in seen_fp:
            dup_fp += 1
            continue
        if fp:
            seen_fp.add(fp)
        out.append(row)
    return out, dup_fp
