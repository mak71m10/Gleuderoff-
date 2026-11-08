// Когалым на карте: Когалым (столица, бывш. Унтерельвальд), Мёльн (бывш. Эберенберг), Хмельнц (бывш. Корбах), Нюнех (бывш. Брасельхаузен);
// описания всех поселений, места (Сходная изба, Сходный камень, Хранилище Бирок, Поле Первого Схода, Усадьба Грюнау, Дозор Нюнеха), отряды Республики 977 г.
// Запуск после lyria-detail.mjs: node scripts/kogalym-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/kogalym.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261112
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

const CITIES = [
  { id: 1980, old: 'Унтерельвальд', name: 'Когалым', type: 'city' },
  { id: 1886, old: 'Эберенберг', name: 'Мёльн', type: 'town' },
  { id: 1914, old: 'Корбах', name: 'Хмельнц', type: 'town' },
  { id: 1981, old: 'Брасельхаузен', name: 'Нюнех', type: 'town' }
]
for (const c of CITIES) {
  const p = world.provinces.find((x) => x.id === c.id)
  const area = admin.get(p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
  p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type: c.type }
}

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => admin.get(p.areaId)?.name ?? ''
const FN = ['Ханс', 'Клаус', 'Ульрих', 'Гюнтер', 'Хайнц', 'Дитрих', 'Рудольф', 'Бруно', 'Фриц', 'Вальтер']
const FW = ['Эрна', 'Матильда', 'Агнес', 'Ирма', 'Гизела', 'Эльза', 'Берта', 'Хильда']
const SNm = ['Брасельхаузен', 'Корбах', 'Остинау', 'Кельенмюнде', 'Унтерельвальд', 'Хольцау', 'Морербах', 'Лауинбрук', 'Бадерхольм', 'Штайнрит', 'Шёнлаге', 'Оберхольм']
const person = (w) => `${pick(w ? FW : FN)} ${pick(SNm)}`

const CROP = ['хмель и ячмень', 'рожь и лён', 'горох и репу', 'коров и масло', 'овец и шерсть', 'яблони и пасеки']
const NOTE = [
  'У околицы стоит Сходный камень: говорить встают именно на него, и камень уже протёрт ступнями.',
  'На косяке каждого дома висит бирка: половинка слов, сказанных о хозяине; вторую половинку хранят в Когалыме.',
  'Общий Котёл на площади: хлеб и похлёбка для всех, кто пришёл, а хозяйка Котла всегда ест последней.',
  'Дети здесь играют в «Сход»: тянут жребий, кто будет Старостой Воза, и катают по деревне старую бочку.',
  'Каждую весну на подпруге воза делают новую зарубку: счёт Бремени, которое деревня несёт за год.',
  'По вечерам старики вспоминают «Ночь усадеб»: одни крестятся, другие молчат, третьи рассказывают, как всё было на самом деле.',
  'В Учильне при деревне по воскресеньям стучат учебные копья: копейщиков тут набирают без указа, по желанию.',
  'Над крышами не видно господского флюгера: ни графского, ни республиканского.'
]

let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type
  const lines = []
  if (p.name === 'Когалым') {
    lines.push('Когалым — столица без господ: деревянный город на широкой равнине, где вместо дворца стоит Сходная изба — длинный бревенчатый дом с открытыми стенами. Рядом — Сходный камень, дуб Суда Села и Хранилище Бирок, в котором лежат половины слов о каждом Достойном.')
    lines.push('Здесь раз в год, в начале Ячори, собирается Сельский сбор — шестьдесят Достойных; здесь стоит Первый Воз — телега беглецов, до сих пор не ржавеющая. Староста Воза — Ханс Брасельхаузен, выбранный жребием.')
  } else if (p.name === 'Мёльн') {
    lines.push('Мёльн — город кузнецов: дым над крышами, звон молотов и аккуратные ряды копий у ворот. Ортвин Мёльнер, десятский города, кует копья для Дружины и не берёт платы.')
    lines.push(pick(NOTE))
  } else if (p.name === 'Хмельнц') {
    lines.push('Хмельнц — город хмеля: огромные склады, сушильни и шатры хмельных рядов; хмель отсюда уходит в Темерию, Лигу и Республику. Здесь живут Хозяйские: зажиточные, быстрые, недовольные правилом «сначала воз».')
    lines.push('Хозяйка складов — Гизела Хмельнцер; ярмарки идут трижды в год.')
  } else if (p.name === 'Нюнех') {
    lines.push('Нюнех — пограничный город у Республики: бревенчатые стены, сторожевые башни и огни на холмах. Дозор Нюнеха стоит ночью и днём; сюда в 1002 г. пришёл отряд Республики, и Сбор принял мир.')
    lines.push('Здесь по ярмаркам пьёт хмельное комиссар Республики Бруно Вейль — и смотрит на всех слишком внимательно.')
  } else if (t === 'town') {
    lines.push(`${p.name} — городок Сельского сбора: Сходная изба, рынок и кузница. Живут ${pick(['хмелем и ячменём', 'железом и копьями', 'мельницами и лесом', 'торговлей по реке'])}.`)
    lines.push(`Десятский — ${person()}.`)
    lines.push(pick(NOTE))
  } else {
    lines.push(`${p.name} — деревня Схода: ${pick(['бревенчатые избы с высокими крышами', 'белёные дома и мельница', 'длинные дворы с хмельниками'])}, общий колодец и Сходный камень. Выращивают ${pick(CROP)}.`)
    lines.push(`Староста — ${person(chance(0.3))}${chance(0.3) ? ', бывшая беглая' : ''}.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${landOf(p)}.`)
  p.description = lines.join(' ')
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Когалым'), moeln = byName('Мёльн'), hm = byName('Хмельнц'), nyun = byName('Нюнех'), ost = byName('Остинау'), kel = byName('Кельенмюнде')
place('lore-kg-capital', 'Когалым', 'capital', sx(cap), null, '**Столица Схода.** Сходная изба, Сходный камень, дуб Суда Села и Хранилище Бирок; здесь раз в год собираются шестьдесят Достойных.', st.id, [0, 0], 'Староста Воза Ханс Брасельхаузен')
place('lore-kg-hall', 'Сходная изба', 'landmark', sx(cap), 978.1, '**Дом Сбора.** Длинная бревенчатая изба с открытыми стенами; места Достойных — скамьи по кругу, без почётных кресел.', '', [-16, -12])
place('lore-kg-archive', 'Хранилище Бирок', 'landmark', sx(cap), 978.2, '**Склад слов.** Половины всех бирок Когалыма: Три Слова каждого Достойного.', '', [16, -12])
if (kel) place('lore-kg-field', 'Поле Первого Схода', 'landmark', sx(kel), 978.1, '**978.1.** Здесь люди отказались и от помещиков, и от Республики и выбрали шестьдесят Достойных.', '', [-14, 12])
if (ost) place('lore-kg-estate', 'Усадьба Грюнау', 'battle', sx(ost), 977.3, '**977.3.** Здесь Республика убила графа Рудольфа фон Грюнау и его жену; сын-младенец исчез.', '', [14, 12])
if (nyun) place('lore-kg-watch', 'Дозор Нюнеха', 'landmark', sx(nyun), 988, '**Огни на холмах.** Сигнальные столбы вдоль границы с Республикой; на каждом — бирка караульного.', '', [14, -10])
if (hm) place('lore-kg-hops', 'Хмельные склады', 'landmark', sx(hm), null, '**Хмель на три границы.** Склады Хозяйских: сушилки, шатры, весы.', '', [-14, -10])
if (moeln) place('lore-kg-forge', 'Кузницы Мёльна', 'landmark', sx(moeln), 981.2, '**Копья Дружины.** Кузнецы Мёльна куют для Учильни и не берут платы.', '', [12, 12])

world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-kg-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
const rep = world.states.find((s) => s.base.name === 'Республика')
if (nyun && ost && cap) world.armies.push({ id: 'lore-army-kg-977', name: 'Отряды Республики по усадьбам Когалыма (977)', mapId: 'world', stateId: rep?.id ?? '', color: '#a04a3a', waypoints: [pt(nyun, 977.1), pt(ost, 977.3), pt(cap, 977.4)] })

writeFileSync(WORLD, JSON.stringify(world, null, 1))
const cnt = {}
for (const p of provs) if (p.settlement) cnt[p.settlement.type] = (cnt[p.settlement.type] ?? 0) + 1
console.log(`Когалым: описаний ${n}, по типам ${JSON.stringify(cnt)}`)
