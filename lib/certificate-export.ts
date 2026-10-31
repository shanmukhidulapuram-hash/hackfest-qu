import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import {
  getCertificateConfig,
  getCertificateMessage,
  type CertificateType,
  type Recipient,
} from '@/lib/certificate-config'

const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const NAVY: [number, number, number] = [34, 35, 70]
const GOLD: [number, number, number] = [185, 143, 61]
const PALE_GOLD: [number, number, number] = [239, 225, 192]

function drawFrame(document: jsPDF) {
  document.setFillColor(253, 251, 246)
  document.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  document.setDrawColor(...GOLD)
  document.setLineWidth(1.05)
  document.rect(7.5, 7.5, PAGE_WIDTH - 15, PAGE_HEIGHT - 15, 'S')
  document.setLineWidth(0.25)
  document.rect(10, 10, PAGE_WIDTH - 20, PAGE_HEIGHT - 20, 'S')

  document.setDrawColor(...PALE_GOLD)
  document.setLineWidth(0.45)
  document.rect(13, 13, PAGE_WIDTH - 26, PAGE_HEIGHT - 26, 'S')

  const corners = [
    [15, 15, 20, 15, 15, 20],
    [PAGE_WIDTH - 15, 15, PAGE_WIDTH - 20, 15, PAGE_WIDTH - 15, 20],
    [15, PAGE_HEIGHT - 15, 20, PAGE_HEIGHT - 15, 15, PAGE_HEIGHT - 20],
    [PAGE_WIDTH - 15, PAGE_HEIGHT - 15, PAGE_WIDTH - 20, PAGE_HEIGHT - 15, PAGE_WIDTH - 15, PAGE_HEIGHT - 20],
  ]
  document.setDrawColor(...GOLD)
  document.setLineWidth(0.65)
  corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
    document.line(x1, y1, x2, y2)
    document.line(x1, y1, x3, y3)
  })
}

function drawLaurel(document: jsPDF) {
  document.setDrawColor(...PALE_GOLD)
  document.setFillColor(247, 239, 220)
  document.setLineWidth(0.45)

  for (const side of [-1, 1]) {
    let previous: [number, number] | null = null

    for (let index = 0; index <= 11; index += 1) {
      const progress = index / 11
      const y = 157 - progress * 91
      const x = PAGE_WIDTH / 2 + side * (27 + 39 * Math.sin(progress * Math.PI * 0.56))

      if (previous) document.line(previous[0], previous[1], x, y)
      previous = [x, y]

      if (index > 0 && index < 11 && index % 2 === 0) {
        document.ellipse(x - side * 4.5, y - 1.3, 4.1, 1.65, 'F')
        document.ellipse(x + side * 4.6, y + 1.8, 3.7, 1.45, 'F')
      }
    }
  }
}

function drawSeal(document: jsPDF, x: number, y: number) {
  document.setFillColor(250, 244, 226)
  document.setDrawColor(...GOLD)
  document.setLineWidth(1.1)
  document.circle(x, y, 10.5, 'FD')
  document.setDrawColor(...PALE_GOLD)
  document.setLineWidth(0.65)
  document.circle(x, y, 8.1, 'S')
  document.setDrawColor(...GOLD)
  document.setLineWidth(1.3)
  document.line(x, y - 3.5, x + 3.2, y)
  document.line(x + 3.2, y, x, y + 3.5)
  document.line(x, y + 3.5, x - 3.2, y)
  document.line(x - 3.2, y, x, y - 3.5)
}

function drawBrand(document: jsPDF) {
  document.setFillColor(...NAVY)
  document.roundedRect(253, 18, 8, 12, 1.4, 1.4, 'F')
  document.setFillColor(91, 50, 130)
  document.rect(256, 16.5, 3, 15, 'F')
  document.setTextColor(...NAVY)
  document.setFont('helvetica', 'bold')
  document.setFontSize(10)
  document.text('CAREERX', 257, 36, { align: 'center' })
  document.setFont('helvetica', 'normal')
  document.setFontSize(5.5)
  document.text('O R I G I N', 257, 40, { align: 'center' })
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

export function createCertificatePdf(
  type: CertificateType,
  recipient: Recipient,
  eventName: string,
) {
  const certificate = getCertificateConfig(type)
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const center = PAGE_WIDTH / 2
  const event = eventName.trim() || 'CareerXOrigin HackFest 2026'

  drawFrame(document)
  drawLaurel(document)
  drawBrand(document)

  document.setTextColor(...NAVY)
  document.setFont('times', 'bold')
  document.setFontSize(30)
  document.text(certificate.eyebrow, center, 44, { align: 'center' })

  document.setTextColor(...GOLD)
  document.setFont('times', 'bold')
  document.setFontSize(17)
  document.text(certificate.subtitle, center, 55, { align: 'center' })

  document.setTextColor(86, 83, 79)
  document.setFont('helvetica', 'normal')
  document.setFontSize(11)
  document.text('PROUDLY PRESENTED TO', center, 72, { align: 'center' })

  document.setTextColor(...NAVY)
  document.setFont('times', 'bold')
  document.setFontSize(25)
  const recipientName = recipient.name || recipient.team || 'Recipient name'
  const nameLines = document.splitTextToSize(recipientName, 190)
  document.text(nameLines, center, 87, { align: 'center', lineHeightFactor: 1.1 })
  const nameBottom = 87 + (nameLines.length - 1) * 9.5

  if (recipient.team && recipient.team !== recipient.name) {
    document.setFont('helvetica', 'normal')
    document.setFontSize(9.5)
    document.setTextColor(99, 94, 87)
    document.text(recipient.team, center, nameBottom + 7, { align: 'center' })
  } else if (recipient.members.length > 0) {
    const memberLine = recipient.members.join('  ·  ')
    const memberLines = document.splitTextToSize(memberLine, 190)
    document.setFont('helvetica', 'normal')
    document.setFontSize(8.5)
    document.setTextColor(99, 94, 87)
    document.text(memberLines, center, nameBottom + 6, { align: 'center', lineHeightFactor: 1.15 })
  }

  document.setDrawColor(...GOLD)
  document.setLineWidth(0.55)
  document.line(38, 111, 259, 111)

  document.setTextColor(52, 51, 55)
  document.setFont('times', 'normal')
  document.setFontSize(12)
  const messageLines = document.splitTextToSize(getCertificateMessage(type, event), 224)
  document.text(messageLines, center, 125, { align: 'center', lineHeightFactor: 1.35 })

  document.setDrawColor(...PALE_GOLD)
  document.setLineWidth(0.4)
  document.line(34, 165, 96, 165)
  document.line(201, 165, 263, 165)

  document.setTextColor(...NAVY)
  document.setFont('times', 'bold')
  document.setFontSize(10)
  document.text('CareerXOrigin Organizing Team', 65, 172, { align: 'center' })
  document.setFont('helvetica', 'normal')
  document.setFontSize(7)
  document.setTextColor(103, 99, 93)
  document.text('EVENT ORGANIZERS', 65, 177, { align: 'center' })

  document.setTextColor(...NAVY)
  document.setFont('times', 'bold')
  document.setFontSize(10)
  document.text('CareerX Origin', 232, 172, { align: 'center' })
  document.setFont('helvetica', 'normal')
  document.setFontSize(7)
  document.setTextColor(103, 99, 93)
  document.text('CERTIFICATE OF RECOGNITION', 232, 177, { align: 'center' })

  drawSeal(document, center, 169)

  document.setTextColor(135, 127, 111)
  document.setFont('helvetica', 'normal')
  document.setFontSize(6.5)
  document.text(event.toUpperCase(), center, 192, { align: 'center' })

  return document.output('blob')
}

export function downloadSingleCertificate(type: CertificateType, recipient: Recipient, eventName: string) {
  const blob = createCertificatePdf(type, recipient, eventName)
  saveBlob(blob, `${safeFileName(recipient.name)}-${type}.pdf`)
}

export async function downloadCertificateBatch(
  type: CertificateType,
  recipients: Recipient[],
  eventName: string,
) {
  const zip = new JSZip()

  recipients.forEach((recipient, index) => {
    const blob = createCertificatePdf(type, recipient, eventName)
    const fileName = `${String(index + 1).padStart(2, '0')}-${safeFileName(recipient.name)}-${type}.pdf`
    zip.file(fileName, blob)
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, `careerxorigin-${type}-certificates.zip`)
}
