// Решения власти (docs/впи-армия.md § 13): подати, набор и сбор, меры по войску, ревизия, устав, война —
// проходят через систему власти страны. Порядок решений: собрание с голосованием, свой механизм власти,
// совет, сход или указ правителя. Приложение считает прогноз, исход утверждает мастер; решение вступает в силу с даты.
import { MEASURES } from './armyLedger'
import type { Measure, MeasureKind } from './military'
import type { Role } from './economy'
import type { Legislature, WorldData, WorldDate, WorldState } from './types'

export type Topic = 'tax' | 'levy' | 'budget' | 'audit' | 'rearm' | 'war'
export const TOPICS: Record<Topic, { name: string; icon: string }> = {
  tax: { name: 'Подати', icon: '💰' },
  levy: { name: 'Набор и уровень сбора', icon: '📯' },
  budget: { name: 'Бюджет войска и меры', icon: '⚖' },
  audit: { name: 'Ревизия', icon: '🔍' },
  rearm: { name: 'Устав и перевооружение', icon: '⚒' },
  war: { name: 'Война и мир', icon: '⚔' }
}
export type Act =
  | { kind: 'measure'; measure: MeasureKind; scope?: string[] }
  | { kind: 'tax'; role: Role; level: string }
  | { kind: 'level'; level: string }
  | { kind: 'text'; text: string }
export interface Decision {
  id: string
  topic: Topic
  title: string
  act: Act
  /** внесено */
  proposed: WorldDate
  /** решится и вступит в силу */
  due: WorldDate
  body: string
  status: 'внесено' | 'принято' | 'отклонено'
  /** прогноз на момент внесения — словами */
  forecast?: string
  note?: string
  /** указ прошёл, но встретил сопротивление (ропот, саботаж, отказ знати) — что именно, решает мастер */
  resisted?: boolean
}

export type BodyKind = 'vote' | 'mechanism' | 'council' | 'assembly' | 'decree'
export interface Body { name: string; kind: BodyKind; how: string; days: number; legislatureId?: string; organId?: string }
const KIND_WORD: Record<BodyKind, string> = { vote: 'голосование собрания', mechanism: 'свой порядок власти', council: 'совет', assembly: 'сход', decree: 'указ' }
export const kindWord = (k: BodyKind): string => KIND_WORD[k]

/** как решают страны Лоры со своими механизмами власти (остальные — по строю) */
const LORE: Record<string, Partial<Body> & { rearm?: string; war?: string; slow?: number }> = {
  'Имперские Изгнанники': { name: 'Сабельная ставка', kind: 'mechanism', how: 'генералы голосуют саблями: голос равен числу сабель; урезать войско — значит урезать свои голоса', days: 10 },
  'Креит': { name: 'Выводок и Слушающие', kind: 'mechanism', how: 'решает ярл из выживших детей; Слушающие передают волю жилы — против Выводка идти опасно', days: 8 },
  'Земли Севера': { name: 'Каменный круг (Альтинг)', kind: 'assembly', how: 'Седые выбирают, сила решает: на Альтинге решение принимают кланы, против конунга — три камня Седых', days: 30 },
  'Фарвольская лига': { name: 'Совет Свода и Первый Молот', kind: 'mechanism', how: 'Весы Свода: места пересчитаны Переписью Наковальни; Первый Молот предлагает, Свод взвешивает', days: 20 },
  'Высокогорное Княжество': { name: 'Совет Венца', kind: 'mechanism', how: 'голос дома весит столько саженей, на какой высоте его очаг; верхние дома решают за нижних', days: 15 },
  'Республика Чеафарал': { name: 'Совет Двадцати', kind: 'mechanism', how: 'Гербы, Соль, Счёт и Хоругви по пять мест; решение — 11 белых шаров из 20', days: 15 },
  'Крайдонианская Лига': { name: 'Рейд', kind: 'mechanism', how: 'два ветра: 16 из 31 флага Коллегии и 251 из 500 вымпелов', days: 20 },
  'Княжества Гарефорда': { name: 'Круг Светоча', kind: 'mechanism', how: 'решает Светочедержец круга на три года; шесть свечей могут его отвести', days: 15 },
  'Королевство Темерия': { name: 'Совет Пяти Ключей', kind: 'mechanism', how: 'указ — три ключа из пяти, война — четыре', days: 7, war: 'четыре ключа из пяти' },
  'Протекторат Лирия': { name: 'Сбор Сотен', kind: 'mechanism', how: 'закон — 16 Сотен из 30, война — 20', days: 15, war: '20 Сотен из 30' },
  'Княжество Харнмарк': { name: 'Княжеский двор и Разрядная книга', kind: 'mechanism', how: 'князь решает с Домами по местам; обиженный Дом не служит, пока Разрядный суд не рассудит', days: 12 },
  'Кулагон': { name: 'Совет Семи Бродов', kind: 'mechanism', how: 'семь Бродовых Домов; треть черепков вольных может изгнать любого', days: 12 },
  'Когалым': { name: 'Сельский сбор', kind: 'assembly', how: 'шестьдесят Достойных тянут Воз; если груз тяжелее тянущих — Воз встаёт и созывается Общий Сход', days: 20 },
  'Уунааш': { name: 'Совет Ворот', kind: 'mechanism', how: 'владетели сильны дворами из Книги Дымов; в День Ворот двор может уйти', days: 15 },
  'Королевство Редания': { name: 'Мостовые и король', kind: 'mechanism', how: 'пять Мостовых могут закрыть переправу — Мостовое вето', days: 10 },
  'Империя Кагия': { name: 'Ворота Торга', kind: 'mechanism', how: 'трон куплен у Багряной гвардии: всё, что задевает гвардию, решается деньгами на копьё', days: 10 },
  'Королевство Болетария': { name: 'Король и Свод Предков', kind: 'decree', how: 'живой король неподсуден, но законы мёртвых королей отменяет только Пепельный суд', days: 5 },
  'Таварвайт': { name: 'Король и держатели паёв', kind: 'mechanism', how: 'пока у короля 51 пай — указ; ниже — указ скрепляет кредитор', days: 7 },
  'Семья Каяя': { name: 'Сто Долей', kind: 'mechanism', how: 'решает держатель большинства Долей; Доли переходят только в Ночь Карт', days: 5 },
  'Павильон Грёз': { name: 'Хранитель и Ревизор', kind: 'mechanism', how: 'два ключа: от двадцати слитков нужна подпись Ревизора', days: 7 },
  'Олекохт': { name: 'Эрэдам и Совет Сфер', kind: 'decree', how: 'воля Эрэдама; раз в год Ясный день — Белая нить может его остановить', days: 5 },
  'Магнолия': { name: 'Трон и пять каст', kind: 'decree', how: 'трон только Чистым; касты ниже голоса не имеют', days: 5 },
  'Рейх': { name: 'Круг Клейм', kind: 'assembly', how: 'правит род с самым долгим сроком; всё общее — решают у общего котла', days: 10 },
  'Династия Креццака': { name: 'Совет Матерей', kind: 'council', how: 'князя называет Старшая Мать; Совет Матерей старше шестидесяти', days: 10 },
  'Фейноко': { name: 'Гряда Великанов', kind: 'mechanism', how: 'государь абсолютен, пока на Гряде не меньше 6 из 9 камней племён', days: 10 },
  'Северная Башня': { name: 'Коллегия', kind: 'council', how: 'Магистр по баллам Великого испытания; Коллегия утверждает', days: 10 },
  'Обливиум Каэлорум': { name: 'Капитул молчащих', kind: 'council', how: 'голос приора весит годы молчания', days: 20 },
  'Братство Бездны': { name: 'Колодец и Лестница', kind: 'council', how: 'Магистр — старший по стажу набора; Устав Колодца', days: 10 },
  'Ла Роше': { name: 'Два ключа', kind: 'mechanism', how: 'указ сестёр скрепляют архиепископ Бувезеоны и Дом Каяя', days: 15 },
  'Графство Мангениум': { name: 'Граф и Совет Десяти', kind: 'council', how: 'граф решает с Советом Десяти; старый кодекс без поправок', days: 7 }
}

/** главная законодательная палата страны (не городская и не подпольная) */
export function mainLegislature(world: WorldData, st: WorldState): Legislature | undefined {
  return (world.legislatures ?? []).filter((l) => l.stateId === st.id && !l.town && !l.unofficial).sort((a, b) => b.seats - a.seats)[0]
}

/** порядок решений страны: какой орган решает каждый род вопросов */
export function decideProfile(world: WorldData, st: WorldState): Record<Topic, Body> {
  const g = st.base.government ?? ''
  const lore = LORE[st.base.name]
  const leg = mainLegislature(world, st)
  let main: Body
  if (leg) main = { name: leg.name, kind: 'vote', how: `голосуют ${leg.seats} мест; позиции фракций по вопросам собрания`, days: 20, legislatureId: leg.id }
  else if (lore) main = { name: lore.name!, kind: lore.kind!, how: lore.how!, days: lore.days ?? 12 }
  else if (/церк|архиеп|епарх|орден|капитул|теократ/i.test(g)) main = { name: 'Святой совет', kind: 'council', how: 'глава церкви решает с канониками и командором ордена', days: 10 }
  else if (/клан|орд[аы]|племен|вожд|каган/i.test(g)) main = { name: 'Сход вождей', kind: 'assembly', how: 'вожди собираются на сход; сильнейший говорит первым', days: 20 }
  else if (/республ|лига|союз|коммун|общин|вольн|полис|город/i.test(g)) main = { name: 'Собрание', kind: 'assembly', how: 'выборные решают большинством', days: 20 }
  else main = { name: st.base.rulerTitle ? `Указ: ${st.base.rulerTitle.toLowerCase()}` : 'Указ правителя', kind: 'decree', how: 'правитель решает указом с советом знати; задетые сословия отвечают недовольством', days: 3 }
  const army: Body = /ставк|воен|генерал|меч/i.test(g) || main.kind === 'vote'
    ? { name: 'Военачальники', kind: 'decree', how: 'устав и перевооружение утверждают полководцы', days: 5 }
    : { name: 'Полководец', kind: 'decree', how: 'устав утверждает главный военачальник', days: 5 }
  const war: Body = lore?.war ? { ...main, how: lore.war } : main
  return { tax: main, levy: main, budget: main, audit: main, rearm: army, war }
}

// ---------- прогноз ----------
const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0)
/** направление решения по оси: на армию, на казну и подати, на реформу (ревизия) */
function direction(d: Decision): { army: number; money: number; reform: number; foreign: number } {
  const a = d.act
  if (a.kind === 'measure') {
    if (a.measure === 'audit') return { army: -0.4, money: 0, reform: 1, foreign: 0 }
    if (a.measure === 'scutage') return { army: -0.5, money: 0.6, reform: 0, foreign: 0 }
    return { army: -1, money: 0.3, reform: 0, foreign: 0 }
  }
  if (a.kind === 'tax') { const up = ['тяжёлые', 'разорительные'].includes(a.level); return { army: 0, money: up ? 1 : -1, reform: up ? -0.3 : 0.3, foreign: 0 } }
  if (a.kind === 'level') { const up = ['сбор', 'великий сбор', 'всеобщий призыв'].includes(a.level); return { army: up ? 1 : -1, money: 0, reform: 0, foreign: up ? 0.5 : -0.3 } }
  if (d.topic === 'war') return { army: 0.6, money: 0, reform: 0, foreign: 1 }
  return { army: 0, money: 0, reform: 0, foreign: 0 }
}
const AXES: [keyof ReturnType<typeof direction>, RegExp, RegExp][] = [
  // ось, слова вопроса, слова той стороны, что «за» (знак +)
  ['army', /арм|войск|полк|рот[аы]?\b|ополч|меч|сабл|хоругв|levy|army/i, /арми|войск|сил|рот|меч|набор/i],
  ['money', /налог|подат|казн|пошлин|деньг|долг|торгов|money|debt|trade|market/i, /казн|пошлин|налог|подат|сбор/i],
  ['reform', /реформ|прав|закон|школ|земств|reform/i, /прав|реформ|школ|земств/i],
  ['foreign', /сосед|войн|империи|крестов|foreign|crusade/i, /жёстк|войн|поход|крестов/i]
]
/** вес решения по вопросам собрания */
function weights(leg: Legislature, d: Decision): { w: number[]; main: boolean } {
  const dir = direction(d)
  const mainAx = (Object.entries(dir) as [string, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0]
  let main = false
  const w = leg.issues.map((iss) => {
    const text = `${iss.id} ${iss.name} ${iss.minus} ${iss.plus}`
    for (const [ax, re, plusRe] of AXES) if (re.test(text)) { if (ax === mainAx && dir[ax]) main = true; const s = plusRe.test(iss.plus) ? 1 : plusRe.test(iss.minus) ? -1 : 1; return dir[ax] * s }
    return 0
  })
  return { w, main }
}

export interface Forecast { chance: number; word: string; decree?: boolean; yes?: number; no?: number; abstain?: number; text: string; against: string[] }
const word = (c: number): string => (c >= 0.75 ? 'почти наверняка пройдёт' : c >= 0.55 ? 'скорее пройдёт' : c >= 0.4 ? 'спорно' : c >= 0.2 ? 'скорее провалится' : 'почти наверняка провалится')

const decreeWord = (c: number): string => (c >= 0.75 ? 'пройдёт тихо' : c >= 0.55 ? 'пройдёт, возможен ропот' : c >= 0.35 ? 'пройдёт, но жди сопротивления' : 'пройдёт, будет саботаж или бунт')

export function forecast(world: WorldData, st: WorldState, d: Decision, date: WorldDate): Forecast {
  const body = decideProfile(world, st)[d.topic]
  const against: string[] = []
  const a = d.act
  if (a.kind === 'measure') {
    if (a.measure === 'audit') against.push(st.base.military?.graft?.who ?? 'интенданты')
    if (a.measure === 'settle' || a.measure === 'scutage') against.push(st.base.econ?.estates?.rulers ?? 'знать')
    if (a.measure === 'billet' || a.measure === 'provincial') against.push(st.base.econ?.estates?.feeders ?? 'кормильцы')
    if (a.measure === 'staffcut' || a.measure === 'settle') against.push('военачальники')
  }
  if (a.kind === 'tax' && ['тяжёлые', 'разорительные'].includes(a.level)) against.push(st.base.econ?.estates?.[a.role] ?? a.role)
  if (a.kind === 'level' && a.level !== 'мир') against.push(st.base.econ?.estates?.feeders ?? 'кормильцы')

  if (body.kind === 'vote' && body.legislatureId) {
    const leg = (world.legislatures ?? []).find((l) => l.id === body.legislatureId)!
    const { w, main } = weights(leg, d)
    if (main) {
    const norm = Math.sqrt(sum(w.map((x) => x * x))) || 1
    let yes = 0, no = 0, ab = 0
    for (const m of leg.members) {
      if (m.from > date || (m.to != null && m.to <= date)) continue
      const v = sum(w.map((x, i) => x * (m.stance?.[i] ?? 0))) / norm
      if (v > 0.2) yes++; else if (v < -0.2) no++; else ab++
    }
    if (yes + no + ab === 0) return { chance: 0.5, word: 'спорно', text: `${body.name}: нет состава на эту дату`, against }
    const margin = (yes - no) / Math.max(1, yes + no + ab)
    const chance = Math.max(0.03, Math.min(0.97, 0.5 + margin * 2.2))
    // фракции против
    const facs = new Map<string, number>()
    for (const m of leg.members) { if (m.from > date || (m.to != null && m.to <= date)) continue; const v = sum(w.map((x, i) => x * (m.stance?.[i] ?? 0))) / norm; if (v < -0.2) facs.set(m.faction, (facs.get(m.faction) ?? 0) + 1) }
    for (const [fid] of [...facs].sort((x, y) => y[1] - x[1]).slice(0, 2)) { const f = leg.factions.find((x) => x.id === fid); if (f) against.push(f.name) }
    return { chance, word: word(chance), yes, no, abstain: ab, text: `${body.name}: за ${yes}, против ${no}, воздержатся ${ab}`, against: [...new Set(against)] }
    }
    // такого вопроса в собрании нет — решают по настроению палаты (ниже), голоса не считаются
  }
  const base: Record<BodyKind, number> = { vote: 0.5, mechanism: 0.55, council: 0.62, assembly: 0.5, decree: 0.88 }
  let c = base[body.kind] + ((typeof st.base.stability === 'number' ? st.base.stability : 50) - 50) / 250
  const dir = direction(d)
  if (a.kind === 'measure' && a.measure === 'audit') c -= 0.1 + (st.base.military?.graft?.rate ?? 0.1)
  if (dir.money > 0.5 && a.kind === 'tax') c -= 0.15
  if (dir.army < 0 && /ставк|воен|генерал|меч|гвард/i.test(`${st.base.government} ${body.name}`)) c -= 0.25
  if (a.kind === 'level' && dir.army > 0) c -= 0.08
  if (d.topic === 'war') c -= 0.1
  c = Math.max(0.05, Math.min(0.95, c))
  // указ правитель отдаёт сам — он проходит всегда; шанс здесь — шанс обойтись без сопротивления
  if (body.kind === 'decree') return { chance: c, decree: true, word: decreeWord(c), text: `${body.name} — ${kindWord(body.kind)}: ${body.how}. Указ пройдёт; шанс — что без сопротивления`, against: [...new Set(against)] }
  return { chance: c, word: word(c), text: `${body.name} — ${kindWord(body.kind)}: ${body.how}`, against: [...new Set(against)] }
}

// ---------- действие принятых решений на дату ----------
const accepted = (st: WorldState, date: WorldDate): Decision[] => (st.base.decisions ?? []).filter((d) => d.status === 'принято' && d.due <= date).sort((a, b) => a.due - b.due)
/** меры по войску из принятых решений — с даты вступления */
export function decisionMeasures(st: WorldState): Measure[] {
  return (st.base.decisions ?? []).filter((d) => d.status === 'принято' && d.act.kind === 'measure').map((d) => ({ id: `d-${d.id}`, kind: (d.act as { measure: MeasureKind }).measure, from: d.due, scope: (d.act as { scope?: string[] }).scope, note: d.title }))
}
/** ставки податей на дату: исходные + принятые решения */
export function taxesAt(st: WorldState, date: WorldDate) {
  const t = { ...(st.base.econ?.taxes ?? {}) }
  for (const d of accepted(st, date)) if (d.act.kind === 'tax') t[d.act.role] = d.act.level as (typeof t)[Role]
  return t
}
/** уровень сбора на дату */
export function levelAt(st: WorldState, date: WorldDate): string {
  let l: string = st.base.military?.law.level ?? 'мир'
  for (const d of accepted(st, date)) if (d.act.kind === 'level') l = d.act.level
  return l
}

/** заголовок решения по действию */
export function actTitle(a: Act, st: WorldState, fName: (id: string) => string): string {
  if (a.kind === 'measure') return `${MEASURES[a.measure].name}${a.scope?.length ? `: ${a.scope.map(fName).join(', ')}` : ''}`
  if (a.kind === 'tax') return `Подати для «${st.base.econ?.estates?.[a.role] ?? a.role}» — ${a.level}`
  if (a.kind === 'level') return `Уровень сбора — ${a.level}`
  return a.text
}

/** распоряжение мастера / указ с даты: принятое решение (прошлое не меняется); st — черновик */
export function decreeAt(st: WorldState, act: Act, date: WorldDate, body = 'распоряжение мастера'): void {
  const d = (st.base.decisions ??= [])
  // то же распоряжение в тот же день — заменить
  const same = d.findIndex((x) => x.status === 'принято' && x.due === date && x.proposed === date && x.act.kind === act.kind && (act.kind !== 'tax' || (x.act as { role?: string }).role === act.role))
  const rec: Decision = { id: `d${Date.now().toString(36)}`, topic: act.kind === 'level' ? 'levy' : 'tax', title: actTitle(act, st, (x) => x), act, proposed: date, due: date, body, status: 'принято' }
  if (same >= 0) d[same] = rec; else d.push(rec)
}
