"""
Upload glossary JSON to Supabase `glossary_terms` (upsert on `slug`).

Uses `output/canonicalized_glossary_terms.json` when present (run
canonicalize_glossary_terms.py after merge); otherwise falls back to
`output/merged_glossary_terms.json`.

Requires either:
  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
or:
  VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

Run from repo root:
  py -3 scripts/glossary_terms_pipeline/upload_glossary_terms.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


BASE_DIR = Path(__file__).resolve().parent
# Pipeline stage: run canonicalize_glossary_terms.py after merge to produce this file.
CANONICALIZED_JSON = BASE_DIR / "output" / "canonicalized_glossary_terms.json"
MERGED_JSON = BASE_DIR / "output" / "merged_glossary_terms.json"
TABLE = "glossary_terms"

# Do not send these keys:
# - DB-managed fields: id, created_at, updated_at
# - internal pipeline helper: _normalized_term
# - legacy single-category field: category
STRIP_FIELDS = frozenset(
    {"id", "created_at", "updated_at", "_normalized_term", "category"}
)

BATCH_SIZE = 150


def resolve_credentials() -> tuple[str, str, str]:
    """Returns (url, key, description of which env vars were used)."""
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url and key:
        return url.rstrip("/"), key, "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"

    url = os.environ.get("VITE_SUPABASE_URL", "").strip()
    key = os.environ.get("VITE_SUPABASE_ANON_KEY", "").strip()
    if url and key:
        return url.rstrip("/"), key, "VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY"

    print(
        "Missing Supabase credentials.\n"
        "Set either:\n"
        "  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n"
        "or:\n"
        "  VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
        file=sys.stderr,
    )
    sys.exit(1)


def validate_record(rec: dict) -> list[str]:
    errors: list[str] = []

    if not (rec.get("term") or "").strip():
        errors.append("missing or empty term")

    if not (rec.get("slug") or "").strip():
        errors.append("missing or empty slug")

    if not (rec.get("full_definition") or "").strip():
        errors.append("missing or empty full_definition")

    for field in ("categories", "aliases", "search_keywords"):
        if field not in rec:
            errors.append(f"missing {field}")
        elif not isinstance(rec[field], list):
            errors.append(f"{field} must be a JSON array")

    return errors


def prepare_row(rec: dict) -> dict:
    """
    Strip DB-managed/internal/legacy keys before upload.

    Important:
    Keep full_definition as full_definition because the Supabase glossary_terms
    table uses the full_definition column.
    """
    return {k: v for k, v in rec.items() if k not in STRIP_FIELDS}


def upsert_batch(
    supabase_url: str,
    service_key: str,
    rows: list[dict],
) -> tuple[int, str | None]:
    """
    POST upsert batch. Returns (number of rows in response body, error_message or None).
    """
    endpoint = f"{supabase_url}/rest/v1/{TABLE}?on_conflict=slug"
    body = json.dumps(rows, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation,resolution=merge-duplicates",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")

            if not raw.strip():
                return len(rows), None

            data = json.loads(raw)
            if isinstance(data, list):
                return len(data), None

            return len(rows), None

    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8")
        except Exception:
            detail = str(e)
        return 0, f"HTTP {e.code}: {detail[:2000]}"

    except urllib.error.URLError as e:
        return 0, str(e.reason if hasattr(e, "reason") else e)


def main() -> None:
    supabase_url, service_key, cred_source = resolve_credentials()

    source_path = CANONICALIZED_JSON if CANONICALIZED_JSON.is_file() else MERGED_JSON
    if not source_path.is_file():
        print(
            f"File not found: {CANONICALIZED_JSON} (or fallback {MERGED_JSON})",
            file=sys.stderr,
        )
        sys.exit(1)

    records = json.loads(source_path.read_text(encoding="utf-8"))

    if not isinstance(records, list):
        print("Glossary JSON must be a JSON array.", file=sys.stderr)
        sys.exit(1)

    loaded = len(records)
    prepared: list[dict] = []
    validation_errors: list[str] = []

    for i, rec in enumerate(records):
        if not isinstance(rec, dict):
            validation_errors.append(f"Row {i}: not an object")
            continue

        errs = validate_record(rec)
        if errs:
            slug = rec.get("slug", "?")
            validation_errors.append(f"Row {i} (slug={slug!r}): {', '.join(errs)}")
            continue

        prepared.append(prepare_row(rec))

    print(f"Credentials: {cred_source}")
    print(f"Source file: {source_path}")
    print(f"Records loaded from JSON: {loaded}")
    print(f"Records passing validation: {len(prepared)}")
    print(f"Records skipped (validation): {loaded - len(prepared)}")

    if validation_errors:
        print("\nValidation failures:")
        for line in validation_errors[:50]:
            print(f"  - {line}")
        if len(validation_errors) > 50:
            print(f"  ... and {len(validation_errors) - 50} more")

    if not prepared:
        print("\nNothing to upload.")
        sys.exit(1)

    total_upserted = 0
    batch_errors: list[str] = []

    for start in range(0, len(prepared), BATCH_SIZE):
        batch = prepared[start : start + BATCH_SIZE]
        n, err = upsert_batch(supabase_url, service_key, batch)

        if err:
            batch_errors.append(f"Batch rows {start}-{start + len(batch) - 1}: {err}")
        else:
            total_upserted += n if n else len(batch)

    print(f"\nRecords upserted: {total_upserted}")

    if batch_errors:
        print("\nUpload errors; some batches may not have been applied:")
        for line in batch_errors:
            print(f"  - {line}")
        sys.exit(1)

    print(
        "\nNote: upsert requires a UNIQUE constraint on glossary_terms.slug "
        "(PostgREST ?on_conflict=slug)."
    )
    print("\nDone.")


if __name__ == "__main__":
    main()