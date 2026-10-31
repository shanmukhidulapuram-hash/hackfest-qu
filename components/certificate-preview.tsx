'use client'

import {
  getCertificateConfig,
  type CertificateType,
  type Recipient,
} from '@/lib/certificate-config'

type CertificatePreviewProps = {
  type: CertificateType
  recipient: Recipient | null
}

function getPlaceLabel(type: CertificateType) {
  if (type === 'first-place') return '1st'
  if (type === 'second-place') return '2nd'
  return '3rd'
}

export function CertificatePreview({ type, recipient }: CertificatePreviewProps) {
  const certificate = getCertificateConfig(type)
  const recipientName = recipient?.name || 'Taylor Morgan'
  const isPlacement = type === 'first-place' || type === 'second-place' || type === 'third-place'

  return (
    <div
      className={`certificate-preview template-preview template-preview--${type}`}
      aria-label={`${certificate.title} certificate preview`}
    >
      <img
        className="certificate-template-artwork"
        src={certificate.templateUrl}
        alt={`${certificate.title} CareerXOrigin certificate artwork`}
        crossOrigin="anonymous"
      />
      <span className="template-recipient-name">{recipientName}</span>
      {isPlacement ? (
        <>
          <span className="template-overlay-field template-place-rank">{getPlaceLabel(type)}</span>
          <span className="template-overlay-field template-team-name">{recipient?.team ?? ''}</span>
        </>
      ) : null}
    </div>
  )
}
