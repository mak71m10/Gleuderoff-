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
import { relationAt } from './diplomacy'
import { milAt } from './orders'
import { GOOD, GOODS, type Good, type Role } from './economy'
import { ownerAt } from './provinces'
import { armyLedger, type Ledger } from './armyLedger'
import { taxesAt } from './decisions'
import { squadronStats } from './fleet'
import { computeMarket, contractsOf, contractOn, type MarketReport } from './market'
import { fromParts, toParts } from './calendar'
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
  // население: рост 0,3 % в год (от 1010 г. назад — меньше, вперёд — больше), но до будущих войн и бедствий людей было больше
  const popFactor = Math.max(0.3, Math.min(1.4, Math.pow(1.003, year - 1010) * (1 - popShock * 0.6)))
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
  /** доля рабочих рук дома (войско и призыв забирают остальных); сколько людей оторвано */
  work?: number; away?: number
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
const marketOf = new WeakMap<Map<string, EconReport>, MarketReport>()
/** рынок на дату (цены, спрос и предложение, кто продаёт и покупает) */
export function marketAt(world: WorldData, date: WorldDate): MarketReport { return marketOf.get(worldReports(world, date))! }

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
  // живой рынок на дату: цены из спроса и предложения мира, войн и потрясений; торговля считается по ним
  const market = computeMarket(world, date, reports)
  marketOf.set(reports, market)
  limitConsumption(reports, market.price)
  trade(world, reports, owned, market.price, date)
  tribute(world, reports, date)
  cache.set(date, reports)
  if (cache.size > 12) cache.delete(cache.keys().next().value!)
  return reports
}

function one(world: WorldData, st: WorldState, provs: Province[], owned: Map<string, Province[]>, areaById: Map<string, AdminRegion>, areaPop: Map<string, number>, year: number, month: number, S: (typeof SEASONS)[number], date: WorldDate): EconReport {
  const e = st.base.econ!
  const cond0 = condition(world, st, year)
  // с начала игры войну задаёт дипломатия (вид отношений «война» на дату); события лора — только для прошлого
  const present = world.calendar.present
  const warRel = date >= present && (world.relations ?? []).some((r) => r.kind === 'war' && (r.a === st.id || r.b === st.id) && r.from <= date && (r.to == null || date < r.to))
  const cond = date >= present ? { ...cond0, army: warRel ? Math.max(1.5, cond0.army) : Math.min(1.15, cond0.army) } : cond0
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
  let nb = 0, farmYearAll = 0
  const craftOut: Partial<Record<Good, number>> = {}
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
      if (r === 'makers') for (const [g, v] of Object.entries(CRAFT) as [Good, number][]) craftOut[g] = (craftOut[g] ?? 0) + (v * n * gearMul * cond.prod) / 1000
    }
    farmYearAll += (farm * feeders * cond.prod) / 1000
    if (k > 0.5) for (const b of a.econ.buildings) { nb++; for (const [g, v] of Object.entries(BUILD_OUT[b] ?? {}) as [Good, number][]) production[g] = (production[g] ?? 0) + v * gearMul * cond.prod }
    stock += a.econ.granary * k
  }
  // убитые в боях и походах с начала игры — меньше кормильцев
  const dead = (e.deaths ?? []).filter((x) => x.date <= date).reduce((s, x) => s + x.n, 0)
  if (dead > 0) { const d = Math.min(dead, (byRole.feeders ?? 0) * 0.5); byRole.feeders = (byRole.feeders ?? 0) - d; pop -= d }
  // войско (на дату): постоянное и призванное по уровню сбора отрывается от полей и мастерских (docs/ревизия-противоречий.md, п. В)
  const cc: Record<string, number> = {}
  for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'imperial'
  const mil = milAt(st.base.military, date)
  const ledger: Ledger | undefined = mil ? armyLedger(world, st, mil, { date, pop, cult, war: cond.army > 1.2, provs, byRole }) : undefined
  const workers = (byRole.feeders ?? 0) + (byRole.makers ?? 0) + (byRole.unfree ?? 0) * 0.6
  const away = ledger ? ledger.away : 0
  // доля рабочих рук, что осталась дома (не меньше 40 %: старики, женщины и дети тянут хозяйство)
  const work = workers > 0 ? Math.max(0.4, 1 - away / workers) : 1
  for (const [g, v] of Object.entries(craftOut) as [Good, number][]) production[g] = (production[g] ?? 0) + v * work
  production.grain = (production.grain ?? 0) + farmYearAll * work * S.grain
  grainYear += farmYearAll * work
  const need = pop * EAT
  const produced = (Object.entries(FOOD) as [Good, number][]).reduce((s, [g, kk]) => s + (production[g] ?? 0) * kk, 0)
  const yearAvg = grainYear + ((production.fish ?? 0) / Math.max(0.01, S.fish)) * 0.9 + ((production.cattle ?? 0) / Math.max(0.01, S.cattle)) * 1.6
  const kinds = (Object.keys(FOOD) as Good[]).map((g) => ({ good: g, amount: Math.round((production[g] ?? 0) * (FOOD[g] ?? 1)) })).filter((x) => x.amount > 0)
  // купленная на рынке еда ложится в амбары (за последний год; рыба и скот — по пищевой ценности)
  const bought = (world.market?.trades ?? []).filter((x) => x.stateId === st.id && x.date <= date && FOOD[x.good]).reduce((s, x) => {
    // разовая сделка: запас съедается за два хода; договор: каждый месяц — новая поставка, пока действует
    if (x.kind === 'deal') return date - x.date < 200 ? s + x.qty * (FOOD[x.good] ?? 1) * (1 - (date - x.date) / 200) : s
    return contractOn(x, date) ? s + x.qty * (FOOD[x.good] ?? 1) : s
  }, 0)
  const drawn = (e.drawn ?? []).filter((x) => x.date <= date && date - x.date < 500).reduce((s, x) => s + x.qty, 0)
  const stockNow = Math.max(0, bought - drawn + stock * S.stock * Math.min(1.3, Math.max(0.3, yearAvg / Math.max(1, need))))
  const deficit = need - produced
  const months = deficit > 0 ? stockNow / deficit : Infinity

  // ставки податей на дату: исходные + принятые решения власти
  const taxes = taxesAt(st, date)
  const content = Object.fromEntries(Object.entries(contentW).map(([r, w]) => [r, Math.max(0, Math.min(100, Math.round(w! / Math.max(1, byRole[r as Role] ?? 1) + cond.content + (TAX[r as Role] ? TAX_CONTENT[taxes[r as Role] ?? 'обычные'] ?? 0 : 0))))])) as Partial<Record<Role, number>>

  const income: Line[] = [], expense: Line[] = []
  let taxSum = 0
  for (const [role, n] of Object.entries(byRole) as [Role, number][]) {
    // кто в войске — подати не платит
    const v = ((TAX[role] * n * (role === 'feeders' || role === 'makers' ? work : 1) * (TAX_MULT[taxes[role] ?? 'обычные'] ?? 1) * cond.tax) / 1000) * (role === 'feeders' && month === 3 ? 1.6 : 1)
    taxSum += v
    if (v > 0.5) income.push({ name: `Подати: ${e.estates[role] ?? role}`, amount: Math.round(v), note: `${taxes[role] ?? 'обычные'}${role === 'feeders' && month === 3 ? ', подушная в Лаций' : ''}` })
  }
  for (const sp of e.special ?? []) (sp.kind === 'income' ? income : expense).push({ name: sp.name, amount: Math.round(sp.amount * (sp.kind === 'income' ? cond.tax : 1)), note: sp.text })

  const ADMIN: Record<string, number> = { orcish: 0.35, nordic: 0.65, eluin: 0.65, elven: 0.75, dark: 0.5, zlatay: 0.8, desert: 0.85 }
  const nAreas = share.size
  expense.push({ name: 'Содержание областей', amount: Math.round((nAreas * 10 + pop * 0.0008) * (ADMIN[cult] ?? 1)), note: `${nAreas} областей: наместники, суды, дороги, стража` })
  expense.push({ name: 'Двор и канцелярия', amount: Math.round(Math.min(40, 10 + taxSum * 0.15) + taxSum * 0.18) })
  expense.push({ name: 'Сбор податей', amount: Math.round(taxSum * 0.08), note: 'сборщики, откупщики, потери в дороге' })
  // войско: если у страны есть роты (военная система) — люди и содержание из них, иначе из текста армии
  // казна войска (armyLedger.ts): статьи, утечки, меры (посчитана выше); без рот — по тексту армии
  const milMen = ledger?.men ?? 0
  if (ledger) {
    for (const l of ledger.income) income.push({ name: l.name, amount: l.amount, note: l.note })
    for (const [r, v] of Object.entries(ledger.content) as [Role, number][]) if (content[r] != null) content[r] = Math.max(0, Math.min(100, content[r]! + v))
  }
  const soldiers = Math.round((mil ? milMen : armySize(st.base.army)) * Math.min(2, cond.army))
  const ships = shipCount(st.base.navy)
  if (soldiers) expense.push({ name: cond.army > 1.2 ? 'Армия (военное время)' : 'Армия', amount: ledger ? ledger.total : Math.round(soldiers * 0.045 * Math.max(1, cond.army * 0.8)), note: `≈ ${soldiers.toLocaleString('ru-RU')} человек${ledger ? `, ${mil!.companies.length} рот; на жалованье ${ledger.standing.toLocaleString('ru-RU')}, остальные — ${ledger.level === 'мир' ? 'по домам' : ledger.level}` : ''}` })
  // флот: эскадры страны (fleet.ts); торговые суда по найму в мирное время почти даром; утечки — как у войска
  const navy = mil?.navy
  if (navy?.squadrons.length) {
    const war = navy.squadrons.filter((s) => !s.merchant), n = navy.squadrons.reduce((s, q) => s + q.count, 0)
    const cost = navy.squadrons.reduce((s, q) => s + squadronStats(q).cost, 0) * (1 + (ledger?.leak.rate ?? 0) * 0.8)
    expense.push({ name: 'Флот', amount: Math.round(cost), note: `${n} кораблей в ${navy.squadrons.length} эскадрах${war.length < navy.squadrons.length ? ', с торговыми по найму' : ''}` })
  } else if (ships) expense.push({ name: 'Флот', amount: Math.round(ships * 4), note: `≈ ${ships} кораблей` })
  if (nb) expense.push({ name: 'Постройки и мануфактуры', amount: nb * 6, note: `${nb} построек` })
  // договоры поставки на рынке Каяи (покупка — расход, продажа — доход)
  for (const c of contractsOf(world, st.id, date)) (c.income ? income : expense).push({ name: c.name, amount: c.amount, note: c.note })
  for (const d of e.debts) expense.push({ name: `Проценты: ${d.to}`, amount: Math.round(d.sum * d.rate), note: `долговая печать на ${Math.round(d.sum).toLocaleString('ru-RU')} мар., срок ${d.due} г.` })

  // соседи по суше на дату — для торговли
  const neighbors = new Set<string>()
  const ownerOf = ownerIndex(owned)
  for (const p of provs) for (const nid of p.neighbors ?? []) { const o = ownerOf.get(nid); if (o && o !== st.id) neighbors.add(o) }

  const net = income.reduce((s, l) => s + l.amount, 0) - expense.reduce((s, l) => s + l.amount, 0)
  const treasury = treasuryAt(world, st, date, cond.popFactor * cond.tax)
  return {
    year, month, season: S, pop, byRole, byRace, production, consumption,
    food: { stock: stockNow, need, produced, yearPct: Math.round((100 * yearAvg) / Math.max(1, need)), months, kinds },
    income, expense, net, treasury, ledger, soldiers, ships, work, away, content, events: cond.active, provinces: provs.length, areas: nAreas, neighbors: [...neighbors], trade: []
  }
}

// ---------- торговля: излишки уходят соседям, морем и на рынок Каяи ----------
/** торговля с учётом дипломатии: война обрывает, вражда и напряжённость урезают, торговый договор и союз — расширяют */
export function tradeFactor(world: WorldData, a: string, b: string, date: WorldDate): number {
  const r = relationAt(world, a, b, date)
  if (!r) return 1
  if (r.kind === 'war') return 0
  let k = r.kind === 'hostile' ? 0.4 : r.kind === 'tension' ? 0.7 : r.kind === 'truce' ? 0.6 : r.kind === 'alliance' ? 1.15 : r.kind === 'trade' ? 1.3 : 1
  if (r.kind !== 'trade' && r.treaties.includes('trade')) k *= 1.25
  return k
}

/** излишек товара за ход (еда — по годовому балансу); продать на бирже можно не больше */
export function surplusOf(r: EconReport, g: Good): number {
  const FOODS = new Set<Good>(['grain', 'fish', 'cattle'])
  return FOODS.has(g) ? (r.food.yearPct > 105 ? ((r.production[g] ?? 0) * (r.food.yearPct - 100)) / r.food.yearPct : 0) : (r.production[g] ?? 0) - (r.consumption[g] ?? 0)
}

/** редкие товары: дорогой товар берут меньше, и мир не может съесть больше, чем добыто (docs/ревизия-противоречий.md, Д7–Д8) */
function limitConsumption(reports: Map<string, EconReport>, P: Record<Good, number>) {
  const FOODS = new Set<Good>(['grain', 'fish', 'cattle'])
  for (const def of GOODS) {
    const g = def.key
    if (FOODS.has(g)) continue
    let supply = 0, demand = 0
    for (const r of reports.values()) { supply += r.production[g] ?? 0; demand += r.consumption[g] ?? 0 }
    if (demand <= 0) continue
    // эластичность: цена вдвое выше обычной — берут на ~30 % меньше
    let k = Math.min(1, Math.pow(def.price / Math.max(0.01, P[g]), 0.5))
    if (demand * k > supply) k = supply / demand
    if (k >= 0.999) continue
    for (const r of reports.values()) if (r.consumption[g]) r.consumption[g] = r.consumption[g]! * k
  }
}

function trade(world: WorldData, reports: Map<string, EconReport>, owned: Map<string, Province[]>, P: Record<Good, number>, date: WorldDate) {
  const surplus = new Map<string, Partial<Record<Good, number>>>(), deficit = new Map<string, Partial<Record<Good, number>>>()
  for (const [id, r] of reports) {
    const s: Partial<Record<Good, number>> = {}, d: Partial<Record<Good, number>> = {}
    for (const g of GOODS) {
      const made = surplusOf(r, g.key)
      const want = g.key === 'grain' ? (r.food.yearPct < 95 ? (r.food.need * (100 - r.food.yearPct)) / 100 : 0) : (g.key === 'fish' || g.key === 'cattle') ? 0 : (r.consumption[g.key] ?? 0) - (r.production[g.key] ?? 0)
      if (made > 0.5) s[g.key] = made
      else if (want > 0.5) d[g.key] = want
    }
    surplus.set(id, s); deficit.set(id, d)
  }
  const coastal = new Set([...owned].filter(([, ps]) => ps.some((p) => p.coastal)).map(([id]) => id))
  const kaya = world.states.find((s) => s.base.name === 'Семья Каяя')
  const stById = new Map(world.states.map((s) => [s.id, s]))
  // пары торговли: соседи по суше и крупные приморские страны; вес — дорога и дипломатия
  const pairW = new Map<string, Map<string, { w: number; by: 'суша' | 'море' }>>()
  for (const [id, r] of reports) {
    const m = new Map<string, { w: number; by: 'суша' | 'море' }>()
    const cand = new Set(r.neighbors)
    if (coastal.has(id)) for (const o of coastal) if (o !== id && (reports.get(o)?.pop ?? 0) > 150000) cand.add(o)
    for (const o of cand) {
      if (!reports.has(o) || (kaya && o === kaya.id)) continue
      const by = r.neighbors.includes(o) ? 'суша' : 'море'
      const w = (by === 'суша' ? 0.35 : 0.2) * tradeFactor(world, id, o, date)
      if (w > 0) m.set(o, { w, by })
    }
    pairW.set(id, m)
  }
  // каждый товар: покупатель просит у продавцов по их излишку; продавец делит излишек между покупателями (один излишек не продаётся дважды)
  const flow = new Map<string, Map<string, Partial<Record<Good, number>>>>() // продавец → покупатель → товар
  const sold = new Map<string, Partial<Record<Good, number>>>()
  for (const def of GOODS) {
    const g = def.key
    const ask = new Map<string, Map<string, number>>() // продавец → покупатель → просьба
    for (const [y, dy] of deficit) {
      const need = dy[g]
      if (!need) continue
      const sup = [...(pairW.get(y) ?? [])].map(([x, p]) => ({ x, w: p.w, s: surplus.get(x)?.[g] ?? 0 })).filter((q) => q.s > 0)
      const pool = sup.reduce((s, q) => s + q.s * q.w, 0)
      if (pool <= 0) continue
      // сколько нехватки можно закрыть: чем больше дорог к продавцам, тем больше (не больше 90 %)
      const reach = Math.min(0.9, sup.reduce((s, q) => s + q.w, 0))
      for (const q of sup) { const v = need * reach * ((q.s * q.w) / pool); (ask.get(q.x) ?? ask.set(q.x, new Map()).get(q.x)!).set(y, v) }
    }
    for (const [x, req] of ask) {
      const s = surplus.get(x)![g]!
      const tot = [...req.values()].reduce((a, b) => a + b, 0)
      const k = Math.min(1, s / Math.max(1e-9, tot))
      for (const [y, v] of req) {
        const a = v * k
        if (a < 0.01) continue
        const fx = flow.get(x) ?? flow.set(x, new Map()).get(x)!
        const fy = fx.get(y) ?? fx.set(y, {}).get(y)!
        fy[g] = (fy[g] ?? 0) + a
        const sx = sold.get(x) ?? sold.set(x, {}).get(x)!
        sx[g] = (sx[g] ?? 0) + a
      }
    }
  }
  const top4 = (a: { good: Good; amount: number }[]) => a.filter((x) => x.amount > 0.5).sort((x, y) => y.amount * P[y.good] - x.amount * P[x.good]).slice(0, 4)
  for (const [id, r] of reports) {
    const st = stById.get(id)!
    const partners: TradePartner[] = []
    for (const [o, p] of pairW.get(id) ?? []) {
      const ex = Object.entries(flow.get(id)?.get(o) ?? {}).map(([g, v]) => ({ good: g as Good, amount: v! }))
      const im = Object.entries(flow.get(o)?.get(id) ?? {}).map(([g, v]) => ({ good: g as Good, amount: v! }))
      const value = [...ex, ...im].reduce((s, x) => s + x.amount * P[x.good], 0)
      if (value < 5) continue
      const so = stById.get(o)!
      partners.push({ id: o, name: so.base.name, color: so.base.color, exports: top4(ex), imports: top4(im), value, by: p.by })
    }
    partners.sort((a, b) => b.value - a.value)
    const top = partners.slice(0, 6)
    const rest6 = partners.slice(6).reduce((s, p) => s + p.value, 0)
    // что не разошлось по соседям — пятая часть уходит через конторы Каяи
    const left = (Object.entries(surplus.get(id)!) as [Good, number][]).map(([g, v]) => [g, Math.max(0, v - (sold.get(id)?.[g] ?? 0))] as [Good, number]).filter(([, v]) => v > 0.5)
    const rest = left.reduce((s, [g, v]) => s + v * P[g] * 0.2, 0)
    if (kaya && id !== kaya.id && rest > 20) top.push({ id: kaya.id, name: 'Рынок Каяи', color: kaya.base.color, exports: left.sort((a, b) => b[1] * P[b[0]] - a[1] * P[a[0]]).slice(0, 4).map(([g, v]) => ({ good: g, amount: v * 0.2 })), imports: [], value: rest, by: 'рынок Каяи' })
    r.trade = top
    const turnover = top.reduce((s, p) => s + p.value, 0) + rest6
    const money = st.base.tech?.levels.money ?? 1
    // 10 %: оборот честный (излишек делится между покупателями), прежние 6 % стояли на раздутом обороте
    const duty = Math.round(turnover * 0.1 * (0.7 + money * 0.15))
    r.income.push({ name: 'Пошлины и торговля', amount: duty, note: `оборот ≈ ${Math.round(turnover).toLocaleString('ru-RU')} мар. за ход` })
    r.net += duty
    // коронные промыслы — по живой цене биржи
    const crown = ['silver', 'salt', 'copper', 'saltpetre'].reduce((s, g) => s + (r.production[g as Good] ?? 0) * P[g as Good], 0) * 0.12
    if (crown > 1) { r.income.push({ name: 'Коронные промыслы', amount: Math.round(crown), note: '12 % серебра, соли, меди, селитры — по цене биржи' }); r.net += Math.round(crown) }
  }
}

/** казна на дату: с начала игры (настоящее время лора) — начальная казна + журнал (итоги ходов, сделки, займы) до этой даты;
 *  раньше начала игры — оценка по населению и податям того года */
export function treasuryAt(world: WorldData, st: WorldState, date: WorldDate, k = 1): number {
  const e = st.base.econ
  if (!e) return 0
  const start = world.calendar.present
  if (date < start) return Math.round(e.treasury * Math.min(1.2, Math.max(0.15, k)))
  return Math.round(e.treasury + (e.journal ?? []).filter((x) => x.date <= date).reduce((s, x) => s + x.amount, 0))
}
/** первый день месяца, в котором лежит дата */
export function monthStart(world: WorldData, date: WorldDate): WorldDate { const p = toParts(world.calendar, date); return fromParts(world.calendar, { year: p.year, month: p.month, day: 1 }) }

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

/** сколько страна может продать на бирже в этот ход: излишек минус уже проданное (сделки этого хода и действующие договоры) */
export function sellable(world: WorldData, stateId: string, good: Good, date: WorldDate): number {
  const r = worldReports(world, date).get(stateId)
  if (!r) return 0
  const sold = (world.market?.trades ?? []).filter((x) => x.stateId === stateId && x.good === good && x.qty < 0 && x.date <= date && (x.kind === 'deal' ? date - x.date < 100 : contractOn(x, date))).reduce((s, x) => s - x.qty, 0)
  return Math.max(0, Math.floor(surplusOf(r, good) - sold))
}


/** дань: вассал (или по договору «дань» с указанным сюзереном) платит восьмую часть податей; кому дань вписана особой статьёй — уже платит */
function tribute(world: WorldData, reports: Map<string, EconReport>, date: WorldDate) {
  const name = (id: string): string => world.states.find((s) => s.id === id)?.base.name ?? id
  for (const r of world.relations ?? []) {
    if (!r.overlord || r.from > date || (r.to != null && date >= r.to)) continue
    if (r.kind !== 'vassal' && !r.treaties.includes('tribute')) continue
    if (relationAt(world, r.a, r.b, date) !== r) continue
    const payer = r.a === r.overlord ? r.b : r.a
    const rp = reports.get(payer), ro = reports.get(r.overlord)
    if (!rp || !ro) continue
    const st = world.states.find((s) => s.id === payer)
    if ((st?.base.econ?.special ?? []).some((x) => x.kind === 'expense' && /дан/i.test(x.name))) continue
    const v = Math.round(rp.income.filter((l) => l.name.startsWith('Подати')).reduce((s, l) => s + l.amount, 0) * 0.08)
    if (v < 1) continue
    rp.expense.push({ name: `Дань: ${name(r.overlord)}`, amount: v, note: 'восьмая часть податей сюзерену' }); rp.net -= v
    ro.income.push({ name: `Дань: ${name(payer)}`, amount: v, note: 'восьмая часть податей вассала' }); ro.net += v
  }
}
