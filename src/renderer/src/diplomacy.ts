// Дипломатия ВПИ: отношения между странами (world.relations, scripts/diplomacy-seed.mjs) — вид, оценка из лора и поправки
// (граница, вера, народ, торговля, долги, дань), договоры; всё на дату. Мастер и вердикты меняют отношения «с даты».
import type { EconReport } from './econCalc'
import { ownerAt } from './provinces'
import type { WorldData, WorldDate, WorldState } from './types'

export type RelKind = 'war' | 'vassal' | 'alliance' | 'hostile' | 'tension' | 'trade' | 'neutral' | 'truce'
export const REL: Record<RelKind, { name: string; color: string; icon: string }> = {
  war: { name: 'война', color: '#d0453a', icon: '⚔' },
  hostile: { name: 'вражда', color: '#e07a4a', icon: '✖' },
  tension: { name: 'напряжённость', color: '#d8a84a', icon: '⚠' },
  truce: { name: 'перемирие', color: '#b8a070', icon: '🏳' },
  neutral: { name: 'нейтралитет', color: '#8a8a8a', icon: '·' },
  trade: { name: 'торговля', color: '#5aa0d0', icon: '⚖' },
  alliance: { name: 'союз', color: '#6ac070', icon: '🤝' },
  vassal: { name: 'вассалитет', color: '#c8a040', icon: '👑' }
}
/** обычная оценка для вида отношений (при смене вида мастером) */
export const REL_BASE: Record<RelKind, number> = { war: -80, hostile: -45, tension: -20, truce: -10, neutral: 0, trade: 20, alliance: 55, vassal: 15 }
export const TREATIES: Record<string, string> = { trade: 'торговый договор', debt: 'долги и займы', tribute: 'дань', marriage: 'брачный союз', passage: 'проход войск', defense: 'оборонительный союз', truce: 'перемирие', border: 'договор о границе' }

export interface Relation { id: string; a: string; b: string; kind: RelKind; base: number; treaties: string[]; note: string; source: 'lore' | 'auto' | 'master'; from: WorldDate; to?: WorldDate; overlord?: string }
export interface RelView { other: WorldState; rec: Relation; score: number; mods: { text: string; value: number }[]; border: number; trade: number; prev?: Relation; recent: boolean }
/** перемены последних трёх месяцев выходят на первый план */
export const RECENT = 300
const prevOf = (world: WorldData, rec: Relation): Relation | undefined => (world.relations ?? []).find((r) => r.id !== rec.id && ((r.a === rec.a && r.b === rec.b) || (r.a === rec.b && r.b === rec.a)) && r.to === rec.from)

const inTime = (r: Relation, date: WorldDate): boolean => r.from <= date && (r.to == null || date < r.to)
/** действующая запись пары на дату (последняя по дате) */
export function relationAt(world: WorldData, a: string, b: string, date: WorldDate): Relation | undefined {
  return (world.relations ?? []).filter((r) => ((r.a === a && r.b === b) || (r.a === b && r.b === a)) && inTime(r, date)).sort((x, y) => y.from - x.from)[0]
}

/** отношения страны со всеми, кто в записях или граничит: вид, оценка с поправками, граница, торговля */
export function relationsOf(world: WorldData, st: WorldState, date: WorldDate, rep: EconReport | null, borders: Map<string, number>): RelView[] {
  const out: RelView[] = []
  const pairs = new Set<string>()
  for (const r of world.relations ?? []) if ((r.a === st.id || r.b === st.id) && inTime(r, date)) pairs.add(r.a === st.id ? r.b : r.a)
  for (const id of borders.keys()) pairs.add(id)
  for (const oid of pairs) {
    const other = world.states.find((s) => s.id === oid)
    if (!other) continue
    const rec = relationAt(world, st.id, oid, date) ?? { id: `auto-${oid}`, a: st.id, b: oid, kind: 'neutral' as RelKind, base: 0, treaties: [], note: '', source: 'auto' as const, from: date }
    const mods: { text: string; value: number }[] = []
    const border = borders.get(oid) ?? 0
    if (border) mods.push({ text: `общая граница (${border} обл.): споры о межах`, value: -5 })
    if (st.base.religionId && st.base.religionId === other.base.religionId) mods.push({ text: `одна вера: ${st.base.religion}`, value: 15 })
    else if (st.base.religionId && other.base.religionId) mods.push({ text: 'разная вера', value: -5 })
    if (st.base.culture && st.base.culture === other.base.culture) mods.push({ text: `один народ: ${st.base.culture}`, value: 10 })
    const tr = rep?.trade.find((t) => t.id === oid)
    if (tr && tr.value > 0) mods.push({ text: `торговля (${tr.by}): ${Math.round(tr.value)} мар. за ход`, value: Math.min(15, Math.round(tr.value / 20) + 3) })
    const debt = (st.base.econ?.debts ?? []).find((d) => d.to === other.base.name) ?? (other.base.econ?.debts ?? []).find((d) => d.to === st.base.name)
    if (debt) mods.push({ text: `долг: ${Math.round(debt.sum).toLocaleString('ru-RU')} мар.`, value: 5 })
    if (rec.kind === 'vassal') mods.push({ text: rec.overlord === st.id ? 'наш вассал: дань и присяга' : 'наш сюзерен: дань и присяга', value: rec.overlord === st.id ? 10 : -5 })
    const score = Math.max(-100, Math.min(100, Math.round(rec.base + mods.reduce((s, m) => s + m.value, 0))))
    const prev = prevOf(world, rec)
    const recent = rec.source === 'master' && rec.from <= date && date - rec.from <= RECENT
    out.push({ other, rec, score, mods, border, trade: tr?.value ?? 0, prev, recent })
  }
  const order: RelKind[] = ['war', 'vassal', 'alliance', 'hostile', 'tension', 'truce', 'trade', 'neutral']
  return out.sort((x, y) => Number(y.recent) - Number(x.recent) || order.indexOf(x.rec.kind) - order.indexOf(y.rec.kind) || Math.abs(y.score) - Math.abs(x.score))
}
export const scoreWord = (s: number): string => (s >= 60 ? 'тёплые' : s >= 25 ? 'добрые' : s > -25 ? 'ровные' : s > -60 ? 'холодные' : 'враждебные')

/** границы страны на дату: соседи → число пограничных областей */
export function bordersOf(world: WorldData, stId: string, date: WorldDate): Map<string, number> {
  const byId = new Map((world.provinces ?? []).map((p) => [p.id, p]))
  const res = new Map<string, number>()
  for (const p of world.provinces ?? []) {
    if (ownerAt(p, date) !== stId) continue
    const seen = new Set<string>()
    for (const n of p.neighbors ?? []) { const q = byId.get(n); const o = q ? ownerAt(q, date) : null; if (o && o !== stId && !seen.has(o)) { seen.add(o); res.set(o, (res.get(o) ?? 0) + 1) } }
  }
  return res
}

/** вести дипломатии: перемены отношений (записи мастера и вердиктов) до даты, свежие первыми */
export function diploNews(world: WorldData, date: WorldDate, stateId?: string, limit = 8): { rec: Relation; prev?: Relation; a: string; b: string }[] {
  const name = (id: string): string => world.states.find((s) => s.id === id)?.base.name ?? id
  return (world.relations ?? [])
    .filter((r) => r.source === 'master' && r.from <= date && (!stateId || r.a === stateId || r.b === stateId))
    .sort((x, y) => y.from - x.from).slice(0, limit)
    .map((rec) => ({ rec, prev: prevOf(world, rec), a: name(rec.a), b: name(rec.b) }))
}
