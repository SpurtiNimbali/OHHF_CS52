"""Vocabularies and tunable rules (prefer editing here over code changes)."""

from __future__ import annotations

# Question bank — must align with DB / app expectations
QUESTION_CATEGORIES: tuple[str, ...] = (
    "diagnosis",
    "treatment",
    "lifestyle",
    "monitoring",
)

# Support resources — Title Case to match src/lib/supabase.ts SupportResource union
RESOURCE_CATEGORIES: tuple[str, ...] = (
    "Financial Aid",
    "Mental Health",
    "Family Support",
    "Community",
)

WEB_CHAT_SOURCE = "ohhf_resources_webpage"

# Strip these query keys (lowercase) when building canonical URLs
TRACKING_QUERY_KEYS: frozenset[str] = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "_ga",
        "ref",
        "ref_",
    }
)

# Junk filters
MIN_TITLE_LEN = 2
MAX_TITLE_LEN = 300
MIN_QUESTION_LEN = 12
MAX_QUESTION_LEN = 500

# Stable synthetic host for PDF-derived chat rows (unique URLs for upsert); replace in prod if needed
PDF_CHAT_URL_BASE = "https://ohhf-pipeline.local/pdf"

# Filename → slug for `source` field on PDF-derived rows
DEFAULT_PDF_SLUG = "ollies-branch-therapist-guide-pediatric-heart-disease-v2-2026-04"
