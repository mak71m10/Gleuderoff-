// Креит на карте: этты по землям, гарды вместо городов (креитцы не живут в городах — только деревянные усадьбы
// за частоколом), рудничные борги Фросланда, Исехауг и Волчий дом, Дом Слушающих и Подгорный престол, места битв Жатвы,
// набеги эттов и Морских псов. Придумано по поручению автора (07.11.2026) — «черновик». Детерминированно.
// Запуск после north-detail.mjs: node scripts/kreit-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { ETTS, KREIT_EVENTS, KREIT_NAMES, KREIT_PEOPLE, STATE } from './lore/kreit.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 15004977
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const landOf = (p) => admin.get(admin.get(p.areaId)?.parentId)
// «Нордланд 2» — рабочее имя генератора; земля названа по своему главному гарду
for (const p of provs) { const l = landOf(p); if (l?.name === 'Нордланд 2') l.name = 'Эйдварская земля' }
const ettOf = (p) => ETTS.find((e) => e[2] === landOf(p)?.name) ?? ETTS.find((e) => e[0] === 'heid')
const man = () => `${pick(KREIT_NAMES.men)} ${pick(KREIT_NAMES.bynames)}`
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const sx = (p) => p.settlement ?? p
const byName = (nm) => provs.find((p) => p.name === nm)

const LIVES = { sea: ['треска', 'сельдь', 'соль', 'тюленьи шкуры', 'вяленая рыба', 'китовый жир'], land: ['ячмень', 'овцы', 'лес', 'смола', 'козы', 'шерсть', 'мёд', 'репа'], mine: ['серебряная руда', 'уголь для плавилен', 'крепёжный лес для штолен'] }
const GARD_NOTE = [
  'Над воротами частокола прибиты черепа коней и щиты врагов, взятых в последней Жатве.',
  'Длинный дом хёвдинга такой длины, что зимой в нём держат и дружину, и скот.',
  'Коньки крыш вырезаны драконьими головами: креитцы верят, что они отгоняют злых духов моря.',
  'Каждую весну гард пустеет: мужчины уходят на драккарах и возвращаются к осени — с полоном или не возвращаются.',
  'У ворот — столб жильного долга: к нему привязывают тех, кого завтра поведут в рудники.',
  'Кузни здесь работают день и ночь: креитский топор ценится от Аргуса до Фарвольской лиги.'
]
const VILLAGE_NOTE = [
  'Хутор обнесён частоколом: в Креите не спят без стены, даже в мирный год.',
  'Половина дворов пустует: в Жатву 1004 г. этт отдал жиле десятую часть людей, и они не вернулись.',
  'На холме — курган с ладьёй основателя хутора; на нём жгут огонь в середине зимы.',
  'Старший бонд держит долговую книгу из зарубок: кто не отдаст долг до зимы, пойдёт в жилу.',
  'Мальчики хутора с десяти лет ходят с отцами в набеги — сначала гребцами.'
]
const RUIN_NOTE = {
  'Скогавик': 'гард, сожжённый Торбрандом в первую ночь Жатвы 983 г. вместе с длинным домом Халльварда',
  'Хрутхольм': 'гард, вырезанный в Жатву 1004 г., когда Фростэтт мстил за Хальфдана',
  'Бруедален': 'гард, сожжённый Морскими псами Севера в ледунг 997 г.'
}

let n = 0
const seats = new Map(ETTS.map((e) => [e[3], e]))
const capital = byName('Исехауг')
const heart = byName('Гримстад')
const listeners = byName('Кьярдален')
// креитцы не живут в городах: всё, что генератор назвал городом, — большой гард
for (const p of provs) if (p.settlement?.type === 'city') p.settlement.type = 'town'

for (const p of provs) {
  const t = p.settlement?.type ?? 'village'
  const [key, ename, land] = ettOf(p)
  const chief = KREIT_PEOPLE.find((x) => x[5] === key && /^Хёвдинг/.test(x[6]))
  const mine = land === 'Фросланд'
  const lines = []
  const seat = seats.get(p.name)
  if (p === capital) {
    lines.push('Исехауг — серебряный двор ярла над Жилами и родовой гард Мальмгримов. Не город, а огромный гард: три кольца частокола на склоне горы, длинный дом ярла с драконьими коньками, Волчий дом, где растут дети ярла, серебряная казна в скале и плавильни, дым которых видно за день пути.')
    lines.push('Здесь правит ярл Ингеборг Без Братьев, а когда она в походе — её мать Гюрид, у которой ключи от казны. Ворота стережёт Серебряный хирд.')
  } else if (p === heart) {
    lines.push('Гримстад — рудничный борг над Сердцем Жилы, самой глубокой и богатой серебряной штольней Креита. Под ним в три смены работают тысячи трэлей: должники, полон соседей и «отданные жиле» дети ярлов.')
    lines.push('Надзирает Фростэтт; хозяин Тихой штольни — Слушающий Кольгрим Рудный Глаз. Старшина трэлей — седой Рагнвальд, сын Гримкеля, отданный жиле в 985 г.')
  } else if (p === listeners) {
    lines.push('Кьярдален — Дом Слушающих: деревянный хоф, поставленный на древних руинах, которые старше Креита и старше людей. Внизу, в скале, — Подгорный престол, где новый ярл пьёт серебряную воду, и серебряная стена, на которой вырезаны имена всех наречённых детей ярлов.')
    lines.push('Здесь живёт Вигдис Глухая Мать; говорит за неё Ормар Серебряный Язык.')
  } else if (seat) {
    lines.push(`${p.name} — родовой гард этта ${ename}. ${seat[6].split('. ').slice(0, 2).join('. ')}.`)
    lines.push(`Гардом правит ${chief ? `хёвдинг ${chief[1]}` : `хёвдинг ${man()}`}.`)
    if (p.name === 'Эйдвар') lines.push('В 984 г. под его частоколом Эйдэтт и Гунэтт бились всеми дружинами в Битве у Эйдвара.')
    if (p.name === 'Гунахольм') lines.push('Через эту гавань купцы Хейдэтта тайно продают серебро и трэлей в Корону Аргус. Здесь же собирается Солёный тинг юга.')
    if (p.name === 'Эйдфелль') lines.push('Гавань Морских псов: на берегу сохнут двенадцать драккаров Аслака.')
    if (p.name === 'Хрутнес') lines.push('Пограничный гард у перевалов на Гарефорд; отсюда в 988 г. Скарди повёл этты на юг.')
  } else if (t === 'town' || t === 'port') {
    const life = pick(p.coastal ? LIVES.sea : mine ? LIVES.mine : LIVES.land)
    lines.push(`${p.name} — ${t === 'port' ? 'гард с драккарной гаванью' : 'большой гард'} этта ${ename}: частокол, длинный дом хёвдинга, кузни и хлева. Живёт ${life} и ${pick(LIVES.land)}${p.coastal ? ', а летом — набегами' : ''}.`)
    lines.push(`Хёвдинг — ${man()}.`)
    lines.push(pick(GARD_NOTE))
  } else if (t === 'castle') {
    if (mine) {
      lines.push(`${p.name} — рудничный борг: частокол на скале над входом в серебряную штольню, бараки трэлей и плавильня. Надзирает ${pick(['херсир', 'надсмотрщик'])} ${man()} из Фростэтта.`)
      if (chance(0.5)) lines.push('Трэли здесь носят ошейники с меткой своей штольни; бежавшего ищут собаками и отдают Тихой штольне.')
    } else {
      lines.push(`${p.name} — борг: деревянная крепость на скале, частокол и длинный дом дружины. Здесь держит своих людей херсир ${man()} из этта ${ename}.`)
      if (key === 'fjal') lines.push('С вышки видно перевалы на Гарефорд и Фарвольскую лигу; по сигнальному огню борги Фьялэтта за ночь поднимают всю землю.')
    }
  } else if (t === 'ruins') {
    lines.push(`${p.name} — пепелище: ${RUIN_NOTE[p.name] ?? 'гард, сожжённый в одну из Жатв'}. Его не отстраивают: на пепелище Жатвы не строят.`)
  } else if (t === 'temple') {
    lines.push(`${p.name} — хоф предков: деревянное святилище с резными столбами, где Слушающие принимают жертвы за жилу и за удачный набег.`)
  } else if (t === 'tower') {
    lines.push(`${p.name} — сигнальная вышка на скале. Когда с моря идут чужие драккары, огонь передаёт весть до Исехауга за одну ночь.`)
  } else {
    lines.push(`${p.name} — ${t === 'fishing' ? 'рыбацкий хутор' : 'хутора бондов'} этта ${ename}. Живут ${t === 'fishing' ? pick(LIVES.sea) : mine ? pick(LIVES.mine) : pick(LIVES.land)} и ${pick(LIVES.land)}.`)
    lines.push(`Старший бонд — ${man()}.`)
    if (chance(0.55)) lines.push(pick(VILLAGE_NOTE))
  }
  if (!seat && p !== capital && p !== heart && p !== listeners) lines.push(`${land}: этт ${ename}.`)
  p.description = `${lines.join(' ')}\n\n_черновик_`
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10]) => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler: type === 'capital' ? 'Ярл над Жилами Ингеборг Без Братьев' : '', image: '', description: `${description}\n\n_черновик_` }, history: [], from: from == null ? null : D(from), to: null })
}
place('lore-kr-capital', 'Исехауг', 'capital', sx(capital), null, '**Серебряный двор ярла над Жилами.** Гард в три кольца частокола, длинный дом Мальмгримов, Волчий дом, серебряная казна и плавильни.', st.id, [0, 0])
place('lore-kr-wolfhouse', 'Волчий дом', 'landmark', sx(capital), null, '**Где растёт выводок.** Наречённые дети ярла живут здесь вместе с семи лет: один котёл, одни учителя, и никто не поворачивается к брату спиной.', '', [-16, 12])
if (heart) place('lore-kr-heart', 'Сердце Жилы', 'landmark', sx(heart), null, '**Самая богатая серебряная штольня континента.** Тысячи трэлей в три смены; ниже всех — Тихая штольня, откуда не возвращаются.')
if (listeners) {
  place('lore-kr-listeners', 'Дом Слушающих', 'landmark', sx(listeners), null, '**Хоф шаманов жилы над древними руинами.** Здесь нарекают детей ярла и вырезают их имена на серебряной стене.', '', [14, -10])
  place('lore-kr-throne', 'Подгорный престол', 'ruins', sx(listeners), null, '**Руины Древних под Кьярдаленом.** Каменный престол в скале, где выживший в Жатве пьёт серебряную воду из рук Глухой Матери. Здесь же бились Скарди и Тора (986), Ингеборг и Рагнхильд (1007).', '', [-14, 12])
}
const eid = byName('Эйдвар')
if (eid) place('lore-kr-eidvar', 'Битва у Эйдвара', 'battle', sx(eid), 984.4, '**984 г., первая Жатва.** Эйдэтт и Гунэтт сходятся всеми дружинами; Кнут гибнет, Торбранд берёт Эйдвар.', '', [-14, -12])
const gnh = byName('Гунахольм')
if (gnh) place('lore-kr-salt', 'Солёный тинг', 'landmark', sx(gnh), null, '**Тинг южных фьордов.** Здесь Тора убила Ингольфа (984), а Ульв — Халлстейна (1005): во время Жатвы тингмир не действует.', '', [14, -12])
// Ледяной перевал — граница Фросланда с Фарвольской лигой, ближе всего к Исехаугу
const farvol = world.states.find((s) => s.base.name === 'Фарвольская лига')
const farProvs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === farvol?.id)
const farIds = new Set(farProvs.map((p) => p.id))
const passes = provs.filter((p) => p.settlement && landOf(p)?.name === 'Фросланд' && p.neighbors?.some((q) => farIds.has(q)))
const pass = passes.sort((a, b) => dist(a, capital) - dist(b, capital))[0]
if (pass) place('lore-kr-icepass', 'Битва на Ледяном перевале', 'battle', sx(pass), 1006.6, '**1006 г., вторая Жатва.** Ингеборг громит Ульва и Тормода. Тормод гибнет, Ульв с сорока людьми уходит через перевал в Фарвольскую лигу.')

// набеги и войны Жатвы на карте
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-kr-'))
const ownerAtY = (p, y) => { let o = null; for (const [d, s] of p.owners ?? []) { if (d === null || d <= D(y)) o = s; else break } return o }
const nameOfState = new Map(world.states.map((s) => [s.id, s.base.name]))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
const harbours = provs.filter((p) => ['port', 'town'].includes(p.settlement?.type) && p.coastal)
const gards = provs.filter((p) => ['town', 'castle', 'port'].includes(p.settlement?.type))
let raids = 0
const COLOR = '#8a8f9a'
for (const [y, title, , target, , type] of KREIT_EVENTS) {
  if (!['Набег', 'Война'].includes(type) || target === 'Креит') continue
  const goals = world.provinces.filter((p) => p.settlement && nameOfState.get(ownerAtY(p, y)) === target)
  if (!goals.length) continue
  const sea = target === 'Объединённые Берега Гренинсворда'
  const pool = sea ? harbours : gards
  const from = pool.reduce((a, b) => (Math.min(...goals.map((g) => dist(g, b))) < Math.min(...goals.map((g) => dist(g, a))) ? b : a))
  const goal = goals.reduce((a, b) => (dist(b, from) < dist(a, from) ? b : a))
  const deep = goals.filter((g) => g !== goal).sort((a, b) => dist(a, goal) - dist(b, goal))[1] ?? goal
  world.armies.push({ id: `lore-army-kr-${String(y).replace('.', '-')}`, name: `${title} (${Math.floor(y)})`, mapId: 'world', stateId: st.id, color: COLOR, waypoints: [pt(from, y - 0.1), pt(goal, y + 0.02), pt(deep, y + 0.1), pt(from, y + 0.26)] })
  raids++
}
// войны Жатвы: Торбранд идёт из Гунехауга на Эйдвар (984), Ингеборг — из Исехауга на Ледяной перевал (1006)
const gune = byName('Гунехауг')
if (gune && eid) { world.armies.push({ id: 'lore-army-kr-984', name: 'Дружина Торбранда (984)', mapId: 'world', stateId: st.id, color: '#5a1a1a', waypoints: [pt(gune, 984.25), pt(eid, 984.4), pt(gune, 984.6)] }); raids++ }
if (capital && pass) {
  world.armies.push({ id: 'lore-army-kr-1006', name: 'Дружина Ингеборг (1006)', mapId: 'world', stateId: st.id, color: '#5a1a1a', waypoints: [pt(capital, 1006.45), pt(pass, 1006.6), pt(capital, 1006.8)] })
  const exile = farProvs.filter((p) => p.settlement).sort((a, b) => dist(a, pass) - dist(b, pass))[1]
  if (exile) world.armies.push({ id: 'lore-army-kr-ulv', name: 'Ульв Беглый уходит (1006)', mapId: 'world', stateId: st.id, color: '#2a4a2a', waypoints: [pt(byName('Эйдвар') ?? pass, 1006.4), pt(pass, 1006.6), pt(exile, 1006.7)] })
  raids += 2
}

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Креит: описаний поселений ${n}, гардов вместо городов — все, Ледяной перевал — ${pass?.name}, походов на карте ${raids}`)
