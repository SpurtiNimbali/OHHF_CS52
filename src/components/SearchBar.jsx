import React from 'react'

const SearchBar = ({ value, onChange }) => {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute',
        left: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '1.2rem',
      }}>
        🔍
      </span>
      <input
        type="text"
        placeholder="Search medical terms..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '16px 16px 16px 48px',
          width: '100%',
          fontSize: '1rem',
          border: '2px solid #e0e0e0',
          borderRadius: '12px',
          outline: 'none',
          transition: 'all 0.3s ease',
          background: '#fafafa',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#667eea'
          e.target.style.background = '#ffffff'
          e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e0e0e0'
          e.target.style.background = '#fafafa'
          e.target.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

export default SearchBar