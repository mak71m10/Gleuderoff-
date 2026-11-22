// Рейх на карте: Сигузмун (столица, бывш. Зигингард), Фила (бывш. Брасинхольм), Сумаркат (бывш. Баденмюнде), Сумаркад (бывш. Целдорф);
// замок Вальталь — старая тюрьма колонии; остальные поселения разграблены. Места: Пустой трон, шахты Каменного поиска, Ночь Открытых Камер,
// Тропа Отбывших. Поход дневной охоты 1008 г. в Болетарию. Запуск после kreccaka-detail.mjs: node scripts/reich-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/reich.mjs'

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
  { old: 'Зигингард', name: 'Сигузмун', type: 'town' },
  { old: 'Брасинхольм', name: 'Фила', type: 'town' },
  { old: 'Баденмюнде', name: 'Сумаркат', type: 'town' },
  { old: 'Целдорф', name: 'Сумаркад', type: 'town' }
]
const own = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
for (const c of CITIES) {
  const p = own.find((x) => x.name === c.old || x.name === c.name)
  if (!p) continue
  const area = admin.get(p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
  p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type: c.type }
}
const provs = own
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => `${admin.get(p.areaId)?.name ?? ''}`
const RUIN = [
  'Половина крыш провалена; в целых домах живут по десять семей, а двери сняты — «у зирога нет своего».',
  'На стене бывшей церкви гвоздём выцарапан Император: корона, глаза, и больше ничего.',
  'Посреди площади — общий котёл на треноге; с рассветом сюда несут всё, что взяла охота.',
  'Колодец засыпан камнями: так метят место, где жили Отбывшие.',
  'Стены исписаны цифрами — сколько лет осталось каждому роду.',
  'Скотины нет: её съели в первый год. Лес вокруг — единственный, с кем Рейх не воюет.'
]
let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const lines = []
  if (p.name === 'Сигузмун') {
    lines.push('Сигузмун — столица Рейха: бывший посёлок надзирателей колонии, ободранный до камня. На месте сожжённой комендатуры под открытым небом стоит Пустой трон; на сиденье каждый день кладут лучшее из добычи, а Первый Узник сидит рядом на корточках.')
    lines.push('Здесь живут писари Книги Сроков — единственные люди, которых зироги не тронули в Ночь Открытых Камер.')
  } else if (p.name === 'Вальталь') {
    lines.push('Вальталь — каменная тюрьма колонии: три кольца стен, сотни камер, вскрытых в 978 г. и так и не закрытых. В нижних камерах зироги держат добычу; в верхних — спят.')
  } else if (p.settlement.type === 'town') {
    lines.push(`${p.name} — разграбленный городок Рейха: имперские дома без дверей и крыш, общий котёл на площади, ${pick(['свалка костей у ворот', 'шкуры на каждом заборе', 'вышка надзирателей, превращённая в гнездо ловчих'])}.`)
    lines.push(pick(RUIN))
  } else {
    lines.push(`${p.name} — опустошённая деревня: стены без крыш, огороды заросли. Здесь стоят на ночь стаи дневной охоты.`)
    lines.push(pick(RUIN))
  }
  lines.push(`${landOf(p)}; земля Рейха.`)
  p.description = lines.join(' ')
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Сигузмун'), val = byName('Вальталь'), frei = byName('Фрейерберг'), sumk = byName('Сумаркат')
if (cap) place('lore-rh-capital', 'Сигузмун', 'capital', sx(cap), null, '**Столица Рейха.** Пустой трон, писари Книги Сроков.', st.id, [0, 0], 'Первый Узник Фар Зиус')
if (cap) place('lore-rh-throne', 'Пустой трон', 'landmark', sx(cap), 978.7, '**Трон Императора** под открытым небом; на него не садится никто.', '', [-16, -12])
if (val) place('lore-rh-cells', 'Ночь Открытых Камер', 'battle', sx(val), 978.3, '**978.3.** Рейг-зироги вскрывают камеры Вальталя и вырезают стражу.', '', [14, 12])
if (frei) place('lore-rh-mines', 'Шахты Каменного поиска', 'landmark', sx(frei), 997.2, '**Каменный поиск.** Семьсот копателей ищут камень бессмертия.', '', [14, -10])
if (sumk) place('lore-rh-path', 'Тропа Отбывших', 'landmark', sx(sumk), 1008.3, '**1008.3.** Отсюда сорок семей Дальков ушли через перевал в Темерию.', '', [-14, 10])

world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-rh-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
const gris = world.provinces.find((p) => p.name === 'Грисинталь')
if (val && gris) world.armies.push({ id: 'lore-army-rh-1008', name: 'Дневная охота у Грисинталя (1008)', mapId: 'world', stateId: st.id, color: '#a03a2a', waypoints: [pt(val, 1008.35), pt(gris, 1008.4), pt(val, 1008.45)] })

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Рейх: описаний ${n}`)
