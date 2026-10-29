import type { Region, Temporal, WorldDate } from './types'

/** Значение полей на дату: базовые поля + все изменения до этой даты включительно. */
export function resolve<T>(t: Temporal<T>, date: WorldDate): T {
  const applicable = t.history.filter((c) => c.date <= date).sort((a, b) => a.date - b.date)
  return applicable.reduce<T>((acc, c) => ({ ...acc, ...c.patch }), { ...t.base })
}

export function existsAt(t: { from?: WorldDate | null; to?: WorldDate | null }, date: WorldDate): boolean {
  if (t.from !== null && t.from !== undefined && date < t.from) return false
  if (t.to !== null && t.to !== undefined && date >= t.to) return false
  return true
}

/** Владелец участка на дату. Запись с date=null — исходный владелец. */
export function regionOwner(r: Region, date: WorldDate): string | null {
  let owner: string | null = null
  let best = -Infinity
  for (const o of r.owners) {
    const d = o.date ?? -Infinity
    if (d <= date && d >= best) {
      best = d
      owner = o.stateId
    }
  }
  return owner
}

/** Все даты, на которых что-то меняется — для засечек на шкале. */
export function changeDates<T>(t: Temporal<T>): WorldDate[] {
  const out = t.history.map((c) => c.date)
  if (t.from != null) out.push(t.from)
  if (t.to != null) out.push(t.to)
  return out
}
