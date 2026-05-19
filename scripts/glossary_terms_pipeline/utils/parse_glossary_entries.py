import re


START_PATTERNS = [
    r"Glossary of Common CHD\s+Terms and\s+Abbreviations",
    r"Glossary of Terms",
    r"Glossary of Caregivers",
    r"\bGlossary\b",
]

STOP_PATTERNS = [
    r"Additional Resources",
    r"References",
    r"Index",
    r"Part 2:",
    r"Part 3:",
    r"Part 4:",
    r"Part 5:",
]


# Mended Little HeartGuide: only the glossary section is scraped for Term:
# entries. Other sections are covered by manual JSON.
MENDED_SECTION_CONFIG = [
    {
        "source_section": "glossary_common_chd_terms_and_abbreviations",
        "name": "Glossary of Common CHD Terms and Abbreviations",
        "start_patterns": [r"Glossary of Common CHD\s+Terms and\s+Abbreviations"],
        "end_patterns": [
            r"Things You May Be Feeling After a Prenatal Diagnosis",
            r"Part 2:\s*Prenatal Diagnosis",
            r"<!--\s*Page\s+36\s*-->",
        ],
    },
]


def extract_glossary_sections(text: str, file_name: str) -> list[dict]:
    """
    Returns a list of section dicts. Each dict has:
      - name: human-readable section heading (may be None for generic fallback)
      - source_section: snake_case id for the section (may be None)
      - text: the raw isolated section text
    """
    if "mended_little_heartguide" in file_name:
        return _extract_whitelisted_sections(text, MENDED_SECTION_CONFIG)

    if "its_my_heart" in file_name:
        return _extract_its_my_heart_sections(text)

    return _extract_generic_sections(text)


def _extract_whitelisted_sections(text: str, configs: list[dict]) -> list[dict]:
    sections: list[dict] = []

    for config in configs:
        body = _isolate_whitelisted_body(
            text,
            start_patterns=config["start_patterns"],
            end_patterns=config["end_patterns"],
        )
        if body is None:
            continue

        sections.append(
            {
                "name": config["name"],
                "source_section": config["source_section"],
                "text": body,
            }
        )

    return sections


def _isolate_whitelisted_body(
    text: str,
    start_patterns: list[str],
    end_patterns: list[str],
) -> str | None:
    """
    Finds the first non-TOC occurrence of any start pattern and returns the
    text from there until the earliest end-pattern match (or end of file).
    """
    for start_pattern in start_patterns:
        for start_match in re.finditer(
            start_pattern, text, flags=re.IGNORECASE | re.DOTALL
        ):
            body_start = start_match.end()

            # Guard against TOC matches: a real body should not be immediately
            # followed by dot-leaders or just a page number.
            if _looks_like_toc_context(text[body_start : body_start + 200]):
                continue

            tail = text[body_start:]

            stop_positions: list[int] = []
            for end_pattern in end_patterns:
                end_match = re.search(
                    end_pattern, tail, flags=re.IGNORECASE | re.DOTALL
                )
                if end_match:
                    stop_positions.append(end_match.start())

            end = min(stop_positions) if stop_positions else len(tail)
            return tail[:end]

    return None


def _looks_like_toc_context(snippet: str) -> bool:
    """
    Returns True if the snippet immediately after a heading looks like a
    table-of-contents entry rather than real section body content.
    Heuristics:
      - contains spaced dot-leaders such as ". . . ."
      - contains a long run of dots (`....`)
      - is mostly punctuation + a trailing page number
    """
    if re.search(r"\.\s*\.\s*\.\s*\.", snippet):
        return True

    if re.search(r"\.{4,}", snippet):
        return True

    # Mostly whitespace/punctuation followed by a small page number.
    stripped = snippet.strip()
    if re.fullmatch(r"[.\s]{0,200}\d{1,4}\s*", stripped):
        return True

    return False


def _extract_its_my_heart_sections(text: str) -> list[dict]:
    sections: list[dict] = []

    for pattern in [r"Glossary of Terms", r"\bGlossary\b"]:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            start = match.end()
            tail = text[start:]

            stop_match = re.search(
                r"(Additional Resources|References|Index)",
                tail,
                flags=re.IGNORECASE,
            )

            end = stop_match.start() if stop_match else min(len(tail), 50000)
            candidate = tail[:end]

            if candidate.count(":") >= 10:
                sections.append(
                    {
                        "name": "Glossary of Terms",
                        "source_section": "glossary_of_terms",
                        "text": candidate,
                    }
                )
                break

        if sections:
            break

    return sections


def _extract_generic_sections(text: str) -> list[dict]:
    sections: list[dict] = []

    for start_pattern in START_PATTERNS:
        for match in re.finditer(start_pattern, text, flags=re.IGNORECASE):
            start = match.end()
            tail = text[start:]

            stop_positions = []
            for stop_pattern in STOP_PATTERNS:
                stop_match = re.search(stop_pattern, tail, flags=re.IGNORECASE)
                if stop_match:
                    stop_positions.append(stop_match.start())

            end = min(stop_positions) if stop_positions else min(len(tail), 50000)
            candidate = tail[:end]

            if candidate.count(":") >= 5:
                sections.append(
                    {
                        "name": None,
                        "source_section": None,
                        "text": candidate,
                    }
                )

    return sections


def parse_glossary_entries(text: str, return_debug: bool = False):
    """
    Parses glossary text where entries mostly look like:
    Term: Definition...

    If return_debug=True, returns:
    (entries, debug_info)
    """

    text = _preprocess_for_entry_detection(text)

    entry_pattern = re.compile(
        r"""
        ^\s*
        (?P<term>[A-Za-z0-9][A-Za-z0-9/\-??(),.'?& ]{1,90})
        :
        \s*
        (?P<definition>.*?)
        (?=
            \n\s*[A-Za-z0-9][A-Za-z0-9/\-??(),.'?& ]{1,90}:\s
            |
            \Z
        )
        """,
        flags=re.MULTILINE | re.DOTALL | re.VERBOSE,
    )

    entries = []
    skipped = []
    total_matches = 0

    for match in entry_pattern.finditer(text):
        total_matches += 1

        term = clean_term(match.group("term"))
        definition = clean_definition(match.group("definition"))

        reason = _rejection_reason(term, definition)
        if reason is not None:
            if return_debug:
                skipped.append(
                    {
                        "term": term,
                        "definition": definition,
                        "reason": reason,
                    }
                )
            continue

        entries.append(
            {
                "term": term,
                "definition": definition,
            }
        )

    if return_debug:
        return entries, {
            "total_regex_matches": total_matches,
            "skipped": skipped,
            "preprocessed_text": text,
        }

    return entries


def _preprocess_for_entry_detection(text: str) -> str:
    # Normalize weird PDF bullet/control characters into line breaks.
    text = text.replace("\u001b", "\n")
    text = text.replace("", "\n")
    text = re.sub(r"[????]\s*", "\n", text)

    # Put likely term starts on new lines after completed sentences.
    text = re.sub(
        r"(?<=[.!?])\s+([A-Z][A-Za-z0-9/\-??(),.'?& ]{1,90}:)",
        r"\n\1",
        text,
    )

    # Handle acronym-style starts after completed sentences.
    text = re.sub(
        r"(?<=[.!?])\s+([A-Z]{2,10}(?:\s+or\s+[A-Z]{2,10})?:)",
        r"\n\1",
        text,
    )

    return text


PROSE_TERM_STARTERS = {
    "one",
    "two",
    "three",
    "the",
    "this",
    "these",
    "those",
    "when",
    "while",
    "if",
    "because",
    "symptoms",
    "may",
    "it",
    "they",
}


def _rejection_reason(term: str, definition: str) -> str | None:
    if len(term) < 2:
        return "term too short"

    if len(term) > 90:
        return "term too long"

    if len(term.split()) > 8:
        return "term has too many words (likely a sentence)"

    first_word = term.split(None, 1)[0].lower() if term else ""
    if first_word in PROSE_TERM_STARTERS:
        return "term starts like prose"

    bad_terms = {
        "Title",
        "URL Source",
        "Markdown Content",
        "Source",
        "Number of Pages",
    }

    if term in bad_terms:
        return "invalid metadata term"

    if definition.lower().startswith("http"):
        return "definition is a URL"

    if len(definition) < 15 and not _is_redirect_definition(definition):
        return "definition too short"

    return None


def _is_redirect_definition(definition: str) -> bool:
    return bool(
        re.match(
            r"^see\s+[A-Za-z0-9 .,'?()/-]+\.?$",
            definition.strip(),
            flags=re.IGNORECASE,
        )
    )


def clean_term(term: str) -> str:
    term = term.strip()
    term = re.sub(r"^[^A-Za-z0-9]+", "", term)
    term = re.sub(r"\s+", " ", term)
    return term.strip()


def clean_definition(definition: str) -> str:
    definition = definition.strip()
    definition = re.sub(r"\s+", " ", definition)
    definition = re.sub(r"\s+([.,;:])", r"\1", definition)
    return definition.strip()