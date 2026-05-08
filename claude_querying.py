"""
Query Claude (Anthropic) from the command line.

  pip install anthropic

Set a real Anthropic key (starts with sk-ant-api03-...), either:

  export ANTHROPIC_API_KEY="sk-ant-api03-..."

or put ANTHROPIC_API_KEY=... in `.env` or `.env.local` in this project folder.

Optional: CLAUDE_MODEL overrides the default model id.
"""

from __future__ import annotations

import os
from pathlib import Path

import anthropic

DEFAULT_MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """You are a helpful assistant.
You are given a prompt and you need to respond to the prompt."""


def _load_dotenv_files() -> None:
    """Load `.env.local` then `.env` so `python3 openai_querying.py` sees keys (shell vars win)."""
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


def _anthropic_api_key() -> str:
    _load_dotenv_files()
    return (os.environ.get("ANTHROPIC_API_KEY") or "").strip()


_client: anthropic.Anthropic | None = None


def _client_or_exit() -> anthropic.Anthropic:
    global _client
    key = _anthropic_api_key()
    if not key:
        raise SystemExit(
            "Missing ANTHROPIC_API_KEY.\n"
            "  • Create a key at https://console.anthropic.com/settings/keys\n"
            "  • export ANTHROPIC_API_KEY='sk-ant-api03-...'\n"
            "  • or add ANTHROPIC_API_KEY=... to .env / .env.local in this folder.\n"
            "Note: OpenAI keys (sk-proj-...) will not work — use an Anthropic secret key."
        )
    if _client is None:
        _client = anthropic.Anthropic(api_key=key)
    return _client


def query_claude_model(
    prompt: str,
    model: str | None = None,
    *,
    max_tokens: int = 150,
    temperature: float = 0.7,
) -> str:
    """Send a user prompt to Claude and return the assistant text."""
    rid = model or os.environ.get("CLAUDE_MODEL") or DEFAULT_MODEL

    message = _client_or_exit().messages.create(
        model=rid,
        max_tokens=max_tokens,
        temperature=temperature,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    parts: list[str] = []
    for block in message.content:
        if block.type == "text":
            parts.append(block.text)

    return "".join(parts).strip()


if __name__ == "__main__":
    demo = "Explain how neural networks work in simple terms."
    answer = query_claude_model(demo)
    print("Claude response:\n", answer)
