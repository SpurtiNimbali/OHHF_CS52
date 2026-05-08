"""
jina_scraper.py
───────────────
Uses Jina AI's free reader API (https://r.jina.ai) to fetch clean text versions
of web pages/PDFs and compile them into separate markdown corpus files.

No API key or signup required.

INSTALL:
    pip install requests

USAGE:
    From the project root, run:
        python scripts/scrape_jina_corpus/jina_scraper.py

OUTPUT:
    Markdown files will be saved to:
        scripts/scrape_jina_corpus/corpus_scraped_data/
"""

import re
import time
from pathlib import Path

import requests


# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR / "corpus_scraped_data"

DELAY = 2

JINA_BASE = "https://r.jina.ai/"

HEADERS = {
    "Accept": "text/plain",
    "User-Agent": "Mozilla/5.0 (compatible; jina-scraper/1.0)",
}


BATCHES = {
    "heart_org__caregiver_support.md": [
        "https://www.heart.org/en/health-topics/caregiver-support/tips-for-staying-healthy-and-active",
        "https://www.heart.org/en/-/media/Files/Health-Topics/Answers-by-Heart/How-can-I-support-my-loved-one.pdf",
        "https://www.heart.org/en/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Caregiver-Burnout.pdf",
        "https://www.heart.org/en/health-topics/caregiver-support/busy-caregivers",
        "https://www.heart.org/en/health-topics/caregiver-support/get-moving-tips-for-caregivers",
        "https://www.heart.org/en/health-topics/caregiver-support/top-10-cooking-tips-for-caregivers",
        "https://www.heart.org/en/health-topics/caregiver-support/communication-tips-for-caregivers",
        "https://www.heart.org/en/health-topics/caregiver-support/caregivers-be-realistic-think-positive",
        "https://www.heart.org/en/health-topics/cardiac-rehab/taking-care-of-yourself",
    ],

    "heart_org__medical_navigation.md": [
        "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/heart-to-heart-talking-to-your-doctor",
        "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/getting-a-second-medical-opinion",
        "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/health-literacy--understanding-what-your-doctor-is-saying",
        "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/finding-the-right-doctor",
        "https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals/preparing-for-medical-visits",
        "https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals",
        "https://www.heart.org/en/health-topics/consumer-healthcare/medication-information/medication-adherence-taking-your-meds-as-directed",
        "https://www.heart.org/en/health-topics/consumer-healthcare/medication-information/medication-interactions-food-supplements-and-other-drugs",
    ],

    "heart_org__stress_lifestyle.md": [
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-to-Manage-Stress.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/Sleep-Affects-Health.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-can-I-make-Lifestyle-Healthier.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-Can-Physical-Activity-Become-a-Way-of-Life.pdf",
    ],

    "heart_org__end_of_life_grief.md": [
        "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/hospice-care",
        "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/end-of-life",
    ],

    "heart_org__conditions_definitions.md": [
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Peripheral-Artery-Disease.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Metabolic-Syndrome.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Kawasaki-Disease.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Infective-Endocarditis.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-HCM.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-High-Blood-Pressure.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-Can-I-Live-With-Heart-Failure.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Heart-Failure.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Are-Heart-Disease-and-Stroke.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-a-Heart-Attack.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Are-the-Warning-Signs-of-Heart-Attack.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Cardiac-Arrest.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Atrial-Fibrillation.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Arrhythmia.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Aortic-Valve-Stenosis.pdf?sc_lang=en",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-Angina.pdf",
    ],

    "heart_org__procedures_tests_devices.md": [
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Cardiac-Rehabilitation.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Coronary-Bypass-Surgery.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-a-Coronary-Angiogram.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Coronary-Angioplasty.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-a-Stent.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-are-DOACs.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-DAPT.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Echocardiography.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Are-Electrophysiologic-Tests.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Heart-Valve-Surgery.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Happens-After-Heart-Surgery.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-Can-I-Recover-From-Heart-Surgery.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-HBP-Medicine.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-an-ICD.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-a-Pacemaker.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-a-Stress-Test.pdf",
        "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-TAVR.pdf?sc_lang=en",
    ],
}


# ─────────────────────────────────────────────
# JINA FETCHER
# ─────────────────────────────────────────────

def fetch_with_jina(url):
    """Fetch a URL via Jina AI and return (title, text) or (None, None) on failure."""
    jina_url = JINA_BASE + url

    try:
        response = requests.get(jina_url, headers=HEADERS, timeout=45)

        if response.status_code == 200:
            text = response.text.strip()
            title = url

            lines = text.splitlines()
            for line in lines[:8]:
                if line.startswith("Title:"):
                    title = line.replace("Title:", "").strip()
                    break

            return title, text

        print(f"  ⚠️  HTTP {response.status_code} for {url}")
        return None, None

    except Exception as e:
        print(f"  ⚠️  Error fetching {url}: {e}")
        return None, None


def clean_text(text):
    """Basic cleanup for Jina output."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def write_markdown(output_file, pages, total_urls):
    """Write one batch of scraped pages to a markdown file."""
    output_path = OUTPUT_DIR / output_file

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Scraped Corpus Content\n\n")
        f.write(f"**Output file:** `{output_file}`  \n")
        f.write(f"**Pages scraped:** {len(pages)} of {total_urls}  \n")
        f.write("**Source group:** Heart.org / American Heart Association  \n\n")
        f.write("---\n\n")

        for i, page in enumerate(pages, 1):
            f.write(f"## {i}. {page['title']}\n\n")
            f.write(f"**Source:** {page['url']}\n\n")
            f.write(page["text"])
            f.write("\n\n---\n\n")

    print(f"✅ Saved {len(pages)} pages to: {output_path}")


def scrape_batch(output_file, urls):
    """Scrape a list of URLs and save them to one markdown file."""
    print(f"\n{'=' * 80}")
    print(f"Batch: {output_file}")
    print(f"Fetching {len(urls)} URLs via Jina AI...")
    print(f"{'=' * 80}\n")

    pages = []

    for i, url in enumerate(urls, 1):
        print(f"  [{i}/{len(urls)}] {url}")

        title, text = fetch_with_jina(url)

        if text:
            cleaned = clean_text(text)
            print(f"          ✓ '{title}' ({len(cleaned):,} chars)")
            pages.append({
                "url": url,
                "title": title,
                "text": cleaned,
            })
        else:
            print("          ✗ Failed — skipping")

        if i < len(urls):
            time.sleep(DELAY)

    if pages:
        write_markdown(output_file, pages, len(urls))
    else:
        print(f"❌ No pages fetched for batch: {output_file}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total_batches = len(BATCHES)
    total_urls = sum(len(urls) for urls in BATCHES.values())

    print(f"Starting Jina corpus scrape...")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Batches: {total_batches}")
    print(f"Total URLs: {total_urls}")

    for batch_index, (output_file, urls) in enumerate(BATCHES.items(), 1):
        print(f"\nRunning batch {batch_index}/{total_batches}")
        scrape_batch(output_file, urls)

        if batch_index < total_batches:
            print(f"\nPausing {DELAY} seconds before next batch...")
            time.sleep(DELAY)

    print("\n🎉 All batches complete!")


if __name__ == "__main__":
    main()