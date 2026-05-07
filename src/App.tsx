import './index.css'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './global.css'
import { AuthLandingScreen } from './screens/authLandingScreen'
import { HomeScreen } from './screens/homeScreen'
import { SignInScreen } from './screens/signInScreen'
import { SignUpScreen } from './screens/signUpScreen'
import { WelcomeScreen } from './screens/welcomeScreen'
import ResourcesLanding from './screens/ResourcesLanding'
import { MoodProvider } from './mood'

function App() {
  return (
    <BrowserRouter>
      <MoodProvider>
        <Routes>
          <Route path="/" element={<AuthLandingScreen />} />
          <Route path="/sign-in" element={<SignInScreen />} />
          <Route path="/sign-up" element={<SignUpScreen />} />
          <Route path="/onboarding" element={<WelcomeScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/resources" element={<ResourcesLanding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MoodProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

