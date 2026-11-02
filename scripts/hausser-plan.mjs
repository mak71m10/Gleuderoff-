// План Хауссера по эскизу автора (02.11.2026): круглый город в стене, в центре — Дистрикт Альфа (владения
// Монстаргов), вокруг по часовой стрелке от верха — Омега (трущобы), Матра (горожане), Дельта (знать и
// министерства, замок Верховного совета у границы с Альфой), Бета (генералитет), Браво (цеха).
// Генератор Watabou такую планировку не строит, поэтому план собирается здесь — в том же формате, что и его
// выгрузка (FeatureCollection, ось y вверх), и дальше рисуется общим кодом scripts/city-maps.mjs.
// У каждого дистрикта свой узор улиц (сетка, кольца, лабиринт) и свой цвет крыш, как на эскизе.

const rnd = (seed) => () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0), seed / 4294967296)
const deg = Math.PI / 180
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)]
const inside = ([x, y], r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c } return c }
const segDist = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
const edgeDist = (p, poly) => Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length])))
const circle = (cx, cy, r, n = 24, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(a0 + (i / n) * 2 * Math.PI), cy + r * Math.sin(a0 + (i / n) * 2 * Math.PI)])
const ring = (pts) => [...pts, pts[0]]

const R = 1000 // внешняя стена
const RA = 250 // стена Альфы
const SPAN = 34 // полуширина дистрикта, градусы (между ними — бульвары)

/** Узоры улиц: отображение «координаты кварталов» (u, v) → точка плана */
const grid = (o, ang, warp = 0, seed = 1) => {
  const e1 = [Math.cos(ang), Math.sin(ang)], e2 = [-Math.sin(ang), Math.cos(ang)]
  const ph = [seed * 1.7, seed * 2.3, seed * 0.9, seed * 3.1]
  return (u, v) => [
    o[0] + u * e1[0] + v * e2[0] + warp * (Math.sin(v / 47 + ph[0]) + 0.6 * Math.sin(u / 29 + v / 61 + ph[1])),
    o[1] + u * e1[1] + v * e2[1] + warp * (Math.sin(u / 43 + ph[2]) + 0.6 * Math.sin(v / 31 - u / 53 + ph[3]))
  ]
}
const rings = (c, r0) => (u, v) => [c[0] + u * Math.cos(v / r0), c[1] + u * Math.sin(v / r0)]

export default function buildHausser(c) {
  const rand = rnd(c.seed ?? 977)
  const between = (a, b) => a + (b - a) * rand()
  const buildings = []
  const prisms = []
  const squares = []
  const greens = []
  const fields = []
  const roads = []

  // ---- дистрикты: пятиугольники между бульварами ----
  const sectorPoly = (a) => [polar(RA + 18, (a - SPAN + 3) * deg), polar(R * 0.9, (a - SPAN) * deg), polar(R * 0.975, a * deg), polar(R * 0.9, (a + SPAN) * deg), polar(RA + 18, (a + SPAN - 3) * deg)]
  const alpha = circle(0, 0, RA, 8, 22.5 * deg)
  const D = [
    { ru: 'Омега', a: -90, roof: ['#6f7a5c', '#7a8566', '#65704f', '#808b6c'], fill: '#c8c9ac' },
    { ru: 'Матра', a: -18, roof: ['#b8774f', '#c4865c', '#a96a45', '#bf7d55'], fill: '#e0cfae' },
    { ru: 'Дельта', a: 54, roof: ['#5f7891', '#6a849c', '#566e86', '#7590a8'], fill: '#d3d6cc' },
    { ru: 'Бета', a: 126, roof: ['#9a4a3c', '#a85646', '#8e4235', '#b0604e'], fill: '#dcc8b4' },
    { ru: 'Браво', a: 198, roof: ['#6b4a35', '#7a5640', '#5f412e', '#86624a'], fill: '#d2c3a8' }
  ].map((d) => ({ ...d, poly: sectorPoly(d.a) }))

  /** Кварталы по узору: обходит клетки (u, v), застраивает их, оставляет здания внутри многоугольника и вне «дыр» */
  const fill = ({ map, poly, us, vs, ur, vr, street, mode, depth = 12, lot = [8, 14], holes = [], keep = 1, margin = 8 }) => {
    const ok = (pts) => pts.every((p) => inside(p, poly) && edgeDist(p, poly) > margin && !holes.some(([hx, hy, hr]) => Math.hypot(p[0] - hx, p[1] - hy) < hr + 4))
    const quad = (u0, v0, u1, v1) => {
      // длинные стороны — с промежуточными точками, чтобы на кольцах дома изгибались вместе с улицей
      const n = Math.max(1, Math.round(Math.max(u1 - u0, v1 - v0) / 18))
      const pts = []
      for (let i = 0; i < n; i++) pts.push(map(u0 + ((u1 - u0) * i) / n, v0))
      for (let i = 0; i < n; i++) pts.push(map(u1, v0 + ((v1 - v0) * i) / n))
      for (let i = 0; i < n; i++) pts.push(map(u1 - ((u1 - u0) * i) / n, v1))
      for (let i = 0; i < n; i++) pts.push(map(u0, v1 - ((v1 - v0) * i) / n))
      return pts
    }
    const put = (q, into = buildings) => ok(q) && rand() < keep && into.push(q)
    for (let u = ur[0]; u < ur[1]; u += us)
      for (let v = vr[0]; v < vr[1]; v += vs) {
        const u0 = u + street, u1 = u + us - street, v0 = v + street, v1 = v + vs - street
        if (mode === 'dense') {
          // трущобы: весь квартал нарезан на мелкие хибары, кое-где проходы
          for (let a = u0; a < u1 - 4; ) {
            const da = Math.min(between(...lot), u1 - a)
            for (let b = v0; b < v1 - 4; ) {
              const db = Math.min(between(...lot), v1 - b)
              if (rand() < 0.88) put(quad(a + 0.6, b + 0.6, a + da - 0.6, b + db - 0.6))
              b += db
            }
            a += da
          }
        } else if (mode === 'villa') {
          // особняк посреди сада
          const gu = (u1 - u0) * 0.14, gv = (v1 - v0) * 0.14
          const g = quad(u0, v0, u1, v1)
          if (rand() < 0.22) { if (ok(g)) greens.push(g); continue }
          put(quad(u0 + gu * between(0.6, 1.4), v0 + gv * between(0.6, 1.4), u1 - gu * between(0.6, 1.4), v1 - gv * between(0.6, 1.4)))
        } else if (mode === 'hall') {
          // цеха и склады: квартал — один-два больших корпуса
          if (rand() < 0.5) put(quad(u0 + 2, v0 + 2, u1 - 2, v1 - 2))
          else { const m = (v0 + v1) / 2; put(quad(u0 + 2, v0 + 2, u1 - 2, m - 2)); put(quad(u0 + 2, m + 2, u1 - 2, v1 - 2)) }
        } else {
          // обычный квартал: дома по периметру, внутри дворы
          const d = Math.min(depth, (u1 - u0) / 2 - 1, (v1 - v0) / 2 - 1)
          for (const [s0, s1, side] of [[u0, u1, 0], [u0, u1, 1]])
            for (let a = s0; a < s1 - 3; ) {
              const w = Math.min(between(...lot), s1 - a)
              put(side ? quad(a, v1 - d, a + w - 1, v1) : quad(a, v0, a + w - 1, v0 + d))
              a += w
            }
          for (const side of [0, 1])
            for (let b = v0 + d + 1; b < v1 - d - 3; ) {
              const w = Math.min(between(...lot), v1 - d - 1 - b)
              put(side ? quad(u1 - d, b, u1, b + w - 1) : quad(u0, b, u0 + d, b + w - 1))
              b += w
            }
        }
      }
  }
  const at = (d, r, da = 0) => polar(r, (d.a + da) * deg)

  // Омега — лабиринт трущоб: кривая сетка мелких кварталов
  const [om, ma, de, be, br] = D
  fill({ map: grid(at(om, 600), om.a * deg + 0.4, 9, 3), poly: om.poly, us: 28, vs: 24, ur: [-480, 480], vr: [-480, 480], street: 2.4, mode: 'dense', lot: [5, 8] })
  // Матра — кольца вокруг своего центра, круглые площади на перекрёстках
  const maC = at(ma, 600)
  const maHoles = [[...maC, 34], [...at(ma, 470, -16), 24], [...at(ma, 720, 14), 26], [...at(ma, 430, 20), 20]]
  fill({ map: rings(maC, 200), poly: ma.poly, us: 44, vs: 42, ur: [70, 470], vr: [0, 1257], street: 4, mode: 'block', depth: 11, lot: [7, 12], holes: maHoles })
  maHoles.forEach(([x, y, r]) => squares.push(circle(x, y, r, 20)))
  // Дельта — широкие кольца и лучи, особняки в садах, большая круглая площадь
  const deC = at(de, 610)
  const deHoles = [[...deC, 48], [...at(de, 330, 0), 70]]
  fill({ map: rings(deC, 260), poly: de.poly, us: 52, vs: 60, ur: [70, 520], vr: [0, 1634], street: 6, mode: 'villa', holes: deHoles })
  squares.push(circle(...deC, 48, 28))
  // Бета — прямая сетка казарм и плац
  const beO = at(be, 560)
  const beHoles = [[...beO, 60]]
  fill({ map: grid(beO, be.a * deg, 0, 7), poly: be.poly, us: 58, vs: 40, ur: [-450, 450], vr: [-450, 450], street: 5, mode: 'block', depth: 13, lot: [16, 30], holes: beHoles })
  squares.push([[-56, -46], [56, -46], [56, 46], [-56, 46]].map(([u, v]) => grid(beO, be.a * deg)(u, v)))
  // Браво — дуги вокруг центра города, большие цеха
  fill({ map: rings([0, 0], 500), poly: br.poly, us: 44, vs: 50, ur: [RA, R], vr: [(br.a - 40) * deg * 500, (br.a + 40) * deg * 500], street: 5, mode: 'hall' })

  // особые здания (тёмные на эскизе): по 3 на дистрикт + замок Верховного совета у Альфы
  const blob = (x, y, w, h, ang) => {
    const pts = [[-w, -h], [w * 0.2, -h], [w * 0.2, -h * 0.55], [w, -h * 0.55], [w, h], [-w * 0.3, h], [-w * 0.3, h * 0.5], [-w, h * 0.5]]
    return pts.map(([u, v]) => [x + u * Math.cos(ang) - v * Math.sin(ang), y + u * Math.sin(ang) + v * Math.cos(ang)])
  }
  const clearFor = (shape, pad = 6) => {
    for (const list of [buildings, greens]) for (let i = list.length - 1; i >= 0; i--) if (list[i].some((p) => inside(p, shape) || edgeDist(p, shape) < pad) || shape.some((p) => inside(p, list[i]))) list.splice(i, 1)
  }
  const special = (shape) => { clearFor(shape); prisms.push(shape) }
  special(blob(...at(de, RA + 70, 0), 46, 34, (de.a + 90) * deg)) // замок Верховного совета — «Дистрикт Власти»
  const extra = { Омега: [[480, -14], [690, 10], [380, 18]], Матра: [[350, -22], [560, 22], [800, -6]], Дельта: [[480, -24], [520, 24], [760, 6]], Бета: [[400, 18], [690, -14], [430, -20]], Браво: [[420, -16], [650, 16], [780, -4]] }
  for (const d of D) for (const [r, da] of extra[d.ru]) special(blob(...at(d, r, da), between(22, 32), between(16, 24), between(0, Math.PI)))

  // ---- Альфа: замок Монстаргов, амфитеатр, кольцо дворцов ----
  const castle = [[-70, -40], [-30, -40], [-30, -78], [30, -78], [30, -40], [70, -40], [70, 40], [30, 40], [30, 78], [-30, 78], [-30, 40], [-70, 40]].map(([x, y]) => [x * 0.95, y * 0.95])
  prisms.push(castle)
  prisms.push(circle(-120, 120, 38, 20)) // амфитеатр
  fill({ map: rings([0, 0], 200), poly: alpha, us: 46, vs: 52, ur: [118, 236], vr: [0, 1257], street: 5, mode: 'block', depth: 12, lot: [12, 20], holes: [[0, 0, 110], [-120, 120, 44]] })
  greens.push(circle(0, 0, 104, 32))

  // ---- предместья внутри стены: редкие дома и сады между дистриктами ----
  const sub = []
  for (let i = 0; i < 4000; i++) {
    const a = rand() * 2 * Math.PI, r = Math.sqrt(between(0.3, 0.92)) * R
    const p = polar(r, a)
    if (r < RA + 30 || D.some((d) => inside(p, d.poly) || edgeDist(p, d.poly) < 14)) continue
    if (sub.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 12)) continue
    sub.push(p)
    const s = between(4, 7)
    buildings.push(blob(p[0], p[1], s, s * 0.8, a).slice(0, 8))
  }
  for (const d of D) for (const side of [-1, 1]) {
    const g = circle(...polar(R * 0.9, (d.a + side * 40) * deg), between(30, 44), 16)
    clearFor(g, 2)
    greens.push(g)
  }

  // ---- бульвары между дистриктами, ворота, дороги за стеной, поля ----
  for (const d of D) {
    const a = (d.a + 36) * deg
    roads.push({ type: 'LineString', width: 12, coordinates: [polar(RA + 6, a), polar(R + 2, a), polar(R * 1.7, a + 0.05)] })
  }
  for (let k = 0; k < 5; k++)
    for (let r = R + 60; r < R * 1.6; r += between(70, 110)) {
      const a0 = (D[k].a + 36) * deg + 0.03, a1 = (D[(k + 1) % 5].a + 36) * deg - 0.03
      for (let a = a0; a < a1 - 0.02; ) {
        const da = Math.min(between(0.06, 0.13), a1 - a), dr = between(55, 95)
        if (rand() < 0.7) fields.push([polar(r, a), polar(r + dr, a), polar(r + dr, a + da), polar(r, a + da)])
        a += da + 0.012
      }
    }

  const wallOuter = circle(0, 0, R, 40)
  const flip = (r) => r.map(([x, y]) => [+x.toFixed(2), +(-y).toFixed(2)])
  const poly = (list) => list.map((r) => [ring(flip(r))])
  const E = 1900
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'values', roadWidth: 8, towerRadius: 9, wallThickness: 9, generator: 'gleuderoff-hausser' },
      { type: 'Polygon', id: 'earth', coordinates: [ring(flip([[-E, -E], [E, -E], [E, E], [-E, E]]))] },
      { type: 'GeometryCollection', id: 'roads', geometries: roads.map((g) => ({ ...g, coordinates: flip(g.coordinates) })) },
      { type: 'GeometryCollection', id: 'walls', geometries: [wallOuter, alpha].map((w, i) => ({ type: 'Polygon', width: i ? 7 : 11, coordinates: [ring(flip(w))] })) },
      { type: 'GeometryCollection', id: 'rivers', geometries: [] },
      { type: 'GeometryCollection', id: 'planks', geometries: [] },
      { type: 'MultiPolygon', id: 'buildings', coordinates: poly(buildings) },
      { type: 'MultiPolygon', id: 'prisms', coordinates: poly(prisms) },
      { type: 'MultiPolygon', id: 'squares', coordinates: poly(squares) },
      { type: 'MultiPolygon', id: 'greens', coordinates: poly(greens) },
      { type: 'MultiPolygon', id: 'fields', coordinates: poly(fields) },
      { type: 'MultiPoint', id: 'trees', coordinates: [] },
      {
        type: 'GeometryCollection', id: 'districts',
        geometries: [...D.map((d) => ({ type: 'Polygon', name: d.ru, ru: d.ru, roof: d.roof, fill: d.fill, coordinates: [ring(flip(d.poly))] })),
          { type: 'Polygon', name: 'Альфа', ru: 'Альфа', roof: ['#7a4560', '#86506b', '#6e3b55', '#8f5a74'], fill: '#d9c6c6', coordinates: [ring(flip(alpha))] }]
      },
      { type: 'MultiPolygon', id: 'water', coordinates: [] }
    ]
  }
}
