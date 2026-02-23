import { format, addDays, isToday, isTomorrow, parseISO } from 'date-fns'

export const today = new Date()

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  const parsed = parseISO(d)
  if (isToday(parsed)) return 'Today'
  if (isTomorrow(parsed)) return 'Tomorrow'
  return format(parsed, 'MMM d, yyyy')
}

export const fmtDateShort = (d: string | null | undefined) => d ? format(parseISO(d), 'MMM d') : '—'

export const fmtTime = (t: string) => {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`
}

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')
export const weekEndStr = () => format(addDays(new Date(), 7), 'yyyy-MM-dd')

export const uid = () => crypto.randomUUID()
