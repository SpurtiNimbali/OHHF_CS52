/**
 * Smoke tests for crisis phrase detection.
 * Run: npx tsx scripts/test-crisis-keywords.ts
 */
import { detectCrisisKeywords } from '../src/lib/crisisKeywords.js'

const shouldMatch = [
  "i don't want to live anymore",
  'sometimes i think my family would be better without me',
  "i'm planning to kill myself after everyone goes to sleep",
  'i want to cut myself again',
  "i can't go on like this",
  'i think my baby is dying right now',
  "afraid i'm going to die",
  'there is no reason to live anymore',
  "i hope i don't wake up tomorrow",
  'thinking about self harm tonight',
  'i might hurt someone if i lose control',
  "my child is going to die and i can't handle it",
  "i'm done with everything",
  'i feel suicidal today',
  'want to die honestly',
  'thinking of killing myself lately',
  'i think she is dying',
  'scared my baby will die during surgery',
  'i cannot do this anymore',
  'everyone would be better without me',
  "i'm afraid i might hurt someone",
  "i think i'm dying",
  'i do not want to wake up anymore',
  // legacy coverage
  "I don't want to be here anymore and sometimes I think about hurting myself.",
  'self-harm',
  'kill myself tonight',
  "I'm scared for my life",
  'I feel like my life is in danger',
  "I don't think I'll survive",
  "I'm scared for my child's life",
]

const shouldNotMatch = [
  'could this medication increase overdose risk',
  'my son hurt his arm at the playground',
  "i'm worried about tomorrow's surgery",
  'the cardiologist said the condition can be life threatening',
  'i feel hopeless about getting insurance approval',
  'my child keeps saying he hates taking medicine',
  'can heart surgery cause depression later',
  "i'm scared about the cath procedure",
  'what are signs of low oxygen after surgery',
  'my daughter accidentally cut herself cooking',
  'the incision looks worse today',
  "i'm exhausted and stressed but hanging in there",
  'is this chest pain normal after surgery',
  'our baby almost died at birth but is stable now',
  "he said 'i could die from embarrassment' joking around",
  'i do not want to miss the appointment',
  "i can't go on this diet anymore",
  'what should i do if she falls and hits her head',
  'the nurse mentioned self-harm screening questions',
  "i'm afraid my child will catch a cold",
  'my kid hurt someone at school by accident',
  'i wish i was better at managing meds',
  'can beta blockers make kids tired',
  'we are anxious but hopeful about surgery',
  // legacy
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
