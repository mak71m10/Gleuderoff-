import * as THREE from 'three'
import { areaOf, centerOf, ringOf, STYLES, type CityPlan, type PlanLine } from './city3d'
import type { SettlementType, Sprite } from './settlements3d'

/**
 * Миниатюры поселений на карте мира. У кого есть план — по плану (те же дома и стены, что в 3D-виде); у кого нет —
 * по раскладке, собранной здесь же: дома вдоль дорог, площадь, храм или донжон, стена у городов. Всё в одном стиле:
 * приглушённые цвета, низкие дома, тонкие стены. Под поселением — мягкая поляна в цвет местности (в лесу — прогалина,
 * в горах — камень), края растворяются в подложке: деревня садится в рельеф, а не лежит на нём наклейкой.
 */
const SIZE = 384
const VIEW = 11
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.OrthographicCamera
let anchor = { x: 0.5, y: 0.62 }
let mat: THREE.MeshLambertMaterial

function setup(): void {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(SIZE, SIZE)
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 0.1, 100)
  camera.position.set(0, 20, 18)
  camera.lookAt(0, 0, 0)
  scene.add(new THREE.HemisphereLight(0xf2ead8, 0x4a4434, 1.3))
  // свет с северо-запада, как тени гор на подложке
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.55)
  sun.position.set(-10, 18, -4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 })
  sun.shadow.radius = 3
  scene.add(sun)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.24 }))
  plane.rotation.x = -Math.PI / 2
  plane.receiveShadow = true
  scene.add(plane)
  mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const p = new THREE.Vector3(0, 0, 0).project(camera)
  anchor = { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }
}

/** Насколько крупно поселение в своём значке: деревня — горстка домов, столица — во весь круг */
const FILL: Record<SettlementType, number> = { village: 5.4, fishing: 5.2, temple: 5.2, ruins: 4.8, tower: 3.8, castle: 5.4, town: 6.8, port: 7.0, city: 7.4, capital: 8.6, grandport: 8.6 }

// облик по культуре провинции — для поселений без плана
const CULTURE: Record<string, { style: string; plaster?: string[]; roof?: string[] }> = {
  imperial: { style: 'empire' },
  church: { style: 'church' },
  romance: { style: 'south' },
  kaltrans: { style: 'kalt' },
  dark: { style: 'styria' },
  nordic: { style: 'norse' },
  dwarven: { style: 'argus', plaster: ['#8e8a83', '#7d7972', '#96928a'], roof: ['#4b4b52', '#55555c'] },
  elven: { style: 'church', plaster: ['#d8e6c8', '#cfdcc0', '#e2ecd4'], roof: ['#3f7a4a', '#4a8655', '#356a40'] },
  eluin: { style: 'church', plaster: ['#ece8dc', '#e2ddd0'], roof: ['#3f8088', '#4a8a90'] },
  eleon: { style: 'church', plaster: ['#ddd6c4', '#d2cab6'], roof: ['#2f5f7a', '#3a6a84'] },
  yut: { style: 'church', plaster: ['#e8dcc4', '#ddd0b6'], roof: ['#3a3a46', '#44444f'] },
  desert: { style: 'south', plaster: ['#d6b37c', '#cfaa70', '#dcbc88'], roof: ['#c9a36a', '#bf9a60'] },
  zlatay: { style: 'south', plaster: ['#eadaa6', '#e2d098'], roof: ['#c9a12e', '#b8922a'] },
  orcish: { style: 'kalt', plaster: ['#8a6a4a', '#7a5c3e'], roof: ['#5c4a30', '#6a563a'] },
  cin: { style: 'south', plaster: ['#e2d2b2', '#d8c6a4'], roof: ['#8f2f2f', '#7f2a2a'] }
}

/** Раскладка поселения без плана: дороги-лучи от площади, дома по обе стороны, храм или донжон, стена у городов */
function synthPlan(type: SettlementType, culture: string, seed: number): CityPlan {
  let s = (seed * 2654435761) >>> 0
  const rnd = (): number => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
  const look = CULTURE[culture] ?? CULTURE.imperial
  const count = { village: 9 + rnd() * 8, fishing: 7 + rnd() * 5, temple: 6, ruins: 7, tower: 2, castle: 6, town: 34 + rnd() * 22, port: 44 + rnd() * 22, city: 110 + rnd() * 50, capital: 210, grandport: 230 }[type]
  const spokes = type === 'village' || type === 'fishing' || type === 'ruins' ? 2 + Math.floor(rnd() * 2) : type === 'town' || type === 'port' ? 4 : 6
  const buildings: number[][] = []
  const rect = (cx: number, cz: number, w: number, d: number, a: number, special = 0): void => {
    const c = Math.cos(a), si = Math.sin(a), pts: number[] = []
    for (const [u, v] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) pts.push(cx + u * c - v * si, cz + u * si + v * c)
    buildings.push([0, special, ...pts])
  }
  // главное здание в середине: храм у храмовых и городов, донжон у замков и башня у башен
  if (type === 'castle' || type === 'tower') rect(0, 0, type === 'tower' ? 9 : 16, type === 'tower' ? 9 : 16, rnd(), 1)
  else if (type !== 'ruins' && type !== 'fishing' && (type !== 'village' || rnd() < 0.5)) rect(0, -14, 12, 22, rnd() * 0.3, 1)
  const a0 = rnd() * Math.PI * 2
  let far = 18
  for (let n = 0, t = 16; n < count; t += 10 + rnd() * 3) {
    for (let k = 0; k < spokes && n < count; k++) {
      const a = a0 + (k / spokes) * Math.PI * 2 + Math.sin(t * 0.04 + k) * 0.25
      for (const side of [-1, 1]) {
        if (n >= count || rnd() < (type === 'village' ? 0.35 : 0.12)) continue
        const off = 8 + rnd() * 3, cx = Math.cos(a) * t - Math.sin(a) * off * side, cz = Math.sin(a) * t + Math.cos(a) * off * side
        rect(cx, cz, 6 + rnd() * 3, 8 + rnd() * 4, a + (rnd() - 0.5) * 0.2)
        far = Math.max(far, t + off)
        n++
      }
    }
    if (t > 600) break
  }
  const walls: PlanLine[] = []
  const ring = (r: number, n: number): number[] => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; const q = r * (0.94 + Math.sin(i * 1.7 + seed) * 0.06); return [Math.cos(a) * q, Math.sin(a) * q] }).flat()
  if (['town', 'port', 'city', 'capital', 'grandport'].includes(type) && (type !== 'town' || rnd() < 0.6)) walls.push({ r: ring(far + 8, 18), w: 3 })
  if (type === 'castle') walls.push({ r: ring(19, 8), w: 3 })
  const style = type === 'ruins' ? 'argus' : look.style
  return {
    w: 0, h: 0, districts: [], buildings,
    scene: { s: 1, style, forest: 0, tower: 7.6, droof: [], citadel: -1, dist: [], water: [], fields: [], greens: [], squares: [], walls, roads: [], rivers: [], planks: [], roof: type === 'ruins' ? ['#77736a', '#6d6a62'] : look.roof, ...(type === 'ruins' ? { plaster: ['#8a857a', '#7d786e'] } : look.plaster ? { plaster: look.plaster } : {}) } as CityPlan['scene']
  }
}

const muted = (hex: string, toward: THREE.Color, k: number): THREE.Color => {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s * 0.62, hsl.l)
  return c.lerp(toward, k)
}

/** Деревья вокруг поселения по цвету поляны: сколько, доля хвойных, цвета крон */
const TREES: Record<string, { n: number; pine: number; leaf: string[] }> = {
  '#8c9a6a': { n: 1, pine: 0.15, leaf: ['#5f7a3c', '#6b8444', '#56703a'] },
  '#a3a06a': { n: 0.9, pine: 0.1, leaf: ['#667f40', '#728848', '#5c753c'] },
  '#77824a': { n: 2.3, pine: 0.45, leaf: ['#4f6c36', '#5a763c', '#486432'] },
  '#8e8a62': { n: 1.1, pine: 0.3, leaf: ['#5d753c', '#687e42'] },
  '#8a857a': { n: 0.7, pine: 0.85, leaf: ['#5a6e40'] },
  '#d6dadb': { n: 0.4, pine: 1, leaf: ['#55684c'] },
  '#cdb27c': { n: 0.25, pine: 0, leaf: ['#7f8448', '#8a8a4e'] }
}
const PINE = ['#3f5a3a', '#47623f', '#38523a']

/** Собрать миниатюру: дома — призмы с шатровой крышей, стены — тонкий гребень, площади — мощёные пятна */
function build(plan: CityPlan, seed: number, fill: number, ground: THREE.Color, ruins: boolean): THREE.Group {
  const S = plan.scene as (CityPlan['scene'] & { plaster?: string[] }) | undefined
  const st = STYLES[S?.style ?? 'empire'] ?? STYLES.empire
  const plasters = S?.plaster ?? st.plaster
  let s = seed >>> 0
  const rnd = (): number => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
  const rings = plan.buildings.map((b) => ({ r: ringOf(b, 1, 2), special: b[1] === 1, d: b[0] }))
  const pts = rings.flatMap((b) => b.r)
  const c = pts.length ? centerOf(pts) : [0, 0]
  const rad = Math.sqrt(pts.reduce((m, p) => Math.max(m, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2), 1))
  const areas = rings.map((b) => Math.abs(areaOf(b.r))).sort((a, b) => a - b)
  const metre = Math.sqrt((areas[areas.length >> 1] || 300) / 62)
  // поселение — в круг своего типа; метры плана → единицы модели
  const u = fill / rad
  // высоты чуть преувеличены, но без «картонных коробок»: в мелком городе дома не выше двух этажей
  const lift = Math.min(0.6, Math.max(0.14, u * metre * 1.6))
  const P: number[] = [], C: number[] = []
  const push = (x: number, y: number, z: number, col: THREE.Color, k = 1): void => {
    P.push(x, y, z)
    C.push(col.r * k, col.g * k, col.b * k)
  }
  const tri = (a: number[], b: number[], d: number[], col: THREE.Color, k = 1): void => { push(a[0], a[1], a[2], col, k); push(b[0], b[1], b[2], col, k); push(d[0], d[1], d[2], col, k) }
  const X = (x: number): number => (x - c[0]) * u
  const Z = (y: number): number => (y - c[1]) * u
  const pave = muted(st.pave, ground, 0.45)
  for (const f of S?.squares ?? []) {
    const r = ringOf(f, 1) as [number, number][]
    if (r.length < 3) continue
    const tris = THREE.ShapeUtils.triangulateShape(r.map(([x, z]) => new THREE.Vector2(X(x), Z(z))), [])
    for (const [i, j, k] of tris) tri([X(r[i][0]), 0.01, Z(r[i][1])], [X(r[k][0]), 0.01, Z(r[k][1])], [X(r[j][0]), 0.01, Z(r[j][1])], pave)
  }
  for (const b of rings) {
    const r = b.r
    if (r.length < 3) continue
    const a = Math.abs(areaOf(r)) / (metre * metre)
    const floors = b.special ? 2.6 : a > 110 ? 1.8 : a > 55 ? 1.4 : 1
    const h = (b.special ? 5 : 2.6) * floors * 0.5 * lift * (ruins ? 0.5 : 1) + 0.02
    const roofs = S?.droof?.[b.d] ?? S?.roof ?? st.roof
    const wall = muted(b.special ? st.wall : plasters[Math.floor(rnd() * plasters.length)], ground, 0.24)
    const roof = muted(b.special ? st.tower : roofs[Math.floor(rnd() * roofs.length)], ground, 0.2)
    const ctr = centerOf(r)
    const top = h + (ruins ? 0 : Math.min(1.0, Math.sqrt(a) * 0.1) * lift * (st.pitch + 0.2))
    const cx = X(ctr[0]), cz = Z(ctr[1])
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length]
      const ax = X(p[0]), az = Z(p[1]), bx = X(q[0]), bz = Z(q[1])
      const shade = 0.8 + 0.2 * Math.abs(Math.sin(Math.atan2(bz - az, bx - ax)))
      tri([ax, 0, az], [bx, 0, bz], [bx, h, bz], wall, shade)
      tri([ax, 0, az], [bx, h, bz], [ax, h, az], wall, shade)
      tri([ax, h, az], [bx, h, bz], [cx, top, cz], ruins ? wall : roof, 0.95 + 0.1 * shade)
    }
  }
  // городские стены — тонкий гребень с редкими башнями
  const wallCol = muted(st.wall, ground, 0.3)
  const towers: [number, number][] = []
  for (const w of (S?.walls ?? []) as PlanLine[]) {
    const r = ringOf(w.r, 1)
    const wh = 1.1 * lift + 0.12, th = Math.max(0.035, Math.min(0.09, (w.w || 4) * u * 0.3))
    for (let i = 1; i < r.length; i++) {
      const p = r[i - 1], q = r[i]
      const ax = X(p[0]), az = Z(p[1]), bx = X(q[0]), bz = Z(q[1])
      const l = Math.hypot(bx - ax, bz - az) || 1, nx = (-(bz - az) / l) * th, nz = ((bx - ax) / l) * th
      for (const [o, k] of [[1, 0.85], [-1, 1]] as const) {
        tri([ax + nx * o, 0, az + nz * o], [bx + nx * o, 0, bz + nz * o], [bx + nx * o, wh, bz + nz * o], wallCol, k)
        tri([ax + nx * o, 0, az + nz * o], [bx + nx * o, wh, bz + nz * o], [ax + nx * o, wh, az + nz * o], wallCol, k)
      }
      tri([ax + nx, wh, az + nz], [bx - nx, wh, bz - nz], [bx + nx, wh, bz + nz], wallCol, 1.06)
      tri([ax + nx, wh, az + nz], [ax - nx, wh, az - nz], [bx - nx, wh, bz - nz], wallCol, 1.06)
      if (i % 3 === 0) towers.push([ax, az])
    }
  }
  // башни — восьмигранные призмы прямо в общей сетке
  for (const [x, z] of towers) {
    const tr = 0.13, th = 1.7 * lift + 0.2
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2
      const A = [x + Math.cos(a0) * tr, 0, z + Math.sin(a0) * tr], B = [x + Math.cos(a1) * tr, 0, z + Math.sin(a1) * tr]
      const A2 = [A[0], th, A[2]], B2 = [B[0], th, B[2]]
      tri(A, B, B2, wallCol, 0.9)
      tri(A, B2, A2, wallCol, 0.9)
      tri(A2, B2, [x, th + 0.12, z], wallCol, 1.05)
    }
  }
  // деревья: рощицами вокруг поселения и в просветах между домами — значок врастает в лес подложки
  {
    const T = TREES['#' + ground.getHexString()] ?? TREES['#a3a06a']
    const foot = rings.filter((b) => b.r.length >= 3).map((b) => { const q = centerOf(b.r); return [X(q[0]), Z(q[1]), Math.sqrt(Math.abs(areaOf(b.r))) * u * 0.75] })
    const cr0 = Math.min(0.17, Math.max(0.075, u * 4.5))
    const n = Math.round(T.n * (6 + fill * fill * 0.9) * (ruins ? 1.6 : 1))
    const rMin = fill * (ruins ? 0.15 : fill < 5 ? 0.4 : 0.75), rMax = Math.min(fill * 1.4, 12.5)
    let px = 0, pz = 0, have = false
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      let x: number, z: number
      if (have && rnd() < 0.62) {
        const a = rnd() * Math.PI * 2, d = cr0 * (1.6 + rnd() * 2.2)
        x = px + Math.cos(a) * d
        z = pz + Math.sin(a) * d
      } else {
        const a = rnd() * Math.PI * 2, d = rMin + (rMax - rMin) * Math.pow(rnd(), 0.8)
        x = Math.cos(a) * d
        z = Math.sin(a) * d
      }
      if (Math.abs(x) > VIEW - 0.6 || Math.abs(z) > 13.5) continue
      const cr = cr0 * (0.75 + rnd() * 0.5)
      if (foot.some((f) => Math.hypot(f[0] - x, f[1] - z) < f[2] + cr)) continue
      px = x; pz = z; have = true; i++
      const pine = rnd() < T.pine
      const col = muted(pine ? PINE[Math.floor(rnd() * PINE.length)] : T.leaf[Math.floor(rnd() * T.leaf.length)], ground, 0.12)
      const rr = pine ? cr * 0.72 : cr, y0 = cr * 0.25, y1 = pine ? cr * 0.5 : cr * 1.05, y2 = pine ? cr * 3.3 : cr * 2.2
      const rot = rnd() * Math.PI
      for (let k = 0; k < 6; k++) {
        const a0 = rot + (k / 6) * Math.PI * 2, a1 = rot + ((k + 1) / 6) * Math.PI * 2
        const A = [x + Math.cos(a0) * rr, y1, z + Math.sin(a0) * rr], B = [x + Math.cos(a1) * rr, y1, z + Math.sin(a1) * rr]
        tri(A, B, [x, y2, z], col, 0.92 + 0.16 * (k % 2))
        tri(B, A, [x, y0, z], col, 0.7)
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  const group = new THREE.Group()
  group.add(mesh)
  return group
}

const cache = new Map<string, Sprite>()
const pending = new Set<string>()
let onReady: (() => void) | null = null
export function onPlanSpritesReady(cb: () => void): void {
  onReady = cb
}
interface Job { key: string; plan: CityPlan; seed: number; fill: number; ground: string; ruins: boolean }
const queue: Job[] = []
let pumping = false
function pump(): void {
  pumping = false
  const t0 = performance.now()
  let made = 0
  while (queue.length && performance.now() - t0 < 24) {
    const job = queue.shift()!
    cache.set(job.key, render(job))
    made++
  }
  if (made) onReady?.()
  if (queue.length) {
    pumping = true
    setTimeout(pump, 30)
  }
}
function enqueue(job: Job, first: boolean): void {
  if (first) queue.unshift(job)
  else queue.push(job)
  if (!pumping) {
    pumping = true
    setTimeout(pump, 0)
  }
}
function render(job: Job): Sprite {
  if (!renderer) setup()
  const gc = new THREE.Color(job.ground)
  const group = build(job.plan, job.seed, job.fill, gc, job.ruins)
  scene.add(group)
  renderer!.render(scene, camera)
  scene.remove(group)
  group.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
  const cv = document.createElement('canvas')
  cv.width = SIZE
  cv.height = SIZE
  const g = cv.getContext('2d')!
  // поляна под поселением в цвет местности: мягкая, без края, чуть темнее у домов — как утоптанная земля
  const ex = anchor.x * SIZE, ey = anchor.y * SIZE, rx = SIZE * 0.5 * (job.fill / VIEW) * 1.25, ry = rx * 0.66
  g.save()
  g.translate(ex, ey)
  g.scale(1, ry / rx)
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx)
  const rgb = (k: number): string => `${Math.round(gc.r * 255 * k)}, ${Math.round(gc.g * 255 * k)}, ${Math.round(gc.b * 255 * k)}`
  grad.addColorStop(0, `rgba(${rgb(0.92)}, 0.5)`)
  grad.addColorStop(0.55, `rgba(${rgb(0.96)}, 0.28)`)
  grad.addColorStop(1, `rgba(${rgb(1)}, 0)`)
  g.fillStyle = grad
  g.beginPath()
  g.arc(0, 0, rx, 0, Math.PI * 2)
  g.fill()
  g.restore()
  g.drawImage(renderer!.domElement, 0, 0)
  return { canvas: cv, ax: anchor.x, ay: anchor.y }
}

/** Цвет поляны под поселением по местности провинции (номера — как в scripts/provinces.mjs) */
const GROUND = ['#8c9a6a', '#a3a06a', '#77824a', '#8e8a62', '#8a857a', '#d6dadb', '#cdb27c']
export const groundOf = (terrain: number | undefined): string => GROUND[terrain ?? 1] ?? GROUND[1]

/**
 * Миниатюра поселения: по плану (plan — путь к плану, load — загрузчик) или по собранной здесь раскладке.
 * Пока не готова — null; когда готова, вызывается onPlanSpritesReady.
 */
export function getMiniSprite(o: { plan?: string; type: SettlementType; culture: string; variant: number; terrain?: number }, load: (rel: string) => Promise<CityPlan>): Sprite | null {
  const ground = groundOf(o.terrain)
  const key = o.plan ? `${o.plan}|${o.type}|${ground}` : `${o.type}|${o.culture}|${o.variant % 8}|${ground}`
  const s = cache.get(key)
  if (s) return s
  if (pending.has(key)) return null
  pending.add(key)
  const fill = FILL[o.type] ?? 4
  const big = o.type === 'capital' || o.type === 'city' || o.type === 'grandport'
  if (o.plan)
    load(o.plan)
      .then((plan) => {
        if (plan?.buildings?.length) enqueue({ key, plan, seed: o.variant, fill, ground, ruins: false }, big)
        else enqueue({ key, plan: synthPlan(o.type, o.culture, o.variant % 8), seed: o.variant, fill, ground, ruins: o.type === 'ruins' }, big)
      })
      .catch(() => enqueue({ key, plan: synthPlan(o.type, o.culture, o.variant % 8), seed: o.variant, fill, ground, ruins: o.type === 'ruins' }, big))
  else enqueue({ key, plan: synthPlan(o.type, o.culture, o.variant % 8), seed: o.variant, fill, ground, ruins: o.type === 'ruins' }, big)
  return null
}
