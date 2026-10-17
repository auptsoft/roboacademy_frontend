// Turns raw audit rows (see the backend's AuditSaveChangesInterceptor) into readable timeline
// entries. Rows carry the entity's CLR type name, an EF state ("Added" / "Modified" / "Deleted")
// and a JSON snapshot: every property for Added/Deleted, { Old, New } per changed property for
// Modified.

export interface AuditEntryLike {
  id: string
  userId: string | null
  entityType: string
  entityId: string
  action: string
  changes: string | null
  occurredAt: string
}

export type AuditTone = 'added' | 'modified' | 'deleted' | 'other'

export interface AuditFieldChange {
  field: string
  before?: string
  after: string
}

export interface DescribedAuditEntry {
  tone: AuditTone
  // "created", "updated", "added a student to a class"... Read as "<actor> <verb> <entityLabel> <subject>"
  // (entityLabel is empty when the verb is already a whole phrase).
  verb: string
  entityLabel: string
  // A human name for the affected record when the snapshot has one (name, title, email...).
  subject: string | null
  // Modified rows only: which fields changed, already humanised.
  changedFields: string[]
  details: AuditFieldChange[]
}

// Join rows read better as a whole phrase ("added a student to a class") than "created class student".
const LINK_PHRASES: Record<string, { added: string; removed: string }> = {
  UserRole: { added: 'assigned a role', removed: 'removed a role' },
  ClassStudent: { added: 'added a student to a class', removed: 'removed a student from a class' },
  ClassStaffMember: { added: 'added a staff member to a class', removed: 'removed a staff member from a class' },
  TenantHost: { added: 'added domain', removed: 'removed domain' },
}

const ENTITY_LABELS: Record<string, string> = {
  Tenant: 'school',
}

// Bookkeeping columns that change on every save and say nothing to a reader.
const NOISE_FIELDS = new Set([
  'UpdatedAt', 'ModifiedAt', 'LastModifiedAt', 'ConcurrencyStamp', 'SecurityStamp', 'RowVersion', 'Version', 'xmin',
])

function humanize(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
}

function stringify(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseChanges(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function isDiff(value: unknown): value is { Old: unknown; New: unknown } {
  return !!value && typeof value === 'object' && 'New' in value
}

// For a Modified row, the current value of a field (its New side).
function currentValue(changes: Record<string, unknown>, key: string): unknown {
  const value = changes[key]
  return isDiff(value) ? value.New : value
}

function pickSubject(changes: Record<string, unknown>): string | null {
  const text = (key: string) => {
    const value = currentValue(changes, key)
    return typeof value === 'string' && value.trim() && value !== '[redacted]' ? value.trim() : null
  }
  const first = text('FirstName')
  const last = text('LastName')
  if (first || last) return [first, last].filter(Boolean).join(' ')
  for (const key of ['FullName', 'DisplayName', 'Name', 'Title', 'Email', 'Host', 'Hostname', 'Slug', 'Role', 'RoleName']) {
    const value = text(key)
    if (value) return value
  }
  return null
}

export function describeAuditEntry(entry: AuditEntryLike): DescribedAuditEntry {
  const changes = parseChanges(entry.changes)
  const link = LINK_PHRASES[entry.entityType]
  const entityLabel = ENTITY_LABELS[entry.entityType] ?? humanize(entry.entityType)

  const fields = Object.keys(changes).filter((key) => !NOISE_FIELDS.has(key))
  const details: AuditFieldChange[] = fields.map((field) => {
    const value = changes[field]
    return isDiff(value)
      ? { field: humanize(field), before: stringify(value.Old), after: stringify(value.New) }
      : { field: humanize(field), after: stringify(value) }
  })

  switch (entry.action) {
    case 'Added':
      return link
        ? { tone: 'added', verb: link.added, entityLabel: '', subject: pickSubject(changes), changedFields: [], details }
        : { tone: 'added', verb: 'created', entityLabel, subject: pickSubject(changes), changedFields: [], details }
    case 'Deleted':
      return link
        ? { tone: 'deleted', verb: link.removed, entityLabel: '', subject: pickSubject(changes), changedFields: [], details }
        : { tone: 'deleted', verb: 'deleted', entityLabel, subject: pickSubject(changes), changedFields: [], details }
    case 'Modified':
      return {
        tone: 'modified',
        verb: 'updated',
        entityLabel,
        subject: pickSubject(changes),
        changedFields: fields.map(humanize),
        details,
      }
    default:
      return { tone: 'other', verb: humanize(entry.action), entityLabel, subject: pickSubject(changes), changedFields: [], details }
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

// "just now" / "5m ago" / "3h ago" within the last day, otherwise the clock time (the day group
// header already gives the date).
export function timeLabel(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes >= 0 && minutes < 1) return 'just now'
  if (minutes >= 0 && minutes < 60) return `${minutes}m ago`
  if (minutes >= 0 && minutes < 12 * 60) return `${Math.floor(minutes / 60)}h ago`
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export interface DayGroup<T> {
  label: string
  items: T[]
}

// Rows arrive newest first, so consecutive grouping keeps both the day order and the order within
// each day.
export function groupByDay<T extends { occurredAt: string }>(items: T[], now = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const item of items) {
    const label = dayLabel(item.occurredAt, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}
