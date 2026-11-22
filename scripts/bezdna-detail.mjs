// Братство Бездны на карте: Дальберг — порт и Колодец (столица), деревни острова с описаниями, места (Лестница, Бунт Гербаха,
// Обвал на Нижнем ярусе, паром), походы Спусков. Запуск после ntower-detail.mjs: node scripts/bezdna-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/bezdna.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p

const TEXT = {
  Дальберг: 'Порт острова и ворота Колодца: каменные пристани, склады с чёрным камнем и паром на материк. За портом — брошенная имперская шахта, где живёт всё Братство; вход в неё закрыт чёрными воротами с цепью. Старшина порта — Ханна Дальберг, её сын лежит в Колодце с Второго Спуска. Здесь каждые семь лет выстраивается очередь родителей — жребий тянет сам Колодец.',
  Гербах: 'Рыбацкая деревня на севере: сети на кольях, багры у каждой двери. В 1006 г. рыбаки Райнера Мельника вышли на причал и не отдали детей; Братство забрало их ночью через две недели. Над деревней по вечерам не поют, а считают, сколько остаётся до 1013 г.',
  Ройерталь: 'Долинная деревня, из которой взят Оттмар Белый: овцы, ячмень, стены без окон на север. Старики говорят, что с тех пор в каждой семье растёт ребёнок «на запас» — для Спуска.',
  Веренштадт: 'Деревня с единственным храмом Дома Света на острове; священник Абт Лерх читает над забираемыми детьми Свет, ночью, когда Братство не видит.',
  Морерау: 'Овечья деревня у болота; мельник знает наизусть все ступени Лестницы по рассказам вернувшихся.',
  Кельинфельд: 'Пашенная деревня на дальнем конце острова: ячмень и репа, выкуп за детей платят зерном.',
  Орерхайм: 'Хутор у старой шахтной дороги; жители возят чёрный камень в Дальберг и не спрашивают, зачем.',
}
const NOTE = ['На дверном косяке нарезаны семь зарубок — по числу лет до Спуска.', 'В каждом доме хранят чёрный камешек: чтобы жребий не выпал, его кладут на порог.', 'Дети здесь играют в «Колодец»: бросают камень в ведро, кто попал — «спустился».', 'Выкуп платят зерном; старшие помнят, чей ребёнок остался.', 'Над печью висит бирка с именем ребёнка и годом Спуска.']
let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type
  p.description = [TEXT[p.name] ? `${p.name} — ${t === 'port' ? 'порт' : t === 'fishing' ? 'рыбацкая деревня' : 'деревня'} Братства Бездны.` : `${p.name} — деревня Братства Бездны.`, TEXT[p.name] ?? NOTE[n % NOTE.length], `${admin.get(p.areaId)?.name ?? ''}; имперцы острова.`].join(' ')
  n++
}
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
world.places = world.places.filter((p) => !p.id.startsWith('lore-bz-'))
const cap = byName('Дальберг'), gerb = byName('Гербах'), roy = byName('Ройерталь')
if (cap) {
  place('lore-bz-capital', 'Колодец', 'capital', sx(cap), 977.4, '**Колодец.** Брошенная имперская шахта у Дальберга: девять ярусов вниз, Лестница в сто тридцать ступеней, шесть наборов братьев. Магистр Оттмар Белый.', st.id, [0, 0], 'Магистр Оттмар Белый')
  place('lore-bz-stair', 'Лестница', 'landmark', sx(cap), 978.3, '**Лестница.** Сто тридцать ступеней вниз; каждый набор получает свою и носит её имя.', '', [16, -12])
  place('lore-bz-collapse', 'Обвал на Нижнем ярусе', 'battle', sx(cap), 984.5, '**984.5.** Оборвалась нижняя клеть: восемь Первых Спустившихся и семнадцать детей.', '', [-16, 12])
  place('lore-bz-fever', 'Чёрная лихорадка', 'battle', sx(cap), 1003.2, '**1003.2.** Лихорадка Колодца: умирает почти треть братьев и Матиас Крон, последний Первый.', '', [16, 14])
}
if (gerb) place('lore-bz-revolt', 'Бунт Гербаха', 'battle', sx(gerb), 1006.4, '**1006.4.** Рыбаки Райнера Мельника не отдали детей; Братство забрало их через две недели ночью.', '', [14, -12])
if (roy) place('lore-bz-ottmar', 'Родной дом Оттмара', 'landmark', sx(roy), 978.3, '**Ройерталь.** Оттмар Белый взят отсюда в семь лет; в доме до сих пор стоит его детская кровать.', '', [-14, 12])
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-bz-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (cap && gerb) world.armies.push({ id: 'lore-army-bz-1006', name: 'Пятый Спуск: ночью в Гербах (1006)', mapId: 'world', stateId: st.id, color: '#2a1a22', waypoints: [pt(cap, 1006.4), pt(gerb, 1006.5), pt(cap, 1006.55)] })
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Братство Бездны: описаний ${n}, мест ${world.places.filter((p) => p.id.startsWith('lore-bz-')).length}`)
