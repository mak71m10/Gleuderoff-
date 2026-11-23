// Приказы во времени (docs/впи-армия.md § 14): перевооружение после конструктора и учения.
// Всё считается на дату шкалы: до приказа рота — по старому уставу, во время — «в переучке» (слабее),
// после — по новому; учения добавляют опыт, когда закончатся.
import { ARM, companyStats, type Company, type CompanyTemplate, type Formation, type Mods, type Order, type Stat, type StateMilitary } from './military'
import type { WorldDate } from './types'

export const DAY_MONTH = 100
/** срок перевооружения: не меньше полумесяца, дальше — по тому, что поменялось */
export function rearmDays(old: CompanyTemplate, neu: CompanyTemplate): number {
  let d = 15
  if (old.arm !== neu.arm) d += 40
  const ch = (s: keyof CompanyTemplate['parts']): boolean => (old.parts[s] ?? '') !== (neu.parts[s] ?? '')
  if (ch('weapon')) d += 10
  if (ch('armor')) d += 10
  if (ch('shield')) d += 5
  if (ch('mount')) d += 30
  if (ch('training') || ch('formation')) d += 20
  if (ch('banner') || ch('train')) d += 5
  const kitDiff = old.kit.filter((k) => !neu.kit.includes(k)).length + neu.kit.filter((k) => !old.kit.includes(k)).length
  d += Math.min(15, kitDiff * 5)
  return Math.min(120, d)
}
/** сколько деталей поменялось (для цены) */
export function changedSlots(old: CompanyTemplate, neu: CompanyTemplate): number {
  const slots = new Set([...Object.keys(old.parts), ...Object.keys(neu.parts)]) as Set<keyof CompanyTemplate['parts']>
  let n = old.arm !== neu.arm ? 3 : 0
  for (const s of slots) if ((old.parts[s] ?? '') !== (neu.parts[s] ?? '')) n++
  return n + (old.kit.join() !== neu.kit.join() ? 1 : 0)
}
const sample = (t: CompanyTemplate): Company => ({ id: 'sample', name: '', t: t.id, race: '', region: 'plain', quality: 'common', traits: [], cmd: { name: '', trait: '' }, men: ARM[t.arm]?.men ?? 120, xp: 0, colors: ['#000', '#fff'] })
/** разовая цена перевооружения всех рот устава */
export function rearmCost(old: CompanyTemplate, neu: CompanyTemplate, companies: number): number {
  const per = companyStats(sample(neu), neu).cost
  return Math.round(companies * per * (1.5 + changedSlots(old, neu) * 0.6))
}
/** цена учений: доля содержания рот за срок */
export function trainCost(mil: StateMilitary, ids: string[], days: number): number {
  const tpl = new Map(mil.templates.map((t) => [t.id, t]))
  const cost = ids.reduce((s, id) => { const c = mil.companies.find((x) => x.id === id); return s + (c ? companyStats(c, tpl.get(c.t)).cost : 0) }, 0)
  return Math.round((cost * days) / 40)
}
export const orderEnd = (o: Order): WorldDate => o.from + o.days
export const orderActive = (o: Order, date: WorldDate): boolean => date >= o.from && date < orderEnd(o)

/** устав на дату: позже введённые перевооружения откатываются к старой версии */
export function templateAt(mil: StateMilitary, t: CompanyTemplate | undefined, date: WorldDate): { tpl: CompanyTemplate | undefined; rearm?: Order } {
  if (!t) return { tpl: t }
  const list = (mil.orders ?? []).filter((o) => o.kind === 'rearm' && o.template === t.id).sort((a, b) => b.from - a.from)
  let cur: CompanyTemplate = t
  for (const o of list) if (o.from > date && o.old) cur = { ...cur, ...o.old }
  const rearm = list.find((o) => orderActive(o, date))
  return { tpl: cur, rearm }
}
/** роты соединения (вглубь) */
export function companiesUnder(mil: StateMilitary, f: Formation): string[] {
  const fById = new Map(mil.formations.map((x) => [x.id, x]))
  const out: string[] = []
  const walk = (x: Formation): void => { out.push(...(x.companies ?? [])); for (const ch of x.children) { const y = fById.get(ch); if (y) walk(y) } }
  walk(f)
  return out
}

const REARM_PENALTY: Mods = { dis: -3, mor: -1, hold: -1 }
/** рота на дату: устав, опыт после учений, состояние (переучка, учения) */
export function companyAt(mil: StateMilitary, c: Company, date: WorldDate) {
  const base = mil.templates.find((t) => t.id === c.t)
  const { tpl, rearm } = templateAt(mil, base, date)
  let xp = c.xp
  let train: Order | undefined
  for (const o of mil.orders ?? []) {
    if (o.kind !== 'train' || !o.companies?.includes(c.id)) continue
    if (orderEnd(o) <= date) xp += o.xp ?? 0
    else if (orderActive(o, date)) train = o
  }
  const r = companyStats({ ...c, xp }, tpl)
  if (rearm) for (const [k, v] of Object.entries(REARM_PENALTY) as [Stat, number][]) r.stats[k] = Math.max(0, r.stats[k] + v)
  return { ...r, tpl, xp, rearm, train }
}
