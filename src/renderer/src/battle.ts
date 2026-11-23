// Расчёт сражения для мастера (docs/впи-армия.md § 6): виды боя, фазы, замыслы сторон, ролевые поправки мастера, удача.
// Приложение предлагает ход боя по фазам, потери и исход; мастер правит поправками и утверждает (Battle.tsx).
import { companiesUnder, companyAt } from './orders'
import { ARM, type StateMilitary } from './military'
import { squadronStats, type StateNavy } from './fleet'
import type { WorldDate } from './types'

export type BattleKind = 'field' | 'siege' | 'ambush' | 'crossing' | 'naval'
export const KINDS: Record<BattleKind, { name: string; icon: string; text: string }> = {
  field: { name: 'Полевое сражение', icon: '⚔', text: 'Две армии сходятся в поле: разведка, стрельба, сшибка, натиск конницы, преследование.' },
  siege: { name: 'Осада и штурм', icon: '🏰', text: 'Стены, обстрел, пролом, штурм; защитник держится за камнем, вылазки.' },
  ambush: { name: 'Засада', icon: '🌿', text: 'Засаду ставит нападающий; если враг не раскроет её разведкой — его строй смят и дух сломлен.' },
  crossing: { name: 'Бой на переправе', icon: '🌊', text: 'Нападающий переходит реку под ударом; мосты и броды решают всё.' },
  naval: { name: 'Морской бой', icon: '⚓', text: 'Манёвр за ветер, обстрел, абордаж, брандеры; корабли тонут и сдаются.' }
}
export const TERRAINS: Record<number, { name: string; fire: number; horse: number; defend: number }> = {
  1: { name: 'равнина', fire: 1, horse: 1.3, defend: 1 }, 2: { name: 'лес', fire: 0.6, horse: 0.45, defend: 1.15 }, 3: { name: 'холмы', fire: 0.9, horse: 0.8, defend: 1.2 },
  4: { name: 'горы', fire: 0.8, horse: 0.3, defend: 1.35 }, 5: { name: 'снега', fire: 0.8, horse: 0.5, defend: 1.1 }, 6: { name: 'пустыня', fire: 1.05, horse: 1.15, defend: 1 }
}
export const WEATHER: Record<string, { fire: number; horse: number; scout: number; note: string }> = {
  'ясно': { fire: 1, horse: 1, scout: 1, note: '' },
  'дождь': { fire: 0.7, horse: 0.85, scout: 0.9, note: 'отсырел порох, тетивы мокрые, кони вязнут' },
  'туман': { fire: 0.5, horse: 0.9, scout: 0.5, note: 'стрелять вслепую, засаде раздолье' },
  'снег': { fire: 0.8, horse: 0.6, scout: 0.8, note: 'мороз и сугробы' },
  'жара': { fire: 1, horse: 0.9, scout: 1, note: 'доспешные устают, вода дороже золота' }
}
export const FORT = ['нет укреплений', 'частокол и рвы', 'городские стены', 'крепость'] as const

/** замысел стороны: поправки к фазам, кого бьёт и кто бьёт его */
export interface Plan { key: string; name: string; text: string; kinds: BattleKind[]; mods: Partial<Record<Phase, number>>; beats?: string[]; risk?: string }
export type Phase = 'scout' | 'fire' | 'clash' | 'horse' | 'morale' | 'pursuit' | 'siege' | 'board'
export const PLANS: Plan[] = [
  { key: 'line', name: 'Обычный строй', text: 'Строй по уставу, без затей.', kinds: ['field', 'crossing', 'siege', 'ambush'], mods: {} },
  { key: 'shieldwall', name: 'Стена щитов и выжидание', text: 'Стоять и принимать удар; пусть враг ломает зубы.', kinds: ['field', 'crossing'], mods: { clash: 1.15, horse: 0.85, fire: 0.9 }, beats: ['rush', 'flank'], risk: 'бессилен против обстрела' },
  { key: 'volley', name: 'Измор стрельбой', text: 'Держать дистанцию и выбивать врага стрелами и пулями.', kinds: ['field', 'crossing', 'siege'], mods: { fire: 1.35, clash: 0.9 }, beats: ['shieldwall', 'line'], risk: 'стремительный натиск сминает стрелков' },
  { key: 'rush', name: 'Стремительный натиск', text: 'Сразу в рукопашную, не давая врагу стрелять.', kinds: ['field', 'crossing', 'ambush'], mods: { clash: 1.25, fire: 0.8, morale: 1.05 }, beats: ['volley'], risk: 'свои потери выше; стена щитов держит' },
  { key: 'flank', name: 'Удар конницы во фланг', text: 'Связать фронт и обойти конницей.', kinds: ['field'], mods: { horse: 1.45, scout: 1.1 }, beats: ['line', 'volley'], risk: 'резерв в засаде встречает обход' },
  { key: 'reserve', name: 'Резерв в засаде', text: 'Держать свежие части за холмом и бросить в решающий миг.', kinds: ['field', 'siege'], mods: { clash: 1.1, morale: 1.1, pursuit: 1.1 }, beats: ['flank', 'feint'] },
  { key: 'feint', name: 'Ложное отступление', text: 'Показать бегство и заманить врага под удар.', kinds: ['field', 'ambush'], mods: { horse: 1.2, pursuit: 1.3, morale: 0.95 }, beats: ['rush', 'flank'], risk: 'опасно при слабой дисциплине своих' },
  { key: 'night', name: 'Ночная атака', text: 'Ударить затемно, пока враг спит.', kinds: ['field', 'siege', 'ambush'], mods: { fire: 0.4, scout: 1.3, morale: 1.15 }, beats: ['line', 'volley'], risk: 'свои теряются во тьме' },
  { key: 'storm', name: 'Штурм лестницами', text: 'Лезть на стены сразу, не дожидаясь пролома.', kinds: ['siege'], mods: { clash: 1.2, siege: 0.6 }, risk: 'огромные потери у стен' },
  { key: 'bombard', name: 'Обстрел и пролом', text: 'Бить стены машинами и пушками, штурм — в пролом.', kinds: ['siege'], mods: { siege: 1.5, clash: 0.9 }, beats: ['sally'] },
  { key: 'starve', name: 'Обложение и голод', text: 'Не штурмовать: перекрыть дороги и ждать.', kinds: ['siege'], mods: { siege: 0.3, clash: 0.3, morale: 1.1 }, risk: 'долго; свои болеют в лагере' },
  { key: 'mine', name: 'Подкоп', text: 'Сапёры роют под стену.', kinds: ['siege'], mods: { siege: 1.3 }, beats: ['sally'], risk: 'без сапёров — напрасно' },
  { key: 'sally', name: 'Вылазка защитников', text: 'Защитник выходит и жжёт осадные машины.', kinds: ['siege'], mods: { clash: 1.1, siege: 0.7 }, beats: ['storm', 'starve'] },
  { key: 'hold', name: 'Держать стены', text: 'Защитник стоит на стенах и ждёт подмоги.', kinds: ['siege', 'crossing'], mods: { clash: 1.1, morale: 1.05 } },
  { key: 'trap', name: 'Засада в лесу', text: 'Ждать врага на тропе, ударить с трёх сторон.', kinds: ['ambush'], mods: { scout: 1.3, fire: 1.2, morale: 1.15 }, beats: ['line', 'rush'] },
  { key: 'gauge', name: 'Борьба за ветер', text: 'Занять наветренную сторону и бить с неё.', kinds: ['naval'], mods: { fire: 1.2, scout: 1.2 }, beats: ['board'] },
  { key: 'board', name: 'На абордаж', text: 'Сблизиться и брать корабли в рукопашной.', kinds: ['naval'], mods: { board: 1.35, fire: 0.85 }, beats: ['line'] },
  { key: 'fireships', name: 'Брандеры', text: 'Пустить горящие корабли на сомкнутый строй врага.', kinds: ['naval'], mods: { fire: 1.4 }, beats: ['board'], risk: 'ветер может развернуть огонь' },
  { key: 'naval-line', name: 'Бой в линию', text: 'Строем, борт к борту, бортовыми залпами.', kinds: ['naval'], mods: { fire: 1.15 }, beats: ['fireships'] }
]
export const PLAN = Object.fromEntries(PLANS.map((p) => [p.key, p])) as Record<string, Plan>

export interface SideInput {
  stateId: string; name: string
  formations: string[]; squadrons: string[]
  plan: string
  /** ролевые поправки мастера: речь, знамение, предательство… (±%) */
  rp: { text: string; value: number }[]
  /** своя земля: проводники, знают местность */
  home: boolean
}
export interface BattleInput { kind: BattleKind; terrain: number; weather: string; fort: number; river: number; a: SideInput; b: SideInput; seed: number; date: WorldDate; place?: string }
export interface SideState { men: number; ships: number; lost: number; dead: number; wounded: number; captured: number; shipsLost: number; morale: number; byUnit: Map<string, number> }
export interface PhaseResult { key: string; name: string; text: string; a: number; b: number }
export interface BattleResult { phases: PhaseResult[]; a: SideState; b: SideState; winner: 'a' | 'b' | null; word: string; margin: number; notes: string[] }

// ---------- силы стороны ----------
interface Force { men: number; line: number; missile: number; horse: number; support: number; scouts: number; atk: number; fire: number; hold: number; def: number; mov: number; mor: number; dis: number; siege: number; sappers: number; units: { id: string; men: number; role: string }[]; ships: number; hull: number; board: number; nfire: number; speed: number; shipList: { id: string; count: number }[] }
export function sideForce(mil: StateMilitary | undefined, navy: StateNavy | undefined, s: SideInput, date: WorldDate): Force {
  const f: Force = { men: 0, line: 0, missile: 0, horse: 0, support: 0, scouts: 0, atk: 0, fire: 0, hold: 0, def: 0, mov: 0, mor: 0, dis: 0, siege: 0, sappers: 0, units: [], ships: 0, hull: 0, board: 0, nfire: 0, speed: 0, shipList: [] }
  if (mil) {
    const ids = new Set<string>()
    for (const fid of s.formations) { const x = mil.formations.find((y) => y.id === fid); if (x) for (const c of companiesUnder(mil, x)) ids.add(c) }
    for (const c of mil.companies) {
      if (!ids.has(c.id)) continue
      const r = companyAt(mil, c, date), arm = ARM[r.tpl?.arm ?? 'line'], n = c.men, st = r.stats
      const role = arm?.key === 'scouts' ? 'scouts' : arm?.role === 'missile' ? 'missile' : arm?.role === 'horse' ? 'horse' : arm?.role === 'support' ? 'support' : 'line'
      f.men += n; (f as unknown as Record<string, number>)[role] += n
      f.atk += st.atk * n; f.fire += st.fire * (0.6 + st.rng / 25) * n; f.hold += st.hold * n; f.def += st.def * n; f.mov += st.mov * n; f.mor += st.mor * n; f.dis += st.dis * n
      if (arm?.key === 'siege' || arm?.key === 'cannon') f.siege += n * (arm.key === 'cannon' ? 2 : 1.2)
      if (arm?.key === 'sappers' || r.tpl?.kit.includes('sappertools') || r.tpl?.kit.includes('ladders')) f.sappers += n
      f.units.push({ id: c.id, men: n, role })
    }
  }
  if (navy) for (const sq of navy.squadrons) {
    if (!s.squadrons.includes(sq.id)) continue
    const r = squadronStats(sq)
    f.ships += sq.count; f.hull += r.stats.hull * sq.count; f.board += r.stats.board * sq.count; f.nfire += r.stats.fire * sq.count; f.speed += r.stats.speed * sq.count
    f.men += r.crew; f.shipList.push({ id: sq.id, count: sq.count })
  }
  return f
}
const avg = (sum: number, n: number): number => (n ? sum / n : 0)

// ---------- бой ----------
export function fight(inp: BattleInput, fa: Force, fb: Force): BattleResult {
  let seed = inp.seed || 1
  const rnd = (): number => ((seed = (Math.imul(seed, 48271) >>> 0) % 2147483647) / 2147483647)
  const luck = (): number => 0.85 + rnd() * 0.3
  const T = TERRAINS[inp.terrain] ?? TERRAINS[1], Wt = WEATHER[inp.weather] ?? WEATHER['ясно']
  const pa = PLAN[inp.a.plan] ?? PLAN.line, pb = PLAN[inp.b.plan] ?? PLAN.line
  const rpA = 1 + inp.a.rp.reduce((s, x) => s + x.value, 0) / 100, rpB = 1 + inp.b.rp.reduce((s, x) => s + x.value, 0) / 100
  // замысел бьёт замысел: +15 % ко всему, у битого −10 %
  const counter = (p: Plan, q: Plan): number => (p.beats?.includes(q.key) ? 1.15 : q.beats?.includes(p.key) ? 0.9 : 1)
  const kA = rpA * counter(pa, pb), kB = rpB * counter(pb, pa)
  const m = (p: Plan, ph: Phase): number => p.mods[ph] ?? 1
  const notes: string[] = []
  if (counter(pa, pb) > 1) notes.push(`Замысел «${pa.name}» бьёт «${pb.name}».`)
  if (counter(pb, pa) > 1) notes.push(`Замысел «${pb.name}» бьёт «${pa.name}».`)
  if (Wt.note) notes.push(`Погода: ${inp.weather} — ${Wt.note}.`)
  const A = { lost: 0, morale: 1, shipsLost: 0 }, B = { lost: 0, morale: 1, shipsLost: 0 }
  const phases: PhaseResult[] = []
  const hit = (side: typeof A, men: number, total: number): number => { const x = Math.min(men, Math.max(0, total * 0.6 - side.lost)); side.lost += x; return Math.round(x) }
  const defA = avg(fa.def, fa.men), defB = avg(fb.def, fb.men)
  // защитник — сторона B; укрепления и переправа помогают ему
  const fortK = 1 + inp.fort * 0.45, riverK = 1 - inp.river * 0.12

  // 1. разведка
  const sA = (fa.scouts * 3 + fa.horse * 0.7 + avg(fa.mov, fa.men) * fa.men * 0.02) * (inp.a.home ? 1.25 : 1) * m(pa, 'scout') * Wt.scout * luck() * kA
  const sB = (fb.scouts * 3 + fb.horse * 0.7 + avg(fb.mov, fb.men) * fb.men * 0.02) * (inp.b.home ? 1.25 : 1) * m(pb, 'scout') * Wt.scout * luck() * kB
  const init = sA / Math.max(1, sA + sB)
  phases.push({ key: 'scout', name: 'Разведка', text: init > 0.55 ? `${inp.a.name} видит врага первым: выбирает поле и час.` : init < 0.45 ? `${inp.b.name} знает, где враг, и встречает его на своём месте.` : 'Разъезды сталкиваются вслепую — никто не застигнут врасплох.', a: Math.round(init * 100), b: Math.round((1 - init) * 100) })
  // засаду ставит нападающий: срабатывает, если враг явно не переиграл его в разведке; раскрытая засада бьёт по самому засадчику
  const ambushOk = inp.kind === 'ambush' && init >= 0.4
  if (inp.kind === 'ambush') {
    if (ambushOk) { B.morale -= 0.25; notes.push(`${inp.b.name} попадает в засаду: строй смят, дух −25 %.`) }
    else { A.morale -= 0.15; notes.push(`Засада раскрыта: ${inp.b.name} обходит её и бьёт засадчиков врасплох (дух ${inp.a.name} −15 %).`) }
  }

  if (inp.kind === 'naval') {
    // морской бой: манёвр, обстрел, абордаж
    const gA = avg(fa.speed, fa.ships) * m(pa, 'scout') * luck() * kA, gB = avg(fb.speed, fb.ships) * m(pb, 'scout') * luck() * kB
    const wind = gA / Math.max(1, gA + gB)
    phases.push({ key: 'gauge', name: 'Манёвр за ветер', text: wind > 0.5 ? `${inp.a.name} выигрывает ветер.` : `${inp.b.name} выигрывает ветер.`, a: Math.round(wind * 100), b: Math.round((1 - wind) * 100) })
    const fA = fa.nfire * m(pa, 'fire') * Wt.fire * (0.8 + wind * 0.4) * luck() * kA, fB = fb.nfire * m(pb, 'fire') * Wt.fire * (1.2 - wind * 0.4) * luck() * kB
    const sunkB = Math.min(fb.ships, Math.round((fA / Math.max(1, avg(fb.hull, fb.ships) * 10)) * 0.6)), sunkA = Math.min(fa.ships, Math.round((fB / Math.max(1, avg(fa.hull, fa.ships) * 10)) * 0.6))
    A.shipsLost += sunkA; B.shipsLost += sunkB
    phases.push({ key: 'fire', name: 'Обстрел', text: `Залпы и горшки с огнём: ${inp.a.name} теряет ${sunkA} кораблей, ${inp.b.name} — ${sunkB}.`, a: sunkB, b: sunkA })
    const bA = fa.board * m(pa, 'board') * luck() * kA, bB = fb.board * m(pb, 'board') * luck() * kB
    const capB = Math.min(fb.ships - B.shipsLost, Math.round((fb.ships * 0.25 * bA) / Math.max(1, bA + bB))), capA = Math.min(fa.ships - A.shipsLost, Math.round((fa.ships * 0.25 * bB) / Math.max(1, bA + bB)))
    A.shipsLost += capA; B.shipsLost += capB
    phases.push({ key: 'board', name: 'Абордаж', text: `Борт о борт: ${inp.a.name} берёт ${capB} кораблей, ${inp.b.name} — ${capA}.`, a: capB, b: capA })
    A.lost = (fa.men * A.shipsLost) / Math.max(1, fa.ships); B.lost = (fb.men * B.shipsLost) / Math.max(1, fb.ships)
    A.morale -= (A.shipsLost / Math.max(1, fa.ships)) * 1.6; B.morale -= (B.shipsLost / Math.max(1, fb.ships)) * 1.6
  } else {
    // 2. стрельба (у защитника за стенами — вдвое меньше потерь)
    const fireA = fa.fire * m(pa, 'fire') * Wt.fire * T.fire * luck() * kA * (ambushOk ? 1.3 : 1)
    const fireB = fb.fire * m(pb, 'fire') * Wt.fire * T.fire * luck() * kB * (inp.kind === 'ambush' && !ambushOk ? 1.3 : 1)
    const toB = (fireA * 0.012) / (1 + defB / 10) / fortK, toA = (fireB * 0.012) / (1 + defA / 10) * (inp.kind === 'crossing' ? 1.3 : 1)
    phases.push({ key: 'fire', name: 'Стрельба', text: fireA + fireB < 1 ? 'Стрелять почти некому.' : `${inp.a.name} выбивает ${Math.round(toB)}, ${inp.b.name} — ${Math.round(toA)}.`, a: hit(B, toB, fb.men), b: hit(A, toA, fa.men) })

    // 2а. осада: машины и подкоп рушат стены
    let breach = 0
    if (inp.kind === 'siege') {
      const sg = (fa.siege * 2 + fa.sappers * (inp.a.plan === 'mine' ? 1.5 : 0.4)) * m(pa, 'siege') * m(pb, 'siege') * luck()
      breach = Math.min(1, sg / Math.max(1, 400 * inp.fort * inp.fort + 200))
      phases.push({ key: 'siege', name: 'Обстрел стен', text: breach > 0.6 ? 'Стена рухнула — в проломе можно пройти строем.' : breach > 0.25 ? 'Стена разбита местами — штурм тяжёл, но возможен.' : 'Стены стоят; машины бьют впустую.', a: Math.round(breach * 100), b: Math.round((1 - breach) * 100) })
    }
    // 3. сшибка
    const holdTerr = inp.kind === 'siege' ? 1 + inp.fort * 0.45 * (1 - breach) : T.defend
    const cA = (fa.atk + fa.hold * 0.5) * (fa.line + fa.horse * 0.3) / Math.max(1, fa.men) * m(pa, 'clash') * luck() * kA * A.morale * (inp.kind === 'crossing' ? riverK : 1)
    const cB = (fb.atk + fb.hold * 0.5) * (fb.line + fb.horse * 0.3) / Math.max(1, fb.men) * m(pb, 'clash') * luck() * kB * B.morale * holdTerr * (inp.kind === 'siege' ? 1 : fortK > 1 ? fortK * 0.8 : 1)
    const pool = (fa.line + fb.line) * 0.07 * (inp.kind === 'siege' && inp.a.plan === 'starve' ? 0.2 : 1)
    const lossA = pool * (cB / Math.max(1, cA + cB)) * (pa.key === 'rush' || pa.key === 'storm' ? 1.2 : 1), lossB = pool * (cA / Math.max(1, cA + cB))
    phases.push({ key: 'clash', name: inp.kind === 'siege' ? 'Штурм' : 'Сшибка', text: cA > cB * 1.15 ? `Строй ${inp.b.name} подаётся назад.` : cB > cA * 1.15 ? `${inp.a.name} не может прорвать строй.` : 'Долгая свалка — ни одна сторона не уступает.', a: hit(B, lossB, fb.men), b: hit(A, lossA, fa.men) })

    // 4. натиск конницы (не в осаде)
    if (inp.kind !== 'siege') {
      const pikeB = Math.min(0.6, avg(fb.hold, fb.men) / 30), pikeA = Math.min(0.6, avg(fa.hold, fa.men) / 30)
      const flankA = pa.key === 'flank' && init > 0.5 ? 1.5 : 1, flankB = pb.key === 'flank' && init < 0.5 ? 1.5 : 1
      const hA = (avg(fa.atk, fa.men) + avg(fa.mov, fa.men) * 0.5) * fa.horse * T.horse * Wt.horse * m(pa, 'horse') * flankA * luck() * kA
      const hB = (avg(fb.atk, fb.men) + avg(fb.mov, fb.men) * 0.5) * fb.horse * T.horse * Wt.horse * m(pb, 'horse') * flankB * luck() * kB
      const toB2 = hA * 0.006 * (1 - pikeB), toA2 = hB * 0.006 * (1 - pikeA)
      if (flankA > 1) B.morale -= 0.15
      if (flankB > 1) A.morale -= 0.15
      phases.push({ key: 'horse', name: 'Натиск конницы', text: fa.horse + fb.horse < 50 ? 'Конницы почти нет.' : flankA > 1 ? `Конница ${inp.a.name} заходит во фланг!` : flankB > 1 ? `Конница ${inp.b.name} заходит во фланг!` : 'Конные сшибаются на крыльях.', a: hit(B, toB2, fb.men), b: hit(A, toA2, fa.men) })
    }
  }
  // 5. дух
  const mor = (f: Force, side: typeof A, p: Plan, k: number): number => Math.max(0, avg(f.mor, f.men) / 10 * (1 + avg(f.dis, f.men) / 40) * side.morale * m(p, 'morale') * k - (side.lost / Math.max(1, f.men)) * 4)
  const mA = inp.kind === 'naval' ? A.morale * kA : mor(fa, A, pa, kA), mB = inp.kind === 'naval' ? B.morale * kB : mor(fb, B, pb, kB)
  const margin = (mA - mB) / Math.max(0.1, Math.max(mA, mB))
  const winner: 'a' | 'b' | null = Math.abs(margin) < 0.08 ? null : margin > 0 ? 'a' : 'b'
  phases.push({ key: 'morale', name: 'Дух и бегство', text: winner === null ? 'Обе стороны отходят в свои лагеря — исход не решён.' : `${winner === 'a' ? inp.b.name : inp.a.name} ${Math.abs(margin) > 0.45 ? 'бежит' : 'отходит в порядке'}.`, a: Math.round(mA * 100), b: Math.round(mB * 100) })
  // 6. преследование
  if (winner && inp.kind !== 'naval') {
    const [W2, L2, fw, fl, pw] = winner === 'a' ? [A, B, fa, fb, pa] : [B, A, fb, fa, pb]
    const chase = ((fw.horse + fw.scouts) / Math.max(1, fw.men)) * m(pw, 'pursuit') * (inp.kind === 'siege' ? 0.3 : 1) * Math.min(1.5, Math.abs(margin) * 2)
    const extra = (fl.men - L2.lost) * 0.12 * chase
    phases.push({ key: 'pursuit', name: 'Преследование', text: extra > 30 ? `Конница рубит бегущих — ещё ${Math.round(extra)} павших и пленных.` : 'Преследовать некому или незачем.', a: winner === 'a' ? hit(L2, extra, fl.men) : 0, b: winner === 'b' ? hit(L2, extra, fl.men) : 0 })
    void W2
  }
  const word = winner === null ? 'Ничья: стороны расходятся' : `${Math.abs(margin) > 0.45 ? 'Решительная победа' : Math.abs(margin) > 0.2 ? 'Победа' : 'Трудная победа'}: ${winner === 'a' ? inp.a.name : inp.b.name}`
  const split = (f: Force, side: typeof A, lostWar: boolean): SideState => {
    const lost = Math.round(side.lost)
    const dead = Math.round(lost * 0.35), captured = lostWar ? Math.round(lost * 0.25) : Math.round(lost * 0.05), wounded = lost - dead - captured
    // потери по ротам: строевые и конница принимают больше
    const W3: Record<string, number> = { line: 1.25, horse: 0.95, missile: 0.7, support: 0.4, scouts: 0.8 }
    const tot = f.units.reduce((s, u) => s + u.men * (W3[u.role] ?? 1), 0)
    const byUnit = new Map<string, number>()
    for (const u of f.units) byUnit.set(u.id, Math.min(u.men - 5, Math.round((lost * u.men * (W3[u.role] ?? 1)) / Math.max(1, tot))))
    return { men: f.men, ships: f.ships, lost, dead, wounded, captured, shipsLost: side.shipsLost, morale: side.morale, byUnit }
  }
  return { phases, a: split(fa, A, winner === 'b'), b: split(fb, B, winner === 'a'), winner, word, margin, notes }
}
