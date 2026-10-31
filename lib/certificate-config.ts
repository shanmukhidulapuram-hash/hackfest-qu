export const CERTIFICATE_TYPES = [
  {
    id: 'first-place',
    shortLabel: '1st place',
    title: 'First Place',
    eyebrow: 'CERTIFICATE OF ACHIEVEMENT',
    subtitle: 'FIRST PLACE',
    icon: 'first',
  },
  {
    id: 'second-place',
    shortLabel: '2nd place',
    title: 'Second Place',
    eyebrow: 'CERTIFICATE OF ACHIEVEMENT',
    subtitle: 'SECOND PLACE',
    icon: 'second',
  },
  {
    id: 'third-place',
    shortLabel: '3rd place',
    title: 'Third Place',
    eyebrow: 'CERTIFICATE OF ACHIEVEMENT',
    subtitle: 'THIRD PLACE',
    icon: 'third',
  },
  {
    id: 'top-10',
    shortLabel: 'Top 10 teams',
    title: 'Top 10 Teams',
    eyebrow: 'CERTIFICATE OF ACHIEVEMENT',
    subtitle: 'TOP 10 TEAM',
    icon: 'top',
  },
  {
    id: 'participation',
    shortLabel: 'Participation',
    title: 'Participation',
    eyebrow: 'CERTIFICATE',
    subtitle: 'OF PARTICIPATION',
    icon: 'participation',
  },
  {
    id: 'coordination',
    shortLabel: 'Coordination',
    title: 'Coordination',
    eyebrow: 'CERTIFICATE',
    subtitle: 'FOR COORDINATION',
    icon: 'coordination',
  },
] as const

export type CertificateType = (typeof CERTIFICATE_TYPES)[number]['id']
export type RecipientMode = 'individual' | 'team'
export type SortMode = 'rank' | 'name' | 'sheet'

export type ColumnMapping = {
  name: string
  team: string
  rank: string
  email: string
  role: string
}

export type SpreadsheetRow = Record<string, string>

export type Recipient = {
  id: string
  name: string
  team: string
  rank: string
  rankNumber: number | null
  email: string
  role: string
  members: string[]
  sourceRow: number
}

export const DEFAULT_EVENT_NAME = 'CareerXOrigin HackFest 2026'

export const EMPTY_COLUMN_MAPPING: ColumnMapping = {
  name: '',
  team: '',
  rank: '',
  email: '',
  role: '',
}

export function getCertificateConfig(type: CertificateType) {
  return CERTIFICATE_TYPES.find((certificate) => certificate.id === type) ?? CERTIFICATE_TYPES[4]
}

export function getCertificateMessage(type: CertificateType, eventName: string) {
  const event = eventName.trim() || DEFAULT_EVENT_NAME

  switch (type) {
    case 'first-place':
      return `In recognition of achieving first place at ${event}. Your creativity, technical excellence, and collaborative spirit set an inspiring standard.`
    case 'second-place':
      return `In recognition of achieving second place at ${event}. Your thoughtful work, teamwork, and determination made an outstanding impression.`
    case 'third-place':
      return `In recognition of achieving third place at ${event}. Your skill, persistence, and creative approach are worthy of celebration.`
    case 'top-10':
      return `In recognition of being selected among the Top 10 teams at ${event}. Your innovation, teamwork, and commitment to solving real-world challenges are commendable.`
    case 'participation':
      return `In recognition of your enthusiastic participation in ${event}. Thank you for sharing your ideas, creativity, and energy with the community.`
    case 'coordination':
      return `In recognition of your dedicated efforts and active coordination for ${event}. Your commitment, teamwork, and enthusiasm helped make the event a success.`
  }
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ' '))
  const choose = (patterns: RegExp[]) => {
    const index = normalized.findIndex((header) => patterns.some((pattern) => pattern.test(header)))
    return index >= 0 ? headers[index] : ''
  }

  return {
    name: choose([/^(full )?name$/, /student name/, /participant/, /recipient/, /member name/, /attendee/]),
    team: choose([/^team$/, /team name/, /group name/, /squad/]),
    rank: choose([/^rank$/, /^place$/, /position/, /standing/, /award/]),
    email: choose([/^e ?mail$/, /email address/]),
    role: choose([/^role$/, /responsibility/, /designation/, /category/]),
  }
}

export function parseRank(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (/\b(first|1st)\b/.test(normalized)) return 1
  if (/\b(second|2nd)\b/.test(normalized)) return 2
  if (/\b(third|3rd)\b/.test(normalized)) return 3

  const match = normalized.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

export function buildRecipients(
  rows: SpreadsheetRow[],
  mapping: ColumnMapping,
  type: CertificateType,
  recipientMode: RecipientMode,
  sortMode: SortMode,
): Recipient[] {
  const source: Recipient[] = rows
    .map((row, index) => {
      const name = (mapping.name ? row[mapping.name] : '')?.trim() ?? ''
      const team = (mapping.team ? row[mapping.team] : '')?.trim() ?? ''
      const rank = (mapping.rank ? row[mapping.rank] : '')?.trim() ?? ''
      const email = (mapping.email ? row[mapping.email] : '')?.trim() ?? ''
      const role = (mapping.role ? row[mapping.role] : '')?.trim() ?? ''

      if (!name && !team) return null

      return {
        id: `row-${index + 2}`,
        name: name || team,
        team,
        rank,
        rankNumber: parseRank(rank),
        email,
        role,
        members: name ? [name] : [],
        sourceRow: index + 2,
      }
    })
    .filter((recipient): recipient is Recipient => recipient !== null)

  const useTeams = Boolean(mapping.team) && (type === 'top-10' || recipientMode === 'team')
  let recipients = source

  if (useTeams) {
    const groups = new Map<string, Recipient>()

    for (const recipient of source) {
      const groupName = recipient.team || recipient.name
      const key = groupName.trim().toLocaleLowerCase()
      const current = groups.get(key)

      if (!current) {
        groups.set(key, {
          ...recipient,
          id: `team-${key}`,
          name: groupName,
          team: groupName,
          members: recipient.members.filter((member) => member.toLocaleLowerCase() !== groupName.toLocaleLowerCase()),
        })
        continue
      }

      current.sourceRow = Math.min(current.sourceRow, recipient.sourceRow)
      if (recipient.rankNumber !== null && (current.rankNumber === null || recipient.rankNumber < current.rankNumber)) {
        current.rankNumber = recipient.rankNumber
        current.rank = recipient.rank
      }
      if (!current.email && recipient.email) current.email = recipient.email
      if (!current.role && recipient.role) current.role = recipient.role
      for (const member of recipient.members) {
        if (member.toLocaleLowerCase() !== groupName.toLocaleLowerCase() && !current.members.includes(member)) {
          current.members.push(member)
        }
      }
    }

    recipients = Array.from(groups.values())
  }

  if (type === 'first-place' || type === 'second-place' || type === 'third-place') {
    const targetRank = type === 'first-place' ? 1 : type === 'second-place' ? 2 : 3
    recipients = recipients.filter((recipient) => recipient.rankNumber === targetRank)
  }

  if (type === 'top-10') {
    recipients = recipients.filter((recipient) => recipient.rankNumber !== null)
  }

  if (type === 'coordination' && mapping.role) {
    recipients = recipients.filter((recipient) => /coordinat/i.test(recipient.role))
  }

  if (sortMode === 'name') {
    recipients.sort((left, right) => left.name.localeCompare(right.name))
  } else if (sortMode === 'sheet') {
    recipients.sort((left, right) => left.sourceRow - right.sourceRow)
  } else {
    recipients.sort((left, right) => {
      if (left.rankNumber === null && right.rankNumber !== null) return 1
      if (left.rankNumber !== null && right.rankNumber === null) return -1
      if (left.rankNumber !== null && right.rankNumber !== null && left.rankNumber !== right.rankNumber) {
        return left.rankNumber - right.rankNumber
      }
      return left.name.localeCompare(right.name)
    })
  }

  if (type === 'top-10') recipients = recipients.slice(0, 10)

  return recipients
}
