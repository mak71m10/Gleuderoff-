// Магнолия на карте: Эрисан (столица, бывш. Ландельрит), Альен (бывш. Шёнбрук), Гливин (бывш. Эльмгард), Фастинат (бывш. Нейенхольм);
// описания поселений, места (остров Союза, Шпили Наллы, сады Альена, Чернолесье, руины Вальау, Элленхайн), походы 976–979.
// Запуск после boletaria-detail.mjs: node scripts/magnolia-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { MN_NAMES, STATE } from './lore/magnolia.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261122
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

const CITIES = [
  { id: 1963, old: 'Ландельрит', name: 'Эрисан', type: 'city' },
  { id: 2002, old: 'Шёнбрук', name: 'Альен', type: 'city' },
  { id: 2024, old: 'Эльмгард', name: 'Гливин', type: 'town' },
  { id: 1986, old: 'Нейенхольм', name: 'Фастинат', type: 'port' }
]
for (const c of CITIES) {
  const p = world.provinces.find((x) => x.id === c.id)
  if (!p) continue
  const area = admin.get(p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
  p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type: c.type }
}

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => `${admin.get(p.areaId)?.name ?? ''}`
const human = (w) => `${pick(w ? MN_NAMES.humanWomen : MN_NAMES.humanMen)} ${pick(MN_NAMES.families)}`
const elf = () => `${pick(MN_NAMES.men)} ${pick(['Кан', 'Ир'])} ${pick(['Валейр', 'Таллис', 'Наэрат', 'Сиэннар', 'Илтар'])}`

const FARM = ['рожь и ячмень', 'лён', 'репу и капусту', 'свиней', 'пчёл', 'коз']
const NOTE = [
  'В сумерках над деревней бьёт Сумеречный колокол, и через четверть часа на улице нет ни одного человека — только надсмотрщик-Полутень с фонарём.',
  'На месте сельской церкви Дома Света стоит чёрный Шпиль Наллы, сложенный из её же камней; колокольню сбили, а колокол перелили в Сумеречный.',
  'У ворот — доска Тёмной подати: сколько должен каждый двор, мелом, вдвое больше, чем при Империи.',
  'Люди здесь не поднимают глаз на эльфа и сходят с дороги в канаву — так велит закон.',
  'Дети играют в «чашу»: роняют камешки в ведро с водой и спорят, сколько утонуло.',
  'На хлебе в пекарне надрезан крест — знак Дневного колокола; кто знает, тот поймёт.',
  'Вдоль дороги цветут белые и лиловые магнолии: их сажают по приказу короля у каждого поста.',
  'Половина домов пустует с 1009 г.: семьи ушли ночью в лес, к Креццаке.',
  'Староста-человек отчитывается Полутени, а Полутень — сумеречному господину, которого здесь видели дважды за десять лет.'
]

let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type
  const lines = []
  if (p.name === 'Эрисан') {
    lines.push('Эрисан — столица Магнолии на обоих берегах устья: западный берег — дом Оттект, восточный — дом Таллис, а посередине реки — остров Союза с обсидиановой плитой Клятвы Тридцати Трёх. Над верхним городом — светлый камень, чёрно-лиловые крыши с загнутыми концами и круглые окна, что ночью светятся лиловым.')
    lines.push('Правит король Арнам Кан Оттект. Нижний город — старый имперский порт, где живут люди: пекарни, причалы, таможня Пакта 1002 г. и дома республиканских купцов, которым одним разрешено ходить по улицам после колокола.')
  } else if (p.name === 'Альен') {
    lines.push('Альен — город садов магнолий, второй в королевстве. Сады до 988 г. принадлежали дому Илтар; теперь они королевские, а Илтары в них — садовники. Здесь сидит наследник Каэрон.')
    lines.push('В 1009 г. люди Альена не разошлись после колокола — Тихие клинки зарубили сорок человек на рыночной площади. Площадь с тех пор пустует по вечерам и днём.')
  } else if (p.name === 'Гливин') {
    lines.push('Гливин — город Тихих клинков: казармы ордена, площадки для поединков и пещера, где в 862–976 гг. пряталась Чаша Наллы. Дома Валейр и Сиэннар живут на разных берегах ручья и не здороваются.')
  } else if (p.name === 'Фастинат') {
    lines.push('Фастинат — портовый городок жриц: здесь Шпиль Наллы выше всех в королевстве, а в нём стоит Чаша. Дом Наэрат держит причалы и сам решает, какой корабль войдёт.')
  } else if (p.name === 'Нейинау') {
    lines.push('Нейинау — край Чернолесья: в холмах над морем пещеры тёмных эльфов Вирры Ут-Мор, сдавшихся в 997 г. Люди сюда не ходят даже днём.')
  } else if (p.name === 'Орхольм') {
    lines.push('Орхольм стоит на месте Элленхайна — столицы светлых эльфов, взятой в 805 г. От их дворца остались белые ступени в траве; светлые слуги кланяются им, проходя мимо.')
  } else if (t === 'ruins') {
    lines.push(`${p.name} — руины имперского замка, сожжённого в Ночь Чёрных Магнолий 976 г. В подвалах, говорят, ещё лежат гербы имперских родов, которых больше нет.`)
  } else if (t === 'town' || t === 'city' || t === 'port') {
    lines.push(`${p.name} — городок Магнолии: старые имперские дома внизу, светлый камень и лиловые крыши наверху, где живут эльфы. Надсмотрщик — ${human(false)} по прозвищу Полутень.`)
    lines.push(pick(NOTE))
  } else if (t === 'fishing') {
    lines.push(`${p.name} — рыбацкая деревня у моря: лодки людей, а лучший улов уходит в Эрисан на столы Чистых. Староста — ${human(chance(0.3))}.`)
    lines.push(pick(NOTE))
  } else {
    lines.push(`${p.name} — ${p.terrain >= 4 ? 'деревня в холмах' : 'лесная деревня'}: старые имперские дома, поля и пасеки, держат ${pick(FARM)}. Староста — ${human(chance(0.3))}, господин — ${elf()}.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${landOf(p)}; земли короля Магнолии.`)
  p.description = lines.join(' ')
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Эрисан'), al = byName('Альен'), gl = byName('Гливин'), fa = byName('Фастинат'), ne = byName('Нейинау'), orh = byName('Орхольм'), va = byName('Вальау')
place('lore-mn-capital', 'Эрисан', 'capital', sx(cap), null, '**Столица Магнолии.** Два берега, остров Союза и плита Клятвы Тридцати Трёх.', st.id, [0, 0], 'Король Арнам Кан Оттект')
place('lore-mn-isle', 'Остров Союза', 'landmark', sx(cap), 712.4, '**712.4.** Здесь Каэльт Кан Оттект и Ниара Ир Таллис соединили два племени.', '', [-16, -12])
place('lore-mn-night', 'Ночь Чёрных Магнолий', 'battle', sx(cap), 976.8, '**976.8.** Арнам открывает ворота изнутри; к утру в городе нет ни одного имперского дворянина.', '', [16, 12])
if (al) place('lore-mn-gardens', 'Сады Альена', 'landmark', sx(al), 750, '**Сады магнолий.** До 988 г. — дома Илтар, теперь — короля.', '', [14, -10])
if (al) place('lore-mn-riot', 'Хлебный бунт Альена', 'battle', sx(al), 1009.2, '**1009.2.** Люди не разошлись после колокола; сорок убитых.', '', [-14, 12])
if (gl) place('lore-mn-cave', 'Пещера Чаши', 'temple', sx(gl), 862.2, '**Тайник 862–976 гг.** Здесь сто четырнадцать лет пряталась Чаша Наллы.', '', [14, 10])
if (fa) place('lore-mn-spire', 'Великий Шпиль Наллы', 'temple', sx(fa), 980, '**Храм Тьмы.** Самый высокий Шпиль Наллы; в нём хранится Чаша.', '', [14, -10])
if (ne) place('lore-mn-blackwood', 'Чернолесье', 'landmark', sx(ne), 997.5, '**Пещеры тёмных эльфов**, сдавшихся в 997 г.', '', [14, 10])
if (orh) place('lore-mn-ellenhain', 'Руины Элленхайна', 'landmark', sx(orh), 805.3, '**805.3.** Столица светлых эльфов, взятая сумеречными.', '', [-14, 10])
if (va) place('lore-mn-valau', 'Сожжённый Вальау', 'battle', sx(va), 976.8, '**976.8.** Имперский замок, сожжённый в Ночь Чёрных Магнолий.', '', [14, 10])

world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-mn-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (gl && cap && va) world.armies.push({ id: 'lore-army-mn-976', name: 'Ночь Чёрных Магнолий (976)', mapId: 'world', stateId: st.id, color: '#8a5ad0', waypoints: [pt(gl, 976.7), pt(cap, 976.8), pt(va, 976.9)] })
if (va && cap && al) world.armies.push({ id: 'lore-army-mn-republic', name: 'Республика на побережье (977–979)', mapId: 'world', stateId: world.states.find((s) => s.base.name === 'Республика')?.id ?? '', color: '#a04a3a', waypoints: [pt(va, 977.5), pt(cap, 977.6), pt(al, 979.6)] })

writeFileSync(WORLD, JSON.stringify(world, null, 1))
const cnt = {}
for (const p of provs) if (p.settlement) cnt[p.settlement.type] = (cnt[p.settlement.type] ?? 0) + 1
console.log(`Магнолия: описаний ${n}, по типам ${JSON.stringify(cnt)}`)
