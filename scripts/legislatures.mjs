// Системы власти по годам → world.legislatures: состав по созывам (поимённо, с приходом и уходом), законы каждого года,
// поимённые голоса и хроника. Ключевые законы и итоги — scripts/lore/power.mjs; рядовые законы каждого года,
// имена депутатов и сенаторов, их взгляды и голоса — генерируются здесь. Детерминированно.
// Запуск после seed-lore.mjs и argus-detail.mjs: node scripts/legislatures.mjs
import { readFileSync, writeFileSync } from 'fs'
import { COUNCIL, SENATE } from './lore/power.mjs'
import { HOUSES } from './lore/empire.mjs'
import { MINOR_HOUSES } from './lore/argus.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
const entryById = new Map(world.entries.map((e) => [e.id, e]))
const yearOf = (d) => Math.floor(d / YEAR) + 1

let seed = 101010
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const MEN = ['Альбрехт', 'Ансельм', 'Арнольд', 'Бертольд', 'Вальтер', 'Вендель', 'Вильгельм', 'Гартвиг', 'Гельмут', 'Генрих', 'Герхард', 'Готфрид', 'Дитрих', 'Иоахим', 'Карл', 'Клаус', 'Конрад', 'Курт', 'Леберехт', 'Леопольд', 'Лотар', 'Людвиг', 'Маттиас', 'Николаус', 'Отто', 'Рейнхард', 'Рихард', 'Рупрехт', 'Себальд', 'Тибальт', 'Ульрих', 'Фолькер', 'Фридрих', 'Хайнц', 'Ханс', 'Эберхард', 'Эгон', 'Эккехард', 'Эрвин', 'Юрген', 'Адальберт', 'Бруно', 'Виганд', 'Гебхард', 'Зигфрид', 'Кунибальд', 'Мангольд', 'Ортвин', 'Регинальд', 'Танкмар']
  .map((n) => n.replace('Виганд', 'Виганд'))
const WOMEN = ['Агата', 'Адельхайд', 'Аделина', 'Берта', 'Вальбурга', 'Гертруда', 'Гизела', 'Иоханна', 'Катарина', 'Кунигунда', 'Лизелотта', 'Магдалена', 'Матильда', 'Ода', 'Регина', 'Урсула', 'Хедвиг', 'Хильда', 'Эльза', 'Эмма']
const SURN_A = ['Ад', 'Альт', 'Бау', 'Бер', 'Бирк', 'Брук', 'Вайс', 'Вальд', 'Вен', 'Гольд', 'Грюн', 'Дорн', 'Зее', 'Кальт', 'Кирх', 'Лин', 'Мар', 'Мит', 'Мюл', 'Нойер', 'Обер', 'Рот', 'Ройт', 'Тан', 'Хаген', 'Хайль', 'Хоф', 'Шварц', 'Штайн', 'Штиль', 'Эйх', 'Эрлен']
const SURN_B = ['ман', 'ер', 'ке', 'ниц', 'бах', 'хайм', 'гер', 'дорф', 'ле', 'брандт', 'штедт', 'ау', 'мер', 'вирт']
const surname = () => pick(SURN_A) + pick(SURN_B)
const LEGIONS = ['I Императорского', 'II Пепельного', 'III Штайнгардского', 'IV Северного', 'V Южного', 'VI Морского', 'VII Лесного', 'VIII Конного', 'IX Стражей Брода', 'X Последней клятвы']
const TRAITS = ['осторожен и голосует последним', 'громок и любит длинные речи', 'молчит годами и голосует со своей скамьёй', 'известен острым языком', 'дружит с половиной зала и должен другой половине', 'набожен и строг', 'вспыльчив, однажды вызвал соседа по скамье на дуэль', 'ведёт счёт чужим ошибкам', 'уважаем за честность и нелюбим за неё же', 'щедр на обещания', 'стар, глуховат и упрям', 'молод и честолюбив']

// ---------- законы по шаблонам ----------
const empireProvs = world.provinces.filter((p) => world.states.find((s) => s.id === p.state)?.base.name === 'Империя' && p.settlement && ['city', 'town', 'port'].includes(p.settlement.type)).map((p) => p.name)
const argusSt = world.states.find((s) => s.base.name === 'Корона Аргус')
const argusProvs = world.provinces.filter((p) => p.state === argusSt.id && p.settlement)
const argusTowns = argusProvs.filter((p) => ['city', 'town', 'port'].includes(p.settlement.type)).map((p) => p.name)
const argusCastles = argusProvs.filter((p) => p.settlement.type === 'castle').map((p) => p.name)
const GOODS = ['соль', 'вино', 'железо', 'шерсть', 'кожи', 'зерно', 'лес', 'медь', 'пряности юга', 'меха', 'воск', 'серебро']
const NEIGH = ['Республикой', 'Креитом', 'Фарвольской лигой', 'Рейхом', 'Землями Севера']
const LENDERS = ['семьи Каяя', 'графини Мангениум', 'Дома Морвинг', 'гильдии Хауссера']

const EMPIRE_TPL = [
  (y) => ({ title: `Бюджет Империи на ${y} г.`, kind: 'бюджет', w: { army: 0.6, trade: 0.4 }, sponsor: 'constit', summary: `Расходы казны на ${y} г.: легионам — ${60 + Math.floor(rnd() * 25)} частей из ста, дорогам и мостам — ${5 + Math.floor(rnd() * 8)}, Дистрикту Альфа — ${2 + Math.floor(rnd() * 3)}, долгам — остальное.`, yearly: true }),
  () => { const l = pick(LEGIONS); return { title: `Жалованье ${l} легиона`, kind: 'закон', w: { army: 1.6, trade: -0.3 }, sponsor: 'stavka', summary: `Прибавка жалованья ${l} легиону на ${1 + Math.floor(rnd() * 3)} года.` } },
  () => { const a = pick(empireProvs), b = pick(empireProvs); return { title: `Ремонт тракта ${a} — ${b}`, kind: 'закон', w: { trade: 1, army: 0.3 }, sponsor: pick(['constit', 'stavka']), summary: `Казна чинит мощёный тракт между ${a} и ${b}; работы ведут ветераны и сапёры легионов.` } },
  () => { const g = pick(GOODS), up = rnd() < 0.5; return { title: `${up ? 'Пошлина' : 'Снижение пошлины'} на ${g}`, kind: 'закон', w: { trade: up ? -1.5 : 1.5 }, sponsor: up ? pick(['hawks', 'chaplains']) : 'constit', summary: up ? `Ввозная пошлина на ${g} поднята, чтобы защитить имперских мастеров и пополнить казну.` : `Пошлина на ${g} снижена вдвое по просьбе купцов.` } },
  () => { const c = pick(empireProvs); return { title: `Права земского собрания в ${c}`, kind: 'закон', w: { reform: 1.3 }, sponsor: 'liberal', summary: `Земскому собранию округа ${c} разрешено самому раскладывать подати.` } },
  () => ({ title: 'Церковная десятина с поместий', kind: 'закон', w: { church: 1.6, trade: -0.4 }, sponsor: 'chaplains', summary: 'Святая церковь просит вернуть десятину с поместий, отменённую в гражданскую войну.' }),
  () => ({ title: `Помилование изгнанника ${pick(MEN)} ${surname()}`, kind: 'резолюция', w: { crown: 1, foreign: -0.5 }, sponsor: 'restorers', summary: 'Прошение монархиста из Имперских изгнанников вернуться домой и принести новую присягу.' }),
  (y) => ({ title: `Содержание Дистрикта Альфа на ${y} г.`, kind: 'бюджет', w: { crown: 0.8 }, sponsor: 'constit', summary: 'Расходы на императорскую семью, Императорских стражей и дворцовую прислугу.' }),
  () => { const c = pick(empireProvs); return { title: `Школа при храме в ${c}`, kind: 'закон', w: { reform: 1.4, church: 0.3 }, sponsor: 'liberal', summary: `Казна платит учителям школы при храме в ${c}.` } },
  () => { const l = pick(LENDERS); return { title: `Заём ${l}`, kind: 'договор', w: { trade: 0.9, foreign: -0.3 }, sponsor: 'constit', summary: `Казна берёт заём у ${l} под залог пошлин.` } },
  () => { const n = pick(NEIGH); return { title: `Гарнизоны на рубеже с ${n}`, kind: 'закон', w: { army: 1.2, foreign: 1.2 }, sponsor: 'hawks', summary: `Две когорты переводятся на рубеж с ${n}.` } },
  () => { const l = pick(LEGIONS); return { title: `Пенсии вдовам ${l} легиона`, kind: 'закон', w: { army: 1, reform: 0.6 }, sponsor: 'stavka', summary: `Вдовы павших легионеров получают пенсию из казны, а не из легионной кассы.` } },
  () => { const n = pick(NEIGH); const hard = rnd() < 0.5; return { title: `Ответ на ноту ${n.replace(/ой$/, 'ой').replace('Республикой', 'Республики').replace('Креитом', 'Креита').replace('Фарвольской лигой', 'Фарвольской лиги').replace('Рейхом', 'Рейха').replace('Землями Севера', 'Земель Севера')}`, kind: 'резолюция', w: { foreign: hard ? 1.6 : -1.2 }, sponsor: hard ? 'hawks' : 'liberal', summary: hard ? 'Совет отвечает резко и требует извинений.' : 'Совет предлагает переговоры и обмен пленными.' } },
  () => { const c = pick(empireProvs); return { title: `Привилегии гильдий ${c}`, kind: 'закон', w: { trade: 0.8, reform: -0.5 }, sponsor: 'constit', summary: `Гильдии ${c} получают монополию на торговлю в городе на двадцать лет.` } },
  () => ({ title: 'Запрет охоты в коронных лесах', kind: 'закон', w: { crown: 0.6, reform: -0.6 }, sponsor: 'restorers', summary: 'Охота в бывших коронных лесах — только с грамоты совета.' }),
  () => ({ title: 'Перепись поместий', kind: 'закон', w: { trade: -0.5, reform: 0.6 }, sponsor: 'liberal', summary: 'Новая перепись земель по образцу Земельной книги Маркуса II.' })
]
const SENATE_TPL = [
  (y) => ({ title: `Цена Серебряной грамоты на ${y} г.`, kind: 'указ', w: { chain: 0.7 }, sponsor: 'chainbar', summary: `Оценщики Сената поднимают цену выкупа на ${2 + Math.floor(rnd() * 9)} частей из ста.`, yearly: true }),
  (y) => ({ title: `Дань Империи за ${y} г.`, kind: 'договор', w: { indep: -1.2, trade: 0.3 }, sponsor: 'white', summary: `Дань уходит в Хауссер ${pick(['старым серебром', 'неходовым зерном', 'талерами Короны', 'рабами, которых Империя не может держать и потому перепродаёт'])}.`, yearly: true }),
  () => { const h = pick(MINOR_HOUSES.filter((x) => x.areas.length)); return { title: `Подтверждение грамоты ${h.name.replace('Дом ', 'Дома ')}`, kind: 'указ', w: { heir: 0.3 }, sponsor: 'white', summary: `Сенат подтверждает права ${h.name.replace('Дом ', 'Дома ')} на ${h.areas[0]}.` } },
  () => { const c = pick(argusTowns); return { title: `Губернатор ${c}`, kind: 'указ', w: { heir: 0.3 }, sponsor: pick(['white', 'oldblood']), summary: `Сенат ставит в ${c} нового губернатора — ${pick(MEN)} ${surname()}.` } },
  () => { const g = pick(GOODS); const up = rnd() < 0.6; return { title: `${up ? 'Пошлина' : 'Снижение пошлины'} на ${g}`, kind: 'закон', w: { trade: up ? -1.4 : 1.4, indep: up ? 0.5 : 0 }, sponsor: up ? 'oldblood' : 'chainbar', summary: up ? `Пошлина на ${g} из Империи поднята.` : `Купцы Ландвейлера выпросили снижение пошлины на ${g}.` } },
  () => { const c = pick(argusCastles); return { title: `Ремонт заставы ${c}`, kind: 'закон', w: { army: 1.2 }, sponsor: 'white', summary: `Горная стража получает деньги на стены и башни ${c}.` } },
  () => ({ title: `Набор в ${pick(['Медный', 'Сребролистый', 'Кандальный', 'Соляной', 'Вольный'])} полк`, kind: 'указ', w: { army: 1, chain: -0.4 }, sponsor: 'white', summary: 'Сто новых цепных в полк — из рабов, купленных казной.' }),
  () => { const c = pick(argusTowns); return { title: `Ярмарка в ${c}`, kind: 'указ', w: { trade: 1 }, sponsor: 'chainbar', summary: `Ежегодная ярмарка в ${c} получает освобождение от пошлин на три дня.` } },
  () => { const v = pick(argusProvs).name; return { title: `Цепной суд: бунт в ${v}`, kind: 'указ', w: { chain: 1.6 }, sponsor: 'chainbar', summary: `Сенат утверждает приговор Цепного суда зачинщикам бунта в ${v}: каторга в Ландбахе.` } },
  () => ({ title: 'Свечная пошлина Братства Перевала', kind: 'закон', w: { church: 1.3, trade: -0.5 }, sponsor: 'ring', summary: 'Братство Перевала просит поднять «свечную пошлину» с купцов на ремонт приютов.' }),
  () => { const t = pick(['Мангениум', 'Штирию', 'Креит', 'Фарвольскую лигу', 'вольный город Каяя']); return { title: `Посольство в ${t}`, kind: 'указ', w: { indep: 1.2 }, sponsor: 'white', summary: `Сенат отправляет посольство в ${t} — официально о торговле.` } },
  () => ({ title: 'Перепись рабов наместничества', kind: 'закон', w: { chain: 0.6 }, sponsor: 'chainbar', summary: 'Счётная палата пересчитывает рабов по головам и ремёслам.' })
]

function build(body, tpl, perYear) {
  const factions = body.factions
  const fIndex = new Map(factions.map((f, i) => [f.id, i]))
  const issues = body.issues.map((i) => i.id)
  const members = []
  const mk = (f, group, from, extra = {}) => {
    const fac = factions[fIndex.get(f)]
    const female = rnd() < 0.18
    const born = Math.floor(from) - 28 - Math.floor(rnd() * 34)
    const m = {
      id: `${body.id}-m${members.length}`,
      name: '',
      entryId: '',
      faction: f,
      group,
      title: '',
      origin: '',
      born,
      from: D(from),
      to: null,
      stance: fac.stance.map((v) => Math.round(clamp(v + gauss() * 0.55, -2, 2) * 10) / 10),
      bio: '',
      female,
      ...extra
    }
    members.push(m)
    return m
  }
  const nameIt = (m) => {
    if (m.entryId) return
    const first = pick(m.female ? WOMEN : MEN)
    if (body.id === 'empire-council') {
      if (m.faction === 'chaplains') {
        m.name = `${first} ${surname()}`
        m.title = m.group === 'Знать' ? pick(['Епископ', 'Архиепископ', 'Аббат', 'Настоятель собора']) : `Капеллан ${pick(LEGIONS)} легиона`
        m.origin = m.group === 'Знать' ? pick(['Сантарея', 'Хауссер', 'архиепархия юга', 'обитель Кронау']) : 'Генералитет'
        if (m.female) { m.female = false; m.name = `${pick(MEN)} ${surname()}` }
      } else if (m.group === 'Генералитет') {
        m.name = `${first} ${surname()}`
        m.title = pick(['Генерал-легат', 'Легат', 'Легат', 'Маршал Империи', 'Полковник-трибун', 'Генерал-квартирмейстер', 'Генерал-инженер'])
        m.origin = `${pick(LEGIONS)} легион`
      } else {
        const fac = factions[fIndex.get(m.faction)]
        const house = fac.houses.length && rnd() < 0.55 ? HOUSES.find((h) => h.id === pick(fac.houses)) : null
        m.name = house ? `${first} ${house.name.replace('Дом ', '')}` : `${first} фон ${surname()}`
        m.origin = house ? house.name : 'Низшая знать'
        m.title = m.female ? 'Депутат от знати' : 'Депутат от знати'
      }
    } else {
      const housesBy = { white: ['ag-mardorf', 'ag-grisbach', 'ag-steinmark', 'ag-zwinger'], oldblood: ['ag-hohenfels', 'ag-ulfengard'], chainbar: ['ag-ebers', 'ag-lauen', 'ag-waldgries'], ring: ['ag-ulfengard', 'ag-grisbach'], imperial: ['ag-talel'], free: [] }
      const hid = pick(housesBy[m.faction] ?? [])
      const h = MINOR_HOUSES.find((x) => x.id === hid)
      if (m.faction === 'free') {
        m.name = `${first} ${pick(['Выкупленный', 'Сын Грамоты', 'из Лауенвальда'])}`
        m.origin = 'Вольноотпущенник'
      } else if (m.faction === 'imperial' && rnd() < 0.5) {
        m.name = `${first} ${surname()}`
        m.origin = 'Бывший чиновник комиссариата'
      } else if (h) {
        const fam = h.name.replace('Дом ', '')
        m.name = fam.startsWith('Аргус') ? `${first} ${fam}` : `${first} фон ${fam}`
        m.origin = h.name
      } else {
        m.name = `${first} фон ${surname()}`
        m.origin = 'Низшая знать'
      }
      m.title = 'Сенатор Короны'
    }
  }
  // члены из карточек
  const named = new Set()
  for (const [eid, f, group, from, to, role] of body.named) {
    const e = entryById.get(eid)
    if (!e) continue
    const m = mk(f, group, from, { entryId: eid, name: e.base.name, title: role || e.base.title, origin: e.base.links?.dynasty ? (entryById.get(e.base.links.dynasty)?.base.name ?? '') : body.id === 'empire-council' && group === 'Генералитет' ? 'Верховная ставка' : '' })
    m.born = e.from != null ? yearOf(e.from) : m.born
    m.female = e.base.props?.gender === 'Женский'
    m.to = to ? D(to) : e.to ?? null
    m.bio = e.base.summary || e.base.body.split('. ')[0] + '.'
    named.add(m.id)
  }
  // созывы: добираем до нужного числа мест, лишних выводим
  const convs = body.convocations
  const endAll = D(1010.99)
  for (let ci = 0; ci < convs.length; ci++) {
    const c = convs[ci]
    const start = D(c.year)
    const active = () => members.filter((m) => m.from <= start && (m.to == null || m.to > start))
    // уход: возраст и обычная смена
    for (const m of active()) {
      if (named.has(m.id) || ci === 0) continue
      const age = Math.floor(c.year) - m.born
      if (rnd() < (age > 70 ? 0.6 : 0.16)) m.to = start
    }
    for (const f of factions) {
      const want = c.seats[f.id] ?? 0
      let have = active().filter((m) => m.faction === f.id)
      while (have.length > want) {
        const out = have.filter((m) => !named.has(m.id)).sort((a, b) => a.born - b.born)[0] ?? have[have.length - 1]
        out.to = start
        have = active().filter((m) => m.faction === f.id)
      }
      // named, которые входят позже, займут место — резервируем
      const later = members.filter((m) => named.has(m.id) && m.faction === f.id && m.from > start && m.from < (convs[ci + 1] ? D(convs[ci + 1].year) : endAll)).length
      for (let k = have.length + later; k < want; k++) {
        const group = f.group === 'Оба' ? (k % 2 ? 'Знать' : 'Генералитет') : f.group
        const m = mk(f.id, group, c.year + (ci === 0 ? 0 : rnd() * 0.02))
        nameIt(m)
      }
    }
  }
  // смерти посреди созыва и довыборы
  for (const m of [...members]) {
    if (m.entryId) continue
    const death = m.born + 64 + Math.floor(rnd() * 22)
    if (death < 1011 && D(death) > m.from && (m.to == null || D(death) < m.to)) {
      const end = m.to
      m.to = D(death + rnd() * 0.9)
      m.left = 'умер'
      const r = mk(m.faction, m.group, yearOf(m.to) + 0.3)
      if (r.from >= (end ?? endAll)) members.pop()
      else {
        r.to = end
        nameIt(r)
      }
    }
  }
  for (const m of members) {
    if (!m.bio) {
      const yrs = `${yearOf(m.from)}${m.to ? `–${yearOf(m.to)}` : ''}`
      m.bio = `${m.title}${m.origin ? `, ${m.origin}` : ''}. В ${body.name.toLowerCase().includes('сенат') ? 'Сенате' : 'совете'} ${m.to ? `в ${yrs} гг.` : `с ${yearOf(m.from)} г.`}; ${pick(TRAITS)}.`
    }
    if (m.to && !m.left) m.left = m.to === D(Math.floor(yearOf(m.to)) + 0.3) ? 'не переизбран' : 'выбыл'
  }

  // ---------- законы ----------
  const bills = []
  const vote = (b, bias) => {
    const date = b.date
    let out = ''
    const t = { y: 0, n: 0, a: 0, abs: 0 }
    let s2 = (b.seedv >>> 0) || 7
    const r2 = () => ((s2 = (Math.imul(s2, 1664525) + 1013904223) >>> 0) / 4294967296)
    const wnorm = Math.hypot(...b.w) || 1
    for (const m of members) {
      if (m.from > date || (m.to != null && m.to <= date)) {
        out += ' '
        r2()
        r2()
        continue
      }
      const boy = convs.find((c) => c.boycott?.[m.faction])?.boycott?.[m.faction]
      if (boy && date >= D(boy[0]) && date < D(boy[1])) {
        out += '-'
        t.abs++
        r2()
        r2()
        continue
      }
      if (r2() < 0.045) {
        out += '-'
        t.abs++
        r2()
        continue
      }
      const fac = factions[fIndex.get(m.faction)]
      const own = m.stance.reduce((s, v, i) => s + v * b.w[i], 0) / wnorm
      const line = fac.stance.reduce((s, v, i) => s + v * b.w[i], 0) / wnorm
      const sponsorBonus = b.sponsorFaction === m.faction ? 0.8 : 0
      const sc = own * 0.55 + line * 0.45 + sponsorBonus + bias + (r2() - 0.5) * 0.9
      const v = sc > 0.3 ? 'y' : sc < -0.3 ? 'n' : 'a'
      out += v
      t[v]++
    }
    return { votes: out, tally: t }
  }
  const outcomeOf = (b, t) => {
    const present = t.y + t.n + t.a
    if (b.kind === 'хартия') return t.y >= Math.ceil((present * 2) / 3) ? 'принят' : 'отклонён'
    return t.y > t.n ? 'принят' : 'отклонён'
  }
  const addBill = (date, title, kind, w, sponsor, summary, target, yesTarget, key = false) => {
    const wv = issues.map((id) => w[id] ?? 0)
    const sponsorMember = sponsor.startsWith('lore-') ? members.find((m) => m.entryId === sponsor && m.from <= D(date) && (m.to == null || m.to > D(date))) : null
    const sponsorFaction = sponsorMember?.faction ?? (fIndex.has(sponsor) ? sponsor : '')
    const b = { id: `${body.id}-b${bills.length}`, date: D(date), title, kind, w: wv, sponsor: sponsorMember?.id ?? '', sponsorEntry: sponsor.startsWith('lore-') ? sponsor : '', sponsorFaction, summary, key, seedv: bills.length * 7919 + 13 }
    if (target === 'отложен') {
      bills.push({ ...b, outcome: 'отложен', votes: '', tally: null })
      return
    }
    let best = null
    for (let k = 0; k <= 60; k++) {
      const bias = k % 2 ? -(k + 1) / 20 : k / 20
      const r = vote(b, bias)
      const o = outcomeOf(b, r.tally)
      if (target && o !== target) continue
      if (yesTarget != null) {
        if (!best || Math.abs(r.tally.y - yesTarget) < Math.abs(best.r.tally.y - yesTarget)) best = { r, o }
        continue
      }
      best = { r, o }
      break
    }
    if (!best) {
      const r = vote(b, 0)
      best = { r, o: outcomeOf(b, r.tally) }
    }
    bills.push({ ...b, outcome: best.o, votes: best.r.votes, tally: best.r.tally })
  }
  for (const [y, title, sponsor, outcome, w, summary, kind, yes] of body.bills) addBill(y, title, kind, w, sponsor, summary, outcome, yes, true)
  const first = Math.floor(body.from)
  for (let y = first; y <= 1010; y++) {
    const have = bills.filter((b) => yearOf(b.date) === y).length
    const want = perYear[0] + Math.floor(rnd() * (perYear[1] - perYear[0] + 1)) - (y === first ? 2 : 0)
    const usedT = new Set()
    for (const t of tpl) if (t(0).yearly && !(y === 1010)) {
      const g = t(y)
      if (yearOf(D(y + 0.02)) === y && D(y + 0.02) >= D(body.from)) addBill(y + 0.02, g.title, g.kind, g.w, g.sponsor, g.summary)
    }
    for (let k = have; k < want; k++) {
      let i = Math.floor(rnd() * tpl.length)
      while (usedT.has(i) || tpl[i](0).yearly) i = (i + 1) % tpl.length
      usedT.add(i)
      const g = tpl[i](y)
      let at = y + 0.08 + rnd() * 0.88
      if (y === first) at = body.from + rnd() * (y + 0.99 - body.from)
      if (y === 1010) at = 1010 + rnd() * 0.1
      addBill(at, g.title, g.kind, g.w, g.sponsor, g.summary)
    }
  }
  bills.sort((a, b) => a.date - b.date)
  bills.forEach((b, i) => (b.id = `${body.id}-b${i}`))

  // ---------- хроника по годам ----------
  const chronicle = []
  for (let y = first; y <= 1010; y++) {
    const ys = bills.filter((b) => yearOf(b.date) === y)
    const came = members.filter((m) => yearOf(m.from) === y && !(y === first)).length
    const left = members.filter((m) => m.to && yearOf(m.to) === y).length
    const died = members.filter((m) => m.to && yearOf(m.to) === y && m.left === 'умер').map((m) => m.name)
    const conv = convs.find((c) => Math.floor(c.year) === y)
    const auto = [
      `Рассмотрено ${ys.length} ${ys.length % 10 === 1 && ys.length !== 11 ? 'проект' : ys.length % 10 >= 2 && ys.length % 10 <= 4 && (ys.length < 12 || ys.length > 14) ? 'проекта' : 'проектов'}: принято ${ys.filter((b) => b.outcome === 'принят').length}, отклонено ${ys.filter((b) => b.outcome === 'отклонён').length}${ys.some((b) => b.outcome === 'отложен') ? ', отложено ' + ys.filter((b) => b.outcome === 'отложен').length : ''}.`,
      came || left ? `${came ? `Пришли ${came}` : ''}${came && left ? ', ' : ''}${left ? `выбыли ${left}` : ''}.` : '',
      died.length ? `Умерли: ${died.slice(0, 4).join(', ')}${died.length > 4 ? ' и другие' : ''}.` : ''
    ].filter(Boolean)
    chronicle.push({ year: y, text: body.years[y] ?? '', auto: auto.join(' '), convocation: conv ? `${conv.name}. ${conv.note}` : '' })
  }

  const st = world.states.find((s) => s.base.name === body.state)
  return {
    id: body.id,
    stateId: st?.id ?? '',
    name: body.name,
    entryId: body.entryId,
    chairTitle: body.chairTitle,
    seats: body.seats,
    from: D(body.from),
    description: body.description,
    groups: body.groups,
    seatOrder: body.seatOrder,
    issues: body.issues,
    factions: factions.map(({ houses, ...f }) => f),
    convocations: convs.map((c) => ({ date: D(c.year), name: c.name, note: c.note, seats: c.seats })),
    members: members.map(({ female, left, ...m }) => ({ ...m, left: left ?? '', gender: female ? 'Женский' : 'Мужской' })),
    bills: bills.map(({ seedv, ...b }) => b),
    chronicle,
    archive: (body.archive ?? []).map(([y, title, text]) => ({ date: D(y), title, text }))
  }
}

world.legislatures = [build(COUNCIL, EMPIRE_TPL, [6, 9]), build(SENATE, SENATE_TPL, [4, 6])]
// OUT — пробный прогон в другой файл, пока мир занят (например, рисуются портреты)
writeFileSync(process.env.OUT ?? WORLD, JSON.stringify(world, null, 1))
for (const l of world.legislatures) {
  const now = l.members.filter((m) => m.to == null && m.from <= D(1010.5))
  console.log(`${l.name}: членов за всё время ${l.members.length}, сейчас ${now.length}, законов ${l.bills.length}, лет хроники ${l.chronicle.length}`)
}
