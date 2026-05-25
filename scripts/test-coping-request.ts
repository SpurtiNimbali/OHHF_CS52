/**
 * Smoke tests for coping-request heuristics.
 * Run: npx tsx scripts/test-coping-request.ts
 */
import {
  looksLikeCopingRequest,
  looksLikeVentingOnly,
  matchCopingRequest,
  shouldUseCopingBranch,
} from '../server/lib/copingRequestMatch.js'

const shouldBeCoping = [
  'help me calm down',
  'I need a breathing exercise',
  'can you guide me through grounding',
  'walk me through box breathing',
  'show me a body scan',
]

const shouldBeVenting = [
  "I'm freaking out",
  'panicking right now',
  "I can't breathe",
  'spiraling and melting down',
]

const shouldNotBeCoping = [
  "I'm freaking out",
  "I can't breathe",
  'what is a ventricular septal defect',
]

let failed = 0

for (const msg of shouldBeCoping) {
  if (!looksLikeCopingRequest(msg)) {
    console.error('FAIL (expected coping):', msg)
    failed++
  }
  if (!shouldUseCopingBranch('EMOTIONAL', msg)) {
    console.error('FAIL (expected coping branch on EMOTIONAL):', msg)
    failed++
  }
  const m = matchCopingRequest(msg, null, null)
  if (!m.exercise.name || m.exercise.steps.length < 2) {
    console.error('FAIL (expected exercise match):', msg)
    failed++
  }
}

for (const msg of shouldBeVenting) {
  if (!looksLikeVentingOnly(msg)) {
    console.error('FAIL (expected venting only):', msg)
    failed++
  }
}

for (const msg of shouldNotBeCoping) {
  if (looksLikeCopingRequest(msg)) {
    console.error('FAIL (expected not coping):', msg)
    failed++
  }
}

const breathing = matchCopingRequest('breathing exercise please', 'scared', null)
if (breathing.exercise.name !== 'Box Breathing') {
  console.error('FAIL (expected Box Breathing):', breathing.exercise.name)
  failed++
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}

console.log(`OK — coping request heuristics (${shouldBeCoping.length} positive, ${shouldNotBeCoping.length} negative)`)
