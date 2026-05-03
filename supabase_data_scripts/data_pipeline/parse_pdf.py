from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader

from classify import assert_question_category, classify_question_category, slugify_segment
from config import (
    DEFAULT_PDF_SLUG,
    MAX_QUESTION_LEN,
    MIN_QUESTION_LEN,
    PDF_CHAT_URL_BASE,
)
from normalize import normalize_text, text_fingerprint


@dataclass
class GlossaryEntry:
    term: str
    definition: str
    section: str


@dataclass
class ParsedPdf:
    pdf_slug: str
    glossary: list[GlossaryEntry]
    questions: list[tuple[str, str]]
    raw_appendix_a: str


def _pdf_slug_from_path(pdf_path: Path) -> str:
    stem = pdf_path.stem
    return slugify_segment(stem, max_len=96) or DEFAULT_PDF_SLUG


def _raw_multiline_text(reader: PdfReader) -> str:
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _slice_appendix_a_raw(multiline: str) -> str:
    """Avoid matching the TOC: require the real appendix intro paragraph after the title."""
    start_match = None
    for m in re.finditer(r"(?is)appendix\s+a:.*?glossary", multiline):
        head = multiline[m.end() : m.end() + 500].lower()
        if "quick-reference" in head or "this glossary is designed" in head:
            start_match = m
            break
    if not start_match:
        return ""
    tail = multiline[start_match.start() :]
    end = re.search(r"(?is)appendix\s+b:", tail)
    if not end:
        return tail
    return tail[: end.start()]


def _split_leading_acronym(line: str) -> tuple[str, str | None]:
    """Lines like 'NICU Intensive care unit for newborns' or 'ECMO Life support…'."""
    line = normalize_text(line)
    words = line.split()
    if len(words) < 2:
        return line, None
    if len(words[0]) == 2 and words[0].isalpha() and words[0].isupper() and words[1].lower() == "tube":
        term = f"{words[0]} {words[1]}"
        rest = " ".join(words[2:]).strip()
        rparts = rest.split()
        if rparts and rparts[0].lower() == "tube":
            rest = " ".join(rparts[1:]).strip()
        if len(rest) >= 8:
            return term, rest
    m = re.match(r"^([A-Z]{2,8})\s+([A-Za-z].+)$", line)
    if not m:
        return line, None
    term, rest = m.group(1), m.group(2).strip()
    if len(term) >= 2 and len(rest) >= 10:
        return term, rest
    return line, None


def _split_on_mean_starter_word(line: str) -> tuple[str, str | None]:
    """Split 'Pacemaker Device that…' / 'G-Tube Feeding tube…' when columns collapse to single spaces."""
    words = line.split()
    for i, w in enumerate(words):
        if i < 1:
            continue
        lw = w.lower()
        if lw == "medical" and i == 1:
            term = " ".join(words[:i]).strip()
            rest = " ".join(words[i:]).strip()
            if len(term) <= 40 and len(rest) >= 15:
                return term, rest
            continue
        if lw == "replacement" and i >= 2 and words[i - 1].lower() == "transplant":
            term = " ".join(words[:i]).strip()
            rest = " ".join(words[i:]).strip()
            if len(term) <= 45 and len(rest) >= 15:
                return term, rest
            continue
        if lw not in ("device", "feeding", "mechanical", "ultrasound", "test"):
            continue
        if lw == "test" and i > 0 and words[i - 1].lower() == "stress":
            continue
        if lw == "device":
            rest_preview = " ".join(words[i:]).lower()
            if " that " not in f" {rest_preview} "[:70]:
                continue
        term = " ".join(words[:i]).strip()
        rest = " ".join(words[i:]).strip()
        if 2 <= len(term) <= 70 and len(rest) >= 12:
            return term, rest
    return line, None


def _split_duplicate_column_word(line: str) -> tuple[str, str | None]:
    """When PDF merges columns with single spaces, the first word of 'What it means' may repeat the last word of the term."""
    words = line.split()
    for i in range(len(words) - 1):
        if words[i].lower() == words[i + 1].lower():
            term = " ".join(words[: i + 1])
            rest = " ".join(words[i + 2 :])
            if len(term) >= 3 and len(rest) >= 8:
                return term, rest
    return line, None


def _split_merged_term_mean(line: str) -> tuple[str, str | None]:
    line = normalize_text(line)
    if not line:
        return "", None
    acr, arest = _split_leading_acronym(line)
    if arest is not None:
        return acr, arest
    chunks = re.split(r"\s{2,}", line)
    if len(chunks) >= 3:
        a, b = chunks[0], chunks[1]
        c = " ".join(chunks[2:]).strip()
        if c.lower().startswith(b.lower() + " "):
            term = f"{a} {b}".strip()
            mean = c[len(b) :].strip()
            return term, mean
    if len(chunks) == 2 and len(chunks[1]) >= 15:
        return chunks[0].strip(), chunks[1].strip()
    term2, rest2 = _split_duplicate_column_word(line)
    if rest2 is not None:
        return term2, rest2
    term3, rest3 = _split_on_mean_starter_word(line)
    if rest3 is not None:
        return term3, rest3
    return line, None


def _trim_before_first_heart_section(lines: list[str]) -> list[str]:
    for i, line in enumerate(lines):
        s = normalize_text(line).upper()
        if s == "HEART CONDITIONS" or (s.startswith("HEART") and "CONDITION" in s):
            return lines[i:]
    return lines


def _is_section_header(line: str) -> bool:
    s = normalize_text(line)
    if len(s) < 6 or len(s) > 80:
        return False
    if not re.match(r"^[A-Z][A-Z0-9 &/\-]{5,}$", s):
        return False
    if "WHAT IT MEANS" in s or s.startswith("TERM "):
        return False
    return True


def _is_table_header(line: str) -> bool:
    low = normalize_text(line).lower()
    return "term" in low and "what it means" in low and "therapists" in low


def _looks_like_instruction(line: str) -> bool:
    low = normalize_text(line).lower()
    return low.startswith("this glossary") or low.startswith("how to use")


def _appendix_lines(appendix_raw: str) -> list[str]:
    t = appendix_raw.replace("\r", "\n")
    return [normalize_text(x) for x in t.split("\n") if normalize_text(x)]


def parse_glossary_lines(lines: list[str]) -> list[GlossaryEntry]:
    entries: list[GlossaryEntry] = []
    lines = _trim_before_first_heart_section(lines)
    section = "HEART CONDITIONS"
    i = 0
    while i < len(lines):
        line = lines[i]
        if _is_section_header(line):
            section = normalize_text(line)
            i += 1
            continue
        if _is_table_header(line) or _looks_like_instruction(line):
            i += 1
            continue
        if line.lower().startswith("appendix"):
            i += 1
            continue

        term_line = line
        i += 1
        term, mean_prefix = _split_merged_term_mean(term_line)

        if mean_prefix is not None:
            mean = mean_prefix
            if i < len(lines) and not _is_section_header(lines[i]) and not _is_table_header(lines[i]):
                therapist = lines[i]
                i += 1
            else:
                therapist = ""
        else:
            if i >= len(lines):
                break
            mean = lines[i]
            i += 1
            if i >= len(lines):
                break
            therapist = lines[i]
            i += 1

        term = normalize_text(term)
        mean = normalize_text(mean)
        therapist = normalize_text(therapist)
        if not term or len(term) < 2:
            continue
        if _is_table_header(term) or _is_section_header(term):
            continue
        definition = normalize_text(f"{mean} {therapist}".strip())
        if len(definition) < 5:
            continue
        entries.append(GlossaryEntry(term=term, definition=definition, section=section))
    return entries


def extract_questions_from_text(full_raw: str, appendix_a_raw: str) -> list[tuple[str, str]]:
    """Collect sentences ending in ? outside Appendix A (glossary table)."""
    a_norm = appendix_a_raw.lower()
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for part in re.split(r"(?<=[.!?])\s+", full_raw):
        p = normalize_text(part)
        if not p.endswith("?"):
            continue
        if len(p) < MIN_QUESTION_LEN or len(p) > MAX_QUESTION_LEN:
            continue
        if p.lower() in a_norm or (len(p) > 20 and p.lower() in a_norm):
            continue
        fp = text_fingerprint(p)
        if fp in seen:
            continue
        seen.add(fp)
        cat = assert_question_category(classify_question_category(p))
        out.append((p, cat))
    return out


def parse_pdf(pdf_path: Path, pdf_slug: str | None = None) -> ParsedPdf:
    path = pdf_path.resolve()
    slug = pdf_slug or _pdf_slug_from_path(path)
    reader = PdfReader(str(path))
    raw = _raw_multiline_text(reader)
    appendix_a_raw = _slice_appendix_a_raw(raw)
    lines = _appendix_lines(appendix_a_raw)
    glossary = parse_glossary_lines(lines)
    terms_set = {e.term for e in glossary}
    full_for_questions = normalize_text(raw.replace("\n", " "))
    appendix_flat = normalize_text(appendix_a_raw.replace("\n", " "))
    questions = extract_questions_from_text(full_for_questions, appendix_flat)
    _ = terms_set
    return ParsedPdf(
        pdf_slug=slug,
        glossary=glossary,
        questions=questions,
        raw_appendix_a=appendix_a_raw,
    )


def glossary_chat_rows(entries: Iterable[GlossaryEntry], pdf_slug: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for e in entries:
        sec_slug = slugify_segment(e.section)
        term_slug = slugify_segment(e.term)
        url = f"{PDF_CHAT_URL_BASE}/{pdf_slug}/{sec_slug}/{term_slug}"
        rows.append(
            {
                "title": e.term,
                "url": url,
                "section": e.section,
                "source": pdf_slug,
            }
        )
    return rows
