// Земли Севера на карте: земли великих кланов, родовые города, малые кланы и хёвдинги городков, бонды деревень,
// Тингвёлль у Каменного круга, Курганы конунгов, Скала закона, верфи драккаров, места битв и набеги ледунга.
// Придумано по поручению автора (06.11.2026) — «черновик». Детерминированно. Запуск после exiles-detail.mjs:
// node scripts/north-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { CLANS, NORTH_HEADS, NORTH_NAMES, NORTH_PEOPLE, NORTH_RAIDS, STATE } from './lore/north.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 13801978
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const landOf = (p) => admin.get(admin.get(p.areaId)?.parentId)?.name ?? ''
const clanOf = (p) => CLANS.find((c) => landOf(p).startsWith(c[3].split(' ')[0])) ?? CLANS[0]
const man = () => `${pick(NORTH_NAMES.men)} ${pick(NORTH_NAMES.bynames)}`
const smallClan = () => `${pick(NORTH_NAMES.men).replace(/[ьй]$/, '')}инги`
const CIRCLE = { x: 5543, y: 865 }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const sx = (p) => p.settlement ?? p

const LIVES = { sea: ['треска', 'сельдь', 'китовый жир', 'тюленьи шкуры', 'солёная рыба', 'ворвань'], land: ['ячмень', 'овцы', 'лес', 'торф', 'олени', 'мёд', 'шерсть', 'смола'], mine: ['железная руда', 'медь', 'уголь'] }
const TOWN_NOTE = [
  'Посреди городка стоит длинный дом хёвдинга, где зимой пирует вся дружина.',
  'У гавани сохнут на кольях драккары, а на берегу — сети.',
  'Местный тинг собирается у старого ясеня; споры там решают вергельдом или поединком.',
  'На резных столбах длинного дома — змеи и вороны; их подновляют краской каждую весну.',
  'Здесь до сих пор показывают обгорелую дверь дома откупщика, сожжённого в Ночь откупщиков 977 г.'
]
const VILLAGE_NOTE = [
  'Летом половина мужчин уходит на драккарах; осенью возвращаются не все.',
  'Хутора стоят далеко друг от друга, и бонды сходятся только на местный тинг.',
  'На холме за деревней — курган основателя рода; на нём жгут огонь в середине зимы.',
  'Дома здесь крыты дёрном: летом на крышах пасутся козы.',
  'Каждый двор по зову конунга ставит в ледунг одного воина со щитом и копьём.'
]

let n = 0
const seats = new Map(CLANS.map((c) => [c[4], c]))
const ting = provs.filter((p) => p.settlement).sort((a, b) => dist(a, CIRCLE) - dist(b, CIRCLE))[0]
// поле Альтинга: деревня у Каменного круга становится Тингвёллем — городком из тинговых землянок и длинных домов
const tingOld = ting.name === 'Тингвёлль' ? 'Фьялагард' : ting.name
ting.name = 'Тингвёлль'
ting.settlement.type = 'town'
for (const p of provs) {
  const t = p.settlement?.type ?? 'village'
  const clan = clanOf(p)
  const [, cname, nick, land] = clan
  const elder = (k) => NORTH_PEOPLE.find((x) => x[5] === k && /^Хёвдинг/.test(x[6]))
  const lines = []
  const seat = seats.get(p.name)
  if (seat) {
    const chief = seat[0] === 'gaup' ? 'конунг Круга Рагнар Красный Топор, а пока он в Тингвёлле — его брат Арн Кетильсон' : `хёвдинг ${elder(seat[0])?.[1] ?? man()}`
    lines.push(`${p.name} — родовой город клана ${cname}, «${nick}». ${seat[7].split('. ').slice(0, 2).join('. ')}.`)
    lines.push(`Городом правит ${chief}.`)
    if (p.name === 'Ётеланд') lines.push('Крупнейший город севера: сюда свозят меха, железо и лес, отсюда они уходят на юг. Здесь живёт Харальд Мировой, чьё имя не называют на Альтинге.')
    if (p.name === 'Фьялдален') lines.push('Отсюда в 976 г. началась Ночь откупщиков. На главной площади — длинный дом Гуннхильд Старой.')
    if (p.name === 'Сигравик') lines.push('Главная гавань ледунга: на верфях Сигравика строят драккары для всех кланов.')
    if (p.name === 'Ётфьорд') lines.push('Гавань Китов, откуда драккары уходят на восток к Креиту.')
    if (p.name === 'Сваребю') lines.push('Над городом — входы в Гарские копи; в нижних улицах живут гномы, в штольнях — дварфы.')
    if (p.name === 'Вагефелль') lines.push('Город медвежьих рубашек. Здесь в ладейном кургане лежит Ульф Волчий Зуб.')
    if (p.name === 'Бьёрехольм') lines.push('Пограничный город, трижды горевший от набегов изгнанников. Стены здесь новые, а люди злые.')
  } else if (p === ting) {
    lines.push(`Тингвёлль (прежде хутор ${tingOld}) — поле Альтинга у Каменного круга. Здесь в 138 г. конунг Хьяльмар вышел против Тейбера, и сюда каждую весну съезжаются все кланы севера: Седые садятся у своих камней, на центральном висит Щит Хьяльмара, на Скале закона говорит законоговоритель.`)
    lines.push('Все десять дней Альтинга здесь тингмир: кто прольёт кровь вне круга, тот вне закона.')
  } else if (t === 'city' || t === 'town' || t === 'port') {
    const life = pick(p.coastal ? LIVES.sea : landOf(p).startsWith('Гарск') ? LIVES.mine : LIVES.land)
    lines.push(`${p.name} — ${t === 'port' ? 'гавань' : t === 'city' ? 'большой город' : 'городок'} малого клана ${smallClan()} под рукой ${cname}. Живёт тем, что даёт север: ${life}, ${pick(LIVES.land)}.`)
    lines.push(`Хёвдинг — ${man()}.`)
    lines.push(pick(TOWN_NOTE))
  } else if (t === 'castle') {
    lines.push(`${p.name} — борг: деревянная крепость на скале, частокол и длинный дом дружины. Здесь держит своих людей ${pick(['хёвдинг', 'херсир'])} ${man()} из клана ${cname}.`)
    if (landOf(p).startsWith('Хрутланд')) lines.push('Когда-то на этих скалах стояли деревни белых орков, вырезанных дварфами в 95 г.; пастухи до сих пор находят их кости.')
    if (landOf(p).startsWith('Гарск')) lines.push('Под боргом — штольни Гарских копей, и стражу здесь держат вместе с дварфами.')
  } else if (t === 'ruins') {
    lines.push(`${p.name} — пепелище городка, сожжённого изгнанниками в их первом большом набеге 984 г. Клан ${cname} не отстраивает его: здесь хоронят павших в войнах со Ставкой.`)
  } else if (t === 'tower') {
    lines.push(`${p.name} — сигнальный костёр на скале. Когда с моря идут чужие драккары, огонь передаёт весть до Тингвёлля за одну ночь.`)
  } else {
    lines.push(`${p.name} — ${t === 'fishing' ? 'рыбацкий хутор' : 'хутора бондов'} клана ${cname}. Живут ${t === 'fishing' ? pick(LIVES.sea) : pick(LIVES.land)} и ${pick(LIVES.land)}.`)
    lines.push(`Старший бонд — ${man()}.`)
    if (chance(0.5)) lines.push(pick(VILLAGE_NOTE))
  }
  if (!seat) lines.push(`${land}: великий клан ${cname}.`)
  p.description = `${lines.join(' ')}\n\n_черновик_`
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10]) => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler: type === 'capital' ? 'Конунг Круга Рагнар Красный Топор' : '', image: '', description: `${description}\n\n_черновик_` }, history: [], from: from == null ? null : D(from), to: null })
}
const byName = (nm) => provs.find((p) => p.name === nm)
place('lore-no-ting', 'Тингвёлль', 'capital', sx(ting), 978.4, '**Поле Альтинга у Каменного круга.** Девять камней Седых, Щит Хьяльмара, Скала закона. Столицы у Круга нет: конунг правит из родового города своего клана, а кланы съезжаются сюда каждую весну.', st.id, [0, 0])
place('lore-no-circle', 'Каменный круг', 'landmark', CIRCLE, null, '**Девять камней и Щит Хьяльмара.** Здесь в 138 г. Тейбер вышел против конунга Хьяльмара, здесь с 978 г. бьются за власть над кланами.', '', [0, 0])
place('lore-no-law', 'Скала закона', 'landmark', sx(ting), 978.4, '**Где говорят закон.** Законоговоритель Эйвинд Памятливый каждую весну говорит отсюда треть неписаных законов севера.', '', [-16, 12])
const vag = byName('Вагефелль')
if (vag) place('lore-no-barrows', 'Курганы конунгов', 'landmark', sx(vag), 986.3, '**Ладейные курганы.** Торвальд Каменная Рука и Ульф Волчий Зуб лежат здесь в своих драккарах вместе с оружием.')
const sig = byName('Сигравик')
if (sig) place('lore-no-yards', 'Верфи ледунга', 'landmark', sx(sig), 979, '**Где строят драккары.** Каждый клан присылает сюда лес и людей; отсюда весной уходит ледунг.')
const sva = byName('Сваребю')
if (sva) place('lore-no-mines', 'Гарские копи', 'landmark', sx(sva), null, '**Железо севера.** Штольни Империи гор, где норды, дварфы и гномы добывают руду. Нижние шахты завалены, и ключ от них у Дурнира Старого.')
// Битва в метели — на пути Ледяного похода, у границы изгнанников
const exSt = world.states.find((s) => s.base.name === 'Имперские Изгнанники')
const exProvs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === exSt?.id)
const border = provs.filter((p) => p.settlement && p.neighbors?.some((q) => exProvs.some((e) => e.id === q)))
const snow = border.sort((a, b) => dist(a, vag ?? CIRCLE) - dist(b, vag ?? CIRCLE))[0]
if (snow) place('lore-no-blizzard', 'Битва в метели', 'battle', sx(snow), 993.4, '**993 г.** Ледунг Ульфа Волчьего Зуба громит Ледяной поход Ставки изгнанников в метель. Ульф ранен и умирает через девять дней.')

// набеги ледунга на карте: от ближайшей гавани кланов к ближайшим землям цели и обратно
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-no-'))
const ownerAtY = (p, y) => { let o = null; for (const [d, s] of p.owners ?? []) { if (d === null || d <= D(y)) o = s; else break } return o }
const nameOfState = new Map(world.states.map((s) => [s.id, s.base.name]))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
const harbours = provs.filter((p) => ['port', 'town', 'city'].includes(p.settlement?.type) && p.coastal)
let raids = 0
for (const [y, title, , target] of NORTH_RAIDS) {
  if (y === 977 || y === 993) continue
  const goals = world.provinces.filter((p) => p.settlement && nameOfState.get(ownerAtY(p, y)) === target && (target === 'Имперские Изгнанники' ? p.name === 'Улвик' : true))
  if (!goals.length) continue
  const from = harbours.reduce((a, b) => (Math.min(...goals.map((g) => dist(g, b))) < Math.min(...goals.map((g) => dist(g, a))) ? b : a))
  const goal = goals.reduce((a, b) => (dist(b, from) < dist(a, from) ? b : a))
  const deep = goals.filter((g) => g !== goal).sort((a, b) => dist(a, goal) - dist(b, goal))[1] ?? goal
  world.armies.push({ id: `lore-army-no-${y}`, name: `${title} (${y})`, mapId: 'world', stateId: st.id, color: '#3f6a7a', waypoints: [pt(from, y + 0.3), pt(goal, y + 0.42), pt(deep, y + 0.5), pt(from, y + 0.66)] })
  raids++
}
// Битва в метели: ледунг выходит из Вагефелля навстречу Ледяному походу
if (vag && snow) {
  world.armies.push({ id: 'lore-army-no-993', name: 'Ледунг Ульфа (993)', mapId: 'world', stateId: st.id, color: '#3f6a7a', waypoints: [pt(vag, 993.25), pt(snow, 993.4), pt(vag, 993.5)] })
  raids++
}

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Север: описаний поселений ${n}, Тингвёлль — бывший ${tingOld}, Битва в метели — ${snow?.name}, набегов на карте ${raids}, конунгов ${NORTH_HEADS.length}`)
