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

URLS = [
    "http://www.healthychildren.org/English/family-life/health-management/pediatric-specialists/pages/What-is-a-Pediatric-Heart-Surgeon.aspx",
    "http://www.healthychildren.org/English/family-life/health-management/pediatric-specialists/pages/What-is-a-Pediatric-Nephrologist.aspx",
    "http://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Heart-Disease.aspx",
    "http://www.healthychildren.org/English/healthy-living/emotional-wellness/Building-Resilience/Pages/The-Greatest-Gift-You-Can-Give-Your-Child-Video.aspx",
    "http://www.healthychildren.org/English/healthy-living/fitness/Pages/Energy-Out-Daily-Physical-Activity-Recommendations.aspx",
    "http://www.healthychildren.org/English/healthy-living/nutrition/Pages/Energy-In-Recommended-Food-Drink-Amounts-for-Children.aspx",
    "http://www.healthychildren.org/English/healthy-living/nutrition/Pages/Front-of-Package-Nutrition-Labels.aspx",
    "http://www.healthychildren.org/English/healthy-living/nutrition/Pages/We-Dont-Need-to-Add-Salt-to-Food.aspx",
    "https://publications.aap.org/pediatrics/article-abstract/102/1/137/65417/A-New-Definition-of-Children-With-Special-Health?redirectedFrom=fulltext",
    "https://publications.aap.org/pediatrics/article-abstract/134/5/885/75861/College-Health-Service-Capacity-to-Support-Youth?redirectedFrom=fulltext",
    "https://publications.aap.org/pediatrics/article/140/5/e20172607/37782/The-Care-of-Children-With-Congenital-Heart-Disease",
    "https://publications.aap.org/pediatrics/article/142/5/e20182587/38577/Supporting-the-Health-Care-Transition-From",
    "https://publications.aap.org/pediatrics/collection/665/Cardiology",
    "https://shop.aap.org/collaborating-to-provide-lifelong-care-for-people-with-congenital-heart-defects/",
    "https://shop.aap.org/professional-education/live-activities/",
    "https://shop.aap.org/professional-education/online-courses/",
    "https://shop.aap.org/professional-education/self-assessments/",
    "https://www.aap.org/en/news-room/aap-voices/congenital-heart-disease-and-the-importance-of-nutrition-physical-activity/",
    "https://www.aap.org/en/news-room/aap-voices/congenital-heart-disease-and-the-importance-of-nutrition-physical-activity/~/link/4debf8624851454d89634b8ea8f395e7.aspx",
    "https://www.aap.org/en/news-room/aap-voices/congenital-heart-disease-and-the-importance-of-nutrition-physical-activity/~/link/bb910e64a9564f3386b556e101c32f91.aspx",
    "https://www.aap.org/en/news-room/news-releases-from-the-aap/",
    "https://www.aap.org/en/news-room/news-releases/aap/2024/american-academy-of-pediatrics-updates-screening-recommendations-for-critical-congenital-heart-disease/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defect-chd-databases-for-surveillance-research-and-innovation/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defect-fact-sheets/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defects-toolkit/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defects-toolkit/awareness-of-congenital-heart-defects-among-healthcare-clinicians-point-of-care-tools/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defects-toolkit/facilitated-mini-trainings-congenital-heart-defects/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defects-toolkit/lifelong-care-for-patients-with-congenital-heart-defects-webinar/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-defects-toolkit/stay-up-to-date-on-new-congenital-heart-defects-resources/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/access-to-care-for-congenital-heart-disease/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/chphc-monthly-minute-newsletter/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/contact-us-congenital-heart-public-health-consortium/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/executive-summary-chphc-implementation-blueprint-20252028/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/health-supervision-for-adolescents-and-young-adults/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/health-systems-framework/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/congenital-heart-public-health-consortium/insurance-and-other-resources-for-families/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/equipping-campus-health-to-care-for-young-adults-with-congenital-heart-disease/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/health-supervision-for-children-with-congenital-heart-disease/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/join-the-congenital-heart-public-health-consortium/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/newborn-screening-for-critical-congenital-heart-defect-cchd/",
    "https://www.aap.org/en/patient-care/congenital-heart-defects/telehealth-care-and-congenital-heart-disease/",
    "https://www.healthychildren.org/English/ages-stages",
    "https://www.healthychildren.org/English/ages-stages/baby",
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/Newborn-Pulse-Oximetry-Screening-to-Detect-Critical-Congenital-Heart-Disease.aspx",
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/Newborn-Screening-Tests.aspx",
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/ways-you-can-bond-with-your-baby.aspx",
    "https://www.healthychildren.org/English/ages-stages/baby/preemie/Pages/Health-Issues-of-Premature-Babies.aspx",
    "https://www.healthychildren.org/English/ages-stages/gradeschool/nutrition/Pages/How-to-Reduce-Fat-and-Cholesterol-in-Your-Childs-Diet.aspx",
    "https://www.healthychildren.org/English/ages-stages/gradeschool/nutrition/Pages/Making-Healthy-Food-Choices.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/Pages/Alcohol-and-Pregnancy-Its-Just-Not-Worth-the-Risk-Video.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/Pages/Nutrition-and-Exercise-During-Pregnancy.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/Pages/Prenatal-Genetic-Counseling.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/Pages/Reduce-the-Risk-of-Birth-Defects.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/Pages/Tests-During-Pregnancy.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/Pages/Where-We-Stand-Smoking-During-Pregnancy.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/delivery-beyond/Pages/Delivery-Room-Procedures-Following-a-Normal-Vaginal-Birth.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/delivery-beyond/Pages/Delivery-What-About-the-Pain.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/delivery-beyond/Pages/Delivery-by-Cesarean-Section.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/delivery-beyond/Pages/Let-Baby-Set-the-Delivery-Date-Wait-until-39-Weeks-if-You-Can.aspx",
    "https://www.healthychildren.org/English/ages-stages/prenatal/delivery-beyond/Pages/bringing-baby-home-what-to-do-before-leaving-the-hospital.aspx",
    "https://www.healthychildren.org/English/ages-stages/teen/dating-sex/Pages/Birth-Control-for-Sexually-Active-Teens.aspx",
    "https://www.healthychildren.org/English/ages-stages/young-adult",
    "https://www.healthychildren.org/English/ages-stages/young-adult/Pages/College-Congenital-Heart-Disease-Parents.aspx",
    "https://www.healthychildren.org/English/ages-stages/young-adult/Pages/Healthy-Tips-for-the-College-Freshman.aspx",
    "https://www.healthychildren.org/English/ages-stages/young-adult/Pages/Mental-Health-Tips-for-Teens-Graduating-from-High-School.aspx",
    "https://www.healthychildren.org/English/asthmatracker/Pages/asthmatracker.aspx",
    "https://www.healthychildren.org/English/family-life",
    "https://www.healthychildren.org/English/family-life/family-dynamics/Pages/How-Taking-Care-of-Yourself-Makes-you-a-Better-Mom.aspx",
    "https://www.healthychildren.org/English/family-life/health-management",
    "https://www.healthychildren.org/English/family-life/health-management/Pages/Theres-No-I-in-Teamwork-AAP-Policy-Explained.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/Pages/Well-Child-Care-A-Check-Up-for-Success.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/Pages/Your-Childs-Health-Story.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/Pages/Your-Childs-Medical-Home-What-You-Need-to-Know.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/Pages/Your-Family-Health-History-and-Genetics.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/health-insurance",
    "https://www.healthychildren.org/English/family-life/health-management/health-insurance/Pages/7-Things-to-Know-About-Open-Enrollment.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/health-insurance/Pages/Understanding-Cost-Sharing-Deductibles-Copayments-Coinsurance.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/health-insurance/Pages/choosing-your-familys-health-insurance-coverage.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/health-insurance/Pages/how-to-read-a-medical-bill-tips-for-parents.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/health-insurance/Pages/medicaid-and-childrens-health-insurance-program-chip-facts-for-families.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/pediatric-specialists/Pages/What-is-a-Pediatric-Cardiologist.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/pediatric-specialists/Pages/What-is-a-Pediatric-Heart-Surgeon.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/pediatric-specialists/Pages/What-is-a-Pediatric-Infectious-Diseases-Specialist.aspx",
    "https://www.healthychildren.org/English/family-life/health-management/pediatric-specialists/Pages/What-is-a-Pediatric-Rheumatologist.aspx",
    "https://www.healthychildren.org/English/health-issues",
    "https://www.healthychildren.org/English/health-issues/conditions",
    "https://www.healthychildren.org/English/health-issues/conditions/COVID-19/Pages/Youth-Sports-Participation-During-COVID-19-A-Safety-Checklist.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/chronic/Pages/Anemia-and-Your-Child.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/chronic/Pages/Chronic-Kidney-Disease-in-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/chronic/Pages/Clean-Intermittent-Catheterization.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/developmental-disabilities/Pages/Children-with-Down-Syndrome-Health-Care-Information-for-Families.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/Fever-and-Your-Baby.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/When-to-Call-the-Pediatrician.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/head-neck-nervous-system/Pages/Dizziness-and-Fainting-Spells.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Birth-Control-for-Young-Women-with-a-CHD.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Cardiomyopathy-in-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Challenges-Faced-by-Parents-of-Children-with-Congenital-Heart-Disease.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Chest-Pain-in-Children-and-Teenagers.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Chest-Pain-in-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Cholesterol-Levels-in-Children-and-Adolescents.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Common-Heart-Defects.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Common-Types-of-Cardiac-Testing.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Congenital-Heart-Defects-Resources-to-Help-Your-Child-Thrive-From-Birth-to-Adulthood-.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Endocarditis.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Fainting-Syncope.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Familial-Hypercholesterolemia-FH.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Genetics-and-Congenital-Heart-Defects.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Heart-Disease.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Heart-Failure-in-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Heart-Murmur.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Helping-Children-With-Congenital-Heart-Disease-Stay-Healthy,-Active-%26-Fit.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Helping-Children-With-Congenital-Heart-Disease-Stay-Healthy,-Active-&-Fit.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/High-Blood-Pressure-in-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Irregular-Heartbeat-Arrhythmia.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Kawasaki-Disease.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Myocarditis.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Parenting-with-CHD-Why-Prioritizing-Your-Own-Health-Is-Important.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Pediatric-Cardiomyopathy.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Pericarditis.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Planning-A-Healthy-Pregnancy-with-a-CHD.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Postural-Orthostatic-Tachycardia-Syndrome-POTS.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Preconception-Counseling-for-Women-with-a-CHD.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Pulmonary-Hypertension-in-Infants-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Reproductive-Health-in-Young-Women-with-Congenital-Heart-Defects.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/Rheumatic-Fever.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/birth-control-for-young-women-with-a-chd.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/challenges-faced-by-parents-of-children-with-congenital-heart-disease.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/dental-care-for-children-with-heart-conditions.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/how-much-do-you-know-about-kids-heart-health-and-cholesterol.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/inherited-high-cholesterol-in-children-what-families-need-to-know.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/marfan-syndrome-keeping-kids-with-this-inherited-condition-healthy.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/parenting-with-chd-why-prioritizing-your-own-health-is-important.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/pediatric-cardiomyopathy.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/planning-a-healthy-pregnancy-with-a-chd.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/preconception-counseling-for-women-with-a-chd.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/reproductive-health-in-young-women-with-congenital-heart-defects.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/heart/Pages/words-of-support-for-new-heart-moms.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/obesity/Pages/Body-Mass-Index-Formula.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/obesity/Pages/Ways-to-Protect-Your-Kids-Against-Metabolic-Syndrome.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/obesity/Pages/childhood-obesity-a-complex-disease.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/obesity/Pages/obesity-prevention-aap-policy-explained.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/seizures/Pages/Seizures-and-Epilepsy-in-Children.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/sexually-transmitted/Pages/Sexually-Transmitted-Infections-Prevention.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/tobacco/Pages/Dangers-of-Secondhand-Smoke.aspx",
    "https://www.healthychildren.org/English/health-issues/conditions/tobacco/Pages/How-to-Quit-When-the-Smoker-is-You.aspx",
    "https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Responding-to-a-Choking-Emergency.aspx",
    "https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Using-an-AED.aspx",
    "https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/dehydration.aspx",
    "https://www.healthychildren.org/English/health-issues/injuries-emergencies/sports-injuries/Pages/Preparing-for-Sudden-Cardiac-Arrest-in-Schools.aspx",
    "https://www.healthychildren.org/English/health-issues/injuries-emergencies/sports-injuries/Pages/Sudden-Cardiac-Death.aspx",
    "https://www.healthychildren.org/English/healthy-living/emotional-wellness/Building-Resilience/Pages/When-Things-Arent-Perfect-Caring-for-Yourself-Your-Children.aspx",
    "https://www.healthychildren.org/English/healthy-living/fitness/Pages/Energy-Out-Daily-Physical-Activity-Recommendations.aspx",
    "https://www.healthychildren.org/English/healthy-living/fitness/Pages/Making-Fitness-a-Way-of-Life.aspx",
    "https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Choose-Water-for-Healthy-Hydration.aspx",
    "https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Front-of-Package-Nutrition-Labels.aspx",
    "https://www.healthychildren.org/English/healthy-living/nutrition/Pages/How-to-Reduce-Added-Sugar-in-Your-Childs-Diet.aspx",
    "https://www.healthychildren.org/English/healthy-living/sports/Pages/Sports-Physical-PPE.aspx",
    "https://www.healthychildren.org/English/news/Pages/AAP-Issues-Guidance-on-Using-the-Medical-Home-to-Care-for-Children-with-Congenital-Heart-Disease.aspx",
    "https://www.healthychildren.org/English/news/Pages/Kids-Should-Not-Consume-Energy-Drinks-and-Rarely-Need-Sports-Drinks-Says-AAP.aspx",
    "https://www.healthychildren.org/English/news/Pages/Why-All-Children-Should-Be-Screened-for-Potential-Heart-Related-Issues.aspx",
]

OUTPUT_FILE = "aapconsortium_output_v2.md"

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