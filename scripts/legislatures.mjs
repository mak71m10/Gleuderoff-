// Системы власти по годам → world.legislatures: состав по созывам (поимённо, с приходом и уходом), законы каждого года,
// поимённые голоса и хроника. Ключевые законы и итоги — scripts/lore/power.mjs; рядовые законы каждого года,
// имена депутатов и сенаторов, их взгляды и голоса — генерируются здесь. Детерминированно.
// Запуск после seed-lore.mjs и argus-detail.mjs: node scripts/legislatures.mjs
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { depKey } from './deputy-portraits.mjs'
import { COUNCIL, SENATE } from './lore/power.mjs'
import { PARTIES } from './lore/parties.mjs'
import { SOUTH_PARTIES } from './lore/south-parties.mjs'
import { SOUTH, SOUTH_NAMES } from './lore/south.mjs'
import { STYRIA_BILLS, STYRIA_COUNCILS, STYRIA_COURT, STYRIA_FACTIONS, STYRIA_ISSUES, STYRIA_NAMES, STYRIA_PARTIES } from './lore/styria.mjs'
import { southBodies } from './lore/south-power.mjs'
import { CLANS as FV_CLANS, FV_BILLS, FV_COUNCILS, FV_FACTIONS, FV_ISSUES, FV_NAMES, FV_PARTIES, FV_PEOPLE } from './lore/farvol.mjs'
import { CHURCH_BILLS, CHURCH_COUNCILS, CHURCH_FACTIONS, CHURCH_ISSUES, CHURCH_NAMES, CHURCH_PARTIES, CONTINENT_ARCHBISHOPS, HOLY_ARCHBISHOPS, ORDER_PEOPLE } from './lore/church.mjs'
import { HOUSES } from './lore/empire.mjs'
import { MINOR_HOUSES } from './lore/argus.mjs'
import { ASSEMBLY, CITY_COUNCILS, CITY_ELECTIONS, CLASS_AFFINITY, CLASS_MIX, CLASS_TURNOUT, DISTRICT_AFFINITY, FACTIONS, ISSUES, STRIKES, VOTE_CLASSES, WORKERS } from './lore/republic-power.mjs'

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
const LENDERS = ['семьи Каяя', 'графа Мангениум', 'Дома Морвинг', 'гильдии Хауссера']

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
    if (body.namer) return body.namer(m, first)
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
  return finish(body, members, convs, tpl, perYear)
}

// законы, поимённые голоса, хроника и итоговая запись — общие для всех собраний
function finish(body, members, convs, tpl, perYear, extra = {}) {
  const factions = body.factions
  const fIndex = new Map(factions.map((f, i) => [f.id, i]))
  const issues = body.issues.map((i) => i.id)
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
    members: members.map(({ female, left, ...m }) => {
      // портрет из scripts/deputy-portraits.mjs, если уже нарисован
      const key = depKey(body.id, m)
      const image = !m.entryId && existsSync(`resources/default-world/portraits/dep/${key}.webp`) ? `portraits/dep/${key}.webp` : ''
      return { ...m, left: left ?? '', gender: female ? 'Женский' : 'Мужской', ...(image ? { image } : {}) }
    }),
    bills: bills.map(({ seedv, ...b }) => b),
    chronicle,
    archive: (body.archive ?? []).map(([y, title, text]) => ({ date: D(y), title, text })),
    ...extra
  }
}

const empireLeg = build(COUNCIL, EMPIRE_TPL, [6, 9])
const senateLeg = build(SENATE, SENATE_TPL, [4, 6])

// ================= РЕСПУБЛИКА: выборы по весу голоса, округа, кабинеты, города, Совет рабочих =================
const repSt = world.states.find((s) => s.base.name === 'Республика')
const adminById = new Map(world.adminRegions.map((a) => [a.id, a]))
const regionOfP = (p) => adminById.get(adminById.get(p.areaId)?.parentId)?.name
const areaOfP = (p) => adminById.get(p.areaId)?.name
const ownerAt = (p, d) => {
  let o = null
  for (const [dd, s] of p.owners) if (dd == null || dd <= d) o = s
  return o
}
const POP = { village: 900, fishing: 700, temple: 500, castle: 1500, town: 5000, port: 12000, city: 22000, capital: 26000 }
const URBAN = new Set(['town', 'port', 'city', 'capital'])
const provPop = (p) => (p.name === 'Тиррит' ? POP.capital : POP[p.settlement?.type] ?? 600)
const romance = new Set(['Серелия', 'Ториния'])
const R_MEN = ['Лоренцо', 'Джакомо', 'Франческо', 'Маттео', 'Паоло', 'Бенедетто', 'Сандро', 'Витторио', 'Анджело', 'Риккардо', 'Томмазо', 'Энцо']
const R_WOMEN = ['Франческа', 'Лючия', 'Беатриче', 'Кьяра', 'Джованна', 'Серена']
const R_SURN = ['Бальди', 'Монтеверди', 'Росси', 'Кардуччи', 'Фальконе', 'Беллини', 'Орсини', 'Скала', 'Дориа', 'Ферретти', 'Галли', 'Морелли']
const NONHUMAN = [
  ['Дварф', ['Бранн', 'Гуннар', 'Торвальд', 'Хальдор', 'Дагни', 'Ингрид'], ['Кальдсон', 'Железнобров', 'Медник', 'Тяжёлая Рука', 'Корабел']],
  ['Гном', ['Фиццель', 'Тиббо', 'Нимма', 'Корвик', 'Пиппа'], ['Тикк', 'Шестерня', 'Винтель', 'Стрелочник']],
  ['Эльф', ['Аэлин', 'Таэрон', 'Ильвэ', 'Сериэн', 'Лаэрис'], ['Ветролист', 'из Новой Воли', 'Тихий Ручей', 'Сребролист']],
  ['Полуорк', ['Гром', 'Ургаш', 'Марга', 'Торк'], ['Шнайдер', 'Портовый', 'Крепкий', 'Рваное Ухо']],
  ['Человек (беглец из Короны Аргус)', ['Ашер', 'Йорам', 'Нурия', 'Самир'], ['Выкупленный', 'Беглый', 'из Новой Воли']]
]
const ORIGINS = {
  noble: () => ['Старая знать', 'noble'],
  money: () => [pick(['Банкир', 'Судовладелец', 'Купец первой гильдии', 'Фабрикант', 'Хозяин мануфактуры', 'Подрядчик армии']), 'money'],
  learned: () => [pick(['Стряпчий', 'Лекарь', 'Учитель', 'Нотариус', 'Профессор права', 'Аптекарь']), 'learned'],
  officer: () => [pick(['Капитан ополчения', 'Ветеран Освобождения, полковник', 'Офицер XI легиона в отставке', 'Офицер «Чаек» в отставке']), 'officer'],
  clergy: () => [pick(['Священник', 'Настоятель обители', 'Каноник собора', 'Епископ']), 'clergy'],
  worker: () => [pick(['Докер', 'Ткачиха', 'Кузнец', 'Плотник верфи', 'Батрак', 'Печатник', 'Солевар']), 'worker'],
  press: () => [pick(['Издатель', 'Журналист', 'Владелец типографии']), 'press'],
  owner: () => [pick(['Крестьянин-хозяин', 'Мельник', 'Лавочник']), 'owner'],
  nonhuman: () => ['', 'nonhuman']
}
const FAC_ORIGIN = {
  order: [['noble', 0.45], ['money', 0.2], ['learned', 0.25], ['officer', 0.1]],
  ledger: [['money', 0.85], ['noble', 0.15]],
  zemstvo: [['noble', 1]],
  flame: [['learned', 0.6], ['noble', 0.2], ['worker', 0.2]],
  people: [['noble', 0.3], ['learned', 0.55], ['owner', 0.15]],
  labor: [['worker', 1]],
  veterans: [['officer', 0.8], ['money', 0.2]],
  press: [['press', 0.7], ['learned', 0.3]],
  faith: [['clergy', 1]],
  peoples: [['nonhuman', 1]],
  harbor: [['money', 0.8], ['noble', 0.2]],
  unifiers: [['noble', 0.4], ['officer', 0.4], ['money', 0.2]]
}
const WORKER_ORIGIN = { docks: 'Докер', weavers: 'Ткачиха', peasants: 'Крестьянин общины', artisans: 'Подмастерье', radicals: 'Рабочий', moderates: 'Старшина цеха' }
const weighted = (list) => {
  let r = rnd()
  for (const [k, w] of list) if ((r -= w) <= 0) return k
  return list[list.length - 1][0]
}
// имя и происхождение депутата Республики
const nameRepublic = (m, first) => {
  if (m.faction in WORKER_ORIGIN) {
    m.name = `${first} ${surname()}`
    m.origin = WORKER_ORIGIN[m.faction]
    if (m.origin === 'Ткачиха' && !m.female) m.origin = 'Ткач'
    m.title = 'Делегат Совета'
    m.cls = 'worker'
    return
  }
  const kind = weighted(FAC_ORIGIN[m.faction] ?? [['learned', 1]])
  const [origin, cls] = ORIGINS[kind]()
  m.cls = cls
  m.origin = origin
  const south = romance.has(m.district)
  if (kind === 'nonhuman') {
    const [race, firsts, lasts] = pick(NONHUMAN)
    m.race = race
    m.name = `${pick(firsts)} ${pick(lasts)}`
    m.origin = race === 'Дварф' ? 'Мастер верфей' : race === 'Гном' ? 'Часовщик' : race === 'Эльф' ? 'Лекарь' : race === 'Полуорк' ? 'Бригадир докеров' : 'Вольный'
    m.female = ['Дагни', 'Ингрид', 'Нимма', 'Пиппа', 'Ильвэ', 'Сериэн', 'Марга', 'Нурия'].includes(m.name.split(' ')[0])
    return
  }
  if (kind === 'clergy') m.female = false
  const f = m.female ? (south ? pick(R_WOMEN) : pick(WOMEN)) : south ? pick(R_MEN) : first
  const sur = south ? pick(R_SURN) : surname()
  m.name = kind === 'noble' ? (south ? `${f} ди ${sur}` : `${f} фон ${sur}`) : `${f} ${sur}`
  if (kind === 'worker') m.origin += '; залог внесла касса Совета рабочих'
}
const TRAITS_RP = ['голосует за тех, кто платил его залог', 'держит в собрании газету и в газете — собрание', 'пережил Охоту в погребе и до сих пор говорит шёпотом', 'громок и любит длинные речи', 'молчит годами и голосует со своей скамьёй', 'должен банку Гольдах и не скрывает этого', 'дважды вызывался в ЧК «для беседы»', 'уважаем за честность и нелюбим за неё же', 'щедр на обещания избирателям', 'однажды подрался в зале с депутатом Огня', 'молод и честолюбив', 'стар, упрям и помнит Брандфельс']

// ---------- моделирование выборов ----------
function simulate(units, el, factions, seats, classes) {
  const fids = Object.keys(el.target)
  const weights = Object.fromEntries(classes.map(([id, , w977, w979]) => [id, el.system === '977' ? w977 : w979]))
  const mod = (u, c) => (el.incidents ?? []).filter(([d, , m]) => d === u.name && m?.[c]).reduce((s, [, , m]) => s * m[c], 1)
  const run = (base) => {
    const out = units.map((u) => {
      const votes = {}
      const heads = {}
      const turnout = {}
      const byClass = {}
      for (const c of Object.keys(u.voters)) {
        const n = u.voters[c] * Math.min(0.98, CLASS_TURNOUT[c] * mod(u, c))
        turnout[c] = Math.round((n / u.voters[c]) * 1000) / 1000
        const aff = fids.map((f) => base[f] * (CLASS_AFFINITY[c][f] ?? 1) * (DISTRICT_AFFINITY[u.name]?.[f] ?? 1) * (u.aff?.[f] ?? 1))
        const sum = aff.reduce((a, b) => a + b, 0)
        byClass[c] = {}
        fids.forEach((f, i) => {
          const h = (n * aff[i]) / sum
          heads[f] = (heads[f] ?? 0) + h
          votes[f] = (votes[f] ?? 0) + h * weights[c]
          byClass[c][f] = h
        })
      }
      return { votes, heads, turnout, byClass, weightTotal: Object.values(votes).reduce((a, b) => a + b, 0) }
    })
    // места округам — по весу голосов; внутри округа — по наибольшим остаткам
    const hare = (total, n, keys, val) => {
      const q = keys.map((k) => (val(k) / total) * n)
      const got = q.map(Math.floor)
      let left = n - got.reduce((a, b) => a + b, 0)
      const order = keys.map((k, i) => i).sort((a, b) => q[b] - got[b] - (q[a] - got[a]))
      for (const i of order) if (left-- > 0) got[i]++
      return Object.fromEntries(keys.map((k, i) => [k, got[i]]))
    }
    const W = out.reduce((s, o) => s + o.weightTotal, 0)
    const dSeats = units.length === 1 ? { 0: seats } : hare(W, seats, units.map((u, i) => i), (i) => out[i].weightTotal)
    out.forEach((o, i) => (o.seats = dSeats[i] ? hare(o.weightTotal, dSeats[i], fids, (f) => o.votes[f]) : Object.fromEntries(fids.map((f) => [f, 0]))))
    const total = Object.fromEntries(fids.map((f) => [f, out.reduce((s, o) => s + o.seats[f], 0)]))
    return { out, total, dSeats }
  }
  let base = Object.fromEntries(fids.map((f) => [f, Math.max(0.2, el.target[f])]))
  let best = null
  for (let k = 0; k < 80; k++) {
    const r = run(base)
    const err = fids.reduce((s, f) => s + Math.abs(r.total[f] - el.target[f]), 0)
    if (!best || err < best.err) best = { ...r, err, base: { ...base } }
    if (!err) break
    base = Object.fromEntries(fids.map((f) => [f, base[f] * ((el.target[f] + 0.4) / (r.total[f] + 0.4)) ** 0.6]))
  }
  return { ...best, weights, fids }
}

function electionRecord(units, el, sim, classes) {
  const round = (x) => Math.round(x)
  const districts = units.map((u, i) => {
    const o = sim.out[i]
    const winner = Object.entries(o.votes).sort((a, b) => b[1] - a[1])[0][0]
    return {
      name: u.name, seats: Object.values(o.seats).reduce((a, b) => a + b, 0), pts: u.pts,
      voters: Object.fromEntries(Object.entries(u.voters).map(([c, n]) => [c, round(n)])), turnout: o.turnout,
      votes: Object.fromEntries(Object.entries(o.votes).map(([f, v]) => [f, round(v)])),
      heads: Object.fromEntries(Object.entries(o.heads).map(([f, v]) => [f, round(v)])),
      seatsBy: o.seats, winner
    }
  })
  const classVotes = {}
  for (const [c] of classes) {
    const acc = {}
    sim.out.forEach((o) => { for (const [f, h] of Object.entries(o.byClass[c] ?? {})) acc[f] = (acc[f] ?? 0) + h })
    const sum = Object.values(acc).reduce((a, b) => a + b, 0) || 1
    classVotes[c] = Object.fromEntries(Object.entries(acc).map(([f, h]) => [f, Math.round((h / sum) * 1000) / 1000]))
  }
  const sumBy = (key) => Object.fromEntries(sim.fids.map((f) => [f, districts.reduce((s, d) => s + (d[key][f] ?? 0), 0)]))
  const voters = Object.fromEntries(classes.map(([c]) => [c, districts.reduce((s, d) => s + (d.voters[c] ?? 0), 0)]))
  const came = Object.fromEntries(classes.map(([c]) => [c, round(districts.reduce((s, d) => s + (d.voters[c] ?? 0) * (d.turnout[c] ?? 0), 0))]))
  return {
    date: D(el.year), name: el.name, system: el.system, constituent: !!el.constituent, note: el.note ?? '',
    classes: classes.map(([id, name, w977, w979, who]) => ({ id, name, weight: sim.weights[id], who })),
    districts, voters, came,
    total: { votes: sumBy('votes'), heads: sumBy('heads'), seats: sim.total },
    classVotes,
    incidents: (el.incidents ?? []).map(([district, text]) => ({ district, text }))
  }
}

// избирательные единицы: области Учредительного собрания (регионы, взятые к дате выборов) или округа нынешней Республики
const repProvs = world.provinces.filter((p) => p.state === repSt.id)
const unitsFor = (el) => {
  const groups = new Map()
  const list = el.constituent ? world.provinces.filter((p) => ownerAt(p, D(el.year)) === repSt.id) : repProvs
  for (const p of list) {
    const key = el.constituent ? regionOfP(p) : areaOfP(p)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }
  const growth = el.constituent ? 4.3 : 1 + 0.006 * (el.year - 979)
  return [...groups].map(([name, ps]) => {
    const voters = {}
    for (const p of ps) {
      const mix = URBAN.has(p.name === 'Тиррит' ? 'capital' : p.settlement?.type) ? CLASS_MIX.town : CLASS_MIX.land
      const n = provPop(p) * 0.32 * 8.2 * growth
      for (const [c, sh] of Object.entries(mix)) voters[c] = (voters[c] ?? 0) + n * sh
    }
    return { name, voters, pts: ps.map((p) => [p.x, p.y]) }
  })
}

// собрание с выборами по округам
function buildElected(body, tpl, perYear, unitsOf, opts = {}) {
  const factions = body.factions
  const fIndex = new Map(factions.map((f, i) => [f.id, i]))
  const members = []
  const mk = (f, district, from, extra = {}) => {
    const fac = factions[fIndex.get(f)]
    const m = {
      id: `${body.id}-m${members.length}`, name: '', entryId: '', faction: f, group: district, district, title: opts.title ?? 'Депутат собрания', origin: '',
      born: Math.floor(from) - 27 - Math.floor(rnd() * 36), from: D(from), to: null,
      stance: fac.stance.map((v) => Math.round(clamp(v + gauss() * 0.55, -2, 2) * 10) / 10), bio: '', female: rnd() < 0.2, ...extra
    }
    members.push(m)
    return m
  }
  const nameIt = (m) => {
    if (m.entryId) return
    if (opts.namer) return opts.namer(m)
    nameRepublic(m, pick(m.female ? WOMEN : MEN))
  }
  const named = new Set()
  for (const [eid, f, district, from, to, role] of body.named ?? []) {
    const e = entryById.get(eid)
    if (!e) continue
    const m = mk(f, district, from, { entryId: eid, name: e.base.name, title: role || e.base.title, origin: e.base.links?.dynasty ? (entryById.get(e.base.links.dynasty)?.base.name ?? '') : '' })
    m.born = e.from != null ? yearOf(e.from) : m.born
    m.female = e.base.props?.gender === 'Женский'
    m.to = to ? D(to) : e.to ?? null
    m.bio = e.base.summary || e.base.body.split('. ')[0] + '.'
    named.add(m.id)
  }
  const elections = []
  const convs = []
  const els = body.elections
  for (let ci = 0; ci < els.length; ci++) {
    const el = els[ci]
    const units = unitsOf(el)
    const sim = simulate(units, el, factions, body.seats, VOTE_CLASSES)
    const start = D(el.year + (opts.lag ?? 0.1))
    const end = els[ci + 1] ? D(els[ci + 1].year + (opts.lag ?? 0.1)) : D(1010.99)
    // люди из карточек должны сидеть там, где их записали: при нехватке мест забираем у самой большой фракции округа
    units.forEach((u, ui) => {
      const seatsBy = sim.out[ui].seats
      for (const f of Object.keys(seatsBy)) {
        const need = members.filter((m) => named.has(m.id) && m.faction === f && m.district === u.name && m.from < end && (m.to == null || m.to > start)).length
        while (seatsBy[f] < need) {
          const donor = Object.keys(seatsBy).filter((g) => g !== f).sort((a, b) => seatsBy[b] - seatsBy[a])[0]
          seatsBy[donor]--
          seatsBy[f]++
        }
      }
    })
    sim.total = Object.fromEntries(sim.fids.map((f) => [f, sim.out.reduce((s, o) => s + o.seats[f], 0)]))
    elections.push(electionRecord(units, el, sim, VOTE_CLASSES))
    convs.push({ year: el.year + (opts.lag ?? 0.1), name: opts.convName ? opts.convName(el, ci) : el.name.replace(/^Выборы в /, '').replace(/^(\S)/, (c) => c.toUpperCase()), note: el.note, seats: sim.total })
    const active = () => members.filter((m) => m.from <= start && (m.to == null || m.to > start))
    const unitNames = new Set(units.map((u) => u.name))
    for (const m of active()) {
      if (named.has(m.id)) continue
      // земли, которых больше нет в Республике: Эшландия и Веринландия переходят в округа
      if (!unitNames.has(m.district)) {
        const areas = units.filter((u) => regionOfP(world.provinces.find((p) => areaOfP(p) === u.name)) === m.district)
        const slot = areas.find((u) => (sim.out[units.indexOf(u)].seats[m.faction] ?? 0) > active().filter((x) => x.faction === m.faction && x.district === u.name).length)
        if (slot && rnd() < 0.8) m.district = m.group = slot.name
        else { m.to = start; continue }
      }
      if (ci > 0) {
        const age = Math.floor(el.year) - m.born
        if (rnd() < (age > 70 ? 0.6 : 0.2)) m.to = start
      }
    }
    units.forEach((u, ui) => {
      for (const f of factions.map((x) => x.id)) {
        const want = sim.out[ui].seats[f] ?? 0
        let have = active().filter((m) => m.faction === f && m.district === u.name)
        while (have.length > want) {
          const out = have.filter((m) => !named.has(m.id)).sort((a, b) => a.born - b.born)[0]
          if (!out) break
          out.to = start
          have = active().filter((m) => m.faction === f && m.district === u.name)
        }
        const later = members.filter((m) => named.has(m.id) && m.faction === f && m.district === u.name && m.from > start && m.from < end).length
        for (let k = have.length + later; k < want; k++) nameIt(mk(f, u.name, el.year + (opts.lag ?? 0.1)))
      }
    })
    opts.afterElection?.(el, members, start)
  }
  // смерти посреди созыва и довыборы
  for (const m of [...members]) {
    if (m.entryId) continue
    const death = m.born + 64 + Math.floor(rnd() * 22)
    if (death < 1011 && D(death) > m.from && (m.to == null || D(death) < m.to)) {
      const end = m.to
      m.to = D(death + rnd() * 0.9)
      m.left = 'умер'
      const r = mk(m.faction, m.district, yearOf(m.to) + 0.3)
      if (r.from >= (end ?? D(1010.99))) members.pop()
      else { r.to = end; nameIt(r) }
    }
  }
  const where = opts.where ?? 'собрании'
  for (const m of members) {
    if (!m.bio) {
      const yrs = `${yearOf(m.from)}${m.to ? `–${yearOf(m.to)}` : ''}`
      m.bio = `${m.origin}${m.race ? ` (${m.race.toLowerCase()})` : ''}, ${m.district}. В ${where} ${m.to ? `в ${yrs} гг.` : `с ${yearOf(m.from)} г.`}; ${pick(TRAITS_RP)}.`
    }
    if (m.to && !m.left) m.left = 'не переизбран'
  }
  const extra = { elections, ...(opts.extra?.(members) ?? {}) }
  const res = finish(body, members, convs, tpl, perYear, extra)
  // поля, которых нет у других собраний
  const byId = new Map(members.map((m) => [m.id, m]))
  for (const m of res.members) {
    const src = byId.get(m.id)
    m.district = src.district
    if (src.race) m.race = src.race
    if (src.cls) m.cls = src.cls
  }
  return res
}

// ---------- кабинеты министров ----------
const CHIEF_NAMES = { 'Кабинет Ауэрбаха': ['Ауэрбах', false], 'Кабинет Ленц': ['Ленц', true], 'Кабинет Ремера': ['Ремер', false], 'Кабинет Штерна': ['Штерн', false] }
function cabinetsOf(body, members) {
  const active = (m, d) => m.from <= d && (m.to == null || m.to > d)
  const out = []
  let prev = new Map()
  const chiefs = new Set()
  const first = D(body.from)
  for (const [from, to, name, chief, coalition, end] of body.cabinets) {
    const d = Math.max(D(from), first)
    const pool = members.filter((m) => active(m, d) && coalition.includes(m.faction) && !m.entryId)
    const used = new Set()
    const who = (m) => ({ memberId: m.id, entryId: m.entryId, name: m.name, faction: m.faction })
    let head
    if (chief.startsWith('lore-')) {
      const m = members.find((x) => x.entryId === chief && active(x, d))
      const e = entryById.get(chief)
      head = m ? who(m) : { memberId: '', entryId: chief, name: e?.base.name ?? '', faction: coalition[0] }
    } else {
      const m = pool.filter((x) => x.faction === chief && !chiefs.has(x.id)).sort((a, b) => a.from - b.from)[0] ?? pool[0]
      chiefs.add(m.id)
      const nm = CHIEF_NAMES[name]
      if (nm) {
        m.female = nm[1]
        const fn = pick(m.female ? WOMEN : MEN)
        m.name = m.cls === 'noble' ? `${fn} фон ${nm[0]}` : `${fn} ${nm[0]}`
        m.bio = `${m.origin}, ${m.district}. Первый министр (${Math.floor(from)}–${Math.floor(to)}). ${m.bio.split('; ').slice(-1)[0]}`
      }
      head = who(m)
    }
    if (head.memberId) used.add(head.memberId)
    const ministers = [{ post: 'Первый министр', ...head }]
    const cur = new Map([['Первый министр', head]])
    for (const post of body.posts.slice(1)) {
      if (post === 'Министр труда' && from < 1005.2) continue
      const fixed = body.fixedPosts.find(([p, , a, b]) => p === post && a <= from + 0.01 && (b == null || b > from + 0.01))
      let h
      if (fixed) {
        const m = members.find((x) => x.entryId === fixed[1] && active(x, d))
        h = m ? who(m) : { memberId: '', entryId: fixed[1], name: entryById.get(fixed[1])?.base.name ?? '', faction: '' }
      } else {
        const keep = prev.get(post)
        const km = keep?.memberId && members.find((x) => x.id === keep.memberId)
        if (km && active(km, d) && coalition.includes(km.faction) && !used.has(km.id) && rnd() < 0.55) h = who(km)
        else {
          const cand = pool.filter((m) => !used.has(m.id))
          const m = cand[Math.floor(rnd() * cand.length)]
          if (m) h = who(m)
        }
      }
      if (!h) continue
      if (h.memberId) used.add(h.memberId)
      ministers.push({ post, ...h })
      cur.set(post, h)
    }
    for (const f of body.fixedPosts.filter(([p]) => !body.posts.includes(p))) {
      if (f[2] <= from + 0.01 && (f[3] == null || f[3] > from + 0.01)) ministers.push({ post: f[0], memberId: '', entryId: f[1], name: entryById.get(f[1])?.base.name ?? '', faction: '' })
    }
    prev = cur
    out.push({ id: `${body.id}-cab${out.length}`, name, from: D(from), to: to ? D(to) : null, coalition, end, ministers })
  }
  return out
}

const RP_TOWNS = repProvs.filter((p) => p.settlement && URBAN.has(p.settlement.type)).map((p) => p.name).concat('Тиррит')
const BREAKAWAY = ['Магнолией', 'Королевством Темерия', 'Кулагоном', 'Протекторатом Лирия', 'Княжеством Харнмарк', 'Королевством Болетария', 'Рейхом', 'семьёй Каяя', 'Таварвайтом']
const RP_TPL = [
  (y) => ({ title: `Бюджет Республики на ${y} г.`, kind: 'бюджет', w: { money: 0.6, chancellor: 0.5 }, sponsor: 'order', summary: `Легионам и ополчению — ${28 + Math.floor(rnd() * 10)} частей из ста, долгу банку Гольдах — ${14 + Math.floor(rnd() * 8)}, Чрезвычайному комитету — ${3 + Math.floor(rnd() * 3)} (строка засекречена), школам — ${2 + Math.floor(rnd() * 4)}.`, yearly: true }),
  () => ({ title: `Подряд на ружья для ополчения`, kind: 'закон', w: { unity: 0.6, money: 0.6 }, sponsor: 'veterans', summary: `${2 + Math.floor(rnd() * 6)} тысяч ружей у Брандштеттеров — без торгов.` }),
  () => { const a = pick(RP_TOWNS), b = pick(RP_TOWNS); return { title: `Тракт ${a} — ${b}`, kind: 'закон', w: { money: 0.8, chancellor: 0.3 }, sponsor: 'order', summary: `Мощёный тракт между ${a} и ${b}; подряд — тому, кто дешевле, или тому, кто ближе к кабинету.` } },
  () => { const g = pick(['соль', 'хлеб', 'сукно', 'вино', 'железо', 'лес', 'пряности юга', 'имперское стекло']); const up = rnd() < 0.5; return { title: `${up ? 'Пошлина' : 'Снижение пошлины'} на ${g}`, kind: 'закон', w: { money: up ? -0.8 : 1.4, empire: up ? 0.6 : -0.4 }, sponsor: up ? 'veterans' : 'harbor', summary: up ? `Пошлина на ${g} поднята «против имперских товаров, идущих через Каяю».` : `Купцы гаваней выпросили снижение пошлины на ${g}.` } },
  () => { const c = pick(RP_TOWNS); return { title: `Школа для бедных в ${c}`, kind: 'закон', w: { money: -1.2, church: -0.4 }, sponsor: 'people', summary: `Казна платит учителям — по закону, а не по милости церкви.` } },
  () => ({ title: `Амнистия осуждённым трибуналом`, kind: 'резолюция', w: { empire: -1.4, chancellor: -0.4 }, sponsor: 'press', summary: `Пересмотр ${10 + Math.floor(rnd() * 90)} дел Народного трибунала 978 г.; живых среди осуждённых почти не осталось.` }),
  () => ({ title: `Запрос в Чрезвычайный комитет о деле ${pick(MEN)} ${surname()}`, kind: 'резолюция', w: { chancellor: -1.6 }, sponsor: pick(['press', 'labor', 'zemstvo']), summary: 'Депутаты требуют объяснить арест без суда. ЧК отвечает, что «дело засекречено в интересах Республики».' }),
  () => ({ title: `Высылка имперских агентов`, kind: 'указ', w: { empire: 1.6, chancellor: 0.6 }, sponsor: 'veterans', summary: `Чрезвычайный комитет просит одобрить высылку ${2 + Math.floor(rnd() * 9)} «купцов», оказавшихся агентами Империи.` }),
  () => ({ title: `Заём банка Гольдах`, kind: 'договор', w: { money: 1.6 }, sponsor: 'ledger', summary: `Казна занимает ${100 + Math.floor(rnd() * 400)} тысяч крон под залог пошлин гаваней.` }),
  () => ({ title: `Убежище беглецам из Короны Аргус`, kind: 'резолюция', w: { money: -0.4, empire: 0.4 }, sponsor: 'peoples', summary: `${40 + Math.floor(rnd() * 300)} беглых рабов из-за перевалов получают землю у Корельвейлера. Корона Аргус требует выдачи — отказано.` }),
  () => ({ title: `Пенсии ветеранам Освобождения`, kind: 'закон', w: { unity: 0.8, money: -0.6 }, sponsor: 'veterans', summary: 'Красные косы, «Каменные» и «Чайки» получают прибавку к пенсии.' }),
  () => ({ title: 'Десятина на храмы', kind: 'закон', w: { church: 1.8, money: -0.3 }, sponsor: 'faith', summary: 'Церковная скамья просит вернуть церковную десятину. Республика светская — но голоса нужны.' }),
  () => ({ title: `Концессия Фрахтам на ${pick(['маяк Хагау', 'новый мол Корельвейлера', 'лоцманскую службу Дальау', 'сухой док'])}`, kind: 'договор', w: { money: 1.4, empire: -0.4 }, sponsor: 'harbor', summary: 'На тридцать лет и с правом продления.' }),
  () => { const hard = rnd() < 0.6; return { title: 'Ответ на ноту Империи', kind: 'резолюция', w: { empire: hard ? 1.8 : -1.4 }, sponsor: hard ? 'unifiers' : 'harbor', summary: hard ? 'Собрание отвечает Хауссеру, что «узурпаторам узурпатора» ответа не будет.' : 'Собрание предлагает обмен пленными и купеческими судами.' } },
  () => { const s = pick(BREAKAWAY); return { title: `Соглашение с ${s}`, kind: 'договор', w: { unity: 1.5 }, sponsor: 'unifiers', summary: `Торговый и пограничный договор с ${s} — «нитка» к будущему объединению.` } },
  () => ({ title: 'Касса больных на мануфактурах', kind: 'закон', w: { money: -2 }, sponsor: pick(['labor', 'people']), summary: 'Хозяева мануфактур платят в кассу для больных и увечных.' }),
  () => ({ title: 'Повышение залога кандидата', kind: 'закон', w: { census: 1.8, money: 1 }, sponsor: 'ledger', summary: `Залог кандидата — ${600 + Math.floor(rnd() * 6) * 100} крон «для серьёзности выборов». Направлено против рабочих касс.` }),
  () => { const a = pick(DISTRICT_NAMES); return { title: `Земское собрание: ${a}`, kind: 'закон', w: { chancellor: -1.3 }, sponsor: 'zemstvo', summary: `Вернуть округу земское собрание, которому губернатор будет подотчётен.` } }
]
const DISTRICT_NAMES = [...new Set(repProvs.map(areaOfP))]

const CITY_TPL = [
  (y, t) => ({ title: `Городской бюджет ${t} на ${y} г.`, kind: 'бюджет', w: { money: 0.6 }, sponsor: 'order', summary: `Мостовые, стража, колодцы и долг банку Гольдах.`, yearly: true }),
  (y, t) => ({ title: `Мостовая на улице ${pick(['Ткачей', 'Канатной', 'Соляной', 'Декларации', 'Свободы', 'Старого рынка', 'Кожевников', 'Лоцманов'])}`, kind: 'закон', w: { money: 0.6 }, sponsor: pick(['order', 'ledger']), summary: 'Подряд на камень — родственнику председателя комиссии, как водится.' }),
  (y, t) => ({ title: `Рыночный сбор`, kind: 'закон', w: { money: 1.2 }, sponsor: 'ledger', summary: `Сбор с лотков на рынке ${t} — ${1 + Math.floor(rnd() * 4)} гроша в день.` }),
  (y, t) => ({ title: 'Ночная стража', kind: 'закон', w: { chancellor: 0.8 }, sponsor: 'order', summary: `${10 + Math.floor(rnd() * 40)} новых стражников и фонари на главных улицах.` }),
  (y, t) => ({ title: `Школа при ${pick(['ратуше', 'рынке', 'верфи', 'мануфактуре'])}`, kind: 'закон', w: { money: -1.2 }, sponsor: 'people', summary: 'Город платит учителю; родители платят дровами.' }),
  (y, t) => ({ title: 'Водовод и колодцы', kind: 'закон', w: { money: -0.4 }, sponsor: pick(['people', 'order']), summary: 'Новый водовод из холмов — после летней лихорадки.' }),
  (y, t) => ({ title: `Права цеха ${pick(['ткачей', 'кожевников', 'пекарей', 'бочаров', 'канатчиков', 'печатников'])}`, kind: 'закон', w: { money: 0.8, census: 0.4 }, sponsor: 'ledger', summary: 'Цех получает право не пускать в город чужих мастеров.' }),
  (y, t) => ({ title: 'Налог на кабаки', kind: 'закон', w: { money: -0.6, church: 0.8 }, sponsor: 'faith', summary: 'Каждый кабак платит городу и храму.' }),
  (y, t) => ({ title: 'Больница для бедных', kind: 'закон', w: { money: -1.5 }, sponsor: pick(['people', 'labor']), summary: 'Двадцать коек при обители — за счёт города.' }),
  (y, t) => ({ title: `Праздник Освобождения ${y} г.`, kind: 'резолюция', w: { empire: 1.2 }, sponsor: 'veterans', summary: 'Фейерверк, раздача хлеба и речь губернатора.' }),
  (y, t) => ({ title: 'Помощь семьям забастовщиков', kind: 'резолюция', w: { money: -2 }, sponsor: 'labor', summary: 'Город кормит семьи бастующих. Хозяева мануфактур против.' }),
  (y, t) => ({ title: 'Гаванский сбор', kind: 'закон', w: { money: 1.2 }, sponsor: 'harbor', summary: 'Сбор с каждого корабля у причала — на ремонт мола.', port: true }),
  (y, t) => ({ title: 'Аренда рыбных мест', kind: 'закон', w: { money: 1 }, sponsor: 'harbor', summary: 'Лучшие места у мола — с торгов.', port: true }),
  (y, t) => ({ title: `Ремонт моста №${1 + Math.floor(rnd() * 40)}`, kind: 'закон', w: { money: 0.5 }, sponsor: 'order', summary: 'Мостовой комитет просит денег — и обещает не закрывать мост в дни выборов.', korel: true })
]
const CITY_KEY = {
  'Корельвейлер': [[999.6, 'Мостовой устав', 'labor', 'принят', { chancellor: -1, census: -1 }, 'Ни один мост города не закрывается в дни выборов — даже «для ремонта». Принят через полгода после мостовых выборов; Лига Векселя голосует против.', 'закон'],
                   [1000.62, 'Поддержка Великой забастовки', 'labor', 'отклонён', { money: -2 }, 'Рабочие депутаты просят город кормить бастующих докеров. Отклонено; кормит касса Совета.', 'резолюция']],
  'Тиррит': [[1004.42, 'Помощь ткачам', 'labor', 'принят', { money: -2 }, 'Город раздаёт хлеб семьям бастующих ткачей — впервые против воли губернатора.', 'резолюция'],
             [981.4, 'Памятник Брандфельсу', 'veterans', 'принят', { empire: 1.5 }, 'На площади Декларации — камень с Красной горы.', 'резолюция']],
  'Эринберг': [[985.3, 'Архив Охоты', 'press', 'принят', { chancellor: -1, empire: -1 }, 'Город собирает имена казнённых в 978 г. Губернатор Нойман против — его имя тоже там, только в другой графе.', 'резолюция']],
  'Тирельлаге': [[1000.4, 'Деньги на пограничные форты', 'unifiers', 'принят', { unity: 2 }, 'Город доплачивает фортам на кальтранской границе из соляного сбора.', 'закон']],
  'Хагау': [[1000.25, 'Избрание бургомистра Фрахта', 'harbor', 'принят', { money: 1 }, 'Маячный совет избирает бургомистром очередного Фрахта — единогласно минус один.', 'выборы']],
  'Дальау': [[1008.72, 'Посредничество в лоцманской стачке', 'zemstvo', 'принят', { money: -0.5 }, 'Палата берёт на себя спор лоцманов и Фрахтов.', 'резолюция']],
  'Кирхфельд': [[987.21, 'Хлебные амбары под охрану ополчения', 'order', 'принят', { money: 1, chancellor: 1 }, 'За три дня до расстрела у амбаров.', 'закон']]
}
const WORKERS_TPL = [
  () => ({ title: 'Касса взаимопомощи', kind: 'резолюция', w: { strike: 0.5 }, sponsor: 'docks', summary: `Взнос — ${1 + Math.floor(rnd() * 3)} гроша в неделю; выплаты вдовам и увечным.` }),
  () => { const t = pick(RP_TOWNS); return { title: `Требования к хозяевам ${t}`, kind: 'требование', w: { strike: 1 }, sponsor: pick(['docks', 'weavers', 'artisans']), summary: 'Прибавка, укороченный день, отмена штрафов.' } },
  () => ({ title: 'Делегат к кабинету', kind: 'резолюция', w: { strike: -1.2, violence: -1 }, sponsor: 'moderates', summary: 'Отправить делегата на переговоры с первым министром.' }),
  () => ({ title: 'Школа для детей рабочих', kind: 'резолюция', w: { strike: -0.3 }, sponsor: 'weavers', summary: 'Вечерняя школа в пакгаузе — грамота, счёт и история Брандфельса.' }),
  () => ({ title: 'Помощь семьям арестованных', kind: 'резолюция', w: { violence: 0.4 }, sponsor: 'docks', summary: 'Арестованные ЧК делегаты получают из кассы свою долю.' }),
  () => ({ title: 'Земля общинам', kind: 'требование', w: { land: 2 }, sponsor: 'peasants', summary: 'Вернуть общинам земли эмигрантов, проданные после 979 г.' }),
  () => ({ title: 'Ответ на аресты', kind: 'резолюция', w: { violence: 1.6, strike: 1 }, sponsor: 'radicals', summary: 'Огненные предлагают ответить на аресты «как в 978-м».' })
]

// Совет рабочих: имена делегатов
WORKERS.namer = (m, first) => nameRepublic(m, first)

const assembly = buildElected(ASSEMBLY, RP_TPL, [5, 8], unitsFor, {
  extra: (members) => ({ cabinets: cabinetsOf(ASSEMBLY, members), head: { title: 'Канцлер', entryId: 'lore-rp-chancellor' } })
})
const cities = CITY_COUNCILS.map((c) => {
  const prov = world.provinces.find((p) => p.name === c.town)
  const slug = { 'Тиррит': 'tirrit', 'Корельвейлер': 'korel', 'Кирхфельд': 'kirch', 'Эринберг': 'erin', 'Тирельлаге': 'tirel', 'Дальау': 'dalau', 'Хагау': 'hagau' }[c.town]
  const fids = Object.keys(c.target)
  const strikes = STRIKES.filter((s) => s[2] === c.town)
  const years = {}
  for (const s of strikes) years[Math.floor(s[0])] = `${s[3]}. ${s[4]}`
  const elections = CITY_ELECTIONS.map((y, k) => {
    const target = { ...c.target }
    // рабочие и Великая Республика растут к концу века
    if (target.labor != null) target.labor = Math.max(0, Math.round(target.labor * (0.4 + k * 0.17)))
    if (target.unifiers != null) target.unifiers = Math.max(0, Math.round(target.unifiers * (0.3 + k * 0.2)))
    const sum = Object.values(target).reduce((a, b) => a + b, 0)
    target[fids[0]] += c.seats - sum
    const inc = c.town === 'Корельвейлер' && y > 1000 ? [[areaOfP(prov), 'На мостах в день выборов стоят пикеты Совета рабочих.', { common: 1.3 }]] : []
    return { year: y, name: `Городские выборы ${Math.floor(y)} г.`, system: '979', target, incidents: inc }
  })
  const body = {
    id: `rp-city-${slug}`, state: 'Республика', name: c.name, entryId: '', chairTitle: 'Бургомистр', seats: c.seats, from: CITY_ELECTIONS[0] + 0.05,
    seatOrder: ASSEMBLY.seatOrder.filter((f) => fids.includes(f)), groups: [],
    description: `${c.note} Заседает: ${c.hall}. ${c.seats} мест; выборы каждые четыре года по весу голоса; парламент избирает бургомистра.`,
    issues: ISSUES, factions: FACTIONS.filter((f) => fids.includes(f.id)).map((f) => ({ ...f, leader: '' })),
    elections, named: [], bills: CITY_KEY[c.town] ?? [], years
  }
  const tpl = CITY_TPL.filter((t) => { const g = t(0, c.town); return (!g.port || /port/.test(prov.settlement?.type ?? '')) && (!g.korel || c.town === 'Корельвейлер') }).map((t) => (y) => t(y, c.town))
  const unit = () => {
    const voters = {}
    const n = provPop(prov) * 0.32 * 8.2
    for (const [cl, sh] of Object.entries(CLASS_MIX.town)) voters[cl] = n * sh
    return [{ name: areaOfP(prov), voters, pts: [[prov.x, prov.y]] }]
  }
  const res = buildElected(body, tpl, [3, 5], unit, { title: 'Член городского парламента', where: 'городском парламенте', lag: 0.05 })
  return { ...res, town: c.town, provinceId: prov.id, hall: c.hall }
})
const workers = build(WORKERS, WORKERS_TPL, [2, 4])
workers.unofficial = true
workers.strikes = STRIKES.map(([from, to, town, title, text]) => ({ from: D(from), to: D(to), town, title, text }))

// ---------- южные республики: парламенты с цензом (голосуют знать и помещики) и рабочие комитеты ----------
const ORIGIN_SOUTH = {
  banks: ['Банкир', 'Меняла', 'Вкладчик банка Фальконьери'], merchants: ['Купец шёлка', 'Судовладелец', 'Виноторговец'], grandees: ['Помещик', 'Сеньор холмов', 'Граф внутренних земель'],
  liberals: ['Помещик, учившийся в Тиррите', 'Адвокат', 'Врач'], left: ['Сын помещика, отказавшийся от наследства', 'Учитель', 'Помещик-ренегат'], church: ['Епископ', 'Аббат', 'Каноник собора'],
  imperials: ['Отставной полковник', 'Бывший имперский чиновник', 'Помещик'], union: ['Помещик побережья', 'Консул', 'Граф'], harbors: ['Судовладелец', 'Консул гавани', 'Купец'],
  sword: ['Полковник', 'Майор', 'Помещик-офицер'], teria: ['Каноник Терии', 'Церковный помещик', 'Аббат'], harbor: ['Судовладелец', 'Виноторговец', 'Торговец пробкой'],
  captains: ['Капитан роты', 'Ветеран роты', 'Оружейник'], teachers: ['Учитель', 'Выпускник школы, помещик', 'Старший учитель'], clans: ['Старейшина клана', 'Хозяин табунов', 'Помещик гор']
}
const nameSouth = (culture) => (m) => {
  const N = SOUTH_NAMES[culture]
  if (['church', 'teria'].includes(m.faction) && rnd() < 0.7) m.female = false
  const f = pick(m.female ? N.women : N.men)
  const worker = ['loyal', 'local', 'radicals'].includes(m.faction)
  const noble = culture === 'romance' && !worker && rnd() < (['left', 'liberals'].includes(m.faction) ? 0.3 : 0.6)
  m.name = noble ? `${f} ${pick(N.noble)}` : `${f} ${pick(N.surnames)}`
  m.origin = pick(worker ? ['Грузчик', 'Ткач шёлка', 'Гребец', 'Рыбак', 'Конторщик', 'Оружейник', 'Батрак'] : ORIGIN_SOUTH[m.faction] ?? ['Помещик'])
  m.cls = worker ? 'worker' : noble ? 'noble' : 'owner'
}
const southState = new Map(SOUTH.map((s) => [s.key, world.states.find((x) => x.base.name === s.state)]))
const capitalArea = (s) => areaOfP(world.provinces.find((p) => p.name === s.capital))
const { parliaments: southParl, committees: southComm } = southBodies(D, capitalArea)
const southLegs = southParl.map(({ key, culture, body, head, tpl }) => {
  const st = southState.get(key)
  const unitsOf = (el) => {
    const groups = new Map()
    for (const p of world.provinces.filter((p) => ownerAt(p, D(el.year)) === st.id)) {
      const k = areaOfP(p)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(p)
    }
    return [...groups].map(([name, ps]) => {
      const voters = {}
      for (const p of ps) {
        const n = provPop(p) * 0.32 * 8.2
        const mix = URBAN.has(p.settlement?.type) ? CLASS_MIX.town : CLASS_MIX.land
        // ценз: знать и помещики (каждый восьмой хозяин), в Шеше — ещё офицеры и духовенство, в Тоскане с 1002 г. — купцы I гильдии
        voters.noble = (voters.noble ?? 0) + n * mix.noble
        voters.owner = (voters.owner ?? 0) + n * mix.owner * 0.12
        if (key === 'she') voters.learned = (voters.learned ?? 0) + n * mix.learned * 0.35
        if (key === 'tos' && el.year > 1002.3) voters.money = (voters.money ?? 0) + n * mix.money
      }
      return { name, voters, pts: ps.map((p) => [p.x, p.y]) }
    })
  }
  return buildElected(body, tpl, [3, 6], unitsOf, { namer: nameSouth(culture), title: `Член ${body.name === 'Синьория' ? 'Синьории' : body.name === 'Большой совет' ? 'Большого совета' : body.name === 'Сенат Меча' ? 'Сената Меча' : 'Совета кланов'}`, where: body.name === 'Синьория' ? 'Синьории' : 'парламенте', extra: () => ({ head }) })
})
const southCommittees = southComm.map((body, i) => {
  body.namer = nameSouth(southParl[i].culture)
  const r = build(body, WORKERS_TPL.map((t) => () => { const g = t(); g.sponsor = pick(['loyal', 'local', 'radicals']); g.w = { strike: g.w.strike ?? 0, violence: g.w.violence ?? 0 }; return g }), [1, 2])
  r.unofficial = true
  return r
})

// ---------- Святая церковь: Совет святых архиепископов ----------
const CHURCH_TITLES = { oramey: 'Епископ Престола', bodhi: 'Инквизитор Ордена Пламени', komosar: 'Приор госпиталя', magnus: 'Хранитель реликвий', argentu: 'Приор Звёздной стражи', amaterasu: 'Настоятель обители', yunona: 'Хранитель Свитка', order: 'Командор Святого ордена' }
const churchCouncil = build({
  id: 'ch-council', state: 'Святая церковь', name: 'Совет святых архиепископов', entryId: 'lore-ch-council', chairTitle: 'Святой отец', seats: 40, from: 958.4,
  seatOrder: ['amaterasu', 'komosar', 'argentu', 'oramey', 'yunona', 'magnus', 'bodhi', 'order'], groups: [],
  description: 'Сорок мест: двенадцать святых архиепископов (только они избирают папу), архиепископы материка (с 979 г.), Великий магистр и командоры Святого ордена, главы меньших орденов. Фракции — по богам Света. С Устава советов 1001 г. решения папы без Совета не действуют.',
  issues: CHURCH_ISSUES,
  factions: CHURCH_FACTIONS.map(([id, name, color, , ideology, stance]) => ({ id, name, color, ideology, stance, leader: '' })),
  convocations: CHURCH_COUNCILS.map(([year, name, seats, note]) => ({ year, name, seats, note })),
  named: [
    ...HOLY_ARCHBISHOPS.map(([id, , , born, title, fac]) => [`lore-${id}`, fac, 'Сантарея', Math.max(958.4, born + 46), null, title]),
    ...ORDER_PEOPLE.map(([id, , , born, title, fac]) => [`lore-${id}`, fac, 'Святой орден', Math.max(958.4, born + 40), null, title]),
    ...CONTINENT_ARCHBISHOPS.map(([id, , , arch]) => [`lore-${id}`, 'oramey', arch, 979.5, null, `Архиепископ: ${arch}`])
  ],
  bills: CHURCH_BILLS,
  years: { 958: 'Конклав: избран Целестин VI.', 976: 'Молчание престола; Святой орден на материке.', 979: 'Сожжения и учреждение архиепархий.', 1001: 'Устав советов: власть переходит к Совету.', 1010: 'Папе почти девяносто — все считают голоса.' },
  namer: (m) => {
    m.female = m.faction === 'order' && rnd() < 0.15
    m.name = `${pick(m.female ? CHURCH_NAMES.women : CHURCH_NAMES.men)} ${pick(CHURCH_NAMES.surnames)}`
    m.title = CHURCH_TITLES[m.faction] ?? 'Епископ'
    m.origin = m.faction === 'order' ? 'Святой орден' : pick(['Сантарея', 'Сакриэа', 'Фидора', 'Беатора', 'Пиения', 'Фидум'])
    m.cls = 'clergy'
  }
}, [
  // рядовые решения Совета (шаблоны должны быть разными: в год их до четырёх)
  () => ({ title: `Назначение епископа ${pick(['Сакриэа', 'Фидоры', 'Беаторы', 'Пиении', 'Корины', 'Мисеролии', 'Глореции'])}`, kind: 'булла', w: { pope: 0.5, continent: 0.5 }, sponsor: pick(['oramey', 'yunona']), summary: 'Каждая фракция предлагает своего человека.' }),
  () => ({ title: `Канонизация ${pick(CHURCH_NAMES.men)} ${pick(CHURCH_NAMES.surnames)}`, kind: 'булла', w: { pope: 0.3 }, sponsor: pick(['oramey', 'amaterasu', 'komosar']), summary: 'Новый святой — новые паломники и новые споры, чьему богу он служил.' }),
  () => ({ title: 'Отлучение еретика', kind: 'приговор', w: { crusade: 1.2 }, sponsor: 'bodhi', summary: 'Орден Пламени требует отлучить и выдать.' }),
  () => ({ title: 'Подать на паломников', kind: 'булла', w: { gold: 1.2 }, sponsor: pick(['argentu', 'oramey']), summary: 'Сбор с каждого паломника у причалов Сантареи.' }),
  () => ({ title: 'Займ в банке Акелаты', kind: 'булла', w: { gold: 0.8 }, sponsor: 'oramey', summary: 'Престол берёт в долг у Альбанелли под залог десятины архиепархий.' }),
  () => ({ title: 'Арсенал Святого ордена', kind: 'булла', w: { crusade: 0.8, gold: -0.5 }, sponsor: pick(['order', 'magnus']), summary: 'Новые клинки паладинам и ремонт замка Витора.' }),
  () => ({ title: 'Госпиталь Ордена Чаши', kind: 'булла', w: { gold: -0.8 }, sponsor: 'komosar', summary: 'Новый госпиталь — за счёт престола.' })
], [2, 4])
churchCouncil.head = { title: 'Святой отец', entryId: 'lore-pope-now' }

// ---------- Графство Штирия: Ночной совет ----------
const STYRIA_TITLES = { rodnya: 'Кровный родич дома', nemye: 'Старший немой', market: 'Мастер Ночного рынка', bank: 'Вексельщик', roty: 'Капитан вольной роты', kast: 'Кастелян' }
const styriaCouncil = build({
  id: 'sty-council', state: 'Графство Штирия', name: 'Ночной совет', entryId: 'lore-sty-council', chairTitle: 'Граф', seats: 36, from: 960.4,
  seatOrder: ['kast', 'roty', 'bank', 'market', 'nemye', 'rodnya'], groups: [],
  description: 'Тридцать шесть кресел при графе: родня, немые, рыночники, вексельщики, капитаны и кастеляны. Законы не принимает: подписывает указы графа и делит доли. Заседает только после заката. Придумано по поручению автора — черновик.',
  issues: STYRIA_ISSUES,
  factions: STYRIA_FACTIONS.map(([id, name, color, ideology, stance]) => ({ id, name, color, ideology, stance, leader: '' })),
  convocations: STYRIA_COUNCILS.map(([year, name, seats, note]) => ({ year, name, seats, note })),
  named: STYRIA_COURT.map(([id, , , born, title, fac]) => [`lore-${id}`, fac, 'Корбрук', Math.max(960.4, born + 30), null, title]),
  bills: STYRIA_BILLS,
  years: { 960: 'Смерть графа Августа, регентство Гизелы.', 966: 'Башня Корбрука: Конрад берёт власть.', 978: 'Купленная независимость.', 980: 'Вассальная грамота.', 992: 'Голод; прошение кастелянов отклонено.', 1010: 'Графу шестьдесят.' },
  namer: (m) => {
    const first = pick(m.female ? STYRIA_NAMES.women : STYRIA_NAMES.men)
    m.name = m.faction === 'rodnya' ? `${first} Штирийск${m.female ? 'ая' : 'ий'}` : m.faction === 'kast' ? `${first} фон ${pick(STYRIA_NAMES.noble)}` : `${first} ${pick(STYRIA_NAMES.surnames)}`
    m.title = STYRIA_TITLES[m.faction]
    m.origin = m.faction === 'rodnya' ? 'Дом Штирийский' : pick(['Корбрук', 'Брасрит', 'Росинберг', 'Эрхайм', 'Касинберг', 'Верлаге'])
  }
}, [
  () => ({ title: `Доля с ярмарки в ${pick(['Брасрите', 'Корбруке', 'Эрхайме'])}`, kind: 'указ', w: { market: 0.8 }, sponsor: 'market', summary: 'Спор о десятой части: кому и сколько.' }),
  () => ({ title: `Подать округа ${pick(['Брасхольм', 'Зонталь', 'Веренберг', 'Дальфельд', 'Эберлаге', 'Висберг'])}`, kind: 'указ', w: { levy: 1 }, sponsor: pick(['bank', 'rodnya']), summary: 'Ночная подать поднята: «в округе слишком спокойно».' }),
  () => ({ title: `Кредит атаману ${pick(STYRIA_NAMES.men)} ${pick(STYRIA_NAMES.surnames)}`, kind: 'указ', w: { rotes: 0.5, market: 0.4 }, sponsor: 'bank', summary: 'Сорок долей из ста от добычи.' }),
  () => ({ title: 'Синяя свеча для члена совета', kind: 'приговор', w: { count: 0.6, rites: 0.4 }, sponsor: 'nemye', summary: 'Палата записала одного из сидящих; кресло скоро освободится.' }),
  () => ({ title: 'Жалованье вольным ротам', kind: 'указ', w: { rotes: 1 }, sponsor: 'roty', summary: 'Капитаны напоминают, кто удержал перевалы.' }),
  () => ({ title: 'Обоз в Верхний скит', kind: 'тайное решение', w: { rites: 1 }, sponsor: pick(['nemye', 'rodnya']), summary: 'Ещё «работники». Вопросов нет.' }),
  () => ({ title: 'Посул в Хауссер', kind: 'указ', w: { vassal: 0.8 }, sponsor: pick(['rodnya', 'bank']), summary: 'Сколько стоит ещё год без ревизоров.' })
], [2, 4])
styriaCouncil.head = { title: 'Граф', entryId: 'lore-styria-now' }


// ---------- Фарвольская лига: Совет Свода (Палата Камня, Палата Шестерни, Скамья Поверхности) ----------
const FV_GROUP = Object.fromEntries(FV_FACTIONS.map(([id, , group]) => [id, group]))
const FV_TITLES = { old: 'Старейшина клана', shield: 'Сотник Глубинного Дозора', lamp: 'Выборный рудокопов', seal: 'Мастер Печати Железных', gear: 'Пайщик торгового дома', furrow: 'Выборный пахарей', surface: 'Барон Поверхности' }
const FV_IN = { 'fv-tibor': [985.3, 999.2], 'fv-fenwick': [992.3], 'fv-pippa': [978.2], 'fv-nimmo': [999.8], 'fv-bertha': [999.8], 'fv-baldrek': [978.2], 'fv-helga': [1006.3], 'fv-torgrim': [999.8], 'fv-otto': [992.3], 'fv-ingrid': [1008.3] }
const fvCouncil = build({
  id: 'fv-council', state: 'Фарвольская лига', name: 'Совет Свода', entryId: 'lore-fv-council', chairTitle: 'Первый Молот', seats: 61, from: 978.2,
  seatOrder: ['lamp', 'old', 'shield', 'surface', 'seal', 'gear', 'furrow'], groups: ['Палата Камня', 'Палата Шестерни', 'Скамья Поверхности'],
  description: 'Шестьдесят одно место: Палата Камня (кланы дварфов, места по щитам), Палата Шестерни (дома гномов, места по долям) и Скамья Поверхности (пять гербов имперской знати). Раз в семь лет Перепись Наковальни пересчитывает места двух больших палат. Большинство — 31; с 999 г. его нет ни у дварфов, ни у гномов. Придумано по поручению автора — черновик.',
  issues: FV_ISSUES,
  factions: FV_FACTIONS.map(([id, name, group, color, ideology, stance]) => ({ id, name, group, color, ideology, stance, leader: '' })),
  convocations: FV_COUNCILS.map(([year, name, seats, note]) => ({ year, name, seats, note })),
  named: FV_PEOPLE.filter(([id]) => FV_IN[id]).map(([id, , , , , , title, , fac]) => [`lore-${id}`, fac, FV_GROUP[fac], FV_IN[id][0], FV_IN[id][1] ?? null, title]),
  bills: FV_BILLS,
  years: { 978: 'Железная хартия: лига и Совет Свода.', 985: 'Смерть Ульдриха, Выбор Ортвина.', 992: 'Перевальная война.', 994: 'Тёмная неделя.', 999: 'Чёрный Свод; Перепись 28 на 28.', 1002: 'Выбор Гилдартса и Зонгауская уступка.', 1004: 'Неделя без печатей и Насосный мир.', 1006: 'Шестерня впервые больше Камня.', 1010: 'До Переписи 1013 года — три года.' },
  namer: (m) => {
    const dw = ['old', 'shield', 'lamp'].includes(m.faction), hu = m.faction === 'surface'
    const first = pick(hu ? (m.female ? FV_NAMES.humanWomen : FV_NAMES.humanMen) : dw ? (m.female ? FV_NAMES.dwarfWomen : FV_NAMES.dwarfMen) : (m.female ? FV_NAMES.gnomeWomen : FV_NAMES.gnomeMen))
    const clan = pick(FV_CLANS)[1].replace('Клан ', '')
    m.name = hu ? `${first} фон ${pick(FV_NAMES.humanNoble)}` : dw ? `${first} из клана ${clan}` : `${first} ${pick(FV_NAMES.gnomeHouses)}`
    m.title = FV_TITLES[m.faction]
    m.origin = hu ? pick(['Зонгау', 'Фьялская земля']) : dw ? `Клан ${clan}` : pick(['Грунский хребет', 'Норг-Бад', 'Барак-Ази', 'Эрен-Грим'])
  }
}, [
  () => ({ title: `Подать Глубинному Дозору на ${pick(['Нижние врата', 'заставы Кхаз-Гунда', 'заставы Гронд-Гунда', 'новые щиты'])}`, kind: 'закон', w: { depth: 1.2, count: -0.3 }, sponsor: pick(['shield', 'old']), summary: 'Дозор просит денег; Шестерня спрашивает, почему опять.' }),
  () => ({ title: `Печать на ${pick(['паровой подъёмник', 'новую лампу Глиммеров', 'часовой замок', 'рудодробилку', 'насос малых штолен'])}`, kind: 'указ', w: { count: 0.6, gates: 0.3 }, sponsor: pick(['gear', 'seal']), summary: 'Палата Печатей записывает изобретение; дом получит долю с каждого применения.' }),
  () => ({ title: `Пошлина ${pick(['Фьяльских', 'Зонгауских', 'Гарефордских'])} ворот`, kind: 'закон', w: { gates: rnd() < 0.5 ? 1.2 : -1.2, surface: 0.4 }, sponsor: pick(['gear', 'surface', 'old']), summary: 'Спор о том, сколько платит чужая повозка на тиббальдовых весах.' }),
  () => ({ title: `Шахтный долг рудокопов ${pick(['Кхаза', 'Гронда', 'нижних ярусов Норга', 'Азга'])}`, kind: 'закон', w: { debt: rnd() < 0.5 ? 1 : -1 }, sponsor: pick(['lamp', 'old']), summary: 'Сколько лет отрабатывать броню и место в чертоге.' }),
  () => ({ title: `Аренда пашни ${pick(['Зонгау', 'Фьялской земли', 'Грунских террас'])}`, kind: 'закон', w: { surface: 0.8, debt: 0.3 }, sponsor: pick(['surface', 'furrow']), summary: 'Люди Поверхности поднимают аренду; Борозда требует её заморозить.' }),
  () => ({ title: `Привратная грамота для ${pick(['аргусских купцов', 'штирийских возчиков', 'гарефордских плотогонов', 'северных нордов'])}`, kind: 'указ', w: { gates: 1 }, sponsor: pick(['gear', 'surface']), summary: 'Пускать ли чужих дальше ярмарки.' }),
  () => ({ title: `Ремонт сводов ${pick(['Норг-Бада', 'Азг-Кара', 'Торзума', 'Дургн-Адума', 'Грондгунда'])}`, kind: 'закон', w: { depth: 0.5, hammer: 0.3 }, sponsor: pick(['shield', 'seal']), summary: 'Торы просят камня и денег; казна просит подождать.' })
], [2, 4])
fvCouncil.head = { title: 'Первый Молот', entryId: 'lore-fv-gildarts' }

world.legislatures = [empireLeg, senateLeg, assembly, workers, ...cities, ...southLegs, ...southCommittees, churchCouncil, styriaCouncil, fvCouncil]
// история, манифест и устройство партий (городские парламенты берут партии Народного собрания)
for (const L of world.legislatures) {
  const lore = PARTIES[L.id] ?? SOUTH_PARTIES[L.id] ?? (L.id === 'ch-council' ? CHURCH_PARTIES : L.id === 'sty-council' ? STYRIA_PARTIES : L.id === 'fv-council' ? FV_PARTIES : null)
  const ids = new Set(L.factions.map((f) => f.id))
  if (lore) for (const f of L.factions) if (lore[f.id]) f.party = { ...lore[f.id], allies: (lore[f.id].allies ?? []).filter((x) => ids.has(x)), rivals: (lore[f.id].rivals ?? []).filter((x) => ids.has(x)), draft: true }
}
// OUT — пробный прогон в другой файл, пока мир занят (например, рисуются портреты)
writeFileSync(process.env.OUT ?? WORLD, JSON.stringify(world, null, 1))
for (const l of world.legislatures) {
  const now = l.members.filter((m) => m.to == null && m.from <= D(1010.5))
  console.log(`${l.name}: членов за всё время ${l.members.length}, сейчас ${now.length}, законов ${l.bills.length}, лет хроники ${l.chronicle.length}`)
}
