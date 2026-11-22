/**
 * Военная система ВПИ (docs/впи-армия.md): каталог родов войск и деталей конструктора, снаряжение, магия, черты,
 * качество, народы и края набора; данные роты и соединений страны; расчёт характеристик и цены роты.
 * Характеристики 0–20: натиск, стрельба, дальность, стойкость, защита, подвижность, дух, дисциплина.
 */
import type { Good } from './economy'
import type { TechLine } from './tech'

export type Stat = 'atk' | 'fire' | 'rng' | 'hold' | 'def' | 'mov' | 'mor' | 'dis'
export const STATS: { key: Stat; name: string; about: string }[] = [
  { key: 'atk', name: 'Натиск', about: 'рукопашная атака' },
  { key: 'fire', name: 'Стрельба', about: 'сила дальнего боя' },
  { key: 'rng', name: 'Дальность', about: 'как далеко бьют' },
  { key: 'hold', name: 'Стойкость', about: 'держать строй под ударом' },
  { key: 'def', name: 'Защита', about: 'доспех и щит' },
  { key: 'mov', name: 'Подвижность', about: 'скорость на марше и в бою' },
  { key: 'mor', name: 'Дух', about: 'сколько вытерпят до бегства' },
  { key: 'dis', name: 'Дисциплина', about: 'управляемость, сложные построения' }
]
export type Mods = Partial<Record<Stat, number>>
export type Level = 'company' | 'battalion' | 'regiment' | 'corps' | 'army'
export const LEVELS: Level[] = ['company', 'battalion', 'regiment', 'corps', 'army']

/** требование технологии: линия ≥ уровень */
export type Req = Partial<Record<TechLine, number>>

export interface ArmDef { key: string; name: string; icon: string; base: Required<Mods>; men: number; cost: number; goods: Partial<Record<Good, number>>; from: string; req?: Req; role: 'line' | 'missile' | 'horse' | 'support' | 'special'; ship?: boolean }
const B = (atk: number, fire: number, rng: number, hold: number, def: number, mov: number, mor: number, dis: number): Required<Mods> => ({ atk, fire, rng, hold, def, mov, mor, dis })

/** Рода войск — основа роты. cost — марок за ход на роту, goods — товары на содержание за ход */
export const ARMS: ArmDef[] = [
  { key: 'line', name: 'Строевая пехота', icon: '🛡', base: B(6, 0, 0, 8, 5, 5, 7, 6), men: 150, cost: 6, goods: { grain: 8, cloth: 1 }, from: 'кормильцы и мастера', role: 'line' },
  { key: 'light', name: 'Лёгкая пехота', icon: '🗡', base: B(5, 1, 1, 4, 3, 8, 6, 5), men: 120, cost: 4.5, goods: { grain: 6, cloth: 0.6 }, from: 'кормильцы', role: 'line' },
  { key: 'archers', name: 'Лучники', icon: '🏹', base: B(2, 7, 6, 3, 2, 6, 5, 5), men: 120, cost: 5, goods: { grain: 6, wood: 0.5 }, from: 'кормильцы', role: 'missile' },
  { key: 'xbow', name: 'Арбалетчики', icon: '🎯', base: B(2, 8, 5, 4, 3, 5, 5, 6), men: 120, cost: 6, goods: { grain: 6, iron: 0.4 }, from: 'мастера', role: 'missile' },
  { key: 'guns', name: 'Огнестрельные стрелки', icon: '💥', base: B(2, 10, 4, 4, 2, 5, 5, 6), men: 120, cost: 8, goods: { grain: 6, powder: 0.6, iron: 0.3 }, from: 'мастера', req: { powder: 3 }, role: 'missile' },
  { key: 'heavycav', name: 'Тяжёлая конница', icon: '🐎', base: B(12, 0, 0, 6, 8, 8, 8, 6), men: 60, cost: 14, goods: { grain: 10, horses: 0.4, arms: 0.2 }, from: 'правящие', role: 'horse' },
  { key: 'lightcav', name: 'Лёгкая конница', icon: '🏇', base: B(7, 0, 0, 3, 3, 12, 6, 5), men: 80, cost: 9, goods: { grain: 8, horses: 0.4 }, from: 'кормильцы и правящие', role: 'horse' },
  { key: 'horsearch', name: 'Конные стрелки', icon: '🐴', base: B(4, 6, 5, 3, 3, 12, 6, 6), men: 80, cost: 10, goods: { grain: 8, horses: 0.4, wood: 0.3 }, from: 'кормильцы и правящие', role: 'horse' },
  { key: 'siege', name: 'Осадные машины', icon: '🪨', base: B(0, 6, 8, 2, 2, 2, 5, 6), men: 60, cost: 8, goods: { wood: 2, tools: 0.3 }, from: 'мастера', role: 'support' },
  { key: 'cannon', name: 'Пушки', icon: '🧨', base: B(0, 12, 8, 2, 2, 2, 5, 7), men: 50, cost: 14, goods: { powder: 1.5, iron: 0.6 }, from: 'мастера', req: { powder: 3 }, role: 'support' },
  { key: 'mages', name: 'Боевые маги', icon: '✨', base: B(2, 9, 6, 3, 2, 5, 8, 7), men: 12, cost: 20, goods: { reagents: 0.6, luxury: 0.2 }, from: 'учёные', req: { magic: 3 }, role: 'special' },
  { key: 'templars', name: 'Храмовые воины', icon: '☀', base: B(9, 0, 0, 9, 8, 5, 12, 8), men: 80, cost: 12, goods: { grain: 6, arms: 0.3 }, from: 'служители', req: { magic: 2 }, role: 'special' },
  { key: 'beasts', name: 'Звери и ездовые чудища', icon: '🐺', base: B(10, 0, 0, 4, 4, 10, 7, 3), men: 50, cost: 10, goods: { cattle: 3 }, from: 'кормильцы', role: 'horse' },
  { key: 'scouts', name: 'Разведчики', icon: '👁', base: B(3, 3, 3, 2, 2, 13, 6, 6), men: 40, cost: 5, goods: { grain: 3 }, from: 'кормильцы', role: 'support' },
  { key: 'sappers', name: 'Сапёры и обоз', icon: '⛏', base: B(2, 0, 0, 4, 3, 4, 5, 6), men: 100, cost: 4, goods: { tools: 0.4, wood: 1 }, from: 'мастера', role: 'support' },
  { key: 'marines', name: 'Морская пехота', icon: '⚓', base: B(7, 1, 1, 6, 4, 6, 7, 6), men: 100, cost: 7, goods: { grain: 6, fish: 2 }, from: 'мастера и кормильцы', role: 'line' }
]
export const ARM = Object.fromEntries(ARMS.map((a) => [a.key, a])) as Record<string, ArmDef>

export type Slot = 'weapon' | 'armor' | 'shield' | 'mount' | 'training' | 'formation' | 'banner' | 'train'
export const SLOTS: { key: Slot; name: string }[] = [
  { key: 'weapon', name: 'Оружие' }, { key: 'armor', name: 'Доспех' }, { key: 'shield', name: 'Щит' }, { key: 'mount', name: 'Конь или зверь' },
  { key: 'training', name: 'Выучка' }, { key: 'formation', name: 'Построение' }, { key: 'banner', name: 'Знамя и традиция' }, { key: 'train', name: 'Обоз' }
]
export interface Part { id: string; slot: Slot; name: string; mods: Mods; cost: number; goods?: Partial<Record<Good, number>>; req?: Req; for?: string[]; note?: string }
const P = (slot: Slot, id: string, name: string, mods: Mods, cost: number, extra: Partial<Part> = {}): Part => ({ id, slot, name, mods, cost, ...extra })
const FOOT = ['line', 'light', 'marines', 'templars']
const HORSE = ['heavycav', 'lightcav', 'horsearch', 'beasts']
const SHOOT = ['archers', 'xbow', 'guns', 'horsearch']

/** ≈ 110 деталей конструктора */
export const PARTS: Part[] = [
  // ---- оружие ближнего боя ----
  P('weapon', 'club', 'Дубина и топор', { atk: 0, dis: -1 }, -0.5, { for: [...FOOT, 'beasts'] }),
  P('weapon', 'spear', 'Копьё', { atk: 1, hold: 2 }, 0, { for: FOOT, goods: { wood: 0.2 } }),
  P('weapon', 'pike', 'Пика', { atk: 1, hold: 4, mov: -1, dis: 1 }, 0.4, { for: FOOT, goods: { wood: 0.3 } }),
  P('weapon', 'sword', 'Меч', { atk: 3, hold: 1 }, 0.8, { for: FOOT, goods: { iron: 0.2 } }),
  P('weapon', 'gladius', 'Короткий меч легиона', { atk: 3, hold: 2, dis: 1 }, 0.8, { for: FOOT, goods: { iron: 0.2 } }),
  P('weapon', 'axe', 'Боевой топор', { atk: 4, def: -1 }, 0.5, { for: FOOT, goods: { iron: 0.2 } }),
  P('weapon', 'daneaxe', 'Двуручная секира', { atk: 6, hold: -1, def: -1 }, 0.9, { for: FOOT, goods: { iron: 0.3 } }),
  P('weapon', 'halberd', 'Алебарда', { atk: 4, hold: 3, mov: -1 }, 1, { for: FOOT, goods: { iron: 0.3 } }),
  P('weapon', 'glaive', 'Глефа', { atk: 4, hold: 2 }, 0.9, { for: FOOT, goods: { iron: 0.25 } }),
  P('weapon', 'zweih', 'Двуручный меч', { atk: 6, hold: 0, mov: -1 }, 1.4, { for: FOOT, goods: { iron: 0.4 } }),
  P('weapon', 'mace', 'Булава и молот', { atk: 3, def: 1 }, 0.7, { for: [...FOOT, ...HORSE], goods: { iron: 0.3 } }),
  P('weapon', 'flail', 'Цеп', { atk: 3, dis: -1 }, 0.2, { for: FOOT }),
  P('weapon', 'scythe', 'Боевая коса', { atk: 2, mor: 1 }, -0.2, { for: FOOT, note: 'оружие ополчения и бунтов' }),
  P('weapon', 'elfblade', 'Эльфийский клинок', { atk: 4, mov: 1, dis: 1 }, 1.6, { for: FOOT, goods: { luxury: 0.05 } }),
  P('weapon', 'runeaxe', 'Рунный топор дварфов', { atk: 6, mor: 1 }, 2, { for: FOOT, req: { magic: 1 }, goods: { iron: 0.4 } }),
  P('weapon', 'sabre', 'Сабля', { atk: 4, mov: 1 }, 0.8, { for: HORSE, goods: { iron: 0.2 } }),
  P('weapon', 'lance', 'Кавалерийское копьё', { atk: 5, hold: -1 }, 0.6, { for: HORSE, goods: { wood: 0.3 } }),
  P('weapon', 'warlance', 'Рыцарское копьё и меч', { atk: 7 }, 1.6, { for: HORSE, goods: { iron: 0.3, wood: 0.3 } }),
  P('weapon', 'javelin', 'Дротики', { atk: 1, fire: 2, rng: 1 }, 0.3, { for: [...FOOT, ...HORSE] }),
  // ---- метательное ----
  P('weapon', 'shortbow', 'Короткий лук', { fire: 0 }, 0, { for: SHOOT }),
  P('weapon', 'longbow', 'Длинный лук', { fire: 3, rng: 2, dis: 1 }, 1, { for: ['archers'], note: 'годы выучки' }),
  P('weapon', 'compbow', 'Составной лук степей', { fire: 2, rng: 1, mov: 1 }, 1, { for: SHOOT }),
  P('weapon', 'elfbow', 'Лук Корня', { fire: 4, rng: 3 }, 1.8, { for: ['archers', 'horsearch'], goods: { luxury: 0.05 } }),
  P('weapon', 'sling', 'Праща', { fire: -2, rng: -1, mov: 1 }, -0.5, { for: SHOOT }),
  P('weapon', 'xbow', 'Арбалет', { fire: 1, def: 1 }, 0.6, { for: ['xbow'], goods: { iron: 0.2 } }),
  P('weapon', 'heavyxbow', 'Тяжёлый арбалет с воротом', { fire: 3, rng: 1, mov: -1 }, 1.2, { for: ['xbow'], goods: { iron: 0.3, tools: 0.05 } }),
  P('weapon', 'gnomexbow', 'Гномий самострел', { fire: 4, rng: 1, dis: 1 }, 1.8, { for: ['xbow'], req: { gear: 3 }, goods: { tools: 0.15 } }),
  P('weapon', 'handgonne', 'Ручница', { fire: 0, rng: -1, mor: 1 }, 0.4, { for: ['guns'], req: { powder: 2 } }),
  P('weapon', 'arquebus', 'Аркебуза', { fire: 2 }, 1, { for: ['guns'], req: { powder: 3 }, goods: { iron: 0.2 } }),
  P('weapon', 'musket', 'Мушкет', { fire: 4, rng: 1, mov: -1 }, 1.6, { for: ['guns'], req: { powder: 4 }, goods: { iron: 0.3 } }),
  P('weapon', 'blunder', 'Мушкетон', { fire: 3, rng: -2, atk: 1 }, 1.2, { for: ['guns', 'marines'], req: { powder: 3 } }),
  P('weapon', 'rockets', 'Огненные стрелы и ракеты', { fire: 3, rng: 2, dis: -1, mor: 1 }, 1.4, { for: ['archers', 'siege'], req: { powder: 3 }, goods: { powder: 0.3 } }),
  // ---- машины и орудия ----
  P('weapon', 'ballista', 'Баллисты', { fire: 0 }, 0, { for: ['siege'] }),
  P('weapon', 'trebuchet', 'Требушеты', { fire: 3, rng: 3, mov: -1 }, 2, { for: ['siege'], goods: { wood: 1 } }),
  P('weapon', 'bombard', 'Бомбарды', { fire: 2, rng: -1, mov: -1 }, 1, { for: ['cannon'], req: { powder: 3 } }),
  P('weapon', 'culverin', 'Кулеврины', { fire: 3, rng: 2 }, 2, { for: ['cannon'], req: { powder: 4 }, goods: { copper: 0.3 } }),
  P('weapon', 'falconet', 'Фальконеты', { fire: 1, mov: 2 }, 1.2, { for: ['cannon'], req: { powder: 4 } }),
  P('weapon', 'firestaff', 'Посохи огня', { fire: 3, mor: 1 }, 2, { for: ['mages'], goods: { reagents: 0.2 } }),
  P('weapon', 'wards', 'Чары защиты', { fire: -3, def: 4, hold: 2 }, 1.5, { for: ['mages'] }),
  // ---- доспехи ----
  P('armor', 'none', 'Без доспеха', { def: -3, mov: 2 }, -1),
  P('armor', 'hide', 'Шкуры и кожа', { def: -1, mov: 1 }, -0.5, { goods: { cattle: 0.1 } }),
  P('armor', 'gambeson', 'Стёганка', { def: 0 }, 0, { goods: { cloth: 0.3 } }),
  P('armor', 'lamellar', 'Ламелляр', { def: 2, mov: -0.5 }, 0.8, { goods: { iron: 0.2 } }),
  P('armor', 'mail', 'Кольчуга', { def: 2 }, 1, { goods: { iron: 0.3 } }),
  P('armor', 'scale', 'Чешуя', { def: 3, mov: -1 }, 1.2, { goods: { iron: 0.35 } }),
  P('armor', 'lorica', 'Лорика легиона', { def: 3, hold: 1, mov: -0.5 }, 1.3, { goods: { iron: 0.35 } }),
  P('armor', 'brigandine', 'Бригантина', { def: 3, mov: -0.5 }, 1.3, { goods: { iron: 0.3, cloth: 0.2 } }),
  P('armor', 'halfplate', 'Полулаты', { def: 4, mov: -1 }, 2, { goods: { iron: 0.5 } }),
  P('armor', 'plate', 'Латы', { def: 6, mov: -2, mor: 1 }, 3.5, { goods: { iron: 0.8 } }),
  P('armor', 'gothic', 'Готические латы', { def: 7, mov: -2, mor: 1 }, 4.5, { req: { gear: 3 }, goods: { iron: 0.9 } }),
  P('armor', 'runeplate', 'Рунные латы дварфов', { def: 8, mov: -3, mor: 2 }, 6, { req: { magic: 2, gear: 3 }, goods: { iron: 1 } }),
  P('armor', 'elfmail', 'Эльфийская чешуя', { def: 4, mov: 0 }, 3, { goods: { luxury: 0.1 } }),
  P('armor', 'barding', 'Конская броня', { def: 3, mov: -2 }, 2, { for: HORSE, goods: { iron: 0.6 } }),
  P('armor', 'robes', 'Мантии и знаки ордена', { def: -1, mor: 2 }, 0.5, { for: ['mages', 'templars'] }),
  P('armor', 'bark', 'Кора и живые латы сильва', { def: 3, hold: 1 }, 0.5, { note: 'растут сами' }),
  // ---- щиты ----
  P('shield', 'noshield', 'Без щита', { def: -1, atk: 1 }, 0),
  P('shield', 'buckler', 'Баклер', { def: 0, mov: 1 }, 0.1),
  P('shield', 'round', 'Круглый щит', { def: 1, hold: 1 }, 0.2, { goods: { wood: 0.1 } }),
  P('shield', 'kite', 'Каплевидный щит', { def: 2, hold: 1 }, 0.3),
  P('shield', 'scutum', 'Ростовой щит легиона', { def: 3, hold: 2, mov: -1 }, 0.5, { goods: { wood: 0.2 } }),
  P('shield', 'pavise', 'Павеза', { def: 4, mov: -2 }, 0.6, { for: ['xbow', 'archers', 'guns'] }),
  P('shield', 'tower', 'Башенный щит', { def: 4, hold: 3, mov: -2 }, 0.7, { for: FOOT }),
  P('shield', 'runeshield', 'Рунный щит', { def: 4, hold: 2, mor: 1 }, 1.5, { req: { magic: 2 } }),
  P('shield', 'wicker', 'Плетёный щит', { def: 1 }, -0.1),
  // ---- кони и звери ----
  P('mount', 'nomount', 'Пешие', {}, 0),
  P('mount', 'pony', 'Горные пони', { mov: -2, hold: 1 }, -1, { for: HORSE, goods: { horses: -0.2 } }),
  P('mount', 'steppe', 'Степные кони', { mov: 2 }, 0, { for: HORSE }),
  P('mount', 'riding', 'Верховые кони', { mov: 0 }, 0.5, { for: HORSE }),
  P('mount', 'warhorse', 'Боевые кони', { atk: 2, mov: -1 }, 2, { for: HORSE, goods: { horses: 0.2 } }),
  P('mount', 'destrier', 'Дестриэ', { atk: 4, def: 1, mov: -2 }, 4, { for: HORSE, goods: { horses: 0.4 } }),
  P('mount', 'camel', 'Верблюды', { mov: 1, mor: 1 }, 1, { for: HORSE, note: 'пугают коней' }),
  P('mount', 'wolf', 'Боевые волки', { atk: 3, mov: 2, dis: -2 }, 1, { for: HORSE, goods: { cattle: 1 } }),
  P('mount', 'boar', 'Вепри', { atk: 4, def: 1, dis: -2 }, 1, { for: HORSE, goods: { cattle: 1 } }),
  P('mount', 'elk', 'Лоси', { atk: 2, mov: 1, hold: 1 }, 1, { for: HORSE }),
  P('mount', 'stag', 'Белые олени эльфов', { mov: 3, mor: 2 }, 2.5, { for: HORSE }),
  P('mount', 'lizard', 'Ездовые ящеры', { atk: 3, def: 2, mov: -1 }, 2, { for: HORSE }),
  // ---- выучка ----
  P('training', 'levy', 'Ополчение', { atk: -2, hold: -2, mor: -2, dis: -3 }, -2),
  P('training', 'trained', 'Обученные', {}, 0),
  P('training', 'veteran', 'Ветераны', { atk: 1, hold: 2, mor: 2, dis: 2 }, 2),
  P('training', 'guard', 'Гвардия', { atk: 2, hold: 3, mor: 4, dis: 4 }, 5),
  // ---- построения ----
  P('formation', 'loose', 'Рассыпной строй', { def: -1, mov: 2, hold: -2 }, 0),
  P('formation', 'close', 'Сомкнутый строй', { hold: 2, mov: -1 }, 0),
  P('formation', 'shieldwall', 'Стена щитов', { hold: 3, def: 2, atk: -1, mov: -2 }, 0),
  P('formation', 'wedge', 'Клин', { atk: 3, hold: -2 }, 0),
  P('formation', 'testudo', 'Черепаха', { def: 5, mov: -3, atk: -2 }, 0, { note: 'против стрел и при штурме' }),
  P('formation', 'square', 'Каре', { hold: 4, mov: -2 }, 0, { note: 'против конницы' }),
  P('formation', 'tercio', 'Терция', { hold: 3, fire: 2, mov: -2, dis: 1 }, 0.5, { req: { powder: 3 } }),
  P('formation', 'phalanx', 'Фаланга', { hold: 5, atk: 1, mov: -3 }, 0),
  P('formation', 'manipular', 'Манипулы', { hold: 1, dis: 2, mov: 1 }, 0.3),
  P('formation', 'skirmish', 'Застрельщики', { fire: 1, mov: 2, hold: -3 }, 0),
  P('formation', 'volley', 'Залповый огонь', { fire: 2, dis: 1 }, 0.2, { for: SHOOT }),
  P('formation', 'caracole', 'Караколь', { fire: 2, atk: -2 }, 0.2, { for: HORSE }),
  P('formation', 'charge', 'Таранный удар', { atk: 3, def: -1 }, 0, { for: HORSE }),
  P('formation', 'swarm', 'Кружение', { mov: 2, fire: 1, hold: -2 }, 0, { for: HORSE }),
  P('formation', 'wagenburg', 'Вагенбург', { hold: 5, def: 3, mov: -4 }, 1, { goods: { wood: 0.5 } }),
  P('formation', 'ambush', 'Засада', { atk: 2, def: -1 }, 0, { note: 'в лесу и в горах' }),
  P('formation', 'boarding', 'Абордажный строй', { atk: 2, mov: 1 }, 0, { for: ['marines'] }),
  P('formation', 'circle', 'Круг жрецов', { mor: 3, hold: 1 }, 0, { for: ['mages', 'templars'] }),
  // ---- знамёна и традиции ----
  P('banner', 'nobanner', 'Без знамени', { mor: -1 }, 0),
  P('banner', 'company', 'Знамя роты', { mor: 1 }, 0.1),
  P('banner', 'house', 'Знамя рода', { mor: 2 }, 0.2, { note: 'знать идёт за своим домом' }),
  P('banner', 'holy', 'Священное знамя', { mor: 3, hold: 1 }, 0.4),
  P('banner', 'legend', 'Легенда части', { mor: 3, dis: 1 }, 0.3, { note: 'старое имя, известное всем' }),
  P('banner', 'eagle', 'Орёл легиона', { mor: 4, dis: 1 }, 0.5, { note: 'потерять орла — позор всего легиона' }),
  // ---- обоз ----
  P('train', 'light', 'Налегке', { mov: 2, mor: -1 }, -0.5),
  P('train', 'normal', 'Обычный обоз', {}, 0),
  P('train', 'full', 'Полный обоз', { mov: -1, mor: 1 }, 0.8, { goods: { grain: 2 } }),
  P('train', 'wagons', 'Боевые повозки', { hold: 2, mov: -1 }, 1, { goods: { wood: 0.3 } }),
  P('train', 'forager', 'Кормятся с земли', { mov: 1, mor: -1 }, -1, { note: 'грабят округу: довольство в области падает' }),
  P('train', 'river', 'Речные ладьи', { mov: 2 }, 0.5, { note: 'только вдоль рек' })
]
export const PART = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<string, Part>

export interface Kit { id: string; name: string; mods: Mods; cost: number; req?: Req; magic?: boolean; note?: string }
/** Снаряжение роты (≈ 25) и магия и вера (≈ 15) */
export const KIT: Kit[] = [
  { id: 'dogs', name: 'Боевые псы', mods: { atk: 1, mor: 1 }, cost: 0.3 },
  { id: 'drums', name: 'Барабаны и флейты', mods: { dis: 2 }, cost: 0.1 },
  { id: 'horns', name: 'Боевые рога', mods: { mor: 1, atk: 1 }, cost: 0.1 },
  { id: 'medic', name: 'Лекарь при роте', mods: { mor: 1 }, cost: 0.5, note: 'меньше потерь от ран и болезней' },
  { id: 'forge', name: 'Полевая кузня', mods: { def: 1 }, cost: 0.5, note: 'чинит доспехи в походе' },
  { id: 'ladders', name: 'Лестницы и крючья', mods: {}, cost: 0.2, note: 'штурм стен' },
  { id: 'ram', name: 'Таран', mods: {}, cost: 0.5, note: 'ворота крепостей' },
  { id: 'rockets', name: 'Сигнальные ракеты', mods: { dis: 1 }, cost: 0.3, req: { powder: 2 } },
  { id: 'caltrops', name: 'Чеснок и колья', mods: { hold: 2 }, cost: 0.2, note: 'против конницы' },
  { id: 'nets', name: 'Сети и арканы', mods: { atk: 1 }, cost: 0.1 },
  { id: 'oil', name: 'Горшки с горючим маслом', mods: { fire: 1 }, cost: 0.4 },
  { id: 'mechanism', name: 'Гномий механизм', mods: { fire: 1, dis: 1 }, cost: 1, req: { gear: 3 }, note: 'заводной самострел, лебёдка, подъёмник' },
  { id: 'spyglass', name: 'Подзорные трубы', mods: { rng: 1 }, cost: 0.4, req: { gear: 3 } },
  { id: 'maps', name: 'Карты и проводники', mods: { mov: 1 }, cost: 0.2 },
  { id: 'skis', name: 'Лыжи и снегоступы', mods: { mov: 1 }, cost: 0.1, note: 'зимой и на севере' },
  { id: 'boats', name: 'Лодки для переправ', mods: { mov: 1 }, cost: 0.3 },
  { id: 'tents', name: 'Шатры и тёплая одежда', mods: { mor: 1 }, cost: 0.3, note: 'меньше потерь зимой' },
  { id: 'wine', name: 'Вино и мясо сверх пайка', mods: { mor: 2 }, cost: 0.6 },
  { id: 'trophies', name: 'Трофеи и знаки побед', mods: { mor: 1 }, cost: 0 },
  { id: 'chains', name: 'Цепи и надсмотрщики', mods: { dis: 2, mor: -2 }, cost: 0.3, note: 'для несвободных' },
  { id: 'pipers', name: 'Волынщики', mods: { mor: 1, dis: 1 }, cost: 0.1 },
  { id: 'hounds', name: 'Ловчие птицы', mods: { mov: 0, dis: 1 }, cost: 0.4, note: 'разведка и вести' },
  { id: 'sappertools', name: 'Шанцевый инструмент', mods: { hold: 1 }, cost: 0.2 },
  { id: 'banners2', name: 'Вымпелы для сигналов', mods: { dis: 1 }, cost: 0.1 },
  { id: 'paint', name: 'Боевая раскраска', mods: { mor: 1 }, cost: 0 },
  // магия и вера
  { id: 'runes', name: 'Руны на щитах', mods: { def: 1, mor: 1 }, cost: 0.8, req: { magic: 1 }, magic: true },
  { id: 'blessing', name: 'Благословение Света', mods: { mor: 2 }, cost: 0.5, req: { magic: 1 }, magic: true },
  { id: 'priest', name: 'Жрец при роте', mods: { mor: 2, hold: 1 }, cost: 0.8, magic: true },
  { id: 'battlemage', name: 'Боевой маг', mods: { fire: 3 }, cost: 3, req: { magic: 3 }, magic: true },
  { id: 'wardmage', name: 'Маг-хранитель', mods: { def: 2 }, cost: 2.5, req: { magic: 3 }, magic: true, note: 'гасит чужие чары и… свой порох' },
  { id: 'amulets', name: 'Обереги', mods: { mor: 1 }, cost: 0.2, magic: true },
  { id: 'vow', name: 'Обет', mods: { mor: 3, dis: 1 }, cost: 0, magic: true, note: 'нарушат — дух рухнет' },
  { id: 'curse', name: 'Проклятие', mods: { mor: -2, atk: 1 }, cost: 0, magic: true },
  { id: 'seidr', name: 'Сейд вёльвы', mods: { mor: 2, atk: 1 }, cost: 1, magic: true },
  { id: 'shaman', name: 'Шаман клана', mods: { mor: 2, dis: -1 }, cost: 0.5, magic: true },
  { id: 'bloodrite', name: 'Обряд крови', mods: { atk: 2, mor: 2, dis: -1 }, cost: 1, req: { magic: 3 }, magic: true },
  { id: 'darkward', name: 'Чары Тьмы', mods: { def: 2, mor: -1 }, cost: 1.5, req: { magic: 3 }, magic: true },
  { id: 'treesong', name: 'Песнь деревьев', mods: { def: 2, mov: 1 }, cost: 1, req: { magic: 3 }, magic: true, note: 'в лесу' },
  { id: 'firecircle', name: 'Огненный круг', mods: { fire: 2, hold: 1 }, cost: 1.5, req: { magic: 3 }, magic: true },
  { id: 'dakashield', name: 'Покров Даки', mods: { def: 3 }, cost: 2, req: { magic: 4 }, magic: true, note: 'порох врагов рядом гаснет' }
]
export const KITS = Object.fromEntries(KIT.map((k) => [k.id, k])) as Record<string, Kit>

/** Черты роты (≈ 70): положительные и отрицательные; часть даётся при наборе, часть — заслуживается */
export interface Trait { id: string; name: string; mods: Mods; good: boolean; note: string }
const T = (id: string, name: string, mods: Mods, good: boolean, note: string): Trait => ({ id, name, mods, good, note })
export const TRAITS: Trait[] = [
  T('stone', 'Каменные', { hold: 3, mor: 2 }, true, 'не отступают никогда'),
  T('swift', 'Быстрые ноги', { mov: 2 }, true, 'марш на полдня быстрее'),
  T('night', 'Ночные', { atk: 1 }, true, 'сильнее в ночном бою'),
  T('horsebane', 'Охотники на конницу', { hold: 2 }, true, '+против конницы'),
  T('sharp', 'Меткие', { fire: 2 }, true, 'стреляют без промаха'),
  T('iron', 'Железная дисциплина', { dis: 3 }, true, 'выполняют любой приказ'),
  T('favor', 'Любимцы правителя', { mor: 2 }, true, 'лучшее жалованье, зависть других'),
  T('mountain', 'Горцы', { mov: 1 }, true, 'в горах как дома'),
  T('forest', 'Лесовики', { def: 1 }, true, 'в лесу незаметны'),
  T('sailors', 'Бывалые моряки', { mov: 1 }, true, 'не страдают в плаваниях'),
  T('winter', 'Зимние', { mor: 1 }, true, 'зимой без потерь'),
  T('sappers', 'Землекопы', { hold: 1 }, true, 'быстро окапываются'),
  T('scouts', 'Глаза армии', { mov: 1, dis: 1 }, true, 'видят врага первыми'),
  T('siege', 'Штурмовики', { atk: 2 }, true, 'лучшие на стенах'),
  T('pious', 'Набожные', { mor: 2 }, true, 'молятся перед боем'),
  T('lucky', 'Везучие', { mor: 1 }, true, 'потерь меньше, чем должно'),
  T('oath', 'Связаны клятвой', { mor: 3 }, true, 'пока жив клянущийся'),
  T('brothers', 'Земляки', { mor: 2, dis: 1 }, true, 'вся рота из одной деревни'),
  T('drillers', 'Строевики', { dis: 2, hold: 1 }, true, 'строятся быстрее всех'),
  T('fearless', 'Бесстрашные', { mor: 4 }, true, 'бегут последними'),
  T('vets', 'Помнят великую войну', { mor: 2, hold: 1 }, true, 'старики учат молодых'),
  T('thrifty', 'Бережливые', {}, true, 'содержание −10 %'),
  T('foragers', 'Добытчики', {}, true, 'обоз почти не нужен'),
  T('craft', 'Свои кузнецы', { def: 1 }, true, 'чинят всё сами'),
  T('rangers', 'Следопыты', { mov: 1 }, true, 'не теряются на бездорожье'),
  T('pikewall', 'Стена копий', { hold: 2 }, true, 'держат натиск'),
  T('shock', 'Ударные', { atk: 2 }, true, 'первыми в прорыв'),
  T('tireless', 'Неутомимые', { mov: 1, mor: 1 }, true, 'идут без привала'),
  T('silent', 'Молчаливые', { dis: 1 }, true, 'не выдают себя'),
  T('heroes', 'Герои битвы', { mor: 3 }, true, 'заслужено в бою'),
  T('banner', 'Спасли знамя', { mor: 2 }, true, 'заслужено в бою'),
  T('trophy', 'Взяли вражеское знамя', { mor: 2, atk: 1 }, true, 'заслужено в бою'),
  T('stormed', 'Первыми на стене', { atk: 2 }, true, 'заслужено при штурме'),
  T('survivors', 'Выжившие', { hold: 2 }, true, 'вышли из окружения'),
  T('beloved', 'Любимы народом', { mor: 1 }, true, 'край набора гордится ими'),
  T('mixed', 'Сборная рота', { dis: -1 }, false, 'люди из разных краёв'),
  T('drunk', 'Пьяницы', { dis: -2, mor: 1 }, false, 'пьют в любой день'),
  T('looters', 'Мародёры', { dis: -1 }, false, 'грабят своих: довольство в области падает'),
  T('green', 'Новобранцы', { mor: -2, dis: -1 }, false, 'ни разу не были в бою'),
  T('cowards', 'Трусоватые', { mor: -3 }, false, 'бегут при первой беде'),
  T('slow', 'Тяжёлые на подъём', { mov: -2 }, false, 'вечно отстают'),
  T('grudge', 'Обижены на командира', { dis: -2 }, false, 'жалованье задержано'),
  T('cursed', 'Проклятые', { mor: -2 }, false, 'о них ходят дурные слухи'),
  T('sick', 'Больные', { hold: -1, mov: -1 }, false, 'лихорадка в лагере'),
  T('mutiny', 'На грани бунта', { dis: -3, mor: -1 }, false, 'ждут повода'),
  T('rivals', 'Вражда с соседней ротой', { dis: -1 }, false, 'дерутся в лагере'),
  T('rusty', 'Ржавое железо', { def: -1 }, false, 'плохие доспехи'),
  T('hungry', 'Голодные', { mor: -2 }, false, 'обоз не поспевает'),
  T('deserters', 'Дезертиры', { mor: -1 }, false, 'каждый ход уходят люди'),
  T('pressed', 'Набраны силой', { mor: -2 }, false, 'не хотят воевать'),
  T('foreign', 'Чужаки', { dis: -1 }, false, 'плохо понимают приказы'),
  T('reckless', 'Безрассудные', { atk: 2, hold: -2 }, false, 'кидаются в бой без приказа'),
  T('rigid', 'Косные', { dis: 1, mov: -1 }, false, 'воюют как деды'),
  T('superstition', 'Суеверные', { mor: -1 }, false, 'боятся знамений и магии'),
  T('hatemagic', 'Ненавидят магов', { mor: 1 }, false, 'не пойдут рядом с магами'),
  T('noble', 'Спесивая знать', { dis: -2, atk: 1 }, false, 'не слушают незнатных'),
  T('greed', 'Жадные', {}, false, 'содержание +15 %'),
  T('lazy', 'Ленивые', { hold: -1 }, false, 'плохо копают и строят'),
  T('homesick', 'Тоскуют по дому', { mor: -1 }, false, 'вдали от родного края'),
  T('wounded', 'Обескровлены', { hold: -2 }, false, 'половина роты в лазарете'),
  T('loud', 'Шумные', { dis: -1 }, false, 'выдают себя в засаде'),
  T('fanatic', 'Фанатики', { mor: 4, dis: -2 }, false, 'умирают, но не слушают'),
  T('slaves', 'Цепные', { mor: -3, dis: 1 }, false, 'воюют под кнутом'),
  T('blood', 'Жажда крови', { atk: 2, dis: -2 }, false, 'не берут пленных'),
  T('oldarms', 'Старое оружие', { atk: -1 }, false, 'деды дрались этим же'),
  T('thin', 'Неполный состав', { hold: -1 }, false, 'не хватает людей'),
  T('spoiled', 'Изнеженные', { mov: -1, mor: -1 }, false, 'не выносят походов'),
  T('debt', 'Ждут жалованья', { mor: -2 }, false, 'казна задолжала'),
  T('ghosts', 'Видят мёртвых', { mor: -1, hold: 1 }, false, 'странная рота')
]
export const TRAIT = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<string, Trait>

/** Качество снаряжения (7 ступеней) */
export const QUALITY: { id: string; name: string; mods: Mods; cost: number }[] = [
  { id: 'poor', name: 'Худое', mods: { def: -2, atk: -1 }, cost: -0.8 },
  { id: 'common', name: 'Обычное', mods: {}, cost: 0 },
  { id: 'good', name: 'Добротное', mods: { def: 1 }, cost: 0.6 },
  { id: 'master', name: 'Мастерское', mods: { def: 1, atk: 1 }, cost: 1.4 },
  { id: 'gnome', name: 'Гномья работа', mods: { def: 1, fire: 1, dis: 1 }, cost: 1.8 },
  { id: 'dwarfsteel', name: 'Дварфийская сталь', mods: { def: 2, atk: 1 }, cost: 2.4 },
  { id: 'rune', name: 'Рунное', mods: { def: 2, atk: 1, mor: 1 }, cost: 3.2 }
]

/** Народы: поправки к характеристикам роты */
export const RACE_MODS: Record<string, Mods> = {
  'Дварфы': { hold: 2, def: 1, mov: -2, mor: 1 }, 'Гномы': { fire: 1, dis: 1, atk: -1, mov: -1 },
  'Эльфы': { fire: 2, mov: 1, hold: -1 }, 'Высшие эльфы': { fire: 2, dis: 1, mor: 1 }, 'Лесные эльфы': { fire: 2, mov: 2, def: -1 },
  'Тёмные эльфы': { atk: 1, mov: 1, dis: 1 }, 'Сумеречные эльфы': { atk: 2, mov: 1, mor: 1 }, 'Полуэльфы': { fire: 1, mov: 1 },
  'Орки': { atk: 2, mor: 1, dis: -2 }, 'Северные орки': { atk: 2, hold: 1, dis: -2 }, 'Огры': { atk: 4, def: 1, mov: -1, dis: -3 },
  'Тролли': { atk: 4, hold: 2, dis: -4 }, 'Гремлины': { mov: 2, atk: -2, dis: -2 }, 'Голиафы': { atk: 3, hold: 2, dis: -1 },
  'Норды': { atk: 1, mor: 1 }, 'Фьяли': { mov: 1, fire: 1 }, 'Элуины': { mor: 1, def: 1 }, 'Илутсы': { mov: 2, def: -1 },
  'Сильва': { hold: 2, def: 1, mov: -1 }, 'Элеоны': { dis: 1, mov: 1 }, 'Момиты': { hold: 1, mor: 1 }, 'Табакси': { mov: 2, atk: 1, dis: -1 },
  'Людоящеры': { def: 2, hold: 1 }, 'Нежить': { mor: 5, mov: -1, dis: 2 }, 'Тифлинги': { atk: 1, mor: 1 }, 'Далорианцы': { dis: 2, def: 1 },
  'Цепной народ': { mor: -2, hold: 1 }, 'Кальтранцы': { atk: 1, mov: 1 }, 'Ярмолы': { mov: 1, fire: 1 }, 'Нарги': { fire: 1, mov: 1 }, 'Дукулиты': { atk: 2, mor: 1 }
}

/** Край набора: по местности и культуре области */
export const REGION_KINDS: Record<string, { name: string; mods: Mods; trait?: string }> = {
  mountain: { name: 'горцы', mods: { mov: 1, hold: 1 }, trait: 'mountain' },
  forest: { name: 'лесовики', mods: { fire: 1, def: 1 }, trait: 'forest' },
  plain: { name: 'равнинные', mods: {} },
  coast: { name: 'приморские', mods: { mov: 1 }, trait: 'sailors' },
  steppe: { name: 'степняки', mods: { mov: 2 } },
  north: { name: 'северяне', mods: { mor: 1 }, trait: 'winter' },
  desert: { name: 'люди пустыни', mods: { mov: 1, hold: 1 } },
  city: { name: 'горожане', mods: { dis: 1, mor: -1 } },
  marsh: { name: 'болотники', mods: { def: 1, mov: -1 } }
}

// ---------- данные роты и соединений ----------
/** Устав (шаблон) роты страны: что собрано в конструкторе */
export interface CompanyTemplate { id: string; name: string; arm: string; parts: Partial<Record<Slot, string>>; kit: string[]; unique?: boolean; note?: string }
/** Рота */
export interface Company {
  id: string; name: string; t: string
  race: string; area?: string; region?: string; quality: string
  traits: string[]; cmd: { name: string; trait: string }
  men: number; xp: number
  colors: [string, string]
  history?: { year: number; text: string }[]
}
/** Соединение: батальон, полк, корпус, армия (дерево) */
export interface Formation {
  id: string; level: Exclude<Level, 'company'>; name: string
  cmd?: { name: string; trait: string; entryId?: string }
  children: string[]
  /** для батальона — роты; места в схеме построения: companyId → место */
  companies?: string[]
  slots?: Record<string, 'van' | 'center' | 'left' | 'right' | 'reserve' | 'train'>
  base?: number
  lore?: string
  colors?: [string, string]
}
export interface StateMilitary {
  /** названия ступеней в стране */
  ladder: Record<Level, string>
  law: { name: string; levy: number; standing: number; nobles: boolean; mercs: boolean; unfree: boolean; orders: boolean; level: 'мир' | 'сбор' | 'великий сбор' | 'всеобщий призыв'; text: string }
  templates: CompanyTemplate[]
  companies: Company[]
  formations: Formation[]
  /** корни дерева (армии и отдельные полки) */
  roots: string[]
}

// ---------- расчёт ----------
export function companyStats(c: Company, tpl: CompanyTemplate | undefined): { stats: Required<Mods>; cost: number; goods: Partial<Record<Good, number>>; parts: { name: string; mods: Mods }[] } {
  const arm = ARM[tpl?.arm ?? 'line'] ?? ARM.line
  const s = { ...arm.base }
  let cost = arm.cost
  const goods: Partial<Record<Good, number>> = { ...arm.goods }
  const parts: { name: string; mods: Mods }[] = []
  const add = (name: string, m: Mods | undefined, k = 1): void => { if (!m) return; parts.push({ name, mods: m }); for (const [key, v] of Object.entries(m) as [Stat, number][]) s[key] += v * k }
  for (const [, pid] of Object.entries(tpl?.parts ?? {})) { const p = PART[pid!]; if (!p) continue; add(p.name, p.mods); cost += p.cost; for (const [g, v] of Object.entries(p.goods ?? {}) as [Good, number][]) goods[g] = (goods[g] ?? 0) + v }
  for (const kid of tpl?.kit ?? []) { const k = KITS[kid]; if (k) { add(k.name, k.mods); cost += k.cost } }
  const q = QUALITY.find((x) => x.id === c.quality); if (q) { add(`Снаряжение: ${q.name.toLowerCase()}`, q.mods); cost += q.cost }
  add(`Народ: ${c.race}`, RACE_MODS[c.race])
  if (c.region && REGION_KINDS[c.region]) add(`Край: ${REGION_KINDS[c.region].name}`, REGION_KINDS[c.region].mods)
  for (const t of c.traits) { const tr = TRAIT[t]; if (tr) { add(`Черта: ${tr.name}`, tr.mods); if (t === 'thrifty') cost *= 0.9; if (t === 'greed') cost *= 1.15 } }
  // опыт: каждые 10 очков — +1 дух и дисциплина (до +3)
  const xp = Math.min(3, Math.floor(c.xp / 10)); if (xp) add('Опыт боёв', { mor: xp, dis: xp })
  for (const k of Object.keys(s) as Stat[]) s[k] = Math.max(0, Math.min(20, Math.round(s[k])))
  const men = c.men / Math.max(1, arm.men)
  return { stats: s, cost: Math.round(cost * men * 10) / 10, goods: Object.fromEntries(Object.entries(goods).map(([g, v]) => [g, Math.round(v! * men * 10) / 10])), parts }
}

/** сила роты одним числом (для сводок): взвешенные характеристики × люди */
export function companyPower(stats: Required<Mods>, men: number): number {
  return Math.round(((stats.atk * 1.2 + stats.fire * 1.1 + stats.hold + stats.def * 0.8 + stats.mov * 0.4 + stats.mor * 0.9 + stats.dis * 0.6) * men) / 100)
}
