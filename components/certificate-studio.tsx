'use client'

import {
  Award,
  BadgeCheck,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleHelp,
  Crown,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Medal,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CertificatePreview } from '@/components/certificate-preview'
import {
  autoMapColumns,
  buildRecipients,
  CERTIFICATE_TYPES,
  DEFAULT_EVENT_NAME,
  EMPTY_COLUMN_MAPPING,
  type CertificateType,
  type ColumnMapping,
  type Recipient,
  type RecipientMode,
  type SortMode,
  type SpreadsheetRow,
} from '@/lib/certificate-config'

type ParsedSheet = {
  name: string
  headers: string[]
  rows: SpreadsheetRow[]
}

type WorkbookData = {
  fileName: string
  fileSize: number
  sheets: ParsedSheet[]
}

const MAX_FILE_SIZE = 15 * 1024 * 1024
const NAV_ICONS = [Medal, Medal, Medal, Crown, UsersRound, Award]
const MAPPING_FIELDS: { id: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { id: 'name', label: 'Student / recipient name' },
  { id: 'team', label: 'Team name' },
  { id: 'rank', label: 'Rank / place' },
  { id: 'email', label: 'Email address' },
  { id: 'role', label: 'Role / responsibility' },
]

function isCertificateType(value: string): value is CertificateType {
  return CERTIFICATE_TYPES.some((certificate) => certificate.id === value)
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatRank(rank: string, rankNumber: number | null) {
  if (rank.trim()) return rank
  return rankNumber === null ? '—' : `${rankNumber}`
}

function getEmptyMessage(type: CertificateType, mapping: ColumnMapping, hasRows: boolean) {
  if (!hasRows) return 'Upload a spreadsheet to see recipients for this certificate.'
  if ((type === 'first-place' || type === 'second-place' || type === 'third-place' || type === 'top-10') && !mapping.rank) {
    return 'Choose the Rank / place column above to sort award recipients automatically.'
  }
  if (type === 'coordination' && mapping.role) {
    return 'No coordinator roles matched this column. Check the mapping, or choose Not mapped to include every row.'
  }
  return 'No matching recipients were found. Check the mapped columns and rank values.'
}

export function CertificateStudio() {
  const [activeType, setActiveType] = useState<CertificateType>('participation')
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [selectedSheetName, setSelectedSheetName] = useState('')
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_COLUMN_MAPPING)
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('individual')
  const [sortMode, setSortMode] = useState<SortMode>('rank')
  const [eventName, setEventName] = useState(DEFAULT_EVENT_NAME)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSheet = useMemo(
    () => workbook?.sheets.find((sheet) => sheet.name === selectedSheetName) ?? null,
    [selectedSheetName, workbook],
  )

  const recipients = useMemo(() => {
    if (!activeSheet) return []
    return buildRecipients(activeSheet.rows, mapping, activeType, recipientMode, sortMode)
  }, [activeSheet, activeType, mapping, recipientMode, sortMode])

  const previewRecipient = recipients[0] ?? null
  const hasMappedRows = Boolean(activeSheet?.rows.length)
  const usesRank = activeType === 'first-place' || activeType === 'second-place' || activeType === 'third-place' || activeType === 'top-10'

  const setTypeFromHash = useCallback(() => {
    const hash = window.location.hash.slice(1)
    if (isCertificateType(hash)) setActiveType(hash)
  }, [])

  useEffect(() => {
    setTypeFromHash()
    window.addEventListener('popstate', setTypeFromHash)
    window.addEventListener('hashchange', setTypeFromHash)
    return () => {
      window.removeEventListener('popstate', setTypeFromHash)
      window.removeEventListener('hashchange', setTypeFromHash)
    }
  }, [setTypeFromHash])

  const handleTypeChange = (type: CertificateType) => {
    setActiveType(type)
    setFeedback('')
    window.history.pushState(null, '', `#${type}`)
    if (type === 'top-10' && mapping.team) setRecipientMode('team')
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    setError('')
    setFeedback('')

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError('Choose an Excel workbook (.xlsx or .xls) or a CSV file.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('This file is larger than 15 MB. Please upload a smaller workbook.')
      return
    }

    setIsParsing(true)
    try {
      const XLSX = await import('xlsx')
      const bytes = await file.arrayBuffer()
      const parsed = XLSX.read(bytes, { type: 'array', cellDates: false })
      const sheets: ParsedSheet[] = parsed.SheetNames.map((sheetName) => {
        const worksheet = parsed.Sheets[sheetName]
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
          blankrows: false,
        })
        const firstRow = matrix[0] ?? []
        const seen = new Map<string, number>()
        const headers = firstRow.map((value, index) => {
          const base = String(value ?? '').trim() || `Column ${index + 1}`
          const nextCount = (seen.get(base) ?? 0) + 1
          seen.set(base, nextCount)
          return nextCount === 1 ? base : `${base} (${nextCount})`
        })
        const rows = matrix.slice(1).map((line) => {
          const row: SpreadsheetRow = {}
          headers.forEach((header, index) => {
            const value = line[index]
            row[header] = value === null || value === undefined ? '' : String(value).trim()
          })
          return row
        }).filter((row) => Object.values(row).some((value) => value.length > 0))

        return { name: sheetName, headers, rows }
      }).filter((sheet) => sheet.headers.length > 0)

      if (sheets.length === 0) {
        setError('No worksheets with a header row were found in this file.')
        return
      }

      const firstSheet = sheets[0]
      setWorkbook({ fileName: file.name, fileSize: file.size, sheets })
      setSelectedSheetName(firstSheet.name)
      setMapping(autoMapColumns(firstSheet.headers))
      setRecipientMode('individual')
      setSortMode('rank')
      setError('')
      setFeedback(`${sheets.length} worksheet${sheets.length === 1 ? '' : 's'} ready to review.`)
    } catch (caughtError) {
      console.error('[v0] Spreadsheet parsing failed:', caughtError)
      setError('We could not read this workbook. Try saving it as .xlsx or .csv and upload again.')
    } finally {
      setIsParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheetName(sheetName)
    const sheet = workbook?.sheets.find((item) => item.name === sheetName)
    if (sheet) setMapping(autoMapColumns(sheet.headers))
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Student Name', 'Team Name', 'Rank', 'Email', 'Role'],
      ['Taylor Morgan', 'Team Horizon', '1', 'taylor@example.com', 'Participant'],
      ['Jordan Lee', 'Team Northstar', '2', 'jordan@example.com', 'Participant'],
      ['Casey Patel', 'Team Solstice', '3', 'casey@example.com', 'Coordinator'],
    ])
    const workbookTemplate = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbookTemplate, sheet, 'Recipients')
    XLSX.writeFile(workbookTemplate, 'certificate-roster-template.xlsx')
  }

  const downloadSingle = async (recipient: Recipient) => {
    setError('')
    setFeedback('')
    try {
      const { downloadSingleCertificate } = await import('@/lib/certificate-export')
      downloadSingleCertificate(activeType, recipient, eventName)
      setFeedback(`Certificate for ${recipient.name} downloaded.`)
    } catch (caughtError) {
      console.error('[v0] Single certificate export failed:', caughtError)
      setError('The PDF could not be created. Please try again.')
    }
  }

  const downloadBatch = async () => {
    if (recipients.length === 0) return
    setIsExporting(true)
    setError('')
    setFeedback('')
    try {
      const { downloadCertificateBatch } = await import('@/lib/certificate-export')
      await downloadCertificateBatch(activeType, recipients, eventName)
      setFeedback(`${recipients.length} individual PDF${recipients.length === 1 ? '' : 's'} are ready in a ZIP file.`)
    } catch (caughtError) {
      console.error('[v0] Certificate batch export failed:', caughtError)
      setError('The certificate bundle could not be created. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const clearWorkbook = () => {
    setWorkbook(null)
    setSelectedSheetName('')
    setMapping(EMPTY_COLUMN_MAPPING)
    setError('')
    setFeedback('')
  }

  const selectedCertificate = CERTIFICATE_TYPES.find((certificate) => certificate.id === activeType) ?? CERTIFICATE_TYPES[4]
  const inputId = 'certificate-roster-upload'

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar" aria-label="Certificate navigation">
        <div className="studio-brand">
          <span className="brand-mark" aria-hidden="true">CX</span>
          <span className="brand-lockup">
            <strong>CareerX Origin</strong>
            <span>CERTIFICATE STUDIO</span>
          </span>
        </div>

        <p className="sidebar-label">Certificate links</p>
        <nav className="certificate-nav" aria-label="Choose a certificate type">
          {CERTIFICATE_TYPES.map((certificate, index) => {
            const Icon = NAV_ICONS[index]
            const isActive = certificate.id === activeType
            return (
              <a
                key={certificate.id}
                href={`#${certificate.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`certificate-nav-link${isActive ? ' is-active' : ''}`}
                onClick={(event) => {
                  event.preventDefault()
                  handleTypeChange(certificate.id)
                }}
              >
                <span className="nav-icon"><Icon size={14} aria-hidden="true" /></span>
                <span>{certificate.shortLabel}</span>
              </a>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span className="privacy-icon"><ShieldCheck size={15} aria-hidden="true" /></span>
            <div>
              <strong>Your roster stays private</strong>
              <p>Files are read in this browser and are not uploaded to a server.</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <div className="workspace-topbar">
          <div className="breadcrumbs" aria-label="Breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>Certificate builder</strong>
          </div>
          <div className="topbar-status"><span className="status-dot" />Local processing</div>
        </div>

        <div className="studio-content">
          <header className="page-intro">
            <div>
              <p className="page-kicker"><Sparkles size={12} aria-hidden="true" /> Event recognition, made simple</p>
              <h1>Turn one roster into<br />every certificate.</h1>
              <p>Upload your student sheet, map the columns, and generate polished awards in a few clicks.</p>
            </div>
            <div className="intro-meta">
              <span>Certificate set</span>
              <strong>CareerXOrigin HackFest 2026</strong>
              <span>6 dedicated certificate links</span>
            </div>
          </header>

          <section className="workflow-steps" aria-label="Certificate generation steps">
            <div className={`workflow-step${workbook ? ' is-complete' : ' is-current'}`}>
              <span className="step-number">{workbook ? <Check size={13} aria-hidden="true" /> : '01'}</span>
              <span className="step-copy"><strong>Upload roster</strong><span>Excel or CSV</span></span>
            </div>
            <div className={`workflow-step${workbook ? ' is-current' : ''}`}>
              <span className="step-number">02</span>
              <span className="step-copy"><strong>Review recipients</strong><span>Sort and map fields</span></span>
            </div>
            <div className={`workflow-step${recipients.length > 0 ? ' is-current' : ''}`}>
              <span className="step-number">03</span>
              <span className="step-copy"><strong>Generate</strong><span>Download PDF certificates</span></span>
            </div>
          </section>

          <div className="workspace-grid">
            <div className="workspace-left">
              <section className="surface-card" aria-labelledby="upload-heading">
                <div className="surface-card-header">
                  <div className="card-heading">
                    <span className="card-step-icon"><FileSpreadsheet size={16} aria-hidden="true" /></span>
                    <div>
                      <h2 id="upload-heading">Upload your student roster</h2>
                      <p>We&apos;ll sort awards by rank and keep the original workbook on your device.</p>
                    </div>
                  </div>
                  <span className="card-step-label">Step 01</span>
                </div>

                <div className="upload-card-content">
                  {!workbook ? (
                    <>
                      <label
                        className={`drop-zone${isDragging ? ' is-dragging' : ''}`}
                        htmlFor={inputId}
                        onDragOver={(event) => {
                          event.preventDefault()
                          setIsDragging(true)
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(event) => {
                          event.preventDefault()
                          setIsDragging(false)
                          void handleFile(event.dataTransfer.files[0])
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          id={inputId}
                          className="visually-hidden"
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          aria-label="Choose an Excel or CSV roster"
                          onChange={(event) => void handleFile(event.target.files?.[0])}
                        />
                        <span className="upload-glyph">
                          {isParsing ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
                        </span>
                        <strong>{isParsing ? 'Reading your spreadsheet…' : <>Drop your file here or <span>browse files</span></>}</strong>
                        <small>{isParsing ? 'Your sheet is being processed in this browser.' : 'Excel workbook or CSV · up to 15 MB'}</small>
                      </label>
                      <div className="upload-support-row">
                        <span>Use a header row such as Student Name, Team, Rank, Email</span>
                        <button type="button" onClick={() => void downloadTemplate()}>Download sample sheet</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="file-ready-row">
                        <div className="file-ready-main">
                          <span className="file-ready-icon"><FileCheck2 size={17} aria-hidden="true" /></span>
                          <div className="file-ready-copy">
                            <strong>{workbook.fileName}</strong>
                            <span>{activeSheet?.rows.length ?? 0} rows · {workbook.sheets.length} worksheet{workbook.sheets.length === 1 ? '' : 's'} · {formatFileSize(workbook.fileSize)}</span>
                          </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload data-icon="inline-start" /> Replace file
                        </Button>
                        <input
                          ref={fileInputRef}
                          id={inputId}
                          className="visually-hidden"
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          aria-label="Replace the uploaded roster"
                          onChange={(event) => void handleFile(event.target.files?.[0])}
                        />
                      </div>

                      <div className="upload-controls">
                        <label>
                          <span className="field-label">Worksheet</span>
                          <span className="select-shell">
                            <select className="control-select" value={selectedSheetName} onChange={(event) => handleSheetChange(event.target.value)}>
                              {workbook.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}
                            </select>
                            <ChevronDown size={13} aria-hidden="true" />
                          </span>
                        </label>
                        <Button type="button" variant="ghost" size="sm" onClick={clearWorkbook}>Remove roster</Button>
                      </div>

                      <div className="mapping-wrap">
                        <div className="mapping-topline">
                          <strong>Match your columns</strong>
                          <span>Auto-detected — adjust if needed</span>
                        </div>
                        <div className="mapping-grid">
                          {MAPPING_FIELDS.map((field) => (
                            <label className="mapping-field" key={field.id}>
                              <span className="field-label">{field.label}{field.required ? ' *' : ''}</span>
                              <span className="select-shell">
                                <select
                                  className="control-select"
                                  value={mapping[field.id]}
                                  onChange={(event) => setMapping((current) => ({ ...current, [field.id]: event.target.value }))}
                                >
                                  <option value="">Not mapped</option>
                                  {activeSheet?.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                                </select>
                                <ChevronDown size={13} aria-hidden="true" />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="event-name-field">
                        <span className="field-label">Event name on certificates</span>
                        <input className="control-input" value={eventName} onChange={(event) => setEventName(event.target.value)} maxLength={80} />
                      </label>
                    </>
                  )}

                  {error ? <p className="file-error" role="alert">{error}</p> : null}
                  {feedback ? <p className="export-feedback" role="status">{feedback}</p> : null}
                </div>
              </section>

              <section className="surface-card roster-card" aria-labelledby="recipients-heading">
                <div className="surface-card-header">
                  <div className="card-heading">
                    <span className="card-step-icon"><BookOpenCheck size={16} aria-hidden="true" /></span>
                    <div>
                      <h2 id="recipients-heading">Recipients for {selectedCertificate.shortLabel}</h2>
                      <p>{usesRank ? 'Award recipients are filtered from the mapped rank column.' : 'Review the people who will receive this certificate.'}</p>
                    </div>
                  </div>
                  <div className="roster-controls">
                    {mapping.team && activeType !== 'top-10' ? (
                      <label className="recipient-mode-control">
                        <span className="field-label">Issue to</span>
                        <span className="select-shell compact-select">
                          <select className="control-select" value={recipientMode} onChange={(event) => setRecipientMode(event.target.value as RecipientMode)}>
                            <option value="individual">Individuals</option>
                            <option value="team">Teams</option>
                          </select>
                          <ChevronDown size={12} aria-hidden="true" />
                        </span>
                      </label>
                    ) : null}
                    <span className="roster-count"><UsersRound size={12} aria-hidden="true" /> {recipients.length} ready</span>
                  </div>
                </div>

                {recipients.length > 0 ? (
                  <>
                    <div className="recipient-table-wrap">
                      <table className="recipient-table">
                        <thead>
                          <tr>
                            <th scope="col">Recipient</th>
                            <th scope="col">Team</th>
                            <th scope="col">Rank</th>
                            <th scope="col"><span className="visually-hidden">Download</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipients.slice(0, 8).map((recipient) => (
                            <tr key={recipient.id}>
                              <td>{recipient.name}</td>
                              <td>{recipient.team || '—'}</td>
                              <td><span className="rank-pill">{formatRank(recipient.rank, recipient.rankNumber)}</span></td>
                              <td>
                                <button className="table-download" type="button" onClick={() => void downloadSingle(recipient)} aria-label={`Download certificate for ${recipient.name}`}>
                                  <Download size={12} aria-hidden="true" /> PDF
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {recipients.length > 8 ? <p className="table-note">Showing 8 of {recipients.length}. The ZIP export includes every recipient.</p> : null}
                  </>
                ) : (
                  <div className="empty-roster">
                    <CircleHelp size={17} aria-hidden="true" />
                    <strong>{hasMappedRows ? 'No recipients match this certificate yet' : 'Your recipient list will appear here'}</strong>
                    <span>{getEmptyMessage(activeType, mapping, hasMappedRows)}</span>
                  </div>
                )}

                <div className="roster-footer">
                  <label className="sort-control">
                    <span>Sort by</span>
                    <span className="select-shell compact-select">
                      <select className="control-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                        <option value="rank">Rank, then name</option>
                        <option value="name">Recipient A–Z</option>
                        <option value="sheet">Original sheet order</option>
                      </select>
                      <ChevronDown size={12} aria-hidden="true" />
                    </span>
                  </label>
                  {activeType === 'top-10' ? <span className="top-ten-note"><Crown size={12} aria-hidden="true" /> Top 10 {mapping.team ? 'unique teams' : 'recipients'} by rank</span> : null}
                </div>
              </section>
            </div>

            <aside className="surface-card preview-card" aria-labelledby="preview-heading">
              <div className="preview-card-header">
                <div>
                  <h2 id="preview-heading">Live certificate preview</h2>
                  <p>Updates as you choose a certificate and recipient.</p>
                </div>
                <span className="preview-live"><span className="status-dot" /> LIVE</span>
              </div>

              <div className="preview-stage">
                <CertificatePreview type={activeType} eventName={eventName} recipient={previewRecipient} />
                <div className="preview-footer">
                  <span><BadgeCheck size={12} aria-hidden="true" /> Landscape A4</span>
                  <span>Gold frame · <strong>{selectedCertificate.title}</strong></span>
                </div>
              </div>

              <div className="export-panel">
                <div className="export-description">
                  <FileText size={13} aria-hidden="true" />
                  {recipients.length > 0 ? `${recipients.length} print-ready certificate${recipients.length === 1 ? '' : 's'} will be created as separate PDFs.` : 'Upload a roster and map the required columns to enable export.'}
                </div>
                <div className="export-actions">
                  <Button
                    type="button"
                    className="shadcn-export-button"
                    disabled={recipients.length === 0 || isExporting}
                    onClick={() => void downloadBatch()}
                  >
                    {isExporting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
                    {isExporting ? 'Preparing ZIP…' : 'Download all PDFs'}
                  </Button>
                  <Button type="button" variant="outline" className="shadcn-secondary-button" onClick={() => void downloadTemplate()}>
                    <FileSpreadsheet data-icon="inline-start" /> Template
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
