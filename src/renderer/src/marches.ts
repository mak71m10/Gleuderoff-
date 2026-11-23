// Калькулятор похода (docs/впи-армия.md § 15, этап 8): путь войска по областям — дороги, бездорожье, реки, горы,
// сезон, состав войска; сколько дней, сколько хлеба и марок, сколько людей отстанет и заболеет.
// Связи соседних областей (дорога, река без моста) — provinces[].links (scripts/province-links.mjs).
import { toParts } from './calendar'
import { ownerAt } from './provinces'
import { ARM, type Company, type CompanyTemplate, type StateMilitary } from './military'
import type { Province, WorldData, WorldDate } from './types'

/** масштаб карты: километров в единице мира (соседние области ≈ 25–30 км) */
export const KM_PER_UNIT = 0.4
export const TERRAIN_NAME: Record<number, string> = { 1: 'равнина', 2: 'лес', 3: 'холмы', 4: 'горы', 5: 'снега', 6: 'пустыня' }
/** км в день по бездорожью */
const OFFROAD: Record<number, number> = { 1: 18, 2: 12, 3: 12, 4: 7, 5: 5, 6: 12 }
const ROAD: Record<string, { name: string; km: number }> = { p: { name: 'мощёный тракт', km: 28 }, d: { name: 'грунтовка', km: 22 }, t: { name: 'тропа', km: 16 } }
const RIVER_DAYS: Record<string, number> = { r1: 0.5, r2: 1, r3: 2 }
/** потери в день (доля людей): болезни, отставшие, дезертиры */
const ATTRITION: Record<number, number> = { 1: 0.0004, 2: 0.0006, 3: 0.0007, 4: 0.002, 5: 0.003, 6: 0.0025 }
/** сезоны: множитель скорости по бездорожью и грунтовкам, множитель потерь */
const SEASON: { name: string; speed: number; road: number; loss: number; note: string }[] = [
  { name: 'зима', speed: 0.6, road: 0.8, loss: 2.2, note: 'снег и мороз: горные перевалы закрыты, потери вдвое больше' },
  { name: 'весна', speed: 0.75, road: 0.85, loss: 1.2, note: 'распутица: грунтовки и бездорожье раскисли' },
  { name: 'лето', speed: 1, road: 1, loss: 1, note: 'лучшее время для похода' },
  { name: 'жатва', speed: 1, road: 1, loss: 0.9, note: 'сухие дороги, в деревнях есть хлеб' },
  { name: 'поздняя осень', speed: 0.8, road: 0.9, loss: 1.4, note: 'дожди и холод, дороги портятся' }
]

export interface MarchStep { from: Province; to: Province; days: number; km: number; how: string; river?: string; foreign?: string }
export interface MarchPlan {
  ok: boolean
  reason?: string
  steps: MarchStep[]
  days: number; km: number
  arrive: WorldDate
  speedK: number
  speedWhy: string[]
  grain: number; marks: number
  losses: number
  foreign: string[]
  rivers: number
  season: string; seasonNote: string
  closed: string[]
}

/** скорость войска: самый медленный род, обоз, размер, сапёры */
export function armySpeed(mil: StateMilitary, ids: string[]): { k: number; why: string[]; sappers: boolean } {
  const tpl = new Map(mil.templates.map((t) => [t.id, t]))
  const cById = new Map(mil.companies.map((c) => [c.id, c]))
  let men = 0, horseMen = 0, slow = 1, slowWhy = '', sappers = false, wagons = false
  for (const id of ids) {
    const c = cById.get(id) as Company | undefined
    if (!c) continue
    const t = tpl.get(c.t) as CompanyTemplate | undefined
    const arm = ARM[t?.arm ?? 'line']
    men += c.men
    if (arm?.role === 'horse') horseMen += c.men
    if (arm?.key === 'siege' && slow > 0.65) { slow = 0.65; slowWhy = 'осадные машины' }
    if (arm?.key === 'cannon' && slow > 0.72) { slow = 0.72; slowWhy = 'пушки' }
    if (arm?.key === 'sappers') sappers = true
    if (t?.parts.train === 'wagons' || t?.parts.train === 'full') wagons = true
  }
  const why: string[] = []
  let k = 1
  if (men && horseMen / men > 0.9) { k = 1.5; why.push('одна конница: +50 %') }
  if (slow < 1) { k = Math.min(k, slow); why.push(`${slowWhy}: идут медленнее (×${slow})`) }
  if (wagons) { k *= 0.92; why.push('тяжёлый обоз: −8 %') }
  if (men > 5000) { const s = Math.max(0.6, 1 - 0.07 * Math.log2(men / 5000)); k *= s; why.push(`большое войско (${men.toLocaleString('ru-RU')}): ×${s.toFixed(2)}`) }
  if (sappers) why.push('сапёры: переправы вдвое быстрее')
  return { k, why, sappers }
}

/** путь и расчёт похода от области к области */
export function planMarch(world: WorldData, stateId: string, mil: StateMilitary, ids: string[], fromId: number, toId: number, date: WorldDate, men: number, perTurnCost: number): MarchPlan {
  const prov = new Map((world.provinces ?? []).map((p) => [p.id, p]))
  const month = Math.min(4, toParts(world.calendar, date).month)
  const S = SEASON[month]
  const sp = armySpeed(mil, ids)
  const edge = (a: Province, b: Province, mm = month): { days: number; km: number; how: string; river?: string } | null => {
    const S = SEASON[mm]
    const km = Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_UNIT
    const link = a.links?.[b.id]
    const closedPass = mm === 0 && (b.terrain === 4 || b.terrain === 5) && link !== 'p'
    if (closedPass) return null
    let speed: number, how: string
    if (link && ROAD[link]) {
      speed = Math.max(ROAD[link].km * (link === 'p' ? 1 : S.road), 2 / (1 / (OFFROAD[a.terrain] ?? 12) + 1 / (OFFROAD[b.terrain] ?? 12)) * S.speed)
      how = ROAD[link].name
    } else {
      speed = (2 / (1 / (OFFROAD[a.terrain] ?? 12) + 1 / (OFFROAD[b.terrain] ?? 12))) * S.speed
      how = `бездорожье: ${TERRAIN_NAME[b.terrain] ?? '—'}`
    }
    let days = km / (speed * sp.k)
    let river: string | undefined
    if (link && RIVER_DAYS[link]) { days += RIVER_DAYS[link] * (sp.sappers ? 0.5 : 1); river = link === 'r3' ? 'большая река' : link === 'r2' ? 'река' : 'речка' }
    return { days, km, how, river }
  }
  // Дейкстра по дням пути
  const dist = new Map<number, number>(), prev = new Map<number, number>(), done = new Set<number>()
  dist.set(fromId, 0)
  const heap: [number, number][] = [[0, fromId]]
  const push = (d: number, id: number): void => { heap.push([d, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
  const pop = (): [number, number] => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top }
  let closedSeen = false
  while (heap.length) {
    const [d, id] = pop()
    if (done.has(id)) continue
    done.add(id)
    if (id === toId) break
    const a = prov.get(id); if (!a) continue
    for (const nid of a.neighbors ?? []) {
      const b = prov.get(nid); if (!b || done.has(nid)) continue
      const e = edge(a, b)
      if (!e) { closedSeen = true; continue }
      // по чужой земле осторожнее: разведка и дозоры
      const own = ownerAt(b, date) === stateId
      const nd = d + e.days * (own ? 1 : 1.1)
      if (nd < (dist.get(nid) ?? Infinity)) { dist.set(nid, nd); prev.set(nid, id); push(nd, nid) }
    }
  }
  const empty = { steps: [], days: 0, km: 0, arrive: date, speedK: sp.k, speedWhy: sp.why, grain: 0, marks: 0, losses: 0, foreign: [], rivers: 0, season: S.name, seasonNote: S.note, closed: [] }
  if (!dist.has(toId)) return { ok: false, reason: closedSeen ? 'по суше не пройти: зимой горные перевалы закрыты' : 'по суше не дойти — нужен флот', ...empty }
  const path: number[] = []
  for (let x: number | undefined = toId; x != null; x = prev.get(x)) path.unshift(x)
  const steps: MarchStep[] = []
  const foreign = new Set<string>()
  let days = 0, km = 0, lossRate = 0, rivers = 0
  const later = new Set<string>()
  for (let i = 1; i < path.length; i++) {
    const a = prov.get(path[i - 1])!, b = prov.get(path[i])!
    // сезон — на день этого перехода (путь может перейти в следующий месяц)
    const mm = Math.min(4, toParts(world.calendar, date + Math.round(days * (7 / 6))).month)
    if (mm !== month) later.add(SEASON[mm].name)
    const e = edge(a, b, mm) ?? edge(a, b)!
    const owner = ownerAt(b, date)
    const fname = owner && owner !== stateId ? world.states.find((s) => s.id === owner)?.base.name : undefined
    if (fname) foreign.add(fname)
    if (e.river) rivers++
    steps.push({ from: a, to: b, days: e.days, km: e.km, how: e.how, river: e.river, foreign: fname })
    days += e.days; km += e.km
    lossRate += e.days * (ATTRITION[b.terrain] ?? 0.0006) * SEASON[mm].loss * (fname ? 1.5 : 1)
  }
  // день отдыха на шесть дней пути
  const total = Math.ceil(days * (7 / 6))
  const grain = (men * 1.1 * total) / 1000 // ≈ 1,1 кг хлеба и корма на человека в день
  const marks = (perTurnCost / 100) * total * 1.5 // походное жалованье и подвоз — полуторное содержание
  return { ok: true, steps, days: total, km: Math.round(km), arrive: date + total, speedK: sp.k, speedWhy: sp.why, grain: Math.round(grain), marks: Math.round(marks), losses: Math.round(men * Math.min(0.5, lossRate)), foreign: [...foreign], rivers, season: later.size ? `${S.name}, в пути — ${[...later].join(', ')}` : S.name, seasonNote: S.note, closed: [] }
}
