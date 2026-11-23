// Флот ВПИ (docs/впи-армия.md § 7): типы кораблей, вооружение эскадр, эскадры и флоты страны.
// Эскадра — N одинаковых кораблей с одним вооружением, командой, базой (порт) и командиром; флот — несколько эскадр.
import type { Req } from './military'

/** характеристики корабля 0–20: ход, мореходность, борт (прочность), абордаж, стрельба */
export type ShipStat = 'speed' | 'sea' | 'hull' | 'board' | 'fire'
export const SHIP_STATS: { key: ShipStat; name: string; about: string }[] = [
  { key: 'speed', name: 'Ход', about: 'скорость под парусом и вёслами; сколько миль в день' },
  { key: 'sea', name: 'Мореходность', about: 'открытое море, шторм, зима; у галер и ладей — низкая' },
  { key: 'hull', name: 'Борт', about: 'прочность корпуса: таран, ядра, огонь' },
  { key: 'board', name: 'Абордаж', about: 'сила команды и морской пехоты в схватке борт о борт' },
  { key: 'fire', name: 'Стрельба', about: 'луки, баллисты, пушки — бой на расстоянии' }
]

export interface ShipType {
  key: string; name: string; icon: string
  /** силуэт для рисунка: галера, парусник, драккар, линейный, лодка, крепость */
  shape: 'galley' | 'sail' | 'longship' | 'line' | 'boat' | 'fort' | 'swan'
  stats: Record<ShipStat, number>
  /** люди: команда (моряки и гребцы) и сколько солдат берёт на борт */
  crew: number; troops: number
  /** груз, в тоннах хлеба */
  cargo: number
  /** марок за ход на корабль (до COST_SCALE) и дней постройки */
  cost: number; build: number
  req?: Req
  note: string
}
export const SHIPS: ShipType[] = [
  { key: 'boat', name: 'Ладья', icon: '🛶', shape: 'boat', stats: { speed: 7, sea: 3, hull: 2, board: 3, fire: 1 }, crew: 15, troops: 20, cargo: 8, cost: 0.6, build: 20, note: 'речная и прибрежная лодка; дёшево и много' },
  { key: 'longship', name: 'Драккар', icon: '⛵', shape: 'longship', stats: { speed: 12, sea: 8, hull: 5, board: 9, fire: 2 }, crew: 50, troops: 0, cargo: 10, cost: 1.8, build: 40, note: 'команда и есть войско: гребцы сами идут на берег' },
  { key: 'galley', name: 'Галера', icon: '🚣', shape: 'galley', stats: { speed: 10, sea: 3, hull: 7, board: 8, fire: 3 }, crew: 160, troops: 60, cargo: 15, cost: 3.5, build: 50, note: 'вёсла и таран; в штиль быстра, в шторм и зимой стоит в гавани' },
  { key: 'cog', name: 'Когг', icon: '🚢', shape: 'sail', stats: { speed: 6, sea: 9, hull: 9, board: 6, fire: 5 }, crew: 30, troops: 100, cargo: 80, cost: 2.5, build: 45, note: 'высокий борт и башни для стрелков; основа перевозок' },
  { key: 'hulk', name: 'Хольк', icon: '🛳', shape: 'sail', stats: { speed: 5, sea: 9, hull: 10, board: 4, fire: 3 }, crew: 35, troops: 180, cargo: 160, cost: 2.8, build: 55, note: 'большой грузовой; везёт полк или хлеб на месяц' },
  { key: 'caravel', name: 'Каравелла', icon: '⛵', shape: 'sail', stats: { speed: 11, sea: 11, hull: 7, board: 5, fire: 6 }, crew: 40, troops: 50, cargo: 50, cost: 3, build: 50, req: { sea: 3 }, note: 'косые паруса: идёт против ветра; разведка и дальние плавания' },
  { key: 'carrack', name: 'Каракка', icon: '🛳', shape: 'sail', stats: { speed: 7, sea: 12, hull: 13, board: 9, fire: 9 }, crew: 90, troops: 200, cargo: 200, cost: 6, build: 80, req: { sea: 3 }, note: 'высокие надстройки; плавучая крепость для стрелков' },
  { key: 'galleass', name: 'Галеас', icon: '🚢', shape: 'galley', stats: { speed: 8, sea: 6, hull: 12, board: 9, fire: 13 }, crew: 300, troops: 120, cargo: 40, cost: 8, build: 90, req: { powder: 3 }, note: 'галера с пушками по бортам' },
  { key: 'warship', name: 'Линейный корабль', icon: '⚓', shape: 'line', stats: { speed: 8, sea: 13, hull: 16, board: 8, fire: 17 }, crew: 250, troops: 100, cargo: 60, cost: 10, build: 120, req: { powder: 4, sea: 4 }, note: 'две палубы пушек; бой в линию' },
  { key: 'fireship', name: 'Брандер', icon: '🔥', shape: 'boat', stats: { speed: 8, sea: 5, hull: 2, board: 1, fire: 15 }, crew: 10, troops: 0, cargo: 0, cost: 1, build: 15, note: 'набит смолой и порохом; пускают на вражеский строй — сгорает сам' },
  { key: 'fort', name: 'Плавучая крепость', icon: '🏰', shape: 'fort', stats: { speed: 2, sea: 7, hull: 20, board: 12, fire: 14 }, crew: 400, troops: 400, cargo: 300, cost: 18, build: 200, note: 'стоит у гавани и не пускает чужих; почти не ходит' },
  { key: 'riverboat', name: 'Речная галера', icon: '🚣', shape: 'galley', stats: { speed: 8, sea: 1, hull: 5, board: 6, fire: 3 }, crew: 60, troops: 40, cargo: 20, cost: 1.5, build: 30, note: 'для рек и озёр; в море не выходит' },
  { key: 'swan', name: 'Корабль-лебедь', icon: '🦢', shape: 'swan', stats: { speed: 14, sea: 12, hull: 8, board: 7, fire: 8 }, crew: 40, troops: 40, cargo: 30, cost: 5, build: 120, note: 'эльфийская работа: лёгкий, быстрый, живое дерево' }
]
export const SHIP = Object.fromEntries(SHIPS.map((s) => [s.key, s])) as Record<string, ShipType>

/** вооружение эскадры: поправки к стрельбе и абордажу, цена */
export const ARMAMENT: Record<string, { name: string; mods: Partial<Record<ShipStat, number>>; cost: number; req?: Req; note: string }> = {
  board: { name: 'Абордажники', mods: { board: 4 }, cost: 0.5, note: 'морская пехота, крючья и сети' },
  archers: { name: 'Лучники на башнях', mods: { fire: 3, board: 1 }, cost: 0.4, note: 'стрелы с марсов и надстроек' },
  ballista: { name: 'Баллисты', mods: { fire: 5, hull: -1 }, cost: 0.8, note: 'болты и горшки со смолой' },
  ram: { name: 'Таран', mods: { hull: 3, board: 1 }, cost: 0.3, note: 'окованный нос' },
  guns: { name: 'Пушки', mods: { fire: 7, hull: 1 }, cost: 1.5, req: { powder: 3 }, note: 'бортовые орудия' },
  fire: { name: 'Огненные горшки', mods: { fire: 4 }, cost: 0.7, note: 'зажигательная смесь' },
  magic: { name: 'Маг бурь', mods: { fire: 4, speed: 2 }, cost: 2, req: { magic: 3 }, note: 'ветер в паруса, молния во врага' }
}

/** выучка команды */
export const CREW: Record<string, { name: string; mods: Partial<Record<ShipStat, number>> }> = {
  raw: { name: 'набранная наспех', mods: { speed: -1, sea: -1, board: -1 } },
  common: { name: 'обычная', mods: {} },
  seasoned: { name: 'бывалая', mods: { speed: 1, sea: 1, board: 1 } },
  elite: { name: 'лучшие моряки', mods: { speed: 2, sea: 2, board: 2, fire: 1 } }
}

export interface Squadron {
  id: string; name: string
  ship: string; count: number
  arm: string; crew: string
  /** порт базирования (провинция) */
  base?: number
  cmd: { name: string; trait: string }
  colors: [string, string]
  lore?: string; note?: string
  /** торговые суда, что выходят на войну по найму: в мирное время казне почти ничего не стоят */
  merchant?: boolean
}
export interface Fleet { id: string; name: string; squadrons: string[]; base?: number; cmd?: { name: string; trait: string }; lore?: string; note?: string }
export interface StateNavy { fleets: Fleet[]; squadrons: Squadron[] }

export const NAVY_COST_SCALE = 0.5
export function squadronStats(s: Squadron): { stats: Record<ShipStat, number>; cost: number; crew: number; troops: number; cargo: number } {
  const t = SHIP[s.ship] ?? SHIP.cog
  const st = { ...t.stats }
  const a = ARMAMENT[s.arm], c = CREW[s.crew]
  for (const m of [a?.mods, c?.mods]) if (m) for (const [k, v] of Object.entries(m) as [ShipStat, number][]) st[k] += v
  for (const k of Object.keys(st) as ShipStat[]) st[k] = Math.max(0, Math.min(20, st[k]))
  return { stats: st, cost: Math.round(s.count * (t.cost + (a?.cost ?? 0)) * NAVY_COST_SCALE * (s.merchant ? 0.15 : 1) * 10) / 10, crew: s.count * t.crew, troops: s.count * t.troops, cargo: s.count * t.cargo }
}
/** сила эскадры одним числом */
export const squadronPower = (s: Squadron): number => { const r = squadronStats(s).stats; return Math.round(s.count * (r.hull * 0.8 + r.board + r.fire * 1.1 + r.speed * 0.3) ) }
/** миль в день при попутном ветре (для калькулятора похода морем) */
export const milesPerDay = (speed: number): number => Math.round(25 + speed * 6)
