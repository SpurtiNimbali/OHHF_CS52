/**
 * Prints the RLS migration SQL for mood_entries / journal_entries.
 * Run the output in Supabase Dashboard → SQL Editor → New query → Run.
 *
 * Usage: npx tsx scripts/apply-mood-journal-rls.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlPath = path.join(__dirname, '../supabase/migrations/20260521230000_mood_journal_entries_rls.sql')

console.log(`
=== Fix mood / journal saves (Supabase permissions) ===

1. Open https://supabase.com/dashboard/project/rcytzbgwjbftajtykxxr/sql/new
2. Paste the SQL below and click Run.

--- SQL start ---
`)
console.log(readFileSync(sqlPath, 'utf8'))
console.log(`--- SQL end ---

Alternatively, run both app processes:
  npm run dev:all

That starts the API (bypasses RLS) plus the Vite frontend.
`)
