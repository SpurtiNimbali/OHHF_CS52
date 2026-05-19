import re
import unicodedata


CATEGORY_RULES = {
    "Conditions": [
        "defect",
        "syndrome",
        "stenosis",
        "atresia",
        "coarctation",
        "arrhythmia",
        "cyanosis",
        "heart failure",
        "hypertension",
        "hypoplastic",
        "tapvr",
        "hlhs",
        "tga",
        "tof",
        "vsd",
        "asd",
    ],
    "Procedures & Surgeries": [
        "procedure",
        "operation",
        "surgery",
        "shunt",
        "fontan",
        "glenn",
        "norwood",
        "rastelli",
        "switch",
        "catheterization",
        "bypass",
        "septostomy",
        "valvuloplasty",
    ],
    "Tests & Imaging": [
        "echo",
        "echocardiogram",
        "electrocardiogram",
        "ekg",
        "ecg",
        "x-ray",
        "mri",
        "ct",
        "holter",
        "stress test",
        "pulse oximetry",
    ],
    "Medications": [
        "drug",
        "medication",
        "anticoagulant",
        "antiarrhythmic",
        "heparin",
        "digoxin",
        "lasix",
        "prostaglandin",
    ],
    "Devices & Equipment": [
        "pacemaker",
        "ventilator",
        "defibrillator",
        "tube",
        "catheter",
        "oxygen",
        "monitor",
        "machine",
        "chest tube",
    ],
    "Anatomy": [
        "aorta",
        "artery",
        "atrium",
        "ventricle",
        "valve",
        "septum",
        "vein",
        "pulmonary",
        "mitral",
        "tricuspid",
    ],
    "Symptoms & Monitoring": [
        "blood pressure",
        "heart rate",
        "oxygen",
        "murmur",
        "failure to thrive",
        "bradycardia",
        "tachycardia",
        "cyanosis",
    ],
    "Hospital & Care Journey": [
        "attending",
        "cardiologist",
        "surgeon",
        "therapist",
        "fellow",
        "consulting",
        "intensivist",
        "nurse",
    ],
}


def slugify(term: str) -> str:
    value = unicodedata.normalize("NFKD", term)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value


def normalize_for_merge(term: str) -> str:
    term = term.lower()
    term = re.sub(r"\([^)]*\)", "", term)
    term = re.sub(r"[^a-z0-9]+", " ", term)
    term = re.sub(r"\s+", " ", term).strip()
    return term


def infer_aliases(term: str, definition: str) -> list[str]:
    aliases = set()

    # Parenthetical acronym in term: Ventricular Septal Defect (VSD)
    for match in re.finditer(r"\(([A-Z][A-Z0-9/\-]{1,10})\)", term):
        aliases.add(match.group(1).strip())

    # "ECG or EKG" style
    if " or " in term.lower():
        parts = re.split(r"\s+or\s+", term, flags=re.IGNORECASE)
        for part in parts:
            cleaned = part.strip()
            if cleaned and cleaned != term:
                aliases.add(cleaned)

    # Common “also called” / “often called”
    alias_match = re.search(
        r"(?:also called|often called|referred to as)\s+([^.;]+)",
        definition,
        flags=re.IGNORECASE,
    )
    if alias_match:
        candidate = alias_match.group(1).strip()
        if 2 <= len(candidate) <= 60:
            aliases.add(candidate)

    return sorted(aliases)


def make_short_definition(full_definition: str) -> str:
    cleaned = full_definition.strip()

    # First sentence works well for many source glossary entries.
    sentence_match = re.match(r"(.+?[.!?])(?:\s|$)", cleaned)
    if sentence_match:
        sentence = sentence_match.group(1).strip()
        if 25 <= len(sentence) <= 220:
            return sentence

    words = cleaned.split()
    return " ".join(words[:35]).strip()


def infer_categories(term: str, definition: str) -> list[str]:
    """
    Returns one or more category labels from keyword rules, in stable dict order.
    If nothing matches, returns ["General Medical Terms"].
    """
    haystack = f"{term} {definition}".lower()
    matched: list[str] = []

    for category, keywords in CATEGORY_RULES.items():
        for keyword in keywords:
            if keyword in haystack:
                matched.append(category)
                break

    if not matched:
        return ["General Medical Terms"]

    return matched