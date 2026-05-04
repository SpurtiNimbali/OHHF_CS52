from __future__ import annotations

import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from config import TRACKING_QUERY_KEYS


def normalize_text(value: str | None) -> str:
    """Unicode normalize, strip, collapse whitespace, trim stray punctuation noise."""
    if not value:
        return ""
    s = unicodedata.normalize("NFKC", value)
    s = s.replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s)
    s = s.strip()
    s = re.sub(r"^[\s\-\u2022\u25cf\u25cb\u2023]+", "", s)
    s = re.sub(r"[\s\-\u2022\u25cf\u25cb\u2023]+$", "", s)
    return s


def text_fingerprint(value: str | None) -> str:
    """Fingerprint for near-duplicate titles (case and punctuation insensitive)."""
    t = normalize_text(value).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def canonical_url(raw: str | None) -> str | None:
    """Return canonical http(s) URL or None if not a usable web link."""
    if not raw:
        return None
    u = normalize_text(raw)
    if not u:
        return None
    lower = u.lower()
    if lower.startswith("mailto:") or lower.startswith("javascript:"):
        return None
    if not lower.startswith(("http://", "https://")):
        return None
    try:
        parsed = urlparse(u)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    host = parsed.hostname or ""
    if not host:
        return None
    netloc = host.lower()
    if parsed.port and parsed.port not in (80, 443):
        netloc = f"{netloc}:{parsed.port}"
    path = parsed.path or ""
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=False)
        if k.lower() not in TRACKING_QUERY_KEYS
    ]
    pairs.sort(key=lambda kv: kv[0].lower())
    query = urlencode(pairs, doseq=True)
    canonical = urlunparse((parsed.scheme.lower(), netloc, path, "", query, ""))
    return canonical
