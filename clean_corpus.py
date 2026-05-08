"""
Clean scraped markdown corpus into metadata-rich JSON chunks.

Defaults are tailored for this repo:
    Input folder:  <repo>/scraped_data/
    Output folder: <repo>/corpus_cleaned_chunks/

The script is intentionally tolerant of multiple scrape formats:
- "Scraped Content" dumps with `Markdown Content:` blocks
- "PDF Content" dumps that have `**Source:**` and raw extracted text
- Firecrawl "Crawled Content" dumps without `Markdown Content:`
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional


REPO_ROOT = Path(__file__).resolve().parent
INPUT_DIR = REPO_ROOT / "scraped_data"
OUTPUT_DIR = REPO_ROOT / "corpus_cleaned_chunks"

PAGE_SEPARATOR_RE = re.compile(r"(?m)^\s*---\s*$")
PAGE_HEADING_RE = re.compile(r"(?m)^\s*##\s*(\d+)\.\s*(.+?)\s*$")
SOURCE_RE = re.compile(r"(?m)^\s*\*\*Source:\*\*\s*(\S+)\s*$")
TITLE_LINE_RE = re.compile(r"(?m)^\s*Title:\s*(.+?)\s*$")
MD_CONTENT_RE = re.compile(r"(?s)\bMarkdown Content:\s*(.+)\s*$")
PUBLISHED_TIME_RE = re.compile(r"(?m)^\s*Published Time:\s*.+\s*$")
URL_SOURCE_RE = re.compile(r"(?m)^\s*URL Source:\s*https?://\S+\s*$", re.IGNORECASE)

JUNK_PAGE_PATTERNS = [
    # shop.aap.org / aap.org commerce UI dumps
    re.compile(r"internet explorer alert", re.IGNORECASE),
    re.compile(r"\bshopping cart\b", re.IGNORECASE),
    re.compile(r"\bcheckout\b", re.IGNORECASE),
    re.compile(r"\byour cart is empty\b", re.IGNORECASE),
    re.compile(r"\bprint items in cart\b", re.IGNORECASE),
    re.compile(r"\border subtotal\b", re.IGNORECASE),
]

JUNK_BLOCK_RES = [
    # OneTrust-style cookie consent blocks (Cincinnati Children's / others).
    re.compile(
        r"(?is)when you visit our website, we store cookies on your browser.*?(?:cookie list|allow all|manage consent preferences)\b.*?(?=\n\s*\n|$)"
    ),
    re.compile(r"(?is)###\s*manage consent preferences\b.*?(?=\n\s*\n|$)"),
    re.compile(r"(?is)####\s*(strictly necessary|performance|targeting)\s*cookies\b.*?(?=\n\s*\n|$)"),
    # Cookie preference center sections that appear at page footers.
    re.compile(
        r"(?is)##\s*preference center\b.*?(?:confirm my choices|apply cancel|allow all|reject all)\b.*?(?=\n\s*\n|$)"
    ),
    re.compile(
        r"(?is)###\s*cookie list\b.*?(?:confirm my choices|apply cancel)\b.*?(?=\n\s*\n|$)"
    ),
    # Fragments sometimes left after cookie banner removal.
    re.compile(r"(?is)\bconsent\s+leg\.interest\b.*?(?=\n\s*\n|$)"),
    re.compile(r"(?is)-\s*\[x\]\s*checkbox label label.*?(?=\n\s*\n|$)"),
    # Sisters by Heart "bulletin" repeated disclaimer/license blocks (remove entirely).
    re.compile(
        r"(?is)this bulletin is not intended to be a substitute for professional medical advice, diagnosis, or treatment\..*?po box 1866, mountain view, ca 94042, usa\.?\s*(?:page\s*\d+)?"
    ),
]

# Track boilerplate snippets we've already kept once so we can drop repeats.
SEEN_BOILERPLATE: set[str] = set()

BOILERPLATE_PATTERNS = [
    # Sisters by Heart single-ventricle guide disclaimer
    re.compile(
        r"This guide is not intended to be a substitute for professional medical advice, diagnosis, or treatment\..*?(?:911 immediately\.)",
        re.IGNORECASE | re.DOTALL,
    ),
    # Similar disclaimer used across some bulletins/PDF extractions
    re.compile(
        r"This bulletin is not intended to be a substitute for professional medical advice, diagnosis, or treatment\..*?(?:medical condition\.)",
        re.IGNORECASE | re.DOTALL,
    ),
    # AAP-standard site disclaimer
    re.compile(
        r"The information contained on this Web site should not be used as a substitute for the medical care and advice of your pediatrician\..*?(?:circumstances\.)",
        re.IGNORECASE | re.DOTALL,
    ),
]


def dedupe_boilerplate(text: str) -> str:
    """
    Remove boilerplate passages if we've already kept that exact passage once
    anywhere in the run. Also removes duplicates that occur multiple times
    within the same page.
    """
    global SEEN_BOILERPLATE

    for bp in BOILERPLATE_PATTERNS:
        matches = list(bp.finditer(text))
        if not matches:
            continue

        out: list[str] = []
        last = 0
        for m in matches:
            out.append(text[last : m.start()])
            snippet = re.sub(r"\s+", " ", m.group(0)).strip().lower()
            if snippet in SEEN_BOILERPLATE:
                # drop
                pass
            else:
                SEEN_BOILERPLATE.add(snippet)
                out.append(m.group(0))
            last = m.end()
        out.append(text[last:])
        text = "".join(out)

    return text

NOISE_PATTERNS = [
    re.compile(r"^\s*\[(skip to (main )?content.*?)\]\(.*\)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(menu|close menu|site search|search)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(popular search terms|navigate this area|section navigation)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(in this section|page content)\s*$", re.IGNORECASE),
    re.compile(r"^\s*follow us\s*$", re.IGNORECASE),
    re.compile(r"^\s*(article body|last updated)\b.*$", re.IGNORECASE),
    re.compile(r"^\s*©\s*copyright\b.*$", re.IGNORECASE),
    re.compile(r"^\s*the information contained on this web site\b.*$", re.IGNORECASE),
    re.compile(r"^\s*advertisement disclaimer\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(clear cart|order subtotal|looks like you haven't added anything)\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(go to cart|print items in cart)\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(internet explorer alert)\b.*$", re.IGNORECASE),
    re.compile(
        r"^\s*(privacy policy|terms of use|cookie policy|cookie settings|all rights reserved)\b.*$",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*when you visit our website, we store cookies\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(allow all|reject all)\s*$", re.IGNORECASE),
    re.compile(r"^\s*manage consent preferences\s*$", re.IGNORECASE),
    re.compile(r"^\s*cookie list\s*$", re.IGNORECASE),
    re.compile(r"^\s*powered by onetrust\b.*$", re.IGNORECASE),
    re.compile(r"^\s*set cookie preferences\b.*$", re.IGNORECASE),
    re.compile(r"^\s*preference center\s*$", re.IGNORECASE),
    re.compile(r"^\s*always active\s*$", re.IGNORECASE),
    re.compile(r"^\s*confirm my choices\s*$", re.IGNORECASE),
    re.compile(r"^\s*consent leg\\.interest\s*$", re.IGNORECASE),
    re.compile(
        r"^\s*(facebook|twitter|x|instagram|youtube|linkedin|pinterest|share|print|email)\s*$",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*Markdown Content:\s*$", re.IGNORECASE),
    re.compile(r"^\s*Page\s*\d+\s*(of|/)\s*\d+\s*$", re.IGNORECASE),
    re.compile(r"^\s*\[Page load link\]\(.*\)\s*$", re.IGNORECASE),
    re.compile(r"^\s*\[Go to Top\]\(.*\)\s*$", re.IGNORECASE),
    re.compile(r"^\s*enable accessibility\b.*$", re.IGNORECASE),
    re.compile(r"^\s*open the accessibility menu\b.*$", re.IGNORECASE),
    # Images and empty-media lines are almost always noise for embeddings/QA.
    re.compile(r"^\s*!\[.*?\]\(\s*https?://\S+\s*\)\s*$"),
    re.compile(r"^\s*!\[\]\(\s*https?://\S+\s*\)\s*$"),
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
            raw_body = PUBLISHED_TIME_RE.sub("", raw_body)
            raw_body = URL_SOURCE_RE.sub("", raw_body)

        pages.append(
            {
                "page_index": page_index,
                "title": title,
                "source_url": source_url,
                "raw_body": raw_body.strip(),
            }
        )

    return pages


def normalize_text(raw: str) -> str:
    """
    Normalize whitespace and common scrape artifacts without losing meaning.
    Keeps this conservative so we don't accidentally damage clinical phrasing.
    """
    if not raw:
        return ""

    # Normalize newlines/odd spaces from PDFs and crawlers.
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")  # NBSP
    text = text.replace("\u200b", "")  # zero-width space
    text = text.replace("\ufeff", "")  # BOM

    # Common PDF bullet glyph.
    text = text.replace("", "- ")
    # Normalize "smart" quotes/dashes lightly (optional, but helps dedup).
    text = text.replace("–", "-").replace("—", "-")

    # Remove large, repeated UI blocks (cookie consent, etc.) early.
    for block_re in JUNK_BLOCK_RES:
        text = block_re.sub("", text)

    # Remove inline image markdown (keep surrounding text).
    text = re.sub(r"!\[.*?\]\(\s*https?://\S+?\s*\)", "", text)
    # Remove empty-anchor links like `[](...)` that come from icon/nav scraps.
    text = re.sub(r"\[\s*\]\(\s*https?://\S+?\s*\)", "", text)
    # Remove javascript pseudo-links from scraped navigation/toolbars.
    text = re.sub(r"\[[^\]]*?\]\(\s*javascript:[^)]+?\)", "", text, flags=re.IGNORECASE)
    # Clean up stray punctuation left behind by removed pseudo-links.
    text = re.sub(r"\)\s*\[", "[", text)
    # Remove leftover "Browsehappy" / browser nag artifacts.
    text = re.sub(r"https?://browsehappy\.com\S*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def is_junk_page(cleaned_text: str) -> bool:
    """
    Detect pages that are primarily UI boilerplate (e.g., shopping cart/browser alerts).
    If these leak into the corpus they hurt retrieval quality a lot.
    """
    if not cleaned_text:
        return True
    hits = sum(1 for pat in JUNK_PAGE_PATTERNS if pat.search(cleaned_text))
    # One strong signal is enough for commerce dumps, but require 2 hits to be safe.
    return hits >= 2


def split_sentences(text: str) -> List[str]:
    """
    Heuristic sentence splitter (good enough for chunk boundaries).
    Keeps punctuation with the sentence.
    """
    t = re.sub(r"\s+", " ", text).strip()
    if not t:
        return []
    # Split on ., !, ? followed by whitespace and a likely sentence start.
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9“\"(])", t)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(
    text: str,
    target_words: int = 900,
    overlap_paragraphs: int = 1,
    overlap_sentences: int = 2,
) -> List[str]:
    """
    Chunk text while avoiding random cut points.

    Strategy:
    - Prefer paragraph boundaries when we have them.
    - If we effectively have one giant paragraph (common in PDFs), chunk by sentences.
    """
    text = text.strip()
    if not text:
        return []

    # Paragraph-first: blank lines or headings create natural separators.
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    if len(paragraphs) >= 3:
        chunks: List[str] = []
        cur: List[str] = []
        cur_words = 0

        def flush() -> None:
            nonlocal cur, cur_words
            if not cur:
                return
            chunks.append("\n\n".join(cur).strip())
            # overlap: keep whole trailing paragraphs (not word-slices).
            if overlap_paragraphs > 0:
                tail_paras = cur[-overlap_paragraphs:]
                cur = list(tail_paras)
                cur_words = sum(len(p.split()) for p in cur)
            else:
                cur, cur_words = [], 0

        for p in paragraphs:
            w = len(p.split())
            if cur_words + w > target_words and cur_words >= max(250, target_words // 3):
                flush()
            cur.append(p)
            cur_words += w

        if cur:
            chunks.append("\n\n".join(cur).strip())
        return [c for c in chunks if len(c.split()) >= 80]

    # Sentence fallback (PDF-ish text).
    sentences = split_sentences(text)
    if not sentences:
        return []

    chunks2: List[str] = []
    cur2: List[str] = []
    cur2_words = 0

    def flush2() -> None:
        nonlocal cur2, cur2_words
        if not cur2:
            return
        chunks2.append(" ".join(cur2).strip())
        # overlap: keep whole trailing sentences (keeps sentence boundaries).
        if overlap_sentences > 0:
            tail_sents = cur2[-overlap_sentences:]
            cur2 = list(tail_sents)
            cur2_words = len(" ".join(cur2).split())
        else:
            cur2, cur2_words = [], 0

    for s in sentences:
        w = len(s.split())
        if cur2_words + w > target_words and cur2_words >= max(250, target_words // 3):
            flush2()
        cur2.append(s)
        cur2_words += w

    if cur2:
        chunks2.append(" ".join(cur2).strip())
    return [c for c in chunks2 if len(c.split()) >= 80]

def is_link_list_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if re.match(r"^[-*]?\s*\[\s*\]\(https?://", stripped):
        return True
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

    in_code_block = False

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_buffer()
            if out_lines and out_lines[-1] != "":
                out_lines.append("")
            continue

        if line.startswith("```"):
            flush_buffer()
            out_lines.append(line)
            in_code_block = not in_code_block
            continue
        if in_code_block:
            # Preserve code blocks verbatim.
            out_lines.append(raw.rstrip("\n"))
            continue

        is_structured = (
            line.startswith("#")
            or line.startswith("- ")
            or line.startswith("* ")
            or line.startswith("> ")
            or line.startswith("|")
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
    raw_body = normalize_text(raw_body)
    lines = [line.rstrip() for line in raw_body.splitlines()]
    lines = trim_leading_navigation(lines)

    cleaned_lines: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            cleaned_lines.append("")
            continue

        # Drop common inline accessibility/nav phrases even when mixed into a line.
        stripped = re.sub(r"\bskip to main content\b", "", stripped, flags=re.IGNORECASE).strip()
        stripped = re.sub(r"\benable accessibility\b.*$", "", stripped, flags=re.IGNORECASE).strip()
        stripped = re.sub(r"\bopen the accessibility menu\b.*$", "", stripped, flags=re.IGNORECASE).strip()
        stripped = re.sub(r"\bskip ribbon commands\b.*$", "", stripped, flags=re.IGNORECASE).strip()
        if not stripped:
            cleaned_lines.append("")
            continue

        if is_probably_noise(stripped):
            continue
        if is_link_list_line(stripped):
            continue
        # Drop image-only lines even if they weren't caught by NOISE_PATTERNS.
        if re.match(r"^\s*!\[.*?\]\(\s*https?://\S+\s*\)\s*$", stripped):
            continue
        # Drop lines that are only punctuation/crumbs after normalization.
        if re.match(r"^[|•·\\-\\u2022\\u25cf\\u25aa\\u25a0\\s]+$", stripped):
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
    text = dedupe_boilerplate(text)
    # Final pass: remove repeated whitespace and stray separators.
    text = re.sub(r"(?m)^\s*-\s*$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def process_file(md_path: Path) -> Tuple[List[Dict[str, object]], int]:
    """Process one markdown corpus file into chunk objects."""
    source_group, topic_batch = infer_filename_metadata(md_path.name)
    raw_text = md_path.read_text(encoding="utf-8", errors="ignore")
    raw_text = normalize_text(raw_text)
    pages = parse_pages(raw_text)

    # Some dumps may not follow the expected page/section format.
    if not pages:
        pages = [
            {
                "page_index": 1,
                "title": md_path.stem.replace("_", " ").strip() or "Untitled",
                "source_url": "",
                "raw_body": raw_text,
            }
        ]

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
        # Skip pages that are basically UI/commerce boilerplate.
        if is_junk_page(cleaned):
            continue

        parsed_page_count += 1
        page_chunks = chunk_text(cleaned, target_words=900, overlap_paragraphs=1, overlap_sentences=2)
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
