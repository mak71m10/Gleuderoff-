// Ход ВПИ (docs/впи-ход.md): месяц за месяцем итог бюджета каждой страны записывается в журнал её казны.
// Следующий ход — месяц после последнего проведённого (с начала игры — с месяца «настоящего» лора).
import { worldReports, monthStart } from './econCalc'
import { journalAdd } from './economy'
import { toParts, fromParts } from './calendar'
import type { WorldData, WorldDate } from './types'

/** первый непроведённый месяц */
export function nextTurn(world: WorldData): WorldDate {
  const last = world.vpi?.lastTurn
  if (last == null) return monthStart(world, world.calendar.present)
  const p = toParts(world.calendar, last)
  const m = p.month + 1
  return fromParts(world.calendar, m >= world.calendar.months.length ? { year: p.year + 1, month: 0, day: 1 } : { year: p.year, month: m, day: 1 })
}
/** «Фраул 1010» */
export function monthLabel(world: WorldData, date: WorldDate): string { const p = toParts(world.calendar, date); return `${world.calendar.months[p.month]?.name ?? '?'} ${p.year}` }
const monthEnd = (world: WorldData, start: WorldDate): WorldDate => start + (world.calendar.months[toParts(world.calendar, start).month]?.days ?? 100) - 1

/** итоги месяца по странам — без изменений мира */
export function turnPreview(world: WorldData, start: WorldDate = nextTurn(world)) {
  const reps = worldReports(world, start)
  const rows = [...reps.entries()].map(([id, r]) => ({ id, name: world.states.find((s) => s.id === id)?.base.name ?? id, net: r.net, treasury: r.treasury })).sort((a, b) => a.net - b.net)
  return { start, end: monthEnd(world, start), label: monthLabel(world, start), rows }
}

/** провести ход: итог месяца — в журнал казны каждой страны (на последний день месяца); world — черновик для правки */
export function applyTurn(world: WorldData, preview: ReturnType<typeof turnPreview>): void {
  const name = preview.label
  for (const r of preview.rows) {
    const st = world.states.find((s) => s.id === r.id)
    if (st?.base.econ) journalAdd(st.base.econ, preview.end, r.net, `итог хода: ${name}`, 'turn')
  }
  ;(world.vpi ??= {}).lastTurn = preview.start
}

/** отменить последний ход: убрать его итоги из журналов */
export function undoTurn(world: WorldData): boolean {
  const last = world.vpi?.lastTurn
  if (last == null) return false
  const end = monthEnd(world, last)
  for (const st of world.states) if (st.base.econ?.journal) st.base.econ.journal = st.base.econ.journal.filter((x) => !(x.kind === 'turn' && x.date === end))
  const p = toParts(world.calendar, last)
  world.vpi!.lastTurn = p.month === 0 && last <= monthStart(world, world.calendar.present) ? undefined : p.month === 0 ? fromParts(world.calendar, { year: p.year - 1, month: world.calendar.months.length - 1, day: 1 }) : fromParts(world.calendar, { year: p.year, month: p.month - 1, day: 1 })
  if (world.vpi!.lastTurn != null && world.vpi!.lastTurn < monthStart(world, world.calendar.present)) world.vpi!.lastTurn = undefined
  return true
}
