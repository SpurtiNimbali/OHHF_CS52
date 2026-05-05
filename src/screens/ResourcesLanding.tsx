import { useState } from 'react'
import { Link } from 'react-router-dom'
import NavCard from '../components/NavCard'
import BackButton from '../components/BackButton'
import MedicalGlossary from './MedicalGlossary'
import QuestionsForCardiologist from './QuestionsForCardiologist'
import FindSupport from './FindSupport'

type Screen = 'landing' | 'glossary' | 'support' | 'questions'

const ResourcesLanding: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing')

  const handleNavigation = (screen: Screen) => {
    setCurrentScreen(screen)
  }

  const handleBackToLanding = () => {
    setCurrentScreen('landing')
  }

  // Render different screens based on current state
  if (currentScreen === 'glossary') {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <BackButton onClick={handleBackToLanding} text="← Back to Resources" />
        </div>
        <MedicalGlossary />
      </div>
    )
  }

  if (currentScreen === 'support') {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <BackButton onClick={handleBackToLanding} text="← Back to Resources" />
        </div>
        <FindSupport />
      </div>
    )
  }

  if (currentScreen === 'questions') {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <BackButton onClick={handleBackToLanding} text="← Back to Resources" />
        </div>
        <QuestionsForCardiologist />
      </div>
    )
  }

  // Landing screen with navigation cards
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%)',
      padding: '0',
    }}>
      {/* Back to Home Button */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 100,
      }}>
        <Link
          to="/home"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            color: '#667eea',
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          ← Back to Home
        </Link>
      </div>

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '80px 24px 100px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '-100px',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            textShadow: '0 2px 20px rgba(0,0,0,0.2)',
          }}>
            OHHF Resources
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '1.3rem',
            marginTop: '16px',
            maxWidth: '600px',
            margin: '16px auto 0',
            lineHeight: 1.6,
          }}>
            Access support, information, and tools to help you on your heart health journey.
          </p>
        </div>
      </div>

      {/* Cards Section - Overlapping the hero */}
      <div style={{
        maxWidth: '1100px',
        margin: '-60px auto 0',
        padding: '0 24px 60px',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '28px',
        }}>
          <NavCard
            title="Find Support"
            icon="🤝"
            description="Connect with community resources and support groups"
            accentColor="#f472b6"
            onClick={() => handleNavigation('support')}
          />

          <NavCard
            title="Questions for Your Cardiologist"
            icon="💬"
            description="Important questions and conversation starters for your appointments"
            accentColor="#764ba2"
            onClick={() => handleNavigation('questions')}
          />

          <NavCard
            title="Medical Glossary"
            icon="📚"
            description="Understand medical terms related to heart health"
            accentColor="#9333ea"
            onClick={() => handleNavigation('glossary')}
          />
        </div>
      </div>
    </div>
  )
}

export default ResourcesLanding