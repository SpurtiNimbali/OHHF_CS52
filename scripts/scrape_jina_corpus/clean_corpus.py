"""
Clean scraped markdown corpus into metadata-rich JSON chunks.

Input folder:
    scripts/scrape_jina_corpus/corpus_scraped_data/

Output folder:
    scripts/scrape_jina_corpus/corpus_cleaned_chunks/
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple


INPUT_DIR = Path(__file__).resolve().parent / "corpus_scraped_data"
OUTPUT_DIR = Path(__file__).resolve().parent / "corpus_cleaned_chunks"

PAGE_SEPARATOR_RE = re.compile(r"(?m)^\s*---\s*$")
PAGE_HEADING_RE = re.compile(r"(?m)^\s*##\s*(\d+)\.\s*(.+?)\s*$")
SOURCE_RE = re.compile(r"(?m)^\s*\*\*Source:\*\*\s*(\S+)\s*$")
TITLE_LINE_RE = re.compile(r"(?m)^\s*Title:\s*(.+?)\s*$")
MD_CONTENT_RE = re.compile(r"(?s)\bMarkdown Content:\s*(.+)\s*$")

NOISE_PATTERNS = [
    re.compile(r"^\s*\[(skip to (main )?content.*?)\]\(.*\)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(menu|close menu|site search|search)\s*$", re.IGNORECASE),
    re.compile(
        r"^\s*(privacy policy|terms of use|cookie policy|cookie settings|all rights reserved)\b.*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*(facebook|twitter|x|instagram|youtube|linkedin|pinterest|share|print|email)\s*$",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*URL Source:\s*https?://\S+\s*$", re.IGNORECASE),
    re.compile(r"^\s*Markdown Content:\s*$", re.IGNORECASE),
]


def infer_filename_metadata(filename: str) -> Tuple[str, str]:
    """Infer source_group and topic_batch from source__topic.md format."""
    base = Path(filename).stem
    if "__" in base:
        source_group, topic_batch = base.split("__", 1)
        return source_group.strip() or "unknown_source", topic_batch.strip() or "unknown_topic"
    return "unknown_source", base or "unknown_topic"


def parse_pages(raw_text: str) -> List[Dict[str, object]]:
    """Split raw markdown into scraped pages and extract base metadata."""
    sections = [s.strip() for s in PAGE_SEPARATOR_RE.split(raw_text) if s.strip()]
    pages: List[Dict[str, object]] = []

    for section in sections:
        heading_match = PAGE_HEADING_RE.search(section)
        source_match = SOURCE_RE.search(section)

        # Skip top-level file metadata block that has no page heading/source.
        if not heading_match and not source_match:
            continue

        page_index = int(heading_match.group(1)) if heading_match else len(pages) + 1
        heading_title = heading_match.group(2).strip() if heading_match else ""

        source_url = source_match.group(1).strip() if source_match else ""
        title_match = TITLE_LINE_RE.search(section)
        title_line = title_match.group(1).strip() if title_match else ""
        title = title_line or heading_title or f"Page {page_index}"

        body_match = MD_CONTENT_RE.search(section)
        if body_match:
            raw_body = body_match.group(1).strip()
        else:
            # Fallback: remove metadata lines and keep remaining section text.
            raw_body = section
            raw_body = PAGE_HEADING_RE.sub("", raw_body)
            raw_body = SOURCE_RE.sub("", raw_body)
            raw_body = TITLE_LINE_RE.sub("", raw_body)
            raw_body = re.sub(r"(?m)^\s*URL Source:\s*.+$", "", raw_body)

        pages.append(
            {
                "page_index": page_index,
                "title": title,
                "source_url": source_url,
                "raw_body": raw_body.strip(),
            }
        )

    return pages


def is_link_list_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if re.match(r"^[-*]\s+\[.+\]\(https?://", stripped):
        return True
    if re.match(r"^\[.+\]\(https?://", stripped):
        return True
    if re.match(r"^https?://\S+$", stripped):
        return True
    return False


def is_probably_noise(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if any(pattern.match(stripped) for pattern in NOISE_PATTERNS):
        return True
    if re.match(r"^\s*[-*]\s*$", stripped):
        return True
    if re.match(r"^\s*[\W_]{4,}\s*$", stripped):
        return True
    # Very short non-heading/non-sentence lines are often nav crumbs or controls.
    if len(stripped) <= 2:
        return True
    return False


def trim_leading_navigation(lines: List[str]) -> List[str]:
    """
    Trim giant pre-article nav blocks common in scraped website markdown.
    Keeps content from the first likely article marker.
    """
    if not lines:
        return lines

    probe = lines[:140]
    linkish_count = sum(1 for line in probe if is_link_list_line(line))
    if linkish_count < 20:
        return lines

    start_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        # Common first real content indicators.
        if stripped.startswith("# ") and len(stripped) > 12:
            start_idx = i
            break
        if len(stripped) > 80 and not is_link_list_line(stripped):
            start_idx = i
            break

    return lines[start_idx:] if start_idx > 0 else lines


def merge_broken_lines(lines: List[str]) -> str:
    """
    Merge wrapped plain-text lines while preserving markdown structure.
    """
    out_lines: List[str] = []
    buffer: List[str] = []

    def flush_buffer() -> None:
        if buffer:
            out_lines.append(" ".join(part.strip() for part in buffer if part.strip()))
            buffer.clear()

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_buffer()
            if out_lines and out_lines[-1] != "":
                out_lines.append("")
            continue

        is_structured = (
            line.startswith("#")
            or line.startswith("- ")
            or line.startswith("* ")
            or line.startswith("> ")
            or line.startswith("|")
            or line.startswith("```")
            or bool(re.match(r"^\d+\.\s+", line))
        )

        if is_structured:
            flush_buffer()
            out_lines.append(line)
        else:
            buffer.append(line)

    flush_buffer()

    text = "\n".join(out_lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def clean_page_text(raw_body: str) -> str:
    """Remove common boilerplate/noise and normalize page text."""
    lines = [line.rstrip() for line in raw_body.splitlines()]
    lines = trim_leading_navigation(lines)

    cleaned_lines: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            cleaned_lines.append("")
            continue

        if is_probably_noise(stripped):
            continue
        if is_link_list_line(stripped):
            continue
        # Filter tiny menu-like fragments (while keeping meaningful headings).
        if (
            len(stripped) < 5
            and not stripped.startswith("#")
            and not re.match(r"^\d+\.", stripped)
        ):
            continue

        cleaned_lines.append(stripped)

    text = merge_broken_lines(cleaned_lines)
    return text


def chunk_text(text: str, target_words: int = 900, overlap_words: int = 100) -> List[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    if not words:
        return []

    min_chunk_words = max(250, target_words // 3)
    chunks: List[str] = []
    start = 0

    while start < len(words):
        end = min(start + target_words, len(words))
        remaining = len(words) - end

        # Avoid tiny tail chunks by appending tail to previous chunk.
        if remaining < min_chunk_words and chunks:
            tail_text = " ".join(words[start:])
            chunks[-1] = f"{chunks[-1]} {tail_text}".strip()
            break

        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))

        if end >= len(words):
            break
        start = max(0, end - overlap_words)

    return chunks


def process_file(md_path: Path) -> Tuple[List[Dict[str, object]], int]:
    """Process one markdown corpus file into chunk objects."""
    source_group, topic_batch = infer_filename_metadata(md_path.name)
    raw_text = md_path.read_text(encoding="utf-8", errors="ignore")
    pages = parse_pages(raw_text)

    chunks_output: List[Dict[str, object]] = []
    parsed_page_count = 0

    for page in pages:
        page_index = int(page["page_index"])
        title = str(page["title"]).strip() or f"Page {page_index}"
        source_url = str(page["source_url"]).strip()
        cleaned = clean_page_text(str(page["raw_body"]))

        # Skip pages that are still near-empty after cleanup.
        if len(cleaned.split()) < 40:
            continue

        parsed_page_count += 1
        page_chunks = chunk_text(cleaned, target_words=900, overlap_words=100)
        if not page_chunks:
            continue

        for chunk_index, chunk_text_value in enumerate(page_chunks):
            chunk_id = (
                f"{source_group}__{topic_batch}__{page_index:03d}__chunk_{chunk_index:03d}"
            )
            chunks_output.append(
                {
                    "chunk_id": chunk_id,
                    "source_url": source_url,
                    "title": title,
                    "source_group": source_group,
                    "topic_batch": topic_batch,
                    "original_file": md_path.name,
                    "page_index": page_index,
                    "chunk_index": chunk_index,
                    "text": chunk_text_value,
                }
            )

    return chunks_output, parsed_page_count


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_files = sorted(INPUT_DIR.glob("*.md"))

    files_processed = 0
    pages_extracted = 0
    chunks_created = 0

    if not md_files:
        print(f"No .md files found in: {INPUT_DIR}")
        return

    for md_file in md_files:
        try:
            chunks, page_count = process_file(md_file)
        except Exception as exc:
            # Keep processing other files even if one input is malformed.
            print(f"[WARN] Failed to process {md_file.name}: {exc}")
            continue

        out_name = f"{md_file.stem}_chunks.json"
        out_path = OUTPUT_DIR / out_name
        out_path.write_text(json.dumps(chunks, indent=2, ensure_ascii=False), encoding="utf-8")

        files_processed += 1
        pages_extracted += page_count
        chunks_created += len(chunks)
        print(f"[OK] {md_file.name} -> {out_name} ({len(chunks)} chunks)")

    print("\n=== Clean Corpus Summary ===")
    print(f"Files processed: {files_processed}")
    print(f"Pages extracted: {pages_extracted}")
    print(f"Chunks created: {chunks_created}")
    print(f"Output folder: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
