// Графство Мангениум на карте: города Манген, Ним, Нарни и Граднец вместо прежних городков, описание каждого поселения,
// столица и памятные места, закрытие застав в 978 г. Придумано по поручению автора (05.11.2026) — «черновик». Детерминированно.
// Запуск после styria-detail.mjs: node scripts/mangenium-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { MANGENIUM_CITIES, MANGENIUM_NAMES, STATE } from './lore/mangenium.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 9711024
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const person = () => `${pick(MANGENIUM_NAMES.men)} ${pick(MANGENIUM_NAMES.surnames)}`

// города автора стоят на месте прежних городков; округ, названный по городку, получает новое имя
for (const c of MANGENIUM_CITIES) {
  const p = world.provinces.find((x) => x.id === c.id)
  const area = world.adminRegions.find((a) => a.id === p.areaId)
  if (area?.name === `Округ ${c.old}`) area.name = `Округ ${c.name}`
  p.name = c.name
  p.settlement.type = 'city'
}

const CITY = {
  Манген: 'Манген — столица Графства Мангениум, старый город за двойной стеной у графского дворца. Тихий, опрятный и подчёркнуто имперский: те же вывески, чины и обращения, что были в Хауссере до войны. Правит граф Жан Наний Орнибуций, при нём заседает Совет Десяти. Стоит Мангенский собор, у которого Лавиния Орнибуция когда-то приняла первых беженцев.',
  Ним: 'Ним — второй город графства, тёплый и людный город на равнине. Именно сюда едет большинство беженцев: здесь стоит Дом принятых, а половина лавок принадлежит бывшим жителям Эшланда и столицы. На улицах можно услышать выговор всех бывших провинций Империи.',
  Нарни: 'Нарни — северная житница графства, город амбаров среди пшеничных равнин. Держит его младшая ветвь Орнибуций-Нарни, наместник Гектор. Запасов зерна здесь хватает, чтобы кормить всех принятых, и это предмет особой гордости.',
  Граднец: 'Граднец — горный город-крепость на востоке графства, сторожит перевалы к Империи. Здесь штаб Графской стражи, каменоломни и рудные дворы. Капитаном стражи служит младший сын графа Север.'
}
const KIND = {
  village: ['обычная имперская деревня с прямой улицей', 'опрятная деревня у тракта', 'деревня с каменной церковью', 'тихая деревня среди полей', 'деревня, отстроенная принятыми после войны'],
  fishing: ['рыбацкий посёлок с низкими домами', 'рыбацкая деревня у пристани'],
  town: ['аккуратный городок за стеной', 'торговый городок на тракте'],
  port: ['небольшой порт с графской таможней'],
  castle: ['замок старого кастеляна', 'сторожевой замок на тракте', 'горный замок с небольшим гарнизоном'],
  temple: ['храмовый городок с монастырём'],
  ruins: ['развалины старого замка']
}
const LIVES = { 1: ['пшеница', 'ячмень', 'лён', 'огороды', 'скот'], 2: ['дуб', 'лес на сплав', 'мёд', 'дичь', 'смола'], 3: ['овцы', 'виноград', 'сыр', 'ячмень'], 4: ['камень', 'железная руда', 'овцы', 'уголь'], 6: ['соль', 'овцы', 'финики', 'кожи'] }
const NOTES = ['Здесь осели беженцы из Эшланда: они построили новую улицу и всё ещё называют её по старому городу.', 'Отставной сержант Короны учит мальчишек строю по воскресеньям: говорит, что для порядка.', 'В старом амбаре за околицей ночует больше людей, чем значится в описи.', 'Дорогу здесь чинят вовремя: за этим следит министр дорог.', 'Староста раз в год ездит в Манген на День прошений и всякий раз возвращается довольным.', 'Прошлым летом приезжал ревизор из Хауссера. Его хорошо накормили и ничего особенного не показали.', 'Над дверью трактира всё ещё висит старый имперский герб, и никто его не снимает.', 'Сюда приехала вдова имперского чиновника и учит детей грамоте.']
const REEVE = { village: 'Старостой здесь', fishing: 'Старостой здесь', town: 'Городом заведует бургомистр', port: 'Портом заведует таможенный мастер', temple: 'Настоятелем здесь' }
let n = 0
for (const p of world.provinces.filter((x) => x.owners?.at(-1)?.[1] === st.id)) {
  const t = p.settlement?.type ?? 'village'
  if (CITY[p.name]) { p.description = `${CITY[p.name]}\n\n_черновик_`; n++; continue }
  const lives = LIVES[p.terrain] ?? LIVES[1]
  const lines = [`${p.name} — ${pick(KIND[t] ?? KIND.village)}.`]
  if (t === 'ruins') lines.push('Пустует со времён Лесной войны; местные растаскивают камень на постройки.')
  else {
    lines.push(`Живёт тем, что есть вокруг: ${pick(lives)}, ${pick(lives)}.`.replace(/: (.+), \1\./, ': $1.'))
    if (t === 'castle') lines.push(`Кастелян ${person()} служит графу, как его предки служили императорам.`)
    else lines.push(`${REEVE[t] ?? 'Старостой здесь'} ${t === 'temple' ? 'отец ' : ''}${person()}.`)
    if (chance(0.45)) lines.push(pick(NOTES))
  }
  p.description = `${lines.join(' ')}\n\n_черновик_`
  n++
}

const place = (id, name, type, atId, from, to, description, stateId = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  const p = world.provinces.find((x) => x.id === atId)
  const s = p.settlement ?? p
  const off = type === 'capital' ? [0, 0] : [14, 10]
  world.places.push({ id, mapId: 'world', x: Math.round(s.x) + off[0], y: Math.round(s.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler: type === 'capital' ? 'Граф Жан Наний Орнибуций' : '', image: '', description: `${description}\n\n_черновик_` }, history: [], from: from == null ? null : D(from), to: to ? D(to) : null })
}
const [mangen, nim, , gradnec] = MANGENIUM_CITIES.map((c) => c.id)
place('lore-man-capital', 'Манген', 'capital', mangen, null, null, '**Столица Графства Мангениум.** Графский дворец, Совет Десяти, Мангенский собор и старые ворота, ключ от которых носит наследник.', st.id)
place('lore-man-refuge', 'Дом принятых', 'landmark', nim, 976, null, '**Убежище верных Империи.** Сюда приезжают те, кому нельзя жить в Республике и не хочется жить при совете.')
place('lore-man-fort', 'Склады Граднеца', 'landmark', gradnec, 985, null, '**Горные склады Графской стражи.** На бумаге здесь хранится соль и овечья шерсть.')

// 978 г.: стража закрывает заставы на дорогах графства
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-man-'))
const pt = (id, y) => { const p = world.provinces.find((x) => x.id === id); const s = p.settlement ?? p; return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
world.armies.push({ id: 'lore-army-man-gates', name: 'Графская стража — маршал Аларих Штальберг', mapId: 'world', stateId: st.id, color: '#5a3a1a', waypoints: [pt(mangen, 977.95), pt(gradnec, 978.12)] })

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Мангениум: описаний поселений ${n}, городов ${MANGENIUM_CITIES.length}, мест 3`)
