// Проверка плана города по правилам П1–П11 (docs/мастерская/8-как-строить-города.md).
// Читает resources/default-world/maps/cities/<slug>.plan.json, переводит в метры так же, как city3d.ts,
// и печатает ОДНУ строку на город: «slug ок» или «slug П1(Б2)×14 П4(Б1)×2».
//   node scripts/city-check.mjs erin hausser      — эти города
//   node scripts/city-check.mjs all                — все планы (в конце итог)
//   node scripts/city-check.mjs -v erin            — плюс до 3 примеров на правило (координаты в метрах)
import { readFileSync, readdirSync, existsSync } from 'fs'

process.removeAllListeners('warning')
const { monumentKind, MON_SIZE } = await import('../src/renderer/src/city3dMonuments.ts')

const DIR = 'resources/default-world/maps/cities'
const args = process.argv.slice(2)
const verbose = args.includes('-v')
let slugs = args.filter((a) => !a.startsWith('-'))
if (slugs.includes('all')) slugs = readdirSync(DIR).filter((f) => f.endsWith('.plan.json')).map((f) => f.slice(0, -10)).sort()
if (!slugs.length) { console.log('нужны slug’и городов или all'); process.exit(1) }

// ---------- геометрия (как в city3d.ts) ----------
const ringOf = (flat, k, from = 0) => { const r = []; for (let i = from; i + 1 < flat.length; i += 2) r.push([flat[i] / k, flat[i + 1] / k]); return r }
const areaOf = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; s += p[0] * q[1] - q[0] * p[1] } return s / 2 }
const centerOf = (r) => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1] } return [x / r.length, y / r.length] }
const segCross = (a, b, c, d) => {
  const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
  if (Math.abs(r) < 1e-6) return null
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}
const pointIn = (p, r) => {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j]
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}
const obbOf = (r) => {
  let best = null
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 0.01) continue
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len
    let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9
    for (const p of r) { const s = p[0] * ux + p[1] * uz, t = -p[0] * uz + p[1] * ux; a0 = Math.min(a0, s); a1 = Math.max(a1, s); c0 = Math.min(c0, t); c1 = Math.max(c1, t) }
    const area = (a1 - a0) * (c1 - c0)
    if (!best || area < best.area) {
      const ms = (a0 + a1) / 2, mt = (c0 + c1) / 2, cx = ms * ux - mt * uz, cz = ms * uz + mt * ux
      best = a1 - a0 >= c1 - c0 ? { area, ux, uz, cx, cz, L: a1 - a0, W: c1 - c0 } : { area, ux: -uz, uz: ux, cx, cz, L: c1 - c0, W: a1 - a0 }
    }
  }
  return best
}
const townScale = (n) => (n < 60 ? 0.42 : n < 150 ? 0.62 : n < 500 ? 0.84 : 1)
const inRect = (m, x, z, pad) => { const dx = x - m.cx, dz = z - m.cz; return Math.abs(dx * m.ux + dz * m.uz) <= m.L / 2 + pad && Math.abs(-dx * m.uz + dz * m.ux) <= m.W / 2 + pad }
const rectCorners = (m) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [m.cx + (a * m.L) / 2 * m.ux - (b * m.W) / 2 * m.uz, m.cz + (a * m.L) / 2 * m.uz + (b * m.W) / 2 * m.ux])

// метки нарушений; Б — номер беды из руководства
const TAG = { П1: 'П1(Б2)', П2: 'П2', П3: 'П3(Б3)', П4: 'П4(Б1)', П5: 'П5', П6: 'П6', П7: 'П7(Б5)', П8: 'П8(Б6)', П9: 'П9', П10: 'П10', П11: 'П11' }

function check(slug) {
  const file = `${DIR}/${slug}.plan.json`
  if (!existsSync(file)) return { line: `${slug} нет плана` }
  const plan = JSON.parse(readFileSync(file, 'utf8')), S = plan.scene || {}
  const areas = plan.buildings.map((b) => Math.abs(areaOf(ringOf(b, 1, 2)))).sort((a, b) => a - b)
  const med = areas[areas.length >> 1] || 300
  const k = Math.max(0.6, Math.min(Math.sqrt(med / 62), 12))
  const W = plan.w / k, H = plan.h / k
  const lines = (arr) => (arr || []).map((q) => ({ r: ringOf(q.r, k), w: q.w / k }))
  const roads = lines(S.roads), rivers = lines(S.rivers), planks = lines(S.planks), walls = lines(S.walls)
  const waters = (S.water || []).map((f) => ringOf(f, k)), squares = (S.squares || []).map((f) => ringOf(f, k))
  const blds = plan.buildings.map((b) => ringOf(b, k, 2))
  const N = blds.length
  const cents = blds.map(centerOf)
  const lmSet = new Set((plan.landmarks || []).map((l) => l.b))
  const bad = {}, ex = {}
  const hit = (rule, n = 1, where) => { bad[rule] = (bad[rule] || 0) + n; if (where && verbose) (ex[rule] ||= []).length < 3 && ex[rule].push(where) }
  const at = (p) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`

  // ---------- сетка: что где лежит ----------
  const cell = Math.max(0.5, Math.max(W, H) / 3000)
  const gw = Math.ceil(W / cell) + 1, gh = Math.ceil(H / cell) + 1
  const F_ROAD = 1, F_WALL = 2, F_WATER = 4, F_SQ = 8, F_PLANK = 16
  const flag = new Uint8Array(gw * gh)
  const polyFill = (r, cb) => {
    let a = 1e9, b = -1e9
    for (const p of r) { a = Math.min(a, p[1]); b = Math.max(b, p[1]) }
    const y0 = Math.max(0, Math.floor(a / cell)), y1 = Math.min(gh - 1, Math.ceil(b / cell))
    for (let j = y0; j <= y1; j++) {
      const y = (j + 0.5) * cell, xs = []
      for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; if (p[1] > y !== q[1] > y) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0])) }
      xs.sort((m, n) => m - n)
      for (let n = 0; n + 1 < xs.length; n += 2) for (let i = Math.max(0, Math.ceil(xs[n] / cell - 0.5)); i <= Math.min(gw - 1, Math.floor(xs[n + 1] / cell - 0.5)); i++) cb(j * gw + i)
    }
  }
  const lineFill = (r, w, closed, cb) => {
    const n = r.length, segs = closed ? n : n - 1
    for (let s = 0; s < segs; s++) {
      const a = r[s], b = r[(s + 1) % n], h = w / 2
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - h) / cell)), i1 = Math.min(gw - 1, Math.ceil((Math.max(a[0], b[0]) + h) / cell))
      const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - h) / cell)), j1 = Math.min(gh - 1, Math.ceil((Math.max(a[1], b[1]) + h) / cell))
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segDist([(i + 0.5) * cell, (j + 0.5) * cell], a, b) < h) cb(j * gw + i)
    }
  }
  roads.forEach((q) => lineFill(q.r, q.w, false, (c) => (flag[c] |= F_ROAD)))
  planks.forEach((q) => lineFill(q.r, Math.max(q.w, 3), false, (c) => (flag[c] |= F_PLANK)))
  rivers.forEach((q) => lineFill(q.r, q.w, false, (c) => (flag[c] |= F_WATER)))
  waters.forEach((r) => polyFill(r, (c) => (flag[c] |= F_WATER)))
  squares.forEach((r) => polyFill(r, (c) => (flag[c] |= F_SQ)))
  const wallTh = (w) => Math.max(1.8, Math.min(3.2, w.w / 2))
  walls.forEach((w) => lineFill(w.r, wallTh(w), true, (c) => (flag[c] |= F_WALL)))
  const flagAt = (p) => { const i = Math.floor(p[0] / cell), j = Math.floor(p[1] / cell); return i < 0 || j < 0 || i >= gw || j >= gh ? 0 : flag[j * gw + i] }

  // ---------- П1: дома не налезают, зазор ≥0.4 м ----------
  {
    const c1 = 0.4, g1w = Math.ceil(W / c1) + 2, g1h = Math.ceil(H / c1) + 2
    if (g1w * g1h < 6e7) {
      const own = new Int32Array(g1w * g1h), pairs = new Set(), loser = new Set()
      blds.forEach((r, bi) => {
        if (r.length < 3) return
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
        for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
        for (let j = Math.max(0, Math.floor((y0 - 0.2) / c1)); j <= Math.min(g1h - 1, Math.floor((y1 + 0.2) / c1)); j++)
          for (let i = Math.max(0, Math.floor((x0 - 0.2) / c1)); i <= Math.min(g1w - 1, Math.floor((x1 + 0.2) / c1)); i++) {
            const p = [(i + 0.5) * c1, (j + 0.5) * c1]
            let inn = pointIn(p, r)
            if (!inn) for (let e = 0; e < r.length && !inn; e++) inn = segDist(p, r[e], r[(e + 1) % r.length]) < 0.2
            if (!inn) continue
            const o = own[j * g1w + i] - 1
            if (o >= 0 && o !== bi) {
              const key = o * 100000 + bi
              if (!pairs.has(key)) { pairs.add(key); const sm = Math.abs(areaOf(blds[o])) < Math.abs(areaOf(r)) ? o : bi; if (!loser.has(sm)) { loser.add(sm); hit('П1', 1, at(cents[sm])) } }
            } else own[j * g1w + i] = bi + 1
          }
      })
    }
  }

  // ---------- П2: дом вне дорог, стен, воды, площадей ----------
  blds.forEach((r, bi) => {
    if (lmSet.has(bi) || r.length < 3) return
    const c = cents[bi]
    const pts = [c, ...r.map((p) => [p[0] + (c[0] - p[0]) * 0.08, p[1] + (c[1] - p[1]) * 0.08])]
    if (pts.some((p) => flagAt(p) & (F_ROAD | F_WALL | F_WATER | F_SQ | F_PLANK))) hit('П2', 1, at(c))
  })

  // ---------- П3: место под особое здание свободно от домов ----------
  const hub = squares.length ? centerOf(squares[0]) : [W / 2, H / 2]
  const mons = []
  for (const lm of plan.landmarks || []) {
    const r = blds[lm.b]
    if (!r || r.length < 3) continue
    const kind = monumentKind(lm.name, N)
    if (!kind) continue
    const o = obbOf(r)
    if (!o) continue
    const ts = townScale(N), want = MON_SIZE[kind]
    let L = Math.max(o.L, want[0] * ts), Wd = Math.max(o.W, want[1] * ts), placed = null
    void hub
    for (let t = 0; t < 5 && !placed; t++) {
      const m = { ...o, L, W: Wd }
      const free = !rectCorners(m).some((p) => p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) && (() => {
        for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
          const x = m.cx + ((a / 3) * m.L) / 2 * m.ux - ((b / 3) * m.W) / 2 * m.uz, z = m.cz + ((a / 3) * m.L) / 2 * m.uz + ((b / 3) * m.W) / 2 * m.ux
          if (flagAt([x, z]) & (F_WALL | F_WATER | F_PLANK)) return false
        }
        return true
      })()
      if (free) placed = m
      L = Math.max(o.L, L * 0.84); Wd = Math.max(o.W, Wd * 0.84)
    }
    mons.push({ m: placed || { ...o }, b: lm.b })
  }
  for (const { m, b } of mons) {
    const cs = rectCorners({ ...m, L: m.L + 3, W: m.W + 3 })
    blds.forEach((r, bi) => {
      if (bi === b || lmSet.has(bi) || r.length < 3) return
      const c = cents[bi]
      if (Math.hypot(c[0] - m.cx, c[1] - m.cz) > m.L + 60) return
      let touch = r.some((p) => inRect(m, p[0], p[1], 1.5)) || cs.some((p) => pointIn(p, r))
      if (!touch) for (let e = 0; e < r.length && !touch; e++) for (let f = 0; f < 4 && !touch; f++) touch = segCross(r[e], r[(e + 1) % r.length], cs[f], cs[(f + 1) % 4]) !== null
      if (touch) hit('П3', 1, at(c))
    })
  }

  // ---------- П4: стена не пересекает реку и не стоит в воде ----------
  for (const w of walls) for (let i = 0; i < w.r.length; i++) {
    const a = w.r[i], b = w.r[(i + 1) % w.r.length], len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 0.5) continue
    let crossed = rivers.some((q) => q.r.some((p, s) => s > 0 && segCross(a, b, q.r[s - 1], p) !== null))
    if (!crossed) for (let t = 0.5; t < len && !crossed; t += 2) { const p = [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]; crossed = waters.some((r) => pointIn(p, r)) }
    if (crossed) hit('П4', 1, at(a))
  }

  // ---------- П5: ворота только на дорогах, у каждой дороги через стену — ворота ----------
  // а) дорога упирается в стену и не проходит её; б) ворота попадают в угловую башню
  const GATE = 4.2, towerR = Math.max(2.4, Math.min(4.4, ((S.tower || 0) / k) * 0.9))
  for (const w of walls) {
    const segs = w.r.map((a, i) => [a, w.r[(i + 1) % w.r.length]])
    for (const q of roads) {
      let crosses = false
      for (let s = 1; s < q.r.length; s++) for (const [a, b] of segs) {
        const t = segCross(a, b, q.r[s - 1], q.r[s])
        if (t === null) continue
        crosses = true
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), g = t * len
        if (g < GATE + towerR * 0.5 || len - g < GATE + towerR * 0.5) hit('П5', 1, at([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]))
      }
      if (!crosses) for (const end of [q.r[0], q.r[q.r.length - 1]]) if (segs.some(([a, b]) => segDist(end, a, b) < 3)) hit('П5', 1, at(end))
    }
  }

  // ---------- П6: к каждому дому есть проход с улицы ----------
  {
    const c6 = Math.max(0.8, cell), g6w = Math.ceil(W / c6) + 1, g6h = Math.ceil(H / c6) + 1
    const occ = new Int32Array(g6w * g6h) // >0 дом+1, -1 стена/вода
    const at6 = (p) => { const i = Math.floor(p[0] / c6), j = Math.floor(p[1] / c6); return i < 0 || j < 0 || i >= g6w || j >= g6h ? -1 : j * g6w + i }
    for (let j = 0; j < g6h; j++) for (let i = 0; i < g6w; i++) { const f = flagAt([(i + 0.5) * c6, (j + 0.5) * c6]); if (f & (F_WALL | F_WATER)) occ[j * g6w + i] = -1 }
    blds.forEach((r, bi) => {
      if (r.length < 3) return
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
      for (let j = Math.max(0, Math.floor(y0 / c6)); j <= Math.min(g6h - 1, Math.floor(y1 / c6)); j++)
        for (let i = Math.max(0, Math.floor(x0 / c6)); i <= Math.min(g6w - 1, Math.floor(x1 / c6)); i++) if (pointIn([(i + 0.5) * c6, (j + 0.5) * c6], r)) occ[j * g6w + i] = bi + 1
    })
    const seen = new Uint8Array(g6w * g6h), stack = []
    for (let j = 0; j < g6h; j++) for (let i = 0; i < g6w; i++) {
      const c = j * g6w + i, f = flagAt([(i + 0.5) * c6, (j + 0.5) * c6])
      if (occ[c] === 0 && (f & (F_ROAD | F_SQ | F_PLANK) || (!roads.length && (i === 0 || j === 0 || i === g6w - 1 || j === g6h - 1)))) { seen[c] = 1; stack.push(c) }
    }
    while (stack.length) {
      const c = stack.pop(), i = c % g6w, j = (c - i) / g6w
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj
        if (ni < 0 || nj < 0 || ni >= g6w || nj >= g6h) continue
        const n = nj * g6w + ni
        if (!seen[n] && occ[n] === 0) { seen[n] = 1; stack.push(n) }
      }
    }
    blds.forEach((r, bi) => {
      if (r.length < 3) return
      const c = cents[bi]
      let ok = false
      for (let e = 0; e < r.length && !ok; e++) {
        const a = r[e], b = r[(e + 1) % r.length], len = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (len < 0.1) continue
        let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        if ((mid[0] - c[0]) * nx + (mid[1] - c[1]) * nz < 0) { nx = -nx; nz = -nz }
        for (let t = 0.15; t < 1 && !ok; t += 0.35) { const id = at6([a[0] + (b[0] - a[0]) * t + nx * c6 * 1.2, a[1] + (b[1] - a[1]) * t + nz * c6 * 1.2]); ok = id >= 0 && seen[id] === 1 }
      }
      if (!ok) hit('П6', 1, at(c))
    })
  }

  // ---------- П7: дом повёрнут к ближайшей улице (±20°), допускается 10% ----------
  {
    const B = 25, idx = new Map(), segs = []
    roads.forEach((q) => { for (let s = 1; s < q.r.length; s++) segs.push([q.r[s - 1], q.r[s]]) })
    segs.forEach((sg, si) => {
      const [a, b] = sg
      for (let i = Math.floor(Math.min(a[0], b[0]) / B); i <= Math.floor(Math.max(a[0], b[0]) / B); i++)
        for (let j = Math.floor(Math.min(a[1], b[1]) / B); j <= Math.floor(Math.max(a[1], b[1]) / B); j++) { const key = i * 10007 + j; if (!idx.has(key)) idx.set(key, []); idx.get(key).push(si) }
    })
    let viol = 0, total = 0, first = []
    blds.forEach((r, bi) => {
      if (lmSet.has(bi) || r.length < 3) return
      const c = cents[bi], ci = Math.floor(c[0] / B), cj = Math.floor(c[1] / B)
      let best = null, bd = 30
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const si of idx.get(i * 10007 + j) || []) { const d = segDist(c, segs[si][0], segs[si][1]); if (d < bd) { bd = d; best = segs[si] } }
      if (!best) return
      const o = obbOf(r)
      if (!o || o.L < 1.15 * o.W) return // почти квадратный — любая сторона годится
      total++
      const sa = Math.atan2(best[1][1] - best[0][1], best[1][0] - best[0][0]), ha = Math.atan2(o.uz, o.ux)
      let d = Math.abs(sa - ha) % (Math.PI / 2); d = Math.min(d, Math.PI / 2 - d)
      if (d > (20 * Math.PI) / 180) { viol++; if (first.length < 3) first.push(at(c)) }
    })
    if (total && viol / total > 0.1) { bad.П7 = viol; if (verbose) ex.П7 = first }
  }

  // ---------- П8: особые здания не ближе 12% ширины плана ----------
  {
    const lms = (plan.landmarks || []).filter((l) => blds[l.b]?.length >= 3)
    for (let i = 0; i < lms.length; i++) for (let j = i + 1; j < lms.length; j++) {
      const a = cents[lms[i].b], b = cents[lms[j].b]
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.12 * W) hit('П8', 1, `${lms[i].name} ↔ ${lms[j].name}`)
    }
  }

  // ---------- П9: не больше 5000 домов ----------
  if (N > 5000) hit('П9', N - 5000)

  // ---------- П10: город не круглый блин ----------
  let shape = ''
  if (N >= 10) {
    const mx = cents.reduce((s, c) => s + c[0], 0) / N, my = cents.reduce((s, c) => s + c[1], 0) / N
    let sxx = 0, syy = 0, sxy = 0
    for (const c of cents) { sxx += (c[0] - mx) ** 2; syy += (c[1] - my) ** 2; sxy += (c[0] - mx) * (c[1] - my) }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang)
    const along = cents.map((c) => (c[0] - mx) * ux + (c[1] - my) * uy).sort((a, b) => a - b)
    const across = cents.map((c) => -(c[0] - mx) * uy + (c[1] - my) * ux).sort((a, b) => a - b)
    const span = (v) => v[Math.floor(v.length * 0.95)] - v[Math.floor(v.length * 0.05)]
    const ratio = span(along) / Math.max(1, span(across))
    // доля домов вне стен: самая длинная стена как кольцо
    let outside = 1
    const ring = walls.slice().sort((a, b) => b.r.length - a.r.length)[0]
    if (ring && ring.r.length >= 3) outside = cents.filter((c) => !pointIn(c, ring.r)).length / N
    shape = `форма ${ratio.toFixed(2)}, вне стен ${(outside * 100).toFixed(0)}%`
    if (ratio < 1.4 && outside < 0.25) hit('П10', 1, shape)
  }

  // ---------- П11: дорога или улица над водой без моста ----------
  // вода — река (линия с шириной) или водоём; мост — scene.bridges (полоса шириной w), причал — planks
  {
    const bridges = lines(S.bridges)
    const onLine = (p, q, pad) => q.r.some((a, i) => i && segDist(p, q.r[i - 1], a) <= q.w / 2 + pad)
    const wetAt = (p) => rivers.some((q) => onLine(p, q, -0.5)) || waters.some((r) => pointIn(p, r))
    const dryWay = (p) => bridges.some((q) => onLine(p, q, 0.3)) || planks.some((q) => onLine(p, q, 0.3))
    for (const q of roads) {
      let run = false
      for (let i = 1; i < q.r.length; i++) {
        const a = q.r[i - 1], b = q.r[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2))
        for (let t = 0; t <= n; t++) {
          const p = [a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n]
          const badP = wetAt(p) && !dryWay(p)
          if (badP && !run) hit('П11', 1, `(${p[0].toFixed(0)}, ${p[1].toFixed(0)})`)
          run = badP
        }
      }
    }
  }

  const keys = Object.keys(TAG).filter((r) => bad[r])
  const line = keys.length ? `${slug} ${keys.map((r) => `${TAG[r]}×${bad[r]}`).join(' ')}` : `${slug} ок`
  const more = verbose ? [`  домов ${N}, масштаб k=${k.toFixed(2)}, план ${W.toFixed(0)}×${H.toFixed(0)} м, ${shape}`, ...keys.map((r) => `  ${r}: ${(ex[r] || []).join(' | ')}`)] : []
  return { line, ok: !keys.length, more }
}

let okN = 0
for (const s of slugs) {
  let res
  try { res = check(s) } catch (e) { res = { line: `${s} ошибка: ${e.message}` } }
  console.log(res.line)
  for (const m of res.more || []) console.log(m)
  if (res.ok) okN++
}
if (slugs.length > 1) console.log(`итого: ок ${okN} из ${slugs.length}`)
