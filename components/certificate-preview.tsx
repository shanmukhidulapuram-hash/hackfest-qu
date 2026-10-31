'use client'

import {
  getCertificateConfig,
  getCertificateMessage,
  type CertificateType,
  type Recipient,
} from '@/lib/certificate-config'

type CertificatePreviewProps = {
  type: CertificateType
  eventName: string
  recipient: Recipient | null
}

export function CertificatePreview({ type, eventName, recipient }: CertificatePreviewProps) {
  const certificate = getCertificateConfig(type)
  const name = recipient?.name || 'Taylor Morgan'
  const team = recipient?.team
  const members = recipient?.members ?? []

  return (
    <div className="certificate-preview" aria-label={`${certificate.title} certificate preview`}>
      <div className="certificate-preview-frame" />
      <div className="certificate-preview-inner">
        <div className="certificate-preview-brand" aria-label="CareerX Origin">
          <span className="certificate-brand-mark" aria-hidden="true">
            <span />
          </span>
          <span className="certificate-brand-name">CAREERX</span>
          <span className="certificate-brand-origin">ORIGIN</span>
        </div>

        <div className="certificate-preview-heading">
          <p className="certificate-eyebrow">{certificate.eyebrow}</p>
          <p className="certificate-subtitle">{certificate.subtitle}</p>
        </div>

        <div className="certificate-presented">
          <span>Proudly presented to</span>
          <strong>{name}</strong>
          {team && team !== name ? <small>{team}</small> : null}
          {members.length > 0 && (team === name || !team) ? <small>{members.join(' · ')}</small> : null}
        </div>

        <p className="certificate-message">{getCertificateMessage(type, eventName)}</p>

        <div className="certificate-signatures" aria-hidden="true">
          <div className="certificate-signature">
            <span className="certificate-signature-line" />
            <strong>Event organizers</strong>
            <small>CareerXOrigin</small>
          </div>
          <div className="certificate-preview-seal">
            <span>✦</span>
          </div>
          <div className="certificate-signature">
            <span className="certificate-signature-line" />
            <strong>Certificate of recognition</strong>
            <small>{eventName || 'CareerXOrigin HackFest 2026'}</small>
          </div>
        </div>
      </div>
    </div>
  )
}
