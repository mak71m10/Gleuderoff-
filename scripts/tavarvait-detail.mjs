// Таварвайт на карте: Аваллонэ (бывш. Грюненмюнде) — столица у подножия горы, Валимар (бывш. Норергард), Ильмарион (бывш. Тальельбург),
// Тирион (бывш. Альтерведель); порт Брукельрит; эльфийские поселения из дерева. Названия городов — по ответу автора.
// Запуск после pavilion-detail.mjs: node scripts/tavarvait-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/tavarvait.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261124
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

const CITIES = [
  { id: 1968, old: 'Грюненмюнде', name: 'Аваллонэ', type: 'city' },
  { id: 2039, old: 'Норергард', name: 'Валимар', type: 'town' },
  { id: 2040, old: 'Тальельбург', name: 'Ильмарион', type: 'town' },
  { id: 1983, old: 'Альтерведель', name: 'Тирион', type: 'town' }
]
for (const c of CITIES) {
  const p = world.provinces.find((x) => x.id === c.id)
  if (!p) continue
  const area = admin.get(p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
  p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type: c.type }
}
// остальные провинции страны — эльфийские лесные деревни (кроме порта и Вальвейлера)
for (const p of world.provinces.filter((x) => x.owners?.at(-1)?.[1] === st.id && !x.settlement)) p.settlement = { x: p.x, y: p.y, type: 'village' }

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => admin.get(p.areaId)?.name ?? ''
const FIRST = ['Лаэрин', 'Мириэль', 'Анориэн', 'Тавиэль', 'Элоэн', 'Вэйрин', 'Ильвэн', 'Сирэль', 'Ауриэн', 'Кальдор']
const LAST = ['Тисовый', 'Смолокур', 'Лесной', 'Белый Лук', 'Хвойный', 'Корнеплёт']
const person = () => `${pick(FIRST)} ${pick(LAST)}`
const NOTE = [
  'На каждом доме клеймо Лесного двора: белое дерево — у королевских паёв, чужой знак — у заложенных; в деревне знают свои паи так же, как свой возраст.',
  'Раз в год староста читает вслух выписку из Лесной книги: сколько стволов срубили на кого.',
  'Дети играют в «пай»: делят палками лес на сто частей и спорят, кому отдать последний.',
  'У тропы стоит столб с насечками — по одной на каждую посылку хлеба из Харнмарка.',
  'Лучники ходят на стрельбище с рассветом; тетивы здесь вьют сами, а наконечники покупают у фактора.',
  'Стены домов плетёные, крыши из тисовой дранки; железного гвоздя в деревне нет ни одного.',
  'В часовне Дома Света горит тисовая свеча: за каждый пай, возвращённый королю, ставят ещё одну.',
  'Смолокурня на краю деревни дымит круглый год: смолу везут в Брукельрит и дальше — Каяя.'
]
let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type, lines = []
  if (p.name === 'Аваллонэ') {
    lines.push('Аваллонэ — столица Таварвайта у подножия горы, где кочевые эльфы когда-то разбили свой последний стан. Дома стоят на тисовых сваях ярусами по склону, дворец короля — самый высокий из шестисот стволов; вокруг — стрельбища и Палата Паёв.')
    lines.push('Здесь живёт король Тауртирит, храм Дома Света, Лесной двор и контора Каяя — лучший дом города принадлежит фактору Бонифацию Парцу.')
  } else if (p.name === 'Брукельрит') {
    lines.push('Брукельрит — порт Таварвайта: причалы из тиса, склады смолы и дёгтя, баржи на Харнмарк и Каяя. Через него идёт весь вывоз леса и весь ввоз хлеба.')
    lines.push('Хлебная очередь у складов длиннее лесной. На каждом причале — клеймо Лесного двора; кредиторам рубят с левого борта, королю — с правого.')
  } else if (t === 'town') {
    lines.push(`${p.name} — эльфийский город из дерева: ярусные дома, высокие ворота-арки, Дом старейшин и стрельбище. ${p.name === 'Ильмарион' ? 'Здесь Лесной двор клеймит стволы.' : p.name === 'Тирион' ? 'Рядом Тирионские проходы, где стоят копейщики Хальдора.' : 'Смолокуры и плотники живут по долине.'}`)
    lines.push(pick(NOTE))
  } else {
    lines.push(`${p.name} — лесная деревня эльфов: плетёные дома под тисовой дранкой, смолокурня и стрельбище. Староста — ${person()}.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${landOf(p)}; живут лесные эльфы.`)
  p.description = lines.join(' ')
  n++
}
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Аваллонэ'), il = byName('Ильмарион'), tir = byName('Тирион'), port = byName('Брукельрит')
place('lore-tw-capital', 'Аваллонэ', 'capital', sx(cap), null, '**Столица Таварвайта.** Дворец из шестисот стволов, Палата Паёв, Лесной двор, храм Дома Света.', st.id, [0, 0], 'Король Тауртирит')
place('lore-tw-hall', 'Палата Паёв', 'landmark', sx(cap), 984.2, '**Лесная книга.** Здесь хранят сто строк паёв и расписки кредиторов.', '', [-16, -12])
if (il) place('lore-tw-court', 'Лесной двор', 'landmark', sx(il), 978.6, '**Клеймо стволов.** Двор клеймит лес для короля и для кредиторов.', '', [14, 10])
if (tir) place('lore-tw-pass', 'Тирионские проходы', 'landmark', sx(tir), 990.5, '**Застава копейщиков.** Серебро Каяя 990 г. ушло на эти заставы.', '', [-12, 10])
if (port) place('lore-tw-bread', 'Хлебный причал', 'landmark', sx(port), 995.3, '**Хлеб Дома Эльмин.** С 995 г. сюда идут баржи из Харнмарка.', '', [12, -10])
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-tw-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (cap && tir) world.armies.push({ id: 'lore-army-tw-978', name: 'Сход у подножия горы (978)', mapId: 'world', stateId: st.id, color: '#6aaa5a', waypoints: [pt(tir, 977.8), pt(cap, 978.4)] })
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Таварвайт: описаний ${n}`)
