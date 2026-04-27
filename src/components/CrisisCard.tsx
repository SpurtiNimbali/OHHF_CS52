import React from 'react'
import { CRISIS_RESOURCES, CrisisResource } from '../lib/crisisKeywords'

interface CrisisCardProps {
  showIcon?: boolean
  compact?: boolean
}

const CrisisCard: React.FC<CrisisCardProps> = ({ showIcon = true, compact = false }) => {
  return (
    <div
      style={{
        padding: compact ? '12px' : '16px',
        backgroundColor: '#fff5f7',
        borderLeft: '4px solid #d91e63',
        borderRadius: '4px',
        marginBottom: '16px',
        marginTop: '16px'
      }}
    >
      {showIcon && (
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>
          💙
        </div>
      )}

      <h3
        style={{
          margin: '0 0 8px 0',
          color: '#d91e63',
          fontSize: compact ? '16px' : '18px',
          fontWeight: 'bold'
        }}
      >
        You're not alone. We're here to help.
      </h3>

      <p
        style={{
          margin: '0 0 16px 0',
          color: '#555',
          fontSize: compact ? '13px' : '14px',
          lineHeight: '1.5'
        }}
      >
        If you're experiencing a crisis or having thoughts of self-harm, please reach out to one of these resources:
      </p>

      <div style={{ display: 'grid', gap: '12px' }}>
        {CRISIS_RESOURCES.map((resource: CrisisResource, idx: number) => (
          <ResourceItem key={idx} resource={resource} compact={compact} />
        ))}
      </div>

      <p
        style={{
          margin: '16px 0 0 0',
          color: '#888',
          fontSize: compact ? '12px' : '13px',
          fontStyle: 'italic'
        }}
      >
        This conversation has been flagged for our medical support team to review. Your safety is our priority.
      </p>
    </div>
  )
}

interface ResourceItemProps {
  resource: CrisisResource
  compact?: boolean
}

const ResourceItem: React.FC<ResourceItemProps> = ({ resource, compact = false }) => {
  const isLink = resource.number.startsWith('http')

  return (
    <div
      style={{
        padding: compact ? '8px' : '12px',
        backgroundColor: '#fff',
        borderRadius: '4px',
        border: '1px solid #f0c0d0',
        display: 'flex',
        gap: '12px'
      }}
    >
      <div style={{ fontSize: '20px', flexShrink: 0 }}>📱</div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 'bold',
            fontSize: compact ? '13px' : '14px',
            marginBottom: '4px',
            color: '#222'
          }}
        >
          {resource.name}
        </div>
        <div
          style={{
            fontSize: compact ? '12px' : '13px',
            color: '#666',
            marginBottom: '4px'
          }}
        >
          {resource.description}
        </div>
        <div
          style={{
            fontSize: compact ? '11px' : '12px',
            fontWeight: 'bold',
            color: '#d91e63',
            marginBottom: '4px'
          }}
        >
          {isLink ? (
            <a href={resource.number} target="_blank" rel="noopener noreferrer" style={{ color: '#d91e63' }}>
              {resource.number}
            </a>
          ) : (
            resource.number
          )}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#999'
          }}
        >
          {resource.available}
        </div>
      </div>
    </div>
  )
}

export default CrisisCard
