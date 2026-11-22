/**
 * Расчёт экономики ВПИ за один ход (месяц) — общий для окна экономики, панелей карты и (позже) расчёта хода.
 * Всё в имперских марках и «мерах» товара. Числа подобраны так, чтобы средняя страна сводила бюджет
 * с небольшим плюсом, а беды (нет хлеба, большая армия, долги) давали заметный минус.
 */
import { GOOD, GOODS, type Good, type Role } from './economy'
import type { AdminRegion, Province, WorldData, WorldState } from './types'

/** выпуск меры товара на 1000 жителей провинции за ход при богатстве 1 */
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
  'верфь': {}, 'типография': { luxury: 4 }, 'рудник': {}, 'банк': {}, 'порт': {}, 'ярмарка': {}
}
/** подать с 1000 человек роли за ход при «обычных» податях, марки */
const TAX: Record<Role, number> = { feeders: 1.1, makers: 4.5, rulers: 7, servants: 0, learned: 2, unfree: 0.2 }
export const TAX_MULT: Record<string, number> = { 'лёгкие': 0.6, 'обычные': 1, 'тяжёлые': 1.5, 'разорительные': 2.2 }

export interface Line { name: string; amount: number; note?: string }
export interface EconReport {
  pop: number
  byRole: Partial<Record<Role, number>>
  byRace: Record<string, number>
  production: Partial<Record<Good, number>>
  consumption: Partial<Record<Good, number>>
  food: { stock: number; need: number; produced: number; months: number; kinds: { good: Good; amount: number }[] }
  income: Line[]
  expense: Line[]
  net: number
  soldiers: number
  ships: number
}

const num = (s: string | undefined, re: RegExp): number => {
  const m = String(s ?? '').match(re)
  if (!m) return 0
  const v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  return /млн/i.test(m[2] ?? '') ? v * 1e6 : /тыс/i.test(m[2] ?? '') ? v * 1000 : v
}

/** численность войска из текста: самое большое «N тыс.» (общая численность), иначе самое большое число ≥ 100 */
export function armySize(text: string | undefined): number {
  const t = String(text ?? '')
  const big = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(тыс|млн)/gi)].map((m) => parseFloat(m[1].replace(',', '.')) * (/млн/i.test(m[2]) ? 1e6 : 1e3))
  if (big.length) return Math.round(Math.max(...big))
  const plain = [...t.replace(/(\d)\s(\d{3})/g, '$1$2').matchAll(/\d{3,}/g)].map((m) => +m[0]).filter((n) => n >= 100 && n < 1e6)
  return plain.length ? Math.max(...plain) : 0
}

/** доход с роли с учётом ставки податей */
const roleTax = (r: Role, n: number, level?: string): number => (TAX[r] * n * (TAX_MULT[level ?? 'обычные'] ?? 1)) / 1000

export function provincesOf(world: WorldData, stateId: string): Province[] {
  return (world.provinces ?? []).filter((p) => p.owners?.at(-1)?.[1] === stateId)
}

/** экономика области или набора областей за ход (без бюджета страны) */
function produce(provs: Province[], areas: AdminRegion[], gear: number) {
  const production: Partial<Record<Good, number>> = {}, consumption: Partial<Record<Good, number>> = {}
  const byRole: Partial<Record<Role, number>> = {}, byRace: Record<string, number> = {}
  let pop = 0, stock = 0
  for (const p of provs) if (p.res && p.pop) production[p.res.good] = (production[p.res.good] ?? 0) + (YIELD[p.res.good] * p.res.rich * p.pop) / 1000
  const gearMul = 1 + gear * 0.1
  for (const a of areas) {
    const e = a.econ!
    const ap = provs.filter((p) => p.areaId === a.id)
    const farm = ap.reduce((x, p) => x + (FARM[p.terrain] ?? 40), 0) / Math.max(1, ap.length)
    const feeders = Object.values(e.pop).reduce((x, row) => x + (row.feeders ?? 0) + (row.unfree ?? 0) * 0.6, 0)
    production.grain = (production.grain ?? 0) + (farm * feeders) / 1000
    for (const [race, row] of Object.entries(e.pop)) for (const [r, n] of Object.entries(row) as [Role, number][]) {
      byRole[r] = (byRole[r] ?? 0) + n; byRace[race] = (byRace[race] ?? 0) + n; pop += n
      for (const [g, v] of Object.entries(NEEDS[r]) as [Good, number][]) consumption[g] = (consumption[g] ?? 0) + (v * n) / 1000
      if (r === 'makers') for (const [g, v] of Object.entries(CRAFT) as [Good, number][]) production[g] = (production[g] ?? 0) + (v * n * gearMul) / 1000
    }
    for (const b of e.buildings) for (const [g, v] of Object.entries(BUILD_OUT[b] ?? {}) as [Good, number][]) production[g] = (production[g] ?? 0) + v * gearMul
    stock += e.granary
  }
  const need = pop * EAT
  const produced = (Object.entries(FOOD) as [Good, number][]).reduce((s, [g, k]) => s + (production[g] ?? 0) * k, 0)
  const kinds = (Object.keys(FOOD) as Good[]).map((g) => ({ good: g, amount: Math.round((production[g] ?? 0) * (FOOD[g] ?? 1)) })).filter((k) => k.amount > 0)
  return { production, consumption, byRole, byRace, pop, food: { stock, need, produced, months: 0, kinds } }
}

/** отчёт по стране за ход: выпуск, потребление, продовольствие, бюджет */
export function stateReport(world: WorldData, st: WorldState): EconReport | null {
  const e = st.base.econ
  if (!e) return null
  const provs = provincesOf(world, st.id)
  const ids = new Set(provs.map((p) => p.areaId))
  const areas = (world.adminRegions ?? []).filter((a) => ids.has(a.id) && a.econ)
  const tech = st.base.tech?.levels
  const r = produce(provs, areas, tech?.gear ?? 1)
  // продовольствие: запас ÷ (потребность − свой выпуск); если свой выпуск покрывает — «хватает»
  const deficit = r.food.need - r.food.produced
  const months = deficit > 0 ? r.food.stock / deficit : Infinity

  // бюджет
  const income: Line[] = [], expense: Line[] = []
  for (const [role, n] of Object.entries(r.byRole) as [Role, number][]) {
    const v = roleTax(role, n, e.taxes[role])
    if (v > 0.5) income.push({ name: `Подати: ${e.estates[role] ?? role}`, amount: Math.round(v), note: e.taxes[role] })
  }
  const goodsValue = (g: Good, v: number): number => v * GOOD[g].price
  const surplus = GOODS.reduce((s, g) => s + Math.max(0, (r.production[g.key] ?? 0) - (r.consumption[g.key] ?? 0) - (FOOD[g.key] ? 0 : 0)) * g.price, 0)
  income.push({ name: 'Пошлины и торговля', amount: Math.round(surplus * 0.02 * (0.7 + (tech?.money ?? 1) * 0.15)), note: '2 % с вывоза излишков; банки и рынки добавляют' })
  const crown = ['silver', 'salt', 'copper', 'saltpetre'].reduce((s, g) => s + goodsValue(g as Good, r.production[g as Good] ?? 0), 0) * 0.12
  if (crown > 1) income.push({ name: 'Коронные промыслы', amount: Math.round(crown), note: '12 % серебра, соли, меди, селитры' })
  for (const sp of e.special ?? []) (sp.kind === 'income' ? income : expense).push({ name: sp.name, amount: sp.amount, note: sp.text })

  const soldiers = armySize(st.base.army)
  const ships = Math.round(num(st.base.navy, /(\d+)\s*(?:корабл|судов|кораблей|вымпел|галер|эскадр)/i))
  const cc: Record<string, number> = {}
  for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'imperial'
  const ADMIN: Record<string, number> = { orcish: 0.35, nordic: 0.65, eluin: 0.65, elven: 0.75, dark: 0.5, zlatay: 0.8, desert: 0.85 }
  expense.push({ name: 'Содержание областей', amount: Math.round((areas.length * 12 + r.pop * 0.0008) * (ADMIN[cult] ?? 1)), note: `${areas.length} областей: наместники, суды, дороги, стража` })
  const taxSum = income.filter((l) => l.name.startsWith('Подати')).reduce((s, l) => s + l.amount, 0)
  expense.push({ name: 'Двор и канцелярия', amount: Math.round(40 + taxSum * 0.18) })
  expense.push({ name: 'Сбор податей', amount: Math.round(taxSum * 0.08), note: 'сборщики, откупщики, потери в дороге' })
  if (soldiers) expense.push({ name: 'Армия', amount: Math.round(soldiers * 0.045), note: `≈ ${soldiers.toLocaleString('ru-RU')} человек` })
  if (ships) expense.push({ name: 'Флот', amount: Math.round(ships * 4), note: `≈ ${ships} кораблей` })
  const nb = areas.reduce((s, a) => s + a.econ!.buildings.length, 0)
  if (nb) expense.push({ name: 'Постройки и мануфактуры', amount: nb * 6, note: `${nb} построек` })
  for (const d of e.debts) expense.push({ name: `Проценты: ${d.to}`, amount: Math.round(d.sum * d.rate) })
  const net = income.reduce((s, l) => s + l.amount, 0) - expense.reduce((s, l) => s + l.amount, 0)
  return { ...r, food: { ...r.food, months }, income, expense, net, soldiers, ships }
}
