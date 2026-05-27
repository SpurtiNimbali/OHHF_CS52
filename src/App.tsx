import './index.css'
import './global.css'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthLandingScreen } from './screens/authLandingScreen'
import { HomeScreen } from './screens/homeScreen'
import { SignInScreen } from './screens/signInScreen'
import { SignUpScreen } from './screens/signUpScreen'
import { WelcomeScreen } from './screens/welcomeScreen'
import ResourcesLanding from './screens/ResourcesLanding'
import ChatScreen from './screens/ChatScreen'
import ChatCitationsScreen from './screens/ChatCitationsScreen'
import WellnessTools from './screens/WellnessTools'
import { ResourcesRightNav } from './components/ResourcesRightNav'
import { CheckInSavedBarHost } from './components/ui/CheckInSavedBar'
import { MoodProvider } from './mood'

function App() {
  return (
    <BrowserRouter>
      <MoodProvider>
        <CheckInSavedBarHost />
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/auth" element={<AuthLandingScreen />} />
          <Route path="/sign-in" element={<SignInScreen />} />
          <Route path="/sign-up" element={<SignUpScreen />} />
          <Route path="/onboarding" element={<WelcomeScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/resources" element={<ResourcesLanding />} />
          <Route path="/wellness" element={<WellnessTools />} />
          <Route
            path="/chat/citations"
            element={
              <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <ChatCitationsScreen />
                </div>
                <ResourcesRightNav />
              </div>
            }
          />
          <Route path="/chat" element={
            <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <ChatScreen />
              </div>
              <ResourcesRightNav />
            </div>
          } />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </MoodProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
