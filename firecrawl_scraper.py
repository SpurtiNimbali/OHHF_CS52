"""
firecrawl_scraper.py
────────────────────
Scrape webpages using Firecrawl and compile results into a single markdown file.

INSTALL:
    pip install requests

SETUP:
    Add your key to `.env.local` (preferred) or `.env`:
        FIRECRAWL_API_KEY=fc-...

USAGE:
    1) Edit URLS and OUTPUT_FILE below, then run:
        python firecrawl_scraper.py

    2) Or scrape a single URL:
        python firecrawl_scraper.py "https://example.com/page"

    3) Or crawl a whole site (and write one markdown output):
        python firecrawl_scraper.py --crawl "https://chdcarecompass.com/" --exclude-path "about($|/.*)"

NOTES:
    This uses Firecrawl's HTTP API directly (no extra SDK dependency).
"""

from __future__ import annotations

import argparse
import os
import re
import time
from functools import partial
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests

# Ensure progress logs show up immediately (helps when piping / running in tools).
print = partial(print, flush=True)  # type: ignore[assignment]

# ─────────────────────────────────────────────
# CONFIG — edit this section before each run
# ─────────────────────────────────────────────

URLS = [
    # "https://chdcarecompass.com/",
]

OUTPUT_FILE = "firecrawl_cincinnatichildrens_output.md"

# Polite delay between requests (seconds). Increase if you hit rate limits.
DELAY = 2

# If true, Firecrawl will try to return the main content only (less nav/boilerplate).
ONLY_MAIN_CONTENT = True

# Firecrawl endpoint
FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape"
FIRECRAWL_CRAWL_URL = "https://api.firecrawl.dev/v1/crawl"


def _sleep_backoff(attempt: int, *, base: float = 1.0, cap: float = 30.0) -> None:
    # Exponential backoff with a tiny deterministic jitter (no random import).
    # attempt=0 -> ~1s, attempt=1 -> ~2s, attempt=2 -> ~4s ... capped
    delay = min(cap, base * (2**attempt))
    jitter = (attempt % 7) * 0.137
    time.sleep(min(cap, delay + jitter))


def _request_json_with_retries(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    json: dict[str, Any] | None = None,
    timeout: float = 60,
    max_attempts: int = 8,
    retry_statuses: set[int] | None = None,
    log_retries: bool = False,
    label: str | None = None,
) -> dict[str, Any]:
    """
    Make an HTTP request expecting JSON, retrying transient failures.
    Retries: timeouts, connection errors, 429, and common 5xx gateway errors.
    """
    if retry_statuses is None:
        retry_statuses = {429, 500, 502, 503, 504}

    last_status: int | None = None
    last_detail: str | None = None
    for attempt in range(max_attempts):
        try:
            resp = requests.request(method, url, headers=headers, json=json, timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as e:
            last_detail = str(e)
            if attempt < max_attempts - 1:
                if log_retries:
                    prefix = f"{label}: " if label else ""
                    print(f"  … {prefix}{method} retry {attempt + 1}/{max_attempts} after network error: {e}")
                _sleep_backoff(attempt)
                continue
            raise SystemExit(f"Firecrawl request failed after retries: {method} {url}\n{last_detail}")

        last_status = resp.status_code
        if resp.status_code in retry_statuses and attempt < max_attempts - 1:
            if log_retries:
                prefix = f"{label}: " if label else ""
                print(f"  … {prefix}{method} retry {attempt + 1}/{max_attempts} after HTTP {resp.status_code}")
            _sleep_backoff(attempt)
            continue

        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise SystemExit(f"Firecrawl request failed (HTTP {resp.status_code}): {method} {url}\n{detail}")

        out = resp.json()
        if not isinstance(out, dict):
            raise SystemExit(f"Unexpected Firecrawl JSON response:\n{out}")
        return out

    raise SystemExit(
        f"Firecrawl request failed after retries: {method} {url}\n"
        f"Last status={last_status}\n{last_detail or ''}"
    )


def _load_dotenv_files() -> None:
    """Load `.env.local` then `.env` so `python firecrawl_scraper.py` sees keys (shell vars win)."""
    root = Path(__file__).resolve().parent
    for name in (".env.local", ".env"):
        path = root / name
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


def _firecrawl_api_key() -> str:
    _load_dotenv_files()
    return (os.environ.get("FIRECRAWL_API_KEY") or "").strip()


def _clean_text(text: str) -> str:
    # Normalize excess whitespace/blank lines.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _title_from_url(url: str) -> str:
    return url.replace("https://", "").replace("http://", "").strip("/").strip()


def _firecrawl_headers() -> dict[str, str]:
    api_key = _firecrawl_api_key()
    if not api_key:
        raise SystemExit(
            "Missing FIRECRAWL_API_KEY.\n"
            "  • Create a key in Firecrawl\n"
            "  • export FIRECRAWL_API_KEY='fc-...'\n"
            "  • or add FIRECRAWL_API_KEY=... to .env / .env.local in this folder."
        )
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; firecrawl-scraper/1.0)",
    }


def scrape_with_firecrawl(url: str) -> tuple[str, str] | tuple[None, None]:
    """
    Scrape a URL with Firecrawl and return (title, markdown_text).
    Returns (None, None) on failure.
    """
    headers = _firecrawl_headers()

    payload: dict[str, Any] = {
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": ONLY_MAIN_CONTENT,
    }

    try:
        data = _request_json_with_retries(
            "POST",
            FIRECRAWL_SCRAPE_URL,
            headers=headers,
            json=payload,
            timeout=60,
            max_attempts=5,
        )
        # Typical structure: { success: true, data: { markdown: "...", metadata: { title: ... } } }
        node = data.get("data") if isinstance(data, dict) else None
        if not isinstance(node, dict):
            print(f"  ⚠️  Unexpected Firecrawl response shape for {url}")
            return None, None

        md = node.get("markdown") or ""
        if not isinstance(md, str) or not md.strip():
            print(f"  ⚠️  No markdown returned for {url}")
            return None, None

        meta = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
        title = meta.get("title") if isinstance(meta.get("title"), str) and meta.get("title").strip() else None

        return (title or _title_from_url(url)), _clean_text(md)
    except requests.Timeout:
        print(f"  ⚠️  Timeout scraping {url}")
        return None, None
    except Exception as e:
        print(f"  ⚠️  Error scraping {url}: {e}")
        return None, None


def start_crawl(
    start_url: str,
    *,
    include_paths: list[str] | None = None,
    exclude_paths: list[str] | None = None,
    limit: int = 10000,
    crawl_entire_domain: bool = True,
    allow_external_links: bool = False,
    allow_subdomains: bool = False,
    ignore_query_parameters: bool = True,
    ignore_sitemap: bool = False,
) -> str:
    headers = _firecrawl_headers()
    payload: dict[str, Any] = {
        "url": start_url,
        "limit": limit,
        "crawlEntireDomain": crawl_entire_domain,
        "allowExternalLinks": allow_external_links,
        "allowSubdomains": allow_subdomains,
        "ignoreQueryParameters": ignore_query_parameters,
        "ignoreSitemap": ignore_sitemap,
        "scrapeOptions": {
            "formats": ["markdown"],
            "onlyMainContent": ONLY_MAIN_CONTENT,
        },
    }
    if include_paths:
        payload["includePaths"] = include_paths
    if exclude_paths:
        payload["excludePaths"] = exclude_paths

    data = _request_json_with_retries(
        "POST",
        FIRECRAWL_CRAWL_URL,
        headers=headers,
        json=payload,
        timeout=60,
        max_attempts=8,
    )
    crawl_id = data.get("id") if isinstance(data, dict) else None
    if not isinstance(crawl_id, str) or not crawl_id.strip():
        raise SystemExit(f"Unexpected Firecrawl crawl start response:\n{data}")
    return crawl_id


def fetch_crawl_results(crawl_id: str, *, poll_seconds: float = 2.0, timeout_seconds: float = 60 * 30) -> list[dict[str, Any]]:
    """
    Poll Firecrawl GET /crawl/{id} until completed/failed.
    Also follows `next` links to retrieve all data chunks (10MB pages).
    """
    headers = _firecrawl_headers()
    deadline = time.time() + timeout_seconds

    def _get(url: str) -> dict[str, Any]:
        get_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}
        # Status polling is where transient 5xx/gateway errors tend to happen.
        return _request_json_with_retries(
            "GET",
            url,
            headers=get_headers,
            json=None,
            timeout=20,
            max_attempts=12,
            retry_statuses={429, 500, 502, 503, 504},
            log_retries=True,
            label="crawl status",
        )

    status_url = f"https://api.firecrawl.dev/v1/crawl/{crawl_id}"
    last_completed = -1

    while True:
        if time.time() > deadline:
            raise SystemExit("Timed out waiting for Firecrawl crawl to complete.")

        obj = _get(status_url)
        status = obj.get("status")
        completed = obj.get("completed")
        total = obj.get("total")
        if completed != last_completed:
            print(f"  … status={status} completed={completed} total={total}")
            last_completed = completed if isinstance(completed, int) else last_completed

        if status == "failed":
            raise SystemExit(f"Firecrawl crawl failed.\n{obj}")

        if status == "completed":
            break

        time.sleep(poll_seconds)

    # Pull all data chunks (initial response + follow `next`)
    items: list[dict[str, Any]] = []
    next_url: str | None = status_url
    while next_url:
        obj = _get(next_url)
        data = obj.get("data")
        if isinstance(data, list):
            items.extend([x for x in data if isinstance(x, dict)])
        nxt = obj.get("next")
        if isinstance(nxt, str) and nxt.strip():
            # Docs: `next` can be a URL. If it's relative, join against api root.
            if nxt.startswith("http://") or nxt.startswith("https://"):
                next_url = nxt
            else:
                next_url = urljoin("https://api.firecrawl.dev/v1/", nxt.lstrip("/"))
        else:
            next_url = None

    return items


def _write_markdown(pages: list[dict[str, str]], *, output_file: str, title: str) -> None:
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n")
        f.write(f"**Pages scraped:** {len(pages)}  \n\n")
        f.write("---\n\n")
        for i, page in enumerate(pages, 1):
            f.write(f"## {i}. {page['title']}\n\n")
            f.write(f"**Source:** {page['url']}\n\n")
            f.write(page["text"])
            f.write("\n\n---\n\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape or crawl webpages using Firecrawl.")
    parser.add_argument("url", nargs="?", help="Scrape a single URL (non-crawl mode).")
    parser.add_argument("--crawl", dest="crawl_url", help="Start a crawl at this URL (site crawl mode).")
    parser.add_argument(
        "--crawl-id",
        dest="crawl_id",
        help="Resume an existing Firecrawl crawl by id (skips starting a new crawl).",
    )
    parser.add_argument("--include-path", action="append", default=[], help="Regex for URL pathname to include (repeatable).")
    parser.add_argument("--exclude-path", action="append", default=[], help="Regex for URL pathname to exclude (repeatable).")
    parser.add_argument("--limit", type=int, default=10000, help="Max pages to crawl (default: 10000).")
    parser.add_argument("--poll-seconds", type=float, default=2.0, help="Polling interval while crawl runs.")
    args = parser.parse_args()

    # Crawl mode
    if args.crawl_url or args.crawl_id:
        if args.crawl_url and args.crawl_id:
            raise SystemExit("Use only one of --crawl or --crawl-id.")

        if args.crawl_id:
            crawl_id = args.crawl_id.strip()
            if not crawl_id:
                raise SystemExit("--crawl-id cannot be empty.")
            print(f"Resuming crawl id: {crawl_id}")
        else:
            print(f"Starting crawl: {args.crawl_url}")
            crawl_id = start_crawl(
                args.crawl_url,
                include_paths=args.include_path or None,
                exclude_paths=args.exclude_path or None,
                limit=args.limit,
            )
            print(f"  crawl id: {crawl_id}")

        print("Polling crawl status…")
        items = fetch_crawl_results(crawl_id, poll_seconds=args.poll_seconds)

        pages: list[dict[str, str]] = []
        for item in items:
            md = item.get("markdown")
            meta = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
            src = meta.get("sourceURL") if isinstance(meta.get("sourceURL"), str) else None
            if not isinstance(md, str) or not md.strip():
                continue
            url = src or "(unknown)"
            t = meta.get("title")
            title = t if isinstance(t, str) and t.strip() else _title_from_url(url)
            pages.append({"url": url, "title": title, "text": _clean_text(md)})

        if not pages:
            print("\n❌ Crawl completed, but no markdown pages were returned.")
            return

        _write_markdown(pages, output_file=OUTPUT_FILE, title="Crawled Content (Firecrawl)")
        print(f"\n✅ Done! {len(pages)} pages saved to: {OUTPUT_FILE}")
        return

    # Scrape mode (single URL or configured URL list)
    urls = list(URLS)

    if args.url:
        urls = [args.url.strip()]

    if not urls:
        print("No URLs found. Add URLs to the URLS list in the CONFIG section or pass a URL as an argument.")
        return

    print(f"Scraping {len(urls)} URL(s) via Firecrawl...\n")
    pages: list[dict[str, str]] = []

    for i, url in enumerate(urls, 1):
        print(f"  [{i}/{len(urls)}] {url}")
        title, md = scrape_with_firecrawl(url)
        if md:
            print(f"          ✓ '{title}' ({len(md):,} chars)")
            pages.append({"url": url, "title": title or url, "text": md})
        else:
            print("          ✗ Failed — skipping")
        if i < len(urls):
            time.sleep(DELAY)

    if not pages:
        print("\n❌ No pages scraped. Check your URLs, API key, and network.")
        return

    _write_markdown(pages, output_file=OUTPUT_FILE, title="Scraped Content (Firecrawl)")

    print(f"\n✅ Done! {len(pages)} pages saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
