// Павильон Грёз на карте: Сингор (бывш. Кирхельвейлер) — столица с Сонным Хранилищем и Нотным двором; заставы-консульства над Кагией, Лирией и Реданией;
// описания поселений, места, походы Патруля. Запуск после redania-detail.mjs: node scripts/pavilion-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/pavilion.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261123
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

const p0 = world.provinces.find((x) => x.id === 1640)
if (p0) {
  const area = admin.get(p0.areaId)
  if (area?.name === 'Округ Кирхельвейлер') area.name = 'Округ Сингор'
  p0.name = 'Сингор'
  p0.settlement = { ...(p0.settlement ?? { x: p0.x, y: p0.y }), type: 'city' }
}
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => admin.get(p.areaId)?.name ?? ''
const FIRST = ['Лукас', 'Ингеборг', 'Эмиль', 'Рената', 'Йорн', 'Ада', 'Фридрих', 'Бернд', 'Хелена', 'Мартин']
const LAST = ['Кестрель', 'Вейс', 'Холм', 'Эйкен', 'Бланк', 'Мунк', 'Эриксен', 'Вальц', 'Грау', 'Лорц']
const person = () => `${pick(FIRST)} ${pick(LAST)}`
const NOTE = [
  'В каждом доме по семь свечей — по числу окон Павильона; у зажиточных одна из них золотая.',
  'На околице стоит консульская будка: серый плащ с белым ключом проверяет только купцов, а не пешеходов.',
  'Дети играют в «грёзы»: придумывают план, называют цену в камешках и спорят, кто подпишет.',
  'У колодца висит нотный листок; вечером его поют все, кто идёт мимо.',
  'Раз в три года, перед приездом Ревизора, деревня белит стены и прячет лишние лошади.',
  'Староста держит книжицу расходов, как у казначея: сколько отдано консулу, сколько оставлено на свечи.',
  'Тут любят музыку: на каждой свадьбе играют, даже если надо одолжить лютню.',
  'Над дверями — медный ключ, как знак Павильона; чужие думают, что это кузнечный.'
]
let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type, lines = []
  if (p.name === 'Сингор') {
    lines.push('Сингор — столица Павильона Грёз на старой имперской заставе: серый город на холме, где в центре стоит Сонное Хранилище — низкое здание с одним входом и двумя замками. Рядом — Нотный двор и школа музыки.')
    lines.push('Здесь живёт Хранитель Натен Россо Сен, хранится Книга Окон и стоят казармы Патруля. Над городом семь окон светятся по вечерам — по числу Грёз.')
  } else if (t === 'town') {
    lines.push(`${p.name} — городок Павильона: консульский двор, нотная школа и склад посольских даров. Консул — ${person()}.`)
    lines.push(pick(NOTE))
  } else {
    lines.push(`${p.name} — ${p.terrain === 6 ? 'деревня у сухого русла с колодцем и консульской будкой' : 'деревня в лесу: фахверковые дома, мельница и тропа к заставе'}. Староста — ${person()}.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${landOf(p)}; живут имперцы под покровительством Дэодэсии.`)
  p.description = lines.join(' ')
  n++
}
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Сингор'), tg = byName('Тальергард'), ulv = byName('Ульвейлер'), tf = byName('Тальенвейлер')
place('lore-pv-capital', 'Сингор', 'capital', sx(cap), null, '**Столица Павильона Грёз.** Сонное Хранилище, Нотный двор, казармы Патруля.', st.id, [0, 0], 'Хранитель Натен Россо Сен')
place('lore-pv-vault', 'Сонное Хранилище', 'landmark', sx(cap), 979.5, '**Золотой запас.** Подвал с двумя замками: ключ Хранителя и ключ Ревизора.', '', [-16, -12])
place('lore-pv-notes', 'Нотный двор', 'landmark', sx(cap), 984.3, '**Музыка и дары.** Школа и склад посольских подарков.', '', [16, -12])
if (tg) place('lore-pv-consul', 'Консульская застава Тальергард', 'landmark', sx(tg), 984.3, '**Над Кагией.** Консул Бранд Холм считает копья Багряной гвардии по пыли над дорогой.', '', [12, 10])
if (ulv) place('lore-pv-border', 'Дозор у Ульвейлера', 'landmark', sx(ulv), 987.6, '**У Кулагона.** Здесь Патруль встретил кулагонских бродников и вывез Фроке Тьяллингу.', '', [-12, 10])
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-pv-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (cap && ulv) world.armies.push({ id: 'lore-army-pv-1010', name: 'Патруль Ильи Россо: побег Фроке (1010)', mapId: 'world', stateId: st.id, color: '#e0b84a', waypoints: [pt(cap, 1010.05), pt(ulv, 1010.1), pt(cap, 1010.2)] })
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Павильон: описаний ${n}`)
