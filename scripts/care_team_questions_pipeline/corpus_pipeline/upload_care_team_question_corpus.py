"""
Upload care team question corpus JSON to Supabase `care_team_questions__corpus`
(upsert on `slug`).

Requires either:
  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
or:
  VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

Run from repo root:
  py -3 scripts/care_team_questions_pipeline/corpus_pipeline/upload_care_team_question_corpus.py
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
INPUT_JSON = BASE_DIR / "input" / "question_corpus_seed.json"
TABLE = "care_team_questions__corpus"

STRIP_FIELDS = frozenset({"id", "created_at", "updated_at"})

BATCH_SIZE = 150


def resolve_credentials() -> tuple[str, str, str]:
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

    required_text_fields = [
        "question",
        "slug",
        "target_person",
        "knowledge_level",
        "question_category",
        "source_name",
        "source_type",
    ]

    for field in required_text_fields:
        value = rec.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"missing or empty {field}")

    required_array_fields = [
        "visit_types",
        "emotional_contexts",
        "help_topics",
        "provider_types",
        "tags",
    ]

    for field in required_array_fields:
        if field not in rec:
            errors.append(f"missing {field}")
        elif not isinstance(rec[field], list):
            errors.append(f"{field} must be a JSON array")

    if "priority" in rec and not isinstance(rec["priority"], int):
        errors.append("priority must be an integer")

    if "is_fallback" in rec and not isinstance(rec["is_fallback"], bool):
        errors.append("is_fallback must be a boolean")

    return errors


EXPECTED_FIELDS = [
    "question",
    "slug",
    "visit_types",
    "emotional_contexts",
    "help_topics",
    "target_person",
    "knowledge_level",
    "question_category",
    "provider_types",
    "grounding_phrase",
    "freeze_script",
    "source_name",
    "source_url",
    "source_type",
    "priority",
    "is_fallback",
    "tags",
]


def prepare_row(rec: dict) -> dict:
    row = {}

    for field in EXPECTED_FIELDS:
        if field in rec:
            row[field] = rec[field]
        elif field in ("visit_types", "emotional_contexts", "help_topics", "provider_types", "tags"):
            row[field] = []
        elif field == "priority":
            row[field] = 2
        elif field == "is_fallback":
            row[field] = True
        else:
            row[field] = None

    return row


def upsert_batch(
    supabase_url: str,
    service_key: str,
    rows: list[dict],
) -> tuple[int, str | None]:
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

    if not INPUT_JSON.is_file():
        print(f"File not found: {INPUT_JSON}", file=sys.stderr)
        sys.exit(1)

    records = json.loads(INPUT_JSON.read_text(encoding="utf-8"))

    if not isinstance(records, list):
        print("Question corpus JSON must be a JSON array.", file=sys.stderr)
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
    print(f"Source file: {INPUT_JSON}")
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
        f"\nNote: upsert requires a UNIQUE constraint on {TABLE}.slug "
        "(PostgREST ?on_conflict=slug)."
    )
    print("\nDone.")


if __name__ == "__main__":
    main()