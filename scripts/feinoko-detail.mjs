// Фейноко на карте: Фейн (бывш. Дорнбах) — столица со скалой Гряды Великанов; Ниото (бывш. Ротлаге), Мориока (бывш. Кельбург), Вокио (бывш. Альтведель);
// горные деревни Корергард и Ведельгард. Названия городов — по ответу автора. Запуск после tavarvait-detail.mjs: node scripts/feinoko-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/feinoko.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261125
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

const CITIES = [
  { id: 2001, old: 'Дорнбах', name: 'Фейн', type: 'city' },
  { id: 2013, old: 'Ротлаге', name: 'Ниото', type: 'town' },
  { id: 1990, old: 'Кельбург', name: 'Мориока', type: 'town' },
  { id: 2054, old: 'Альтведель', name: 'Вокио', type: 'town' }
]
for (const c of CITIES) {
  const p = world.provinces.find((x) => x.id === c.id)
  if (!p) continue
  const area = admin.get(p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
  p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type: c.type }
}
for (const p of world.provinces.filter((x) => x.owners?.at(-1)?.[1] === st.id && !x.settlement)) p.settlement = { x: p.x, y: p.y, type: 'village' }

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => admin.get(p.areaId)?.name ?? ''
const NOTE = [
  'У дома стоит маленький камень, обмотанный рыбьей сетью: так в каждом дворе отмечают свой камень на Гряде, хотя никто не видел его целиком.',
  'В первую ночь Ячори деревня не спит: вождь выходит к тропе и слушает, принесли ли весть с Гряды — «звучит» или «тих».',
  'Дети играют в «девять камней»: кладут гальку в ряд и по очереди забирают; кто забрал последним — тот Журавль.',
  'Над дверью висит сушёная рыба на нитке — знак Рыбы, даже в деревнях других племён.',
  'Вечером старики спорят, были ли великаны выше гор или только гор вровень; бить за это не принято, но спорят с серьёзными лицами.',
  'Тропа вымощена плоским камнем из ниотских карьеров, и каждый возчик платит камушком за проход.',
  'Здесь не молятся: на праздниках стоят тихо у камня и считают, сколько их стало с прошлого года.',
  'Хижины строят на каменных ступенях, крыши плоские, из серого сланца; под стрехой — плетёные фонари из рисовой бумаги.'
]
const FIRST = ['Тайра', 'Хайго', 'Мицу', 'Рэн', 'Ичиро', 'Сора', 'Юки', 'Кайто', 'Акира', 'Харуко']
const LAST = ['Рыбак', 'Камнетёс', 'Тропник', 'Каменщик', 'Сетевой', 'Горный']
const person = () => `${pick(FIRST)}-${pick(LAST)}`
let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type, lines = []
  if (p.name === 'Фейн') {
    lines.push('Фейн — столица Фейноко на склоне скалы, где в девяти нишах лежит Гряда Великанов: девять костей великанов, по одной от племени. Террасы из серого камня, плоские кровли, бумажные фонари над каждой улицей.')
    lines.push('Здесь живёт государь Минамото-но-Исо, заседают четыре старейшины и ходит босиком Хранитель Гряды. Перед Гряду выходит широкая площадь, где каждую Ночь Камней стоит всё племя.')
  } else if (p.name === 'Ниото') {
    lines.push('Ниото — город каменоломен и возчиков: плиты, жернова и сушёная рыба идут отсюда на Таварвайт и Кагию. Дома из серого сланца, широкие волокуши у каждого двора.')
    lines.push('Здесь вождь Лиса Мацуо-но-Тоён и торгует с фактором Каяя; из Ниото родом Сато Камнетёс.')
  } else if (p.name === 'Мориока') {
    lines.push('Мориока — ледяной город Журавля: на высоком склоне, где глубокие ледники даже летом. Журавль хранит свой камень в тёмной нише и гордится, что умеет его забрать.')
    lines.push('Вождь — Хаяси-но-Рин. С Мориоки виден перевал, по которому идут люди Рейха.')
  } else if (p.name === 'Вокио') {
    lines.push('Вокио — город камыша и запруд на равнине между гор: рыбные садки, сети и плетёные дома на сваях. Камыш — одно из девяти племён.')
    lines.push('Отсюда рыба идёт к Кагии и Каяя; Вокио — самое «мирное» место Гряды.')
  } else {
    lines.push(`${p.name} — горная деревня момитов: ступени из серого камня, дома с плоскими крышами и рыбацкий ручей. Староста — ${person()}.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${landOf(p)}; живут момиты.`)
  p.description = lines.join(' ')
  n++
}
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Фейн'), nio = byName('Ниото'), mor = byName('Мориока'), vok = byName('Вокио')
place('lore-fn-capital', 'Фейн', 'capital', sx(cap), null, '**Столица Фейноко.** Гряда Великанов, дом государя, зал четырёх старейшин.', st.id, [0, 0], 'Государь Минамото-но-Исо')
place('lore-fn-ridge', 'Гряда Великанов', 'landmark', sx(cap), 940.3, '**Девять ниш.** Камни великанов девяти племён; семь заняты, две пусты.', '', [-16, -12])
if (nio) place('lore-fn-quarry', 'Карьеры Ниото', 'landmark', sx(nio), 962.5, '**Камень и жернова.** Идут на Таварвайт и Кагию.', '', [14, 10])
if (mor) place('lore-fn-glacier', 'Ледник Журавля', 'landmark', sx(mor), 977.9, '**Мориока.** Ледник, за который в 977 г. Журавль дал камень; перевал на Рейх виден отсюда.', '', [-12, 10])
if (vok) place('lore-fn-ponds', 'Рыбные запруды Вокио', 'landmark', sx(vok), 976.1, '**Камыш.** Запруды, за которые Камыш дал свой камень.', '', [12, -10])
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-fn-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (cap && nio && mor && vok) world.armies.push({ id: 'lore-army-fn-972', name: 'Поход дани Исо (972–978)', mapId: 'world', stateId: st.id, color: '#5a8ac8', waypoints: [pt(cap, 972.4), pt(nio, 975.2), pt(vok, 976.1), pt(mor, 977.9), pt(cap, 978.4)] })
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Фейноко: описаний ${n}`)
