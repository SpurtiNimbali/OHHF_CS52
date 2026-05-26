from pathlib import Path
import json
import re
from utils.clean_glossary_text import clean_glossary_text
from utils.parse_glossary_entries import extract_glossary_sections, parse_glossary_entries
from utils.normalize_term import (
    slugify,
    infer_aliases,
    infer_categories,
    make_short_definition,
    normalize_for_merge,
)

BASE_DIR = Path(__file__).parent
INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


SOURCE_METADATA = {
    "childrens_heart_foundation_org__its_my_heart.md": {
        "source_name": "Children's Heart Foundation",
        "source_url": "https://www.childrensheartfoundation.org/about-chds/resources.html",
    },
    "mended_hearts_org__mended_little_heartguide__local_pdfs.md": {
        "source_name": "Mended Little Hearts",
        "source_url": "https://mendedhearts.org/mended-hearts-heartguide/",
    },
}


def _resolved_scraped_source_section(
    source_file: str, section_source_section: str | None
) -> str | None:
    if "its_my_heart" in source_file:
        return "glossary_of_terms"
    if "mended_little_heartguide" in source_file:
        return "glossary_common_chd_terms_and_abbreviations"
    return section_source_section


def build_record(raw_entry, source_file, source_meta, source_section=None):
    term = raw_entry["term"].strip()
    full_definition = raw_entry["definition"].strip()
    aliases = infer_aliases(term, full_definition)

    return {
        "term": term,
        "slug": slugify(term),
        "aliases": aliases,
        "categories": infer_categories(term, full_definition),
        "short_definition": make_short_definition(full_definition),
        "full_definition": full_definition,
        "source_name": source_meta["source_name"],
        "source_url": source_meta["source_url"],
        "raw_source_file": source_file,
        "source_section": _resolved_scraped_source_section(source_file, source_section),
        "entry_method": "scraped",
        "search_keywords": [],
        "priority": 2,
        "_normalized_term": normalize_for_merge(term),
    }


def _metadata_for_manual_json(json_path: Path) -> dict:
    base = json_path.name.replace("__manual_glossary_terms.json", "")
    md_key = f"{base}.md"
    return SOURCE_METADATA.get(md_key, {})


def load_manual_records_from_json(json_path: Path) -> list[dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{json_path.name}: expected a JSON array of records")

    meta = _metadata_for_manual_json(json_path)
    out: list[dict] = []

    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"{json_path.name}: item {idx} is not an object")

        term = (item.get("term") or "").strip()
        full_definition = (item.get("full_definition") or "").strip()
        if not term or not full_definition:
            raise ValueError(
                f"{json_path.name}: item {idx} missing required 'term' or 'full_definition'"
            )

        slug = item.get("slug") or slugify(term)

        aliases = item.get("aliases")
        if aliases is None:
            aliases = []
        elif not isinstance(aliases, list):
            aliases = list(aliases)

        if "categories" in item and item["categories"] is not None:
            categories = list(item["categories"])
        elif item.get("category"):
            categories = [str(item["category"])]
        else:
            categories = ["General Medical Terms"]

        short_definition = item.get("short_definition")
        if not short_definition:
            short_definition = make_short_definition(full_definition)

        source_name = item.get("source_name") or meta.get("source_name") or "Unknown"
        source_url = item.get("source_url")
        if source_url is None:
            source_url = meta.get("source_url", "")

        raw_source_file = item.get("raw_source_file") or json_path.name

        source_section = item.get("source_section")
        if source_section is None:
            source_section = ""

        search_keywords = item.get("search_keywords")
        if search_keywords is None:
            search_keywords = []
        elif not isinstance(search_keywords, list):
            search_keywords = list(search_keywords)

        priority = item.get("priority", 2)
        if priority is None:
            priority = 2

        out.append(
            {
                "term": term,
                "slug": slug,
                "aliases": aliases,
                "categories": categories,
                "short_definition": short_definition,
                "full_definition": full_definition,
                "source_name": source_name,
                "source_url": source_url,
                "raw_source_file": raw_source_file,
                "source_section": source_section,
                "entry_method": "manual",
                "search_keywords": search_keywords,
                "priority": priority,
                "_normalized_term": normalize_for_merge(term),
            }
        )

    return out


def _merge_two_scraped(primary: dict, secondary: dict) -> dict:
    if len(primary["full_definition"]) < len(secondary["full_definition"]):
        primary, secondary = secondary, primary

    out = dict(primary)
    out["aliases"] = sorted(set(primary["aliases"] + secondary["aliases"]))
    out["search_keywords"] = sorted(
        set(primary["search_keywords"] + secondary["search_keywords"])
    )
    return out


def _apply_manual_over_scraped(manual: dict, scraped: dict) -> dict:
    combined_aliases = sorted(set(manual["aliases"] + scraped["aliases"]))
    return {
        "term": manual["term"],
        "slug": manual["slug"],
        "aliases": combined_aliases,
        "categories": list(manual["categories"]),
        "short_definition": manual["short_definition"],
        "full_definition": manual["full_definition"],
        "source_name": manual["source_name"],
        "source_url": manual["source_url"],
        "raw_source_file": manual["raw_source_file"],
        "source_section": manual["source_section"],
        "entry_method": "manual",
        "search_keywords": list(manual["search_keywords"]),
        "priority": manual["priority"],
        "_normalized_term": manual["_normalized_term"],
    }


def _merge_two_manual(a: dict, b: dict) -> dict:
    if len(a["full_definition"]) >= len(b["full_definition"]):
        primary, secondary = a, b
    else:
        primary, secondary = b, a

    out = dict(primary)
    out["aliases"] = sorted(set(primary["aliases"] + secondary["aliases"]))
    out["search_keywords"] = sorted(
        set(primary["search_keywords"] + secondary["search_keywords"])
    )
    return out


def merge_scraped_and_manual(
    scraped: list[dict], manual: list[dict]
) -> tuple[list[dict], list[str]]:
    merged: dict[str, dict] = {}
    override_log: list[str] = []

    for r in scraped:
        key = r["_normalized_term"]
        if key not in merged:
            merged[key] = dict(r)
            continue

        existing = merged[key]
        if existing.get("entry_method") == "scraped":
            merged[key] = _merge_two_scraped(existing, r)
        else:
            merged[key] = _merge_two_manual(existing, r)

    for m in manual:
        key = m["_normalized_term"]
        if key not in merged:
            merged[key] = dict(m)
            continue

        existing = merged[key]
        if existing.get("entry_method") == "scraped":
            override_log.append(
                f"normalized={key!r} scraped_term={existing['term']!r} "
                f"-> manual_term={m['term']!r}"
            )
            merged[key] = _apply_manual_over_scraped(m, existing)
        else:
            merged[key] = _merge_two_manual(existing, m)

    final: list[dict] = []
    for record in merged.values():
        record = dict(record)
        record.pop("_normalized_term", None)
        final.append(record)

    return sorted(final, key=lambda r: r["term"].lower()), override_log


POSSIBLE_TERM_LINE_REGEX = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9/\-–—(),.'’& ]{1,90}:\s"
)


def _safe_preview(text: str, head_chars: int, tail_chars: int) -> tuple[str, str]:
    """Returns (head, tail) previews. If text is shorter than head+tail, tail is empty."""
    if len(text) <= head_chars + tail_chars:
        return text, ""
    return text[:head_chars], text[-tail_chars:]


def _section_structural_stats(raw_section: str, cleaned_section: str) -> dict:
    cleaned_lines = cleaned_section.splitlines()
    colon_lines = [ln for ln in cleaned_lines if ":" in ln]
    term_like_lines = [
        ln for ln in cleaned_lines if POSSIBLE_TERM_LINE_REGEX.match(ln)
    ]

    return {
        "raw_char_length": len(raw_section),
        "cleaned_char_length": len(cleaned_section),
        "cleaned_line_count": len(cleaned_lines),
        "cleaned_colon_count": cleaned_section.count(":"),
        "cleaned_lines_with_colon": len(colon_lines),
        "cleaned_lines_matching_term_pattern": len(term_like_lines),
        "colon_lines_sample": colon_lines[:40],
        "term_like_lines_sample": term_like_lines[:40],
    }


def _format_debug_section(
    file_name: str,
    section_index: int,
    section_name: str | None,
    source_section: str | None,
    raw_section: str,
    cleaned_section: str,
    entries: list[dict],
    debug_info: dict,
) -> list[str]:
    lines: list[str] = []
    display_name = section_name or "(unnamed section)"
    header_lines = [
        "",
        "=" * 80,
        f"File: {file_name}",
        f"Section {section_index + 1}: {display_name}",
        f"source_section: {source_section}",
        "=" * 80,
    ]
    lines.append("\n".join(header_lines))

    raw_head, raw_tail = _safe_preview(raw_section, 1000, 500)
    lines.append("\n-- Raw section preview (first 500 chars) --")
    lines.append(raw_section[:500])
    lines.append("\n-- Raw section preview (first 1000 chars) --")
    lines.append(raw_head)
    if raw_tail:
        lines.append("\n-- Raw section preview (last 500 chars) --")
        lines.append(raw_tail)
    else:
        lines.append("\n(Raw section shorter than 1500 chars; full content shown above.)")

    cleaned_head, cleaned_tail = _safe_preview(cleaned_section, 1000, 500)
    lines.append("\n-- Cleaned section preview (first 1000 chars) --")
    lines.append(cleaned_head)
    if cleaned_tail:
        lines.append("\n-- Cleaned section preview (last 500 chars) --")
        lines.append(cleaned_tail)
    else:
        lines.append(
            "\n(Cleaned section shorter than 1500 chars; full content shown above.)"
        )

    stats = _section_structural_stats(raw_section, cleaned_section)
    lines.append("\n-- Structural stats --")
    lines.append(f"  raw_char_length: {stats['raw_char_length']}")
    lines.append(f"  cleaned_char_length: {stats['cleaned_char_length']}")
    lines.append(f"  cleaned_line_count: {stats['cleaned_line_count']}")
    lines.append(f"  cleaned_colon_count: {stats['cleaned_colon_count']}")
    lines.append(f"  cleaned_lines_with_colon: {stats['cleaned_lines_with_colon']}")
    lines.append(
        f"  cleaned_lines_matching_term_pattern: {stats['cleaned_lines_matching_term_pattern']}"
    )
    lines.append(f"  total_regex_matches (pre-filter): {debug_info['total_regex_matches']}")
    lines.append(f"  accepted_entries: {len(entries)}")
    lines.append(f"  skipped_candidates: {len(debug_info['skipped'])}")

    lines.append("\n-- First 40 cleaned lines containing a colon --")
    if stats["colon_lines_sample"]:
        for i, ln in enumerate(stats["colon_lines_sample"], 1):
            lines.append(f"  [{i:>2}] {ln}")
    else:
        lines.append("  (none)")

    lines.append("\n-- First 40 cleaned lines matching the term-line regex --")
    if stats["term_like_lines_sample"]:
        for i, ln in enumerate(stats["term_like_lines_sample"], 1):
            lines.append(f"  [{i:>2}] {ln}")
    else:
        lines.append("  (none)")

    lines.append("\n-- Skipped candidate diagnostics --")
    skipped = debug_info["skipped"]
    if not skipped:
        lines.append("  (no candidates were skipped)")
    else:
        reason_counts: dict[str, int] = {}
        for item in skipped:
            reason_counts[item["reason"]] = reason_counts.get(item["reason"], 0) + 1
        lines.append("  Skip reason counts:")
        for reason, count in sorted(reason_counts.items(), key=lambda r: -r[1]):
            lines.append(f"    - {reason}: {count}")

        lines.append("  First 40 skipped candidates:")
        for i, item in enumerate(skipped[:40], 1):
            term_preview = item["term"][:80]
            def_preview = item["definition"][:120].replace("\n", " ")
            lines.append(
                f"    [{i:>2}] reason={item['reason']} | term={term_preview!r} | def={def_preview!r}"
            )

    lines.append("\n-- Extracted terms --")
    lines.append(f"  extracted_term_count: {len(entries)}")
    if not entries:
        lines.append("  (no terms extracted)")
    else:
        term_names = [e["term"] for e in entries]
        lines.append("  First 30 extracted terms:")
        for i, name in enumerate(term_names[:30], 1):
            lines.append(f"    [{i:>2}] {name}")
        if len(term_names) > 30:
            lines.append(f"\n  Full list (up to 100):")
            for i, name in enumerate(term_names[:100], 1):
                lines.append(f"    [{i:>3}] {name}")
            if len(term_names) > 100:
                lines.append(f"    ... and {len(term_names) - 100} more.")

    return lines


def main():
    scraped_records: list[dict] = []
    report_lines: list[str] = []
    debug_lines: list[str] = ["Glossary debug report", "=" * 80]

    md_files = sorted(INPUT_DIR.glob("*.md"))

    report_lines.append(f"Files scanned: {len(md_files)}")
    debug_lines.append(f"Files scanned: {len(md_files)}")

    for md_file in md_files:
        source_meta = SOURCE_METADATA.get(
            md_file.name,
            {
                "source_name": "Unknown",
                "source_url": "",
            },
        )

        text = md_file.read_text(encoding="utf-8", errors="ignore")
        sections = extract_glossary_sections(text, md_file.name)

        report_lines.append(f"\nFile: {md_file.name}")
        report_lines.append(f"Glossary sections found: {len(sections)}")

        debug_lines.append(f"\n{'#' * 80}")
        debug_lines.append(f"# File: {md_file.name}")
        debug_lines.append(f"# Glossary sections found: {len(sections)}")
        debug_lines.append(f"# Source file char length: {len(text)}")
        debug_lines.append("#" * 80)

        if not sections:
            debug_lines.append("(no glossary sections isolated for this file)")

        for section_index, section in enumerate(sections):
            section_text = section["text"]
            section_name = section.get("name")
            source_section = section.get("source_section")

            cleaned = clean_glossary_text(section_text)
            entries, debug_info = parse_glossary_entries(cleaned, return_debug=True)

            label = section_name or f"section {section_index + 1}"
            report_lines.append(
                f"  Section {section_index + 1} ({label}): {len(entries)} candidate entries"
            )

            debug_lines.extend(
                _format_debug_section(
                    md_file.name,
                    section_index,
                    section_name,
                    source_section,
                    section_text,
                    cleaned,
                    entries,
                    debug_info,
                )
            )

            for entry in entries:
                scraped_records.append(
                    build_record(
                        entry,
                        md_file.name,
                        source_meta,
                        source_section=source_section,
                    )
                )

    manual_paths = sorted(INPUT_DIR.glob("*__manual_glossary_terms.json"))
    manual_records: list[dict] = []
    for manual_path in manual_paths:
        manual_records.extend(load_manual_records_from_json(manual_path))

    merged_records, manual_override_log = merge_scraped_and_manual(
        scraped_records, manual_records
    )

    raw_records = scraped_records + manual_records

    raw_output = OUTPUT_DIR / "raw_glossary_terms.json"
    merged_output = OUTPUT_DIR / "merged_glossary_terms.json"
    report_output = OUTPUT_DIR / "glossary_extraction_report.txt"
    debug_output = OUTPUT_DIR / "glossary_debug_report.txt"

    raw_serializable = []
    for record in raw_records:
        cleaned = dict(record)
        cleaned.pop("_normalized_term", None)
        raw_serializable.append(cleaned)

    raw_output.write_text(
        json.dumps(raw_serializable, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    merged_output.write_text(
        json.dumps(merged_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    report_lines.append(f"\nScraped records: {len(scraped_records)}")
    report_lines.append(f"Manual records: {len(manual_records)}")
    report_lines.append(f"Total raw records: {len(raw_records)}")
    report_lines.append(f"Merged final records: {len(merged_records)}")
    report_lines.append(f"Manual files loaded: {len(manual_paths)}")
    for p in manual_paths:
        report_lines.append(f"  - {p.name}")
    report_lines.append(
        f"Manual overrides of scraped duplicates: {len(manual_override_log)}"
    )
    for msg in manual_override_log:
        report_lines.append(f"  - {msg}")

    report_output.write_text("\n".join(report_lines), encoding="utf-8")

    debug_lines.append(f"\nScraped records: {len(scraped_records)}")
    debug_lines.append(f"Manual records: {len(manual_records)}")
    debug_lines.append(f"Total raw records: {len(raw_records)}")
    debug_lines.append(f"Merged final records: {len(merged_records)}")
    debug_lines.append(f"Manual files loaded: {len(manual_paths)}")
    for p in manual_paths:
        debug_lines.append(f"  - {p.name}")
    debug_lines.append(
        f"Manual overrides of scraped duplicates: {len(manual_override_log)}"
    )
    for msg in manual_override_log:
        debug_lines.append(f"  - {msg}")
    debug_output.write_text("\n".join(debug_lines), encoding="utf-8")

    print(f"Raw glossary terms: {raw_output}")
    print(f"Merged glossary terms: {merged_output}")
    print(f"Report: {report_output}")
    print(f"Debug report: {debug_output}")


if __name__ == "__main__":
    main()
