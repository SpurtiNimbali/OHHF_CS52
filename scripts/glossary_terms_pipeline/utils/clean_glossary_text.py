import re


NAV_LINES = {
    "About My Child’s Heart",
    "About My Child's Heart",
    "Table of Contents",
    "Introduction",
    "Go To",
    "SECTION",
    "General Information",
    "Prenatal Diagnosis",
    "In The Hospital",
    "Living With CHD",
    "Forms",
}


def clean_glossary_text(text: str) -> str:
    text = text.replace("\u001b", "\n")
    text = text.replace("▪", "\n")
    text = text.replace("•", "\n")
    text = text.replace("", "\n")

    # Remove page markers.
    text = re.sub(r"<!--\s*Page\s+\d+\s*-->", "\n", text)

    # Remove repeated PDF nav fragments.
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        if line in NAV_LINES:
            continue

        if re.fullmatch(r"\d+", line):
            continue

        if re.fullmatch(r"[1-5]\s+(General Information|Prenatal Diagnosis|In The Hospital|Living With CHD|Forms)", line):
            continue

        if line.startswith("PLAY VIDEO"):
            continue

        if line.startswith("Print a PDF"):
            continue

        if ". . ." in line:
            continue

        lines.append(line)

    text = "\n".join(lines)

    # Normalize spacing.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()