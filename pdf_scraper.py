"""
pdf_scraper.py
──────────────
Downloads PDFs from a list of URLs, extracts their text content,
and compiles everything into a single markdown file.

INSTALL:
    pip install requests pypdf

USAGE:
    python pdf_scraper.py
"""

import io
import re
import time
import requests
from pypdf import PdfReader

# ─────────────────────────────────────────────
# CONFIG — edit this section before each run
# ─────────────────────────────────────────────

PDF_URLS = [
    "https://downloads.aap.org/AAP/Documents/CHD_ER_Sample_Social_Media_posts.docx",
    "https://downloads.aap.org/AAP/Documents/CHD_IM_Sample_Social_Media_posts.docx",
    "https://downloads.aap.org/AAP/Documents/CHD_OBGYN_sample_social_media_posts.docx",
    "https://downloads.aap.org/AAP/Documents/CHD_Peds_Sample_Social_Media.docx",
    "https://downloads.aap.org/AAP/PDF/ACOG_Table_5.pdf",
    "https://downloads.aap.org/AAP/PDF/CHD_Case_Study_Final.pdf",
    "https://downloads.aap.org/AAP/PDF/CHD_Speakers_Notes_Final.pdf",
    "https://downloads.aap.org/AAP/PDF/CHD_Transition_Handout_College_Student.pdf",
    "https://downloads.aap.org/AAP/PDF/CHD_Transition_Handout_Provider.pdf",
    "https://downloads.aap.org/AAP/PDF/CHT_Child%20Health%20Care.pdf",
    "https://downloads.aap.org/AAP/PDF/CHT_Child%20Health.pdf",
    "https://downloads.aap.org/AAP/PDF/CHT_Child%20Population%20Characteristics.pdf",
    "https://downloads.aap.org/AAP/PDF/Case_Study-CHD-Final.pdf",
    "https://downloads.aap.org/AAP/PDF/Const-and-Bylaws-2020.pdf",
    "https://downloads.aap.org/AAP/PDF/EM_CHD_POC_Tool_FINAL_20221004.pdf",
    "https://downloads.aap.org/AAP/PDF/IM_CHD_POC_Tool_Checklist_FINAL.pdf",
    "https://downloads.aap.org/AAP/PDF/Mini-Training_CHD_Final.pptx",
    "https://downloads.aap.org/AAP/PDF/OB_GYN_CHD_POC_Tool_Checklist_FINAL.pdf",
    "https://downloads.aap.org/AAP/PDF/Peds_CHD_POC_Tool_Checklist_FINAL.pdf",
    "https://downloads.aap.org/AAP/PDF/Speakers_Notes-CHD-Final.pdf",
    "https://downloads.aap.org/AAP/PDF/chd-aap-infographic-r11.pdf",
    "https://downloads.aap.org/AAP/PowerPoint/CHD_Presentation_Slides.pptx",
    "https://downloads.aap.org/DOCHW/CHD-know-the-facts-2019.pdf",
    "https://medicalhomeinfo.aap.org/tools-resources/Documents/PCCC%202nd%20Edition/Full%20Pediatric%20Care%20Coordination%20Curriculum.pdf",
]

OUTPUT_FILE = "aap_pdfs_output.md"

# Polite delay between requests (seconds)
DELAY = 2

# ─────────────────────────────────────────────
# SCRAPER
# ─────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def fetch_pdf(url):
    """Download a PDF from a URL and return its bytes, or None on failure."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 403:
            print(f"  🚫 403 Forbidden: {url}")
            print("     → Try running from your laptop, not a cloud server.")
            return None
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and not url.lower().endswith(".pdf"):
            print(f"  ⚠️  URL does not appear to be a PDF: {url}")
            print(f"      Content-Type: {content_type}")
        return response.content
    except Exception as e:
        print(f"  ⚠️  Error fetching {url}: {e}")
        return None


def extract_text_from_pdf(pdf_bytes, url):
    """Extract text from PDF bytes using pypdf. Returns (title, text)."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))

        # Try to get title from metadata
        title = url.split("/")[-1].replace(".pdf", "").replace("-", " ").replace("_", " ").title()
        if reader.metadata and reader.metadata.title:
            title = reader.metadata.title.strip()

        # Extract text from all pages
        pages_text = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                pages_text.append(page_text.strip())

        full_text = "\n\n".join(pages_text)

        # Clean up excessive whitespace
        full_text = re.sub(r"\n{3,}", "\n\n", full_text)
        full_text = re.sub(r"[ \t]+", " ", full_text)
        full_text = full_text.strip()

        return title, full_text

    except Exception as e:
        print(f"  ⚠️  Error extracting text from PDF: {e}")
        return url.split("/")[-1], ""


def main():
    if not PDF_URLS:
        print("No URLs found. Add PDF URLs to the PDF_URLS list in the CONFIG section.")
        return

    print(f"Processing {len(PDF_URLS)} PDF URLs...\n")
    results = []

    for i, url in enumerate(PDF_URLS, 1):
        print(f"  [{i}/{len(PDF_URLS)}] {url}")
        pdf_bytes = fetch_pdf(url)

        if not pdf_bytes:
            print(f"          ✗ Failed to download")
            if i < len(PDF_URLS):
                time.sleep(DELAY)
            continue

        title, text = extract_text_from_pdf(pdf_bytes, url)

        if text:
            print(f"          ✓ '{title}' ({len(text):,} chars, {len(text.splitlines())} lines)")
            results.append({"url": url, "title": title, "text": text})
        else:
            print(f"          ✗ No text extracted (may be a scanned/image PDF)")

        if i < len(PDF_URLS):
            time.sleep(DELAY)

    if not results:
        print("\n❌ No content extracted. Check your URLs and internet connection.")
        return

    # Write markdown
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("# PDF Content\n\n")
        f.write(f"**PDFs processed:** {len(results)} of {len(PDF_URLS)}  \n\n")
        f.write("---\n\n")
        for i, item in enumerate(results, 1):
            f.write(f"## {i}. {item['title']}\n\n")
            f.write(f"**Source:** {item['url']}\n\n")
            f.write(item["text"])
            f.write("\n\n---\n\n")

    print(f"\n✅ Done! {len(results)} PDFs saved to: {OUTPUT_FILE}")
    print("\nNote: If any PDFs show '✗ No text extracted', they are likely scanned")
    print("image PDFs. These require OCR (e.g. pytesseract) to extract text.")


if __name__ == "__main__":
    main()