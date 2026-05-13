import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const OFF_WHITE = '#f5f9f9'
const MUTED = '#acb7a8'
const GREEN = '#577568'
const FONT = 'Inter, system-ui, sans-serif'

export type ChatCitationSource = {
  id: string
  title: string
  description: string
  url?: string
}

export type ChatCitationsLocationState = {
  citations: ChatCitationSource[]
}

export default function ChatCitationsScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ChatCitationsLocationState | null
  const citations = Array.isArray(state?.citations) ? state!.citations.filter((c) => c && typeof c.title === 'string') : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: OFF_WHITE, fontFamily: FONT }}>
      <header
        style={{
          height: 52,
          background: NAVY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            aria-label="Back to chat"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 8,
              color: LIGHT_BLUE,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = LIGHT_BLUE)}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} strokeWidth={2} />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
              fontSize: 22,
              letterSpacing: '0.1em',
              color: OFF_WHITE,
            }}
          >
            CARDEA
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: MUTED,
            }}
          >
            Citations
          </span>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {citations.length === 0 ? (
            <div
              style={{
                padding: '28px 20px',
                borderRadius: 14,
                background: '#fff',
                border: `1.5px solid ${LIGHT_BLUE}`,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: NAVY, fontWeight: 600 }}>No sources linked</p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: MUTED, lineHeight: 1.55 }}>
                Open this page from a chat message that has citations, or return to the chat.
              </p>
              <button
                type="button"
                onClick={() => navigate('/chat')}
                style={{
                  marginTop: 18,
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: `1.5px solid ${GREEN}`,
                  background: GREEN,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                Back to chat
              </button>
            </div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {citations.map((c, index) => (
                <li
                  key={c.id || `${index}-${c.title}`}
                  style={{
                    padding: '16px 18px',
                    borderRadius: 14,
                    background: '#fff',
                    border: `1.5px solid ${LIGHT_BLUE}`,
                    boxShadow: '0 1px 4px rgba(25,43,63,0.06)',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: GREEN }}>Source {index + 1}</p>
                  <h2 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 700, color: NAVY, lineHeight: 1.35 }}>{c.title}</h2>
                  {c.description ? (
                    <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {c.description}
                    </p>
                  ) : null}
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: GREEN,
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      Open link
                      <ExternalLink style={{ width: 14, height: 14 }} />
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
