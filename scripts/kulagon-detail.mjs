// Кулагон на карте: переименования семи Бродов, описания всех поселений, места (Брод Договора, Дом Колец, Хранилище Черепков).
// Запуск после kogalym-detail.mjs: node scripts/kulagon-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/kulagon.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261113
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

const CITIES = [
  { id: 1531, old: 'Фрейштадт', name: 'Кулагбрюг' },
  { id: 1551, old: 'Хеймберг', name: 'Хоммаваль' },
  { id: 1426, old: 'Эшлаге', name: 'Атемагард' },
  { id: 1580, old: 'Шёнштейн', name: 'Бонгагард' },
  { id: 1601, old: 'Лаумюнде', name: 'Сикемаборг' },
  { id: 1445, old: 'Эшенберг', name: 'Вибенгатор' },
  { id: 1464, old: 'Обермюнде', name: 'Тьяллингафурт' }
]
for (const c of CITIES) {
  const p = world.provinces.find((x) => x.id === c.id)
  const area = admin.get(p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
}

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => admin.get(p.areaId)?.name ?? ''
const FN = ['Яспер', 'Эйбе', 'Хейн', 'Дирк', 'Яппе', 'Рейнер', 'Ауке', 'Бауке', 'Сиббе', 'Тьерд']
const FW = ['Фроке', 'Антье', 'Тьитске', 'Гриет', 'Йелтье', 'Рикст', 'Аафье', 'Ханне']
const SN = ['Роорда', 'Хоогстра', 'Бейма', 'Вассма', 'Яарсма', 'Дейкстра', 'Ийема', 'Куйпер', 'Ландстра']
const person = (w) => `${pick(w ? FW : FN)} ${pick(SN)}`
const FORD = { Кулагбрюг: 'Первый', Хоммаваль: 'Второй', Атемагард: 'Третий', Бонгагард: 'Четвёртый', Сикемаборг: 'Пятый', Вибенгатор: 'Шестой', Тьяллингафурт: 'Седьмой' }
const NOTE = [
  'На дверном косяке прибит железный завиток: знак «заложного двора» — здесь живёт или жил чужой наследник.',
  'У околицы стоит чаша для черепков: в День Черепков люди пишут имя и бросают черепок, и никто не смотрит, кто что написал.',
  'Дети здесь играют в «Звено»: встают кольцом, передают друг другу «наследника» и кричат «лопнуло!», кто уронит.',
  'Старики показывают шрам на ладони: рукопожатие на Договоре Колец когда-то делали до крови.',
  'На причале висит пёстрая верёвка: каждый узел — год, когда переправа обошлась без убитых.',
  'Люди тут осторожны: каждый знает, чей наследник живёт у соседа, и не говорит об этом вслух.',
  'Вечером у воды рассказывают про «Резню у Брода»: одни плачут, другие смеются, третьи уходят.',
  'Над колодцем вырезано кольцо: так отмечают, что вода здесь общая и чужого заложника поить можно.'
]
const CROP = ['рожь и ячмень', 'лён и овец', 'рыбу и угря', 'мельничную муку', 'яблоки и мёд', 'лодки и канаты']

let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type
  const lines = []
  if (p.name === 'Кулагбрюг') {
    lines.push('Кулагбрюг — столица на Первом Броде: каменный мост над рекой, а на нём Дом Колец — длинное здание, где семь Домов держат Совет; под мостом висят семь железных колец, по одному на Дом.')
    lines.push('Здесь стоит Хранилище Черепков: раз в год сюда свозят Чашу, и вольные люди выкладывают имена. Здесь же живёт Держатель Кулага Яспер Хеемстра.')
  } else if (FORD[p.name]) {
    lines.push(`${p.name} — ${FORD[p.name].toLowerCase()} Брод Кулага: твердыня Дома, мост или паром, а рядом заложный двор, где живёт наследник соседнего Дома.`)
    lines.push(`Староста брода — ${person(chance(0.3))}.`)
    lines.push(pick(NOTE))
  } else if (t === 'town') {
    lines.push(`${p.name} — городок на реке: пристань, рынок и мельница. Живут ${pick(CROP)}.`)
    lines.push(`Староста — ${person()}.`)
    lines.push(pick(NOTE))
  } else {
    lines.push(`${p.name} — деревня у воды: ${pick(['низкие дома на сваях', 'рыбацкие избы и сушильни', 'мельница и длинные дворы', 'каменные дома над самым берегом'])}; живут ${pick(CROP)}.`)
    lines.push(`Старшина — ${person(chance(0.3))}.`)
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
const cap = byName('Кулагбрюг'), bon = byName('Бонгагард')
place('lore-kl-capital', 'Кулагбрюг', 'capital', sx(cap), null, '**Столица Колец.** Каменный мост на Первом Броде, Дом Колец и Хранилище Черепков; здесь семь Домов держат Совет и обмениваются наследниками.', st.id, [0, 0], 'Держатель Кулага Яспер Хеемстра')
place('lore-kl-ford', 'Брод Договора', 'landmark', sx(cap), 978.1, '**978.1.** Здесь семь лордов поклялись на железном кольце отдать наследников друг другу по кругу и перестали резать друг друга за переправы.')
place('lore-kl-hall', 'Дом Колец', 'landmark', sx(cap), 978.2, '**Дом Совета.** Длинный зал на мосту; семь кресел, семь колец под полом, и в центре стол, где кладут договорные черепки.', '', [-14, 10])
place('lore-kl-vault', 'Хранилище Черепков', 'landmark', sx(cap), 979.2, '**Склад голосов.** Тут хранят Чашу и черепки прошлых лет: имена, изгнанные в откол, и счёт каждого дня.', '', [14, -10])
if (bon) place('lore-kl-ring', 'Кольцо Бонгагарда', 'landmark', sx(bon), 978.1, '**Железное Кольцо Договора.** Хранится у Бонги, потому что Бонга держит Договор по букве; раз в год кольцо везут в Кулагбрюг.')

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Кулагон: описаний ${n}, мест ${world.places.filter((p) => p.id.startsWith('lore-kl-')).length}`)
