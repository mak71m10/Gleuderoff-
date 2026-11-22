// Династия Креццака на карте: Фальергард — столица и Терем Матерей (поселения в провинции не было — ставится городок),
// описания хуторов ветвей, места (Терем, Лесная изба, сгоревшая церковь 977, Гервальдская пуща), поход 979.
// Запуск после magnolia-detail.mjs: node scripts/kreccaka-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { KC_NAMES, STATE } from './lore/kreccaka.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261123
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

// столица — Фальергард (поселения не было), Ройхаузен — хутор лесных стариков
for (const [id, type] of [[1891, 'town'], [1867, 'village']]) {
  const p = world.provinces.find((x) => x.id === id)
  if (p) p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type }
}

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const landOf = (p) => `${admin.get(p.areaId)?.name ?? ''}`
const BRANCH = { 'Ульенмюнде': 'Ульенской', 'Хейминдорф': 'Хейминской', 'Митрит': 'Митритской', 'Гервальд': 'Гервальдской', 'Фальергард': 'Фальерской', 'Ройхаузен': 'Ройской', 'Вальмюнде': 'Вальской' }
const NOTE = [
  'Над воротами хутора висит красная шерстяная нитка с узлом: «пока Пояс на князе».',
  'Самая старая женщина хутора сидит у печи на лучшем месте, и без её слова здесь не режут скот.',
  'Борти помечены знаками ветви, и за чужую борть платят воском вдвое.',
  'Угольные ямы дымят у опушки; уголь возят в Темерию, обратно везут соль и железо.',
  'На дальнем хуторе живут пришлые из Магнолии, с острыми ушами под шапками; их не спрашивают, откуда они.',
  'Девочки учатся ткать пояса раньше, чем читать: «Мать завяжет — Мать развяжет».'
]
let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const br = BRANCH[p.name] ?? 'одной из'
  const lines = []
  if (p.name === 'Фальергард') {
    lines.push('Фальергард — столица Креццаки: деревянный городок в пуще, срубы на каменных подклетах, высокие шатровые крыши с красной и охристой росписью. Над всеми стоит Терем Матерей — пять ярусов галерей, где Матери сидят по старшинству, а на самом верху за льняным покрывалом — Старшая Мать.')
    lines.push('Князь Мешко живёт в княжьем дворе у торга. Пепелище церкви, сгоревшей с книгами в 977 г., так и не застроено.')
  } else if (p.name === 'Гервальд') {
    lines.push('Гервальд — хутор у Гервальдской пущи, которую в 994 г. князь Болеслав продал Крайдону на сруб и за которую лишился Пояса. Здесь живут пришлые из Магнолии и Лаэс — полуэльфийка, по годам старше всех Матерей рода.')
  } else if (p.name === 'Ройхаузен') {
    lines.push('Ройхаузен — хутор лесных стариков: длинная медоварня, где Ярош Старый собирает бородатых и вспоминает, как род жил без Пояса.')
  } else {
    lines.push(`${p.name} — хутор ${br} ветви: срубы под шатровыми крышами, пасеки и угольные ямы. Хозяйка — ${pick(KC_NAMES.women)}, старшая Мать хутора.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${landOf(p)}; ${br} ветвь рода Креццака.`)
  p.description = lines.join(' ')
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
const cap = byName('Фальергард'), ger = byName('Гервальд'), roi = byName('Ройхаузен'), ul = byName('Ульенмюнде')
place('lore-kc-capital', 'Фальергард', 'capital', sx(cap), null, '**Столица Креццаки.** Терем Матерей и княжий двор.', st.id, [0, 0], 'Князь Мешко Креццака')
place('lore-kc-terem', 'Терем Матерей', 'landmark', sx(cap), 999.3, '**Пять ярусов.** Матери сидят по старшинству; наверху — покрывало Старшей Матери и Пояс.', '', [-16, -12])
place('lore-kc-church', 'Сгоревшая церковь', 'battle', sx(cap), 977.5, '**977.5.** Республика сожгла церковь вместе с книгами крещений: с тех пор годы Матерей помнят только они сами.', '', [16, 12])
if (ger) place('lore-kc-gerwald', 'Гервальдская пуща', 'landmark', sx(ger), 994.4, '**994.4.** Пуща, проданная Крайдону на сруб; за неё Болеслав лишился Пояса. Теперь здесь хутора пришлых.', '', [14, -10])
if (roi) place('lore-kc-hut', 'Лесная изба', 'landmark', sx(roi), 400, '**Изба Лесного года.** Здесь пришлая Мать должна прожить год одна, прежде чем повязать Пояс.', '', [14, 10])
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-kc-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (ul && cap) world.armies.push({ id: 'lore-army-kc-979', name: 'Лесной сход (979)', mapId: 'world', stateId: st.id, color: '#c8503a', waypoints: [pt(ul, 979.2), pt(ger ?? ul, 979.4), pt(cap, 979.5)] })

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Креццака: описаний ${n}`)
