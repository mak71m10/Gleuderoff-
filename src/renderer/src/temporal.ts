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

/** Сколько дней метка битвы остаётся на карте после её даты (2 года): старые сражения не загромождают современную карту. */
export const BATTLE_MARK_DAYS = 1000

/** Видно ли место на дату: существует ли оно, а метка битвы — только первые два года после сражения. */
export function placeVisible(pl: { from?: WorldDate | null; to?: WorldDate | null; base: { type: string }; history: { date: WorldDate; patch: Record<string, unknown> }[] }, date: WorldDate): boolean {
  if (!existsAt(pl, date)) return false
  const type = (pl.history.filter((c) => c.date <= date).sort((a, b) => a.date - b.date).reduce<Record<string, unknown>>((acc, c) => ({ ...acc, ...c.patch }), { type: pl.base.type }).type as string) ?? pl.base.type
  if (type === 'battle' && pl.from != null && date > pl.from + BATTLE_MARK_DAYS) return false
  return true
}
