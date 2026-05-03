from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def _ordered(obj: dict[str, Any], key_order: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k in key_order:
        if k in obj:
            out[k] = obj[k]
    for k in sorted(obj.keys()):
        if k not in out:
            out[k] = obj[k]
    return out


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")


def export_resources(rows: list[dict[str, Any]], out_path: Path) -> None:
    key_order = ["name", "description", "link", "city", "zipcode", "category"]
    ordered = [_ordered(r, key_order) for r in rows]
    ordered.sort(key=lambda r: (r.get("link") or "", r.get("name") or ""))
    write_json(out_path, ordered)


def export_question_bank(rows: list[dict[str, Any]], out_path: Path) -> None:
    key_order = ["category", "question_text"]
    ordered = [_ordered(r, key_order) for r in rows]
    ordered.sort(key=lambda r: (r.get("category") or "", r.get("question_text") or ""))
    write_json(out_path, ordered)


def export_glossary(rows: list[dict[str, Any]], out_path: Path) -> None:
    key_order = ["term", "definition"]
    ordered = [_ordered(r, key_order) for r in rows]
    ordered.sort(key=lambda r: (r.get("term") or "").lower())
    write_json(out_path, ordered)


def export_chat_knowledge(rows: list[dict[str, Any]], out_path: Path) -> None:
    key_order = ["title", "url", "section", "source"]
    ordered = [_ordered(r, key_order) for r in rows]
    ordered.sort(key=lambda r: (r.get("url") or "", r.get("title") or ""))
    write_json(out_path, ordered)


def parse_zip_from_text(*parts: str) -> int | None:
    for p in parts:
        if not p:
            continue
        m = re.search(r"\b(\d{5})\b", p)
        if m:
            return int(m.group(1))
    return None
