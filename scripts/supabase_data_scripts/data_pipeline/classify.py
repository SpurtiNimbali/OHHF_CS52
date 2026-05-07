from __future__ import annotations

import re

from config import QUESTION_CATEGORIES, RESOURCE_CATEGORIES


def map_section_to_resource_category(section: str) -> str:
    """Map OHHF resource page section blurbs to support_resources.category."""
    s = (section or "").lower()
    if any(
        w in s
        for w in (
            "insurance",
            "financial",
            "affordable care",
            "cost",
            "billing",
            "medicaid",
        )
    ):
        return "Financial Aid"
    if any(
        w in s
        for w in (
            "mental health",
            "emotional",
            "trauma",
            "grief",
            "therapy",
            "counseling",
            "psychological",
            "lgbtq",
        )
    ):
        return "Mental Health"
    if any(
        w in s
        for w in (
            "caregiver",
            "family",
            "sibling",
            "parent",
            "prenatal",
            "postpartum",
            "child",
            "losing a child",
            "bereavement",
        )
    ):
        return "Family Support"
    return "Community"


def classify_question_category(text: str) -> str:
    """Best-effort bucket for PDF-derived questions (defaults to lifestyle)."""
    t = (text or "").lower()
    if any(
        w in t
        for w in (
            "diagnosis",
            "defect",
            "condition",
            "syndrome",
            "structural",
            "chd ",
            "heart disease",
        )
    ):
        return "diagnosis"
    if any(
        w in t
        for w in (
            "surgery",
            "procedure",
            "catheter",
            "medication",
            "treatment",
            "transplant",
            "hospital",
        )
    ):
        return "treatment"
    if any(
        w in t
        for w in (
            "monitor",
            "echo",
            "ekg",
            "oximetry",
            "weight",
            "follow-up",
            "follow up",
            "imaging",
            "test",
        )
    ):
        return "monitoring"
    if any(
        w in t
        for w in (
            "school",
            "peer",
            "community",
            "exercise",
            "diet",
            "sleep",
            "stress",
            "family",
            "caregiver",
            "identity",
        )
    ):
        return "lifestyle"
    return "lifestyle"


def assert_resource_category(value: str) -> str:
    if value not in RESOURCE_CATEGORIES:
        return "Community"
    return value


def assert_question_category(value: str) -> str:
    if value not in QUESTION_CATEGORIES:
        return "lifestyle"
    return value


def slugify_segment(value: str, max_len: int = 80) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "").lower()).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s[:max_len].rstrip("-") or "item"
