/**
 * Жители 3D-городов: как выглядит каждый народ (по анкетам рас, scripts/lore/races.mjs) и кто где живёт.
 * Доли населения придуманы по поручению автора (03.11.2026) — «черновик». Рост и ширина — относительно человека,
 * но великаны ужаты, чтобы проходить в ворота. Людей гладров и имперцев рисуем северо-европейскими.
 */
export type Feat = 'earsLong' | 'earsBig' | 'earsCat' | 'beard' | 'beardBig' | 'horns' | 'hornsBig' | 'tail' | 'tailThick' | 'tusks' | 'snout' | 'beak' | 'wings' | 'leaves' | 'crab'

export interface Race {
  id: string
  name: string
  /** Статья в справочнике мира */
  entry: string
  h: number
  w: number
  skin: string[]
  hair: string[]
  cloth?: string[]
  feats?: Feat[]
  /** Голова без волос: волосы в цвет кожи */
  bald?: boolean
  /** Цвет метки в режиме «Расы» */
  mark: string
}

const PALE = ['#f0d2bc', '#ecc8ae', '#f3dac8', '#e8c6aa']
const BROWN = ['#5b4630', '#8a6a3c', '#c9a860', '#3a2a20', '#a8733c', '#6a5a48']
const FUR = ['#5a4630', '#6e5a40', '#7a6a50', '#4a3c2c']

export const RACES: Race[] = [
  { id: 'imperials', name: 'Имперцы', entry: 'lore-imperials', h: 1, w: 1, skin: PALE, hair: BROWN, mark: '#c9a45c' },
  { id: 'gladry', name: 'Гладры', entry: 'lore-gladry', h: 0.98, w: 1, skin: ['#e6c0a4', '#d9ae8c', '#ecc8ae'], hair: ['#3a2a20', '#5b4630', '#241a14'], mark: '#a8733c' },
  { id: 'nords', name: 'Норды', entry: 'lore-nords', h: 1.09, w: 1.1, skin: ['#f5e2d4', '#f0d8c8'], hair: ['#14121a', '#14121a', '#c96a2e', '#d9c07a'], cloth: FUR, feats: ['beard'], mark: '#6fa8c9' },
  { id: 'yarmoly', name: 'Ярмолы', entry: 'lore-yarmoly', h: 1.08, w: 0.9, skin: ['#d9a35f', '#cf9a58'], hair: ['#d9a35f'], bald: true, cloth: ['#c9a23c', '#8a3f2a', '#e0d4b0'], mark: '#e0b050' },
  { id: 'nargi', name: 'Нарги', entry: 'lore-nargi', h: 0.9, w: 0.88, skin: ['#8a5c3a', '#7a4f30'], hair: ['#3a2618', '#2a1c12'], cloth: ['#d9c4a0', '#c97a3a', '#a8553a'], mark: '#b8703a' },
  { id: 'dukulites', name: 'Дукулиты', entry: 'lore-dukulites', h: 1.04, w: 1.08, skin: ['#3a2820', '#2e201a'], hair: ['#100c0a'], cloth: ['#1e1a1e', '#6a1f1f', '#2a2a2a'], mark: '#7a2f3f' },
  { id: 'gordols', name: 'Гордолы', entry: 'lore-gordols', h: 0.76, w: 0.92, skin: PALE, hair: BROWN, cloth: ['#3f5f7a', '#6a5a8a', '#7a6a3a'], mark: '#8a7ac9' },
  { id: 'roma', name: 'Синти и Рома', entry: 'lore-roma', h: 0.98, w: 0.94, skin: ['#b98a60', '#a87a50'], hair: ['#1a1410', '#2a1c14'], cloth: ['#c0392b', '#d9a23c', '#8e3f9a', '#2f8a7a'], mark: '#d94f8a' },
  { id: 'momits', name: 'Момиты', entry: 'lore-momits', h: 1, w: 0.95, skin: ['#e6c0a4', '#d9b090'], hair: ['#8a8a8a', '#3a2a20'], cloth: ['#7a8a8a', '#5a6a6a'], mark: '#8a9a9a' },
  { id: 'dwarves', name: 'Дварфы', entry: 'lore-dwarves', h: 0.74, w: 1.42, skin: ['#d9a48a', '#c98a70', '#8a5c44'], hair: ['#c9602a', '#3a2a20', '#7a7a7a', '#14121a'], cloth: ['#5a5048', '#6a4a30', '#4a4a52'], feats: ['beardBig'], mark: '#c9602a' },
  { id: 'gnomes', name: 'Гномы', entry: 'lore-gnomes', h: 0.56, w: 0.9, skin: ['#b98a60', '#a87a50'], hair: ['#d9c07a', '#c9a860'], cloth: ['#4a6a5a', '#6a5a4a', '#3f5f7a'], feats: ['beard', 'earsBig'], mark: '#e8d040' },
  { id: 'high-elves', name: 'Высшие эльфы', entry: 'lore-high-elves', h: 1.08, w: 0.82, skin: ['#c9965a', '#efe6e8', '#e2dcef'], hair: ['#e0c050', '#d8e0ef', '#3f5fb0', '#b0602a'], cloth: ['#e8e0c8', '#3f5f8a', '#c9b060'], feats: ['earsLong'], mark: '#f2f0a0' },
  { id: 'wood-elves', name: 'Лесные эльфы', entry: 'lore-wood-elves', h: 1.02, w: 0.82, skin: ['#b07a50', '#a87a4a', '#a08a50'], hair: ['#3a2a20', '#5b4630', '#3f7a3f'], cloth: ['#3f6a3a', '#5a6a30', '#6a5a30'], feats: ['earsLong'], mark: '#5fc05f' },
  { id: 'dark-elves', name: 'Тёмные эльфы', entry: 'lore-dark-elves', h: 0.94, w: 0.8, skin: ['#1e1a24', '#2a2430'], hair: ['#f4f4f4'], cloth: ['#2a1f3a', '#3a2a4a', '#1a1a22'], feats: ['earsLong'], mark: '#a060e0' },
  { id: 'sylva', name: 'Сильва', entry: 'lore-sylva', h: 1, w: 0.9, skin: ['#6a5a30', '#5a6a30', '#7a5a2c'], hair: ['#6a5a30'], bald: true, cloth: ['#5a6a30', '#4a5a2c', '#6a5a30'], feats: ['leaves'], mark: '#7fe07f' },
  { id: 'eleons', name: 'Элеоны', entry: 'lore-eleons', h: 1.08, w: 0.98, skin: PALE, hair: ['#14121a', '#8a8a8a'], cloth: ['#2f5f7a', '#d8d2c0'], feats: ['beard', 'earsLong'], mark: '#40b0c0' },
  { id: 'eluins', name: 'Элуины', entry: 'lore-eluins', h: 1.02, w: 0.88, skin: ['#f4ece0', '#efe6dc'], hair: ['#e8e0c8', '#d9c98a'], cloth: ['#efe8d8', '#3f8088'], mark: '#c0e8f0' },
  { id: 'dalorians', name: 'Далорианцы', entry: 'lore-dalorians', h: 0.98, w: 0.92, skin: ['#3f5fc0', '#5a7ac9', '#6a7a9a'], hair: ['#d8d8d8', '#14121a', '#7a1f2f'], cloth: ['#2a2a3a', '#4a2030'], mark: '#3f6fe0' },
  { id: 'tieflings', name: 'Тифлинги', entry: 'lore-tieflings', h: 1, w: 0.95, skin: ['#b03a30', '#c9a080', '#9a2f2a'], hair: ['#14121a', '#5a1a20', '#2a2a6a'], cloth: ['#2a1f2a', '#4a1f2a'], feats: ['hornsBig', 'tail'], mark: '#e04030' },
  { id: 'demons', name: 'Демоны', entry: 'lore-demons', h: 1.06, w: 1.04, skin: ['#c9a080', '#8a2f2a'], hair: ['#14121a', '#c9b060'], cloth: ['#1a1218', '#4a1018'], feats: ['hornsBig', 'wings'], mark: '#ff3020' },
  { id: 'vampires', name: 'Вампиры', entry: 'lore-vampires', h: 1.04, w: 0.9, skin: ['#f4f2f0', '#ece8ea'], hair: ['#0e0c10'], cloth: ['#120e14', '#2a0e14'], mark: '#e0e0f0' },
  { id: 'skugga', name: 'Скугга', entry: 'lore-skugga', h: 1.1, w: 0.84, skin: ['#efeae8', '#3a3036'], hair: ['#e0e0e0', '#14121a'], cloth: ['#2a2a30', '#3a3440'], mark: '#7a7a90' },
  { id: 'reig', name: 'Рейг-Зироги', entry: 'lore-reig-zirogi', h: 1.28, w: 0.82, skin: ['#4a2a6a', '#3f2460'], hair: ['#1a1420'], cloth: ['#1f2a1a', '#2a1f2a'], feats: ['earsLong'], mark: '#7a30a0' },
  { id: 'goliaths', name: 'Голиафы', entry: 'lore-goliaths', h: 1.26, w: 1.4, skin: ['#f4f4f0', '#ececea'], hair: ['#f4f4f0'], bald: true, cloth: ['#4a4038', '#3a3a3a'], mark: '#ffffff' },
  { id: 'orcs', name: 'Орки', entry: 'lore-orcs', h: 1.03, w: 1.3, skin: ['#6a7a4a', '#5f7050', '#7a8a58'], hair: ['#1a1a14', '#2a2618'], cloth: ['#7a2020', '#a8862e', '#3a3020'], feats: ['tusks', 'earsCat'], mark: '#6fa030' },
  { id: 'ogres', name: 'Огры', entry: 'lore-ogres', h: 1.5, w: 1.6, skin: ['#9a8a60', '#8a7a58'], hair: ['#3a3020'], bald: true, cloth: ['#5a4630', '#4a3a28'], feats: ['tusks'], mark: '#a89a50' },
  { id: 'gremlins', name: 'Гремлины', entry: 'lore-gremlins', h: 0.76, w: 0.85, skin: ['#8a8a8a', '#7a7a80'], hair: ['#7a7a80'], bald: true, cloth: ['#6a5a40', '#4a4a3a'], feats: ['earsBig'], mark: '#909098' },
  { id: 'dragonborn', name: 'Драконорождённые', entry: 'lore-dragonborn', h: 1.16, w: 1.22, skin: ['#b0703a', '#c9a040', '#a84a2a', '#5a8a5a'], hair: ['#8a5a2a'], bald: true, cloth: ['#4a3a30', '#6a2a20'], feats: ['snout', 'horns'], mark: '#e08020' },
  { id: 'lizardfolk', name: 'Людоящеры', entry: 'lore-lizardfolk', h: 1.02, w: 1.02, skin: ['#4f7a3a', '#3f6a4a', '#5f8a3f'], hair: ['#3f6a3a'], bald: true, cloth: ['#5a4a2a', '#4a3a20'], feats: ['snout', 'tailThick'], mark: '#30a070' },
  { id: 'tabaxi', name: 'Табакси', entry: 'lore-tabaxi', h: 1.03, w: 0.9, skin: ['#d9a23c', '#c98a30', '#b87a2a'], hair: ['#7a4a18'], cloth: ['#3f6a5a', '#8a3f2a', '#6a5a30'], feats: ['earsCat', 'tail'], mark: '#f0a030' },
  { id: 'aarakocra', name: 'Ааракокры', entry: 'lore-aarakocra', h: 0.86, w: 0.86, skin: ['#d9402a', '#e08020', '#e0c030', '#8a6a4a'], hair: ['#c9402a', '#e09020', '#8a6a4a'], cloth: ['#7a6a4a'], feats: ['beak', 'wings'], mark: '#f05030' },
  { id: 'humancacer', name: 'Хуманцацеры', entry: 'lore-humancacer', h: 0.98, w: 1.2, skin: ['#b0502a', '#a8402a', '#8a4a30'], hair: ['#a8402a'], bald: true, cloth: ['#b0502a', '#a84a2a'], feats: ['crab'], mark: '#e06a4a' },
  { id: 'kaltrans', name: 'Кальтранцы', entry: 'lore-kaltrans', h: 1.42, w: 1.2, skin: ['#c9a080', '#b89070'], hair: ['#2a2018', '#14121a'], cloth: ['#4a5230', '#6a5a30', '#3a4a2a'], mark: '#8a9a30' },
  { id: 'tsions', name: 'Ционы', entry: 'lore-tsions', h: 1.3, w: 1.34, skin: ['#7a2a20', '#6a2018'], hair: ['#14100c'], cloth: ['#3a3020', '#5a4a30'], mark: '#a02a20' }
]
export const RACE_BY_ID = new Map(RACES.map((r) => [r.id, r]))

export interface PopInput {
  state: string
  culture: string
  style: string
  forest: number
  hills: boolean
  rocky: boolean
  water: boolean
  buildings: number
}
type W = Record<string, number>
const EMPIRE: W = { imperials: 58, gladry: 12, nords: 4, dwarves: 6, gnomes: 5, 'high-elves': 3, 'wood-elves': 2, gremlins: 3, eleons: 1, gordols: 2, roma: 2, dragonborn: 1, tabaxi: 0.6, aarakocra: 0.5, lizardfolk: 0.4, dalorians: 0.6, tsions: 0.5, orcs: 1, ogres: 0.4, skugga: 0.5, 'dark-elves': 0.3, sylva: 0.6, momits: 0.6, yarmoly: 0.8, nargi: 0.6, tieflings: 0.2 }
const TABLES: Record<string, W> = {
  // Святая церковь сжигает тифлингов и не терпит тёмных; зато паломники со всех земель
  church: { imperials: 60, gladry: 18, yarmoly: 5, dwarves: 3, gnomes: 2, 'high-elves': 3, eluins: 5, gordols: 1, nargi: 2, momits: 1 },
  // Корона Аргус: Цепной народ всех рас, сребролистые эльфы, горцы-фьяли
  argus: { imperials: 40, gladry: 16, 'high-elves': 8, 'wood-elves': 5, orcs: 6, gremlins: 5, dwarves: 4, nords: 4, ogres: 1, goliaths: 1, nargi: 2, gnomes: 2, lizardfolk: 1, roma: 1, dalorians: 0.5, skugga: 1 },
  // Имперские изгнанники: ветераны легионов и их семьи над нордскими деревнями
  // Земли Севера: норды, в Гарских копях — дварфы и гномы старой Империи гор
  norse: { nords: 84, dwarves: 5, gnomes: 4, goliaths: 3, imperials: 2, orcs: 1, gladry: 1 },
  exile: { imperials: 46, nords: 34, gladry: 6, dwarves: 4, gnomes: 2, goliaths: 2, skugga: 2, orcs: 1.5, ogres: 0.8 },
  // Штирия: нищие местные, наёмники всех мастей, покупатели Ночного рынка
  styria: { imperials: 62, gladry: 12, orcs: 5, ogres: 2, goliaths: 2, skugga: 4, vampires: 2, 'dark-elves': 2, dukulites: 2, tieflings: 1.5, 'reig': 0.8, roma: 2, dwarves: 2, gremlins: 2, demons: 0.2 },
  // Республика: эшландцы, веринцы, беглецы из-за перевалов — всех рас; дварфы доков
  republic: { imperials: 42, gladry: 22, dwarves: 8, gnomes: 6, 'wood-elves': 3, nords: 3, orcs: 2, gremlins: 3, tieflings: 2, dalorians: 1, roma: 2, nargi: 2, tabaxi: 1, dragonborn: 1, goliaths: 0.5, yarmoly: 1 },
  south: { nargi: 28, gladry: 22, yarmoly: 14, dukulites: 8, roma: 6, imperials: 6, tabaxi: 4, dragonborn: 3, lizardfolk: 3, gordols: 1, aarakocra: 1, tsions: 1.5, gnomes: 1, tieflings: 0.6 },
  kalt: { kaltrans: 52, gladry: 14, tsions: 10, nargi: 8, dragonborn: 5, orcs: 4, roma: 2, dukulites: 3, ogres: 2 },
  nordic: { nords: 70, imperials: 10, dwarves: 8, gnomes: 3, skugga: 3, orcs: 2, goliaths: 2 },
  dwarven: { dwarves: 62, gnomes: 25, imperials: 6, nords: 4, gremlins: 3 },
  elven: { 'high-elves': 35, 'wood-elves': 35, sylva: 12, gremlins: 8, imperials: 4, eleons: 4 },
  eluin: { eluins: 80, imperials: 12, 'high-elves': 5, gnomes: 3 },
  eleon: { eleons: 80, 'high-elves': 8, imperials: 8, gnomes: 2, nords: 2 },
  orcish: { orcs: 75, ogres: 8, gremlins: 8, goliaths: 4, tsions: 5 },
  dark: { 'dark-elves': 40, reig: 15, demons: 5, dukulites: 15, vampires: 8, skugga: 10, tieflings: 7 },
  desert: { yarmoly: 40, nargi: 30, tabaxi: 10, dragonborn: 8, lizardfolk: 4, roma: 8 }
}

/** Кто живёт в этом поселении: основа по государству и культуре, колорит — от местности; чем больше город, тем пестрее */
export function populationFor(i: PopInput): { race: Race; weight: number }[] {
  const base: W = { ...(i.state === 'Республика' ? TABLES.republic : TABLES[i.style] && i.style !== 'empire' ? TABLES[i.style] : TABLES[i.culture] ?? EMPIRE) }
  const up = (id: string, k: number, min = 0): void => { base[id] = Math.max((base[id] ?? 0) * k, min) }
  if (i.forest > 0.2) { up('wood-elves', 3, 2); up('sylva', 3, 0.8); up('gremlins', 0.6) }
  if (i.hills) { up('dwarves', 1.6); up('gnomes', 1.5) }
  if (i.rocky) { up('dwarves', 3, 3); up('gnomes', 2.2, 2); up('goliaths', 2, 0.4); up('orcs', 1.4) }
  if (i.water) { up('humancacer', 1, 1.2); up('nords', 1.5); up('eleons', 1.6); up('aarakocra', 1.3); up('lizardfolk', 1.2) }
  const f = Math.min(1, i.buildings / 300)
  return Object.entries(base)
    .map(([id, w]) => ({ race: RACE_BY_ID.get(id)!, weight: Math.pow(w, 1 + (1 - f) * 0.9) }))
    .filter((q) => q.race && q.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}
