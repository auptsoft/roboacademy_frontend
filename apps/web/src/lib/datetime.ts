// Formatting for schedule UI (events, calendar). Always the viewer's local time zone.

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const longDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** The navy date block used on event lists: OCT / 1. */
export function dateBlock(iso: string): { day: string; date: string; month: string } {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    date: String(d.getDate()),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
  }
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso))
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "Wed 1 Oct · 9:00 AM – 11:00 AM", or with both dates when it spans days. */
export function formatRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso)
  if (!endIso) return `${longDay.format(start)} · ${time.format(start)}`
  const end = new Date(endIso)
  return isSameDay(start, end)
    ? `${longDay.format(start)} · ${time.format(start)} – ${time.format(end)}`
    : `${longDay.format(start)}, ${time.format(start)} – ${longDay.format(end)}, ${time.format(end)}`
}
