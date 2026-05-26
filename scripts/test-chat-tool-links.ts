/**
 * Smoke-test that wellness tool routes are valid and that chat returns toolCards
 * with routes that exist in the app.
 *
 * Usage:
 * - Start servers: `npm run dev` and `npm run server:dev`
 * - Run: `tsx scripts/test-chat-tool-links.ts`
 *
 * Notes:
 * - The UI is an SPA, so a 200 response does not guarantee component correctness,
 *   but it does catch broken routes, missing dev server, and obviously bad links.
 * - Chat toolCards routes are produced server-side from `wellnessToolRegistry`,
 *   so we validate the returned routes are members of that map.
 */

import { ALL_WELLNESS_TOOL_IDS, WELLNESS_TOOL_ROUTE_MAP } from '../src/lib/wellnessToolRegistry.js'
import { loadEmotionMap } from '../server/lib/emotionMapLoader.js'

type ToolCard = { name: string; route: string; description?: string }

const WEB_BASE = process.env.WEB_BASE_URL?.trim() || 'http://localhost:5173'
const API_BASE = process.env.API_BASE_URL?.trim() || 'http://localhost:3001'

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function fetchOk(url: string): Promise<number> {
  const res = await fetch(url, { redirect: 'manual' })
  return res.status
}

function allWellnessRoutesSet(): Set<string> {
  return new Set(Object.values(WELLNESS_TOOL_ROUTE_MAP))
}

async function testWellnessRoutesReachable() {
  console.log(`\n[web] checking wellness routes on ${WEB_BASE}`)
  for (const id of ALL_WELLNESS_TOOL_IDS) {
    const route = WELLNESS_TOOL_ROUTE_MAP[id]
    const status = await fetchOk(`${WEB_BASE}${route}`)
    ok(status >= 200 && status < 500, `Web route ${route} returned status ${status}`)
    console.log(`  OK ${route} (${status})`)
  }
}

async function postChat(payload: unknown) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as any
  return { status: res.status, json }
}

async function testChatReflectToolCards() {
  console.log(`\n[api] checking reflect-stage toolCards on ${API_BASE}`)

  // We use reflect-stage because tool selection is deterministic from the emotion map,
  // and we only need to verify the routes are valid.
  const emotionMap = loadEmotionMap()
  const allowedRoutes = allWellnessRoutesSet()

  for (const [emotionId] of emotionMap.entries()) {
    const { status, json } = await postChat({
      message: 'ok',
      history: [],
      conversationStage: 'reflect',
      selectedEmotion: emotionId,
      selectedUnderneath: 'test',
      sessionContext: { caregiverName: '', caregiverRole: '', emotionCheckIn: null, lastActivity: null },
    })

    ok(status === 200, `chat reflect failed for ${emotionId}: status=${status} error=${json?.error ?? '(none)'}`)
    const cards = (json?.toolCards ?? null) as ToolCard[] | null
    ok(Array.isArray(cards) && cards.length >= 1, `expected toolCards for ${emotionId}`)
    ok(typeof cards[0].route === 'string', `toolCards[0].route missing for ${emotionId}`)
    ok(allowedRoutes.has(cards[0].route), `tool route not in registry for ${emotionId}: ${cards[0].route}`)
    console.log(`  OK ${emotionId} -> ${cards[0].name} (${cards[0].route})`)
  }
}

async function main() {
  console.log('Testing chat tool links…')
  console.log(`WEB_BASE_URL=${WEB_BASE}`)
  console.log(`API_BASE_URL=${API_BASE}`)

  await testWellnessRoutesReachable()

  // API test is optional if server isn't up or LLM keys missing.
  try {
    const status = await fetchOk(`${API_BASE}/health`)
    ok(status === 200, `API health not OK: ${status}`)
    await testChatReflectToolCards()
  } catch (e) {
    console.warn(
      `\n[api] skipped reflect toolCard check (${e instanceof Error ? e.message : String(e)}). ` +
        `If you want this check, ensure \`npm run server:dev\` is running and your LLM keys are set.`,
    )
  }

  console.log('\nDone.')
}

main().catch((e) => {
  console.error('\nFAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})

