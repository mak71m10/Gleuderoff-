// Святая церковь на карте: описание каждого поселения архипелага и материковых архиепархий — кто правит (в городе
// епископ-пастырь и совет святых людей, в деревне кюре-старейшина), чей бог здесь в чести, чем живут, что хранят.
// Придумано по поручению автора (02.11.2026) — «черновик». Детерминированно.
// Запуск после republic-detail.mjs и south-detail.mjs: node scripts/church-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { CHURCH_FACTIONS, CHURCH_NAMES, CONTINENT_ARCHBISHOPS } from './lore/church.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
let seed = 1601601
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const person = () => `${pick(CHURCH_NAMES.men)} ${pick(CHURCH_NAMES.surnames)}`
const GOD = { oramey: 'Орамея', bodhi: 'Бодхисаттвы', komosar: 'Комосара', magnus: 'Магнуса', argentu: 'Аргенту', amaterasu: 'Аматерасу', yunona: 'Юноны' }
const GODS = Object.keys(GOD)

const STATES = ['Святая церковь', ...CONTINENT_ARCHBISHOPS.map((a) => a[3])]
const byName = new Map(world.states.map((s) => [s.base.name, s]))
const ids = new Map(STATES.map((n) => [byName.get(n)?.id, n]))
const KIND = {
  village: ['деревня с белой часовней на холме', 'деревня виноградарей у обители', 'рыбачья деревня под колокольней', 'деревня паломников у источника'],
  fishing: ['рыбачий посёлок с часовней на молу', 'посёлок рыбаков у бухты'],
  town: ['соборный город', 'город паломников с крытыми галереями', 'город обителей и школ'],
  port: ['гавань паломников', 'портовый город Звёздной стражи'],
  city: ['великий город храмов'],
  castle: ['замок Святого ордена', 'крепость ордена над бухтой'],
  temple: ['храмовый город'],
  ruins: ['развалины старой обители']
}
const LIVES = ['вино для причастия', 'оливковое масло', 'воск и свечи', 'рыба', 'паломники', 'переписка книг', 'пчёлы и мёд', 'ладан из привозной смолы', 'шерсть', 'соль']
const SIGHT = [
  'В часовне хранят мощи святого, к которым идут паломники.', 'У ворот — каменный столб, у которого в 979 г. читали приговоры.', 'Колокол отлит из пушки, взятой Святым орденом.',
  'В обители переписывают Садру для деревенских храмов.', 'Над городом — статуя Орамея с поднятым мечом.', 'Здесь госпиталь Ордена Чаши — лечат бесплатно, но записывают всё.',
  'Рыбаки благословляют сети в день Аргенту.', 'Здесь спорят, чей бог главнее, — до драк на праздниках.'
]
let n = 0
for (const p of world.provinces) {
  const st = ids.get(p.owners?.at(-1)?.[1])
  if (!st) continue
  const t = p.settlement?.type ?? 'village'
  const continent = st !== 'Святая церковь'
  const god = pick(GODS)
  const lines = [`${p.name} — ${pick(KIND[t] ?? KIND.village)}. Живёт тем, что даёт земля и вера: ${pick(LIVES)}, ${pick(LIVES)}.`]
  if (['town', 'city', 'port', 'temple'].includes(t))
    lines.push(`Правит епископ-пастырь ${person()} вместе с советом святых людей: каноники собора, приор, командор ордена и старшины гильдий.`)
  else if (t === 'castle') lines.push(`Командор Святого ордена ${person()} держит замок и окрестные деревни.`)
  else lines.push(`Старейшина — кюре ${person()}: священник, судья и сборщик десятины в одном лице.`)
  lines.push(`Здесь в чести ${GOD[god]}${chance(0.3) ? `, и его сподвижники тянут одеяло на своего бога даже в проповедях` : ''}.`)
  lines.push(pick(SIGHT))
  if (continent) lines.push(chance(0.5) ? 'В 979 г. Святой орден выгнал отсюда революционеров; на площади до сих пор чёрное пятно от костров.' : 'До 978 г. — земля Республики; с 979 г. — под рукой Сантареи.')
  const old = p.description ?? ''
  const i = old.indexOf('**Освобождение')
  p.description = `${lines.join(' ')}${continent && i >= 0 ? `\n\n${old.slice(i)}` : ''}\n\n_черновик_`
  n++
}
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Святая церковь: описаний поселений ${n}`)
