// Имперские изгнанники на карте: военные края и генерал-губернаторы, крепости на месте горных деревень, столица Сигрстад,
// горные города, описания всех поселений, памятные места и набеги по годам. Придумано по поручению автора (06.11.2026) —
// «черновик». Детерминированно. Запуск после mangenium-detail.mjs: node scripts/exiles-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { EXILE_COMMANDANTS, EXILE_NAMES, EXILE_RAIDS, STATE } from './lore/exiles.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 9802020
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const person = () => `${pick(EXILE_NAMES.men)} ${pick(EXILE_NAMES.surnames)}`

// военные края: по землям, Скогская земля делится на северный и южный (столичный) край
const KRAI = {
  'Ставочный край': ['Готфрид Штрелиц', 'местоблюститель'],
  'Скогский край': ['Ульрика фон Драу', 'генерал-губернатор'],
  'Хрутский край': ['Эрих Ланге', 'генерал-губернатор'],
  'Кьяреский край': ['Мартин Гёц', 'генерал-губернатор'],
  'Снаский край': ['Ханна Вёрт', 'генерал-губернатор']
}
const kraiOf = (p) => {
  const land = admin.get(admin.get(p.areaId)?.parentId)?.name ?? ''
  if (land.startsWith('Хрутланд')) return 'Хрутский край'
  if (land.startsWith('Кьяр')) return 'Кьяреский край'
  if (land.startsWith('Снас')) return 'Снаский край'
  return p.y >= 420 ? 'Ставочный край' : 'Скогский край'
}

// крепости: старые имперские твердыни на горных деревнях, по одной в разных краях
const FORTS = ['Крепость Последней клятвы', 'Железные ворота', 'Воронья стража', 'Морозный кастелл']
const capital = provs.find((p) => p.name === 'Сигрстад')
const mountain = provs.filter((p) => p.terrain === 4 && p.settlement && p.settlement.type !== 'city').sort((a, b) => Math.hypot(a.x - capital.x, a.y - capital.y) - Math.hypot(b.x - capital.x, b.y - capital.y))
const forts = new Map()
for (const p of mountain) {
  if (forts.size >= FORTS.length) break
  if ([...forts.keys()].some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 160)) continue
  forts.set(p, FORTS[forts.size])
  p.settlement.type = 'castle'
}
const MOUNTAIN_TOWNS = new Set(['Бругард', 'Фросевик', 'Ётстад', 'Фьяледален'])
const LIVES = ['рыба', 'ячмень', 'овцы', 'лес', 'торф', 'олени', 'тюлений жир', 'железная руда']
const TOWN_NOTE = ['На площади каждую весну вешают списки сабель.', 'Ставни здесь закрывают, когда возвращаются налётчики: пьяные солдаты опаснее волков.', 'Старая имперская кордегардия стала казармой; над ней чёрный дракон на алом.', 'На рынке торгуют добычей прошлой осени, дёшево и не спрашивая, откуда.']
const VILLAGE_NOTE = ['Половина мужчин ушла в вольные хоругви Хальвдана.', 'Кормовую дань здесь платят хлебом и сыновьями.', 'Норды здесь помнят, что до 976 г. платили налоги Империи, а до 980 г. — никому.', 'У колодца стоит столб с указом местоблюстителя, которого никто в деревне не может прочесть.', 'Прошлой осенью Вороны забрали отсюда трёх охотников проводниками.']

let n = 0
for (const p of provs) {
  const t = p.settlement?.type ?? 'village'
  const krai = kraiOf(p)
  const [gov, govTitle] = KRAI[krai]
  const lines = []
  if (p === capital) {
    lines.push('Сигрстад — столица Ставки Верных, бывший нордский торговый город, обнесённый в 980-х имперскими стенами. Здесь Зал Пустого трона, где собирается Сабельная ставка, поле Смотра сабель, казармы Ледяной гвардии и кладбище Последней клятвы.')
    lines.push(`Город держит комендант Арнольд Эбергард, край — сам местоблюститель ${gov}.`)
  } else if (forts.has(p)) {
    const name = forts.get(p)
    const cmd = EXILE_COMMANDANTS.find((c) => c[5] === name)
    lines.push(name === 'Крепость Последней клятвы'
      ? `${p.name} — кастра X Последней клятвы, военный город, старая имперская твердыня над перевалом. Здесь стоит ядро легиона и хранятся его знамёна.`
      : `${p.name} — крепость «${name}», старая имперская твердыня на скале, занятая изгнанниками в 980 г.`)
    if (cmd) lines.push(`Комендант — ${cmd[1]}. ${cmd[6]}`)
  } else if (MOUNTAIN_TOWNS.has(p.name)) {
    lines.push(`${p.name} — горный город на уступах над ущельем; дома лепятся к скале ярусами, а над ними стоит имперская башня.`)
    const cmd = EXILE_COMMANDANTS.find((c) => c[5] === p.name)
    lines.push(cmd ? `Комендант — ${cmd[1]}. ${cmd[6]}` : `Комендант — ${person()}.`)
    if (p.name === 'Бругард') lines.push('Под городом в скале вырублен Ледяной арсенал — склады старых имперских мечей, щитов и арбалетов.')
  } else if (t === 'town' || t === 'port') {
    lines.push(`${p.name} — ${t === 'port' ? 'нордская гавань под имперской комендатурой' : 'нордский городок под имперской комендатурой'}. Живёт тем, что даёт север: ${pick(LIVES)}, ${pick(LIVES)}.`)
    const cmd = EXILE_COMMANDANTS.find((c) => c[5] === p.name)
    lines.push(cmd ? `Комендант — ${cmd[1]}. ${cmd[6]}` : `Комендант — ${person()}.`)
    if (p.name === 'Гримланд') lines.push('Здесь Двор добычи: сюда свозят всё, что берут в набегах, и отсюда оно уходит к перекупщикам юга.')
    if (p.name === 'Улвик') lines.push('В его фьордах зимуют корабли морских набегов генерала Ханны Вёрт.')
    lines.push(pick(TOWN_NOTE))
  } else if (t === 'ruins') {
    lines.push(`${p.name} — пепелище нордского городка, сожжённого в Ледяном походе 993 г. за отказ платить кормовую дань. Отстраивать его запрещено.`)
  } else if (t === 'tower') {
    lines.push(`${p.name} — сигнальная башня Ставки: её дымы передают весть о набеге от края до края за один день.`)
  } else {
    lines.push(`${p.name} — ${t === 'fishing' ? 'нордская рыбацкая деревня' : 'нордская деревня'}; живёт тем, что даёт север: ${pick(LIVES)}, ${pick(LIVES)}.`)
    lines.push(`Кормовую дань собирает ${chance(0.5) ? 'фельдфебель' : 'сборщик'} ${person()}.`)
    if (chance(0.5)) lines.push(pick(VILLAGE_NOTE))
  }
  lines.push(`${krai}: ${govTitle} ${gov}.`)
  p.description = `${lines.join(' ')}\n\n_черновик_`
  n++
}

const place = (id, name, type, prov, from, description, stateId = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  const s = prov.settlement ?? prov
  const off = type === 'capital' ? [0, 0] : [14, 10]
  world.places.push({ id, mapId: 'world', x: Math.round(s.x) + off[0], y: Math.round(s.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler: type === 'capital' ? 'Местоблюститель Готфрид Штрелиц' : '', image: '', description: `${description}\n\n_черновик_` }, history: [], from: from == null ? null : D(from), to: null })
}
place('lore-ex-capital', 'Сигрстад', 'capital', capital, 980.4, '**Столица Ставки Верных.** Зал Пустого трона, поле Смотра сабель, Ледяная гвардия.', st.id)
for (const [p, name] of forts) place(`lore-ex-fort-${FORTS.indexOf(name)}`, name, 'landmark', p, 980.3, `**Крепость Ставки.** ${p.description.split('\n')[0]}`)
const byName = (n) => provs.find((p) => p.name === n)
if (byName('Гримланд')) place('lore-ex-loot', 'Двор добычи', 'landmark', byName('Гримланд'), 984, '**Где делят награбленное.** Склады и торг: десятая часть — в Казну возвращения, остальное — по саблям.')
if (byName('Бругард')) place('lore-ex-arsenal', 'Ледяной арсенал', 'landmark', byName('Бругард'), 981, '**Склады старых имперских мечей** в скале под Бругардом.')
const ruinsP = provs.find((p) => p.settlement?.type === 'ruins')
if (ruinsP) place('lore-ex-ash', 'Пепелище Ледяного похода', 'battle', ruinsP, 993, '**993 г.** Нордский городок сожжён за отказ платить кормовую дань.')

// набеги на карте: от ближайшей крепости к ближайшим землям цели и обратно
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-ex-'))
const ownerAtY = (p, y) => { let o = null; for (const [d, s] of p.owners ?? []) { if (d === null || d <= D(y)) o = s; else break } return o }
const nameOfState = new Map(world.states.map((s) => [s.id, s.base.name]))
const pt = (p, y) => { const s = p.settlement ?? p; return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
const bases = [capital, ...forts.keys(), byName('Гримланд'), byName('Улвик')].filter(Boolean)
let raids = 0
for (const [y, title, , target, , note] of EXILE_RAIDS) {
  if (y === 981) continue
  const goals = world.provinces.filter((p) => p.settlement && nameOfState.get(ownerAtY(p, y)) === target)
  if (!goals.length) continue
  const sea = target === 'Креит'
  const from = sea ? byName('Гримланд') ?? capital : bases.reduce((a, b) => (Math.min(...goals.map((g) => Math.hypot(g.x - b.x, g.y - b.y))) < Math.min(...goals.map((g) => Math.hypot(g.x - a.x, g.y - a.y))) ? b : a))
  const goal = goals.reduce((a, b) => (Math.hypot(b.x - from.x, b.y - from.y) < Math.hypot(a.x - from.x, a.y - from.y) ? b : a))
  const deep = goals.filter((g) => g !== goal).sort((a, b) => Math.hypot(a.x - goal.x, a.y - goal.y) - Math.hypot(b.x - goal.x, b.y - goal.y))[1] ?? goal
  world.armies.push({ id: `lore-army-ex-${y}`, name: `${title} (${y})`, mapId: 'world', stateId: st.id, color: '#6e3636', waypoints: [pt(from, y + 0.3), pt(goal, y + 0.42), pt(deep, y + 0.5), pt(from, y + 0.66)] })
  raids++
}

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Изгнанники: описаний поселений ${n}, крепостей ${forts.size} (${[...forts.keys()].map((p) => p.name).join(', ')}), набегов на карте ${raids}`)
