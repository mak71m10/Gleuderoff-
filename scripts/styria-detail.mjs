// Графство Штирия на карте: описание каждого поселения (нищета, Ночная подать, мытари, кастеляны, закрытые часовни),
// столица Корбрук, Верхний скит, Ночная ярмарка, Ночь Лаухайма, роты на перевалах 978 г.
// Придумано по поручению автора (03.11.2026) — «черновик». Детерминированно.
// Запуск после church-detail.mjs: node scripts/styria-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE, STYRIA_NAMES } from './lore/styria.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 9601010
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const person = () => `${pick(STYRIA_NAMES.men)} ${pick(STYRIA_NAMES.surnames)}`
const noble = () => `${pick(STYRIA_NAMES.men)} фон ${pick(STYRIA_NAMES.noble)}`

const KIND = {
  village: ['серая деревня под скалой', 'деревня с заколоченными окнами', 'нищая горная деревня', 'деревня рудокопов-должников', 'деревня лесорубов на камнях'],
  town: ['тесный городок за облезлой стеной', 'городок, где ставни закрывают до заката', 'городок при рудниках'],
  city: ['чёрный город под замком'],
  castle: ['дырявый замок мелкого кастеляна', 'замок над нищей деревней', 'сторожевой замок у перевала'],
  temple: ['опустевший храмовый городок'],
  ruins: ['развалины']
}
const LIVES = ['камень', 'рудная мелочь', 'уголь', 'лес на сплав', 'козий сыр', 'овечья шерсть', 'ячмень с каменистых полей']
const DARK = ['В подвале тайно сушат травы для Мастера Реторты.', 'Осенью здесь проходит обоз в Верхний скит, и окна закрывают сами.', 'На пороге одного из домов недавно видели синюю свечу.', 'Половину семей уже увели за долги.', 'Здесь никто не спрашивает, куда делся сосед.', 'По дороге ночью идут телеги без фонарей.', 'Дети здесь знают слово «вексель» раньше, чем слово «хлеб».', 'Старая виселица у дороги работает исправно.']
let n = 0
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
for (const p of provs) {
  const t = p.settlement?.type ?? 'village'
  const capital = p.name === 'Корбрук'
  const lines = [capital ? 'Корбрук — столица Графства Штирия, чёрный город под замком. Живёт Ночным рынком, Вексельным домом и страхом.' : `${p.name} — ${pick(KIND[t] ?? KIND.village)}. Живёт тем, что даёт камень: ${pick(LIVES)}, ${pick(LIVES)}.`]
  if (t === 'castle') lines.push(`Кастелян ${noble()} собирает подать с округи и сам должен Вексельному дому${chance(0.5) ? ' вдвое больше, чем стоит его замок' : ''}.`)
  else if (['town', 'city'].includes(t)) lines.push(capital ? 'Правит граф Конрад из Чёрного замка; заседает Ночной совет, в Немом конце стоит Немая палата.' : `Городом заведует староста-должник ${person()}, а настоящий хозяин — контора Вексельного дома.`)
  else if (t === 'temple') lines.push('Храм полупуст: приход платит десятину Вексельному дому, а кюре присылают раз в год.')
  else lines.push(`Ночную подать собирает мытарь ${person()}.`)
  if (['town', 'city'].includes(t) && !capital) lines.push('На рынке днём торгуют репой, ночью — всем остальным.')
  // самое малое число церквей в Империи: заколоченная часовня там, где она ещё осталась
  if (t === 'temple' || capital) lines.push(capital ? 'Единственный собор края пустует, служит в нём епископ на жалованье.' : '')
  else if (chance(0.12)) lines.push('Часовня Дома Света заколочена; служат в ней только по грамоте, для галочки.')
  lines.push(capital ? 'Здесь же ночной ряд Ночного рынка: при свечах и в масках.' : pick(DARK))
  p.description = `${lines.filter(Boolean).join(' ')}\n\n_черновик_`
  n++
}

const place = (id, name, type, at, from, to, description, stateId = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  const p = world.provinces.find((x) => x.name === at)
  const s = p.settlement ?? p
  const off = type === 'capital' ? [0, 0] : [14, 10]
  world.places.push({ id, mapId: 'world', x: Math.round(s.x) + off[0], y: Math.round(s.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler: type === 'capital' ? 'Граф Конрад Штирийский' : '', image: '', description: `${description}\n\n_черновик_` }, history: [], from: from == null ? null : D(from), to: to ? D(to) : null })
}
place('lore-sty-capital', 'Корбрук', 'capital', 'Корбрук', null, null, '**Столица Графства Штирия.** Чёрный замок на скале; под ним Немой конец, контора Вексельного дома и ночной ряд рынка.', st.id)
place('lore-sty-skete', 'Верхний скит', 'landmark', 'Висберг', 203.6, null, '**Тайное место рода.** Скит над Висбергом, куда главы рода поднимаются с 203 г. Крестьяне обходят эту тропу.')
place('lore-sty-fair', 'Ночная ярмарка Брасрита', 'landmark', 'Брасрит', 702, null, '**Ярмарка Ночного рынка.** Раз в год, в безлунную неделю Драгоса, сюда съезжаются покупатели со всей Лоры — в масках и без имён.')
place('lore-sty-lauheim', 'Ночь Лаухайма', 'battle', 'Лаухайм', 512, null, '**Резня на свадьбе, 512 г.** Матильда Ключница заперла двери, и последние старые дома Штайнгарда кончились за одну ночь.')
place('lore-sty-tower', 'Башня Корбрука', 'gallows', 'Корбрук', 966.2, null, '**966 г.** Шестнадцатилетний граф Конрад приказал замуровать здесь мать-регента Гизелу.')

// отделение 978 г.: вольные роты занимают перевалы
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-sty-'))
const pt = (name, y) => { const p = world.provinces.find((x) => x.name === name); const s = p.settlement ?? p; return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
world.armies.push(
  { id: 'lore-army-sty-pass-1', name: 'Вольные роты — капитан-генерал Рогнар Дитц', mapId: 'world', stateId: st.id, color: '#2a1a2a', waypoints: [pt('Корбрук', 978.02), pt('Брукхольм', 978.08), pt('Эшведель', 978.16), pt('Оберинлаге', 978.28)] },
  { id: 'lore-army-sty-pass-2', name: 'Вольные роты — западные перевалы', mapId: 'world', stateId: st.id, color: '#2a1a2a', waypoints: [pt('Корбрук', 978.04), pt('Веренберг', 978.12), pt('Брасхольм', 978.22), pt('Эрштейн', 978.3)] }
)

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Штирия: описаний поселений ${n}, мест 5, рот на перевалах 2`)
