import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import SearchBar from '../components/SearchBar'

interface GlossaryTerm {
  id: number
  term: string
  definition: string
}

function MedicalGlossary() {
  const [query, setQuery] = useState('')
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchTerms() {
      if (isMounted) {
        setLoading(true)
        setError(null)
      }

      try {
        const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
        const supabaseKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase environment variables')
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        const search = query.trim()

        let dbQuery = supabase
          .from('glossary_terms')
          .select('id, term, definition')
          .order('term', { ascending: true })

        if (search) {
          dbQuery = dbQuery.ilike('term', `%${search}%`)
        }

        const { data, error: dbError } = await dbQuery

        if (dbError) {
          throw new Error(dbError.message)
        }

        if (isMounted) {
          setTerms(data || [])
        }
      } catch (err) {
        if (isMounted) {
          setTerms([])
          setError(err instanceof Error ? err.message : 'Could not load glossary terms. Check your Supabase configuration.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchTerms()

    return () => {
      isMounted = false
    }
  }, [query])

  return (
    <div>
      <h1>Medical Glossary</h1>

      <SearchBar value={query} onChange={setQuery} />

      {loading && <p>Loading...</p>}
      {!loading && error && <p>{error}</p>}

      {!loading && !error && terms.length === 0 && (
        <p>No terms match your search</p>
      )}

      {!loading && !error && terms.length > 0 && (
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #ddd',
            fontSize: '14px'
          }}>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} style={{
                  borderBottom: '1px solid #eee'
                }}>
                  <td style={{
                    padding: '12px 16px',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    verticalAlign: 'top',
                    minWidth: '200px',
                    borderRight: '1px solid #eee'
                  }}>
                    {term.term}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    color: '#555',
                    lineHeight: '1.5',
                    verticalAlign: 'top'
                  }}>
                    {term.definition}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MedicalGlossary