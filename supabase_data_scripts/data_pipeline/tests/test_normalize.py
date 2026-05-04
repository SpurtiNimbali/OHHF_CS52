import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalize import canonical_url, normalize_text, text_fingerprint  # noqa: E402


class TestNormalize(unittest.TestCase):
    def test_canonical_url_strips_tracking(self) -> None:
        u = "https://Example.com/path/?utm_source=x&a=1&fbclid=abc"
        self.assertEqual(
            canonical_url(u),
            "https://example.com/path?a=1",
        )

    def test_canonical_url_none_for_mailto(self) -> None:
        self.assertIsNone(canonical_url("mailto:a@b.com"))

    def test_text_fingerprint(self) -> None:
        self.assertEqual(
            text_fingerprint("Hello, World!!"),
            text_fingerprint("hello world"),
        )

    def test_normalize_text_collapse(self) -> None:
        self.assertEqual(normalize_text("  a \n\t b  "), "a b")


if __name__ == "__main__":
    unittest.main()
