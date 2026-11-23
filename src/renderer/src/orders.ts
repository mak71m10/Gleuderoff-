// Приказы во времени (docs/впи-армия.md § 14): перевооружение после конструктора и учения.
// Всё считается на дату шкалы: до приказа рота — по старому уставу, во время — «в переучке» (слабее),
// после — по новому; учения добавляют опыт, когда закончатся.
import { ARM, companyStats, type Company, type CompanyTemplate, type Formation, type Mods, type Order, type Stat, type StateMilitary } from './military'
import type { WorldDate } from './types'
import type { StateEcon } from './economy'
import { journalAdd } from './economy'

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

// ---------- армия на дату (docs/ревизия-противоречий.md, п. А) ----------
// Правки войска — записями с датой: набор (from), роспуск (to), потери и опыт боя (losses), переходы (moves), число кораблей (changes).
// milAt собирает войско таким, каким оно было на дату; id рот и соединений те же, правки — по id в исходных данных.
const alive = (x: { from?: number; to?: number }, date: WorldDate): boolean => (x.from == null || x.from <= date) && (x.to == null || date < x.to)
const milCache = new WeakMap<StateMilitary, Map<number, StateMilitary>>()
export function milAt(mil: StateMilitary, date: WorldDate): StateMilitary
export function milAt(mil: StateMilitary | undefined, date: WorldDate): StateMilitary | undefined
export function milAt(mil: StateMilitary | undefined, date: WorldDate): StateMilitary | undefined {
  if (!mil) return mil
  let per = milCache.get(mil)
  if (!per) milCache.set(mil, (per = new Map()))
  const hit = per.get(date)
  if (hit) return hit
  const companies: Company[] = []
  for (const c of mil.companies) {
    if (!alive(c, date)) continue
    const ls = (c.losses ?? []).filter((l) => l.date <= date)
    if (!ls.length) { companies.push(c); continue }
    const men = c.men - ls.reduce((s, l) => s + l.n, 0)
    if (men > 0) companies.push({ ...c, men, xp: c.xp + ls.reduce((s, l) => s + (l.xp ?? 0), 0) })
  }
  const cIds = new Set(companies.map((c) => c.id))
  const fAlive = mil.formations.filter((f) => alive(f, date))
  const fIds = new Set(fAlive.map((f) => f.id))
  const formations = fAlive.map((f) => {
    const mv = (f.moves ?? []).filter((x) => x.date <= date).sort((a, b) => a.date - b.date).pop()
    const comp = f.companies?.filter((id) => cIds.has(id))
    const ch = f.children.filter((id) => fIds.has(id))
    return mv || comp?.length !== f.companies?.length || ch.length !== f.children.length ? { ...f, base: mv ? mv.base : f.base, companies: comp, children: ch } : f
  })
  let navy = mil.navy
  if (navy && navy.squadrons.some((s) => s.from != null || s.to != null || s.changes?.length)) {
    const sq = navy.squadrons.filter((s) => alive(s, date)).map((s) => { const ch = (s.changes ?? []).filter((x) => x.date <= date).sort((a, b) => a.date - b.date).pop(); return ch ? { ...s, count: ch.count } : s }).filter((s) => s.count > 0)
    const ids = new Set(sq.map((s) => s.id))
    navy = { ...navy, squadrons: sq, fleets: navy.fleets.map((f) => ({ ...f, squadrons: f.squadrons.filter((id) => ids.has(id)) })) }
  }
  const out: StateMilitary = { ...mil, companies, formations, roots: mil.roots.filter((id) => fIds.has(id)), navy }
  if (per.size > 16) per.clear()
  per.set(date, out)
  return out
}

/** внести итог боя записями с датой: потери и опыт рот, потерянные корабли эскадр; mil — исходные данные (черновик) */
export function recordBattle(mil: StateMilitary, date: WorldDate, byUnit: Map<string, number>, won: boolean, squadrons: string[], shipsLost: number, ships: number, note: string, econ?: StateEcon, dead = 0): void {
  if (econ && dead > 0) (econ.deaths ??= []).push({ date, n: Math.round(dead), note })
  const now = milAt(mil, date)
  const menNow = new Map(now.companies.map((c) => [c.id, c.men]))
  for (const c of mil.companies) {
    const loss = byUnit.get(c.id)
    if (!loss) continue
    const left = (menNow.get(c.id) ?? c.men) - loss
    // опыт — тем, кто выжил ротой (хотя бы треть); разбитые роты опыта не набирают
    const xp = left >= (menNow.get(c.id) ?? c.men) / 3 ? (won ? 3 : 1) : 0
    ;(c.losses ??= []).push({ date, n: Math.min(loss, (menNow.get(c.id) ?? c.men) - 5), xp, note })
  }
  if (mil.navy && shipsLost) {
    let left = shipsLost
    for (const q of mil.navy.squadrons) {
      if (!squadrons.includes(q.id) || left <= 0) continue
      const cur = now.navy?.squadrons.find((s) => s.id === q.id)?.count ?? q.count
      const k = Math.min(cur, left, Math.ceil((shipsLost * cur) / Math.max(1, ships)))
      ;(q.changes ??= []).push({ date, count: cur - k, note })
      left -= k
    }
  }
}

/** внести поход: потери в пути (больные, отставшие, дезертиры) — по ротам пропорционально, умершие — из населения,
 *  хлеб — из амбаров (половина расчётного: остальное солдаты съели бы и дома), надбавка походного жалованья и подвоза — в журнал казны */
export function recordMarch(mil: StateMilitary, econ: StateEcon | undefined, date: WorldDate, ids: string[], plan: { losses: number; grain: number; marks: number; arrive: number }, note: string): void {
  const now = milAt(mil, date)
  const men = new Map(now.companies.map((c) => [c.id, c.men]))
  const total = ids.reduce((s, id) => s + (men.get(id) ?? 0), 0)
  if (plan.losses > 0 && total > 0) for (const c of mil.companies) {
    if (!ids.includes(c.id)) continue
    const n = Math.min((men.get(c.id) ?? c.men) - 5, Math.round((plan.losses * (men.get(c.id) ?? 0)) / total))
    if (n > 0) (c.losses ??= []).push({ date: plan.arrive, n, note })
  }
  if (!econ) return
  if (plan.losses > 0) (econ.deaths ??= []).push({ date: plan.arrive, n: Math.round(plan.losses * 0.4), note })
  if (plan.grain > 0) (econ.drawn ??= []).push({ date, qty: Math.round((plan.grain / 2.2) * 0.5), note })
  // обычное содержание уже в бюджете хода; поход стоит полуторного — надбавка (треть расчёта) разово
  if (plan.marks > 0) journalAdd(econ, date, -Math.round(plan.marks / 3), `надбавка похода: ${note}`, 'order')
}
