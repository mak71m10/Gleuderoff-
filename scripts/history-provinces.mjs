// История владения провинциями: границы меняются ПОСТЕПЕННО, провинция за провинцией (черновик по ответам автора).
//   до 95        княжества центра Лоры, Империя гор, Северное королевство, земли северных орков, шейхства пустыни
//   95           Северная бойня: фронт дварфов идёт на восток к Ул-гхайму в течение года
//   100–110      Джакаста I по одному присоединяет шейхства — Королевство пустынь
//   119–130      Дагерфорд поглощает княжества одно за другим; внутри княжества провинции переходят за месяцы
//   132 / 138    присяга дварфов (Империя гор) и нордов (Северное королевство)
//   140–150      Великая южная война: фронт Дагерфорда уходит вглубь пустынь
//   150          Империя: Алые Королевства, Креит, север Эльфборна, Святой архипелаг
//   160          Святая церковь независима
//   975–980      распад: каждая страна откалывается в свой день, мятеж расходится от её центра
// Запуск после provinces.mjs и seed-lore.mjs: node scripts/history-provinces.mjs
import { readFileSync, writeFileSync } from 'fs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
/** Дробный год -> номер дня (115.5 = середина 115 г.) */
const D = (y) => (Math.floor(y) > 0 ? Math.floor(y) - 1 : Math.floor(y)) * YEAR + Math.round((y - Math.floor(y)) * YEAR)
const stateById = new Map(world.states.map((s) => [s.id, s]))
const stateByName = new Map(world.states.map((s) => [s.base.name, s]))
const provs = world.provinces
const nameOf = (p) => stateById.get(p.state)?.base.name ?? ''
const areaOf = new Map()
for (const p of provs) {
  if (!areaOf.has(p.areaId)) areaOf.set(p.areaId, [])
  areaOf.get(p.areaId).push(p)
}

const CENTRAL = new Set([
  'Империя', 'Графство Мангениум', 'Корона Аргус', 'Великое Герцогство Штирия', 'Протекторат Лирия', 'Княжество Харнмарк',
  'Королевство Редания', 'Павильон Грёз', 'Империя Кагия', 'Королевство Темерия', 'Кулагон', 'Рейх', 'Таварвайт', 'Фейноко',
  'Семья Каяя', 'Династия Креццака', 'Магнолия', 'Когалым', 'Королевство Болетария', 'Обливиум Каэлорум', 'Архиепархия Луправена',
  'Архиепархия Ошоморида', 'Архиепископия Окрупия', 'Архиепархия Бувезеона', 'Ла Роше', 'Республика', 'Кальтранская Республика',
  'Тоскана', 'Вуфинская Республика', 'Республика Шеша'
])
const MOUNTAIN = new Set(['Фарвольская лига', 'Высокогорное Княжество'])
const NORTH = new Set(['Земли Севера', 'Республика Чеафарал', 'Крайдонианская Лига', 'Имперские Изгнанники', 'Княжества Гарефорда', 'Уунааш', 'Олекохт', 'Объединённые Берега Гренинсворда', 'Северная Башня', 'Братство Бездны'])
const DESERT = new Set(['Джака', 'Кростфорд', 'Офир', 'Пустошь Наллы', 'Церковь Тьмы'])
const JOIN150 = new Set(['Алые Королевства', 'Креит'])
const VASSALS = new Set(['Корона Аргус', 'Графство Мангениум', 'Великое Герцогство Штирия'])

let seed = 1010
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// ---------- группировка областей в княжества и шейхства ----------
function clusterAreas(filter, k, fixedArea) {
  const list = [...areaOf.entries()].filter(([, ps]) => filter(ps[0])).map(([id, ps]) => {
    let w = 0, x = 0, y = 0
    for (const p of ps) { w += p.px; x += p.x * p.px; y += p.y * p.px }
    return { id, x: x / w, y: y / w, ps }
  })
  let centers = []
  const fixed = fixedArea ? list.find((a) => a.id === fixedArea) : null
  if (fixed) centers.push({ x: fixed.x, y: fixed.y })
  while (centers.length < k) {
    let best = list[0], bd = -1
    for (const a of list) { const d = Math.min(...centers.map((c) => dist(a, c)), 1e12); if (d > bd) { bd = d; best = a } }
    centers.push({ x: best.x, y: best.y })
  }
  let assign = new Map()
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
  return groups
}

const haussler = world.places.find((p) => p.id === 'lore-haussler')
const hauProv = provs.filter((p) => CENTRAL.has(nameOf(p))).reduce((a, b) => (dist(a, haussler) < dist(b, haussler) ? a : b))
const PRINC = [
  ['Княжество Альтмарк', '#8c6a3f'], ['Герцогство Веренфельс', '#5f7a8c'], ['Графство Грисхольм', '#7d5a6e'], ['Княжество Ройвен', '#6e7f4a'],
  ['Маркграфство Тальбург', '#9a5b3c'], ['Княжество Кастерфельд', '#4f6b5e'], ['Графство Морвен', '#7b6b9a'], ['Герцогство Эшенвальд', '#86703b'],
  ['Княжество Штайнгард', '#5c5c6e'], ['Графство Ливенхольм', '#8a4f55'], ['Княжество Вальдек', '#4d7a6a'], ['Герцогство Брассау', '#a07a46'],
  ['Графство Орлинг', '#6a5a8a'], ['Княжество Хеймсбург', '#7a8a52'], ['Маркграфство Фалькенрит', '#8d5f3a'], ['Княжество Зигмарк', '#557089'],
  ['Графство Тирнау', '#946a7a'], ['Княжество Корвальд', '#5d7f50'], ['Герцогство Лауэнштайн', '#9b6f3f'], ['Графство Эберсфельд', '#68608a'],
  ['Княжество Остмарк', '#7f5747'], ['Графство Грюнау', '#4f7f63'], ['Княжество Ведель', '#8b7a52']
]
const SHEIKHS = [['Шейхство Аль-Касра', '#b08a4a'], ['Шейхство Бену-Захир', '#a46f3d'], ['Ханство Кара-Тепе', '#8f7a3f'], ['Шейхство Ибн-Сафар', '#b5864f'], ['Ханство Джалаир', '#9c6a48']]
const principalities = clusterAreas((p) => CENTRAL.has(nameOf(p)), PRINC.length + 1, hauProv.areaId)
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
  return st.id
}
const empire = stateByName.get('Империя').id
const princIds = principalities.map((g, k) =>
  k === 0
    ? empire
    : hist(`p${k}`, PRINC[k - 1][0], PRINC[k - 1][1], {
        government: 'Феодальное княжество',
        religionId: 'lore-house-light',
        culture: 'Гладры',
        description: 'Одно из множества княжеств центра Лоры в эпоху раздробленности (черновик). Поглощено Дагерфордом.'
      })
)
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
  description: 'Суровое военизированное государство нордов, чтившее только силу. Признало власть Тейбера после поединка их лидера с ним (138 г.).'
})
const orcs = hist('orcs', 'Земли северных орков', '#8a8f86', {
  government: 'Племенной союз', culture: 'Северные орки', capitalId: 'lore-ulghaim',
  description: 'Деревни белых орков высоко в северных горах; последний оплот — крепость Ул-гхайм. Стёрты с лица земли дварфами в Северной бойне (95 г.).'
})

// ---------- события владения ----------
const ev = new Map(provs.map((p) => [p.id, []])) // id -> [[дата, владелец]]
const initial = new Map()
const setInit = (p, owner) => initial.set(p.id, owner)
const at = (p, year, owner) => ev.get(p.id).push([D(year), owner])
/** Передаёт группу провинций постепенно: от start за duration лет, в порядке order (ближние раньше) */
const sweep = (list, start, duration, owner, origin) => {
  const sorted = [...list].sort((a, b) => dist(a, origin) - dist(b, origin))
  sorted.forEach((p, i) => at(p, start + (duration * i) / Math.max(1, sorted.length - 1), owner))
}

// центр Лоры: княжества и рост Дагерфорда
const princOfProv = new Map()
principalities.forEach((g, k) => g.provinces.forEach((p) => princOfProv.set(p.id, k)))
const order = principalities.map((g, k) => [k, dist(g, haussler)]).sort((a, b) => a[1] - b[1]).map(([k]) => k)
const joinStart = new Map()
order.forEach((k, rank) => joinStart.set(k, rank === 0 ? null : 119.4 + ((rank - 1) * (130.0 - 119.4)) / (order.length - 2)))
for (const p of provs) if (CENTRAL.has(nameOf(p))) setInit(p, princIds[princOfProv.get(p.id)])
principalities.forEach((g, k) => { if (k) sweep(g.provinces, joinStart.get(k), 0.45, empire, haussler) })

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
  // фронт идёт с запада на восток, Ул-гхайм падает последним
  const sorted = [...orcProvs].sort((a, b) => dist(b, ulghaim) - dist(a, ulghaim))
  sorted.forEach((p, i) => at(p, 95.05 + (0.9 * i) / Math.max(1, sorted.length - 1), mountain))
}
for (const p of provs) if (MOUNTAIN.has(nameOf(p)) || orcTip(p)) at(p, 132 + rnd() * 0.15, empire)
sweep(provs.filter((p) => NORTH.has(nameOf(p)) && !orcTip(p)), 138.0, 0.3, empire, haussler)

// пустыни: шейхства -> Королевство пустынь -> Великая южная война
sheikhdoms.forEach((g, k) => g.provinces.forEach((p) => setInit(p, sheikhIds[k])))
{
  const core = sheikhdoms.reduce((a, b) => (a.provinces.length > b.provinces.length ? a : b))
  const rest = sheikhdoms.filter((g) => g !== core).sort((a, b) => dist(a, core) - dist(b, core))
  core.provinces.forEach((p) => at(p, 100.0, desert))
  rest.forEach((g, i) => sweep(g.provinces, 101.5 + i * 2.1, 0.6, desert, core))
  const all = provs.filter((p) => DESERT.has(nameOf(p)))
  sweep(all, 140.3, 9.4, empire, haussler)
}

// 150: присоединения после войны
const elfNorth = (p) => nameOf(p) === 'Эльфборн' && p.y < 2360
sweep(provs.filter((p) => JOIN150.has(nameOf(p)) || elfNorth(p)), 150.05, 0.6, empire, haussler)
for (const p of provs) if (nameOf(p) === 'Святая церковь') { at(p, 150.1, empire); at(p, 160.0, p.state) }

// 975–980: распад Империи
const seceding = new Map() // страна -> год начала
const statesIn = new Map()
for (const p of provs) {
  const n = nameOf(p)
  const inEmpire = CENTRAL.has(n) || MOUNTAIN.has(n) || NORTH.has(n) || DESERT.has(n) || JOIN150.has(n) || elfNorth(p)
  if (!inEmpire || n === 'Империя') continue
  if (!statesIn.has(p.state)) statesIn.set(p.state, [])
  statesIn.get(p.state).push(p)
}
for (const [sid, list] of statesIn) {
  const n = stateById.get(sid).base.name
  const start = n === 'Республика' ? 975.35 : VASSALS.has(n) ? 979.7 : 975.6 + rnd() * 3.6
  seceding.set(sid, start)
  let w = 0, x = 0, y = 0
  for (const p of list) { w += p.px; x += p.x * p.px; y += p.y * p.px }
  sweep(list, start, Math.min(0.6, 979.95 - start), sid, { x: x / w, y: y / w })
}

// ---------- запись владельцев ----------
for (const p of provs) {
  const list = ev.get(p.id).sort((a, b) => a[0] - b[0])
  const first = initial.get(p.id) ?? p.state
  const owners = [[null, first]]
  for (const [d, o] of list) if (owners[owners.length - 1][1] !== o) owners.push([d, o])
  p.owners = owners
}

// ---------- даты существования государств — из владения провинциями ----------
const span = new Map() // id -> {from, to, ever}
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

// векторные участки карты мира больше не нужны — их заменили провинции
world.regions = world.regions.filter((r) => r.mapId !== 'world')
writeFileSync(WORLD, JSON.stringify(world, null, 1))
const changes = provs.reduce((s, p) => s + p.owners.length - 1, 0)
console.log(`Провинций: ${provs.length}, смен владельцев: ${changes}, государств прошлого: ${world.states.filter((s) => s.id.startsWith('hist-')).length}`)
