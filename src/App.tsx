import React from 'react'
import { createRoot } from 'react-dom/client'
import { WelcomeScreen } from './welcomeScreen'

function App() {
  return <WelcomeScreen />
}

createRoot(document.getElementById('root')!).render(<App />)
