import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <h1>Minimal Apps</h1>
}

createRoot(document.getElementById('root')!).render(<App />)
