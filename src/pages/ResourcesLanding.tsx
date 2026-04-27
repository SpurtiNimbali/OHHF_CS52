import { useState } from 'react'
import NavCard from '../components/NavCard'
import BackButton from '../components/BackButton'
import MedicalGlossary from './MedicalGlossary'

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
          <BackButton onClick={handleBackToLanding} text="Back to Resources" />
        </div>
        <MedicalGlossary />
      </div>
    )
  }

  if (currentScreen === 'support') {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <BackButton onClick={handleBackToLanding} text="Back to Resources" />
        </div>

        <h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>Find Support</h1>
        <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#555' }}>
          Support resources and community connections coming soon...
        </p>
      </div>
    )
  }

  if (currentScreen === 'questions') {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <BackButton onClick={handleBackToLanding} text="Back to Resources" />
        </div>

        <h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>Questions to Ask Your Cardiologist</h1>
        <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#555' }}>
          Important questions and conversation starters for your cardiologist appointments coming soon...
        </p>
      </div>
    )
  }

  // Landing screen with navigation cards
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#2c3e50',
          marginBottom: '12px'
        }}>
          OHHF Resources
        </h1>

        <p style={{
          fontSize: '18px',
          color: '#6c757d',
          marginBottom: '40px',
          maxWidth: '600px',
          margin: '0 auto 40px auto'
        }}>
          Access support, information, and tools to help you on your heart health journey.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          <NavCard
            title="Find Support"
            icon="🤝"
            description="Connect with community resources and support groups"
            onClick={() => handleNavigation('support')}
          />

          <NavCard
            title="Questions to Ask Your Cardiologist"
            icon="💬"
            description="Important questions and conversation starters for your appointments"
            onClick={() => handleNavigation('questions')}
          />

          <NavCard
            title="Medical Glossary"
            icon="📚"
            description="Understand medical terms related to heart health"
            onClick={() => handleNavigation('glossary')}
          />
        </div>
      </div>
    </div>
  )
}

export default ResourcesLanding