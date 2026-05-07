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
    # Caregiver Support resources
    "https://www.heart.org/en/health-topics/caregiver-support/tips-for-staying-healthy-and-active",
    "https://www.heart.org/en/-/media/Files/Health-Topics/Answers-by-Heart/How-can-I-support-my-loved-one.pdf",
    "https://www.heart.org/en/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Caregiver-Burnout.pdf",
    "https://www.heart.org/en/health-topics/caregiver-support/busy-caregivers",
    "https://www.heart.org/en/health-topics/caregiver-support/get-moving-tips-for-caregivers",
    "https://www.heart.org/en/health-topics/caregiver-support/top-10-cooking-tips-for-caregivers",
    "https://www.heart.org/en/health-topics/caregiver-support/communication-tips-for-caregivers",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/heart-to-heart-talking-to-your-doctor",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/getting-a-second-medical-opinion",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/health-literacy--understanding-what-your-doctor-is-saying",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/finding-the-right-doctor",
    "https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals/preparing-for-medical-visits",
    "https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/hospice-care",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/end-of-life",
    "https://www.heart.org/en/health-topics/consumer-healthcare/medication-information/medication-adherence-taking-your-meds-as-directed",
    "https://www.heart.org/en/health-topics/consumer-healthcare/medication-information/medication-interactions-food-supplements-and-other-drugs",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-to-Manage-Stress.pdf",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/Sleep-Affects-Health.pdf?sc_lang=en",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-can-I-make-Lifestyle-Healthier.pdf",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-Can-Physical-Activity-Become-a-Way-of-Life.pdf",
    "https://www.heart.org/en/health-topics/caregiver-support/caregivers-be-realistic-think-positive",
    "https://www.heart.org/en/health-topics/cardiac-rehab/taking-care-of-yourself",
    
    # Conditions and Definitions resources:
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
    
    # Treatments and Tests resources:
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
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-TAVR.pdf?sc_lang=en"
]
"""

URLS = [
    # Caregiver Support resources
    "https://www.heart.org/en/health-topics/caregiver-support/tips-for-staying-healthy-and-active",
    "https://www.heart.org/en/-/media/Files/Health-Topics/Answers-by-Heart/How-can-I-support-my-loved-one.pdf",
    "https://www.heart.org/en/-/media/Files/Health-Topics/Answers-by-Heart/What-Is-Caregiver-Burnout.pdf",
    "https://www.heart.org/en/health-topics/caregiver-support/busy-caregivers",
    "https://www.heart.org/en/health-topics/caregiver-support/get-moving-tips-for-caregivers",
    "https://www.heart.org/en/health-topics/caregiver-support/top-10-cooking-tips-for-caregivers",
    "https://www.heart.org/en/health-topics/caregiver-support/communication-tips-for-caregivers",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/heart-to-heart-talking-to-your-doctor",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/getting-a-second-medical-opinion",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/health-literacy--understanding-what-your-doctor-is-saying",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/finding-the-right-doctor",
    "https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals/preparing-for-medical-visits",
    "https://www.heart.org/en/health-topics/cardiac-rehab/communicating-with-professionals",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/hospice-care",
    "https://www.heart.org/en/health-topics/consumer-healthcare/doctor-appointments-questions-to-ask-your-doctor/end-of-life",
    "https://www.heart.org/en/health-topics/consumer-healthcare/medication-information/medication-adherence-taking-your-meds-as-directed",
    "https://www.heart.org/en/health-topics/consumer-healthcare/medication-information/medication-interactions-food-supplements-and-other-drugs",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-to-Manage-Stress.pdf",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/Sleep-Affects-Health.pdf?sc_lang=en",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-can-I-make-Lifestyle-Healthier.pdf",
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/How-Can-Physical-Activity-Become-a-Way-of-Life.pdf",
    "https://www.heart.org/en/health-topics/caregiver-support/caregivers-be-realistic-think-positive",
    "https://www.heart.org/en/health-topics/cardiac-rehab/taking-care-of-yourself",
    
    # Conditions and Definitions resources:
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
    
    # Treatments and Tests resources:
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
    "https://www.heart.org/-/media/Files/Health-Topics/Answers-by-Heart/What-is-TAVR.pdf?sc_lang=en"
]

OUTPUT_FILE = "corpus_scraped_data/chdcarecompass_output.md"

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