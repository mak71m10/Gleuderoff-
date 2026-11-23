// Казна войска: ведомость расходов армии по статьям, утечки (видит мастер), меры по бюджету.
// Считается в econCalc.ts для строки «Армия» и показывается во вкладке «Армия» → «Казна войска».
import { ARM, companyStats, type CostSplit, type Formation, type Graft, type Measure, type MeasureKind, type StateMilitary } from './military'
import type { Role } from './economy'
import { decisionMeasures, levelAt } from './decisions'
import type { Province, WorldData, WorldDate, WorldState } from './types'

const YEAR = 500
/** какую долю жалованья и кормовых казна платит войскам вне постоянного войска — по уровню сбора */
export const LEVEL_PAY: Record<string, number> = { 'мир': 0.3, 'сбор': 0.7, 'великий сбор': 1, 'всеобщий призыв': 1.15 }
/** оклады ставки на соединение за ход */
const STAFF: Record<string, number> = { battalion: 0, regiment: 0.8, corps: 3, army: 9 }

export const MEASURES: Record<MeasureKind, { name: string; icon: string; text: string; price: string; scoped?: boolean }> = {
  settle: { name: 'Военные поселения', icon: '🌾', scoped: true, text: 'Выбранные полки получают землю вместо жалованья: жалованье −60 %.', price: 'сбор дольше, выучка со временем падает, знать теряет земли' },
  billet: { name: 'Постой у жителей', icon: '🏠', text: 'Войска стоят по дворам и едят у хозяев: кормовые −50 %.', price: 'довольство кормильцев −8' },
  scutage: { name: 'Щитовые деньги', icon: '🛡', text: 'Знать платит в казну вместо службы: дружины знати на половине содержания, а казна получает выкуп.', price: 'конных дружин меньше, довольство знати −6' },
  provincial: { name: 'Областная повинность', icon: '📜', text: 'Треть содержания полков ложится на области — казна платит меньше.', price: 'довольство кормильцев и мастеров −5' },
  audit: { name: 'Ревизия интендантства', icon: '🔍', text: 'Ревизоры проверяют подряды и списки: утечки −50 % на 4 года, игрок видит, куда утекало.', price: 'ревизоры стоят денег первый год; военные и интенданты злы' },
  staffcut: { name: 'Сократить ставку', icon: '✂', text: 'Меньше штабных и офицерских окладов: ставка −50 %.', price: 'управление хуже, полководцы недовольны' }
}

export interface LedgerLine { key: string; name: string; amount: number; note?: string }
export interface Ledger {
  lines: LedgerLine[]
  total: number
  men: number
  standing: number
  /** доля жалованья для тех, кто не в постоянном войске */
  atHome: number
  /** уровень сбора на дату (закон или решение власти) */
  level: string
  leak: { rate: number; amount: number; byLine: Record<string, number>; who: string; through: string; note?: string; revealed: boolean; audited: boolean }
  income: LedgerLine[]
  content: Partial<Record<Role, number>>
  active: Measure[]
  armies: { id: string; name: string; level: string; men: number; total: number; base?: number; baseName?: string; hops: number }[]
}

/** утечки по умолчанию — если генератор их не записал */
const GRAFT_CULT: Record<string, number> = { orcish: 0.02, nordic: 0.04, elven: 0.05, eluin: 0.05, dark: 0.1, zlatay: 0.1, desert: 0.12, imperial: 0.1 }
export function defaultGraft(cult: string): Graft { return { rate: GRAFT_CULT[cult] ?? 0.08, who: 'интенданты и полковые казначеи', through: 'кормовые и подряды' } }

export const measureOn = (m: Measure, date: WorldDate): boolean => m.from <= date && (m.to == null || date < m.to)

function capitalProvince(world: WorldData, st: WorldState, provs: Province[]): Province | undefined {
  const pl = world.places.find((p) => p.id === st.base.capitalId)
  if (!pl) return provs[0]
  let best: Province | undefined, d = Infinity
  for (const p of provs) { const dd = (p.x - pl.x) ** 2 + (p.y - pl.y) ** 2; if (dd < d) { d = dd; best = p } }
  return best
}
/** шаги по своим областям от столицы */
function hopsFrom(start: Province | undefined, provs: Province[]): Map<number, number> {
  const own = new Map(provs.map((p) => [p.id, p]))
  const dist = new Map<number, number>()
  if (!start) return dist
  dist.set(start.id, 0)
  const q = [start.id]
  while (q.length) { const id = q.shift()!; const p = own.get(id)!; for (const n of p.neighbors ?? []) if (own.has(n) && !dist.has(n)) { dist.set(n, dist.get(id)! + 1); q.push(n) } }
  return dist
}

export function armyLedger(world: WorldData, st: WorldState, mil: StateMilitary, ctx: { date: WorldDate; pop: number; cult: string; war: boolean; provs: Province[]; byRole: Partial<Record<Role, number>> }): Ledger {
  const { date, pop, cult, war, provs } = ctx
  const tpl = new Map(mil.templates.map((t) => [t.id, t]))
  const fById = new Map(mil.formations.map((f) => [f.id, f]))
  const cById = new Map(mil.companies.map((c) => [c.id, c]))
  // меры: введённые мастером и принятые решениями власти
  const allMeasures = [...(mil.measures ?? []), ...decisionMeasures(st)]
  const active = allMeasures.filter((m) => measureOn(m, date))
  const level = levelAt(st, date)
  const has = (k: MeasureKind): Measure | undefined => active.find((m) => m.kind === k)

  // какие роты в каких корнях; поселения — по выбранным соединениям
  const settled = new Set<string>()
  const settle = active.filter((m) => m.kind === 'settle')
  const companiesOf = (f: Formation, out: string[] = []): string[] => { for (const c of f.companies ?? []) out.push(c); for (const ch of f.children) { const x = fById.get(ch); if (x) companiesOf(x, out) } return out }
  for (const m of settle) for (const fid of m.scope ?? mil.roots) { const f = fById.get(fid); if (f) for (const c of companiesOf(f)) settled.add(c) }

  let men = 0
  const per = new Map<string, CostSplit>()
  let noble = 0
  for (const c of mil.companies) {
    const t = tpl.get(c.t)
    const r = companyStats(c, t)
    men += c.men
    const s = { ...r.split }
    if (settled.has(c.id)) s.pay *= 0.4
    if (has('scutage') && /правящ/.test(ARM[t?.arm ?? 'line']?.from ?? '')) { noble += s.pay + s.feed; s.pay *= 0.5; s.feed *= 0.5 }
    per.set(c.id, s)
  }
  const standing = Math.min(men, Math.round(pop * mil.law.standing))
  let atHome = (LEVEL_PAY[level] ?? 0.3) * (cult === 'orcish' ? 0.5 : 1)
  if (war) atHome = Math.max(atHome, 0.8)
  const k = (standing + (men - standing) * atHome) / Math.max(1, men)
  const gearK = 0.15 + 0.85 * k

  // утечки: ревизия режет вдвое на 4 года, после любой ревизии игрок видит строку
  const g = mil.graft ?? defaultGraft(cult)
  const audits = allMeasures.filter((m) => m.kind === 'audit' && m.from <= date)
  const audited = audits.some((m) => date < m.from + 4 * YEAR)
  const rate = g.rate * (audited ? 0.5 : 1)
  const INFL: Record<string, number> = { pay: 0.6, feed: 1.5, gear: 1, supply: 0.8, train: 1 }

  // по армиям: свои статьи, база, подвоз
  const cap = capitalProvince(world, st, provs)
  const hops = hopsFrom(cap, provs)
  const provName = new Map(provs.map((p) => [p.id, p.name]))
  const sum: Record<string, number> = { pay: 0, feed: 0, gear: 0, supply: 0, staff: 0, garrison: 0, train: 0 }
  const armies: Ledger['armies'] = []
  const bases = new Set<number>(), posts = new Set<number>()
  const staffK = has('staffcut') ? 0.5 : 1
  for (const f of mil.formations) sum.staff += (STAFF[f.level] ?? 0) * staffK
  for (const rid of mil.roots) {
    const f = fById.get(rid); if (!f) continue
    const ids = companiesOf(f)
    const a = { pay: 0, feed: 0, gear: 0, supply: 0 }
    let m = 0
    for (const id of ids) { const s = per.get(id); const c = cById.get(id); if (!s || !c) continue; m += c.men; a.pay += s.pay * k; a.feed += s.feed * k; a.gear += s.gear * gearK; a.supply += s.supply * k }
    const h = f.base != null ? (hops.get(f.base) ?? 8) : 3
    const paidMen = m * k
    const train = (paidMen / 1000) * (0.4 + h * 0.35)
    const sub: string[] = []
    const walk = (x: Formation): void => { if (x.base != null) (x.level === 'battalion' ? posts : bases).add(x.base); for (const ch of x.children) { const y = fById.get(ch); if (y) walk(y) }; sub.push(x.id) }
    walk(f)
    const staff = sub.reduce((s, id) => s + (STAFF[fById.get(id)!.level] ?? 0) * staffK, 0)
    sum.pay += a.pay; sum.feed += a.feed; sum.gear += a.gear; sum.supply += a.supply; sum.train += train
    armies.push({ id: f.id, name: f.name, level: f.level, men: m, total: a.pay + a.feed + a.gear + a.supply + train + staff, base: f.base, baseName: f.base != null ? provName.get(f.base) : undefined, hops: h })
  }
  const postsOnly = [...posts].filter((b) => !bases.has(b)).length
  sum.garrison = bases.size * 1.5 + postsOnly * 0.4
  if (has('billet')) sum.feed *= 0.5

  // раздуваем статьи утечками
  const byLine: Record<string, number> = {}
  for (const [key, kk] of Object.entries(INFL)) { const add = sum[key] * rate * kk; byLine[key] = add; sum[key] += add }
  const vets = sum.pay * 0.04
  const lines: LedgerLine[] = [
    { key: 'pay', name: 'Жалованье', amount: sum.pay, note: `на жалованье ${standing.toLocaleString('ru-RU')} из ${men.toLocaleString('ru-RU')}, остальным — ${Math.round(atHome * 100)} %${settled.size ? `; ${settled.size} рот на земле` : ''}` },
    { key: 'feed', name: 'Кормовые и фураж', amount: sum.feed, note: has('billet') ? 'постой у жителей: вдвое меньше' : 'хлеб, скот, корм коням' },
    { key: 'gear', name: 'Снаряжение и починка', amount: sum.gear, note: 'оружие, доспех, щиты, сбруя' },
    { key: 'supply', name: 'Порох, стрелы, реагенты', amount: sum.supply },
    { key: 'staff', name: 'Ставка и офицеры', amount: sum.staff, note: `${mil.formations.filter((f) => f.level !== 'battalion').length} штабов${has('staffcut') ? ', сокращены вдвое' : ''}` },
    { key: 'garrison', name: 'Гарнизоны и крепости', amount: sum.garrison, note: `${bases.size} мест базирования${postsOnly ? ` и ${postsOnly} гарнизонов` : ''}` },
    { key: 'train', name: 'Обоз и подвоз', amount: sum.train, note: 'дальше от столицы — дороже' },
    { key: 'vets', name: 'Ветераны и вдовы', amount: vets }
  ]
  const au = audits.find((m) => date < m.from + YEAR)
  let total = lines.reduce((s, l) => s + l.amount, 0)
  if (au) { const c = total * 0.04; lines.push({ key: 'audit', name: 'Ревизоры', amount: c, note: 'первый год ревизии' }); total += c }
  if (has('provincial')) { const c = -total / 3; lines.push({ key: 'provincial', name: 'Областная повинность', amount: c, note: 'треть содержания платят области' }); total += c }
  for (const l of lines) l.amount = Math.round(l.amount * 10) / 10
  const income: LedgerLine[] = has('scutage') && noble > 0 ? [{ key: 'scutage', name: 'Щитовые деньги', amount: Math.round(noble * 0.6), note: 'выкуп знати вместо службы' }] : []
  const content: Partial<Record<Role, number>> = {}
  const addC = (r: Role, v: number): void => { content[r] = (content[r] ?? 0) + v }
  if (has('billet')) addC('feeders', -8)
  if (has('provincial')) { addC('feeders', -5); addC('makers', -5) }
  if (has('scutage')) addC('rulers', -6)
  const leakAmt = Object.values(byLine).reduce((s, v) => s + v, 0)
  return {
    lines, total: Math.round(total), men, standing, atHome, level,
    leak: { rate, amount: Math.round(leakAmt), byLine, who: g.who, through: g.through, note: g.note, revealed: audits.length > 0, audited },
    income, content, active, armies: armies.sort((x, y) => y.men - x.men)
  }
}
