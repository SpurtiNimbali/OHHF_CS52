import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from parse_pdf import parse_glossary_lines  # noqa: E402


APPENDIX_LINES = """
HEART CONDITIONS
Term What It Means What Therapists Should Know
Congenital Heart Disease (CHD)
Heart condition present at birth affecting structure or function
Lifelong condition; often involves repeated medical experiences
Open-Heart  Surgery  Surgery  requiring  the  chest  to  be  opened
Highly traumatic experience for both child and caregivers
""".strip().split(
    "\n"
)


class TestGlossaryParser(unittest.TestCase):
    def test_sample_entries(self) -> None:
        lines = [x.strip() for x in APPENDIX_LINES if x.strip()]
        entries = parse_glossary_lines(lines)
        self.assertGreaterEqual(len(entries), 2)
        self.assertEqual(entries[0].term, "Congenital Heart Disease (CHD)")
        self.assertIn("birth", entries[0].definition.lower())
        oh = next(e for e in entries if "Open-Heart" in e.term)
        self.assertTrue(oh.term.startswith("Open-Heart"))
        self.assertIn("chest", oh.definition.lower())


if __name__ == "__main__":
    unittest.main()
