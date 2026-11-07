// История владения провинциями: границы меняются ПОСТЕПЕННО, провинция за провинцией (по ответам автора, 31.10.2026).
//   до 95        княжества центра Лоры, Империя гор, Северное королевство, земли северных орков, шейхства пустыни
//   95           Северная бойня: фронт дварфов идёт на восток к Ул-гхайму
//   100–110      Джакаста I собирает шейхства — Королевство пустынь
//   119–121      Война двух соседей: Дагерфорд берёт Ливенхольм и Зигмарк (Тейбер — генерал, сжигает города)
//   124–130      регент Тейбер присоединяет войной все княжества центра; дольше всех держится горный Штайнгард
//   132 / 138    присяга дварфов и нордов
//   140–150      Великая южная война; 150 — Империя: Алые Королевства, Креит, Святой архипелаг
//   411–413      восстание дварфов «Медные Молоты»; 233–236, 611–614, 863–865 — восстания Джаки; 512–515 — гномы
//   451–488      Лесная война в Эльфборне: медленное продвижение, партизаны; Договор Серебряных Ив отдаёт Империи север
//   975–980      распад: лоялисты Короны и Пакт Ставки и Совета; восстания севера по городам; Республика берёт весь
//                центр и распадается на десятки государств; архиепархии Церкви; Чёрная комната; Имперские изгнанники
// Также: великие дома за регионами Империи (adminRegions.houseId), места битв (places «battle») и хроники битв.
// Запуск после provinces.mjs, smooth-provinces.mjs и seed-lore.mjs: node scripts/history-provinces.mjs
import { readFileSync, writeFileSync } from 'fs'
import { HOUSES } from './lore/empire.mjs'
import { ARMIES as EMPIRE_ARMIES, BATTLES as EMPIRE_BATTLES } from './lore/battles.mjs'
import { ARGUS_ARMIES, ARGUS_BATTLES, ARGUS_REBELS, PRINCIPALITIES } from './lore/argus.mjs'
import { REPUBLIC_ARMIES, REPUBLIC_BATTLES, UPRISINGS, liberation } from './lore/republic.mjs'

const BATTLES = [...EMPIRE_BATTLES, ...ARGUS_BATTLES, ...REPUBLIC_BATTLES]
const ARMIES = [...EMPIRE_ARMIES, ...ARGUS_ARMIES, ...REPUBLIC_ARMIES]
const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
/** Дробный год -> номер дня (115.5 = середина 115 г.) */
const D = (y) => (Math.floor(y) > 0 ? Math.floor(y) - 1 : Math.floor(y)) * YEAR + Math.round((y - Math.floor(y)) * YEAR)
const stateById = new Map(world.states.map((s) => [s.id, s]))
const stateByName = new Map(world.states.map((s) => [s.base.name, s]))
const provs = world.provinces
const provById = new Map(provs.map((p) => [p.id, p]))
const nameOf = (p) => stateById.get(p.state)?.base.name ?? ''
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const regionOf = (p) => admin.get(p.areaId)?.parentId ?? ''
const areaOf = new Map()
for (const p of provs) {
  if (!areaOf.has(p.areaId)) areaOf.set(p.areaId, [])
  areaOf.get(p.areaId).push(p)
}

const CENTRAL = new Set([
  'Империя', 'Графство Мангениум', 'Корона Аргус', 'Графство Штирия', 'Протекторат Лирия', 'Княжество Харнмарк',
  'Королевство Редания', 'Павильон Грёз', 'Империя Кагия', 'Королевство Темерия', 'Кулагон', 'Рейх', 'Таварвайт', 'Фейноко',
  'Семья Каяя', 'Династия Креццака', 'Магнолия', 'Когалым', 'Королевство Болетария', 'Обливиум Каэлорум', 'Архиепархия Луправена',
  'Архиепархия Ошоморида', 'Архиепископия Окрупия', 'Архиепархия Бувезеона', 'Ла Роше', 'Республика', 'Кальтранская Республика',
  'Тоскана', 'Вуфинская Республика', 'Республика Шеша'
])
const MOUNTAIN = new Set(['Фарвольская лига', 'Высокогорное Княжество'])
const NORTH = new Set(['Земли Севера', 'Республика Чеафарал', 'Крайдонианская Лига', 'Имперские Изгнанники', 'Княжества Гарефорда', 'Уунааш', 'Олекохт', 'Объединённые Берега Гренинсворда', 'Северная Башня', 'Братство Бездны'])
const DESERT = new Set(['Джака', 'Кростфорд', 'Офир', 'Пустошь Наллы', 'Церковь Тьмы'])
const JOIN150 = new Set(['Алые Королевства', 'Креит'])
const VASSALS = new Set(['Корона Аргус', 'Графство Мангениум', 'Графство Штирия'])
const CHURCH_LANDS = (n) => /^Архиеп/.test(n) || n === 'Обливиум Каэлорум'

let seed = 1010
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const centroid = (list) => {
  let w = 0, x = 0, y = 0
  for (const p of list) { w += p.px; x += p.x * p.px; y += p.y * p.px }
  return { x: x / w, y: y / w }
}
const biggest = (list) => list.reduce((a, b) => (a.px > b.px ? a : b))

// ---------- группировка областей в княжества и шейхства ----------
function clusterAreas(filter, k, fixedArea) {
  const list = [...areaOf.entries()].filter(([, ps]) => filter(ps[0])).map(([id, ps]) => ({ id, ...centroid(ps), ps }))
  let centers = []
  const fixed = fixedArea ? list.find((a) => a.id === fixedArea) : null
  if (fixed) centers.push({ x: fixed.x, y: fixed.y })
  while (centers.length < k) {
    let best = list[0], bd = -1
    for (const a of list) { const d = Math.min(...centers.map((c) => dist(a, c)), 1e12); if (d > bd) { bd = d; best = a } }
    centers.push({ x: best.x, y: best.y })
  }
  const assign = new Map()
  for (let it = 0; it < 15; it++) {
    const sum = centers.map(() => ({ x: 0, y: 0, n: 0 }))
    for (const a of list) {
      let b = 0, bd = Infinity
      centers.forEach((c, i) => { const d = dist(a, c); if (d < bd) { bd = d; b = i } })
      assign.set(a.id, b)
      sum[b].x += a.x; sum[b].y += a.y; sum[b].n++
    }
    centers = centers.map((c, i) => (fixed && i === 0 ? c : sum[i].n ? { x: sum[i].x / sum[i].n, y: sum[i].y / sum[i].n } : c))
  }
  if (fixed) assign.set(fixed.id, 0)
  const groups = centers.map((c) => ({ ...c, provinces: [] }))
  for (const a of list) groups[assign.get(a.id)].provinces.push(...a.ps)
  return groups.filter((g) => g.provinces.length)
}

const haussler = world.places.find((p) => p.id === 'lore-haussler')
const hauProv = provs.filter((p) => CENTRAL.has(nameOf(p))).reduce((a, b) => (dist(a, haussler) < dist(b, haussler) ? a : b))
// имена — по порядку присоединения: два соседа Войны двух соседей, последний — горный Штайнгард
const NEIGHBOUR_NAMES = [['Графство Ливенхольм', '#8a4f55'], ['Княжество Зигмарк', '#557089']]
const LAST_NAME = ['Княжество Штайнгард', '#5c5c6e']
const OTHER_NAMES = [
  ['Маркграфство Тальбург', '#9a5b3c'], ['Герцогство Эшенвальд', '#86703b'], ['Княжество Кастерфельд', '#4f6b5e'], ['Княжество Альтмарк', '#8c6a3f'],
  ['Герцогство Веренфельс', '#5f7a8c'], ['Графство Грисхольм', '#7d5a6e'], ['Княжество Ройвен', '#6e7f4a'], ['Графство Морвен', '#7b6b9a'],
  ['Княжество Вальдек', '#4d7a6a'], ['Герцогство Брассау', '#a07a46'], ['Графство Орлинг', '#6a5a8a'], ['Княжество Хеймсбург', '#7a8a52'],
  ['Маркграфство Фалькенрит', '#8d5f3a'], ['Графство Тирнау', '#946a7a'], ['Княжество Корвальд', '#5d7f50'], ['Герцогство Лауэнштайн', '#9b6f3f'],
  ['Графство Эберсфельд', '#68608a'], ['Княжество Остмарк', '#7f5747'], ['Графство Грюнау', '#4f7f63'], ['Княжество Ведель', '#8b7a52']
]
const SHEIKHS = [['Шейхство Аль-Касра', '#b08a4a'], ['Шейхство Бену-Захир', '#a46f3d'], ['Ханство Кара-Тепе', '#8f7a3f'], ['Шейхство Ибн-Сафар', '#b5864f'], ['Ханство Джалаир', '#9c6a48']]
const principalities = clusterAreas((p) => CENTRAL.has(nameOf(p)), NEIGHBOUR_NAMES.length + OTHER_NAMES.length + 2, hauProv.areaId)
const sheikhdoms = clusterAreas((p) => DESERT.has(nameOf(p)), SHEIKHS.length)

// ---------- государства прошлого ----------
const H_ = (layout, colors, emblem, emblemColor) => ({ layout, colors, emblem, emblemColor })
const fields = (name, color, extra = {}) => ({
  name, fullName: '', color, flag: '', motto: '', ruler: '', rulerTitle: '', rulerId: '', government: '', ideology: '', religion: '',
  religionId: '', capitalId: '', population: '', army: '', navy: '', economy: '', treasury: '', laws: '', culture: '', languages: '',
  stability: 50, description: '', dynastyId: '', overlordId: '', diplomacy: '', customFields: [], ...extra
})
world.states = world.states.filter((s) => !s.id.startsWith('hist-'))
const hist = (key, name, color, extra) => {
  const st = { id: `hist-${key}`, base: fields(name, color, extra), history: [], factions: [], from: null, to: null }
  world.states.push(st)
  stateById.set(st.id, st)
  return st.id
}
const empire = stateByName.get('Империя').id

// порядок присоединения: ближние раньше; Штайнгард — ближайший к горам дварфов
const mountainProvs = provs.filter((p) => MOUNTAIN.has(nameOf(p)))
const mountainC = centroid(mountainProvs)
const others = principalities.map((g, k) => k).filter((k) => k)
const lastK = others.reduce((a, b) => (dist(principalities[a], mountainC) < dist(principalities[b], mountainC) ? a : b))
const order = others.filter((k) => k !== lastK).sort((a, b) => dist(principalities[a], haussler) - dist(principalities[b], haussler))
const nameFor = new Map()
order.forEach((k, i) => nameFor.set(k, i < 2 ? NEIGHBOUR_NAMES[i] : OTHER_NAMES[(i - 2) % OTHER_NAMES.length]))
nameFor.set(lastK, LAST_NAME)
const princIds = principalities.map((g, k) => {
  if (!k) return empire
  const [name, color] = nameFor.get(k)
  return hist(`p${k}`, name, color, {
    government: 'Феодальное княжество',
    religionId: 'lore-house-light',
    culture: 'Гладры',
    description:
      k === lastK
        ? 'Горное княжество у границ дварфов. Его князь Рагнвальд успел подготовить войско и дольше всех сопротивлялся Тейберу: разбил его авангард в Волчьем ущелье и выдержал восьмимесячную осаду Штайнгарда. Пало зимой 129 г. (черновик).'
        : order.indexOf(k) < 2
          ? 'Сосед Дагерфорда, на которого генерал Тейбер уговорил знать напасть первым — пока здесь шли военные и государственные реформы. Присоединён в Войну двух соседей (119–121), столица сожжена (черновик).'
          : 'Одно из множества княжеств центра Лоры в эпоху раздробленности. Присоединено войной регентом Тейбером (124–129) — ни одно княжество не сдалось без боя (черновик).'
  })
})
// княжества, ставшие Короной Аргус: свои династии, устройство и гербы (scripts/lore/argus.mjs)
for (const pr of PRINCIPALITIES) {
  const st = world.states.find((x) => x.id.startsWith('hist-p') && x.base.name === pr.state)
  if (!st) continue
  Object.assign(st.base, { government: pr.government, rulerTitle: pr.rulerTitle, dynastyId: `lore-${pr.house}`, heraldry: pr.heraldry, motto: pr.motto, description: pr.description })
}
const sheikhIds = sheikhdoms.map((g, k) =>
  hist(`s${k}`, SHEIKHS[k][0], SHEIKHS[k][1], { government: 'Шейхство', religionId: 'lore-house-dark', culture: 'Нарги, дукулиты', description: 'Пустынное шейхство, присоединённое Джакастой I к Королевству пустынь (черновик).' })
)
const desert = hist('desert', 'Королевство пустынь', '#b07a2e', {
  government: 'Ханство (власть верховного Джаки)', religionId: 'lore-house-dark', rulerId: 'lore-jakasta', rulerTitle: 'Верховный Джака',
  culture: 'Нарги, дукулиты', heraldry: H_('plain', ['#2a1a10'], 'flame', '#c9a45c'),
  description: 'Королевство Джакасты I, объединившего шейхов и приграничных ханов. Построило Великий храм Наллы посреди пустыни. Разгромлено Дагерфордом в Великой южной войне (140–150).'
})
const mountain = hist('mountain', 'Империя гор', '#6a6f7a', {
  government: 'Империя (престол дварфов)', rulerTitle: 'Король дварфов и гномов', culture: 'Дварфы, гномы, люди',
  heraldry: H_('bicolor-h', ['#3d4250', '#7a5a2a'], 'hammer', '#d9a521'),
  description: 'Сильнейшее государство севера: дварфы — элита и армия, гномы — рабочий класс, люди живут на поверхности. Истребило северных орков (95 г.) и присягнуло Тейберу с сохранением автономии (132 г.).'
})
const nord = hist('nordkingdom', 'Северное королевство', '#4f6f86', {
  government: 'Военная монархия', culture: 'Норды', heraldry: H_('cross', ['#20384a', '#20384a', '#e8e3d6'], 'axe', '#e8e3d6'),
  description: 'Суровое военизированное государство нордов, чтившее только силу. Признало власть Тейбера после поединка их конунга Хьяльмара с ним у Каменного круга (138 г.).'
})
const orcs = hist('orcs', 'Земли северных орков', '#8a8f86', {
  government: 'Племенной союз', culture: 'Северные орки', capitalId: 'lore-ulghaim',
  description: 'Деревни белых орков высоко в северных горах; последний оплот — крепость Ул-гхайм. Стёрты с лица земли дварфами в Северной бойне (95 г.).'
})
// мятежники имперской эпохи
const copper = hist('copper', 'Медные Молоты', '#b87333', { government: 'Восставшие кланы дварфов', culture: 'Дварфы', heraldry: H_('plain', ['#5a3a1a'], 'hammer', '#d98a3a'), description: 'Восстание горных кланов против имперских откупщиков (411–413). Закончено договором Корвина I Тихого (черновик).' })
const prophet = hist('prophet', 'Последователи Пустынного Пророка', '#7a5a2a', { government: 'Восстание', culture: 'Нарги, дукулиты', religionId: 'lore-house-dark', description: 'Кочевники и разорённые шейхи, пошедшие за «голосом Наллы» (233–236). Подавлено наместником Каспаром Монстаргом (черновик).' })
const deepmines = hist('deepmines', 'Подземный совет Глубинных шахт', '#4a4a5a', { government: 'Восстание гномов', culture: 'Гномы', description: 'Восстание гномов-рабочих против дварфских мастеров и имперских подрядчиков (512–515) (черновик).' })
const redSheikhs = hist('redsheikhs', 'Алые шейхи', '#a83a2a', { government: 'Восстание шейхов', culture: 'Нарги', religionId: 'lore-house-dark', description: 'Самое большое восстание юга после Джакасты (611–614). Подавлено Изольдой I Железной Вдовой лично (черновик).' })
const blackSands = hist('blacksands', 'Повстанцы Чёрных песков', '#3a2a1a', { government: 'Восстание', culture: 'Нарги', description: 'Голодное восстание юга (863–865); Конрад I помиловал рядовых (черновик).' })
const partisans = hist('elfpartisans', 'Лесные братства Эльфборна', '#2f6a3a', { government: 'Партизанские отряды', culture: 'Эльфы', heraldry: H_('plain', ['#1f3a24'], 'tree', '#c9d8b0'), description: 'Эльфийские отряды, тридцать семь лет воевавшие с легионами в чаще и не прекратившие войну после Договора Серебряных Ив (черновик).' })
// распад
const pact = hist('pact', 'Пакт Ставки и Совета', '#3a4a6a', {
  government: 'Военно-аристократическая хунта', culture: 'Имперцы', heraldry: H_('bicolor-v', ['#3a4a6a', '#1a1a1a'], 'scales', '#c9a45c'),
  description: 'Фракция гражданской войны 975–980 гг.: Верховный совет, созвавший себя без санкции императора, и большая часть генералитета. Против неё — лоялисты Короны, к которым ушла часть знати и армии. Победила после Чёрной комнаты и стала нынешней властью Империи (черновик).'
})
const northRebels = hist('northrebels', 'Северные повстанцы', '#6a7a8a', {
  government: 'Восставшие города и кланы', culture: 'Дварфы, гномы, норды', heraldry: H_('plain', ['#4a5a6a'], 'axe', '#e8e3d6'),
  description: 'Восстания севера 976–977 гг.: сначала отдельные города дварфов, гномов и нордов, потом целые долины. Из них выросли нынешние северные государства (черновик).'
})

// ---------- события владения ----------
const ev = new Map(provs.map((p) => [p.id, []]))
const initial = new Map()
const setInit = (p, owner) => initial.set(p.id, owner)
const at = (p, year, owner) => ev.get(p.id).push([D(year), owner])
/** Передаёт группу провинций постепенно: от start за duration лет, ближние к origin раньше */
const sweep = (list, start, duration, owner, origin) => {
  const sorted = [...list].sort((a, b) => dist(a, origin) - dist(b, origin))
  sorted.forEach((p, i) => at(p, start + (duration * i) / Math.max(1, sorted.length - 1), owner))
}
/** Ближайшие к точке n провинций из списка */
const nearest = (list, pt, n) => [...list].sort((a, b) => dist(a, pt) - dist(b, pt)).slice(0, n)

// центр Лоры: княжества и рост Дагерфорда
const princOfProv = new Map()
principalities.forEach((g, k) => g.provinces.forEach((p) => princOfProv.set(p.id, k)))
for (const p of provs) if (CENTRAL.has(nameOf(p))) setInit(p, princIds[princOfProv.get(p.id)])
const core = principalities[0]
// Война двух соседей
sweep(principalities[order[0]].provinces, 119.6, 0.9, empire, core)
sweep(principalities[order[1]].provinces, 120.3, 1.0, empire, core)
// объединение: волнами, каждое княжество за несколько месяцев
const wave = order.slice(2)
wave.forEach((k, i) => sweep(principalities[k].provinces, 124.3 + (i * (128.3 - 124.3)) / Math.max(1, wave.length - 1), 0.5, empire, haussler))
// Штайнгард: медленно, с осадой столицы в самом конце
{
  const g = principalities[lastK]
  const capital = biggest(g.provinces)
  const rest = g.provinces.filter((p) => p !== capital)
  sweep(rest, 127.6, 1.9, empire, haussler)
  at(capital, 129.93, empire)
}

// север: орки, дварфы, норды
const ulghaim = world.places.find((p) => p.id === 'lore-ulghaim') ?? { x: 7030, y: 530 }
const orcTip = (p) => nameOf(p) === 'Земли Севера' && p.x > 6500
const orcProvs = provs.filter(orcTip)
for (const p of provs) {
  if (MOUNTAIN.has(nameOf(p))) setInit(p, mountain)
  else if (orcTip(p)) setInit(p, orcs)
  else if (NORTH.has(nameOf(p))) setInit(p, nord)
}
{
  const sorted = [...orcProvs].sort((a, b) => dist(b, ulghaim) - dist(a, ulghaim))
  sorted.forEach((p, i) => at(p, 95.05 + (0.9 * i) / Math.max(1, sorted.length - 1), mountain))
}
for (const p of provs) if (MOUNTAIN.has(nameOf(p)) || orcTip(p)) at(p, 132 + rnd() * 0.15, empire)
const nordProvs = provs.filter((p) => NORTH.has(nameOf(p)) && !orcTip(p))
sweep(nordProvs, 138.25, 0.3, empire, haussler)

// пустыни
sheikhdoms.forEach((g, k) => g.provinces.forEach((p) => setInit(p, sheikhIds[k])))
const desertProvs = provs.filter((p) => DESERT.has(nameOf(p)))
{
  const coreS = sheikhdoms.reduce((a, b) => (a.provinces.length > b.provinces.length ? a : b))
  const rest = sheikhdoms.filter((g) => g !== coreS).sort((a, b) => dist(a, coreS) - dist(b, coreS))
  coreS.provinces.forEach((p) => at(p, 100.0, desert))
  rest.forEach((g, i) => sweep(g.provinces, 101.5 + i * 2.1, 0.6, desert, coreS))
  sweep(desertProvs, 140.3, 9.4, empire, haussler)
}

// 150: присоединения после войны (без Эльфборна — его брали Лесной войной)
sweep(provs.filter((p) => JOIN150.has(nameOf(p))), 150.05, 0.6, empire, haussler)
for (const p of provs) if (nameOf(p) === 'Святая церковь') { at(p, 150.1, empire); at(p, 160.0, p.state) }

// ---------- восстания имперской эпохи: мятежники берут район и теряют его ----------
const uprising = (list, seedPt, n, start, spread, endStart, endDur, rebel) => {
  const zone = nearest(list, seedPt, n)
  sweep(zone, start, spread, rebel, seedPt)
  const far = [...zone].sort((a, b) => dist(b, seedPt) - dist(a, seedPt))
  far.forEach((p, i) => at(p, endStart + (endDur * i) / Math.max(1, far.length - 1), empire))
  return zone
}
const SEEDS = {}
{
  const farv = provs.filter((p) => nameOf(p) === 'Фарвольская лига')
  SEEDS.copper = biggest(farv)
  uprising(farv, SEEDS.copper, 34, 411.2, 0.5, 413.2, 0.4, copper)
  const jaka = provs.filter((p) => nameOf(p) === 'Джака')
  SEEDS.prophet = jaka.reduce((a, b) => (a.y > b.y ? a : b))
  uprising(jaka, SEEDS.prophet, 26, 233.4, 0.8, 235.4, 0.8, prophet)
  const high = provs.filter((p) => nameOf(p) === 'Высокогорное Княжество')
  SEEDS.deepmines = biggest(high)
  uprising(high, SEEDS.deepmines, 22, 512.3, 0.4, 514.6, 0.6, deepmines)
  const south = provs.filter((p) => ['Джака', 'Кростфорд'].includes(nameOf(p)))
  SEEDS.redsheikhs = south.reduce((a, b) => (a.x + a.y < b.x + b.y ? a : b))
  uprising(south, SEEDS.redsheikhs, 48, 611.1, 0.9, 613.6, 0.8, redSheikhs)
  const ophir = provs.filter((p) => ['Офир', 'Джака'].includes(nameOf(p)))
  SEEDS.blacksands = biggest(provs.filter((p) => nameOf(p) === 'Офир'))
  uprising(ophir, SEEDS.blacksands, 20, 863.2, 0.5, 864.9, 0.7, blackSands)
}

// ---------- Лесная война в Эльфборне (451–488) ----------
const elfAll = provs.filter((p) => nameOf(p) === 'Эльфборн')
const elfNorth = (p) => nameOf(p) === 'Эльфборн' && p.y < 2360
const warZone = elfAll.filter((p) => p.y < 2500)
const landing = warZone.reduce((a, b) => (dist(a, haussler) < dist(b, haussler) ? a : b))
SEEDS.landing = landing
{
  // продвижение: медленное, всё медленнее вглубь леса (квадратный корень от порядка)
  const sorted = [...warZone].sort((a, b) => dist(a, landing) - dist(b, landing))
  sorted.forEach((p, i) => at(p, 451.3 + 35.5 * Math.pow(i / Math.max(1, sorted.length - 1), 1.6), empire))
  SEEDS.middle = sorted[Math.floor(sorted.length * 0.3)]
  SEEDS.far = sorted[sorted.length - 1]
  // партизаны: очаги в уже занятых землях, на полгода–два года
  for (let k = 0; k < 18; k++) {
    const year = k < 12 ? 455 + k * 2.6 + rnd() : 489 + (k - 12) * 8 + rnd() * 4
    const pool = sorted.filter((p, i) => 451.3 + 35.5 * Math.pow(i / Math.max(1, sorted.length - 1), 1.6) < year - 1 && (year < 488 || elfNorth(p)))
    if (pool.length < 3) continue
    const c = pool[Math.floor(rnd() * pool.length)]
    for (const p of nearest(pool, c, 2 + Math.floor(rnd() * 3))) {
      at(p, year, partisans)
      at(p, year + 0.5 + rnd() * 1.5, empire)
    }
  }
  // Договор Серебряных Ив (488): Империи — север, остальное возвращается эльфам
  for (const p of warZone) if (!elfNorth(p)) at(p, 488.3 + rnd() * 0.3, p.state)
}

// ---------- великие дома за регионами Империи ----------
const empireNow = provs.filter((p) => p.state === empire)
const regionStats = new Map()
for (const p of empireNow) {
  const r = regionOf(p)
  const s = regionStats.get(r) ?? { id: r, n: 0, coast: 0, hills: 0, forest: 0, plains: 0, capital: 0, provs: [] }
  s.n++
  s.provs.push(p)
  if (p.coastal) s.coast++
  if (p.terrain === 3 || p.terrain === 4) s.hills++
  if (p.terrain === 2) s.forest++
  if (p.terrain === 1) s.plains++
  if (p === hauProv) s.capital = 1
  regionStats.set(r, s)
}
const regionHouse = new Map()
{
  const free = [...regionStats.values()].filter((s) => s.n >= 3)
  const score = (h, s) => (h.prefer === 'capital' ? s.capital * 100 : h.prefer === 'river' ? 0.3 + rnd() * 0.2 : s[h.prefer] / s.n)
  for (const h of HOUSES.filter((h) => !h.vassal && h.id !== 'kronau')) {
    if (!free.length) break
    const best = free.reduce((a, b) => (score(h, a) >= score(h, b) ? a : b))
    regionHouse.set(best.id, h)
    free.splice(free.indexOf(best), 1)
  }
  // мелкие осколки регионов — дому соседнего крупного
  for (const s of regionStats.values())
    if (!regionHouse.has(s.id)) {
      const c = centroid(s.provs)
      const nb = [...regionHouse.keys()].reduce((a, b) => (dist(centroid(regionStats.get(a).provs), c) < dist(centroid(regionStats.get(b).provs), c) ? a : b))
      regionHouse.set(s.id, regionHouse.get(nb))
    }
}
for (const a of world.adminRegions) delete a.houseId
for (const [rid, h] of regionHouse) admin.get(rid).houseId = `lore-${h.id}`
// вассалы: их регионы — их домам
for (const h of HOUSES.filter((h) => h.vassal)) {
  const sid = stateByName.get(h.vassal)?.id
  for (const p of provs) if (p.state === sid) { const r = admin.get(regionOf(p)); if (r && !r.houseId) r.houseId = `lore-${h.id}` }
}

// ---------- 975–980: распад ----------
const sideOfRegion = (rid) => regionHouse.get(rid)?.side ?? null
const imperialHeart = provs.filter((p) => p.state === empire || CENTRAL.has(nameOf(p)))
// сторона каждой провинции центра: по дому региона, иначе — по ближайшему региону с домом
const housed = empireNow.filter((p) => sideOfRegion(regionOf(p)))
const sideOf = (p) => sideOfRegion(regionOf(p)) ?? sideOfRegion(regionOf(nearest(housed, p, 1)[0]))
const empireEv = stateByName.get('Империя')
// Хауссер расколот: дворец у Короны
const pactProvs = imperialHeart.filter((p) => p !== hauProv && !VASSALS.has(nameOf(p)) && sideOf(p) === 'pact')
const pactC = centroid(pactProvs)
sweep(pactProvs, 975.45, 0.35, pact, pactC)
// север: восстания вспыхивают в городах и расходятся по долинам
const northAll = provs.filter((p) => NORTH.has(nameOf(p)) || MOUNTAIN.has(nameOf(p)))
{
  const towns = northAll.filter((p) => p.settlement && ['city', 'town', 'port', 'castle'].includes(p.settlement.type))
  const seeds = []
  while (seeds.length < 10 && towns.length) {
    const t = towns.splice(Math.floor(rnd() * towns.length), 1)[0]
    if (seeds.every((s) => dist(s, t) > 350)) seeds.push(t)
  }
  seeds.forEach((s, i) => (s.rebelStart = 976.0 + i * 0.12))
  SEEDS.north = seeds[0]
  for (const p of northAll) {
    if (nameOf(p) === 'Высокогорное Княжество') continue
    let best = Infinity
    for (const s of seeds) best = Math.min(best, s.rebelStart + dist(p, s) / 2600)
    at(p, Math.min(977.4, best), northRebels)
  }
  // восставшие складываются в нынешние северные государства
  const byState = new Map()
  for (const p of northAll) {
    if (nameOf(p) === 'Имперские Изгнанники' || nameOf(p) === 'Высокогорное Княжество') continue
    if (!byState.has(p.state)) byState.set(p.state, [])
    byState.get(p.state).push(p)
  }
  for (const list of byState.values()) sweep(list, 977.5 + rnd() * 0.6, 0.25, list[0].state, centroid(list))
  // Высокогорное Княжество (scripts/lore/highland.mjs): маркграф Зигмунд объявляет княжество с Венца в 976 г.;
  // в 977 г. III легион Совета берёт рудники Подошвы, сорок дней стоит под Химмельскранцем и уходит
  {
    const high = provs.filter((p) => nameOf(p) === 'Высокогорное Княжество')
    const kranz = high.find((p) => p.id === 989) ?? high[0]
    sweep(high, 976.4, 0.35, kranz.state, kranz)
    const foot = high.filter((p) => p.terrain <= 2 || (p.settlement?.type === 'village' && dist(p, kranz) > 220))
    const fromSouth = foot.reduce((a, b) => (a.y > b.y ? a : b))
    sweep(foot, 977.25, 0.1, pact, fromSouth)
    sweep(foot, 977.6, 0.1, kranz.state, kranz)
  }
  // радикальные монархисты бегут на крайний север
  const exiles = provs.filter((p) => nameOf(p) === 'Имперские Изгнанники')
  sweep(exiles, 980.12, 0.3, exiles[0].state, haussler)
}
// Республика берёт весь центр (кроме нынешней Империи и вассалов) и распадается
const republic = stateByName.get('Республика').id
const centerLands = imperialHeart.filter((p) => p.state !== empire && !VASSALS.has(nameOf(p)))
const repProvs = centerLands.filter((p) => p.state === republic)
const repC = centroid(repProvs)
SEEDS.republic = nearest(repProvs, repC, 1)[0]
// Освобождение: Тирритское восстание, пять восстаний с актами о единении, походы легионов и ополчения (scripts/lore/republic.mjs)
{
  const lib = liberation(provs, (p) => admin.get(regionOf(p))?.name)
  const rebels = new Map(UPRISINGS.map(([key, name, color, region, town, start, merge, description]) => [key, hist(key, name, color, { government: 'Восстание, вошедшее в Республику', culture: 'Имперцы', description: description + ' (черновик)' })]))
  for (const p of centerLands) {
    const c = lib(p)
    if (!c) { at(p, 977.5, republic); continue }
    if (c.merge) {
      at(p, c.date, rebels.get(c.key))
      at(p, c.merge, republic)
    } else at(p, c.date, republic)
  }
}
{
  const byState = new Map()
  for (const p of centerLands) {
    if (p.state === republic) continue
    if (!byState.has(p.state)) byState.set(p.state, [])
    byState.get(p.state).push(p)
  }
  for (const list of byState.values()) {
    const n = nameOf(list[0])
    const SOUTH = ['Кальтранская Республика', 'Тоскана', 'Вуфинская Республика', 'Республика Шеша']
    const start = CHURCH_LANDS(n) ? 978.6 + rnd() * 0.3 : SOUTH.includes(n) ? 978.35 + rnd() * 0.04 : 978.2 + rnd() * 1.4
    sweep(list, start, 0.25, list[0].state, centroid(list))
  }
}
// великие дома, ставшие королевствами, а в 980 г. — вассалами
const VASSAL_START = { 'Корона Аргус': 976.6, 'Графство Мангениум': 978.0, 'Графство Штирия': 978.3 }
for (const [name, start] of Object.entries(VASSAL_START)) {
  const st = stateByName.get(name)
  const list = provs.filter((p) => p.state === st.id)
  sweep(list, start, 0.4, st.id, centroid(list))
  st.history = (st.history ?? []).filter((h) => !String(h.id).startsWith('lore-vassal'))
  st.history.push({ id: 'lore-vassal-free', date: D(start), patch: { overlordId: '' } }, { id: 'lore-vassal-980', date: D(980.1), patch: { overlordId: empire } })
}
// мятежи младших домов Короны Аргус (976–977): мятежники берут свой округ и быстро проигрывают
{
  const argusSt = stateByName.get('Корона Аргус').id
  for (const [key, name, color, area, start, end, description] of ARGUS_REBELS) {
    const rebel = hist(key, name, color, { government: 'Мятеж младшего дома', culture: 'Зиггауцы', description })
    const list = provs.filter((p) => admin.get(p.areaId)?.name === area && p.state === argusSt)
    for (const p of list) {
      ev.set(p.id, ev.get(p.id).filter(([d]) => d < D(start) || d > D(end)))
      at(p, start, rebel)
      at(p, end, argusSt)
    }
  }
}
// дальние земли уходят в хаосе
{
  const far = new Map()
  for (const p of provs) {
    const n = nameOf(p)
    if (!(DESERT.has(n) || JOIN150.has(n) || elfNorth(p))) continue
    if (!far.has(p.state)) far.set(p.state, [])
    far.get(p.state).push(p)
  }
  for (const list of far.values()) sweep(list, 976.4 + rnd() * 3.0, 0.5, list[0].state, centroid(list))
}
// Чёрная комната: земли Пакта и лоялистов снова одна Империя
// возвращаются только земли нынешней Империи — государства, отколовшиеся от Республики, остаются независимыми
sweep(pactProvs.filter((p) => p.state === empire), 980.1, 0.08, empire, haussler)
empireEv.history = empireEv.history.filter((h) => !String(h.id).startsWith('lore-fall'))
empireEv.history.push(
  { id: 'lore-fall-loyal', date: D(975.45), patch: { name: 'Империя (лоялисты Короны)', government: 'Монархия (лоялисты Тейбера II)' } },
  { id: 'lore-fall-980', date: D(980.1), patch: { name: 'Империя', government: 'Парламентская монархия (власть Верховного совета)' } }
)

// ---------- запись владельцев ----------
for (const p of provs) {
  const list = ev.get(p.id).sort((a, b) => a[0] - b[0])
  const first = initial.get(p.id) ?? p.state
  const owners = [[null, first]]
  for (const [d, o] of list) if (owners[owners.length - 1][1] !== o) owners.push([d, o])
  p.owners = owners
}

// ---------- даты существования государств ----------
const span = new Map()
for (const p of provs) {
  p.owners.forEach(([d, o], i) => {
    const end = p.owners[i + 1]?.[0] ?? null
    const s = span.get(o) ?? { from: Infinity, to: -Infinity, open: false }
    s.from = Math.min(s.from, d ?? -Infinity)
    if (end === null) s.open = true
    else s.to = Math.max(s.to, end)
    span.set(o, s)
  })
}
for (const st of world.states) {
  const s = span.get(st.id)
  if (!s) continue
  st.from = s.from === -Infinity ? null : s.from
  st.to = s.open ? null : s.to
}

// ---------- места битв и хроники ----------
const borderPoint = (A, B) => {
  let best = null, bd = Infinity
  const setB = new Set(B.map((p) => p.id))
  for (const a of A)
    for (const n of a.neighbors) {
      if (!setB.has(n)) continue
      const b = provById.get(n)
      const d = dist(a, haussler) + dist(b, haussler)
      if (d < bd) { bd = d; best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
    }
  if (best) return best
  const a = A.reduce((m, p) => (dist(p, centroid(B)) < dist(m, centroid(B)) ? p : m))
  return { x: a.x, y: a.y }
}
const settlementPt = (p) => (p.settlement ? { x: p.settlement.x + 22, y: p.settlement.y - 14 } : { x: p.x, y: p.y })
const loyalProvs = imperialHeart.filter((p) => p.state === empire && !pactProvs.includes(p))
const LOC = {
  'border:core:n1': () => borderPoint(core.provinces, principalities[order[0]].provinces),
  'border:core:n2': () => borderPoint(core.provinces, principalities[order[1]].provinces),
  'city:n1': () => settlementPt(biggest(principalities[order[0]].provinces)),
  'city:n2': () => settlementPt(biggest(principalities[order[1]].provinces)),
  'border:wave:1': () => borderPoint([...core.provinces, ...principalities[order[0]].provinces, ...principalities[order[1]].provinces], principalities[wave[0]].provinces),
  'border:wave:2': () => centroid(principalities[wave[Math.floor(wave.length / 3)]].provinces),
  'city:wave:3': () => settlementPt(biggest(principalities[wave[Math.floor((wave.length * 2) / 3)]].provinces)),
  'border:last': () => borderPoint(principalities[lastK].provinces, wave.flatMap((k) => principalities[k].provinces)),
  'city:last': () => settlementPt(biggest(principalities[lastK].provinces)),
  'center:nord': () => centroid(nordProvs),
  'center:sheikh:0': () => centroid(sheikhdoms[0].provinces),
  'center:sheikh:2': () => centroid(sheikhdoms[Math.min(2, sheikhdoms.length - 1)].provinces),
  'center:nalla': () => centroid(provs.filter((p) => nameOf(p) === 'Пустошь Наллы')),
  'seed:copper': () => settlementPt(SEEDS.copper),
  'seed:prophet': () => settlementPt(SEEDS.prophet),
  'seed:deepmines': () => settlementPt(SEEDS.deepmines),
  'seed:redsheikhs': () => settlementPt(SEEDS.redsheikhs),
  'seed:blacksands': () => settlementPt(SEEDS.blacksands),
  'elf:landing': () => settlementPt(SEEDS.landing),
  'elf:middle': () => centroid([SEEDS.middle]),
  'elf:far': () => centroid([SEEDS.far]),
  capital: () => ({ x: haussler.x + 60, y: haussler.y - 40 }),
  'seed:north': () => settlementPt(SEEDS.north),
  'border:pact': () => borderPoint(loyalProvs, pactProvs),
  'center:republic': () => settlementPt(SEEDS.republic),
  'city:wave:1': () => settlementPt(biggest(principalities[wave[0]].provinces)),
  'castersfeld-camp': () => {
    const a = LOC['city:wave:3'](), b = LOC['border:last']()
    return { x: a.x * 0.4 + b.x * 0.6, y: a.y * 0.4 + b.y * 0.6 }
  },
  'center:desertcore': () => centroid(sheikhdoms.reduce((a, b) => (a.provinces.length > b.provinces.length ? a : b)).provinces),
  palace: () => ({ x: haussler.x - 30, y: haussler.y - 60 }),
  'center:loyal': () => settlementPt(nearest(loyalProvs, centroid(loyalProvs), 1)[0]),
  'center:pact': () => settlementPt(nearest(pactProvs, pactC, 1)[0]),
  'center:west': () => centroid(centerLands.filter((p) => p.x < repC.x)),
  'center:far': () => settlementPt(centerLands.reduce((a, b) => (dist(a, repC) > dist(b, repC) ? a : b))),
  'center:exiles': () => centroid(provs.filter((p) => nameOf(p) === 'Имперские Изгнанники'))
}
// «prov:Имя» — у поселения провинции с этим именем
const locOf = (key) => {
  if (!key.startsWith('prov:')) return LOC[key]()
  const p = provs.find((q) => q.name === key.slice(5))
  if (!p) throw new Error(`Нет провинции ${key}`)
  return settlementPt(p)
}
world.places = world.places.filter((p) => !p.id.startsWith('lore-battle-'))
world.entries = world.entries.filter((e) => !e.id.startsWith('lore-battle-'))
const used = []
const battlePt = new Map()
for (const b of BATTLES) {
  let pt = locOf(b.loc)
  // битвы в одном месте раздвигаем
  while (used.some((u) => Math.hypot(u.x - pt.x, u.y - pt.y) < 40)) pt = { x: pt.x + 45, y: pt.y + 20 }
  used.push(pt)
  battlePt.set(b.id, { ...pt, year: b.year })
  const eid = `lore-battle-${b.id}`
  world.entries.push({
    id: eid,
    kind: 'event',
    base: {
      name: b.name, title: b.type, image: '', summary: b.outcome, body: b.body, tags: ['битва', 'черновик'],
      props: { type: b.type, participants: b.participants, commanders: b.commanders, outcome: b.outcome, losses: b.losses },
      links: {}
    },
    history: [],
    from: D(b.year),
    to: null
  })
  world.places.push({
    id: eid,
    mapId: 'world',
    x: Math.round(pt.x),
    y: Math.round(pt.y),
    base: {
      name: b.name, type: 'battle', stateId: '', population: '', ruler: '', image: '',
      description: `**${b.type}, ${Math.floor(b.year)} г.** ${b.participants}.\n**Полководцы:** ${b.commanders}.\n**Итог:** ${b.outcome}. **Потери:** ${b.losses}.\n\n${b.body}`
    },
    history: [],
    // значок виден на карте с начала битвы и ещё два года
    from: D(b.year) - 20,
    to: D(b.year) + 2 * YEAR
  })
}

// ---------- походы армий ----------
const sideState = (side) => {
  if (side === 'empire') return empire
  if (side.startsWith('hist-')) return side
  if (side === 'n1') return princIds[order[0]]
  if (side === 'n2') return princIds[order[1]]
  if (side === 'w1') return princIds[wave[0]]
  if (side === 'last') return princIds[lastK]
  if (side === 'desert') return desert
  return stateByName.get(side)?.id ?? empire
}
world.armies = ARMIES.map((a) => {
  const waypoints = []
  for (const [key, year] of a.route) {
    let pt
    if (key.startsWith('loc:')) pt = { ...locOf(key.slice(4)), year }
    else if (battlePt.has(key)) pt = { ...battlePt.get(key), ...(year != null ? { year } : {}) }
    else pt = { ...locOf(key), year }
    waypoints.push({ x: Math.round(pt.x), y: Math.round(pt.y), date: D(pt.year) })
  }
  const st = stateById.get(sideState(a.side))
  return { id: `lore-army-${a.id}`, name: a.name, mapId: 'world', stateId: st?.id ?? '', color: st?.base.color ?? '#888888', waypoints }
})

// векторные участки карты мира больше не нужны — их заменили провинции
world.regions = world.regions.filter((r) => r.mapId !== 'world')
writeFileSync(WORLD, JSON.stringify(world, null, 1))
const changes = provs.reduce((s, p) => s + p.owners.length - 1, 0)
console.log(`Провинций: ${provs.length}, смен владельцев: ${changes}, государств прошлого: ${world.states.filter((s) => s.id.startsWith('hist-')).length}, битв: ${BATTLES.length}, походов: ${world.armies.length}, домов за регионами: ${regionHouse.size}`)
