import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import {
  getCertificateConfig,
  type CertificateType,
  type Recipient,
} from '@/lib/certificate-config'

const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const templateCache = new Map<string, Promise<string>>()

function getTemplateDataUrl(url: string): Promise<string> {
  const cached = templateCache.get(url)
  if (cached) return cached

  const request = fetch(url, { mode: 'cors', credentials: 'omit' })
    .then((response) => {
      if (!response.ok) throw new Error(`Template request failed with ${response.status}`)
      return response.blob()
    })
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Template could not be read'))
      reader.onerror = () => reject(new Error('Template could not be read'))
      reader.readAsDataURL(blob)
    }))

  templateCache.set(url, request)
  return request
}

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'certificate'
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function getRankLabel(type: CertificateType) {
  if (type === 'first-place') return '1st'
  if (type === 'second-place') return '2nd'
  return '3rd'
}

function addRecipientOverlay(document: jsPDF, type: CertificateType, recipient: Recipient) {
  const isPlacement = type === 'first-place' || type === 'second-place' || type === 'third-place'
  const nameY = type === 'coordination' ? 98 : type === 'participation' ? 106 : type === 'top-10' ? 84 : 86
  const recipientName = recipient.name || recipient.team || 'Recipient name'

  const nameColor: [number, number, number] = isPlacement
    ? [41, 36, 79]
    : type === 'coordination'
      ? [51, 49, 48]
      : [16, 16, 16]

  document.setTextColor(...nameColor)
  document.setFont('times', 'bolditalic')
  document.setFontSize(23)
  const nameLines = document.splitTextToSize(recipientName, 176)
  document.text(nameLines, PAGE_WIDTH / 2, nameY, { align: 'center', lineHeightFactor: 1.1 })

  if (!isPlacement) return

  document.setTextColor(24, 24, 32)
  document.setFont('times', 'normal')
  document.setFontSize(12)
  document.text(getRankLabel(type), 120.5, 105.7, { align: 'center' })

  if (recipient.team) {
    document.setFont('times', 'normal')
    document.setFontSize(12)
    const availableWidth = 49
    while (document.getTextWidth(recipient.team) > availableWidth && document.getFontSize() > 7) {
      document.setFontSize(document.getFontSize() - 0.5)
    }
    document.text(recipient.team, 89.5, 116.1, { align: 'center', maxWidth: availableWidth })
  }
}

export async function createCertificatePdf(type: CertificateType, recipient: Recipient) {
  const certificate = getCertificateConfig(type)
  const template = await getTemplateDataUrl(certificate.templateUrl)
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })

  document.addImage(template, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, `template-${type}`, 'FAST')
  addRecipientOverlay(document, type, recipient)

  return document.output('blob')
}

export async function downloadSingleCertificate(type: CertificateType, recipient: Recipient) {
  const blob = await createCertificatePdf(type, recipient)
  saveBlob(blob, `${safeFileName(recipient.name)}-${type}.pdf`)
}

export async function downloadCertificateBatch(type: CertificateType, recipients: Recipient[]) {
  const zip = new JSZip()

  for (const [index, recipient] of recipients.entries()) {
    const blob = await createCertificatePdf(type, recipient)
    const fileName = `${String(index + 1).padStart(2, '0')}-${safeFileName(recipient.name)}-${type}.pdf`
    zip.file(fileName, blob)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, `careerxorigin-${type}-certificates.zip`)
}
