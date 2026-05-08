import 'dotenv/config'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

type ScrapedResource = {
  title: string
  href: string
  section: string
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  const raw = fs.readFileSync('scripts/ohhf_resources.json', 'utf-8')
  const resources = JSON.parse(raw) as ScrapedResource[]

  const rows = resources.map((resource) => ({
    title: resource.title,
    url: resource.href,
    section: resource.section,
    source: 'ohhf',
  }))

  const { data, error } = await supabase
    .from('chatbot_resources')
    .upsert(rows, { onConflict: 'url' })
    .select()

  if (error) {
    throw error
  }

  console.log(`Uploaded ${data?.length ?? 0} resources to Supabase`)
}

main().catch((error) => {
  console.error('Upload failed:', error)
  process.exit(1)
})