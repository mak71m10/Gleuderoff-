/**
 * Расчёт экономики ВПИ на любую дату (ход = месяц) — общий для вкладки и окна экономики, панелей карты и расчёта хода.
 * Что зависит от даты:
 *  - территория: провинции, которыми страна владеет на эту дату (история владельцев провинций);
 *  - население: от нынешнего назад во времени (рост ≈ 0,3 % в год) с провалами от войн, бедствий и восстаний;
 *  - события года (войны, битвы, осады, набеги, восстания, бедствия, стройки, открытия, договоры) — множители выпуска,
 *    податей, довольства и расходов на войско; войны и бедствия видно в отчёте списком;
 *  - месяц (сезон): хлеб приходит с жатвой в Лаций, скот — в Драгос, рыба круглый год, амбары пустеют к Алпрасу.
 * Всё в имперских марках и «мерах» товара.
 */
import { GOOD, GOODS, type Good, type Role } from './economy'
import { ownerAt } from './provinces'
import { armyLedger, type Ledger } from './armyLedger'
import { toParts } from './calendar'
import type { AdminRegion, Entry, Province, WorldData, WorldDate, WorldState } from './types'

/** выпуск меры товара на 1000 жителей провинции за ход при богатстве 1 (в среднем за год) */
export const YIELD: Record<Good, number> = {
  grain: 30, fish: 26, cattle: 18, wood: 9, stone: 6, iron: 3.5, copper: 2.5, silver: 0.7, salt: 3.5, coal: 5,
  saltpetre: 0.8, furs: 1.2, horses: 0.5, cloth: 0, tools: 0, arms: 0, powder: 0, wine: 4, luxury: 0.5, reagents: 0.3
}
/** свой хлеб кормильцев: мер на 1000 кормильцев за ход по местности (поле и огород у каждого двора) */
const FARM: Record<number, number> = { 1: 62, 2: 44, 3: 52, 4: 30, 5: 14, 6: 22 }
/** еда: сколько «мер продовольствия» в одной мере товара */
export const FOOD: Partial<Record<Good, number>> = { grain: 1, fish: 0.9, cattle: 1.6 }
/** человек съедает за ход 0,05 меры продовольствия (мера кормит 20 человек месяц) */
export const EAT = 0.05

/** сезон по месяцу (0 Ячори … 4 Драгос): доля годового хлеба, рыбы, скота за этот месяц ×5 и запас амбаров */
export const SEASONS = [
  { name: 'Ячори', season: 'зима', grain: 0, fish: 0.6, cattle: 0.5, stock: 0.7, note: 'Хлеб только из амбаров, северные моря закрыты.' },
  { name: 'Фраул', season: 'весна, посев', grain: 0, fish: 1.1, cattle: 0.6, stock: 0.45, note: 'Посев: семенной хлеб уходит в землю, навигация открывается.' },
  { name: 'Алпрас', season: 'лето', grain: 0.6, fish: 1.3, cattle: 0.8, stock: 0.25, note: 'Амбары почти пусты до жатвы; лучшее время для торговли и походов.' },
  { name: 'Лаций', season: 'жатва', grain: 3.4, fish: 1.1, cattle: 0.9, stock: 1, note: 'Урожай года приходит в амбары, ярмарки, подушная подать.' },
  { name: 'Драгос', season: 'поздняя осень', grain: 1, fish: 0.9, cattle: 2.2, stock: 0.95, note: 'Забой скота, запасы на зиму, последние корабли.' }
]

/** потребление на 1000 человек роли за ход (кроме еды) */
const NEEDS: Record<Role, Partial<Record<Good, number>>> = {
  feeders: { cloth: 2, tools: 0.4, salt: 1.2, wood: 3 },
  makers: { cloth: 4, tools: 2, salt: 1.5, wood: 4, coal: 1.5, iron: 2, wine: 0.6 },
  rulers: { cloth: 12, wine: 10, luxury: 4, horses: 1.5, arms: 1, furs: 2 },
  servants: { cloth: 4, wine: 2, luxury: 0.5 },
  learned: { cloth: 5, tools: 3, luxury: 1, reagents: 1.5, wine: 2 },
  unfree: { cloth: 0.8, salt: 0.8 }
}
/** мастера (горожане) сами делают изделия на 1000 человек за ход; шестерня ускоряет */
const CRAFT: Partial<Record<Good, number>> = { cloth: 9, tools: 2.6, arms: 0.8 }
/** мануфактуры областей: что дают за ход */
const BUILD_OUT: Record<string, Partial<Record<Good, number>>> = {
  'ткацкая мануфактура': { cloth: 160 }, 'литейный двор': { arms: 40, tools: 30 }, 'мельница': { grain: 120 }, 'пивоварня': { wine: 40 },
  'типография': { luxury: 4 }
}
/** подать с 1000 человек роли за ход при «обычных» податях, марки */
const TAX: Record<Role, number> = { feeders: 1.1, makers: 4.5, rulers: 7, servants: 0, learned: 2, unfree: 0.2 }
export const TAX_MULT: Record<string, number> = { 'лёгкие': 0.6, 'обычные': 1, 'тяжёлые': 1.5, 'разорительные': 2.2 }
export const TAX_CONTENT:Record<string, number> = { 'лёгкие': 8, 'обычные': 0, 'тяжёлые': -10, 'разорительные': -22 }

// ---------- события и их след в экономике ----------
type Kind = 'war' | 'raid' | 'unrest' | 'disaster' | 'boom' | 'deal'
const KIND: [RegExp, Kind][] = [
  [/войн|битв|осад|штурм|сожжен|резн|святой поход|измена и взятие/i, 'war'],
  [/набег/i, 'raid'],
  [/восстан|бунт|мятеж|революц|переворот|забастов|террор|теракт|заговор/i, 'unrest'],
  [/бедств|кризис|голод|чума|мор|пожар|неурож|происшеств/i, 'disaster'],
  [/строит|открыт|наук|реформ|основан|учрежд|экономик/i, 'boom'],
  [/торгов|договор|переговор|присяг|объединен/i, 'deal']
]
/** как событие меняет хозяйство и сколько лет держится след */
const EFFECT: Record<Kind, { prod: number; tax: number; content: number; army: number; pop: number; years: number; word: string }> = {
  war: { prod: -0.16, tax: -0.1, content: -8, army: 0.8, pop: -0.025, years: 3, word: 'война' },
  raid: { prod: -0.05, tax: -0.04, content: -3, army: 0.15, pop: -0.004, years: 1, word: 'набег' },
  unrest: { prod: -0.08, tax: -0.15, content: -12, army: 0.25, pop: -0.006, years: 2, word: 'смута' },
  disaster: { prod: -0.2, tax: -0.12, content: -10, army: 0, pop: -0.04, years: 2, word: 'бедствие' },
  boom: { prod: 0.05, tax: 0.04, content: 3, army: 0, pop: 0.004, years: 6, word: 'подъём' },
  deal: { prod: 0.02, tax: 0.03, content: 1, army: 0, pop: 0, years: 4, word: 'торговля' }
}
export interface EconEvent { id: string; year: number; name: string; kind: Kind; word: string; age: number }

const yearOf = (d: number | null | undefined, len: number): number => (d == null ? 0 : Math.floor(d / len) + 1)

// события мира, разобранные один раз: вид, годы начала и конца, теги
let evWorld: WorldData | null = null
let evList: { id: string; name: string; tags: string[]; kind: Kind; y0: number; y1: number; low: string }[] = []
function eventsOf(world: WorldData) {
  if (evWorld === world) return evList
  const len = world.calendar.months.reduce((s, m) => s + m.days, 0)
  evList = []
  for (const e of world.entries as Entry[]) {
    if (e.kind !== 'event' || e.from == null) continue
    const kind = KIND.find(([re]) => re.test(`${e.base.props?.type ?? ''} ${e.base.name}`))?.[1]
    if (!kind) continue
    const y0 = yearOf(e.from, len)
    evList.push({ id: e.id, name: e.base.name, tags: e.base.tags ?? [], kind, y0, y1: e.to != null ? yearOf(e.to, len) : y0, low: e.base.name.toLowerCase() })
  }
  evWorld = world
  return evList
}

/** состояние хозяйства страны на год: множители и список действующих событий */
export function condition(world: WorldData, st: WorldState, year: number) {
  const names = new Set([st.base.name, ...st.history.map((h) => (h.patch as { name?: string }).name).filter(Boolean) as string[]])
  // события без тегов: по корню названия страны в имени события («Гражданская война в Империи»)
  const roots = [...names].map((n) => n.split(/s+/).filter((w) => w.length > 4).map((w) => w.slice(0, Math.max(5, w.length - 2)).toLowerCase())).flat()
  let prod = 1, tax = 1, content = 0, army = 1, popShock = 0
  const active: EconEvent[] = []
  for (const e of eventsOf(world)) {
    const tagged = e.tags.some((t) => names.has(t))
    if (!tagged && !(e.tags.length === 0 && roots.some((r) => e.low.includes(r)))) continue
    const { y0, y1, kind } = e
    const ef = EFFECT[kind]
    // провалы населения от событий, которые случатся позже этого года, «ещё не наступили»
    if (y0 > year) popShock += ef.pop
    if (year < y0 || year > y1 + ef.years) continue
    // во время события — полная сила, после — затухает за ef.years лет
    const k = year <= y1 ? 1 : 1 - (year - y1) / (ef.years + 1)
    prod *= 1 + ef.prod * k; tax *= 1 + ef.tax * k; content += ef.content * k; army *= 1 + ef.army * k
    active.push({ id: e.id, year: y0, name: e.name, kind, word: ef.word, age: year - y0 })
  }
  // население: от нынешнего (1010) назад — рост 0,3 % в год, но до будущих войн и бедствий людей было больше
  const popFactor = Math.max(0.3, Math.min(1.25, Math.pow(1 - 0.003, Math.max(0, 1010 - year)) * (1 - popShock * 0.6)))
  return { prod: Math.max(0.4, prod), tax: Math.max(0.4, tax), content: Math.max(-35, content), army: Math.min(2.2, army), popFactor, active: active.sort((a, b) => b.year - a.year) }
}

export interface Line { name: string; amount: number; note?: string }
export interface TradePartner { id: string; name: string; color: string; exports: { good: Good; amount: number }[]; imports: { good: Good; amount: number }[]; value: number; by: 'суша' | 'море' | 'рынок Каяи' }
export interface EconReport {
  year: number
  month: number
  season: (typeof SEASONS)[number]
  pop: number
  byRole: Partial<Record<Role, number>>
  byRace: Record<string, number>
  production: Partial<Record<Good, number>>
  consumption: Partial<Record<Good, number>>
  food: { stock: number; need: number; produced: number; yearPct: number; months: number; kinds: { good: Good; amount: number }[] }
  income: Line[]
  expense: Line[]
  net: number
  treasury: number
  soldiers: number
  /** казна войска: статьи, утечки, меры (если у страны есть роты) */
  ledger?: Ledger
  ships: number
  content: Partial<Record<Role, number>>
  events: EconEvent[]
  provinces: number
  areas: number
  neighbors: string[]
  trade: TradePartner[]
}

/** численность войска из текста: самое большое «N тыс.» (общая численность), иначе самое большое число ≥ 100 */
export function armySize(text: string | undefined): number {
  const t = String(text ?? '')
  const big = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(тыс|млн)/gi)].map((m) => parseFloat(m[1].replace(',', '.')) * (/млн/i.test(m[2]) ? 1e6 : 1e3))
  if (big.length) return Math.round(Math.max(...big))
  const plain = [...t.replace(/(\d)\s(\d{3})/g, '$1$2').matchAll(/\d{3,}/g)].map((m) => +m[0]).filter((n) => n >= 100 && n < 1e6)
  return plain.length ? Math.max(...plain) : 0
}
const shipCount = (text: string | undefined): number => {
  const m = String(text ?? '').match(/(\d+)\s*(?:корабл|судов|кораблей|вымпел|галер)/i)
  return m ? +m[1] : 0
}

/** провинции страны на дату */
export function provincesOf(world: WorldData, stateId: string, date?: WorldDate): Province[] {
  return (world.provinces ?? []).filter((p) => (date == null ? p.owners?.at(-1)?.[1] : ownerAt(p, date)) === stateId)
}

const ownerIdx = new WeakMap<Map<string, Province[]>, Map<number, string>>()
function ownerIndex(owned: Map<string, Province[]>): Map<number, string> {
  let m = ownerIdx.get(owned)
  if (!m) { m = new Map(); for (const [o, ps] of owned) for (const p of ps) m.set(p.id, o); ownerIdx.set(owned, m) }
  return m
}

// кэш отчётов на дату: все страны мира считаются вместе (нужно для торговли)
let cacheWorld: WorldData | null = null
const cache = new Map<number, Map<string, EconReport>>()

/** отчёт по стране на дату (по умолчанию — 1010 г., Ячори) */
export function stateReport(world: WorldData, st: WorldState, date?: WorldDate): EconReport | null {
  return worldReports(world, date ?? 1009 * 500).get(st.id) ?? null
}

export function worldReports(world: WorldData, date: WorldDate): Map<string, EconReport> {
  if (cacheWorld !== world) { cache.clear(); cacheWorld = world }
  const hit = cache.get(date)
  if (hit) return hit
  const parts = toParts(world.calendar, date)
  const year = parts.year, month = Math.min(4, parts.month), S = SEASONS[month]
  const areaById = new Map((world.adminRegions ?? []).map((a) => [a.id, a]))
  const owned = new Map<string, Province[]>()
  const areaPop = new Map<string, number>()
  for (const p of world.provinces ?? []) {
    areaPop.set(p.areaId, (areaPop.get(p.areaId) ?? 0) + (p.pop ?? 0))
    const o = ownerAt(p, date)
    if (o) (owned.get(o) ?? owned.set(o, []).get(o)!).push(p)
  }
  const reports = new Map<string, EconReport>()
  for (const st of world.states) {
    const provs = owned.get(st.id)
    if (!st.base.econ || !provs?.length) continue
    reports.set(st.id, one(world, st, provs, owned, areaById, areaPop, year, month, S, date))
  }
  trade(world, reports, owned)
  cache.set(date, reports)
  if (cache.size > 12) cache.delete(cache.keys().next().value!)
  return reports
}

function one(world: WorldData, st: WorldState, provs: Province[], owned: Map<string, Province[]>, areaById: Map<string, AdminRegion>, areaPop: Map<string, number>, year: number, month: number, S: (typeof SEASONS)[number], date: WorldDate): EconReport {
  const e = st.base.econ!
  const cond = condition(world, st, year)
  const tech = st.base.tech?.levels
  const gearMul = 1 + (tech?.gear ?? 1) * 0.1
  const production: Partial<Record<Good, number>> = {}, consumption: Partial<Record<Good, number>> = {}
  const byRole: Partial<Record<Role, number>> = {}, byRace: Record<string, number> = {}, contentW: Partial<Record<Role, number>> = {}
  let pop = 0, stock = 0, grainYear = 0
  const share = new Map<string, number>(), byArea = new Map<string, Province[]>()
  for (const p of provs) { share.set(p.areaId, (share.get(p.areaId) ?? 0) + (p.pop ?? 0)); (byArea.get(p.areaId) ?? byArea.set(p.areaId, []).get(p.areaId)!).push(p) }
  const seasonK: Partial<Record<Good, number>> = { grain: S.grain, fish: S.fish, cattle: S.cattle }
  for (const p of provs) if (p.res && p.pop) {
    const v = (YIELD[p.res.good] * p.res.rich * p.pop * cond.popFactor * cond.prod) / 1000
    production[p.res.good] = (production[p.res.good] ?? 0) + v * (seasonK[p.res.good] ?? 1)
    if (p.res.good === 'grain') grainYear += v
  }
  let nb = 0
  for (const [aid, ownPop] of share) {
    const a = areaById.get(aid)
    if (!a?.econ) continue
    const k = (ownPop / Math.max(1, areaPop.get(aid) ?? 1)) * cond.popFactor
    const ap = byArea.get(aid)!
    const farm = ap.reduce((x, p) => x + (FARM[p.terrain] ?? 40), 0) / Math.max(1, ap.length)
    let feeders = 0
    for (const [race, row] of Object.entries(a.econ.pop)) for (const [r, n0] of Object.entries(row) as [Role, number][]) {
      const n = n0 * k
      byRole[r] = (byRole[r] ?? 0) + n; byRace[race] = (byRace[race] ?? 0) + n; pop += n
      contentW[r] = (contentW[r] ?? 0) + n * (a.econ.content[r] ?? 50)
      if (r === 'feeders') feeders += n
      if (r === 'unfree') feeders += n * 0.6
      for (const [g, v] of Object.entries(NEEDS[r]) as [Good, number][]) consumption[g] = (consumption[g] ?? 0) + (v * n) / 1000
      if (r === 'makers') for (const [g, v] of Object.entries(CRAFT) as [Good, number][]) production[g] = (production[g] ?? 0) + (v * n * gearMul * cond.prod) / 1000
    }
    const farmYear = (farm * feeders * cond.prod) / 1000
    production.grain = (production.grain ?? 0) + farmYear * S.grain
    grainYear += farmYear
    if (k > 0.5) for (const b of a.econ.buildings) { nb++; for (const [g, v] of Object.entries(BUILD_OUT[b] ?? {}) as [Good, number][]) production[g] = (production[g] ?? 0) + v * gearMul * cond.prod }
    stock += a.econ.granary * k
  }
  const need = pop * EAT
  const produced = (Object.entries(FOOD) as [Good, number][]).reduce((s, [g, kk]) => s + (production[g] ?? 0) * kk, 0)
  const yearAvg = grainYear + ((production.fish ?? 0) / Math.max(0.01, S.fish)) * 0.9 + ((production.cattle ?? 0) / Math.max(0.01, S.cattle)) * 1.6
  const kinds = (Object.keys(FOOD) as Good[]).map((g) => ({ good: g, amount: Math.round((production[g] ?? 0) * (FOOD[g] ?? 1)) })).filter((x) => x.amount > 0)
  const stockNow = stock * S.stock * Math.min(1.3, Math.max(0.3, yearAvg / Math.max(1, need)))
  const deficit = need - produced
  const months = deficit > 0 ? stockNow / deficit : Infinity

  const content = Object.fromEntries(Object.entries(contentW).map(([r, w]) => [r, Math.max(0, Math.min(100, Math.round(w! / Math.max(1, byRole[r as Role] ?? 1) + cond.content + (TAX_CONTENT[e.taxes[r as Role] ?? 'обычные'] ?? 0))))])) as Partial<Record<Role, number>>

  const income: Line[] = [], expense: Line[] = []
  let taxSum = 0
  for (const [role, n] of Object.entries(byRole) as [Role, number][]) {
    const v = ((TAX[role] * n * (TAX_MULT[e.taxes[role] ?? 'обычные'] ?? 1) * cond.tax) / 1000) * (role === 'feeders' && month === 3 ? 1.6 : 1)
    taxSum += v
    if (v > 0.5) income.push({ name: `Подати: ${e.estates[role] ?? role}`, amount: Math.round(v), note: `${e.taxes[role] ?? 'обычные'}${role === 'feeders' && month === 3 ? ', подушная в Лаций' : ''}` })
  }
  const crown = ['silver', 'salt', 'copper', 'saltpetre'].reduce((s, g) => s + (production[g as Good] ?? 0) * GOOD[g as Good].price, 0) * 0.12
  if (crown > 1) income.push({ name: 'Коронные промыслы', amount: Math.round(crown), note: '12 % серебра, соли, меди, селитры' })
  for (const sp of e.special ?? []) (sp.kind === 'income' ? income : expense).push({ name: sp.name, amount: Math.round(sp.amount * (sp.kind === 'income' ? cond.tax : 1)), note: sp.text })

  const cc: Record<string, number> = {}
  for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'imperial'
  const ADMIN: Record<string, number> = { orcish: 0.35, nordic: 0.65, eluin: 0.65, elven: 0.75, dark: 0.5, zlatay: 0.8, desert: 0.85 }
  const nAreas = share.size
  expense.push({ name: 'Содержание областей', amount: Math.round((nAreas * 12 + pop * 0.0008) * (ADMIN[cult] ?? 1)), note: `${nAreas} областей: наместники, суды, дороги, стража` })
  expense.push({ name: 'Двор и канцелярия', amount: Math.round(Math.min(40, 10 + taxSum * 0.15) + taxSum * 0.18) })
  expense.push({ name: 'Сбор податей', amount: Math.round(taxSum * 0.08), note: 'сборщики, откупщики, потери в дороге' })
  // войско: если у страны есть роты (военная система) — люди и содержание из них, иначе из текста армии
  const mil = st.base.military
  // казна войска (armyLedger.ts): статьи, утечки, меры; без рот — по тексту армии
  const ledger: Ledger | undefined = mil ? armyLedger(world, st, mil, { date, pop, cult, war: cond.army > 1.2, provs, byRole }) : undefined
  const milMen = ledger?.men ?? 0
  if (ledger) {
    for (const l of ledger.income) income.push({ name: l.name, amount: l.amount, note: l.note })
    for (const [r, v] of Object.entries(ledger.content) as [Role, number][]) if (content[r] != null) content[r] = Math.max(0, Math.min(100, content[r]! + v))
  }
  const soldiers = Math.round((mil ? milMen : armySize(st.base.army)) * Math.min(2, cond.army))
  const ships = shipCount(st.base.navy)
  if (soldiers) expense.push({ name: cond.army > 1.2 ? 'Армия (военное время)' : 'Армия', amount: ledger ? ledger.total : Math.round(soldiers * 0.045 * Math.max(1, cond.army * 0.8)), note: `≈ ${soldiers.toLocaleString('ru-RU')} человек${ledger ? `, ${mil!.companies.length} рот; на жалованье ${ledger.standing.toLocaleString('ru-RU')}, остальные — ${mil!.law.level === 'мир' ? 'по домам' : mil!.law.level}` : ''}` })
  if (ships) expense.push({ name: 'Флот', amount: Math.round(ships * 4), note: `≈ ${ships} кораблей` })
  if (nb) expense.push({ name: 'Постройки и мануфактуры', amount: nb * 6, note: `${nb} построек` })
  for (const d of e.debts) expense.push({ name: `Проценты: ${d.to}`, amount: Math.round(d.sum * d.rate), note: `долговая печать на ${Math.round(d.sum).toLocaleString('ru-RU')} мар., срок ${d.due} г.` })

  // соседи по суше на дату — для торговли
  const neighbors = new Set<string>()
  const ownerOf = ownerIndex(owned)
  for (const p of provs) for (const nid of p.neighbors ?? []) { const o = ownerOf.get(nid); if (o && o !== st.id) neighbors.add(o) }

  const net = income.reduce((s, l) => s + l.amount, 0) - expense.reduce((s, l) => s + l.amount, 0)
  const treasury = Math.round(e.treasury * Math.min(1.2, Math.max(0.15, cond.popFactor * cond.tax)))
  return {
    year, month, season: S, pop, byRole, byRace, production, consumption,
    food: { stock: stockNow, need, produced, yearPct: Math.round((100 * yearAvg) / Math.max(1, need)), months, kinds },
    income, expense, net, treasury, ledger, soldiers, ships, content, events: cond.active, provinces: provs.length, areas: nAreas, neighbors: [...neighbors], trade: []
  }
}

// ---------- торговля: излишки уходят соседям, морем и на рынок Каяи ----------
function trade(world: WorldData, reports: Map<string, EconReport>, owned: Map<string, Province[]>) {
  const FOODS = new Set<Good>(['grain', 'fish', 'cattle'])
  const surplus = new Map<string, Partial<Record<Good, number>>>(), deficit = new Map<string, Partial<Record<Good, number>>>()
  for (const [id, r] of reports) {
    const s: Partial<Record<Good, number>> = {}, d: Partial<Record<Good, number>> = {}
    for (const g of GOODS) {
      // еда — по годовому балансу; остальное — выпуск минус потребление за ход
      const made = FOODS.has(g.key) ? (r.food.yearPct > 105 ? ((r.production[g.key] ?? 0) * (r.food.yearPct - 100)) / r.food.yearPct : 0) : (r.production[g.key] ?? 0) - (r.consumption[g.key] ?? 0)
      const want = g.key === 'grain' ? (r.food.yearPct < 95 ? (r.food.need * (100 - r.food.yearPct)) / 100 : 0) : FOODS.has(g.key) ? 0 : (r.consumption[g.key] ?? 0) - (r.production[g.key] ?? 0)
      if (made > 0.5) s[g.key] = made
      else if (want > 0.5) d[g.key] = want
    }
    surplus.set(id, s); deficit.set(id, d)
  }
  const coastal = new Set([...owned].filter(([, ps]) => ps.some((p) => p.coastal)).map(([id]) => id))
  const kaya = world.states.find((s) => s.base.name === 'Семья Каяя')
  const stById = new Map(world.states.map((s) => [s.id, s]))
  for (const [id, r] of reports) {
    const st = stById.get(id)!
    const partners: TradePartner[] = []
    const cand = new Set(r.neighbors)
    if (coastal.has(id)) for (const o of coastal) if (o !== id && (reports.get(o)?.pop ?? 0) > 150000) cand.add(o)
    for (const o of cand) {
      const ro = reports.get(o)
      if (!ro || (kaya && o === kaya.id)) continue
      const by: TradePartner['by'] = r.neighbors.includes(o) ? 'суша' : 'море'
      const w = by === 'суша' ? 0.35 : 0.2
      const ex: { good: Good; amount: number }[] = [], im: { good: Good; amount: number }[] = []
      for (const [g, v] of Object.entries(surplus.get(id)!) as [Good, number][]) { const need = deficit.get(o)![g]; if (need) ex.push({ good: g, amount: Math.min(v, need) * w }) }
      for (const [g, v] of Object.entries(deficit.get(id)!) as [Good, number][]) { const has = surplus.get(o)![g]; if (has) im.push({ good: g, amount: Math.min(v, has) * w }) }
      const value = [...ex, ...im].reduce((s, x) => s + x.amount * GOOD[x.good].price, 0)
      if (value < 5) continue
      const so = stById.get(o)!
      const top4 = (a: { good: Good; amount: number }[]) => a.filter((x) => x.amount > 0.5).sort((x, y) => y.amount * GOOD[y.good].price - x.amount * GOOD[x.good].price).slice(0, 4)
      partners.push({ id: o, name: so.base.name, color: so.base.color, exports: top4(ex), imports: top4(im), value, by })
    }
    partners.sort((a, b) => b.value - a.value)
    const top = partners.slice(0, 6)
    // остаток излишков — на рынок Каяи (через конторы, с комиссией)
    const sur = Object.entries(surplus.get(id)!) as [Good, number][]
    const rest = sur.reduce((s, [g, v]) => s + v * GOOD[g].price * 0.2, 0)
    if (kaya && id !== kaya.id && rest > 20) top.push({ id: kaya.id, name: 'Рынок Каяи', color: kaya.base.color, exports: sur.sort((a, b) => b[1] * GOOD[b[0]].price - a[1] * GOOD[a[0]].price).slice(0, 4).map(([g, v]) => ({ good: g, amount: v * 0.2 })), imports: [], value: rest, by: 'рынок Каяи' })
    r.trade = top
    const turnover = top.reduce((s, p) => s + p.value, 0)
    const money = st.base.tech?.levels.money ?? 1
    const duty = Math.round(turnover * 0.06 * (0.7 + money * 0.15))
    r.income.push({ name: 'Пошлины и торговля', amount: duty, note: `оборот ≈ ${Math.round(turnover).toLocaleString('ru-RU')} мар. за ход` })
    r.net += duty
  }
}

/** продовольствие страны по пяти месяцам года (свой выпуск к нужде, %), без пересчёта всего мира */
export function foodByMonth(world: WorldData, st: WorldState, date: WorldDate): number[] {
  const y = toParts(world.calendar, date).year
  const len = world.calendar.months.reduce((s, m) => s + m.days, 0)
  const areaById = new Map((world.adminRegions ?? []).map((a) => [a.id, a]))
  const owned = new Map<string, Province[]>(), areaPop = new Map<string, number>()
  const d0 = (y - 1) * len + 10
  for (const p of world.provinces ?? []) { areaPop.set(p.areaId, (areaPop.get(p.areaId) ?? 0) + (p.pop ?? 0)); const o = ownerAt(p, d0); if (o) (owned.get(o) ?? owned.set(o, []).get(o)!).push(p) }
  const provs = owned.get(st.id)
  if (!provs || !st.base.econ) return SEASONS.map(() => 0)
  return SEASONS.map((S, m) => { const r = one(world, st, provs, owned, areaById, areaPop, y, m, S, date); return Math.round((100 * r.food.produced) / Math.max(1, r.food.need)) })
}
