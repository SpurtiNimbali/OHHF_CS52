from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from classify import assert_resource_category, map_section_to_resource_category
from config import MAX_TITLE_LEN, MIN_TITLE_LEN, WEB_CHAT_SOURCE
from dedupe import dedupe_by_key
from export_json import (
    export_chat_knowledge,
    export_glossary,
    export_question_bank,
    export_resources,
    parse_zip_from_text,
)
from normalize import canonical_url, normalize_text, text_fingerprint
from parse_pdf import glossary_chat_rows, parse_pdf


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_pdf_path() -> Path | None:
    downloads = Path.home() / "Downloads"
    if not downloads.is_dir():
        return None
    matches = sorted(downloads.glob("*Therapist*Guide*Pediatric*Heart*.pdf"))
    return matches[0] if matches else None


def load_web_resources(path: Path) -> list[dict[str, str]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("ohhf_resources.json must be a JSON array")
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "")
        href = str(item.get("href") or "")
        section = str(item.get("section") or "")
        out.append({"title": title, "href": href, "section": section})
    return out


def is_junk_web_row(row: dict[str, str], canon: str | None) -> bool:
    title = normalize_text(row.get("title") or "")
    if not canon:
        return True
    if len(title) < MIN_TITLE_LEN or len(title) > MAX_TITLE_LEN:
        return True
    low = title.lower()
    if low in ("n/a", "none", "tbd"):
        return True
    return False


def web_to_resource_row(row: dict[str, str], canon: str) -> dict[str, object]:
    section = normalize_text(row.get("section") or "")
    title = normalize_text(row.get("title") or "")
    cat = assert_resource_category(map_section_to_resource_category(section))
    z = parse_zip_from_text(section, title)
    return {
        "name": title,
        "description": section,
        "link": canon,
        "city": None,
        "zipcode": z,
        "category": cat,
    }


def web_to_chat_row(row: dict[str, str], canon: str) -> dict[str, str]:
    return {
        "title": normalize_text(row.get("title") or ""),
        "url": canon,
        "section": normalize_text(row.get("section") or ""),
        "source": WEB_CHAT_SOURCE,
    }


def dedupe_glossary(entries: list[dict[str, str]]) -> tuple[list[dict[str, str]], int]:
    seen: dict[str, dict[str, str]] = {}
    order: list[str] = []
    dup = 0
    for e in entries:
        fp = text_fingerprint(e.get("term"))
        if not fp:
            continue
        if fp in seen:
            dup += 1
            if len(e.get("definition") or "") > len(seen[fp].get("definition") or ""):
                seen[fp] = e
            continue
        seen[fp] = e
        order.append(fp)
    return [seen[k] for k in order], dup


def main() -> None:
    root = repo_root()
    parser = argparse.ArgumentParser(description="OHHF scrape JSON + therapist PDF → four Supabase-oriented JSON files.")
    parser.add_argument("--resources", type=Path, default=root / "supabase_data_scripts" / "data_pipeline" / "input" / "ohhf_resources.json")
    parser.add_argument("--pdf", type=Path, default=root / "supabase_data_scripts" / "data_pipeline" / "input" / "OHHF_pdf.pdf")
    parser.add_argument("--out", type=Path, default=root / "supabase_data_scripts" / "data_pipeline" / "output")
    parser.add_argument("--pdf-slug", type=str, default=None, help="Override slug used in PDF source + synthetic URLs.")
    args = parser.parse_args()
    pdf_path = args.pdf or default_pdf_path()
    if not pdf_path or not pdf_path.is_file():
        print("Missing PDF: pass --pdf or place the therapist guide in Downloads.", file=sys.stderr)
        sys.exit(1)

    args.out.mkdir(parents=True, exist_ok=True)

    web = load_web_resources(args.resources.resolve())
    enriched: list[dict[str, str | None]] = []
    dropped_junk = 0
    for row in web:
        canon = canonical_url(row.get("href") or "")
        if is_junk_web_row(row, canon):
            dropped_junk += 1
            continue
        enriched.append({**row, "_canonical_url": canon})

    def url_key(r: dict[str, object]) -> str | None:
        u = r.get("_canonical_url")
        return str(u) if u else None

    deduped, url_stats = dedupe_by_key(enriched, url_key)

    resource_rows: list[dict[str, object]] = []
    chat_web: list[dict[str, str]] = []
    for row in deduped:
        canon = str(row.pop("_canonical_url", "") or "")
        resource_rows.append(web_to_resource_row(row, canon))
        chat_web.append(web_to_chat_row(row, canon))

    parsed = parse_pdf(pdf_path.resolve(), pdf_slug=args.pdf_slug)
    glossary_rows = [{"term": e.term, "definition": e.definition} for e in parsed.glossary]
    glossary_rows, gloss_dup = dedupe_glossary(glossary_rows)

    question_rows = [{"category": c, "question_text": q} for q, c in parsed.questions]
    seen_q: set[str] = set()
    uniq_questions: list[dict[str, str]] = []
    for qr in question_rows:
        fp = text_fingerprint(qr["question_text"])
        if fp in seen_q:
            continue
        seen_q.add(fp)
        uniq_questions.append(qr)

    chat_pdf = glossary_chat_rows(parsed.glossary, parsed.pdf_slug)
    chat_all = chat_web + chat_pdf
    chat_dedup, chat_url_stats = dedupe_by_key(
        [dict(x) for x in chat_all],
        lambda r: r.get("url") or None,
    )

    export_resources(resource_rows, args.out / "resources.json")
    export_question_bank(uniq_questions, args.out / "question_bank.json")
    export_glossary(glossary_rows, args.out / "glossary.json")
    export_chat_knowledge(chat_dedup, args.out / "chat_knowledge.json")

    report = {
        "resources_json": str(args.out / "resources.json"),
        "inputs": {
            "web_count": len(web),
            "pdf": str(pdf_path.resolve()),
            "pdf_slug": parsed.pdf_slug,
        },
        "web": {
            "dropped_junk": dropped_junk,
            "after_url_dedupe": len(deduped),
            "url_duplicate_merges": url_stats.by_canonical_url,
            "final_resources": len(resource_rows),
        },
        "glossary": {
            "raw_parsed": len(parsed.glossary),
            "fingerprint_deduped": gloss_dup,
            "final": len(glossary_rows),
        },
        "questions": {"final": len(uniq_questions)},
        "chat_knowledge": {
            "web_rows": len(chat_web),
            "pdf_rows": len(chat_pdf),
            "after_url_dedupe": len(chat_dedup),
            "url_duplicate_merges": chat_url_stats.by_canonical_url,
        },
    }
    (args.out / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
