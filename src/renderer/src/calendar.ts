import type { Calendar, WorldDate } from './types'

export interface DateParts {
  /** Год без нуля: 1, 2, ... — после; -1, -2, ... — до */
  year: number
  /** 0-based */
  month: number
  /** 1-based */
  day: number
}

export const yearLength = (cal: Calendar): number => cal.months.reduce((s, m) => s + m.days, 0)

export function toParts(cal: Calendar, date: WorldDate): DateParts {
  const len = yearLength(cal)
  const yearIndex = Math.floor(date / len)
  let rest = date - yearIndex * len
  let month = 0
  while (month < cal.months.length - 1 && rest >= cal.months[month].days) {
    rest -= cal.months[month].days
    month++
  }
  return { year: yearIndex >= 0 ? yearIndex + 1 : yearIndex, month, day: rest + 1 }
}

export function fromParts(cal: Calendar, p: DateParts): WorldDate {
  const len = yearLength(cal)
  const yearIndex = p.year > 0 ? p.year - 1 : p.year
  let days = yearIndex * len
  for (let m = 0; m < p.month; m++) days += cal.months[m].days
  const maxDay = cal.months[p.month]?.days ?? 1
  return days + Math.min(Math.max(p.day, 1), maxDay) - 1
}

export const yearStart = (cal: Calendar, year: number): WorldDate => fromParts(cal, { year, month: 0, day: 1 })

export function formatYear(cal: Calendar, year: number): string {
  return year > 0 ? `${year} ${cal.eraAfterShort}` : `${-year} ${cal.eraBeforeShort}`
}

export function formatDate(cal: Calendar, date: WorldDate | null | undefined, withDay = true): string {
  if (date === null || date === undefined) return '—'
  const p = toParts(cal, date)
  const y = formatYear(cal, p.year)
  if (!withDay) return y
  return `${p.day} ${cal.months[p.month]?.name ?? '?'} ${y}`
}

export function weekday(cal: Calendar, date: WorldDate): string {
  if (!cal.weekdays.length) return ''
  const n = cal.weekdays.length
  return cal.weekdays[((date % n) + n) % n]
}

export function addMonths(cal: Calendar, date: WorldDate, delta: number): WorldDate {
  const p = toParts(cal, date)
  const n = cal.months.length
  let total = (p.year > 0 ? p.year - 1 : p.year) * n + p.month + delta
  const yi = Math.floor(total / n)
  const month = total - yi * n
  return fromParts(cal, { year: yi >= 0 ? yi + 1 : yi, month, day: p.day })
}

export function addYears(cal: Calendar, date: WorldDate, delta: number): WorldDate {
  return addMonths(cal, date, delta * cal.months.length)
}

/** Название эпохи для года */
export function eraOf(cal: Calendar, year: number): string {
  const eras = [...(cal.eras ?? [])].sort((a, b) => a.from - b.from)
  let name = ''
  for (const e of eras) if (year >= e.from) name = e.name
  return name
}
