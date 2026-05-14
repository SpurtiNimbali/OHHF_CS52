"""
Lightweight QA/review for merged glossary JSON (read-only).

Reads:  output/merged_glossary_terms.json
Writes: output/glossary_review.csv
         output/glossary_quality_flags.json
         output/glossary_quality_report.txt

Issue flags (issue_flags column is sorted, semicolon-separated):
  Per-record heuristics:
    possible_duplicate_acronym_or_alias — set when any duplicate-family rule fires
    term_contains_or
    term_contains_parentheses_but_no_alias
    aliases_empty_for_acronym_like_term
    category_general_medical_terms
    category_count_high — 3+ categories
    short_equals_full_definition
    missing_period — short_definition does not end with . ? !
    term_very_long — more than 4 words
    term_starts_lowercase
    definition_very_long — full_definition has more than 80 words
  Duplicate helpers (also set possible_duplicate_acronym_or_alias):
    duplicate_shared_normalized_term — same normalized term as another row
    term_nested_inside_another_term — one normalized term is a whole-word
      subphrase of another (len >= 3)
    alias_equals_other_term — an alias equals another record's term (case-insensitive)

Run:
  py -3 scripts/glossary_terms_pipeline/review_glossary_terms.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
INPUT_JSON = BASE_DIR / "output" / "merged_glossary_terms.json"
OUTPUT_DIR = BASE_DIR / "output"
CSV_PATH = OUTPUT_DIR / "glossary_review.csv"
FLAGS_JSON_PATH = OUTPUT_DIR / "glossary_quality_flags.json"
REPORT_PATH = OUTPUT_DIR / "glossary_quality_report.txt"


def normalize_for_dedupe(text: str) -> str:
    """Lowercase; drop punctuation and parentheses; collapse whitespace."""
    s = text.lower()
    s = re.sub(r"[^a-z0-9\s]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def norm_contains_as_words(needle: str, haystack: str) -> bool:
    """True if needle appears in haystack as a contiguous sequence of whole words."""
    if len(needle) < 3 or len(needle) >= len(haystack):
        return False
    return f" {haystack} ".find(f" {needle} ") >= 0


def word_count(text: str) -> int:
    return len(text.split())


def term_word_count(term: str) -> int:
    return len(term.split())


def is_acronym_like_term(term: str) -> bool:
    t = term.strip()
    if not t:
        return False
    if re.fullmatch(r"[A-Z]{2,8}", t):
        return True
    if re.fullmatch(r"[A-Z]{2,8}/[A-Z]{2,8}", t):
        return True
    if re.fullmatch(r"[A-Z]{2,8}\s+or\s+[A-Z]{2,8}", t, flags=re.IGNORECASE):
        return True
    return bool(re.search(r"\b[A-Z]{2,6}\b", t))


def parenthetical_tokens(term: str) -> list[str]:
    """Text inside (...) in term, trimmed."""
    return [m.group(1).strip() for m in re.finditer(r"\(([^)]+)\)", term)]


def collect_per_record_flags(records: list[dict]) -> tuple[list[set[str]], list[str]]:
    """
    Returns parallel list of flag sets per record index, and review_notes per index.
    Duplicate-related flags are filled in a second pass.
    """
    n = len(records)
    flag_sets: list[set[str]] = [set() for _ in range(n)]
    notes: list[str] = ["" for _ in range(n)]

    for i, rec in enumerate(records):
        term = (rec.get("term") or "").strip()
        slug = (rec.get("slug") or "").strip()
        aliases = rec.get("aliases") if isinstance(rec.get("aliases"), list) else []
        categories = (
            rec.get("categories") if isinstance(rec.get("categories"), list) else []
        )
        short_def = (rec.get("short_definition") or "").strip()
        full_def = (rec.get("full_definition") or "").strip()

        if re.search(r"\s+or\s+", term, flags=re.IGNORECASE):
            flag_sets[i].add("term_contains_or")

        if "(" in term and ")" in term:
            chunks = parenthetical_tokens(term)
            alias_list = [str(a).strip() for a in aliases if isinstance(a, str)]

            def chunk_covered(chunk: str) -> bool:
                cl = chunk.lower().strip()
                if not cl:
                    return True
                for a in alias_list:
                    al = a.lower()
                    if al == cl or al in cl or cl in al:
                        return True
                return False

            if not alias_list:
                flag_sets[i].add("term_contains_parentheses_but_no_alias")
            elif chunks and not all(chunk_covered(c) for c in chunks):
                flag_sets[i].add("term_contains_parentheses_but_no_alias")

        if is_acronym_like_term(term) and len(aliases) == 0:
            flag_sets[i].add("aliases_empty_for_acronym_like_term")

        if "General Medical Terms" in categories:
            flag_sets[i].add("category_general_medical_terms")

        if len(categories) >= 3:
            flag_sets[i].add("category_count_high")

        if short_def and full_def:
            if re.sub(r"\s+", " ", short_def) == re.sub(r"\s+", " ", full_def):
                flag_sets[i].add("short_equals_full_definition")

        if short_def and not re.search(r"[.!?]\s*$", short_def):
            flag_sets[i].add("missing_period")

        if term_word_count(term) > 4:
            flag_sets[i].add("term_very_long")

        if term and term[0].islower():
            flag_sets[i].add("term_starts_lowercase")

        if word_count(full_def) > 80:
            flag_sets[i].add("definition_very_long")

    # --- Duplicate detection ---
    norm_to_indices: dict[str, list[int]] = defaultdict(list)
    for i, rec in enumerate(records):
        term = (rec.get("term") or "").strip()
        key = normalize_for_dedupe(term)
        if key:
            norm_to_indices[key].append(i)

    for key, idxs in norm_to_indices.items():
        if len(idxs) <= 1:
            continue
        slugs = [records[j].get("slug", "") for j in idxs]
        msg = f"Shared normalized term {key!r}: slugs {', '.join(slugs)}"
        for j in idxs:
            flag_sets[j].add("duplicate_shared_normalized_term")
            flag_sets[j].add("possible_duplicate_acronym_or_alias")
            notes[j] = _append_note(notes[j], msg)

    # Term appears inside another term (normalized substring, distinct records)
    norms = [(i, normalize_for_dedupe((records[i].get("term") or "").strip())) for i in range(n)]
    for i, ni in norms:
        if len(ni) < 3:
            continue
        for j, nj in norms:
            if i == j or len(nj) < 3:
                continue
            if ni != nj and norm_contains_as_words(ni, nj):
                flag_sets[i].add("term_nested_inside_another_term")
                flag_sets[j].add("term_nested_inside_another_term")
                flag_sets[i].add("possible_duplicate_acronym_or_alias")
                flag_sets[j].add("possible_duplicate_acronym_or_alias")
                t_i = (records[i].get("term") or "").strip()
                t_j = (records[j].get("term") or "").strip()
                notes[i] = _append_note(
                    notes[i], f"Normalized term is substring of another: vs {t_j!r}"
                )
                notes[j] = _append_note(
                    notes[j], f"Another normalized term is substring: {t_i!r}"
                )

    # Alias of one record equals another record's term (case-insensitive)
    term_lower_by_index = [
        (records[k].get("term") or "").strip().lower() for k in range(n)
    ]
    slug_by_index = [records[k].get("slug", "") for k in range(n)]

    for i, rec in enumerate(records):
        aliases = rec.get("aliases") if isinstance(rec.get("aliases"), list) else []
        for alias in aliases:
            if not isinstance(alias, str):
                continue
            a = alias.strip().lower()
            if not a:
                continue
            for j in range(n):
                if i == j:
                    continue
                if a == term_lower_by_index[j]:
                    flag_sets[i].add("alias_equals_other_term")
                    flag_sets[j].add("alias_equals_other_term")
                    flag_sets[i].add("possible_duplicate_acronym_or_alias")
                    flag_sets[j].add("possible_duplicate_acronym_or_alias")
                    notes[i] = _append_note(
                        notes[i],
                        f"Alias {alias!r} equals term of slug {slug_by_index[j]!r}",
                    )
                    notes[j] = _append_note(
                        notes[j],
                        f"Term matched as alias on slug {slug_by_index[i]!r} ({alias!r})",
                    )

    return flag_sets, notes


def _append_note(existing: str, fragment: str) -> str:
    fragment = fragment.strip()
    if not fragment:
        return existing
    if not existing:
        return fragment
    if fragment in existing:
        return existing
    return f"{existing} | {fragment}"


def semicolon_join(values: list[str] | set[str]) -> str:
    return ";".join(sorted(values))


def csv_cell_list(items: list) -> str:
    if not items:
        return ""
    parts = []
    for x in items:
        if x is None:
            continue
        parts.append(str(x).replace(";", ","))
    return ";".join(parts)


def main() -> None:
    if not INPUT_JSON.is_file():
        print(f"Missing input: {INPUT_JSON}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    records = json.loads(INPUT_JSON.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        print("merged_glossary_terms.json must be a JSON array.", file=sys.stderr)
        sys.exit(1)

    flag_sets, notes = collect_per_record_flags(records)

    # CSV
    fieldnames = [
        "term",
        "slug",
        "aliases",
        "categories",
        "short_definition",
        "source_name",
        "source_section",
        "entry_method",
        "priority",
        "issue_flags",
        "review_notes",
    ]

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for i, rec in enumerate(records):
            aliases = rec.get("aliases") if isinstance(rec.get("aliases"), list) else []
            categories = (
                rec.get("categories") if isinstance(rec.get("categories"), list) else []
            )
            w.writerow(
                {
                    "term": rec.get("term", ""),
                    "slug": rec.get("slug", ""),
                    "aliases": csv_cell_list(aliases),
                    "categories": csv_cell_list(categories),
                    "short_definition": rec.get("short_definition", ""),
                    "source_name": rec.get("source_name", ""),
                    "source_section": rec.get("source_section", ""),
                    "entry_method": rec.get("entry_method", ""),
                    "priority": rec.get("priority", ""),
                    "issue_flags": semicolon_join(flag_sets[i]),
                    "review_notes": notes[i],
                }
            )

    # JSON flags
    flags_payload = []
    for i, rec in enumerate(records):
        flags_payload.append(
            {
                "slug": rec.get("slug", ""),
                "term": rec.get("term", ""),
                "flags": sorted(flag_sets[i]),
                "review_notes": notes[i],
            }
        )

    FLAGS_JSON_PATH.write_text(
        json.dumps(flags_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Report
    flag_counts: dict[str, int] = defaultdict(int)
    for fs in flag_sets:
        for fl in fs:
            flag_counts[fl] += 1

    with_any = sum(1 for fs in flag_sets if fs)
    lines = [
        "Glossary quality review",
        "=" * 60,
        f"Input: {INPUT_JSON}",
        f"Total records: {len(records)}",
        f"Records with at least one flag: {with_any}",
        "",
        "Flag counts (records may have multiple flags):",
    ]
    for name in sorted(flag_counts.keys()):
        lines.append(f"  {name}: {flag_counts[name]}")
    lines.extend(
        [
            "",
            f"Outputs written:",
            f"  {CSV_PATH}",
            f"  {FLAGS_JSON_PATH}",
            f"  {REPORT_PATH}",
        ]
    )

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
