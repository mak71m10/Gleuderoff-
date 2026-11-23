/**
 * Экономика ВПИ (docs/впи-экономика.md). Общие определения для приложения и скриптов:
 * 20 товаров, 6 ролей сословий (в каждой стране свои названия), монета, данные провинции, области и страны.
 * Деньги — имперская марка: 1 марка = 1 золотая = 20 серебряников = 240 медяков.
 */

export type Good =
  | 'grain' | 'fish' | 'cattle'
  | 'wood' | 'stone' | 'iron' | 'copper' | 'silver' | 'salt' | 'coal' | 'saltpetre' | 'furs'
  | 'horses'
  | 'cloth' | 'tools' | 'arms' | 'powder'
  | 'wine' | 'luxury' | 'reagents'

export interface GoodDef { key: Good; name: string; group: 'еда' | 'сырьё' | 'живое' | 'изделия' | 'роскошь'; price: number; icon: string }

/** price — базовая цена меры в марках (мера: воз хлеба, бочка соли, пуд железа…) */
export const GOODS: GoodDef[] = [
  { key: 'grain', name: 'Хлеб', group: 'еда', price: 1, icon: '🌾' },
  { key: 'fish', name: 'Рыба', group: 'еда', price: 1.2, icon: '🐟' },
  { key: 'cattle', name: 'Скот, шерсть и кожи', group: 'еда', price: 2, icon: '🐄' },
  { key: 'wood', name: 'Лес', group: 'сырьё', price: 1, icon: '🪵' },
  { key: 'stone', name: 'Камень и мрамор', group: 'сырьё', price: 1.2, icon: '🪨' },
  { key: 'iron', name: 'Железо', group: 'сырьё', price: 3, icon: '⛓' },
  { key: 'copper', name: 'Медь и олово', group: 'сырьё', price: 4, icon: '🟠' },
  { key: 'silver', name: 'Серебро и золото', group: 'сырьё', price: 12, icon: '🪙' },
  { key: 'salt', name: 'Соль', group: 'сырьё', price: 3, icon: '🧂' },
  { key: 'coal', name: 'Уголь', group: 'сырьё', price: 1.5, icon: '⬛' },
  { key: 'saltpetre', name: 'Селитра', group: 'сырьё', price: 6, icon: '⚗' },
  { key: 'furs', name: 'Меха', group: 'сырьё', price: 8, icon: '🦊' },
  { key: 'horses', name: 'Кони', group: 'живое', price: 10, icon: '🐎' },
  { key: 'cloth', name: 'Ткани', group: 'изделия', price: 5, icon: '🧵' },
  { key: 'tools', name: 'Инструменты и механизмы', group: 'изделия', price: 8, icon: '⚙' },
  { key: 'arms', name: 'Оружие и доспехи', group: 'изделия', price: 10, icon: '⚔' },
  { key: 'powder', name: 'Порох', group: 'изделия', price: 15, icon: '💥' },
  { key: 'wine', name: 'Вино и пряности', group: 'роскошь', price: 6, icon: '🍷' },
  { key: 'luxury', name: 'Предметы роскоши', group: 'роскошь', price: 20, icon: '💎' },
  { key: 'reagents', name: 'Реагенты Даки', group: 'роскошь', price: 25, icon: '✦' }
]
export const GOOD = Object.fromEntries(GOODS.map((g) => [g.key, g])) as Record<Good, GoodDef>

/** Роли сословий — одинаково работают во всех странах, называются по-своему (StateEcon.estates) */
export type Role = 'feeders' | 'makers' | 'rulers' | 'servants' | 'learned' | 'unfree'
export const ROLES: { key: Role; name: string; does: string }[] = [
  { key: 'feeders', name: 'кормильцы', does: 'пашут, пасут, ловят рыбу; платят хлебом' },
  { key: 'makers', name: 'мастера', does: 'ремесло, торговля, мануфактуры; платят монетой' },
  { key: 'rulers', name: 'правящие', does: 'земля, войско, суд; потребляют роскошь' },
  { key: 'servants', name: 'служители', does: 'храмы, школы, лечебницы' },
  { key: 'learned', name: 'учёные', does: 'маги, учёные, мастера редких дел' },
  { key: 'unfree', name: 'несвободные', does: 'работают за кров и долг; дёшево, но легко вспыхивают' }
]

/** Промысел провинции: что даёт её земля и насколько богато (1 — скудно, 3 — богато) */
export interface ProvinceRes { good: Good; rich: 1 | 2 | 3 }

/** Экономика области: население по расам и ролям, довольство ролей, амбар, постройки */
export interface AreaEcon {
  pop: Record<string, Partial<Record<Role, number>>>
  content: Partial<Record<Role, number>>
  /** запас хлеба в мерах */
  granary: number
  buildings: string[]
}

export interface EconHistoryRow { year: number; title: string; pop: number; treasury: number; goods: Good[]; note: string }

/** Экономика страны */
export interface StateEcon {
  coin: { name: string; perMark: number }
  /** местные названия ролей; роли, которой в стране нет, нет и здесь */
  estates: Partial<Record<Role, string>>
  /** порог терпения: довольство ниже него два хода подряд — волнение */
  threshold: number
  troubles: string[]
  strengths: string[]
  /** казна в марках */
  treasury: number
  taxes: Partial<Record<Role, 'лёгкие' | 'обычные' | 'тяжёлые' | 'разорительные'>>
  /** долговые печати: кому, сколько марок, процент за ход, срок (год) */
  debts: { to: string; sum: number; rate: number; due: number }[]
  history: EconHistoryRow[]
  /** особые экономические механики страны: свои доходы и расходы за ход (пошлины Семи ворот, десятина, набеги…) */
  special?: { name: string; kind: 'income' | 'expense'; amount: number; text: string }[]
  /** журнал казны с начала игры: итоги месяцев («Провести ход»), сделки, займы, набор, разовые доходы и расходы — казна на дату = treasury + записи до даты */
  journal?: TreasuryEntry[]
  /** убитые (бой, поход) с даты — убывают из кормильцев */
  deaths?: { date: number; n: number; note?: string }[]
  /** хлеб, взятый из амбаров (поход) — меры, с даты на год */
  drawn?: { date: number; qty: number; note?: string }[]
}
export interface TreasuryEntry { date: number; amount: number; note: string; kind: 'turn' | 'deal' | 'debt' | 'order' | 'other' }
/** записать деньги в журнал казны (с даты) */
export function journalAdd(e: StateEcon, date: number, amount: number, note: string, kind: TreasuryEntry['kind'] = 'other'): void {
  ;(e.journal ??= []).push({ date, amount: Math.round(amount), note, kind })
}

/** «12 мар. 5 сер.» — сумма в марках словами монет */
export function fmtMarks(v: number): string {
  const neg = v < 0, a = Math.abs(v)
  if (a >= 10000) return `${neg ? '−' : ''}${Math.round(a / 1000)} тыс. мар.`
  const m = Math.floor(a), s = Math.round((a - m) * 20)
  return `${neg ? '−' : ''}${m ? `${m.toLocaleString('ru-RU')} мар.` : ''}${s ? ` ${s} сер.` : ''}`.trim() || '0'
}

/** «≈ 42 тыс.», «≈ 1,4 млн» */
export function fmtPeople(n: number): string {
  if (n >= 1e6) return `≈ ${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} млн`
  if (n >= 1e4) return `≈ ${Math.round(n / 1000)} тыс.`
  if (n >= 1000) return `≈ ${(n / 1000).toFixed(1).replace('.', ',')} тыс.`
  return `≈ ${Math.round(n / 10) * 10}`
}
