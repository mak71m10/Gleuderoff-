// Живой рынок ВПИ: цена каждого товара на дату — из спроса и предложения всего мира (производство и потребление стран),
// войн (оружие, кони, хлеб, порох дорожают) и потрясений мастера (world.market.shocks: неурожай, блокада, новый рудник).
// econCalc считает торговлю по этим ценам; вкладка «Рынок» показывает цены, движение и кто продаёт и покупает.
import { GOOD, GOODS, type Good } from './economy'
import type { EconReport } from './econCalc'
import type { WorldData, WorldDate } from './types'

export interface MarketShock { id: string; good: Good; mult: number; from: WorldDate; to: WorldDate; note: string }
/** сделка страны на рынке Каяи: qty > 0 — купила, < 0 — продала; deal — разовая, contract — поставка qty в месяц на months месяцев по зафиксированной цене */
export interface MarketTrade { id: string; stateId: string; good: Good; qty: number; price: number; date: WorldDate; kind: 'deal' | 'contract'; months?: number; note?: string }
/** комиссия контор Каяи */
export const KAYA_FEE = 0.04
export const MONTH = 100
export const dealSum = (qty: number, price: number): number => Math.round(Math.abs(qty) * price * (qty > 0 ? 1 + KAYA_FEE : 1 - KAYA_FEE))
export const contractOn = (t: MarketTrade, date: WorldDate): boolean => t.kind === 'contract' && t.date <= date && date < t.date + (t.months ?? 1) * MONTH
/** договоры поставки страны на дату — строки бюджета (покупка — расход, продажа — доход) */
export function contractsOf(world: WorldData, stateId: string, date: WorldDate): { name: string; amount: number; income: boolean; note: string }[] {
  return (world.market?.trades ?? []).filter((t) => t.stateId === stateId && contractOn(t, date)).map((t) => ({ name: `Договор Каяи: ${GOOD[t.good].name}`, amount: dealSum(t.qty, t.price), income: t.qty < 0, note: `${t.qty > 0 ? 'покупка' : 'продажа'} ${Math.abs(t.qty)} в месяц по ${t.price} до ${Math.round((t.date + (t.months ?? 1) * MONTH) / 500)} г.` }))
}
export interface MarketGood { good: Good; base: number; price: number; supply: number; demand: number; volume: number; why: string[]; deals: MarketTrade[]; sellers: { id: string; name: string; amount: number }[]; buyers: { id: string; name: string; amount: number }[] }
export interface MarketReport { goods: MarketGood[]; price: Record<Good, number>; wars: number; shocks: MarketShock[]; index: number }

const FOODS: Good[] = ['grain', 'fish', 'cattle']
const WAR_DEMAND: Partial<Record<Good, number>> = { arms: 0.9, horses: 0.6, powder: 0.8, iron: 0.4, grain: 0.15, cloth: 0.25, saltpetre: 0.5 }

export function computeMarket(world: WorldData, date: WorldDate, reports: Map<string, EconReport>): MarketReport {
  const supply: Partial<Record<Good, number>> = {}, demand: Partial<Record<Good, number>> = {}
  let need = 0, produced = 0
  for (const r of reports.values()) {
    for (const [g, v] of Object.entries(r.production) as [Good, number][]) supply[g] = (supply[g] ?? 0) + v
    for (const [g, v] of Object.entries(r.consumption) as [Good, number][]) demand[g] = (demand[g] ?? 0) + v
    need += r.food.need; produced += r.food.produced
  }
  // войны на дату: сколько стран воюет (по дипломатии)
  const atWar = new Set<string>()
  for (const rel of world.relations ?? []) if (rel.kind === 'war' && rel.from <= date && (rel.to == null || date < rel.to)) { atWar.add(rel.a); atWar.add(rel.b) }
  const warShare = atWar.size / Math.max(1, reports.size)
  const shocks = (world.market?.shocks ?? []).filter((s) => s.from <= date && date < s.to)
  const price = {} as Record<Good, number>
  const goods: MarketGood[] = []
  for (const def of GOODS) {
    const g = def.key, why: string[] = []
    let ratio: number
    if (FOODS.includes(g)) { ratio = need / Math.max(1, produced); if (ratio > 1.1) why.push('хлеба мало до жатвы'); else if (ratio < 0.8) why.push('амбары полны') }
    else { const s = supply[g] ?? 0, d = demand[g] ?? 0; ratio = s <= 0 ? (d > 0 ? 3 : 1) : d / s; if (ratio > 1.3) why.push('спрос выше добычи'); else if (ratio < 0.7) why.push('товара больше, чем берут') }
    let p = def.price * Math.max(0.6, Math.min(1.8, Math.pow(ratio, 0.35)))
    const wd = WAR_DEMAND[g]
    if (wd && warShare > 0) { p *= 1 + wd * Math.min(0.5, warShare * 2); why.push(`войны (${atWar.size} стран воюют)`) }
    for (const s of shocks.filter((x) => x.good === g)) { p *= s.mult; why.push(s.note || (s.mult > 1 ? 'потрясение' : 'избыток')) }
    // сделки стран за последний месяц двигают цену (скупка поднимает, сброс роняет; влияние тает за месяц), договоры — пока действуют
    const sup = Math.max(1, supply[g] ?? 0)
    let push = 0, volume = 0
    const deals = (world.market?.trades ?? []).filter((x) => x.good === g && x.date <= date && (x.kind === 'deal' ? date - x.date < MONTH : contractOn(x, date)))
    for (const x of deals) { const fade = x.kind === 'deal' ? 1 - (date - x.date) / MONTH : 0.5; push += (x.qty / sup) * fade; volume += Math.abs(x.qty) }
    if (Math.abs(push) > 0.005) { const k = Math.max(0.6, Math.min(1.6, 1 + push * 1.5)); p *= k; why.push(push > 0 ? `скупка: цена ×${k.toFixed(2)}` : `сброс: цена ×${k.toFixed(2)}`) }
    price[g] = Math.round(p * 100) / 100
    // кто продаёт и покупает: излишек и нехватка по странам
    const net: { id: string; name: string; amount: number }[] = []
    for (const [id, r] of reports) { const v = (r.production[g] ?? 0) - (r.consumption[g] ?? 0); if (Math.abs(v) > 0.5) net.push({ id, name: world.states.find((s) => s.id === id)?.base.name ?? id, amount: Math.round(v) }) }
    goods.push({ good: g, base: def.price, price: price[g], supply: Math.round(supply[g] ?? 0), demand: Math.round(demand[g] ?? 0), volume: Math.round(volume), deals, why, sellers: net.filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 4), buyers: net.filter((x) => x.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 4) })
  }
  // индекс Каяи: цена всей корзины товаров мира к обычной (100 — как всегда)
  const index = Math.round((100 * goods.reduce((s, x) => s + x.price * Math.max(1, x.supply), 0)) / Math.max(1, goods.reduce((s, x) => s + x.base * Math.max(1, x.supply), 0)))
  return { goods, price, wars: atWar.size, shocks, index }
}
export const priceOf = (m: MarketReport | undefined, g: Good): number => m?.price[g] ?? GOOD[g].price
