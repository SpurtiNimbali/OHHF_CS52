/**
 * Smoke tests for crisis phrase detection.
 * Run: npx tsx scripts/test-crisis-keywords.ts
 */
import { detectCrisisKeywords } from '../src/lib/crisisKeywords.js'

const shouldMatch = [
  "I don't want to be here anymore and sometimes I think about hurting myself.",
  'I want to die',
  'suicidal thoughts',
  'self-harm',
  'kill myself tonight',
  "I don't want to live",
]

const shouldNotMatch = [
  'What is a ventricular septal defect?',
  "I'm hopeless about tomorrow's surgery schedule",
  'The doctor mentioned overdose risk with this medication',
  'My child hurt his arm at the playground',
  'Hello',
]

let failed = 0

for (const msg of shouldMatch) {
  if (!detectCrisisKeywords(msg)) {
    console.error('FAIL (expected match):', msg)
    failed++
  }
}

for (const msg of shouldNotMatch) {
  if (detectCrisisKeywords(msg)) {
    console.error('FAIL (expected no match):', msg)
    failed++
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}

console.log(`OK — ${shouldMatch.length} match + ${shouldNotMatch.length} non-match cases`)
