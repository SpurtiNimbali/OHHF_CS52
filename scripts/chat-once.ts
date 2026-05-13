/**
 * One-off RAG + OpenAI chat from the terminal.
 * Usage: npx tsx scripts/chat-once.ts "Your question here"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
loadEnv({ path: path.join(ROOT, '.env') })
loadEnv({ path: path.join(ROOT, '.env.local'), override: true })

const q = process.argv.slice(2).join(' ').trim() || 'What is hypoplastic left heart syndrome in simple terms?'

async function main() {
  const { runKbChat } = await import('../server/lib/chatRag.js')
  const r = await runKbChat(q)
  console.log('\n─ Question ─\n', q)
  console.log('\n─ Answer ─\n', r.answer)
  console.log('\n─ Suggested next questions ─')
  r.suggestedQuestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`))
  console.log('\n─ In-app redirects (★ = from your question, ○ = from answer context) ─')
  r.uiRedirects.forEach((u) => console.log(`  [${u.prominent ? '★' : '○'}] ${u.label} → ${u.path}`))
  console.log('\n─ Sources (top excerpts) ─')
  r.citations.slice(0, 3).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.title}${c.sourceUrl ? ` — ${c.sourceUrl}` : ''}`)
    console.log(`     ${c.excerpt.slice(0, 160)}${c.excerpt.length > 160 ? '…' : ''}`)
  })
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  if (!fs.existsSync(path.join(ROOT, 'data', 'knowledge', 'index.json'))) {
    console.error('\n(Run `npm run rag:build` first.)')
  }
  process.exit(1)
})
