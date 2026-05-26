"""
Convert locally downloaded PDFs (per corpus batch folder) into raw markdown
files using the same layout as jina_scraper_template.write_markdown (header,
--- separators, ## / **Source:** / body per item).

INSTALL:
    py -m pip install pymupdf

USAGE (from repo root or this script's directory):
    py scripts/scrape_jina_corpus/local_pdf_to_md.py
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF is required. Install with: py -m pip install pymupdf", file=sys.stderr)
    sys.exit(1)


SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_PDF_ROOT = SCRIPT_DIR / "local_pdf_resources"
OUTPUT_DIR = SCRIPT_DIR / "corpus_scraped_data"
REPORT_DIR = SCRIPT_DIR / "report_files"
REPORT_PATH = REPORT_DIR / "local_pdf_conversion_report.txt"

SOURCE_GROUP_LABEL = "Local PDF"
OUTPUT_SUFFIX = "__local_pdfs.md"

# Local PDFs are extraction inputs only; **Source:** / RAG citation_source_url use public URLs.
# Keys: batch folder name under local_pdf_resources/ → exact PDF filename → public URL.
PUBLIC_PDF_SOURCE_URLS: dict[str, dict[str, str]] = {
    "mended_hearts_org__caregiver_support": {
        "Caregiver-Connections-Time-for-Caring-copy.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2024/07/Caregiver-Connections-Time-for-Caring-copy.pdf"
        ),
        "Caregiver-Depression-Piece.pdf": (
            "https://www.mendedhearts.org/Docs/Caregiver%20Depression%20Piece.pdf"
        ),
        "Caregiving-One-Pager.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2024/09/Caregiving-One-Pager.pdf"
        ),
        "Caring-for-Yourself-WH-CHD.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2025/02/Caring-for-Yourself-WH-CHD.pdf"
        ),
        "MLH-Tips-for-Caregivers-1.docx.pdf": "https://mendedhearts.org/education-and-resources/",
        "Taking the Stress Out of Caregiving - Mended Hearts.pdf": (
            "https://mendedhearts.org/story/taking-the-stress-out-of-caregiving/"
        ),
    },
    "mended_hearts_org__medical_navigation": {
        "Feeding-Issues-for-Babies-with-CHD.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2026/03/Feeding-Issues-for-Babies-with-CHD.pdf"
        ),
        "Feeding-Issues-WH-CHD-2026.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2026/01/Feeding-Issues-WH-CHD-2026.pdf"
        ),
        "Neurodevelopmental-Issues-WH-CHD.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2024/09/Neurodevelopmental-Issues-WH-CHD.pdf"
        ),
        "Preparing-for-a-doctor-appointment-WH-CHD.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2025/02/Preparing-for-a-doctor-appointment-WH-CHD.pdf"
        ),
        "Transitioning-from-Hospital-to-Home-WH-CHD.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2025/07/Transitioning-from-Hospital-to-Home-WH-CHD.pdf"
        ),
    },
    "mended_hearts_org__mended_little_heart_guide_lite": {
        "MLHGuide-Lite-New-1.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2017/03/MLHGuide-Lite-New-1.pdf"
        ),
    },
    "mended_hearts_org__mended_little_heartguide": {
        "MLHG_2015-2025.pdf": "https://mendedhearts.org/mended-hearts-heartguide/",
    },
    "mended_hearts_org__neurodevelopmental_issues_chd": {
        "Neurodevelopmental-Issues-CHD.pdf": (
            "https://mendedhearts.org/wp-content/uploads/2024/10/Neurodevelopmental-Issues-CHD-1.pdf"
        ),
    },
}


@dataclass
class PdfResult:
    path: Path
    rel_source: str
    citation_source: str
    title: str
    page_count: int
    markdown_body: str
    error: Optional[str] = None


@dataclass
class BatchReport:
    batch_name: str
    batch_dir: Path
    pdfs_attempted: int = 0
    results: List[PdfResult] = field(default_factory=list)
    failures: List[Tuple[Path, str]] = field(default_factory=list)
    output_path: Optional[Path] = None


def display_rel_source(batch_name: str, filename: str) -> str:
    """Path relative to scrape_jina_corpus/, always forward slashes."""
    return f"local_pdf_resources/{batch_name}/{filename}".replace("\\", "/")


def _normalize_pdf_match_key(filename: str) -> str:
    """Lowercase alphanumeric key for robust filename matching."""
    return re.sub(r"[^a-z0-9]+", "", filename.lower())


def resolve_public_source_url(batch_name: str, filename: str) -> Optional[str]:
    """
    Map a local PDF filename to its public citation URL.
    Returns None when the batch or file is not in the mapping (caller keeps local rel path).
    """
    batch_map = PUBLIC_PDF_SOURCE_URLS.get(batch_name)
    if not batch_map:
        return None
    if filename in batch_map:
        return batch_map[filename]
    target = _normalize_pdf_match_key(filename)
    hits = [
        url for fn, url in batch_map.items() if _normalize_pdf_match_key(fn) == target
    ]
    if len(hits) == 1:
        return hits[0]
    return None


def citation_source_for_pdf(batch_name: str, filename: str) -> tuple[str, str, bool]:
    """Returns (local_rel_source, citation_source_for_md, mapped_to_public)."""
    rel = display_rel_source(batch_name, filename)
    public = resolve_public_source_url(batch_name, filename)
    if public:
        return rel, public, True
    return rel, rel, False


def normalize_title_from_stem(stem: str) -> str:
    s = stem.replace("_", " ").replace("-", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip() or stem


def infer_pdf_title(doc: fitz.Document, pdf_path: Path) -> str:
    meta = doc.metadata or {}
    raw = (meta.get("title") or "").strip()
    if raw:
        return raw
    return normalize_title_from_stem(pdf_path.stem)


def extract_pdf_text(doc: fitz.Document) -> Tuple[str, int]:
    parts: List[str] = []
    n = doc.page_count
    for i in range(n):
        page = doc.load_page(i)
        text = page.get_text()
        parts.append(f"<!-- Page {i + 1} -->\n\n{text}")
    return "\n\n".join(parts), n


def process_one_pdf(batch_name: str, pdf_path: Path) -> PdfResult:
    rel, citation, _mapped = citation_source_for_pdf(batch_name, pdf_path.name)
    try:
        with fitz.open(pdf_path) as doc:
            title = infer_pdf_title(doc, pdf_path)
            body, page_count = extract_pdf_text(doc)
        return PdfResult(
            path=pdf_path,
            rel_source=rel,
            citation_source=citation,
            title=title,
            page_count=page_count,
            markdown_body=body,
        )
    except Exception as exc:  # noqa: BLE001 — report any open/read failure
        return PdfResult(
            path=pdf_path,
            rel_source=rel,
            citation_source=citation,
            title=normalize_title_from_stem(pdf_path.stem),
            page_count=0,
            markdown_body="",
            error=str(exc),
        )


def write_batch_markdown(
    output_filename: str,
    successful: List[PdfResult],
    total_attempted: int,
    f,
) -> None:
    """Match jina_scraper_template.write_markdown structure (per-URL blocks only)."""
    f.write("# Scraped Corpus Content\n\n")
    f.write(f"**Output file:** `{output_filename}`  \n")
    f.write(f"**Pages scraped:** {len(successful)} of {total_attempted}  \n")
    f.write(f"**Source group:** {SOURCE_GROUP_LABEL}  \n\n")
    f.write("---\n\n")

    for i, pr in enumerate(successful, 1):
        f.write(f"## {i}. {pr.title}\n\n")
        f.write(f"**Source:** {pr.citation_source}\n\n")
        f.write(pr.markdown_body)
        f.write("\n\n---\n\n")


def collect_batch_dirs() -> List[Path]:
    if not LOCAL_PDF_ROOT.is_dir():
        return []
    return sorted(
        p for p in LOCAL_PDF_ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")
    )


def run() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    batch_dirs = collect_batch_dirs()
    all_reports: List[BatchReport] = []
    failures_global: List[str] = []
    unmapped_public_urls: List[str] = []
    batches_written = 0

    if not batch_dirs:
        print(f"No batch folders found under: {LOCAL_PDF_ROOT}")
        msg = f"No batch folders under {LOCAL_PDF_ROOT}\n"
        REPORT_PATH.write_text(msg, encoding="utf-8")
        return 1

    print("Local PDF -> raw markdown")
    print(f"Input root:  {LOCAL_PDF_ROOT}")
    print(f"Output dir: {OUTPUT_DIR}")
    print(f"Report:     {REPORT_PATH}\n")

    for batch_dir in batch_dirs:
        batch_name = batch_dir.name
        br = BatchReport(batch_name=batch_name, batch_dir=batch_dir)

        pdfs = sorted(batch_dir.glob("*.pdf"))
        br.pdfs_attempted = len(pdfs)

        print(f"{'=' * 72}")
        print(f"Batch: {batch_name}")
        print(f"  PDFs found: {len(pdfs)}")

        if not pdfs:
            print("  [SKIP] No PDF files in this folder.")
            all_reports.append(br)
            failures_global.append(f"{batch_name}: no PDF files")
            continue

        successful: List[PdfResult] = []
        for pdf_path in pdfs:
            res = batch_name and process_one_pdf(batch_name, pdf_path)
            if res.error:
                br.failures.append((pdf_path, res.error))
                print(f"  [FAIL] {pdf_path.name} - {res.error}")
            else:
                successful.append(res)
                mapped = res.citation_source != res.rel_source
                cite_note = "public URL" if mapped else "local path (no mapping)"
                print(
                    f"  [OK]   {pdf_path.name} - {res.page_count} pages - "
                    f"title: {res.title!r} - citation: {cite_note}"
                )
                if not mapped:
                    unmapped_public_urls.append(f"{batch_name}/{pdf_path.name}")

        out_name = f"{batch_name}{OUTPUT_SUFFIX}"
        out_path = OUTPUT_DIR / out_name
        br.output_path = out_path

        if successful:
            with out_path.open("w", encoding="utf-8") as f:
                write_batch_markdown(out_name, successful, len(pdfs), f)
            br.results = successful
            batches_written += 1
            print(f"  -> Wrote: {out_path}")
        else:
            print("  [SKIP] No PDFs converted successfully; no output file written.")
            failures_global.append(f"{batch_name}: all {len(pdfs)} PDF(s) failed")

        all_reports.append(br)

    print(f"\n{'=' * 72}")
    print("Summary")
    print(f"  Batch folders scanned: {len(batch_dirs)}")
    print(f"  Output .md files created: {batches_written}")
    if failures_global:
        print(f"  Issues: {len(failures_global)}")
        for line in failures_global:
            print(f"    - {line}")
    else:
        print("  Issues: none")
    if unmapped_public_urls:
        print(f"  PDFs without public URL mapping ({len(unmapped_public_urls)}):")
        for line in unmapped_public_urls:
            print(f"    - {line}")
    else:
        print("  Public URL mapping: all converted PDFs mapped")

    # Report file
    lines: List[str] = []
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines.append(f"Local PDF conversion report - {ts}\n")
    lines.append(f"Script: {Path(__file__).resolve()}\n")
    lines.append(f"Input:  {LOCAL_PDF_ROOT}\n")
    lines.append(f"Output: {OUTPUT_DIR}\n\n")

    for br in all_reports:
        lines.append("-" * 72 + "\n")
        lines.append(f"Batch folder: {br.batch_name}\n")
        lines.append(f"  Path: {br.batch_dir}\n")
        lines.append(f"  PDFs in folder: {br.pdfs_attempted}\n")
        if br.output_path and br.results:
            lines.append(f"  Output: {br.output_path}\n")
            lines.append(f"  Successfully converted ({len(br.results)}):\n")
            for pr in br.results:
                lines.append(f"    - {pr.path}\n")
                lines.append(f"      local input: {pr.rel_source}\n")
                lines.append(f"      citation source: {pr.citation_source}\n")
                lines.append(f"      pages: {pr.page_count}\n")
        elif br.pdfs_attempted == 0:
            lines.append("  Status: no PDFs — skipped\n")
        elif not br.results:
            lines.append("  Status: no successful conversions — no output file\n")
        if br.failures:
            lines.append(f"  Failed PDFs ({len(br.failures)}):\n")
            for path, err in br.failures:
                lines.append(f"    - {path}\n")
                lines.append(f"      error: {err}\n")
        lines.append("\n")

    lines.append("-" * 72 + "\n")
    lines.append(f"Total output batch files created: {batches_written}\n")
    REPORT_PATH.write_text("".join(lines), encoding="utf-8")
    print(f"\nWrote report: {REPORT_PATH}")

    return 0 if not failures_global else 0  # exit 0 even with partial failures; user sees report


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
