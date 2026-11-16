// Автоматический grow для органических городов (docs/мастерская/8-как-строить-города.md, раздел 2, этап 3).
// Что рядом с поселением, берётся только из карт мира (их только читаем):
//   terrain.png — R высота, G класс местности ×40 (4 горы, 5 снега), B реки (>128), A суша (<128 — море);
//   source-maps/roads.json — дороги [{ type: paved|dirt|trail, pts:[[x,y]…] }] в координатах мира.
// Углы — градусы в осях мира (y вниз), как axis в city-organic.mjs: u = (cos axis, sin axis), v = axis+90 смотрит к воде.
// Ручной grow (cities.mjs, ORGANIC) главнее: этот модуль его не трогает.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const D = Math.PI / 180
const norm = (a) => ((a % 360) + 360) % 360
const diff = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return Math.min(d, 360 - d) }
const r5 = (a) => Math.round(norm(a) / 5) * 5 % 360

/** карты мира для growFor: рельеф и дороги (читаются один раз) */
export async function loadGrowMaps(worldWidth = 8192) {
  const { data, info } = await sharp('resources/default-world/maps/terrain.png').raw().toBuffer({ resolveWithObject: true })
  const roads = JSON.parse(readFileSync('source-maps/roads.json', 'utf8')).map((r) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of r.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    return { ...r, box: [x0, y0, x1, y1] }
  })
  return { data, info, k: info.width / worldWidth, roads }
}

function sampler({ data, info, k }) {
  return (x, y) => {
    const X = Math.max(0, Math.min(info.width - 1, Math.round(x * k))), Y = Math.max(0, Math.min(info.height - 1, Math.round(y * k)))
    const i = (Y * info.width + X) * info.channels
    return { h: data[i], cls: Math.round(data[i + 1] / 40), river: data[i + 2] > 128 && data[i + 3] >= 128, sea: data[i + 3] < 128 }
  }
}

/** море: средний вектор на воду в кольцах 4..40; null — моря нет */
function seaDir(at, x, y) {
  let sx = 0, sy = 0, n = 0, near = Infinity
  for (let r = 4; r <= 40; r += 4) for (let a = 0; a < 360; a += 10) {
    const dx = r * Math.cos(a * D), dy = r * Math.sin(a * D)
    if (at(x + dx, y + dy).sea) { sx += dx / r; sy += dy / r; n++; near = Math.min(near, r) }
  }
  if (n < 3 || Math.hypot(sx, sy) < 0.5) return null
  return { angle: Math.atan2(sy, sx) / D, near, share: n / (10 * 36) }
}

/** река: ближайшие речные пиксели в круге R (≈ провинция); ось — главная компонента, сторона воды — к их центру */
function riverDir(at, x, y, R = 70) {
  const all = []
  for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) if (dx * dx + dy * dy <= R * R && at(x + dx, y + dy).river) all.push([dx, dy, Math.hypot(dx, dy)])
  if (all.length < 3) return null
  const near = Math.min(...all.map((p) => p[2]))
  const pts = all.filter((p) => p[2] <= near + 25)
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  let cxx = 0, cxy = 0, cyy = 0
  for (const [a, b] of pts) { cxx += (a - mx) ** 2; cxy += (a - mx) * (b - my); cyy += (b - my) ** 2 }
  let axis = (0.5 * Math.atan2(2 * cxy, cxx - cyy)) / D
  // v = axis+90 должна смотреть на реку (на центр ближних речных пикселей)
  const vx = -Math.sin(axis * D), vy = Math.cos(axis * D)
  if (mx * vx + my * vy < 0) axis += 180
  return { axis: norm(axis), near: Math.round(near), count: pts.length }
}

/** выходы дорог: для каждой дороги рядом — точки в L по пути в обе стороны; близкие (<35°) сливаются */
function roadExits(roads, x, y, near = 8, L = 30) {
  const RANK = { paved: 3, dirt: 2, trail: 1 }
  const exits = []
  for (const r of roads) {
    const [x0, y0, x1, y1] = r.box
    if (x < x0 - near || x > x1 + near || y < y0 - near || y > y1 + near) continue
    const P = r.pts
    let best = Infinity, bi = -1, bt = 0
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy)
      if (d < best) { best = d; bi = i; bt = t }
    }
    if (best > near) continue
    const walk = (dir) => {
      let [px, py] = [P[bi][0] + (P[bi + 1][0] - P[bi][0]) * bt, P[bi][1] + (P[bi + 1][1] - P[bi][1]) * bt]
      let i = dir > 0 ? bi + 1 : bi, left = L
      while (i >= 0 && i < P.length) {
        const [qx, qy] = P[i], s = Math.hypot(qx - px, qy - py)
        if (s >= left) { px += ((qx - px) * left) / s; py += ((qy - py) * left) / s; left = 0; break }
        left -= s; px = qx; py = qy; i += dir
      }
      return Math.hypot(px - x, py - y) >= L * 0.5 ? Math.atan2(py - y, px - x) / D : null
    }
    for (const a of [walk(1), walk(-1)]) if (a !== null) exits.push({ a: norm(a), rank: RANK[r.type] ?? 1 })
  }
  exits.sort((p, q) => q.rank - p.rank)
  const merged = []
  for (const e of exits) { const m = merged.find((g) => diff(g.a, e.a) < 35); if (m) m.rank = Math.max(m.rank, e.rank); else merged.push({ ...e }) }
  return merged
}

/** уклон: направление вверх по склону и перепад высоты в кольце r */
function slope(at, x, y, r = 12) {
  let gx = 0, gy = 0, lo = 255, hi = 0
  for (let a = 0; a < 360; a += 30) { const h = at(x + r * Math.cos(a * D), y + r * Math.sin(a * D)).h; gx += h * Math.cos(a * D); gy += h * Math.sin(a * D); lo = Math.min(lo, h); hi = Math.max(hi, h) }
  return { up: Math.atan2(gy, gx) / D, drop: hi - lo }
}

const SHRINE = /монастыр|обител|паломни|святын|скит|аббатств/i
const RIVER = /(^|[^а-яё])(мост|брод)|над рекой|на реке|у реки|по реке|рекой|реку/i
const CASTLE = /замок дома|замковая гора|гнездо|кастра [IVX]+|крепост|цитадел/i

/**
 * Авто-grow для поселения.
 * s: { x, y, type } — settlement (type: city|town|port|castle|castra|temple|tower|village|fishing);
 * o: { capital, text, terrain (1–6 провинции), seed }.
 * Возвращает { grow, why } — why: короткая строка «что увидели на карте».
 */
export function growFor(maps, s, o = {}) {
  const at = sampler(maps)
  const seed = o.seed ?? 1
  const text = o.text ?? ''
  const here = at(s.x, s.y)
  const sea = seaDir(at, s.x, s.y)
  const riv = riverDir(at, s.x, s.y)
  const rivText = !riv && RIVER.test(text)
  const ex = roadExits(maps.roads, s.x, s.y)
  const big = ex.filter((e) => e.rank >= 2)
  const main = (big.length ? big : ex)[0] ?? null
  const sl = slope(at, s.x, s.y)
  const mountain = here.cls >= 4 || (o.terrain ?? 0) >= 4
  const highland = mountain && (here.h > 90 || sl.drop > 25)
  const kind = o.capital ? 'capital' : s.type
  const coastOk = sea && (s.type === 'port' || s.type === 'fishing' || o.coastal || sea.near <= 16)

  // размер по разделу 2 (домов всего / доля вне стен)
  const span = (lo, hi) => lo + (seed % (hi - lo + 1))
  const SIZE = { capital: [1200, 2200, 0.4], city: [400, 1000, 0.35], port: [150, 450, 0.32], town: [80, 250, 0.3], castra: [80, 160, 0.2], castle: [60, 140, 0.25], temple: [50, 120, 0], tower: [40, 90, 0.2], village: [15, 60, 0], fishing: [15, 45, 0] }
  const [lo, hi, out] = SIZE[kind] ?? SIZE.town
  let houses = span(lo, hi)
  if (kind === 'port' && !o.capital) houses = span(150, 450)

  const why = []
  if (sea) why.push(`море ${r5(sea.angle)}° в ${sea.near}`)
  if (riv) why.push(`река ось ${r5(riv.axis)}° в ${riv.near}`)
  if (rivText) why.push('река по описанию')
  if (ex.length) why.push(`дороги ${ex.map((e) => `${r5(e.a)}${'·:#'[e.rank - 1]}`).join(' ')}`)
  if (mountain) why.push(`горы h${here.h} перепад ${sl.drop}`)

  const roadAxis = main ? main.a : null
  // ось вдоль долины: поперёк подъёма
  const valleyAxis = sl.up + 90
  const g = (type, extra = {}) => ({ type, houses, outside: out, ...extra })
  let grow

  if (kind === 'village' || kind === 'fishing') {
    // село: у моря/реки — вдоль берега, иначе вдоль дороги; россыпь — если дороги нет
    const axis = kind === 'fishing' && sea ? sea.angle - 90 : riv ? riv.axis : roadAxis ?? (sea ? sea.angle - 90 : seed % 180)
    grow = { type: 'village', houses, layout: main || riv || sea ? 'street' : 'scatter', axis: r5(axis) }
  } else if (['castle', 'castra', 'tower'].includes(kind)) {
    // замок на высоком краю: citadelAngle = π — конец u<0, значит u смотрит от подъёма (вниз) к воротам
    const axis = sl.drop > 6 ? sl.up + 180 : roadAxis ?? seed % 360
    grow = g('castle', { axis: r5(axis), roads: Math.max(2, Math.min(4, ex.length || 2)) })
  } else if (kind === 'temple' || SHRINE.test(text) && kind !== 'city' && !o.capital && kind !== 'port') {
    grow = g('shrine', { axis: r5(roadAxis ?? valleyAxis), roads: Math.max(2, Math.min(4, ex.length || 2)) })
    grow.outside = 0
  } else if (coastOk) {
    grow = g('port', { axis: r5(sea.angle - 90), roads: Math.max(2, Math.min(4, big.length || ex.length || 2)) })
    if (kind !== 'port' && kind !== 'capital' && kind !== 'city') grow.houses = Math.max(houses, 150)
  } else if (riv) {
    const water = Math.max(14, Math.min(26, Math.round(12 + riv.count / 6)))
    grow = g('river', { axis: r5(riv.axis), roads: Math.max(2, Math.min(4, ex.length || 3)), water })
  } else if (rivText) {
    // река только в лоре (мост, брод): дорога идёт через мост, значит река поперёк главной дороги
    grow = g('river', { axis: r5(roadAxis !== null ? roadAxis + 90 : seed % 360), roads: Math.max(2, Math.min(4, ex.length || 3)), water: 18 })
  } else if (big.length >= 3 || ex.length >= 4) {
    const list = (big.length >= 3 ? big : ex).slice(0, 5)
    const ax = list[0].a
    grow = g('cross', { axis: r5(ax), dirs: list.map((e) => r5(e.a - ax)), roads: list.length })
    grow.outside = Math.max(out, 0.35)
  } else if (highland) {
    grow = g('hill', { axis: r5(roadAxis ?? valleyAxis), roads: 2 })
    grow.outside = 0
  } else if (CASTLE.test(text)) {
    grow = g('castle', { axis: r5(sl.drop > 6 ? sl.up + 180 : roadAxis ?? seed % 360), roads: Math.max(2, Math.min(4, ex.length || 2)) })
    grow.outside = 0.28
  } else {
    grow = g('road', { axis: r5(roadAxis ?? valleyAxis), roads: Math.max(2, Math.min(4, ex.length || 2)) })
  }
  return { grow, why: why.join('; ') || 'рядом ничего' }
}
