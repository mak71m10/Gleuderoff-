// Наполняет нынешнюю Империю: описание каждого поселения, низшая знать округов, великие дома регионов,
// родовые гнёзда домов, кастры легионов, Аурхафен — величайший порт Империи, места жизни Тейбера.
// Всё придумано по поручению автора (31.10.2026). Детерминированно: повторный запуск даёт тот же текст.
// Запуск после history-provinces.mjs и terrain.mjs: node scripts/empire-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import { HOUSES } from './lore/empire.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const Y = (y) => (y > 0 ? y - 1 : y) * YEAR
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const stateById = new Map(world.states.map((s) => [s.id, s]))
const empire = world.states.find((s) => s.base.name === 'Империя')
const houseById = new Map(HOUSES.map((h) => [`lore-${h.id}`, h]))
const haussler = world.places.find((p) => p.id === 'lore-haussler')
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

let s = 31101010
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const pickN = (a, n) => {
  const c = [...a]
  const out = []
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0])
  return out
}
const chance = (p) => rnd() < p

const provs = world.provinces.filter((p) => p.state === empire.id)
const regionOf = (p) => admin.get(admin.get(p.areaId)?.parentId)
const areaOf = (p) => admin.get(p.areaId)
// история: чьей была провинция до Дагерфорда, на чьей стороне в 975 г.
const firstOwner = (p) => stateById.get(p.owners[0]?.[1])
const joined = (p) => {
  const o = p.owners.find(([d, id]) => d !== null && id === empire.id)
  return o ? Math.floor(o[0] / YEAR) + 1 : null
}
const wasPact = (p) => p.owners.some(([, id]) => id === 'hist-pact')

// ---------- имена ----------
const MEN = ['Альбрехт', 'Ансельм', 'Арнольд', 'Бертольд', 'Вальтер', 'Вендель', 'Вильгельм', 'Гартвиг', 'Гельмут', 'Генрих', 'Герхард', 'Готфрид', 'Дитрих', 'Иоахим', 'Карл', 'Клаус', 'Конрад', 'Курт', 'Леберехт', 'Леопольд', 'Лотар', 'Людвиг', 'Маттиас', 'Николаус', 'Отто', 'Рейнхард', 'Рихард', 'Рупрехт', 'Себальд', 'Тибальт', 'Ульрих', 'Фолькер', 'Фридрих', 'Хайнц', 'Ханс', 'Эберхард', 'Эгон', 'Эккехард', 'Эрвин', 'Юрген']
const WOMEN = ['Агата', 'Адельхайд', 'Аделина', 'Берта', 'Вальбурга', 'Гертруда', 'Гизела', 'Грета', 'Иоханна', 'Ирмгард', 'Катарина', 'Кунигунда', 'Лизелотта', 'Луиза', 'Магдалена', 'Марта', 'Матильда', 'Ода', 'Регина', 'Софья', 'Урсула', 'Фрида', 'Хедвиг', 'Хильда', 'Эльза', 'Эмма']
const SURN_A = ['Ад', 'Альт', 'Бау', 'Бер', 'Бирк', 'Брук', 'Вайс', 'Вальд', 'Вен', 'Гольд', 'Грюн', 'Дорн', 'Зее', 'Кальт', 'Кирх', 'Лин', 'Мар', 'Мит', 'Мюл', 'Нойер', 'Обер', 'Рот', 'Ройт', 'Ротен', 'Тан', 'Хаген', 'Хайль', 'Хоф', 'Шварц', 'Штайн', 'Штиль', 'Эйх', 'Эрлен']
const SURN_B = ['ман', 'ер', 'ке', 'ниц', 'бах', 'хайм', 'гер', 'дорф', 'ле', 'брандт', 'штедт', 'ау', 'мер', 'вирт']
const surname = () => pick(SURN_A) + pick(SURN_B)
const person = (female = chance(0.25)) => `${pick(female ? WOMEN : MEN)} ${surname()}`
const WEEKDAYS = ['Персу', 'Дуэну', 'Трессу', 'Кварту', 'Квинну']
const MONTHS = ['Ячори', 'Фраул', 'Алпрас', 'Лаций', 'Драгос']

// ---------- промыслы ----------
const ECON = {
  1: ['пшеница', 'рожь', 'ячмень', 'лён', 'репа и капуста', 'пасеки', 'мельницы на ручьях', 'овечья шерсть', 'хмель', 'гуси и утки', 'сыроварни', 'свиньи на жёлудях'],
  2: ['строевой лес', 'дёготь и смола', 'древесный уголь', 'охота на кабана и оленя', 'бортничество', 'лыко и плетёные короба', 'грибы и ягоды для столичных рынков', 'корабельные мачты'],
  3: ['виноградники', 'овцы', 'каменоломни', 'железная руда', 'козий сыр', 'известь и обожжённый кирпич', 'медные жилы', 'сады на террасах'],
  4: ['серебряный рудник', 'железные копи', 'горные пастбища', 'сланец и точильный камень', 'медь и олово', 'ледники, где режут лёд для столицы'],
  5: ['горные пастбища', 'меха и шкуры', 'ледники'],
  6: ['соль', 'финики', 'верблюды']
}
const COAST = ['сельдь и треска', 'соль из выпарных прудов', 'устричные отмели', 'канатные мастерские', 'вяленая рыба для легионов', 'малые верфи для баркасов', 'ловля угрей в устье']
const HOUSE_TRADE = {
  essenwald: 'подати идут прямо в столичную казну Эссенвальдов',
  rheinhold: 'каждый второй двор отдаёт сына в легионы, как велит обычай Райнхольдов',
  morving: 'лес и пенька отсюда уходят на верфи Морвингов',
  grauenstein: 'руда и уголь идут на литейные Грауэнштайнов',
  littenau: 'зерно свозят в житницы Литтенау',
  falkenhorst: 'на лугах пасутся табуны Фалькенхорстов',
  tessen: 'лесничие Тессенов строго считают каждое срубленное дерево',
  saltmar: 'соль и товары юга везут на склады Зальтмаров',
  hoeldern: 'при церкви — школа, которую содержат Хёльдерны',
  brandt: 'в трактире висит портрет Огненного Дракона — Брандты требуют этого от каждого арендатора',
  osterveld: 'вино отправляют в погреба Остервельдов',
  kronau: 'десятину собирает монастырь Дома Кронау'
}

// ---------- описания ----------
const TYPE_OPEN = {
  village: [(n, k) => `${n} — деревня в ${k} дворов`, (n, k) => `${n} — село на ${k} дворов`, (n) => `${n} — тихая деревня`, (n) => `${n} — деревня при большой дороге`, (n, k) => `${n} — деревня, где ${k} дворов и одна колокольня`],
  fishing: [(n, k) => `${n} — рыбацкая деревня в ${k} дворов`, (n) => `${n} — рыбацкий посёлок у самой воды`, (n) => `${n} — деревня рыбаков и лодочников`],
  town: [(n) => `${n} — торговый городок`, (n) => `${n} — окружной городок с ратушей и рынком`, (n) => `${n} — небольшой город за старой стеной`, (n) => `${n} — ремесленный городок`],
  city: [(n) => `${n} — один из больших городов Империи`, (n) => `${n} — главный город своего края`, (n) => `${n} — старый город за двойной стеной`],
  capital: [(n) => `${n} — столица`],
  castle: [(n) => `${n} — крепость`, (n) => `${n} — каменный замок над дорогой`, (n) => `${n} — замок с деревней у подножия`, (n) => `${n} — сторожевая крепость`],
  port: [(n) => `${n} — портовый город`, (n) => `${n} — гавань и торговый город`, (n) => `${n} — порт, куда заходят каботажные суда`],
  temple: [(n) => `${n} — храмовое село вокруг монастыря Орамея`, (n) => `${n} — обитель Дома Света с паломнической гостиницей`, (n) => `${n} — святилище на холме`],
  tower: [(n) => `${n} — одинокая башня`, (n) => `${n} — сигнальная башня имперской почты`, (n) => `${n} — старая башня мага`],
  ruins: [(n) => `${n} — руины`, (n) => `${n} — развалины`]
}
const GOV = {
  village: () => pick([`Старейшина — ${person()}`, `Деревней правит старейшина ${person()} и сход стариков`, `Земский сход собирается в доме старосты ${person()}`, `Староста — ${person()}, избранный сходом`]),
  fishing: () => pick([`Старейшина — ${person(false)}, старый шкипер`, `Делами правит артель лодочников во главе с ${person(false)}`]),
  town: () => pick([`Губернатор — ${person()}`, `Городом управляет губернатор ${person()} и земское собрание`, `Правит назначенный губернатор ${person()}; ратуша спорит с ним по каждому налогу`]),
  city: () => pick([`Губернатор — ${person()}`, `Губернатор ${person()} держит город при поддержке гильдий`, `Городом правит губернатор ${person()}, магистрат — от гильдий`]),
  castle: () => pick([`Кастелян — ${person(false)}`, `Комендант — ${person(false)}, отставной капитан`, `Замок держит кастелян ${person(false)} с полусотней стражи`]),
  port: () => pick([`Губернатор — ${person()}; гаванью ведает портовый мастер ${person(false)}`, `Правит губернатор ${person()} и совет судовладельцев`]),
  temple: () => pick([`Настоятель — брат ${pick(MEN)}`, `Обителью правит мать-настоятельница ${pick(WOMEN)}`]),
  tower: () => pick([`Смотритель — ${person(false)}`, 'Смотрителя нет уже лет двадцать']),
  ruins: () => ''
}
const FEATURES = [
  () => `часовня Орамея, построенная при ${pick(['Габриэле Благочестивом', 'Лотаре Набожном', 'Роберте Реформаторе', 'Сандре II'])}`,
  () => `каменный мост времён Валериана Строителя`,
  () => `трактир «${pick(['Старый брод', 'Огненный дракон', 'Три колоса', 'Хромой Вальтер', 'Серый легионер', 'Пепел и мёд', 'Золотая подкова', 'У Сорочьего брода', 'Пьяный Ульрих', 'Сонный Феликс'])}»`,
  () => `ярмарка каждую ${pick(WEEKDAYS)}`,
  () => `большая осенняя ярмарка в месяц ${pick(MONTHS)}`,
  () => 'почтовая станция на имперском тракте',
  () => 'курган воинов эпохи раздробленности',
  () => 'дом призрения Дома Кронау',
  () => 'школа для бедных, открытая ещё по указу Роберта I',
  () => 'старый межевой камень с гербом Аскенов',
  () => 'кузня, где куют подковы для имперской кавалерии',
  () => 'родник, который местные считают целебным',
  () => 'заброшенная сторожевая вышка эпохи княжеств',
  () => 'дуб, под которым, по преданию, ночевал Тейбер',
  () => 'кладбище с плитами легионеров',
  () => 'мельница на три жернова',
  () => 'постоялый двор для гуртовщиков',
  () => 'пивоварня, поставляющая пиво гарнизонам',
  () => 'старая сыроварня с погребами',
  () => 'малый храм Света с витражом Сандры Огненной',
  () => 'памятный столб с именами погибших в 975–980 гг.',
  () => 'земская больница',
  () => 'ремесленная гильдия ткачей'
]
const LEGENDS = [
  'Говорят, в здешнем лесу до сих пор бродит призрак князя Ортвина Аскена.',
  'Местные уверяют, что Сандра Огненная однажды остановилась здесь на ночь и сожгла сарай, не проснувшись.',
  'Старики рассказывают, что в год Ночи Пепла здесь три дня шёл чёрный снег.',
  'В деревне верят, что серебряная монета Октавиана Счетовода приносит удачу в торге.',
  'Здешние дети играют «в Тейбера и Рагнвальда» — один поджигает, другой тонет.',
  'Сюда тайно приезжают монархисты поклониться дому, где ночевал Тейбер II в 977 г.',
  'В колодце, говорят, утопили сборщика налогов при Люции Кровавом — и с тех пор вода горькая.',
  'По ночам в развалинах старой башни видят огонь: одни говорят — маг, другие — контрабандисты.',
  'Каждую весну здесь спорят, чей бык лучше, — и каждую весну спор кончается дракой.',
  'Здесь родился знаменитый ветеран Пепельного легиона, и деревня до сих пор этим гордится.',
  'Местный священник уверяет, что видел сон о возвращении Тейбера I.',
  'Половина деревни носит одну фамилию: все — потомки одного полкового бастарда Себастьяна Красавца.'
]
const sentence = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : '')

// ---------- особые места ----------
const special = new Map() // id провинции -> {kind, ...}
const byType = (types) => provs.filter((p) => p.settlement && types.includes(p.settlement.type))
const spread = (list, n, min) => {
  const out = []
  for (const p of [...list].sort((a, b) => b.px - a.px)) {
    if (out.length >= n) break
    if (out.every((q) => dist(q, p) > min) && !special.has(p.id)) out.push(p)
  }
  return out
}

// Аурхафен: портовая провинция на южном берегу ближе всего к Хауссеру
const oldPort = world.places.find((p) => p.id === 'lore-emp-aurhafen')
world.places = world.places.filter((p) => !p.id.startsWith('lore-emp-'))
const coastal = provs.filter((p) => p.coastal && p.settlement && dist(p, haussler) > 120)
// открытое море к югу от точки: вода на 40, 80 и 140 единиц ниже и по сторонам
const { data: pm, info: pi } = await sharp('resources/default-world/maps/provinces.png').raw().toBuffer({ resolveWithObject: true })
const water = (x, y) => {
  const px = Math.floor(x / 2), py = Math.floor(y / 2)
  if (px < 0 || py < 0 || px >= pi.width || py >= pi.height) return true
  return pm[(py * pi.width + px) * 4 + 3] === 0
}
const openSea = (q) => [[0, 40], [0, 80], [0, 140], [-60, 110], [60, 110], [0, 220]].every(([dx, dy]) => water(q.x + dx, q.y + dy))
const portProv = provs.find((p) => p.landmark === 'aurhafen') ?? coastal
  .filter((p) => p.settlement && openSea(p.settlement))
  .sort((a, b) => dist(a, haussler) - dist(b, haussler))[0]
special.set(portProv.id, { kind: 'grandport' })

// родовые гнёзда великих домов
const seats = new Map()
for (const h of HOUSES) {
  const regs = world.adminRegions.filter((a) => a.houseId === `lore-${h.id}`).map((a) => a.id)
  const cand = provs.filter((p) => regs.includes(admin.get(p.areaId)?.parentId) && p.settlement && !special.has(p.id))
  if (!cand.length) continue
  const best = cand.sort((a, b) => (['city', 'castle', 'town'].indexOf(b.settlement.type) - ['city', 'castle', 'town'].indexOf(a.settlement.type)) || b.px - a.px)[0]
  special.set(best.id, { kind: 'seat', house: h })
  seats.set(h.id, best)
}
// кастры легионов II–X (I стоит в столице)
const LEGION_SEAT = [
  ['legion-2', 'II Пепельного легиона', 'Серые плащи на стенах, пепельные знамёна над воротами.'],
  ['legion-3', 'III Штайнгардского легиона', 'Горные волки держат перевалы и учат новобранцев лазать по скалам.'],
  ['legion-4', 'IV Северного легиона', 'Отсюда в 975 г. Гериберт Штайнер увёл легион к совету.'],
  ['legion-5', 'V Южного легиона', 'Ветераны джакских восстаний держат южное побережье.'],
  ['legion-6', 'VI Морского легиона', 'Казармы морской пехоты у самой воды.'],
  ['legion-7', 'VII Лесного легиона', 'Зелёные плащи, самые суеверные солдаты Империи: у ворот висят обереги из эльфийских костей.'],
  ['legion-8', 'VIII Конного легиона', 'Конюшни на тысячи коней и манеж под крышей.'],
  ['legion-9', 'IX Легиона Стражей Брода', 'Скучная служба у переправ и лучшая выслуга в армии.'],
  ['legion-10', 'X Легиона Последней клятвы', 'Собран заново после 980 г.; старые казармы пусты, на стенах соскоблены портреты Люция.']
]
const legionProvs = spread(byType(['castle', 'town', 'city', 'port']), LEGION_SEAT.length, 300)
legionProvs.forEach((p, i) => special.set(p.id, { kind: 'legion', legion: LEGION_SEAT[i] }))
// усадьба Фернов (где родился Тейбер) и Академия Копья — у самой столицы
const nearCap = provs.filter((p) => p.settlement && !special.has(p.id)).sort((a, b) => dist(a, haussler) - dist(b, haussler))
special.set(nearCap[1].id, { kind: 'fern' })
special.set(nearCap[3].id, { kind: 'academy' })
const summerPalace = provs.filter((p) => p.settlement && !special.has(p.id) && dist(p, haussler) > 200).sort((a, b) => dist(a, haussler) - dist(b, haussler))[0]
special.set(summerPalace.id, { kind: 'palace' })

// ---------- низшая знать округов и описания регионов ----------
const areaFamily = new Map()
for (const p of provs) {
  const a = areaOf(p)
  if (!a || areaFamily.has(a.id)) continue
  const fam = `фон ${a.name.replace(/^(Округ|Приход|Херад|Чертог|Кантон|Дистретто) /, '')}`
  const female = chance(0.25)
  const fname = fam.replace(/^фон /, '')
  areaFamily.set(a.id, { fam, head: `${pick(female ? WOMEN : MEN)} фон ${fname}`, title: female ? pick(['баронесса', 'владетельная госпожа']) : pick(['барон', 'рыцарь', 'владетельный господин', 'граф']) })
}
for (const a of world.adminRegions) if (a.descAuto) { delete a.description; delete a.descAuto }
for (const [aid, f] of areaFamily) {
  const a = admin.get(aid)
  const reg = admin.get(a.parentId)
  const house = houseById.get(reg?.houseId)
  const list = provs.filter((p) => p.areaId === aid)
  const main = list.filter((p) => p.settlement).sort((x, y) => y.px - x.px)[0]
  const econ = [...new Set(list.flatMap((p) => pickN(ECON[p.terrain] ?? ECON[1], 1)))].slice(0, 3)
  a.descAuto = true
  a.description = `${a.name} — владение рода ${f.fam} (низшая знать), вассалов ${house ? house.name.replace('Дом ', 'Дома ') : 'имперской казны'}. Глава рода — ${f.title} ${f.head}. ${main ? `Земское собрание округа собирается в селении ${main.name}. ` : ''}Главные промыслы: ${econ.join(', ')}.`
}
for (const reg of world.adminRegions.filter((a) => a.level === 'region' && a.houseId)) {
  const h = houseById.get(reg.houseId)
  const list = provs.filter((p) => admin.get(p.areaId)?.parentId === reg.id)
  if (!list.length || !h) continue
  const cities = list.filter((p) => p.settlement && ['city', 'port', 'town'].includes(p.settlement.type)).sort((a, b) => b.px - a.px).slice(0, 4).map((p) => p.name)
  const seat = seats.get(h.id)
  reg.descAuto = true
  reg.description = `${reg.name} — земля ${h.name.replace('Дом ', 'Дома ')} (${h.title.toLowerCase()}). ${seat ? `Родовое гнездо — ${seat.name}. ` : ''}${cities.length ? `Главные города: ${cities.join(', ')}. ` : ''}Округами правит низшая знать по вассальным грамотам дома; в городах — губернаторы, в деревнях — земские сходы и старейшины.`
}

// ---------- описание каждого поселения ----------
const usedText = new Set()
let made = 0
for (const p of provs) {
  delete p.description
  const st = p.settlement
  if (!st) continue
  const reg = regionOf(p)
  const house = houseById.get(reg?.houseId)
  const fam = areaFamily.get(p.areaId)
  const before = firstOwner(p)
  const year = joined(p)
  const sp = special.get(p.id)
  const parts = []
  const yards = 12 + Math.floor(rnd() * 70)
  if (sp?.kind === 'grandport') continue // Аурхафен — отдельное место автора с собственной моделью
  if (sp?.kind === 'seat') {
    if (!['city', 'castle', 'town'].includes(st.type)) st.type = 'castle'
    parts.push(`${p.name} — родовое гнездо ${sp.house.name.replace('Дом ', 'Дома ')}: замок над ${pick(['городом', 'рекой', 'долиной', 'дорогой'])}, где хранят знамёна и родовые книги дома`)
    parts.push(`Над воротами — герб: ${sp.house.arms.charAt(0).toLowerCase() + sp.house.arms.slice(1).replace(/\.$/, '')}; девиз ${sp.house.motto}`)
  } else if (sp?.kind === 'legion') {
    st.type = 'castle'
    parts.push(`${p.name} — кастра ${sp.legion[1]}, военный город, где живут легионеры, их семьи и ветераны`)
    parts.push(sp.legion[2])
    parts.push('Знатью здесь никого не считают: в кастре свой суд — Военный трибунал, свои кладбища и свои обычаи')
  } else if (sp?.kind === 'fern') {
    parts.push(`${p.name} — деревня, где в 100 г. в семье генерала Ансельма Ферна родился Тейбер, будущий Огненный Дракон`)
    parts.push('Старая усадьба Фернов стоит до сих пор: Империя держит её как музей, а монархисты тайно приезжают сюда в годовщину Ночи Пепла')
  } else if (sp?.kind === 'academy') {
    st.type = 'castle'
    parts.push(`${p.name} — городок вокруг Академии Копья, старейшей военной академии Лоры, где в 116 г. учился Тейбер Ферн`)
    parts.push('Выпускники выходят знаменосцами; на плацу стоит бронзовый Тейбер с отцовским знаменем у Сорочьего брода')
  } else if (sp?.kind === 'palace') {
    parts.push(`${p.name} — старое императорское поместье, Летний дворец Доминика I Пиршественника`)
    parts.push('Сады, павильоны и пруды стоят полупустыми с 980 г.: императорской семье покидать Дистрикт Альфа запрещено, и совет сдаёт дворец под приёмы великих домов')
  } else {
    parts.push(pick(TYPE_OPEN[st.type] ?? TYPE_OPEN.village)(p.name, yards))
  }
  // хозяйство
  const econ = pickN(ECON[p.terrain] ?? ECON[1], 2)
  if (p.coastal) econ.push(pick(COAST))
  parts.push(`${pick(['Живёт', 'Кормится', 'Богатеет', 'Держится'])} ${pick(['тем, что даёт земля', 'промыслами', 'своим трудом'])}: ${econ.join(', ')}`)
  if (house && chance(0.6)) parts.push(HOUSE_TRADE[house.id] ?? '')
  // власть
  const gov = (GOV[st.type] ?? GOV.village)()
  if (gov && !sp) parts.push(gov)
  if (fam && !sp && chance(0.5)) parts.push(`Землёй владеет род ${fam.fam}`)
  // приметы
  if (st.type !== 'ruins') parts.push(`Здесь ${pickN(FEATURES, chance(0.5) ? 2 : 1).map((f) => f()).join(' и ')}`)
  // история
  if (before && before.id !== empire.id && year) parts.push(`До ${year} г. — земля ${before.base.name.replace(/^(Графство|Княжество|Герцогство|Маркграфство) /, (m) => ({ 'Графство ': 'Графства ', 'Княжество ': 'Княжества ', 'Герцогство ': 'Герцогства ', 'Маркграфство ': 'Маркграфства ' })[m])}; присоединена Тейбером ${year < 122 ? 'в Войну двух соседей' : 'в войны объединения'}`)
  else if (before?.id === empire.id) parts.push(pick(['Исконная земля Дагерфорда', 'Земля старого Дагерфорда, ещё Аскенов', 'Здесь правили князья Аскены задолго до Тейбера']))
  if (chance(0.35)) parts.push(wasPact(p) ? pick(['В гражданскую войну стояла за Пакт Ставки и Совета', 'В 975–980 гг. здесь держали сторону совета']) : pick(['В гражданскую войну осталась верна Короне', 'В 975–980 гг. здесь ждали императора и проклинали совет']))
  if (chance(0.3)) parts.push(pick(LEGENDS))
  let text = parts.filter(Boolean).map(sentence).join(' ')
  while (usedText.has(text)) text += ' ' + sentence(pick(FEATURES)())
  usedText.add(text)
  p.description = text
  made++
}

// Аурхафен — место автора с собственной моделью
const gp = portProv
gp.landmark = 'aurhafen'
world.places.push({
  id: 'lore-emp-aurhafen',
  mapId: 'world',
  x: gp.settlement?.x ?? oldPort.x,
  y: gp.settlement?.y ?? oldPort.y,
  model: 'grandport',
  base: {
    name: 'Аурхафен',
    type: 'port',
    stateId: empire.id,
    population: 'около 180 тысяч',
    ruler: 'Губернатор от Дома Морвинг; гаванью и флотом — адмирал Империи Маргот Веллен',
    image: '',
    description:
      'Золотая гавань — величайший порт Империи и всей Лоры. Построен Адрианом I Мореплавателем для первого имперского флота; отсюда в 451 г. ушли корабли к Эльфборну.\n\n**Гавань.** Каменный волнолом в полторы мили длиной, маяк Сандры — башня, на вершине которой вечно горит магический огонь, — и три бассейна: военный, торговый и рыбный. Одновременно у причалов стоят до трёхсот кораблей.\n\n**Город.** Верфи Дома Морвинг, канатные дворы, склады соли Зальтмаров, Морская биржа, казармы VI Морского легиона и южного флота. Половина города говорит на портовом жаргоне, вторая половина — на нём же, но тише.\n\n**Власть.** Губернатора назначает совет из людей Морвингов; гаванью и флотом ведает адмирал Империи Маргот Веллен — и эти двое не здороваются уже девять лет.\n\n**Торговля.** Через Аурхафен идёт почти вся морская торговля Империи: соль, вино Остервельдов, железо Грауэнштайнов, хлеб Литтенау. После 980 г. Республика перехватила южные пути, и порт живёт на треть беднее, чем при Ульрихе Пьянице.'
  },
  history: [],
  from: Y(437),
  to: null
})
gp.settlement = null
gp.description = 'Здесь стоит Аурхафен — величайший порт Империи (см. место на карте).'

// легионы: дописать стоянки
for (const [i, p] of legionProvs.entries()) {
  const e = world.entries.find((x) => x.id === `lore-${LEGION_SEAT[i][0]}`)
  if (e && !e.base.body.includes('Кастра:')) e.base.body += `\n\n**Кастра:** ${p.name}.`
}
const l1 = world.entries.find((x) => x.id === 'lore-legion-1')
if (l1 && !l1.base.body.includes('Кастра:')) l1.base.body += '\n\n**Кастра:** Хауссер, Дистрикт Бета.'
// дома: родовые гнёзда
for (const [hid, p] of seats) {
  const e = world.entries.find((x) => x.id === `lore-${hid}`)
  if (e) e.base.props.seat = p.name
}

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Описаний поселений: ${made}, округов: ${areaFamily.size}, гнёзд домов: ${seats.size}, кастр: ${legionProvs.length}, Аурхафен: ${gp.name}`)
