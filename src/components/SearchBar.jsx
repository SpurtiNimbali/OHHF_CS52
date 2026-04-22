import React from 'react'

const SearchBar = ({ value, onChange }) => {
  return (
    <input
      type="text"
      placeholder="Search terms..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '8px', width: '100%', marginBottom: '16px' }}
    />
  )
}

export default SearchBar