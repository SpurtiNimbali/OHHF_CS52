import React from 'react'
import { createRoot } from 'react-dom/client'
import MedicalGlossary from './pages/medicalGlossary'


function App() {
  return <MedicalGlossary />
}

createRoot(document.getElementById('root')!).render(<App />)

