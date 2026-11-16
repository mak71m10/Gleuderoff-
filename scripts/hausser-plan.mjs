// План Хауссера по эскизу автора (02.11.2026): круглый город в стене, в центре — Дистрикт Альфа (владения
// Монстаргов), вокруг по часовой стрелке от верха — Омега (трущобы), Матра (горожане), Дельта (знать и
// министерства, замок Верховного совета у границы с Альфой), Бета (генералитет), Браво (цеха).
// Генератор Watabou такую планировку не строит, поэтому план собирается здесь — в том же формате, что и его
// выгрузка (FeatureCollection, ось y вверх), и дальше рисуется общим кодом scripts/city-maps.mjs.
// У каждого дистрикта свой узор улиц (сетка, кольца, лабиринт) и свой цвет крыш, как на эскизе.
// За стеной у каждых ворот — предместье вдоль тракта (около трети домов: столица переросла свою стену).
// Примечательные здания стоят там, где их ставит этот план (фича landmarks), а не по правилам lore/cities.mjs:
// так они разнесены по городу не ближе 12% ширины плана (правило П8 scripts/city-check.mjs).

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
const lineDist = (p, line) => Math.min(...line.slice(1).map((b, i) => segDist(p, line[i], b)))
const circle = (cx, cy, r, n = 24, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(a0 + (i / n) * 2 * Math.PI), cy + r * Math.sin(a0 + (i / n) * 2 * Math.PI)])
const ring = (pts) => [...pts, pts[0]]

const R = 1000 // внешняя стена
const RA = 570 // стена Альфы
const SPAN = 34 // полуширина дистрикта, градусы (между ними — бульвары)
const RL = 880 // кольцо, на котором стоят примечательные здания дистриктов
const SUB = 250 // глубина предместий за стеной

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
  const marks = [] // [имя, индекс в prisms]

  // ---- дистрикты: пятиугольники между бульварами ----
  // внутренний край — дуга за стеной Альфы (хорда между двумя точками срезала бы угол Альфы)
  const sectorPoly = (a) => [polar(R * 0.9, (a - SPAN) * deg), polar(R * 0.975, a * deg), polar(R * 0.9, (a + SPAN) * deg), ...Array.from({ length: 9 }, (_, i) => polar(RA + 22, (a + SPAN - 3 - (i * (2 * SPAN - 6)) / 8) * deg))]
  const alpha = circle(0, 0, RA, 8, 22.5 * deg)
  const D = [
    { ru: 'Омега', a: -90, roof: ['#6f7a5c', '#7a8566', '#65704f', '#808b6c'], fill: '#c8c9ac' },
    { ru: 'Матра', a: -18, roof: ['#b8774f', '#c4865c', '#a96a45', '#bf7d55'], fill: '#e0cfae' },
    { ru: 'Дельта', a: 54, roof: ['#5f7891', '#6a849c', '#566e86', '#7590a8'], fill: '#d3d6cc' },
    { ru: 'Бета', a: 126, roof: ['#9a4a3c', '#a85646', '#8e4235', '#b0604e'], fill: '#dcc8b4' },
    { ru: 'Браво', a: 198, roof: ['#6b4a35', '#7a5640', '#5f412e', '#86624a'], fill: '#d2c3a8' }
  ].map((d) => ({ ...d, poly: sectorPoly(d.a) }))
  const at = (d, r, da = 0) => polar(r, (d.a + da) * deg)

  // ---- бульвары между дистриктами: от площади у замка через ворота Альфы и городские ворота в тракт ----
  // внешняя стена повёрнута на полшага башен, чтобы ворота приходились на середину пролёта, а не на башню
  const gates = D.map((d) => (d.a + 36) * deg)
  const boulevards = gates.map((a) => [polar(RA - 60, a), polar(R + SUB + 140, a)])
  for (const b of boulevards) roads.push({ type: 'LineString', width: 12, coordinates: b })
  const nearRoad = (p, pad) => boulevards.some((b) => segDist(p, b[0], b[1]) < 6 + pad) || roads.slice(5).some((q) => lineDist(p, q.coordinates) < q.width / 2 + pad)

  // ---- примечательные здания: заранее, чтобы кварталы обходили их место ----
  const blob = (x, y, w, h, ang) => {
    const pts = [[-w, -h], [w * 0.2, -h], [w * 0.2, -h * 0.55], [w, -h * 0.55], [w, h], [-w * 0.3, h], [-w * 0.3, h * 0.5], [-w, h * 0.5]]
    return pts.map(([u, v]) => [x + u * Math.cos(ang) - v * Math.sin(ang), y + u * Math.sin(ang) + v * Math.cos(ang)])
  }
  const keepOut = [] // [x, y, радиус] — сюда кварталы не заходят (место под здание и проход вокруг)
  const special = (name, shape, clear) => {
    const cx = shape.reduce((s, p) => s + p[0], 0) / shape.length, cy = shape.reduce((s, p) => s + p[1], 0) / shape.length
    keepOut.push([cx, cy, clear])
    if (name) marks.push([name, prisms.length])
    prisms.push(shape)
  }
  // Альфа: замок Монстаргов в середине, амфитеатр и казармы стражи по краям дистрикта
  const castle = [[-70, -40], [-30, -40], [-30, -78], [30, -78], [30, -40], [70, -40], [70, 40], [30, 40], [30, 78], [-30, 78], [-30, 40], [-70, 40]].map(([x, y]) => [x * 0.95, y * 0.95])
  special('Замок Монстаргов', castle, 125)
  special('Амфитеатр Альфы', circle(...polar(472, 198 * deg), 40, 24), 70)
  special('Казармы Императорских стражей', blob(...polar(472, -90 * deg), 40, 28, 0), 62)
  // Дельта: замок Верховного совета прямо у стены Альфы — «Дистрикт Власти»
  const [om, ma, de, be, br] = D
  const big = (name, d, r, da, w, h) => special(name, blob(...at(d, r, da), w, h, (d.a + da + 90) * deg), Math.hypot(w, h) + 20)
  big('Замок Верховного совета', de, RA + 70, -14, 50, 36)
  big('Министерства', de, RL, 16, 42, 30)
  big('Городская библиотека', ma, RL, -16, 38, 30)
  big('Управа городской стражи', ma, RL, 16, 40, 32)
  big('Верховная ставка', be, RL, -14, 44, 34)
  big('Военная академия', be, RL, 18, 40, 30)
  big('Дом Сообщества рабочих', br, RL, -20, 40, 30)
  big('Большие цеха', br, RL, 20, 46, 26)
  big('Крысиный двор', om, RL, 20, 34, 28)
  const free = (p) => !keepOut.some(([x, y, r]) => Math.hypot(p[0] - x, p[1] - y) < r)

  /** Кварталы по узору: обходит клетки (u, v), застраивает их, оставляет здания внутри многоугольника и вне «дыр» */
  const fill = ({ map, poly, us, vs, ur, vr, street, mode, depth = 12, lot = [8, 14], holes = [], keep = 1, margin = 8, gap = 2.2, bad = () => false }) => {
    const ok = (pts) => pts.every((p) => inside(p, poly) && edgeDist(p, poly) > margin && free(p) && !bad(p) && !nearRoad(p, 3) && !holes.some(([hx, hy, hr]) => Math.hypot(p[0] - hx, p[1] - hy) < hr + 4))
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
      for (let v = vr[0]; v + vs <= vr[1] + 1; v += vs) {
        const u0 = u + street, u1 = u + us - street, v0 = v + street, v1 = v + vs - street
        if (mode === 'dense') {
          // трущобы: узкий квартал в две хибары глубиной, каждая выходит в проулок
          const m = (u0 + u1) / 2 + between(-2, 2)
          for (const [a0, a1] of [[u0, m - 1.1], [m + 1.1, u1]])
            for (let b = v0; b < v1 - 4; ) {
              const db = Math.min(between(...lot), v1 - b)
              if (rand() < 0.9) put(quad(a0, b + 1.1, a1, b + db - 1.1))
              b += db
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
            for (let a = s0; a < s1 - gap - 2; ) {
              const w = Math.min(between(...lot), s1 - a)
              put(side ? quad(a, v1 - d, a + w - gap, v1) : quad(a, v0, a + w - gap, v0 + d))
              a += w
            }
          for (const side of [0, 1])
            for (let b = v0 + d + gap; b < v1 - d - gap - 2; ) {
              const w = Math.min(between(...lot), v1 - d - gap - b)
              put(side ? quad(u1 - d, b, u1, b + w - gap) : quad(u0, b, u0 + d, b + w - gap))
              b += w
            }
        }
      }
  }

  // Омега — лабиринт трущоб: кривая сетка узких кварталов
  fill({ map: grid(at(om, 760), om.a * deg + 0.4, 9, 3), poly: om.poly, us: 26, vs: 34, ur: [-480, 480], vr: [-480, 480], street: 2.6, mode: 'dense', lot: [8, 12], keep: 0.68 })
  // Матра — кольца вокруг своего центра, круглые площади на перекрёстках
  const maC = at(ma, 740)
  const maHoles = [[...maC, 34], [...at(ma, 610, -14), 24], [...at(ma, 620, 15), 22]]
  fill({ map: rings(maC, 200), poly: ma.poly, us: 46, vs: 44, ur: [100, 470], vr: [0, 1257], street: 4, mode: 'block', depth: 11, lot: [10, 16], gap: 4.5, holes: maHoles })
  maHoles.forEach(([x, y, r]) => squares.push(circle(x, y, r, 20)))
  // Дельта — широкие кольца и лучи, особняки в садах, большая круглая площадь
  const deC = at(de, 750, 0)
  fill({ map: rings(deC, 260), poly: de.poly, us: 52, vs: 60, ur: [70, 520], vr: [0, 1634], street: 6, mode: 'villa', holes: [[...deC, 48]] })
  squares.push(circle(...deC, 48, 28))
  // Бета — прямая сетка казарм и плац
  const beO = at(be, 720)
  fill({ map: grid(beO, be.a * deg, 0, 7), poly: be.poly, us: 58, vs: 40, ur: [-450, 450], vr: [-450, 450], street: 5, mode: 'block', depth: 13, lot: [16, 30], holes: [[...beO, 76]] })
  squares.push([[-56, -46], [56, -46], [56, 46], [-56, 46]].map(([u, v]) => grid(beO, be.a * deg)(u, v)))
  // Браво — дуги вокруг центра города, большие цеха
  fill({ map: rings([0, 0], 500), poly: br.poly, us: 44, vs: 50, ur: [RA, R], vr: [(br.a - 40) * deg * 500, (br.a + 40) * deg * 500], street: 5, mode: 'hall' })
  // Альфа — кольцо дворцов вокруг сада замка
  greens.push(circle(0, 0, 104, 32))
  fill({ map: rings([0, 0], 200), poly: alpha, us: 50, vs: 56, ur: [150, RA], vr: [0, 1257], street: 6, mode: 'block', depth: 14, lot: [22, 34], margin: 12, keep: 0.7, gap: 3.5 })
  for (const d of D) for (const side of [-1, 1]) {
    const g = circle(...polar(R * 0.9, (d.a + side * 40) * deg), between(30, 44), 16)
    if (!boulevards.some((b) => g.some((p) => segDist(p, b[0], b[1]) < 10))) greens.push(g)
  }

  // ---- предместья за стеной: вдоль каждого тракта, с поперечными улочками ----
  const subs = []
  gates.forEach((a, k) => {
    const map = grid([0, 0], a, 0, 11 + k)
    const tr = (u, v) => map(u, v)
    // клин вдоль тракта: у стены шире, дальше сужается в одну улицу
    const shape = [[R + 26, -175], [R + SUB * 0.55, -165], [R + SUB, -95], [R + SUB + 110, -40], [R + SUB + 110, 40], [R + SUB, 95], [R + SUB * 0.55, 165], [R + 26, 175]].map(([u, v]) => tr(u, v))
    subs.push(shape)
    for (const u of [R + 70, R + 160]) roads.push({ type: 'LineString', width: 6, coordinates: [tr(u, -150 + 40 * (u - R) / 100), tr(u, 150 - 40 * (u - R) / 100)] })
    fill({ map, poly: shape, us: 45, vs: 38, ur: [R + 25, R + SUB + 120], vr: [-190, 190], street: 4.5, mode: 'block', depth: 10, lot: [7, 12], margin: 4, bad: (p) => Math.hypot(...p) < R + 24 })
  })

  // ---- поля за предместьями ----
  for (let k = 0; k < 5; k++)
    for (let r = R + 60; r < R * 1.6; r += between(70, 110)) {
      const a0 = gates[k] + 0.03, a1 = gates[(k + 1) % 5] + (k === 4 ? 2 * Math.PI : 0) - 0.03
      for (let a = a0; a < a1 - 0.02; ) {
        const da = Math.min(between(0.06, 0.13), a1 - a), dr = between(55, 95)
        const f = [polar(r, a), polar(r + dr, a), polar(r + dr, a + da), polar(r, a + da)]
        if (rand() < 0.7 && !subs.some((s) => f.some((p) => inside(p, s) || edgeDist(p, s) < 20))) fields.push(f)
        a += da + 0.012
      }
    }

  const wallOuter = circle(0, 0, R, 40, 4.5 * deg)
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
      // какое здание под какое примечательное место: индекс в общем списке [...buildings, ...prisms]
      { type: 'Feature', id: 'landmarks', items: marks.map(([name, i]) => ({ name, b: buildings.length + i })) },
      {
        type: 'GeometryCollection', id: 'districts',
        geometries: [...D.map((d) => ({ type: 'Polygon', name: d.ru, ru: d.ru, roof: d.roof, fill: d.fill, coordinates: [ring(flip(d.poly))] })),
          { type: 'Polygon', name: 'Альфа', ru: 'Альфа', roof: ['#7a4560', '#86506b', '#6e3b55', '#8f5a74'], fill: '#d9c6c6', coordinates: [ring(flip(alpha))] }]
      },
      { type: 'MultiPolygon', id: 'water', coordinates: [] }
    ]
  }
}
