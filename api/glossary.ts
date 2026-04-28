import { createClient } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  query?: {
    search?: string | string[]
  }
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => {
    json: (body: unknown) => void
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    return res
      .status(500)
      .json({
        error: 'Missing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)'
      })
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey)
  const rawSearch = req.query?.search ?? ''
  const search = (Array.isArray(rawSearch) ? rawSearch[0] : rawSearch).trim()

  let query = supabase
    .from('glossary_terms')
    .select('id, term, definition')
    .order('term', { ascending: true })

  if (search) {
    query = query.ilike('term', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json(data ?? [])
}
