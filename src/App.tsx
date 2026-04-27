import { createRoot } from 'react-dom/client'
import ResourcesLanding from './pages/ResourcesLanding'

function App() {
  return <ResourcesLanding />
}

createRoot(document.getElementById('root')!).render(<App />)

