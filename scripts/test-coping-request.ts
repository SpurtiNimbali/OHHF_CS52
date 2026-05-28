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
  'can you give me a breathing exercise',
  'i need help breathing',
  'help me breathe',
  'give me grounding',
  'i want to journal',
  'help me reframe this thought',
  'i need a safe place visualization',
  'give me safe space tool',
  'walk me through a body scan',
]

const shouldBeVenting = [
  "i'm panicking and can't breathe",
  "i can't breathe",
]

const shouldNotBeCoping = [
  "i'm panicking and can't breathe",
  "i'm overwhelmed",
  'i need help',
  'i feel awful',
  "i'm scared",
  "i can't breathe",
  'what is a ventricular septal defect',
]

let failed = 0
const expectedToolByPrompt: Record<string, string> = {
  'can you give me a breathing exercise': 'Guided breathing',
  'i need help breathing': 'Guided breathing',
  'help me breathe': 'Guided breathing',
  'give me grounding': '5-4-3-2-1 Grounding',
  'i want to journal': 'Micro-journal',
  'help me reframe this thought': 'Reframes',
  'i need a safe place visualization': 'Safe Place Visualization',
  'give me safe space tool': 'Safe Place Visualization',
  'walk me through a body scan': 'Physical regulation',
}

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
  if (!m.selectedTool?.name || !/^\/wellness\?tool=/.test(m.selectedTool.route)) {
    console.error('FAIL (expected live selected tool):', msg, m.selectedTool)
    failed++
  }
  if (m.selectedTool?.name !== expectedToolByPrompt[msg]) {
    console.error(
      'FAIL (expected canonical selected tool):',
      msg,
      'expected=',
      expectedToolByPrompt[msg],
      'actual=',
      m.selectedTool?.name,
    )
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
  if (shouldUseCopingBranch('COPING_REQUEST', msg)) {
    console.error('FAIL (COPING_REQUEST must not force coping branch):', msg)
    failed++
  }
  if (shouldUseCopingBranch('EMOTIONAL', msg)) {
    console.error('FAIL (expected not coping branch on EMOTIONAL):', msg)
    failed++
  }
}

if (!shouldUseCopingBranch('COPING_REQUEST', 'i need help breathing')) {
  console.error('FAIL (expected strict gate to allow explicit coping): i need help breathing')
  failed++
}

const safeSpace = matchCopingRequest('give me safe space tool', null, null)
if (!looksLikeCopingRequest('give me safe space tool')) {
  console.error('FAIL (expected coping request): give me safe space tool')
  failed++
}
if (!shouldUseCopingBranch('COPING_REQUEST', 'give me safe space tool')) {
  console.error('FAIL (expected coping branch): give me safe space tool')
  failed++
}
if (safeSpace.selectedTool?.name !== 'Safe Place Visualization') {
  console.error('FAIL (expected Safe Place Visualization):', safeSpace.selectedTool)
  failed++
}
if (safeSpace.selectedTool?.route !== '/wellness?tool=safe-place') {
  console.error('FAIL (expected safe-place route):', safeSpace.selectedTool)
  failed++
}

const breathing = matchCopingRequest('breathing exercise please', 'scared', null)
if (breathing.exercise.name !== 'Box Breathing') {
  console.error('FAIL (expected Box Breathing):', breathing.exercise.name)
  failed++
}
if (breathing.selectedTool?.name !== 'Guided breathing') {
  console.error('FAIL (expected Guided breathing tool):', breathing.selectedTool)
  failed++
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}

console.log(`OK — coping request heuristics (${shouldBeCoping.length} positive, ${shouldNotBeCoping.length} negative)`)
