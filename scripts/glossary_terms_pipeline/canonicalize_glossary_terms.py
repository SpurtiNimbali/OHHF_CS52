"""
Canonicalize merged glossary records: term normalization, config-driven categories,
slug-based dedupe. Reads merged_glossary_terms.json; does not modify it.

Run:
  py -3 scripts/glossary_terms_pipeline/canonicalize_glossary_terms.py
"""

from __future__ import annotations

import copy
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from utils.normalize_term import slugify


BASE_DIR = Path(__file__).resolve().parent
INPUT_JSON = BASE_DIR / "output" / "merged_glossary_terms.json"
OUTPUT_JSON = BASE_DIR / "output" / "canonicalized_glossary_terms.json"
REPORT_PATH = BASE_DIR / "output" / "glossary_canonicalization_report.txt"
CONFIG_DIR = BASE_DIR / "config"
CANON_MAP_PATH = CONFIG_DIR / "canonical_term_map.json"
CATEGORY_RULES_PATH = CONFIG_DIR / "category_rules.json"

FALLBACK_CATEGORIES = ["General Medical Terms"]

ANATOMY_EXACT_HEADWORDS = frozenset(
    {
        "artery",
        "vein",
        "aorta",
        "atrium",
        "ventricle",
        "septum",
        "valve",
    }
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def merge_aliases(*lists: list[str]) -> list[str]:
    """Case-insensitive dedupe; preserve first-seen order."""
    seen: set[str] = set()
    out: list[str] = []
    for lst in lists:
        for a in lst:
            if not isinstance(a, str):
                continue
            s = a.strip()
            if not s:
                continue
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
    return out


def contains_phrase(haystack: str, phrase: str) -> bool:
    """Substring for multi-word / long phrases; word-boundary for short single tokens."""
    phrase = phrase.strip()
    if not phrase:
        return False
    h = haystack.lower()
    pl = phrase.lower()
    if " " in phrase or len(phrase) >= 5:
        return pl in h
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(pl)}(?![a-z0-9])", h, flags=re.IGNORECASE))


def score_categories(
    term: str,
    short_definition: str,
    full_definition: str,
    rules: dict[str, dict[str, list[str]]],
) -> dict[str, int]:
    term_h = term.strip()
    def_h = f"{short_definition} {full_definition}".strip()
    combined = f"{term_h} {def_h}"
    scores: dict[str, int] = {}

    for category, cfg in rules.items():
        excludes = cfg.get("exclude_terms") or []
        if any(contains_phrase(combined, ex) for ex in excludes if ex):
            continue

        score = 0
        for ph in cfg.get("strong_include_terms") or []:
            if ph and contains_phrase(term_h, ph):
                score += 3
        for ph in cfg.get("weak_include_terms") or []:
            if ph and contains_phrase(def_h, ph):
                score += 1

        if score > 0:
            scores[category] = score

    tl = term_h.lower()
    if tl in ANATOMY_EXACT_HEADWORDS:
        scores["Anatomy"] = scores.get("Anatomy", 0) + 3

    return scores


def pick_categories(scores: dict[str, int]) -> list[str]:
    if not scores:
        return list(FALLBACK_CATEGORIES)
    ordered = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return [c for c, _ in ordered[:2]]


def extract_parenthetical_aliases(term: str, aliases: list[str]) -> tuple[str, list[str]]:
    aliases = list(aliases)
    pattern = re.compile(r"\s*\(([^)]+)\)\s*")

    def repl(m: re.Match[str]) -> str:
        inner = m.group(1).strip()
        for part in re.split(r"\s*/\s*|\s+or\s+", inner, flags=re.IGNORECASE):
            p = part.strip()
            if p:
                aliases.append(p)
        return " "

    new_term = pattern.sub(repl, term)
    new_term = re.sub(r"\s+", " ", new_term).strip()
    return new_term, aliases


def try_canonical_lookup(
    term: str, canon_by_lower: dict[str, dict[str, Any]]
) -> tuple[str | None, dict[str, Any] | None]:
    key = term.strip().lower()
    if key in canon_by_lower:
        return key, canon_by_lower[key]
    return None, None


def apply_canonical_entry(
    term: str,
    aliases: list[str],
    old_term: str,
    entry: dict[str, Any],
) -> tuple[str, list[str]]:
    canonical = (entry.get("canonical_term") or "").strip()
    map_aliases = entry.get("aliases") if isinstance(entry.get("aliases"), list) else []
    if not canonical:
        return term, aliases
    new_aliases = merge_aliases(aliases, map_aliases, [old_term])
    return canonical, new_aliases


def apply_or_variants_then_canonical(
    term: str,
    aliases: list[str],
    canon_by_lower: dict[str, dict[str, Any]],
) -> tuple[str, list[str], str | None]:
    lk, entry = try_canonical_lookup(term, canon_by_lower)
    if entry is not None:
        t, a = apply_canonical_entry(term, aliases, term.strip(), entry)
        return t, a, lk

    if not re.search(r"\s+or\s+", term, flags=re.IGNORECASE):
        return term.strip(), aliases, None

    parts = [p.strip() for p in re.split(r"\s+or\s+", term, flags=re.IGNORECASE) if p.strip()]
    if len(parts) < 2:
        return term.strip(), aliases, None

    mapped: list[tuple[str, dict[str, Any], str]] = []
    unmapped: list[str] = []
    for p in parts:
        k, e = try_canonical_lookup(p, canon_by_lower)
        if e is not None:
            mapped.append((p, e, k or ""))
        else:
            unmapped.append(p)

    if mapped:
        first = mapped[0]
        canonical = (first[1].get("canonical_term") or "").strip()
        extra_aliases = merge_aliases(
            aliases,
            unmapped,
            [p for p, _, _ in mapped if p.lower() != canonical.lower()],
        )
        for _, e, _ in mapped[1:]:
            extra_aliases = merge_aliases(
                extra_aliases,
                e.get("aliases") if isinstance(e.get("aliases"), list) else [],
            )
        map_aliases = first[1].get("aliases") if isinstance(first[1].get("aliases"), list) else []
        new_aliases = merge_aliases(extra_aliases, map_aliases, parts)
        return canonical, new_aliases, first[2]

    longest = max(parts, key=len)
    rest = [p for p in parts if p != longest]
    return longest, merge_aliases(aliases, rest), None


def transform_record(
    rec: dict[str, Any],
    canon_by_lower: dict[str, dict[str, Any]],
    category_rules: dict[str, dict[str, list[str]]],
    stats: dict[str, Any],
) -> dict[str, Any]:
    out = copy.deepcopy(rec)
    original_snapshot = json.dumps(
        {
            "term": rec.get("term"),
            "slug": rec.get("slug"),
            "aliases": rec.get("aliases"),
            "categories": rec.get("categories"),
        },
        sort_keys=True,
    )

    term = (out.get("term") or "").strip()
    aliases = list(out.get("aliases") or []) if isinstance(out.get("aliases"), list) else []

    term_before_paren = term
    if "(" in term_before_paren and ")" in term_before_paren:
        stats["paren_or_touch"] = stats.get("paren_or_touch", 0) + 1

    term, aliases = extract_parenthetical_aliases(term, aliases)

    old_term_before_canon = term

    lk, entry = try_canonical_lookup(term, canon_by_lower)
    if entry is not None:
        term, aliases = apply_canonical_entry(term, aliases, old_term_before_canon, entry)
        stats["canonical_keys"].append(f"{lk} -> {term}")
        stats["mapped"] = stats.get("mapped", 0) + 1
    elif re.search(r"\s+or\s+", term, flags=re.IGNORECASE):
        term, aliases, mk = apply_or_variants_then_canonical(term, aliases, canon_by_lower)
        if mk:
            stats["canonical_keys"].append(f"{mk} -> {term}")
            stats["mapped"] = stats.get("mapped", 0) + 1

    out["term"] = term
    out["aliases"] = merge_aliases(aliases, [])
    out["slug"] = slugify(term)

    old_cats = list(out.get("categories") or []) if isinstance(out.get("categories"), list) else []
    short_def = (out.get("short_definition") or "").strip()
    full_def = (out.get("full_definition") or "").strip()
    new_cats = pick_categories(
        score_categories(term, short_def, full_def, category_rules)
    )
    out["categories"] = new_cats

    if frozenset(old_cats) != frozenset(new_cats):
        stats["category_changes"] = stats.get("category_changes", 0) + 1

    new_snapshot = json.dumps(
        {
            "term": out.get("term"),
            "slug": out.get("slug"),
            "aliases": out.get("aliases"),
            "categories": out.get("categories"),
        },
        sort_keys=True,
    )
    if new_snapshot != original_snapshot:
        stats["records_changed"] = stats.get("records_changed", 0) + 1

    return out


def pick_merge_winner(group: list[dict[str, Any]]) -> dict[str, Any]:
    manuals = [g for g in group if g.get("entry_method") == "manual"]
    pool = manuals if manuals else group
    return max(pool, key=lambda g: len((g.get("full_definition") or "")))


def merge_slug_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    if len(group) == 1:
        return copy.deepcopy(group[0])

    winner = pick_merge_winner(group)
    merged = copy.deepcopy(winner)

    all_aliases: list[str] = []
    all_kw: list[str] = []
    all_cats: list[str] = []
    priorities: list[int] = []

    for g in group:
        all_aliases = merge_aliases(all_aliases, list(g.get("aliases") or []))
        if isinstance(g.get("search_keywords"), list):
            all_kw = merge_aliases(all_kw, [str(x) for x in g["search_keywords"]])
        if isinstance(g.get("categories"), list):
            all_cats.extend(str(c) for c in g["categories"] if c)
        try:
            priorities.append(int(g.get("priority", 99)))
        except (TypeError, ValueError):
            priorities.append(99)

    merged["term"] = (winner.get("term") or "").strip()
    merged["slug"] = slugify(merged["term"])
    merged["aliases"] = merge_aliases(all_aliases, [winner.get("term", "")])
    merged["search_keywords"] = sorted({str(x) for x in all_kw if str(x).strip()})

    cat_seen: set[str] = set()
    cat_order: list[str] = []
    for c in all_cats:
        ck = c.lower()
        if ck in cat_seen:
            continue
        cat_seen.add(ck)
        cat_order.append(c)
    merged["categories"] = cat_order
    merged["priority"] = min(priorities) if priorities else 2

    best_def = max(group, key=lambda g: len((g.get("full_definition") or "")))
    merged["full_definition"] = best_def.get("full_definition", "")
    short_src = winner if (winner.get("short_definition") or "").strip() else best_def
    merged["short_definition"] = short_src.get("short_definition", "")

    return merged


def merge_by_slug(records: list[dict[str, Any]], stats: dict[str, Any]) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in records:
        if not isinstance(r, dict):
            continue
        slug = r.get("slug") or slugify((r.get("term") or "").strip())
        if not slug:
            slug = "invalid-slug"
        r = dict(r)
        r["slug"] = slug
        buckets[slug].append(r)

    out: list[dict[str, Any]] = []
    for slug, group in sorted(buckets.items(), key=lambda kv: kv[0].lower()):
        if len(group) > 1:
            stats["duplicate_slugs"].append(slug)
            stats["duplicate_merges"] += len(group) - 1
        out.append(merge_slug_group(group))
    return out


def main() -> None:
    if not INPUT_JSON.is_file():
        print(f"Missing input: {INPUT_JSON}", file=sys.stderr)
        sys.exit(1)
    if not CANON_MAP_PATH.is_file() or not CATEGORY_RULES_PATH.is_file():
        print("Missing config in config/", file=sys.stderr)
        sys.exit(1)

    raw_full = load_json(INPUT_JSON)
    if not isinstance(raw_full, list):
        print("Input must be a JSON array.", file=sys.stderr)
        sys.exit(1)

    skipped = sum(1 for r in raw_full if not isinstance(r, dict))
    raw = [r for r in raw_full if isinstance(r, dict)]

    canon_map = load_json(CANON_MAP_PATH)
    if not isinstance(canon_map, dict):
        print("canonical_term_map.json must be an object.", file=sys.stderr)
        sys.exit(1)

    category_rules = load_json(CATEGORY_RULES_PATH)
    if not isinstance(category_rules, dict):
        print("category_rules.json must be an object.", file=sys.stderr)
        sys.exit(1)

    canon_by_lower = {k.strip().lower(): v for k, v in canon_map.items()}

    stats: dict[str, Any] = {
        "canonical_keys": [],
        "mapped": 0,
        "paren_or_touch": 0,
        "category_changes": 0,
        "records_changed": 0,
        "duplicate_slugs": [],
        "duplicate_merges": 0,
    }

    transformed = [transform_record(r, canon_by_lower, category_rules, stats) for r in raw]
    merged = merge_by_slug(transformed, stats)

    three_plus = sum(1 for r in merged if len(r.get("categories") or []) >= 3)
    fallback_final = sum(
        1 for r in merged if (r.get("categories") or []) == FALLBACK_CATEGORIES
    )

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    input_count = len(raw_full)
    output_count = len(merged)
    lines = [
        "Glossary canonicalization report",
        "=" * 60,
        f"Input: {INPUT_JSON}",
        f"Output: {OUTPUT_JSON}",
        "",
        f"Input array length: {input_count}",
        f"Object records processed: {len(raw)}",
    ]
    if skipped:
        lines.append(f"Skipped non-object rows: {skipped}")
    lines.extend(
        [
            "",
            f"Output record count: {output_count}",
            f"Records changed (term/slug/aliases/categories vs input): {stats['records_changed']}",
            f"Canonical map entries applied (rows touched by map): {stats['mapped']}",
            f"Paren/or normalization passes (heuristic counter): {stats.get('paren_or_touch', 0)}",
            f"Category reassigned (per pre-merge row): {stats['category_changes']}",
            f"Duplicate slug groups merged: {len(stats['duplicate_slugs'])}",
            f"Input rows absorbed in merges: {stats['duplicate_merges']}",
            f"Output rows with only fallback category: {fallback_final}",
            f"Output rows with 3+ categories: {three_plus}",
            "",
            "Canonicalization mappings applied (from map keys used):",
        ]
    )
    seen_mk = sorted(set(stats["canonical_keys"]))
    if seen_mk:
        for line in seen_mk[:200]:
            lines.append(f"  - {line}")
        if len(seen_mk) > 200:
            lines.append(f"  ... and {len(seen_mk) - 200} more")
    else:
        lines.append("  (none)")

    lines.append("")
    lines.append("Duplicate slugs merged:")
    if stats["duplicate_slugs"]:
        for s in stats["duplicate_slugs"]:
            lines.append(f"  - {s}")
    else:
        lines.append("  (none)")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    print("\n".join(lines))
    print(f"\nWrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
