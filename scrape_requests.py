"""
jina_scraper.py
───────────────
Uses Jina AI's free reader API (https://r.jina.ai) to fetch clean text versions
of web pages and compile them into a single markdown file.

No API key or signup required — Jina AI is free to use.

INSTALL:
    pip install requests

USAGE:
    1. Edit the URLS list and OUTPUT_FILE below.
    2. Run: python jina_scraper.py

HOW IT WORKS:
    Jina AI converts any URL to clean text by prepending https://r.jina.ai/
    For example: https://r.jina.ai/https://www.conqueringchd.org/learn/children/
"""

import re
import time
import requests

# ─────────────────────────────────────────────
# CONFIG — edit this section before each run
# ─────────────────────────────────────────────

"""
URLS = [
    "https://www.conqueringchd.org/learn/new-to-chd/",
    "https://www.conqueringchd.org/learn/guided-questions/",
    "https://www.conqueringchd.org/learn/facts-and-statistics/",
    "https://www.conqueringchd.org/learn/children/",
    "https://www.conqueringchd.org/learn/teens/",
    "https://www.conqueringchd.org/learn/adults/",
    "https://www.conqueringchd.org/learn/bereaved-families/",
    "https://www.conqueringchd.org/promoting-mental-health-for-parents-ofchildrenwith-heart-conditions/",
    "https://www.conqueringchd.org/psychological-aspects-of-living-with-congenital-heart-disease/",
    "https://www.conqueringchd.org/top-10-things-to-know-about-mental-health-chd/",
    "https://www.conqueringchd.org/school-intervention-series-complete-resource-guide/",
    "https://www.conqueringchd.org/dental-health-and-heart-health-go-hand-in-hand/",
    "https://www.conqueringchd.org/qualifying-for-social-security-disability-benefits-with-a-congenital-heart-defect/",
    "https://www.conqueringchd.org/five-tips-for-coping-with-holiday-grief/",
]
"""

URLS = [
    # Diagnosis & Discovery — Prenatal
    "https://chdcarecompass.com/diagnosis-and-discovery/prenatal-testing-and-care/common-prenatal-and-genetic-tests/",
    "https://chdcarecompass.com/diagnosis-and-discovery/prenatal-testing-and-care/what-to-expect-during-a-fetal-echocardiogram/",

    # Diagnosis & Discovery — Emotional Impacts
    "https://chdcarecompass.com/diagnosis-and-discovery/emotional-impacts-of-chd-on-parents/reactions-to-a-chd-diagnosis/",
    "https://chdcarecompass.com/diagnosis-and-discovery/emotional-impacts-of-chd-on-parents/where-to-find-emotional-support/",
    "https://chdcarecompass.com/diagnosis-and-discovery/emotional-impacts-of-chd-on-parents/coping-with-the-loss-of-a-child/",

    # Diagnosis & Discovery — Gathering Info
    "https://chdcarecompass.com/diagnosis-and-discovery/gathering-information-about-your-childs-chd/connecting-with-other-chd-parents/",

    # Diagnosis & Discovery — Finding Your Way
    "https://chdcarecompass.com/diagnosis-and-discovery/finding-your-way-in-a-medical-world/understanding-how-health-insurance-works/",

    # In the Hospital — Surgery & Recovery
    "https://chdcarecompass.com/in-the-hospital/surgery-and-recovery/what-happens-in-the-intensive-care-unit/",
    "https://chdcarecompass.com/in-the-hospital/surgery-and-recovery/moving-to-acute-care/",

    # Living with CHD
    "https://chdcarecompass.com/living-with-chd/",
    "https://chdcarecompass.com/living-with-chd/the-challenges-of-parenting-a-vulnerable-child/",
    "https://chdcarecompass.com/living-with-chd/managing-the-impact-of-chd-on-your-family/",

    # Resources
    "https://chdcarecompass.com/resources/",
]

OUTPUT_FILE = "chdcarecompass_output.md"

# Polite delay between requests (seconds). Increase if you hit rate limits.
DELAY = 2

# ─────────────────────────────────────────────
# JINA FETCHER
# ─────────────────────────────────────────────

JINA_BASE = "https://r.jina.ai/"

HEADERS = {
    "Accept": "text/plain",
    "User-Agent": "Mozilla/5.0 (compatible; jina-scraper/1.0)",
}


def fetch_with_jina(url):
    """Fetch a URL via Jina AI and return (title, text) or (None, None) on failure."""
    jina_url = JINA_BASE + url
    try:
        response = requests.get(jina_url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            text = response.text.strip()
            # Jina returns a markdown-style title on the first line: "Title: ..."
            title = url  # fallback
            lines = text.splitlines()
            for line in lines[:5]:  # title is usually in first few lines
                if line.startswith("Title:"):
                    title = line.replace("Title:", "").strip()
                    break
            return title, text
        else:
            print(f"  ⚠️  HTTP {response.status_code} for {url}")
            return None, None
    except Exception as e:
        print(f"  ⚠️  Error fetching {url}: {e}")
        return None, None


def clean_text(text):
    """Remove excessive blank lines from Jina output."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print(f"Fetching {len(URLS)} URLs via Jina AI...\n")
    pages = []

    for i, url in enumerate(URLS, 1):
        print(f"  [{i}/{len(URLS)}] {url}")
        title, text = fetch_with_jina(url)
        if text:
            print(f"          ✓ '{title}' ({len(text):,} chars)")
            pages.append({"url": url, "title": title, "text": clean_text(text)})
        else:
            print(f"          ✗ Failed — skipping")
        if i < len(URLS):
            time.sleep(DELAY)

    if not pages:
        print("\n❌ No pages fetched. Check your URLs and internet connection.")
        return

    # Write markdown
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# Scraped Content\n\n")
        f.write(f"**Pages scraped:** {len(pages)} of {len(URLS)}  \n\n")
        f.write("---\n\n")
        for i, page in enumerate(pages, 1):
            f.write(f"## {i}. {page['title']}\n\n")
            f.write(f"**Source:** {page['url']}\n\n")
            f.write(page["text"])
            f.write("\n\n---\n\n")

    print(f"\n✅ Done! {len(pages)} pages saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()