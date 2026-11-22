// Органический город: улицы растут вдоль реки, дороги или берега, дома встают рядами вдоль улиц.
// Правила — docs/мастерская/8-как-строить-города.md (П1–П10). Проверка: node scripts/city-check.mjs <slug>.
// Подключение в scripts/lore/cities.mjs: custom:'city-organic.mjs', grow:{ type, houses, … }. Общие поля grow:
//   houses — домов всего; outside — доля за стеной (по умолчанию 0.25–0.35 у river/road/port/cross/castle/hill: посад вдоль дорог, у каждой дороги свой вылет); axis — поворот оси u, градусы; roads — сколько дорог; seed, density,
//   stretch (вытянутость вдоль u), block (шаг рядов, м), plaza (длина площади, м), plazaAngle, templeAngle, citadelAngle (радианы).
// Типы и их поля (что смотреть на карте мира):
//   river  — река вдоль u на одном берегу: water (ширина реки, м). road — вдоль дороги. port — морской берег (v>0 — море).
//   cross  — перекрёсток: roads ≥3 (сколько дорог сходится) или dirs:[углы дорог, градусы в осях u/v, первая — главная];
//            стена — неправильный многоугольник с выступами к воротам; за каждыми воротами луч домов (outside 0.35).
//   castle — замковый: замок на высоком краю (citadelAngle, по умолчанию π — конец u<0), город веером вниз к главным
//            воротам напротив замка, общая стена; посад только у нижних ворот (outside 0.28); roads 3–4 — боковые ворота.
//            Сам ставит c.gen.citadel и walls.
//   hill   — горный: узкая долина вдоль u (stretch 1.9), улицы-террасы (block ~26 м), главная улица — серпантин
//            (turns — колен, 4); две дороги по долине, пригородов нет. Стена — замкнутое кольцо вокруг долины
//            (открытую стену «только поперёк» city-check и 3D пока не умеют).
//   shrine — святыня: монастырь в стороне (shrineAngle, радианы, −π/2; shrineGap — зазор от села, м, 45) со своей стеной,
//            храм внутри; одна улица от него к главной дороге; само село открытое, дома и постоялые дворы вдоль дороги.
//            Сам ставит c.gen { walls:0, citadel:1 } (монастырь в плане — «цитадель»).
//   village — село без стен, houses 15–60. Сам ставит c.gen { walls:0, citadel:0 }. layout:
//            street (по умолчанию) — одна улица вдоль дороги; scatter — дворы с проулками от дороги;
//            cluster — кучевая: луг-площадь посередине, от него кривые проулки и хорды; дороги две (сквозная);
//            round — круговая: дома кольцом вокруг общего двора, один въезд (ворота одни);
//            fishing — у моря: ряд домов вдоль берега, лодочные сараи у воды, мостки в воду (axis — береговая линия, море v>0);
//            terrace — уступы по склону: короткие улицы-террасы поперёк долины, дома с одной стороны, тропа-серпантин;
//            farmsteads — редкие хутора: у каждого двор-проулок, поле рядом, тропы к дороге; плотность 0.1 (широко);
//            glade — лесная поляна: свободные кольца домов вокруг пустой середины, без улиц, один въезд.
//            Общие поля те же (houses, axis, seed, stretch, density, plaza, fields). У новых форм свои вытянутость и плотность
//            по умолчанию: cluster 1.3, round 1, glade 1, farmsteads 1.5 (density 0.1 / glade 0.2).
// Проба без правки мира: GROW_TEST='{"slug":{"type":"cross",…}}' node scripts/city-maps.mjs slug (только план и svg).
// Внутри — метры, ось y вниз; «u» идёт вдоль реки/дороги, «v» поперёк (v>0 — к воде). На выходе — поворот на axis и flip.
import { monumentKind, MON_SIZE } from '../src/renderer/src/city3dMonuments.ts'

const hashStr = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0 }
const rnd = (seed) => () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0), seed / 4294967296)
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)]
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const segDist = ([px, py], [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy) }
const ring = (pts) => [...pts, pts[0]]
const pip = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c } return c }
const edgeDist = (p, poly) => { let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length])); return d }
/** прямоугольник: центр, ось длины (ux,uy), длина L вдоль оси, ширина W поперёк */
const rect = (cx, cy, ux, uy, L, W) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + ((a * L) / 2) * ux - ((b * W) / 2) * uy, cy + ((a * L) / 2) * uy + ((b * W) / 2) * ux])
const samples = (q, n = 3) => { const out = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const s = 0.03 + (0.94 * i) / (n - 1), t = 0.03 + (0.94 * j) / (n - 1); out.push(lerp(lerp(q[0], q[1], s), lerp(q[3], q[2], s), t)) } return out }
const sat = (A, B) => {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], nx = b[1] - a[1], ny = a[0] - b[0]
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (const p of A) { const d = p[0] * nx + p[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d) }
    for (const p of B) { const d = p[0] * nx + p[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d) }
    if (a1 <= b0 || b1 <= a0) return false
  }
  return true
}
const townScale = (n) => (n < 60 ? 0.42 : n < 150 ? 0.62 : n < 500 ? 0.84 : 1)
const pathAt = (r) => {
  const cum = [0]
  for (let i = 1; i < r.length; i++) cum.push(cum[i - 1] + Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]))
  return {
    len: cum[cum.length - 1],
    at(s) {
      let i = 1
      while (i < r.length - 1 && cum[i] < s) i++
      const L = cum[i] - cum[i - 1] || 1, dx = (r[i][0] - r[i - 1][0]) / L, dy = (r[i][1] - r[i - 1][1]) / L, k = s - cum[i - 1]
      return { p: [r[i - 1][0] + dx * k, r[i - 1][1] + dy * k], d: [dx, dy] }
    }
  }
}
/** сгустить ломаную до шага step */
const dense = (r, step = 6) => { const out = [r[0]]; for (let i = 1; i < r.length; i++) { const n = Math.max(1, Math.ceil(Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]) / step)); for (let k = 1; k <= n; k++) out.push(lerp(r[i - 1], r[i], k / n)) } return out }

/** сетка отрезков для быстрого «как далеко ближайшая дорога» */
function lineIndex(cell = 24) {
  const m = new Map(), segs = []
  return {
    add(r, w) {
      for (let i = 1; i < r.length; i++) {
        const s = { a: r[i - 1], b: r[i], w }, id = segs.push(s) - 1
        for (let x = Math.floor((Math.min(s.a[0], s.b[0]) - w) / cell); x <= Math.floor((Math.max(s.a[0], s.b[0]) + w) / cell); x++)
          for (let y = Math.floor((Math.min(s.a[1], s.b[1]) - w) / cell); y <= Math.floor((Math.max(s.a[1], s.b[1]) + w) / cell); y++) { const k = x * 100003 + y; if (!m.has(k)) m.set(k, []); m.get(k).push(id) }
      }
    },
    /** зазор от точки до края ближайшей дороги (отрицательный — на дороге) */
    clear(p) {
      let d = Infinity
      const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell)
      for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (const id of m.get(x * 100003 + y) || []) { const s = segs[id]; d = Math.min(d, segDist(p, s.a, s.b) - s.w / 2) }
      return d
    }
  }
}

function build(c, hint, dens) {
  const G = c.grow, type = G.type || 'road'
  const rand = rnd(hashStr(c.slug + (G.seed ?? ''))), between = (a, b) => a + (b - a) * rand()
  // отдельный датчик для «неровностей» посада: основная последовательность (и старые города) не сдвигается
  const rand2 = rnd(hashStr(c.slug + (G.seed ?? '') + '#2')), between2 = (a, b) => a + (b - a) * rand2()
  // новые формы деревни (village.layout): cluster, round, fishing, terrace, farmsteads, glade
  const LAY = type === 'village' ? G.layout || 'street' : null
  const sea = type === 'port' || LAY === 'fishing' // у воды: берег моря, сваи и мостки
  const useTerr = type === 'hill' || LAY === 'terrace'
  const oneGate = LAY === 'round' || LAY === 'glade'
  // городок без стен (G.walls:0): рыночное местечко у перекрёстка или моста; невидимая граница держит форму
  const noWall = G.walls === 0 && type !== 'village' && type !== 'shrine' && type !== 'castle' && type !== 'hill'
  const noMainHouses = LAY === 'glade' || LAY === 'farmsteads', noPlazaHouses = noMainHouses || LAY === 'round'
  const open = type === 'shrine' || type === 'village', older = type === 'river' || type === 'road' || type === 'port'
  const N = G.houses || (type === 'village' ? 40 : 250), OUT = G.outside ?? (noWall ? 0 : { cross: 0.35, castle: 0.28, hill: 0.25, shrine: 0, village: 0 }[type] ?? 0.3)
  const Nin = Math.round(N * (1 - OUT)), Nout = N - Nin
  const R = Math.sqrt((Nin * 65) / (dens ?? G.density ?? 0.33) / Math.PI)
  const el = G.stretch ?? ({ road: 1.4, cross: 1, castle: 1.45, hill: 2.7, shrine: 1.7, village: { cluster: 1.3, round: 1, fishing: 2.4, terrace: 2.4, farmsteads: 1.5, glade: 1 }[LAY] ?? 2.4 }[type] ?? 1.12), Ru = R * Math.sqrt(el), Rv = R / Math.sqrt(el)
  const ph = [between(0, 6.3), between(0, 6.3)]
  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const adiff = (a, b) => Math.abs(norm(a - b + Math.PI) - Math.PI)
  const tc0 = G.citadelAngle ?? (type === 'castle' ? Math.PI : -Math.PI / 2 - 0.62)
  // перекрёсток — выступы к воротам; замок — узко у замка, веер к нижним воротам
  let gates = []
  // стена — не эллипс: выступы к воротам и две-три крупные лопасти (отдельный датчик — прочие города не сдвигаются)
  const lobe = [between2(0, 6.3), between2(0, 6.3)]
  const gateBulge = (t) => gates.reduce((a, g) => a + Math.exp(-((adiff(t, g.a) / 0.42) ** 2)), 0)
  const shapeK = open ? () => 1 : type === 'castle' ? (t) => 1 - 0.17 * Math.cos(t - tc0) : (t) => (1 + 0.16 * gateBulge(t)) * (1 + 0.12 * Math.sin(2 * t + lobe[0]) + 0.08 * Math.sin(3 * t + lobe[1]))
  const rBase = (t) => (1 / Math.hypot(Math.cos(t) / Ru, Math.sin(t) / Rv)) * (1 + 0.05 * Math.sin(3 * t + ph[0]) + 0.035 * Math.sin(5 * t + ph[1])) * shapeK(t)
  const log = []

  // ---- вода: река вдоль u на одном берегу или морской берег ----
  const ww = G.water ?? (type === 'river' ? 18 : 0)
  const wph = between(0, 6.3), lam = R * between(0.5, 0.7), amp = R * 0.07
  const D = type === 'river' ? Rv * 0.8 : LAY === 'fishing' ? 18 : Rv * 0.88
  // извилистый берег моря — только в пределах города: дальше прямая (вершины берега city-maps берёт в рамку плана)
  const shoreU = Math.max(Ru, Rv) * 1.1
  // у моря изгибы берега к краям гаснут: за shoreU берег — та же прямая v = D, что и у дальнего края воды (иначе дороги уходят в воду)
  const fade = (u) => (sea ? Math.min(1, Math.max(0, (shoreU - Math.abs(u)) / (0.3 * shoreU))) : 1)
  const shoreV = (u) => D + fade(u) * (amp * Math.sin(u / lam + wph) + amp * 0.5 * Math.sin(u / (lam * 0.43) + 2 * wph))
  const wetDist = type === 'river' ? (p) => Math.abs(p[1] - shoreV(p[0])) - ww / 2 : sea ? (p) => shoreV(p[0]) - p[1] : () => Infinity
  const wallGap = type === 'river' ? 12 : type === 'port' ? 24 : LAY === 'fishing' ? 3 : 0
  const rWall = (t) => { const rb = rBase(t); if (type === 'road') return rb; for (let r = 4; r <= rb; r += 1.5) if (wetDist(polar(r, t)) < wallGap) return r - 1.5; return rb }

  // ---- ворота и стена: ворота посередине своего отрезка ----
  const nR = G.roads ?? 4
  if (older) {
    gates = [{ a: 0, main: true }, { a: Math.PI + between(-0.15, 0.15) }]
    if (nR >= 3) gates.push({ a: -Math.PI / 2 + 0.5 + between(-0.1, 0.1) })
    if (type !== 'road' || nR >= 4) gates.push({ a: Math.PI / 2 + 0.22 + between(-0.08, 0.08), water: type !== 'road' })
  } else if (type === 'cross') {
    const n = Math.max(3, G.dirs?.length ?? nR)
    gates = (G.dirs ? G.dirs.map((d) => (d * Math.PI) / 180) : Array.from({ length: n }, (_, i) => (i ? (i * 2 * Math.PI) / n + between(-0.25, 0.25) : 0))).map((a, i) => ({ a, main: i === 0 }))
  } else if (type === 'castle') {
    // главные (нижние) ворота — напротив замка; боковые — в нижней половине
    gates = [{ a: tc0 + Math.PI, main: true }]
    if (nR >= 3) gates.push({ a: tc0 + Math.PI / 2 + 0.45 + between(-0.1, 0.1) })
    if (nR >= 4) gates.push({ a: tc0 - Math.PI / 2 - 0.45 + between(-0.1, 0.1) })
  } else gates = oneGate ? [{ a: 0, main: true }] : [{ a: 0, main: true }, { a: Math.PI + between(-0.12, 0.12) }]
  const angs = [] // [угол, множитель радиуса]
  for (const g of gates) { g.d = 15 / rWall(g.a); angs.push([norm(g.a - g.d), 1], [norm(g.a + g.d), 1]) }
  const nearGate = (a) => gates.some((g) => adiff(a, g.a) < g.d + 0.09)
  // у перекрёстка стена — неправильный многоугольник: реже углы и неровный радиус
  for (let a = between(0, 0.2); a < 2 * Math.PI; a += type === 'castle' ? between(0.26, 0.4) : between(0.45, 0.75)) if (!nearGate(a)) angs.push([a, type === 'castle' ? 1 : between(0.92, 1.05)])
  angs.sort((a, b) => a[0] - b[0])
  const wall = angs.map(([t, k]) => polar(rWall(t) * k, t))
  for (const g of gates) { g.p = lerp(polar(rWall(g.a - g.d), g.a - g.d), polar(rWall(g.a + g.d), g.a + g.d), 0.5); g.dir = polar(1, g.a) }

  // ---- особые места: размеры по 3D-памятникам ----
  const ts = townScale(N + 4)
  const lms = (c.landmarks || []).map(([name, , rule]) => {
    const kind = monumentKind(name, N)
    const [L, W] = kind ? MON_SIZE[kind].map((x) => x * ts) : rule === 'temple' ? [28 * ts + 6, 15 * ts + 3] : [17, 12]
    return { name, rule: rule || 'center', kind, L, W }
  })

  // ---- цитадель: своё кольцо у края, ворота смотрят в центр ----
  let cit = null, citGate = null, cc = null, ga = 0
  // святыня: монастырь со своей стеной в стороне от села, храм — внутри
  // замок: кастра или замок из лора и есть цитадель (а не второй форт где-то в городе)
  const keepRe = /кастра|замок|цитадел|крепост|кастелян/i
  const citLm = c.gen?.citadel ? lms.find((l) => l.rule === 'citadel') || (type === 'shrine' ? lms.find((l) => l.rule === 'temple') : type === 'castle' ? lms.find((l) => keepRe.test(l.name) || l.kind === 'fort' || l.kind === 'castle') : null) : null
  if (c.gen?.citadel) {
    const lm = citLm || { L: 30, W: 22 }
    const rc = Math.hypot(lm.L / 2 + 4, lm.W / 2 + 4) + 9
    const tc = type === 'shrine' ? G.shrineAngle ?? -Math.PI / 2 : tc0
    // у замка между цитаделью и внешней стеной — проход ~22 м, чтобы кольца не сливались в двойную линию
    cc = type === 'shrine' ? polar(rWall(tc) + rc + (G.shrineGap ?? 45), tc) : polar(Math.max(rWall(tc) - rc - (type === 'castle' ? 22 : 14), rc * 0.3), tc)
    ga = Math.atan2(-cc[1], -cc[0])
    const dc = 10 / rc, pts = [], n = 14
    for (let i = 0; i <= n; i++) { const a = ga + dc + (i / n) * (2 * Math.PI - 2 * dc); pts.push(polar(rc * (i === 0 || i === n ? 1 : 1 + 0.04 * Math.sin(i * 2.3 + ph[0])), a).map((v, k) => v + cc[k])) }
    cit = pts
    citGate = lerp(pts[0], pts[n], 0.5)
  }

  // ---- площадь: на полпути от центра к главным воротам, с выемкой под ратушу ----
  const pa = G.plazaAngle ?? (useTerr ? Math.PI - 0.22 : 0.16), pc = polar(rWall(pa) * (({ round: 0, glade: 0, cluster: 0.12 })[LAY] ?? 0.5), pa), pd = polar(1, pa), pn = [-pd[1], pd[0]]
  const hallLm = lms.find((l) => l.rule === 'plaza')
  const vPlaza = { round: Math.round(1.7 * (3.2 * Math.sqrt(N) - 5)), cluster: 30, glade: 26 }[LAY]
  const pl = Math.max(G.plaza ?? vPlaza ?? ({ village: 22, shrine: 30, hill: 30 }[type] ?? 44), hallLm ? hallLm.L + 20 : 0), pw = Math.max(pl * 0.72, hallLm ? hallLm.W + 22 : 0)
  const P = (x, y) => [pc[0] + pd[0] * x + pn[0] * y, pc[1] + pd[1] * x + pn[1] * y]
  let plaza = [P(-pl / 2, -pw / 2), P(pl / 2, -pw / 2), P(pl / 2, pw / 2), P(-pl / 2, pw / 2)]
  const spots = [] // {lm, c, u, L, W}
  if (hallLm) {
    const hy = pw / 2 - hallLm.W / 2 - 1.5, hx = hallLm.L / 2 + 2, hb = hy - hallLm.W / 2 - 2
    plaza = [P(-pl / 2, -pw / 2), P(pl / 2, -pw / 2), P(pl / 2, pw / 2), P(hx, pw / 2), P(hx, hb), P(-hx, hb), P(-hx, pw / 2), P(-pl / 2, pw / 2)]
    spots.push({ lm: hallLm, c: P(0, hy), u: pd, L: hallLm.L, W: hallLm.W })
  }
  const plazaIn = P(-pl / 2, -pw / 4), plazaOut = P(pl / 2, -pw / 4)
  // рыночная площадь за главными воротами — слобода растёт вокруг неё
  let market = null
  if (!open && !noWall && N >= 100 && Nout > 0 && gates[0]) {
    const g0 = gates[0], mc = [g0.p[0] + g0.dir[0] * 36, g0.p[1] + g0.dir[1] * 36], mL = 34, mW = 22
    market = rect(mc[0], mc[1], g0.dir[0], g0.dir[1], mL, mW)
  }

  // ---- магистрали: от ворот к площади и центру, за стеной — к полям или за мост ----
  const O = [0, 0]
  const keepOff = (r) => r.map((p, i) => {
    if (!cit || i === 0 || i === r.length - 1) return p
    const d = Math.hypot(p[0] - cc[0], p[1] - cc[1]), rcMax = Math.max(...cit.map((q) => Math.hypot(q[0] - cc[0], q[1] - cc[1]))) + 12
    return d < rcMax ? [cc[0] + ((p[0] - cc[0]) / d) * rcMax, cc[1] + ((p[1] - cc[1]) / d) * rcMax] : p
  })
  const wobble = (a, b, amp0, step = 10) => {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, f = between(0, 6.3)
    return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, w = amp0 * Math.sin(Math.PI * t) * Math.sin(t * 5 + f); return [a[0] + dx * t - (dy / L) * w, a[1] + dy * t + (dx / L) * w] })
  }
  // серпантин: колена поперёк долины от ворот к площади
  // колено не выходит к стене: у ворот долина узкая, полный размах вывел бы серпантин сквозь стену (П5)
  const serp = (a, b, amp, n) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, pts = [a]
    for (let i = 1; i < n; i++) {
      const t = (i - 0.5) / (n - 1), sg = i % 2 ? 1 : -1
      let p
      for (let k = 1; k > 0.05; k *= 0.85) { p = [a[0] + dx * t - (dy / L) * amp * sg * k, a[1] + dy * t + (dx / L) * amp * sg * k]; if (pip(p, wall) && edgeDist(p, wall) >= (type === 'hill' ? 13 : 16)) break }
      pts.push(p)
    }
    pts.push(b); return pts
  }
  const mains = [] // {r, w, outFrom: индекс точки ворот}
  const quayV = (u) => shoreV(u) - 8
  for (const g of gates) {
    const inner = g.main ? (useTerr ? serp(g.p, plazaOut, Rv * (LAY === 'terrace' ? 0.5 : 0.72), G.turns ?? (type === 'hill' ? 6 : 4)) : wobble(g.p, plazaOut, 3)) : wobble(g.p, O, 4)
    let outer
    if (g.water && type === 'river') {
      const vEnd = shoreV(g.p[0]) + ww / 2 + R * 1.3, L = (vEnd - g.p[1]) / Math.max(0.3, g.dir[1])
      const bridgeEnd = [g.p[0] + g.dir[0] * (shoreV(g.p[0]) + ww / 2 + 14 - g.p[1]) / Math.max(0.3, g.dir[1]), shoreV(g.p[0]) + ww / 2 + 14]
      outer = [g.p, ...wobble(bridgeEnd, [g.p[0] + g.dir[0] * L, g.p[1] + g.dir[1] * L], 6, 12)]
    } else if (g.water && type === 'port') {
      outer = [g.p, [g.p[0], quayV(g.p[0])]]
    } else {
      const far = polar(rBase(g.a) * between(2.2, 2.6), g.a + between(-0.12, 0.12))
      if (LAY === 'fishing') far[1] = Math.min(far[1], D - 16) // дорога вдоль берега, а не в воду
      outer = wobble(g.p, far, LAY === 'fishing' ? 4 : 10, 12)
      if (type === 'shrine') outer = keepOff(outer)
    }
    const inside = keepOff(dense(inner, 10)).reverse() // от площади/центра к воротам
    const r = [...outer.slice().reverse(), ...inside.slice(1).reverse().reverse()]
    // r: от дальнего конца к воротам и внутрь
    const rr = [...outer.slice().reverse(), ...keepOff(dense(inner, 10)).slice(1)]
    void r
    mains.push({ r: rr, w: g.main ? 8 : 7, gate: g, nOut: outer.length - 1 })
  }
  const toO = wobble(plazaIn, O, 2)
  if (cit) {
    const into = [citGate[0] + Math.cos(ga + Math.PI) * 13, citGate[1] + Math.sin(ga + Math.PI) * 13]
    // ворота замка почти у конца дороги от площади: одна дорога насквозь, иначе её конец упирается в стену замка (П5)
    if (Math.hypot(citGate[0] - O[0], citGate[1] - O[1]) < 15) mains.push({ r: [...toO, ...dense([O, citGate], 10).slice(1), into], w: 7 })
    else mains.push({ r: toO, w: 7 }, { r: [...dense([O, citGate], 10), into], w: 6 })
  } else mains.push({ r: toO, w: 7 })
  if (type === 'port') {
    const u0 = -R * 1.5, u1 = R * 1.5, q = []
    for (let u = u0; u <= u1; u += 10) q.push([u, quayV(u)])
    mains.push({ r: q, w: 6, quay: true })
  }
  const mainIdx = lineIndex()
  mains.forEach((m) => mainIdx.add(m.r, m.w))

  // ---- места особых зданий ----
  const Wext = (Math.max(Ru, Rv) * 2 + R * 1.2) * 1.44, minD = 0.165 * Wext + 8
  const inWall = (p, m) => pip(p, wall) && edgeDist(p, wall) >= m
  const offCit = (p, m) => !cit || (!pip(p, cit) && edgeDist(p, cit) >= m)
  const spotOk = (s, forCit) => {
    const box = rect(s.c[0], s.c[1], s.u[0], s.u[1], s.L + 6, s.W + 6)
    for (const p of samples(box, 5)) {
      if (forCit) { if (!pip(p, cit) || edgeDist(p, cit) < 4) return false; continue }
      if (!inWall(p, 5) || !offCit(p, 4) || wetDist(p) < 2 || pip(p, plaza)) return false
    }
    for (const p of samples(rect(s.c[0], s.c[1], s.u[0], s.u[1], s.L, s.W), 4)) if (mainIdx.clear(p) < 0.5 && !forCit) return false
    for (const o of spots) {
      if (Math.hypot(o.c[0] - s.c[0], o.c[1] - s.c[1]) < s.minD) return false
      if (sat(box, rect(o.c[0], o.c[1], o.u[0], o.u[1], o.L + 8, o.W + 8))) return false
    }
    return true
  }
  const prefer = (l) => {
    switch (l.rule) {
      case 'temple': return polar(rWall(G.templeAngle ?? 2.75) * 0.56, G.templeAngle ?? 2.75)
      case 'river': case 'water': return polar(rWall(Math.PI / 2 - 0.55) - l.W - 14, Math.PI / 2 - 0.55)
      case 'gate': return lerp(gates[0].p, O, 0.3)
      case 'edge': return polar(rWall(-2.2) * 0.78, -2.2)
      case 'center': return hint || [0, 0]
      // второе место с правилом plaza (Малая Ива у эльфов) — у площади, а не на ней
      case 'plaza': return pc
      default: return polar(rWall(-1.1) * 0.55, -1.1)
    }
  }
  const order = [...new Set([...(citLm ? [citLm] : []), ...lms.filter((l) => l.rule === 'citadel'), ...lms.filter((l) => l.rule === 'temple'), ...lms.filter((l) => l.rule === 'center'), ...lms.filter((l) => l !== hallLm && !['citadel', 'center', 'temple'].includes(l.rule))])]
  for (const l of order) {
    // в цитадели одно здание: второе «цитадельное» место (Гнездо Дома при замке) ищет место в городе, а не встаёт в тот же центр
    if ((l.rule === 'citadel' || l === citLm) && cit && !spots.some((s) => s.c === cc)) {
      const u = polar(1, ga + Math.PI / 2)
      spots.push({ lm: l, c: cc, u, L: l.L, W: l.W })
      continue
    }
    const p0 = prefer(l)
    let got = null
    for (const relax of [1, 0.9, 0.8, 0.73, 0.62, 0.5, 0]) {
      // сперва ищем по всему городу с полным разносом, и только потом сближаем
      for (let rr = 0; rr <= Math.max(Ru, Rv) * 1.4 && !got; rr += 6)
        for (let k = 0, nk = rr ? Math.max(14, Math.round(rr / 5)) : 1; k < nk && !got; k++) {
          const a = (k / nk) * 2 * Math.PI + rr * 0.07, s = { lm: l, c: [p0[0] + rr * Math.cos(a), p0[1] + rr * Math.sin(a)], u: [1, 0], L: l.L, W: l.W, minD: minD * relax }
          if (spotOk(s, false)) got = s
        }
      if (got) { if (relax < 1) log.push(`место «${l.name}» ближе нормы`); break }
    }
    if (got) spots.push(got)
    else log.push(`нет места для «${l.name}»`)
  }
  const reserved = spots.map((s) => rect(s.c[0], s.c[1], s.u[0], s.u[1], s.L + 9, s.W + 9))

  // ---- переулки: ряды вдоль реки/дороги, между ними поперечные со сдвигом ----
  const streets = []
  const rMax = Math.max(Ru, Rv) * 1.15
  // квартал = два ряда домов спина к спине + улица: ~32–38 м; ряды равномерно от края до края стены
  const sv = G.block ?? (type === 'hill' ? between(24, 28) : between(32, 38))
  const rowAt = [], vMin = Math.min(...wall.map((p) => p[1])), vMax = Math.max(...wall.map((p) => p[1]))
  const nRows = Math.max(1, Math.round((vMax - vMin - 24) / sv)), vStep = (vMax - vMin - 24) / nRows
  for (let i = 0, v0 = vMin + 12 + vStep / 2; i < nRows; i++, v0 += vStep * between(0.92, 1.08)) {
    const f = between(0, 6.3), bend = type === 'road' ? 0.3 : Math.max(0, 1 - Math.abs(v0 - D) / (2.2 * R))
    // у горного — террасы по горизонталям: изгиб сильнее
    rowAt.push(type === 'hill' ? (u) => v0 + 7 * Math.sin(u / 55 + f) : (u) => v0 + (shoreV(u) - D) * bend + 3 * Math.sin(u / 37 + f))
  }
  // село и святыня: одна улица — без рядов
  if (open) rowAt.length = 0
  const terr = []
  if (useTerr) {
    rowAt.length = 0
    const uMin = Math.min(...wall.map((p) => p[0])), uMax = Math.max(...wall.map((p) => p[0])), tv = G.block ?? (LAY === 'terrace' ? between(19, 22) : between(26, 30))
    const nT = Math.max(1, Math.round((uMax - uMin - 24) / tv)), uStep = (uMax - uMin - 24) / nT
    for (let i = 0, u0 = uMin + 12 + uStep / 2; i < nT; i++, u0 += uStep * between(0.94, 1.06)) {
      const f = between(0, 6.3), bow = between(10, 16)
      terr.push((v) => u0 + bow * (v / Rv) ** 2 - bow * 0.5 + 4 * Math.sin(v / 23 + f))
    }
  }
  const streetOk = (p) => inWall(p, 9) && offCit(p, 9) && wetDist(p) >= 6 && !pip(p, plaza) && edgeDist(p, plaza) >= 1 && !reserved.some((q) => pip(p, q))
  const clipRuns = (r, ok) => {
    const out = []
    let cur = []
    for (const p of r) { if (ok(p)) cur.push(p); else { if (cur.length >= 3) out.push(cur); cur = [] } }
    if (cur.length >= 3) out.push(cur)
    return out
  }
  // улица вдоль стены изнутри (у стены всегда был проход для стражи)
  if (!open && !noWall) {
    const ringIn = dense([...wall, wall[0]], 6).map((p) => { const d = Math.hypot(p[0], p[1]) || 1, k = Math.max(0, d - 13) / d; return [p[0] * k, p[1] * k] })
    for (const run of clipRuns(ringIn, streetOk)) streets.push({ r: run, w: 4.5 })
  }
  // разбросанные дворы: короткие проулки от главной улицы
  if (type === 'village' && G.layout === 'scatter')
    for (const m of mains.filter((m) => m.gate)) {
      const Pth = pathAt(m.r)
      for (let x = between(10, 25); x < Pth.len - 10; x += between(28, 45)) {
        const { p, d } = Pth.at(x), sd = rand() < 0.5 ? -1 : 1, L = between(25, 50), b = between(-0.3, 0.3)
        const end = [p[0] + (-d[1] * sd + d[0] * b) * L, p[1] + (d[0] * sd + d[1] * b) * L]
        for (const run of clipRuns(dense([p, end], 6).slice(1), streetOk)) if (Math.hypot(run[0][0] - p[0], run[0][1] - p[1]) < 8) streets.push({ r: [p, ...run], w: 4 })
      }
    }
  // ---- новые формы деревни ----
  const farms = [] // хутора: {c, d} — центр двора и направление
  const jetU = []   // рыбацкая: места мостков (u), чтобы сараи на них не встали
  if (LAY === 'round') {
    // круговая: дома кольцом вокруг общего двора, один въезд (ворота одни, дорога идёт к двору)
    const rho = 3.2 * Math.sqrt(N), f1 = between(0, 6.3), pts = []
    for (let a = 0; a <= 2 * Math.PI + 0.01; a += 0.12) pts.push([pc[0] + rho * (1 + 0.04 * Math.sin(3 * a + f1)) * Math.cos(a), pc[1] + rho * (1 + 0.04 * Math.sin(3 * a + f1)) * Math.sin(a)])
    pts.push(pts[0])
    for (const run of clipRuns(pts, streetOk)) streets.push({ r: run, w: 4.5 })
  }
  if (LAY === 'cluster') {
    // кучевая: от луга (площади) в стороны расходятся кривые проулки, между ними поперечные кривые хорды
    const K = Math.max(5, Math.round(Math.sqrt(N) * 0.9)), a0c = between(0, 6.3), r0 = Math.max(pl, pw) * 0.5 + 3, lanes0 = []
    for (let i = 0; i < K; i++) {
      const a = a0c + (i / K) * 2 * Math.PI + between(-0.25, 0.25), st = [pc[0] + r0 * Math.cos(a), pc[1] + r0 * Math.sin(a)], L = between(34, 58), b = a + between(-0.5, 0.5)
      const en = [st[0] + L * Math.cos(b), st[1] + L * Math.sin(b)], r = wobble(st, en, between(4, 8), 7)
      lanes0.push(r)
      for (const run of clipRuns(r, streetOk)) streets.push({ r: run, w: 4 })
    }
    for (let i = 0; i < K; i++) if (rand() < 0.7) {
      const A = lanes0[i], B = lanes0[(i + 1) % K], pa1 = A[Math.floor(A.length * between(0.55, 0.75))], pb1 = B[Math.floor(B.length * between(0.55, 0.75))]
      for (const run of clipRuns(wobble(pa1, pb1, between(3, 7), 7), streetOk)) streets.push({ r: run, w: 3.8 })
    }
  }
  if (LAY === 'farmsteads') {
    // хутора: редкие дворы, у каждого свой двор-проулок и поле, между ними тропы к дороге или соседнему двору
    const Kf = Math.max(3, Math.ceil(Nin / 5)), minF = Math.max(36, Math.sqrt((Math.PI * Ru * Rv) / Kf) * 0.8)
    const nodes = [] // куда можно привести тропу: точки дорог и уже готовых дворов
    for (const m of mains) for (const p of dense(m.r, 12)) nodes.push(p)
    for (let t = 0; t < 600 && farms.length < Kf; t++) {
      const p = [between(-Ru, Ru), between(-Rv, Rv)]
      if (!inWall(p, 22) || pip(p, plaza) || edgeDist(p, plaza) < 18 || mainIdx.clear(p) < 14 || wetDist(p) < 14 || !offCit(p, 20)) continue
      if (farms.some((f) => Math.hypot(f.c[0] - p[0], f.c[1] - p[1]) < minF)) continue
      // у первых хуторов — поближе к дороге, чтобы вся деревня не расползлась: берём только те, что не дальше 2.2·minF от узла
      if (farms.length < 2 ? false : Math.min(...nodes.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]))) > minF * 2.2) continue
      let best = null, bd = Infinity
      for (const q of nodes) { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < bd) { bd = dd; best = q } }
      // двор — продолжение тропы от дороги: дома вдоль двора и вдоль тропы смотрят в одну сторону
      const dd0 = Math.hypot(p[0] - best[0], p[1] - best[1]) || 1, dir = [(p[0] - best[0]) / dd0, (p[1] - best[1]) / dd0], end = [p[0] + dir[0] * 24, p[1] + dir[1] * 24]
      farms.push({ c: p, d: dir, end })
      for (const run of clipRuns(dense([p, end], 6), streetOk)) streets.push({ r: run, w: 3.6 })
      if (best && bd > 4) for (const run of clipRuns(wobble(best, p, 2, 8), streetOk)) streets.push({ r: run, w: 3, noHouse: true })
      nodes.push(p)
    }
  }
  if (LAY === 'fishing') {
    // мостки в воду; сараи ставим между ними
    for (let u = -Ru * 0.8 + between2(0, 20); u < Ru * 0.8; u += between2(30, 46)) jetU.push(u)
  }
  // след роста у крупного города: старое ядро — кольцевая улица там, где стояла первая стена (стену снесли, улица осталась)
  if (!open && N >= 400) {
    const f1 = between2(0, 6.3), pts = []
    for (let a = 0; a <= 2 * Math.PI + 0.05; a += 0.1) pts.push(polar(rWall(a) * (0.5 + 0.04 * Math.sin(4 * a + f1)), a))
    for (const run of clipRuns(pts, streetOk)) streets.push({ r: run, w: 6 })
  }
  for (let k = 0; k < terr.length; k++) {
    const row = []
    for (let v = -rMax; v <= rMax; v += 6) row.push([terr[k](v), v])
    // деревня-террасы: дома только с одной стороны улицы-уступа (над ней), как ступени по склону
    for (const run of clipRuns(row, streetOk)) streets.push({ r: run, w: 4.5, sides: LAY === 'terrace' ? [1] : undefined })
    // редкие лестницы-проулки между соседними террасами, каждый раз в другом месте (без решётки)
    if (k + 1 < terr.length && k % 2 === 0) {
      const v = between(-Rv * 0.6, Rv * 0.6), v2 = v + between(-10, 10)
      for (const run of clipRuns(dense([[terr[k](v), v], [terr[k + 1](v2), v2]], 6), streetOk)) streets.push({ r: run, w: 3.5 })
    }
  }
  for (let k = 0; k < rowAt.length; k++) {
    const row = []
    for (let u = -rMax; u <= rMax; u += 6) row.push([u, rowAt[k](u)])
    for (const run of clipRuns(row, streetOk)) streets.push({ r: run, w: 5 })
    if (k + 1 < rowAt.length)
      for (let u = -rMax + between(0, 50); u < rMax; u += between(46, 72)) {
        const u2 = u + between(-6, 6)
        for (const run of clipRuns(dense([[u, rowAt[k](u)], [u2, rowAt[k + 1](u2)]], 6), streetOk)) streets.push({ r: run, w: 5 })
      }
  }

  // ---- дома ----
  const roadIdx = lineIndex()
  for (const m of [...mains, ...streets]) roadIdx.add(m.r, m.w)
  const houses = [], hcell = 14, hmap = new Map()
  const cellsOf = (q) => { const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]), out = []; for (let x = Math.floor(Math.min(...xs) / hcell); x <= Math.floor(Math.max(...xs) / hcell); x++) for (let y = Math.floor(Math.min(...ys) / hcell); y <= Math.floor(Math.max(...ys) / hcell); y++) out.push(x * 100003 + y); return out }
  // зазор между домами не меньше ~0.6 м: проверяем чуть раздутый контур
  // план хранит точки в целых пикселях (±0.3 м), поэтому держим запас: каждую сторону отодвигаем на 1 м
  const fat = (q) => { const un = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }, u = un(q[1][0] - q[0][0], q[1][1] - q[0][1]), v = un(q[3][0] - q[0][0], q[3][1] - q[0][1]), sg = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; return q.map(([x, y], i) => [x + (sg[i][0] * u[0] + sg[i][1] * v[0]) * 1.0, y + (sg[i][0] * u[1] + sg[i][1] * v[1]) * 1.0]) }
  const hit = (q) => { const g = fat(q); for (const k of cellsOf(g)) for (const id of hmap.get(k) || []) if (houses[id] && sat(g, houses[id].q)) return true; return false }
  const put = (q, out) => { const id = houses.push({ q, out }) - 1; for (const k of cellsOf(q)) { if (!hmap.has(k)) hmap.set(k, []); hmap.get(k).push(id) } }
  const frontage = (r, w, extra = 0, sides = [-1, 1]) => {
    const Pth = pathAt(r), cand = []
    for (const s of sides) {
      let x = between(0, 4)
      while (x < Pth.len - 3) {
        const fw = between(5.5, 9), dp = between(7, 11.5), back = w / 2 + 0.8 + between(0, 1.2) + extra
        const { p, d } = Pth.at(x + fw / 2)
        const nx = -d[1] * s, ny = d[0] * s
        cand.push({ q: rect(p[0] + nx * (back + dp / 2), p[1] + ny * (back + dp / 2), d[0], d[1], fw, dp), at: p })
        x += fw + (rand() < 0.1 ? between(3, 7) : between(1.1, 1.8))
      }
    }
    return cand
  }
  const common = (q) => {
    for (const p of samples(q)) if (wetDist(p) < 3 || pip(p, plaza) || edgeDist(p, plaza) < 0.6 || (market && (pip(p, market) || edgeDist(p, market) < 0.6)) || roadIdx.clear(p) < 0.4 || !offCit(p, 5.5)) return false
    return !reserved.some((z) => sat(q, z)) && !hit(q)
  }
  const okIn = (q) => samples(q).every((p) => inWall(p, 6.5)) && common(q)
  const okOut = (q) => samples(q).every((p) => !pip(p, wall) && edgeDist(p, wall) >= 12 && wetDist(p) >= 4) && common(q)
  // рыбацкая: лодочные сараи на узкой полосе между улицей и водой (до остальных домов), мостки — между сараями
  if (LAY === 'fishing') {
    for (let u = -Ru * 0.9 + between2(0, 8); u < Ru * 0.9; u += between2(7, 12)) {
      if (rand2() < 0.3 || jetU.some((j) => Math.abs(j - u) < 7)) continue
      const dv = (shoreV(u + 1) - shoreV(u - 1)) / 2, l = Math.hypot(1, dv), ux = 1 / l, uy = dv / l, fw = between2(5, 8)
      const q = rect(u, shoreV(u) - 6.8, ux, uy, fw, 5)
      if (samples(q).every((t) => wetDist(t) >= 3.5) && !pip(q[0], plaza) && roadIdx.clear(lerp(q[0], q[2], 0.5)) >= 3 && !hit(q)) { put(q, false); houses[houses.length - 1].shed = true }
    }
  }
  // глухая лесная поляна: дома свободными кольцами вокруг пустой середины (дерева или камня), без улиц
  if (LAY === 'glade') {
    const rin = Math.max(pl, pw) / 2 + 9, a0g = between(0, 6.3)
    for (let rr = rin, k = 0; houses.length < Nin && k < 7 && rr < Math.max(Ru, Rv) * 1.1; rr += between(13, 17), k++) {
      const n = Math.floor((2 * Math.PI * rr) / 11), off = between(0, 6.3)
      for (let i = 0; i < n && houses.length < Nin; i++) {
        if (rand() < 0.14) continue
        const a = a0g + off + (i / n) * 2 * Math.PI + between(-0.1, 0.1), rj = rr + between(-3, 3), t = a + Math.PI / 2 + between(-0.14, 0.14)
        const cp = [pc[0] + rj * Math.cos(a), pc[1] + rj * Math.sin(a)]
        let tt = t
        if (mainIdx.clear(cp) < 28) { // П7: рядом с въездной дорогой дом ставим вдоль неё
          let bs = null, bdd = Infinity
          for (const m of mains) for (let j = 1; j < m.r.length; j++) { const d2 = segDist(cp, m.r[j - 1], m.r[j]); if (d2 < bdd) { bdd = d2; bs = [m.r[j - 1], m.r[j]] } }
          if (bs) tt = Math.atan2(bs[1][1] - bs[0][1], bs[1][0] - bs[0][0])
        }
        const q = rect(cp[0], cp[1], Math.cos(tt), Math.sin(tt), between(6, 9.5), between(5.5, 8.5))
        if (okIn(q)) put(q, false)
      }
    }
  }
  for (const m of [...(noMainHouses ? [] : mains), ...streets.filter((m) => !m.noHouse), ...(noPlazaHouses ? [] : [{ r: ring(plaza), w: 0 }])]) for (const h of frontage(m.r, m.w, 0, m.sides)) if (okIn(h.q)) put(h.q, false)
  // второй ряд в глубине квартала (дворовые дома; проход к ним — по щелям между домами первого ряда)
  for (const extra of LAY === 'fishing' ? [13.5, 27] : [13.5]) if (houses.length < Nin && LAY !== 'glade') for (const m of [...(noMainHouses ? [] : mains), ...streets.filter((m) => !m.noHouse)]) for (const h of frontage(m.r, m.w, extra, m.sides)) if (houses.length < Nin * 1.05 && okIn(h.q)) put(h.q, false)
  // лишние дома внутри: чаще убираем у стены — там сады
  const inner = houses.map((h, i) => (h.shed ? null : { i, k: rand() * 0.65 + (Math.hypot(...lerp(h.q[0], h.q[2], 0.5)) / rWall(Math.atan2(...lerp(h.q[0], h.q[2], 0.5).slice().reverse()))) * 0.35 })).filter(Boolean)
  const inCount = inner.length
  if (inCount < Nin) log.push(`внутри стены поместилось ${inCount} из ${Nin}`)
  inner.sort((a, b) => b.k - a.k).slice(0, Math.max(0, inCount - Nin)).forEach(({ i }) => { houses[i] = null })

  // ---- пригород: вдоль дорог за стеной, гуще у ворот; короткие проулки ----
  const outLines = []
  for (const m of mains) {
    if (m.quay) { outLines.push(m); continue }
    if (m.nOut === undefined) continue
    if (!older && (Nout === 0 || (type === 'castle' && !m.gate.main))) continue
    const outer = m.r.slice(0, m.nOut + 1)
    const Pth = pathAt(outer.slice().reverse()) // от ворот наружу
    // слобода: по обе стороны дороги кривые проулки, их концы сшиты задними улицами — получаются кварталы в 4–8 рядов
    const reach = between2(0.75, 1.3) // у каждой дороги слобода своего размера — край неровный
    const gw = m.gate?.main ? 1.6 : N >= 400 ? 1 : 0.6
    const ends = { '-1': [], 1: [] }
    const farOk = (q) => !pip(q, wall) && edgeDist(q, wall) >= 14 && wetDist(q) >= 6 && offCit(q, 9) && !(market && pip(q, market))
    outLines.push({ r: outer, w: m.w, gw })
    for (let x = between(22, 34); x < Math.min(Pth.len - 20, R * (type === 'cross' ? 1.8 : 1.3) * reach); x += between(17, 27)) {
      for (const side of [-1, 1]) {
        if (rand() < 0.12) continue
        const { p, d } = Pth.at(x), n = [-d[1] * side, d[0] * side], L = between(42, 95) * (0.6 + 0.4 * gw), b = between(-0.35, 0.35)
        const end = [p[0] + (n[0] + d[0] * b) * L, p[1] + (n[1] + d[1] * b) * L]
        const lane = wobble(p, end, between(3, 7), 7)
        const runs = clipRuns(lane.slice(1), farOk)
        for (const run of runs) if (Math.hypot(run[0][0] - p[0], run[0][1] - p[1]) < 10) { const r = [p, ...run]; outLines.push({ r, w: 4.5, lane: true, gw }); roadIdx.add(r, 4.5); ends[side].push(r[Math.floor(r.length * 0.8)]) }
      }
    }
    for (const side of [-1, 1]) for (let i = 1; i < ends[side].length; i++) {
      const A = ends[side][i - 1], B = ends[side][i]
      if (Math.hypot(A[0] - B[0], A[1] - B[1]) > 80) continue
      for (const run of clipRuns(wobble(A, B, 3, 7), farOk)) { outLines.push({ r: run, w: 4, lane: true, gw }); roadIdx.add(run, 4) }
    }
  }
  if (market) outLines.push({ r: ring(market), w: 0, gw: 1.6 })
  const cand = []
  for (const m of outLines) for (const h of frontage(m.r, m.w)) {
    const dw = edgeDist(h.at, wall)
    cand.push({ q: h.q, key: Math.pow(rand(), 1 / Math.max(0.02, (m.gw ?? 1) * Math.exp(-dw / (0.55 * R)))) })
  }
  cand.sort((a, b) => b.key - a.key)
  let outN = 0
  for (const h of cand) { if (outN >= Nout) break; if (okOut(h.q)) { put(h.q, true); outN++ } }
  if (outN < Nout) log.push(`за стеной ${outN} из ${Nout}`)
  // пригород не шире, чем позволяет разнос особых зданий: план = размах × 1.44, а разнос должен быть ≥ 0.12 ширины плана
  if (spots.length > 1) {
    let dmin = Infinity
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) dmin = Math.min(dmin, Math.hypot(spots[i].c[0] - spots[j].c[0], spots[i].c[1] - spots[j].c[1]))
    const maxW = (dmin / 0.12) * 0.96
    const ax = ((G.axis ?? 0) * Math.PI) / 180, ca = Math.cos(ax), sa = Math.sin(ax)
    const rot = (p) => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca]
    const shorePts = sea ? Array.from({ length: 23 }, (_, k) => { const u = -shoreU + (2 * shoreU * k) / 22; return [u, shoreV(u)] }) : []
    const fixedPts = [...wall, ...shorePts, ...houses.filter((h) => h && !h.out).flatMap((h) => h.q), ...spots.flatMap((s) => rect(s.c[0], s.c[1], s.u[0], s.u[1], s.L, s.W))].map(rot)
    const outs = houses.map((h, i) => (h && h.out ? { i, r: h.q.map(rot) } : null)).filter(Boolean)
    const bb = (pts) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } return [x0, x1, y0, y1] }
    const fb = bb(fixedPts), fcx = (fb[0] + fb[1]) / 2, fcy = (fb[2] + fb[3]) / 2
    // дальние дома убираем первыми: сортируем по выходу за рамку стены
    // ширина плана = размах по x + поля 0.22·(больший размах) с двух сторон, поэтому выход вбок по x «стоит» дороже, чем вдоль y:
    // пригород вытягиваем вдоль y (город не круглый — П10), а поперёк режем
    const planW = (x0, x1, y0, y1) => x1 - x0 + 0.44 * Math.max(x1 - x0, y1 - y0)
    outs.forEach((o) => { const b = bb(o.r); o.k = planW(Math.min(fb[0], b[0]), Math.max(fb[1], b[1]), Math.min(fb[2], b[2]), Math.max(fb[3], b[3])) })
    outs.sort((a, b) => a.k - b.k)
    // оставляем самый длинный префикс, чей общий размах ≤ maxSpan
    let [x0, x1, y0, y1] = fb, keep = 0
    for (const o of outs) {
      const b = bb(o.r), nx0 = Math.min(x0, b[0]), nx1 = Math.max(x1, b[1]), ny0 = Math.min(y0, b[2]), ny1 = Math.max(y1, b[3])
      if (planW(nx0, nx1, ny0, ny1) > maxW) break
      ;[x0, x1, y0, y1] = [nx0, nx1, ny0, ny1]; keep++
    }
    const cut = outs.length - keep
    if (cut > 0) { outs.slice(keep).forEach(({ i }) => { houses[i] = null }); outN -= cut; log.push(`пригород ужат на ${cut} домов ради разноса особых зданий`) }
  }
  // проулки слободы, у которых не оказалось домов, убираем — дорога в никуда не нужна
  {
    const oc = houses.filter((h) => h && h.out).map((h) => lerp(h.q[0], h.q[2], 0.5))
    for (let i = outLines.length - 1; i >= 0; i--) {
      const m = outLines[i]
      if (m.lane && !oc.some((cc2) => { for (let j = 1; j < m.r.length; j++) if (segDist(cc2, m.r[j - 1], m.r[j]) < 13) return true; return false })) outLines.splice(i, 1)
    }
  }
  const lanes = outLines.filter((m) => m.lane)

  // ---- середина: центр всех вершин зданий (для правила center) ----
  // двор замка: службы, конюшни, казармы вдоль стены цитадели изнутри, а не пустое кольцо травы
  // цитадель без своего особого здания (не замок и не святыня): в середине двора — донжон, по кругу — казармы и склады
  let keepQ = null
  if (cit && type !== 'castle' && type !== 'shrine' && !spots.some((s) => Math.hypot(s.c[0] - cc[0], s.c[1] - cc[1]) < 6)) {
    for (const side of [18, 15, 12]) {
      const q = rect(cc[0], cc[1], Math.cos(ga), Math.sin(ga), side, side * 0.9)
      if (samples(q).every((t) => pip(t, cit) && roadIdx.clear(t) >= 0.4) && !reserved.some((z) => sat(q, z)) && !hit(q)) { keepQ = q; break }
    }
  }
  // особое здание (дворец, длинный дом) уже стоит в середине цитадели — оно и есть донжон, вокруг него тоже кольцо служб
  const midSpot = cit && type !== 'castle' && type !== 'shrine' && !keepQ ? spots.find((s) => Math.hypot(s.c[0] - cc[0], s.c[1] - cc[1]) < 6) : null
  const midZone = midSpot ? rect(midSpot.c[0], midSpot.c[1], midSpot.u[0], midSpot.u[1], midSpot.L + 4, midSpot.W + 4) : null
  if ((type === 'castle' || keepQ || midSpot) && cit) {
    const rcm = cit.reduce((t, q) => t + Math.hypot(q[0] - cc[0], q[1] - cc[1]), 0) / cit.length
    // малая цитадель (вписанный радиус < 32 м): кольцо считаем от ближней стены, службы мельче — иначе углы домов упираются в стену
    const rIn = edgeDist(cc, cit), small = type !== 'castle' && rIn < 32
    for (const dp of type === 'castle' ? [between(8, 10), between(6, 7.5)] : small ? [between(5, 6.5)] : [between(7, 9)]) {
      const rr = small ? rIn - 3.6 - dp / 2 - 1.4 : rcm - 4.5 - dp / 2 - (type === 'castle' && dp < 8 ? 11 : 0)
      for (let x = between(0, 4); x < 2 * Math.PI * rr; ) {
        const fw = type === 'castle' ? between(9, 15) : small ? between(6, 9) : between(8, 12), a = ga + 0.38 + (x + fw / 2) / rr
        x += fw + between(1.2, 2.5)
        if (adiff(a, ga) < 0.38) continue
        const p = [cc[0] + rr * Math.cos(a), cc[1] + rr * Math.sin(a)], q = rect(p[0], p[1], -Math.sin(a), Math.cos(a), fw, dp)
        if (!samples(q).every((t) => pip(t, cit) && edgeDist(t, cit) >= (type === 'castle' ? 3.2 : 3.6) && roadIdx.clear(t) >= (type === 'castle' ? 0.4 : 1.5))) continue
        if (reserved.some((z, zi) => !(small && spots[zi] === midSpot) && sat(q, z)) || hit(q) || (keepQ && sat(q, rect(cc[0], cc[1], Math.cos(ga), Math.sin(ga), 30, 30))) || (midZone && sat(q, midZone))) continue
        put(q, false); houses[houses.length - 1].ring = true
      }
    }
  }
  // углы дома не должны заходить на дорогу — common() проверяет только центр (запас 0.5 м под грубую сетку city-check)
  const onRoad = (h) => h.q.some((p) => roadIdx.clear(p) < 0.5)
  let live = houses.filter((h) => h && !onRoad(h))
  // П7: дом ставится по касательной «своей» улицы, а у стыков и проулков ближе бывает другая — доворачиваем к ближайшей
  {
    const segs = []
    for (const m of [...mains, ...streets, ...lanes]) for (let i = 1; i < m.r.length; i++) segs.push([m.r[i - 1], m.r[i]])
    const half = Math.PI / 2, lim = (15 * Math.PI) / 180
    live = live.filter((h) => {
      const q = h.q, c = lerp(q[0], q[2], 0.5)
      let bd = 30
      const dl = segs.map((g) => segDist(c, g[0], g[1])); for (const d of dl) if (d < bd) bd = d
      if (bd >= 30) return true
      const e1 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), e2 = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])
      if (Math.max(e1, e2) < 1.12 * Math.min(e1, e2)) return true
      // у излома дороги два отрезка почти на равном расстоянии, и city-check может взять любой: ставим дом посередине между ними
      const ha = Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0])
      const ds = segs.filter((g, gi) => dl[gi] < bd + 1.5).map((g) => { const sa = Math.atan2(g[1][1] - g[0][1], g[1][0] - g[0][0]); let d = (((sa - ha) % half) + half) % half; if (d > half / 2) d -= half; return d })
      if (ds.every((d) => Math.abs(d) <= lim)) return true
      const d = (Math.min(...ds) + Math.max(...ds)) / 2
      const cs = Math.cos(d), sn = Math.sin(d), nq = q.map(([x, y]) => [c[0] + (x - c[0]) * cs - (y - c[1]) * sn, c[1] + (x - c[0]) * sn + (y - c[1]) * cs])
      const id = houses.indexOf(h); houses[id] = null
      const ok = !onRoad({ q: nq }) && (h.ring ? samples(nq).every((t) => pip(t, cit) && edgeDist(t, cit) >= (type === 'castle' ? 3.2 : 3.6) && roadIdx.clear(t) >= 0.4) && !hit(nq) && !reserved.some((z) => sat(nq, z)) : (h.out ? okOut : okIn)(nq))
      houses[id] = h
      if (!ok) { houses[id] = null; return false }
      h.q = nq; return true
    })
  }
  // деревня: последний проход по П7 — дом, что у ближней улицы стоит под углом > 14°, убираем (city-check терпит 10% и считает по плану с округлением)
  if (type === 'village') {
    const sg = []
    for (const m of [...mains, ...streets, ...lanes]) for (let i = 1; i < m.r.length; i++) sg.push([m.r[i - 1], m.r[i]])
    live = live.filter((h) => {
      const q = h.q, c = lerp(q[0], q[2], 0.5), e1 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), e2 = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])
      if (Math.max(e1, e2) < 1.1 * Math.min(e1, e2)) return true
      let bd = 30, best = null
      for (const g of sg) { const d = segDist(c, g[0], g[1]); if (d < bd) { bd = d; best = g } }
      if (!best) return true
      const ha = e1 >= e2 ? Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]) : Math.atan2(q[3][1] - q[0][1], q[3][0] - q[0][0])
      let d = Math.abs(Math.atan2(best[1][1] - best[0][1], best[1][0] - best[0][0]) - ha) % (Math.PI / 2); d = Math.min(d, Math.PI / 2 - d)
      return d <= (14 * Math.PI) / 180
    })
  }
  // в 3D «замок/гнездо» в городе > 150 зданий рисуется крепостью 58×48 м на весь двор и накрывает кольцо служб (П3).
  // Порог считаем по итоговому числу зданий: либо убираем кольцо (крепость останется крупной), либо ужимаем пригород до 150
  if (midSpot && /замок|цитадел|гнездо/i.test(midSpot.lm.name)) {
    const nAll = live.length + spots.length, nRing = live.filter((h) => h.ring).length
    if (nAll > 150 && nAll - nRing > 150) { live = live.filter((h) => !h.ring); log.push(`кольцо служб снято: крепость «${midSpot.lm.name}» займёт весь двор`) }
    else if (nAll > 150) {
      const far = live.filter((h) => !h.ring).map((h) => [h, Math.hypot(h.q[0][0] - cc[0], h.q[0][1] - cc[1])]).sort((a, b) => b[1] - a[1]).slice(0, nAll - 150).map((e) => e[0])
      live = live.filter((h) => !far.includes(h)); log.push(`снято ${far.length} дальних домов, чтобы «${midSpot.lm.name}» осталось с кольцом служб`)
    }
  }
  const anchors = spots.filter((s) => s.lm.rule !== 'temple').map((s) => rect(s.c[0], s.c[1], s.u[0], s.u[1], s.L * 0.8, s.W * 0.8))
  const verts = [...live.flatMap((h) => h.q), ...anchors.flat()]
  const ce = [verts.reduce((a, p) => a + p[0], 0) / verts.length, verts.reduce((a, p) => a + p[1], 0) / verts.length]

  // ---- храм — призма с апсидой; прочие особые места — большие дома ----
  const prisms = []
  for (const s of spots.filter((s) => s.lm.rule === 'temple')) {
    // апсида входит в длину L (раньше торчала на W·0.4 за место под храм — туда вставали дома, П3)
    const L = s.L - 6, W = s.W - 3, [x, y] = s.c, ap = [], e = x + L / 2 - W * 0.4
    for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * Math.PI; ap.push([e + Math.cos(a) * W * 0.4, y + Math.sin(a) * W * 0.4]) }
    prisms.push([[x - L / 2, y - W / 2], [e - 0.01, y - W / 2], ...ap.slice(1, -1).map(([px, py]) => [px, py]), [e - 0.01, y + W / 2], [x - L / 2, y + W / 2]])
  }
  // донжон — особое здание (в 3D особое внутри цитадели становится башней-донжоном); после храмов, чтобы их номера не сдвинулись
  if (keepQ) prisms.push(keepQ)

  // ---- поля и сады за городом ----
  const fields = [], greens = []
  const freeOut = (q, pad) => samples(q, 4).every((p) => !pip(p, wall) && edgeDist(p, wall) >= pad && wetDist(p) >= 4 && roadIdx.clear(p) >= 2 && offCit(p, 10)) && !live.some((h) => Math.hypot(h.q[0][0] - q[0][0], h.q[0][1] - q[0][1]) < 120 && sat(h.q, q))
  for (const f of farms) {
    // поле хутора — за двором, вдоль его оси; второе — сбоку, если место свободно
    const t = Math.atan2(f.d[1], f.d[0])
    for (const [off, side] of [[24 + 22, 0], [24 + 8, 26], [24 + 8, -26], [-32, 0], [24 + 34, 20], [24 + 34, -20]]) {
      const cx = f.c[0] + f.d[0] * off - f.d[1] * side, cy = f.c[1] + f.d[1] * off + f.d[0] * side
      const q = rect(cx, cy, Math.cos(t), Math.sin(t), between(36, 52), between(18, 26))
      if (samples(q, 4).every((p) => !pip(p, plaza) && roadIdx.clear(p) >= 2 && wetDist(p) >= 4 && offCit(p, 10)) && !live.some((h) => sat(h.q, q)) && !fields.some((g) => sat(g, q))) { fields.push(q); break }
    }
  }
  for (let i = 0, made = 0; i < 260 && made < (G.fields ?? (LAY === 'farmsteads' ? 4 : 26)); i++) {
    const a = between(0, 2 * Math.PI), r = rBase(a) * between(1.35, 2.3), p = polar(r, a), t = a + Math.PI / 2 + between(-0.2, 0.2)
    const q = rect(p[0], p[1], Math.cos(t), Math.sin(t), between(40, 80), between(18, 32))
    if (freeOut(q, 30) && !fields.some((f) => sat(f, q))) { fields.push(q); made++ }
  }
  for (let i = 0, made = 0; i < 200 && made < (c.gen?.greens ? 4 : 1); i++) {
    const a = between(-Math.PI, 0), p = polar(rBase(a) + between(24, 50), a), t = a + Math.PI / 2
    const q = rect(p[0], p[1], Math.cos(t), Math.sin(t), between(36, 60), between(18, 26))
    if (freeOut(q, 14) && !fields.some((f) => sat(f, q)) && !greens.some((f) => sat(f, q))) { greens.push(q); made++ }
  }

  // ---- кварталы: секторы от центра, цитадель — свой квартал ----
  const nd = Math.max(1, (c.districts || []).length || 4), a0 = between(0, 2 * Math.PI), districts = []
  for (let i = 0; i < nd; i++) {
    const s0 = a0 + (i / nd) * 2 * Math.PI, s1 = a0 + ((i + 1) / nd) * 2 * Math.PI, pts = [O]
    for (let k = 0; k <= 8; k++) pts.push(polar(R * 6, s0 + ((s1 - s0) * k) / 8))
    districts.push(pts)
  }
  if (cit) districts.push(cit)

  // ---- вода на выход ----
  const rivers = [], water = [], planks = []
  if (type === 'river') { const r = []; for (let u = -R * 4; u <= R * 4; u += 10) r.push([u, shoreV(u)]); rivers.push({ r, w: ww }) }
  if (sea) {
    // извилистый берег — только у города; дальше прямой берег до далёких точек: city-maps берёт в рамку
    // ближние вершины воды, и длинный берег вдоль кадра раздувал ширину плана (П8 у Альбананы)
    const r = [], U = shoreU, F = R * 12
    for (let u = -U; u <= U; u += 10) r.push([u, shoreV(u)])
    water.push([[-F, D], ...r, [F, D], [F, D + F], [-F, D + F]])
    if (LAY === 'fishing') for (const u of jetU) planks.push({ r: [[u, shoreV(u) - 4], [u + between2(-2, 2), shoreV(u) + between2(14, 28)]], w: 3 })
    else for (let u = -R * 0.9 + between(0, 20); u < R * 0.9; u += between(28, 44)) planks.push({ r: [[u, quayV(u) + 3], [u + between(-3, 3), shoreV(u) + between(24, 44)]], w: 4 })
  }
  // ---- мосты: где дорога или улица проходит над рекой — прямой пролёт от берега до берега с заездом на сушу ----
  // (главная дорога от речных ворот всегда идёт за реку, так что на ней мост есть всегда; П11 city-check)
  const bridges = []
  if (type === 'river') for (const m of [...mains, ...lanes, ...streets]) {
    if (m.quay) continue
    const pts = dense(m.r, 1.5)
    for (let i = 0; i < pts.length; i++) {
      if (wetDist(pts[i]) >= 0) continue
      let j = i
      while (j + 1 < pts.length && wetDist(pts[j + 1]) < 0) j++
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, j + 1)]
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ex = 5
      bridges.push({ r: [[a[0] - (dx / L) * ex, a[1] - (dy / L) * ex], [b[0] + (dx / L) * ex, b[1] + (dy / L) * ex]], w: m.w + 1.5, main: !!m.gate })
      i = j
    }
  }

  return { R, el, ww, wall, open, noWall, market, cit, plaza, mains, streets, lanes, houses: live, spots, anchors, prisms, fields, greens, districts, rivers, water, planks, bridges, ce, log, inCount, outN, Nin, Nout, minD }
}

export default function organic(c) {
  const G = c.grow || {}
  // тип решает, что city-maps считает цитаделью: у замка — второе кольцо, у святыни — единственное (монастырь)
  const genBy = { castle: { citadel: 1, walls: 1 }, shrine: { citadel: 1, walls: 0 }, village: { citadel: 0, walls: 0 }, cross: { walls: 1 }, hill: { walls: 1 } }[G.type]
  if (genBy) c.gen = { ...(c.gen || {}), ...genBy }
  if (G.walls === 0 && ['road', 'cross', 'river', 'port'].includes(G.type || 'road')) c.gen = { ...(c.gen || {}), walls: 0 }
  // плотность подбираем: если внутри стены дома не помещаются (река, цитадель, площадь съели место) — город шире
  let dens = G.density ?? ({ farmsteads: 0.1, glade: 0.2 })[G.layout] ?? 0.33, L = null
  for (let k = 0; k < 6; k++) {
    const first = build(c, null, dens)
    L = build(c, first.ce, dens)
    if (L.inCount >= L.Nin * 0.97) break
    dens *= Math.max(0.6, Math.min(0.95, (L.inCount / L.Nin) ** 0.8))
  }
  // П10: город не круглый блин. Если пригород не вырос (река, разнос особых зданий его срезали) и форма своя по умолчанию —
  // вытягиваем стену, пока за стеной не станет четверть домов или форма не станет ≥ 1.5
  // П10: город не круглый блин. Если пригород не вырос (река, разнос особых зданий его срезали) и форма своя по умолчанию —
  // пробуем вытянуть стену или вынести больше домов за стену, пока за стеной не станет четверть домов
  // та же мера, что в city-check (П10): вытянутость центров домов (5–95%) и доля домов за стеной
  const ok10 = (X) => {
    const C = X.houses.map((h) => [h.q.reduce((a, p) => a + p[0], 0) / h.q.length, h.q.reduce((a, p) => a + p[1], 0) / h.q.length]), n = C.length
    if (n < 10) return 9
    const mx = C.reduce((a, p) => a + p[0], 0) / n, my = C.reduce((a, p) => a + p[1], 0) / n
    let sxx = 0, syy = 0, sxy = 0
    for (const [x, y] of C) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my) }
    const g = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(g), uy = Math.sin(g)
    const sp = (v) => (v.sort((p, q) => p - q), v[Math.floor(n * 0.95)] - v[Math.floor(n * 0.05)])
    const ratio = sp(C.map(([x, y]) => (x - mx) * ux + (y - my) * uy)) / Math.max(1, sp(C.map(([x, y]) => -(x - mx) * uy + (y - my) * ux)))
    return Math.max(ratio / 1.4, X.outN / n / 0.25)
  }
  if (G.stretch == null && G.type !== 'village' && ok10(L) < 1.04) {
    const own = c.grow, O = own.outside ?? 0.3
    const tries = [{ stretch: 1.5 }, { stretch: 1.8 }, { stretch: 2.1 }, { stretch: 1.8, outside: O + 0.12 }]
    let best = L, bestT = null
    for (const t of tries) {
      c.grow = { ...own, ...t }
      let d2 = dens, L2 = null
      for (let k = 0; k < 6; k++) {
        const first = build(c, null, d2)
        L2 = build(c, first.ce, d2)
        if (L2.inCount >= L2.Nin * 0.97) break
        d2 *= Math.max(0.6, Math.min(0.95, (L2.inCount / L2.Nin) ** 0.8))
      }
      if (ok10(L2) > ok10(best)) { best = L2; bestT = t }
      if (ok10(L2) >= 1.04) break
    }
    c.grow = own
    L = best
    if (bestT) L.log.push(`город-блин — ${Object.entries(bestT).map(([k, v]) => `${k} ${+v.toFixed(2)}`).join(', ')}`)
  }
  const center = L.spots.find((s) => s.lm.rule === 'center')
  if (center) { const d = Math.hypot(center.c[0] - L.ce[0], center.c[1] - L.ce[1]); if (d > 18) L.log.push(`«${center.lm.name}» в ${d.toFixed(0)} м от середины`) }

  // поворот на axis (градусы, y вниз) и flip в GeoJSON (y вверх)
  const a = ((G.axis ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a)
  const T = (r) => r.map(([u, v]) => [+(u * ca - v * sa).toFixed(2), +(-(u * sa + v * ca)).toFixed(2)])
  const poly = (list) => list.map((r) => [ring(T(r))])
  const lines = (list) => list.map((m) => ({ type: 'LineString', width: m.w, coordinates: T(m.r) }))
  const buildings = [...L.houses.map((h) => h.q), ...L.anchors]
  const N = buildings.length
  // какое здание чьё: особые места уже отведены генератором — city-maps берёт их отсюда, а не ищет по правилу
  const nh = L.houses.length, mons = L.spots.filter((s) => s.lm.rule !== 'temple'), tem = L.spots.filter((s) => s.lm.rule === 'temple')
  const fixedLm = [...mons.map((s, i) => ({ name: s.lm.name, b: nh + i })), ...tem.map((s, i) => ({ name: s.lm.name, b: N + i }))]
  const E = L.R * 8
  console.log(`  ${c.slug}: органика ${G.type}, домов ${N} (за стеной ${Math.round((L.outN / Math.max(1, N)) * 100)}%), R ${L.R.toFixed(0)} м${L.log.length ? ' — ' + L.log.join('; ') : ''}`)
  const dn = c.districts || []
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'values', roadWidth: 5, towerRadius: 7, wallThickness: 8, riverWidth: L.ww || 18, generator: 'gleuderoff-organic' },
      { type: 'Polygon', id: 'earth', coordinates: [ring(T([[-E, -E], [E, -E], [E, E], [-E, E]]))] },
      { type: 'GeometryCollection', id: 'roads', geometries: lines([...L.mains, ...L.lanes, ...L.streets]) },
      { type: 'GeometryCollection', id: 'walls', geometries: (L.open ? [L.cit] : L.noWall ? [L.cit] : [L.wall, L.cit]).filter(Boolean).map((w, i) => ({ type: 'Polygon', width: i || L.open ? 6 : 8, coordinates: [ring(T(w))] })) },
      { type: 'GeometryCollection', id: 'rivers', geometries: lines(L.rivers) },
      { type: 'GeometryCollection', id: 'planks', geometries: lines(L.planks) },
      { type: 'GeometryCollection', id: 'bridges', geometries: lines(L.bridges) },
      { type: 'MultiPolygon', id: 'buildings', coordinates: poly(buildings) },
      { type: 'MultiPolygon', id: 'prisms', coordinates: poly(L.prisms) },
      { type: 'MultiPolygon', id: 'squares', coordinates: poly(L.market ? [L.plaza, L.market] : [L.plaza]) },
      { type: 'MultiPolygon', id: 'greens', coordinates: poly(L.greens) },
      { type: 'MultiPolygon', id: 'fields', coordinates: poly(L.fields) },
      { type: 'MultiPoint', id: 'trees', coordinates: [] },
      { type: 'GeometryCollection', id: 'districts', geometries: L.districts.map((d, i) => ({ type: 'Polygon', name: dn[i] || '', coordinates: [ring(T(d))] })) },
      { type: 'MultiPolygon', id: 'water', coordinates: poly(L.water) },
      { type: 'Feature', id: 'landmarks', items: fixedLm }
    ]
  }
}
