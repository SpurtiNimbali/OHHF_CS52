import React, { useState, useEffect } from 'react'
import SearchBar from '../components/SearchBar'

function MedicalGlossary() {
  const [query, setQuery] = useState('')
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchTerms() {
      if (isMounted) {
        setLoading(true)
        setError(null)
      }

      try {
        const res = await fetch(`/api/glossary?search=${encodeURIComponent(query)}`)

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`)
        }

        const data = await res.json()
        if (isMounted) {
          setTerms(data)
        }
      } catch (err) {
        if (isMounted) {
          setTerms([])
          setError('Could not load glossary terms. Check your API server and env keys.')
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

      <ul>
        {terms.map((term) => (
          <li key={term.id}>
            <strong>{term.term}</strong>: {term.definition}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MedicalGlossary