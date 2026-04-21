import './index.css'
import { useState } from 'react'
import QuestionsForCardiologist from './components/QuestionsForCardiologist'
import FindSupport from './components/FindSupport'
import { createRoot } from 'react-dom/client'

type Screen = 'questions' | 'support'

function App() {
  const [screen, setScreen] = useState<Screen>('questions')

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-rose-700 font-bold text-lg tracking-tight">Heart Health</span>
          <nav className="flex gap-1">
            <button
              onClick={() => setScreen('questions')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                screen === 'questions'
                  ? 'bg-rose-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              My Questions
            </button>
            <button
              onClick={() => setScreen('support')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                screen === 'support'
                  ? 'bg-rose-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Find Support
            </button>
          </nav>
        </div>
      </header>

      <main>
        {screen === 'questions' ? <QuestionsForCardiologist /> : <FindSupport />}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
