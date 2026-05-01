import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
// @ts-expect-error - SearchBar is a JSX component without type declarations
import SearchBar from '../components/SearchBar'

interface GlossaryTerm {
  id: number
  term: string
  definition: string
  category?: string
}

// Colorful category tags
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  anatomy: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  condition: { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  treatment: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  medication: { bg: '#fce4ec', text: '#c62828', border: '#f48fb1' },
  procedure: { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
  general: { bg: '#fff8e1', text: '#f57f17', border: '#ffe082' },
}

function getCategory(term: string): string {
  const lower = term.toLowerCase()
  if (lower.includes('heart') || lower.includes('artery') || lower.includes('bone') || lower.includes('muscle')) return 'anatomy'
  if (lower.includes('syndrome') || lower.includes('disease') || lower.includes('disorder') || lower.includes('condition')) return 'condition'
  if (lower.includes('therapy') || lower.includes('treatment') || lower.includes('surgery')) return 'treatment'
  if (lower.includes('pill') || lower.includes('medication') || lower.includes('drug') || lower.includes('injection')) return 'medication'
  if (lower.includes('procedure') || lower.includes('test') || lower.includes('scan') || lower.includes('examination')) return 'procedure'
  return 'general'
}

function MedicalGlossary() {
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get unique categories from terms
  const categories = Object.keys(categoryColors)

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
      padding: '0',
    }}>
      {/* Colorful Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        padding: '40px 24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '-50px',
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          right: '10%',
          width: '150px',
          height: '150px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20%',
          width: '80px',
          height: '80px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '50%',
        }} />
        
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          color: '#ffffff',
          margin: 0,
          textShadow: '0 2px 10px rgba(0,0,0,0.2)',
          position: 'relative',
        }}>
          🏥 Medical Glossary
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: '1.1rem',
          marginTop: '12px',
          position: 'relative',
        }}>
          Learn and understand common medical terms
        </p>
      </div>

      {/* Search Section */}
      <div style={{
        maxWidth: '800px',
        margin: '-30px auto 30px',
        padding: '0 20px',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
        }}>
          <SearchBar value={query} onChange={setQuery} />
          
          {/* Tag Filter Section */}
          <div style={{ marginTop: '16px' }}>
            <p style={{
              fontSize: '0.85rem',
              color: '#888',
              marginBottom: '10px',
              fontWeight: 600,
            }}>
              Filter by category:
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {/* All tags button */}
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: selectedTag === null ? '2px solid #667eea' : '2px solid #e0e0e0',
                  background: selectedTag === null ? '#667eea' : '#ffffff',
                  color: selectedTag === null ? '#ffffff' : '#666',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                All
              </button>
              {categories.map((cat) => {
                const colors = categoryColors[cat]
                const isSelected = selectedTag === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedTag(isSelected ? null : cat)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: isSelected ? `2px solid ${colors.text}` : `2px solid ${colors.border}`,
                      background: isSelected ? colors.text : colors.bg,
                      color: isSelected ? '#ffffff' : colors.text,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textTransform: 'capitalize',
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '0 20px 40px',
      }}>
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
          }}>
            <div style={{
              fontSize: '3rem',
              animation: 'bounce 1s infinite',
            }}>⏳</div>
            <p style={{ color: '#667eea', fontSize: '1.2rem', fontWeight: 600 }}>
              Loading terms...
            </p>
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: '#ffebee',
            border: '2px solid #ffcdd2',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p style={{ color: '#c62828', fontWeight: 600, marginTop: '8px' }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && terms.length === 0 && (
          <div style={{
            background: '#fff8e1',
            border: '2px solid #ffe082',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '3rem' }}>🔍</span>
            <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
              {selectedTag ? `No ${selectedTag} terms found` : 'No terms match your search'}
            </p>
            <p style={{ color: '#f57f17', opacity: 0.8, marginTop: '8px' }}>
              {selectedTag ? 'Try a different category or search term' : 'Try a different search term'}
            </p>
          </div>
        )}

        {!loading && !error && terms.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}>
            {terms
              .filter(term => !selectedTag || getCategory(term.term) === selectedTag)
              .map((term, index) => {
              const category = getCategory(term.term)
              const colors = categoryColors[category] || categoryColors.general
              
              return (
                <div
                  key={term.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '2px solid transparent',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    animation: `fadeInUp 0.5s ease ${index * 0.05}s both`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.2)'
                    e.currentTarget.style.borderColor = colors.border
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  {/* Category Tag */}
                  <div style={{
                    display: 'inline-block',
                    background: colors.bg,
                    color: colors.text,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: `1px solid ${colors.border}`,
                    marginBottom: '12px',
                  }}>
                    {category}
                  </div>

                  {/* Term */}
                  <h3 style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    color: '#2c3e50',
                    margin: '0 0 12px',
                    lineHeight: 1.3,
                  }}>
                    {term.term}
                  </h3>

                  {/* Definition */}
                  <p style={{
                    color: '#666',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {term.definition}
                  </p>

                  {/* Decorative accent */}
                  <div style={{
                    marginTop: '16px',
                    height: '4px',
                    background: `linear-gradient(90deg, ${colors.border}, ${colors.bg})`,
                    borderRadius: '2px',
                  }} />
                </div>
              )
            })}
          </div>
        )}

        {/* Results count */}
        {!loading && !error && terms.length > 0 && (
          <p style={{
            textAlign: 'center',
            color: '#888',
            marginTop: '30px',
            fontSize: '0.9rem',
          }}>
            {selectedTag 
              ? `Showing ${terms.filter(t => getCategory(t.term) === selectedTag).length} ${selectedTag} term${terms.filter(t => getCategory(t.term) === selectedTag).length !== 1 ? 's' : ''}`
              : `Showing ${terms.length} term${terms.length !== 1 ? 's' : ''}`
            }
          </p>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}

export default MedicalGlossary