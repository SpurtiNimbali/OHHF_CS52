"""
Clean scraped markdown corpus into metadata-rich JSON chunks.

Input folder:
    scripts/scrape_jina_corpus/corpus_scraped_data/

Output folder:
    scripts/scrape_jina_corpus/corpus_cleaned_chunks/

Summary reports:
    scripts/scrape_jina_corpus/report_files/clean_corpus_report_<timestamp>.txt
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


INPUT_DIR = Path(__file__).resolve().parent / "corpus_scraped_data"
OUTPUT_DIR = Path(__file__).resolve().parent / "corpus_cleaned_chunks"
REPORT_DIR = Path(__file__).resolve().parent / "report_files"

PAGE_SEPARATOR_RE = re.compile(r"(?m)^\s*---\s*$")
PAGE_HEADING_RE = re.compile(r"(?m)^\s*##\s*(\d+)\.\s*(.+?)\s*$")
SOURCE_RE = re.compile(r"(?m)^\s*\*\*Source:\*\*\s*(\S+)\s*$")
TITLE_LINE_RE = re.compile(r"(?m)^\s*Title:\s*(.+?)\s*$")
MD_CONTENT_RE = re.compile(r"(?s)\bMarkdown Content:\s*(.+)\s*$")

PAGE_COMMENT_RE = re.compile(r"(?m)^\s*<!--\s*Page\s+\d+\s*-->\s*$")

PDF_METADATA_LINE_RES = [
    re.compile(r"(?m)^\s*Title:\s*.+\s*$"),
    re.compile(r"(?m)^\s*URL Source:\s*.+\s*$"),
    re.compile(r"(?m)^\s*Published Time:\s*.+\s*$"),
    re.compile(r"(?m)^\s*Number of Pages:\s*.+\s*$"),
    re.compile(r"(?m)^\s*Markdown Content:\s*$"),
]

FOOTER_BOILERPLATE_RES = [
    re.compile(r"copyright\s*©", re.IGNORECASE),
    re.compile(r"\ball rights reserved\b", re.IGNORECASE),
    re.compile(r"\bvisit .+ to learn more\b", re.IGNORECASE),
    re.compile(r"call\s+1[\s\-]?800", re.IGNORECASE),
    re.compile(r"^how can i learn more\??\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^my questions:\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^forward this email\s*$", re.IGNORECASE | re.MULTILINE),
    re.compile(r"safeunsubscribe", re.IGNORECASE),
    # Standalone small integers often are PDF page numbers (avoid 4+ digits: years)
    re.compile(r"^\s*\d{1,3}\s*$"),
]

ROBOT_OR_SECURITY_SNIPPETS = (
    "robot challenge screen",
    "checking the site connection security",
    "warning: this page maybe requiring captcha",
    "cloudflare",
    "enable javascript and cookies",
)

KNOWN_SECTION_HEADINGS = {
    "glossary",
    "surgery",
    "symptoms and treatment",
    "preparing for hospitalization",
    "common tests and procedures",
    "introduction",
    "equipment",
    "medications",
    "references",
    "index",
    "appendix",
}

ROMAN_SECTION_RE = re.compile(
    r"^\s*(?:I{1,3}|IV|V|VI|VII|VIII|IX|X|XI|XII)\.\s+.+", re.IGNORECASE
)

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


@dataclass
class CleanCorpusStats:
    files_processed: int = 0
    pages_extracted: int = 0
    chunks_created: int = 0
    pdf_like_pages: int = 0
    html_like_pages: int = 0
    skipped_robot_pages: int = 0
    skipped_empty_pages: int = 0
    skipped_pages_no_chunks: int = 0
    skipped_boilerplate_chunks: int = 0


def infer_filename_metadata(filename: str) -> Tuple[str, str]:
    """Infer source_group and topic_batch from source__topic.md format."""
    base = Path(filename).stem
    if "__" in base:
        source_group, topic_batch = base.split("__", 1)
        return source_group.strip() or "unknown_source", topic_batch.strip() or "unknown_topic"
    return "unknown_source", base or "unknown_topic"


def _page_header_for_detection(section: str, max_chars: int = 6000) -> str:
    """Small prefix of the scraped page block for PDF hints (avoids huge copies)."""
    s = section.strip()
    if len(s) <= max_chars:
        return s
    return s[:max_chars]


def is_pdf_like_page(source_url: str, raw_page_block: str, original_file: str) -> bool:
    """Detect PDF-derived or local-PDF markdown pages."""
    orig_l = original_file.lower()
    if orig_l.endswith("__local_pdfs.md"):
        return True
    su = (source_url or "").strip().lower()
    if su.endswith(".pdf"):
        return True
    if "local_pdf_resources/" in su or "local_pdf_resources\\" in su:
        return True
    head = _page_header_for_detection(raw_page_block)
    if "Number of Pages:" in head:
        return True
    return False


def is_robot_or_security_page(text: str) -> bool:
    low = text.lower()
    return any(snippet in low for snippet in ROBOT_OR_SECURITY_SNIPPETS)


def _strip_pdf_metadata_lines(text: str) -> str:
    for pattern in PDF_METADATA_LINE_RES:
        text = pattern.sub("", text)
    return text


def _remove_page_comments(text: str) -> str:
    text = PAGE_COMMENT_RE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _trim_isbn_only_lines(lines: List[str]) -> List[str]:
    out: List[str] = []
    for line in lines:
        s = line.strip()
        if re.match(r"^ISBN[:\s]?\s*[\d\-X]+", s, re.IGNORECASE):
            continue
        out.append(line)
    return out


def _trim_leading_long_copyright_block(text: str) -> str:
    """If the opening blob is dominated by copyright/ISBN noise, drop it once (conservative)."""
    t = text.strip()
    if len(t) < 500:
        return text
    first_segment, sep, rest = t.partition("\n\n")
    if not sep:
        first_segment = t[:1200]
        rest = t[1200:]
    low = first_segment.lower()
    if "copyright" not in low and "©" not in low:
        return text
    if ("isbn" in low or "all rights reserved" in low) and len(first_segment) > 200:
        if rest and len(rest.split()) > 80:
            return rest.strip()
    return text


def _trim_leading_toc_block(text: str) -> str:
    """If a huge TOC sits at the start, drop until first major section cue."""
    low = text.lower()
    if "table of contents" not in low[:2500]:
        return text
    lines = text.splitlines()
    if len(lines) < 60:
        return text
    toc_start = None
    for i, ln in enumerate(lines[:80]):
        if "table of contents" in ln.lower():
            toc_start = i
            break
    if toc_start is None:
        return text
    toc_run = 0
    for j in range(toc_start, min(len(lines), toc_start + 200)):
        s = lines[j].strip()
        if not s:
            continue
        if len(s) < 120 and not s.endswith("."):
            toc_run += 1
        else:
            toc_run = max(0, toc_run - 1)
        if toc_run > 45:
            remainder = lines[j + 1 :]
            if not remainder:
                return text
            joined = "\n".join(remainder).lstrip()
            if len(joined.split()) < 200:
                return text
            return joined
    return text


def _filter_footer_boilerplate_lines(lines: List[str]) -> List[str]:
    kept: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            kept.append("")
            continue
        if len(stripped) <= 3 and re.match(r"^\d+$", stripped):
            continue
        drop = False
        low_stripped = stripped.lower()
        if "this email was sent to" in low_stripped and "@" in stripped:
            continue
        if "update profile/email address" in low_stripped and "|" in stripped:
            continue
        for pat in FOOTER_BOILERPLATE_RES:
            if pat.search(stripped):
                drop = True
                break
        if drop and len(stripped) < 120:
            continue
        kept.append(line)
    return kept


def merge_broken_lines(lines: List[str]) -> str:
    """Merge wrapped plain-text lines while preserving markdown structure."""
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
            or line.strip().startswith("•")
            or line.startswith("")
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


def merge_pdf_lines(lines: List[str]) -> str:
    """Like merge_broken_lines but treat common PDF bullet glyphs as list markers."""
    normalized: List[str] = []
    for raw in lines:
        line = raw.rstrip()
        if re.match(r"^\s*\s*$", line) or re.match(r"^\s*•\s*$", line):
            normalized.append("* ")
        else:
            line = re.sub(r"^(\s*)\s+", r"\1* ", line)
            line = re.sub(r"^(\s*)•\s+", r"\1* ", line)
            normalized.append(line)
    return merge_broken_lines(normalized)


def clean_pdf_text(text: str) -> str:
    """PDF-oriented cleanup: metadata, page markers, light boilerplate, line merge."""
    text = _strip_pdf_metadata_lines(text)
    text = _remove_page_comments(text)
    lines = [ln.rstrip() for ln in text.splitlines()]
    lines = _trim_isbn_only_lines(lines)
    lines = _filter_footer_boilerplate_lines(lines)
    text = merge_pdf_lines(lines)
    text = _trim_leading_long_copyright_block(text)
    text = _trim_leading_toc_block(text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


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
    if len(stripped) <= 2:
        return True
    return False


def trim_leading_navigation(lines: List[str]) -> List[str]:
    """Trim giant pre-article nav blocks common in scraped website markdown."""
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
        if stripped.startswith("# ") and len(stripped) > 12:
            start_idx = i
            break
        if len(stripped) > 80 and not is_link_list_line(stripped):
            start_idx = i
            break

    return lines[start_idx:] if start_idx > 0 else lines


def clean_html_text(raw_body: str) -> str:
    """Web/HTML-derived page cleanup (existing behavior, not more aggressive)."""
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
        if (
            len(stripped) < 5
            and not stripped.startswith("#")
            and not re.match(r"^\d+\.", stripped)
        ):
            continue

        cleaned_lines.append(stripped)

    text = merge_broken_lines(cleaned_lines)
    return text


def _title_case_ratio(s: str) -> float:
    letters = [c for c in s if c.isalpha()]
    if len(letters) < 3:
        return 0.0
    upperish = sum(1 for c in letters if c.isupper())
    return upperish / len(letters)


def _looks_like_heading_para(block: str) -> Optional[str]:
    """Return heading text if block is likely a section title."""
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    if not lines:
        return None
    first = lines[0]
    if first.startswith(">"):
        return None
    if len(lines) == 1 and first.startswith("#"):
        return re.sub(r"^#+\s*", "", first).strip() or None

    candidate = first
    if len(lines) > 1 and len(first) < 50:
        candidate = first
    if len(candidate) > 110:
        return None
    if re.match(r"^\([^)]{1,18}\)\.\s*\(?[A-Z0-9]{1,3}\)?\s*$", candidate):
        return None
    if re.match(r"^Type\s+[IVX]{1,4}\s*$", candidate, re.IGNORECASE):
        return None
    if candidate.endswith(".") and len(candidate) > 35:
        return None
    if "," in candidate and len(candidate) > 55:
        return None

    low = candidate.strip().lower().strip("#").strip()
    if low in KNOWN_SECTION_HEADINGS:
        return candidate.strip("# ").strip()

    if ROMAN_SECTION_RE.match(candidate):
        return candidate.strip()

    if candidate.startswith("#"):
        inner = re.sub(r"^#+\s*", "", candidate).strip()
        if inner and len(inner) < 100:
            return inner

    tr = _title_case_ratio(candidate)
    if 0.35 <= tr <= 0.82 and len(candidate) >= 4:
        if not candidate.endswith("."):
            return candidate
        if len(candidate) < 40:
            return candidate.rstrip(".")
    if (
        candidate.isupper()
        and 4 <= len(candidate) <= 80
        and candidate.count(" ") <= 10
        and not any(x in candidate for x in ("©", "HTTP", "WWW."))
    ):
        if "HOW CAN I" in candidate or "MY QUESTIONS" in candidate:
            return None
        return candidate.title() if len(candidate) > 50 else candidate
    return None


def split_pdf_into_sections(text: str) -> List[Tuple[Optional[str], str]]:
    """Split merged PDF text into (section_title, section_body) segments."""
    text = text.strip()
    if not text:
        return [(None, "")]
    paragraphs: List[str] = []
    for block in re.split(r"\n\s*\n+", text):
        b = block.strip()
        if b:
            paragraphs.append(b)
    if not paragraphs:
        return [(None, text)]

    sections: List[Tuple[Optional[str], str]] = []
    current_title: Optional[str] = None
    current_chunks: List[str] = []

    def flush() -> None:
        nonlocal current_chunks, current_title
        if current_chunks:
            body = "\n\n".join(current_chunks).strip()
            if body:
                sections.append((current_title, body))
        current_chunks = []

    for para in paragraphs:
        h = _looks_like_heading_para(para)
        if h is not None and len(para) < 200:
            flush()
            current_title = h
            continue
        current_chunks.append(para)
    flush()

    if not sections:
        return [(None, text)]
    if len(sections) == 1 and sections[0][0] is None:
        return sections
    return sections


def chunk_words(
    text: str, target_words: int = 850, overlap_words: int = 100, min_chunk_words: int = 280
) -> List[str]:
    """Split text into overlapping word chunks; avoid tiny tails by merging."""
    words = text.split()
    if not words:
        return []

    min_chunk_words = max(250, min_chunk_words)
    chunks: List[str] = []
    start = 0

    while start < len(words):
        end = min(start + target_words, len(words))
        remaining = len(words) - end

        if remaining < min_chunk_words and chunks:
            tail_text = " ".join(words[start:])
            chunks[-1] = f"{chunks[-1]} {tail_text}".strip()
            break

        chunk_words_slice = words[start:end]
        chunks.append(" ".join(chunk_words_slice))

        if end >= len(words):
            break
        start = max(0, end - overlap_words)

    return chunks


def is_meaningful_chunk_text(text: str, min_words: int = 40) -> bool:
    if is_robot_or_security_page(text):
        return False
    words = text.split()
    if len(words) < min_words:
        return False
    low = text.lower()

    boiler_hits = 0
    if "copyright" in low:
        boiler_hits += 1
    if "all rights reserved" in low:
        boiler_hits += 1
    if re.search(r"\bisbn\b", low):
        boiler_hits += 1
    if boiler_hits >= 2 and len(words) < 90:
        return False

    alnum_ratio = sum(1 for c in text if c.isalnum() or c.isspace()) / max(len(text), 1)
    if alnum_ratio < 0.5:
        return False
    return True


def parse_pages(raw_text: str) -> List[Dict[str, object]]:
    """Split raw markdown into scraped pages and extract base metadata."""
    sections = [s.strip() for s in PAGE_SEPARATOR_RE.split(raw_text) if s.strip()]
    pages: List[Dict[str, object]] = []

    for section in sections:
        heading_match = PAGE_HEADING_RE.search(section)
        source_match = SOURCE_RE.search(section)

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
                "raw_page_block": section,
            }
        )

    return pages


def chunk_section(
    section_text: str,
    *,
    section_title: Optional[str],
    base_meta: Dict[str, object],
    target_words: int,
    overlap_words: int,
    global_chunk_seq: List[int],
    stats: CleanCorpusStats,
) -> List[Dict[str, object]]:
    """Create chunk dicts for one PDF section."""
    out: List[Dict[str, object]] = []
    if not section_text.strip():
        return out

    parts = chunk_words(section_text, target_words=target_words, overlap_words=overlap_words)
    for chunk_body in parts:
        if not is_meaningful_chunk_text(chunk_body):
            stats.skipped_boilerplate_chunks += 1
            continue
        global_chunk_seq[0] += 1
        ci = global_chunk_seq[0] - 1
        page_index = int(base_meta["page_index"])
        sg = str(base_meta["source_group"])
        tb = str(base_meta["topic_batch"])
        chunk_id = f"{sg}__{tb}__{page_index:03d}__chunk_{ci:03d}"
        row = {
            "chunk_id": chunk_id,
            "source_url": base_meta["source_url"],
            "title": base_meta["title"],
            "source_group": base_meta["source_group"],
            "topic_batch": base_meta["topic_batch"],
            "original_file": base_meta["original_file"],
            "page_index": page_index,
            "chunk_index": ci,
            "section_title": section_title,
            "content_type": base_meta["content_type"],
            "text": chunk_body,
        }
        out.append(row)
    return out


def process_html_page(
    page: Dict[str, object],
    md_path: Path,
    source_group: str,
    topic_batch: str,
    stats: CleanCorpusStats,
    global_chunk_seq: List[int],
) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    page_index = int(page["page_index"])
    title = str(page["title"]).strip() or f"Page {page_index}"
    source_url = str(page["source_url"]).strip()
    cleaned = clean_html_text(str(page["raw_body"]))

    if is_robot_or_security_page(cleaned):
        stats.skipped_robot_pages += 1
        return out

    if len(cleaned.split()) < 40:
        stats.skipped_empty_pages += 1
        return out

    base_meta = {
        "source_group": source_group,
        "topic_batch": topic_batch,
        "title": title,
        "source_url": source_url,
        "page_index": page_index,
        "original_file": md_path.name,
        "content_type": "html",
    }

    raw_parts = chunk_words(cleaned, target_words=900, overlap_words=100)
    for chunk_body in raw_parts:
        if not is_meaningful_chunk_text(chunk_body):
            stats.skipped_boilerplate_chunks += 1
            continue
        global_chunk_seq[0] += 1
        ci = global_chunk_seq[0] - 1
        chunk_id = f"{source_group}__{topic_batch}__{page_index:03d}__chunk_{ci:03d}"
        out.append(
            {
                "chunk_id": chunk_id,
                "source_url": source_url,
                "title": title,
                "source_group": source_group,
                "topic_batch": topic_batch,
                "original_file": md_path.name,
                "page_index": page_index,
                "chunk_index": ci,
                "section_title": None,
                "content_type": "html",
                "text": chunk_body,
            }
        )

    if out:
        stats.pages_extracted += 1
        stats.html_like_pages += 1
        stats.chunks_created += len(out)
    else:
        stats.skipped_pages_no_chunks += 1
    return out


def process_pdf_page(
    page: Dict[str, object],
    md_path: Path,
    source_group: str,
    topic_batch: str,
    stats: CleanCorpusStats,
    global_chunk_seq: List[int],
) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    page_index = int(page["page_index"])
    title = str(page["title"]).strip() or f"Page {page_index}"
    source_url = str(page["source_url"]).strip()
    cleaned = clean_pdf_text(str(page["raw_body"]))

    if is_robot_or_security_page(cleaned):
        stats.skipped_robot_pages += 1
        return out

    if len(cleaned.split()) < 40:
        stats.skipped_empty_pages += 1
        return out

    base_meta = {
        "source_group": source_group,
        "topic_batch": topic_batch,
        "title": title,
        "source_url": source_url,
        "page_index": page_index,
        "original_file": md_path.name,
        "content_type": "pdf",
    }

    sections = split_pdf_into_sections(cleaned)
    for sec_title, sec_text in sections:
        sec_chunks = chunk_section(
            sec_text,
            section_title=sec_title,
            base_meta=base_meta,
            target_words=850,
            overlap_words=100,
            global_chunk_seq=global_chunk_seq,
            stats=stats,
        )
        out.extend(sec_chunks)

    if out:
        stats.pages_extracted += 1
        stats.pdf_like_pages += 1
        stats.chunks_created += len(out)
    else:
        stats.skipped_pages_no_chunks += 1
    return out


def process_file(md_path: Path) -> Tuple[List[Dict[str, object]], CleanCorpusStats]:
    """Process one markdown corpus file into chunk objects."""
    source_group, topic_batch = infer_filename_metadata(md_path.name)
    raw_text = md_path.read_text(encoding="utf-8", errors="ignore")
    pages = parse_pages(raw_text)

    chunks_output: List[Dict[str, object]] = []
    stats = CleanCorpusStats()
    global_seq = [0]

    for page in pages:
        source_url = str(page["source_url"]).strip()
        raw_block = str(page["raw_page_block"])
        if is_pdf_like_page(source_url, raw_block, md_path.name):
            chunks_output.extend(
                process_pdf_page(page, md_path, source_group, topic_batch, stats, global_seq)
            )
        else:
            chunks_output.extend(
                process_html_page(page, md_path, source_group, topic_batch, stats, global_seq)
            )

    stats.files_processed = 1
    chunks_output.sort(key=lambda r: (int(r["page_index"]), int(r["chunk_index"])))
    return chunks_output, stats


def write_report(
    aggregate: CleanCorpusStats,
    *,
    out_dir: Path,
    ran_at: datetime,
) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = ran_at.strftime("%Y%m%d_%H%M%S")
    path = REPORT_DIR / f"clean_corpus_report_{stamp}.txt"
    lines = [
        f"Clean Corpus Report",
        f"Run at: {ran_at.isoformat(timespec='seconds')}",
        "",
        f"Files processed: {aggregate.files_processed}",
        f"Pages / resources extracted: {aggregate.pages_extracted}",
        f"Chunks created: {aggregate.chunks_created}",
        f"PDF-like pages processed: {aggregate.pdf_like_pages}",
        f"HTML-like pages processed: {aggregate.html_like_pages}",
        f"Skipped (robot/security) pages: {aggregate.skipped_robot_pages}",
        f"Skipped (empty / too short) pages: {aggregate.skipped_empty_pages}",
        f"Skipped pages with no chunks after filtering: {aggregate.skipped_pages_no_chunks}",
        f"Skipped boilerplate chunks: {aggregate.skipped_boilerplate_chunks}",
        "",
        f"Output folder: {out_dir.resolve()}",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_files = sorted(INPUT_DIR.glob("*.md"))

    aggregate = CleanCorpusStats()

    if not md_files:
        print(f"No .md files found in: {INPUT_DIR}")
        return

    ran_at = datetime.now()

    for md_file in md_files:
        try:
            chunks, st = process_file(md_file)
        except Exception as exc:
            print(f"[WARN] Failed to process {md_file.name}: {exc}")
            continue

        out_name = f"{md_file.stem}_chunks.json"
        out_path = OUTPUT_DIR / out_name
        out_path.write_text(json.dumps(chunks, indent=2, ensure_ascii=False), encoding="utf-8")

        aggregate.files_processed += st.files_processed
        aggregate.pages_extracted += st.pages_extracted
        aggregate.chunks_created += st.chunks_created
        aggregate.pdf_like_pages += st.pdf_like_pages
        aggregate.html_like_pages += st.html_like_pages
        aggregate.skipped_robot_pages += st.skipped_robot_pages
        aggregate.skipped_empty_pages += st.skipped_empty_pages
        aggregate.skipped_pages_no_chunks += st.skipped_pages_no_chunks
        aggregate.skipped_boilerplate_chunks += st.skipped_boilerplate_chunks

        print(f"[OK] {md_file.name} -> {out_name} ({len(chunks)} chunks)")

    report_path = write_report(aggregate, out_dir=OUTPUT_DIR, ran_at=ran_at)

    print("\n=== Clean Corpus Summary ===")
    print(f"Files processed: {aggregate.files_processed}")
    print(f"Pages extracted: {aggregate.pages_extracted}")
    print(f"Chunks created: {aggregate.chunks_created}")
    print(f"PDF-like pages: {aggregate.pdf_like_pages}")
    print(f"HTML-like pages: {aggregate.html_like_pages}")
    print(f"Skipped robot/security pages: {aggregate.skipped_robot_pages}")
    print(f"Skipped empty/short pages: {aggregate.skipped_empty_pages}")
    print(f"Skipped pages (no chunks after filter): {aggregate.skipped_pages_no_chunks}")
    print(f"Skipped boilerplate chunks: {aggregate.skipped_boilerplate_chunks}")
    print(f"Output folder: {OUTPUT_DIR}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
