import * as THREE from 'three'

/**
 * 3D-вид поселения: всё собирается из плана города (контуры зданий, улицы, стены, реки, поля) прямо в браузере.
 * Дом — настоящий контур здания с плана, поднятый в стены с двускатной крышей; земля — холст, на котором нарисованы
 * улицы и поля и который лежит на сетке высот. Облик зависит от государства (STYLES), всё детерминировано по имени карты.
 */

export interface PlanLine { r: number[]; w: number }
export interface PlanScene {
  s: number
  style: string
  forest: number
  hills?: number
  rocky?: number
  tower: number
  roof?: string[]
  droof: (string[] | null)[]
  citadel: number
  dist: number[][]
  water: number[][]
  fields: number[][]
  greens: number[][]
  squares: number[][]
  walls: PlanLine[]
  roads: PlanLine[]
  rivers: PlanLine[]
  planks: PlanLine[]
}
export interface CityPlan {
  w: number
  h: number
  districts: { name: string; x: number; y: number }[]
  buildings: number[][]
  landmarks?: { b: number; name: string }[]
  scene?: PlanScene
}

interface Style {
  plaster: string[]
  roof: string[]
  timber: string
  stone: string
  wall: string
  shutter: string[]
  pitch: number
  framed: boolean
  floors: number
  grass: string
  grass2: string
  dirt: string
  pave: string
  lit: number
  conifer: number
  tower: string
}
const STYLES: Record<string, Style> = {
  empire: { plaster: ['#e9dcc0', '#dccca8', '#efe5cf', '#d8c9a6'], roof: ['#a8452f', '#9c3f2c', '#b4553a', '#8f3a2a', '#a04a30', '#6d7d3c'], timber: '#4a3222', stone: '#8f8a7e', wall: '#a9a394', shutter: ['#3f6a4a', '#2f5570', '#7a3b2e'], pitch: 0.95, framed: true, floors: 0, grass: '#6f9b46', grass2: '#7fa84f', dirt: '#b9a57c', pave: '#b1a384', lit: 0.4, conifer: 0.3, tower: '#5c5a78' },
  argus: { plaster: ['#c9c2b0', '#bdb6a4', '#d3ccba', '#b2ab99'], roof: ['#7c3b2e', '#6d3a30', '#874536', '#5d4a3e'], timber: '#33261d', stone: '#7a766c', wall: '#8c867a', shutter: ['#3a3a3a', '#4a3226'], pitch: 0.9, framed: false, floors: 0, grass: '#6a8d47', grass2: '#789a50', dirt: '#a8976f', pave: '#9c9078', lit: 0.3, conifer: 0.35, tower: '#4b4b58' },
  styria: { plaster: ['#8a858f', '#7b7682', '#96919b', '#6f6b76'], roof: ['#3f3d44', '#4a4650', '#38363e', '#524d55', '#45424a'], timber: '#1e1a20', stone: '#3b3840', wall: '#4a4750', shutter: ['#221d22', '#2d2528'], pitch: 1.35, framed: true, floors: 1, grass: '#55683f', grass2: '#4d5e3c', dirt: '#6f675a', pave: '#5b5650', lit: 0.24, conifer: 0.85, tower: '#26222c' },
  church: { plaster: ['#efe9dc', '#e6dfd0', '#f4efe5', '#dcd4c2'], roof: ['#56677f', '#4d5e78', '#64768c', '#d9d3c5'], timber: '#6a6258', stone: '#c9c4b8', wall: '#ddd6c6', shutter: ['#3f5f86', '#2f4a70'], pitch: 0.5, framed: false, floors: 0, grass: '#7aa552', grass2: '#88b05a', dirt: '#d3c8ac', pave: '#ddd4c0', lit: 0.4, conifer: 0.15, tower: '#465a7d' },
  south: { plaster: ['#e8cfa0', '#e6bd8c', '#efdcb8', '#d9a878'], roof: ['#c4683c', '#b85c34', '#cf7446', '#ad5530'], timber: '#6b4a30', stone: '#b7a888', wall: '#c9b48c', shutter: ['#2f6f6a', '#3f7a4a', '#8a4a2a'], pitch: 0.42, framed: false, floors: 0, grass: '#8fa055', grass2: '#a0a95f', dirt: '#cdb488', pave: '#d8c4a0', lit: 0.45, conifer: 0.5, tower: '#a8552f' },
  kalt: { plaster: ['#a3a184', '#8f8d72', '#b0ae90', '#8a8a6c'], roof: ['#5d6b3a', '#6b7344', '#54603a', '#7a6a42'], timber: '#3e3524', stone: '#7d7b68', wall: '#7d7b68', shutter: ['#3e3524', '#4a4a30'], pitch: 0.3, framed: false, floors: 0, grass: '#7b8a4a', grass2: '#8a9452', dirt: '#b3a177', pave: '#a39878', lit: 0.3, conifer: 0.4, tower: '#46503a' }
}

// ---------- сборка геометрии: плоские грани, цвет в вершинах ----------
type V3 = [number, number, number]
const colors = new Map<string, THREE.Color>()
const C = (hex: string): THREE.Color => {
  let c = colors.get(hex)
  if (!c) colors.set(hex, (c = new THREE.Color(hex)))
  return c
}
class Bucket {
  p: number[] = []
  c: number[] = []
  uv: number[] = []
  tri(a: V3, b: V3, d: V3, col: string, k = 1, uva?: number[]): void {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2])
    const q = C(col)
    for (let i = 0; i < 3; i++) this.c.push(q.r * k, q.g * k, q.b * k)
    if (uva) this.uv.push(...uva)
  }
  quad(a: V3, b: V3, d: V3, e: V3, col: string, k = 1): void {
    this.tri(a, b, d, col, k)
    this.tri(a, d, e, col, k)
  }
  /** Коробка: x,z — центр, y — низ, поворот rot вокруг вертикали */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, col: string, rot = 0): void {
    const co = Math.cos(rot) / 2, si = Math.sin(rot) / 2
    const P = (u: number, v: number, h: number): V3 => [x + u * sx * co - v * sz * si, y + h * sy, z + u * sx * si + v * sz * co]
    const a = P(-1, -1, 0), b = P(1, -1, 0), d = P(1, 1, 0), e = P(-1, 1, 0), f = P(-1, -1, 1), g = P(1, -1, 1), h = P(1, 1, 1), i = P(-1, 1, 1)
    this.quad(a, b, g, f, col, 0.92)
    this.quad(b, d, h, g, col, 1)
    this.quad(d, e, i, h, col, 0.92)
    this.quad(e, a, f, i, col, 1)
    this.quad(f, g, h, i, col, 1.05)
  }
  /** Тело вращения (r2 = 0 — конус, n = 4 — пирамида) */
  cyl(x: number, y: number, z: number, r: number, h: number, n: number, col: string, r2 = r, cap = true, rot = 0): void {
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2
      const A: V3 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], B: V3 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r]
      const D: V3 = [x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2], E: V3 = [x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2]
      if (r2 > 0) this.quad(A, B, D, E, col)
      else this.tri(A, B, D, col)
      if (cap && r2 > 0) this.tri([x, y + h, z], E, D, col, 1.05)
    }
  }
  geometry(): THREE.BufferGeometry | null {
    if (!this.p.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    if (this.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeVertexNormals()
    return g
  }
}

const hashOf = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const rng = (seed: number) => (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mixHex = (a: string, b: string, t: number): string => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

function noise2(seed: number): (x: number, y: number) => number {
  const P = new Uint8Array(512), R = rng(seed), V = new Float32Array(256)
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = R() }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i]
  const at = (x: number, y: number): number => V[P[(P[x & 255] + y) & 255]]
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    return at(xi, yi) * (1 - u) * (1 - v) + at(xi + 1, yi) * u * (1 - v) + at(xi, yi + 1) * (1 - u) * v + at(xi + 1, yi + 1) * u * v
  }
}

type P2 = [number, number]
const ringOf = (flat: number[], k: number, from = 0): P2[] => {
  const out: P2[] = []
  for (let i = from; i + 1 < flat.length; i += 2) out.push([flat[i] / k, flat[i + 1] / k])
  return out
}
const areaOf = (r: P2[]): number => r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y }, 0) / 2
const centerOf = (r: P2[]): P2 => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1] } return [x / r.length, y / r.length] }

/** Отрезать часть контура по прямой v = 0: оставить sign·v ≥ 0 (контур в координатах u, v) */
function clipHalf(r: P2[], sign: number): P2[] {
  const out: P2[] = []
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length]
    const da = a[1] * sign, db = b[1] * sign
    if (da >= 0) out.push(a)
    if (da > 0 !== db > 0 && da !== db) {
      const t = da / (da - db)
      out.push([a[0] + (b[0] - a[0]) * t, 0])
    }
  }
  return out
}
/** Контур наружу (свес крыши); на острых углах сдвиг ограничен */
function grow(r: P2[], d: number): P2[] {
  const o = areaOf(r) > 0 ? 1 : -1
  return r.map((p, i) => {
    const a = r[(i + r.length - 1) % r.length], b = r[(i + 1) % r.length]
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1
    const n1: P2 = [((p[1] - a[1]) / l1) * o, (-(p[0] - a[0]) / l1) * o], n2: P2 = [((b[1] - p[1]) / l2) * o, (-(b[0] - p[0]) / l2) * o]
    const m: P2 = [n1[0] + n2[0], n1[1] + n2[1]]
    const ml = Math.hypot(m[0], m[1]) || 1
    const k = Math.min(1.6, 1 / Math.max(0.35, (m[0] * n1[0] + m[1] * n1[1]) / ml))
    return [p[0] + (m[0] / ml) * d * k, p[1] + (m[1] / ml) * d * k]
  })
}

function tileTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const R = rng(17)
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 8; col++) {
      const v = 205 + Math.floor(R() * 50)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(col * 16 + (row % 2) * 8, row * 16, 16, 16)
      g.fillStyle = 'rgba(0,0,0,.34)'
      g.fillRect(col * 16 + (row % 2) * 8, row * 16, 1.2, 16)
    }
  g.fillStyle = 'rgba(0,0,0,.42)'
  for (let row = 0; row < 8; row++) g.fillRect(0, row * 16, 128, 2)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function softDot(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  d.addColorStop(0, 'rgba(255,255,255,1)')
  d.addColorStop(0.35, 'rgba(255,255,255,.45)')
  d.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = d
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export interface CityWorld {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  center: P2
  radius: number
  /** Ширина и высота плана в метрах — для мини-карты */
  size: P2
  /** Метров на единицу плана */
  k: number
  heightAt: (x: number, z: number) => number
  /** Можно ли стоять в этой точке (и на какой высоте настил) */
  walkable: (x: number, z: number) => boolean
  deckAt: (x: number, z: number) => number | null
  pick: (o: THREE.Vector3, d: THREE.Vector3) => number | null
  buildingTop: (i: number) => [number, number, number] | null
  spawn: () => P2
  setTime: (hour: number, focus: THREE.Vector3) => void
  tick: (dt: number, t: number, cam: THREE.Camera) => void
  dispose: () => void
}

export function buildCity(plan: CityPlan, seedName: string, opts: { mobile: boolean; maxTexture: number }): CityWorld {
  const S: PlanScene = plan.scene ?? { s: 1, style: 'empire', forest: 0.1, tower: 7.6, droof: [], citadel: -1, dist: [], water: [], fields: [], greens: [], squares: [], walls: [], roads: [], rivers: [], planks: [] }
  const st = STYLES[S.style] ?? STYLES.empire
  const R = rng(hashOf(seedName) + 1)

  // единицы генератора Watabou — не метры: подбираем масштаб так, чтобы обычный дом занимал около 70 м²
  const areas = plan.buildings.map((b) => Math.abs(areaOf(ringOf(b, 1, 2)))).sort((a, b) => a - b)
  const med = areas[areas.length >> 1] || 300
  const k = Math.max(0.6, Math.min(Math.sqrt(med / 70), 12))
  const W = plan.w / k, H = plan.h / k
  const allPts = plan.buildings.flatMap((b) => ringOf(b, k, 2))
  const center: P2 = allPts.length ? centerOf(allPts) : [W / 2, H / 2]
  const radius = Math.max(30, Math.sqrt(allPts.reduce((m, p) => Math.max(m, (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2), 0)))

  const blds = plan.buildings.map((b) => ({ d: b[0], special: b[1] === 1, r: ringOf(b, k, 2) }))
  const dists = S.dist.map((f) => ringOf(f, k))
  const waters = S.water.map((f) => ringOf(f, k))
  const fields = S.fields.map((f) => ringOf(f, k))
  const greens = S.greens.map((f) => ringOf(f, k))
  const squares = S.squares.map((f) => ringOf(f, k))
  const lines = (l: PlanLine[]): { r: P2[]; w: number }[] => l.map((q) => ({ r: ringOf(q.r, k), w: q.w / k }))
  const roads = lines(S.roads), rivers = lines(S.rivers), planks = lines(S.planks), wallLines = lines(S.walls)

  const trace = (g: CanvasRenderingContext2D, r: P2[], close = true): void => {
    g.beginPath()
    r.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    if (close) g.closePath()
  }

  // ---------- маски: вода и застройка → сетка высот ----------
  const MS = 512
  const canvasMask = (paint: (g: CanvasRenderingContext2D) => void, passes: number, rad: number): Float32Array => {
    const c = document.createElement('canvas')
    c.width = c.height = MS
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.scale(MS / W, MS / H)
    g.fillStyle = g.strokeStyle = '#fff'
    g.lineCap = g.lineJoin = 'round'
    paint(g)
    const d = g.getImageData(0, 0, MS, MS).data
    let a = new Float32Array(MS * MS)
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4] / 255
    // размытие прямоугольником: ctx.filter на телефонах Safari не работает
    let b = new Float32Array(MS * MS)
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < MS; y++) { let s = 0; for (let x = -rad; x < MS; x++) { if (x + rad < MS) s += a[y * MS + x + rad]; else s += a[y * MS + MS - 1]; if (x - rad - 1 >= 0) s -= a[y * MS + x - rad - 1]; else s -= a[y * MS]; if (x >= 0) b[y * MS + x] = s / (2 * rad + 1) + 0 } }
      ;[a, b] = [b, a]
      for (let x = 0; x < MS; x++) { let s = 0; for (let y = -rad; y < MS; y++) { if (y + rad < MS) s += a[(y + rad) * MS + x]; else s += a[(MS - 1) * MS + x]; if (y - rad - 1 >= 0) s -= a[(y - rad - 1) * MS + x]; else s -= a[x]; if (y >= 0) b[y * MS + x] = s / (2 * rad + 1) } }
      ;[a, b] = [b, a]
    }
    return a
  }
  const sampler = (m: Float32Array) => (x: number, z: number): number => {
    const u = Math.max(0, Math.min(MS - 1.001, (x / W) * MS)), v = Math.max(0, Math.min(MS - 1.001, (z / H) * MS))
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j
    return (m[j * MS + i] * (1 - fu) + m[j * MS + i + 1] * fu) * (1 - fv) + (m[(j + 1) * MS + i] * (1 - fu) + m[(j + 1) * MS + i + 1] * fu) * fv
  }
  const hasWater = waters.length > 0 || rivers.length > 0
  const waterAt = hasWater
    ? sampler(canvasMask((g) => {
        waters.forEach((r) => { trace(g, r); g.fill() })
        rivers.forEach((q) => { trace(g, q.r, false); g.lineWidth = q.w; g.stroke() })
      }, 2, 2))
    : () => 0
  const townAt = sampler(canvasMask((g) => {
    blds.forEach((b) => { trace(g, b.r); g.fill() })
    dists.forEach((r) => { trace(g, r); g.fill() })
    wallLines.forEach((q) => { trace(g, q.r); g.fill() })
    fields.forEach((r) => { trace(g, r); g.fill() })
    roads.forEach((q) => { trace(g, q.r, false); g.lineWidth = Math.max(8, q.w * 2); g.stroke() })
  }, 3, 14))

  const margin = Math.max(350, Math.max(W, H) * 0.6)
  const x0 = -margin, z0 = -margin, EW = W + margin * 2, EH = H + margin * 2
  const hillAmp = S.rocky ? 46 : S.hills ? 20 : 7
  const n1 = noise2(hashOf(seedName) + 3)
  const rawHeight = (x: number, z: number): number => {
    const f = 1 / Math.max(90, radius * 0.5)
    const hill = n1(x * f, z * f) * 0.65 + n1(x * f * 2.3 + 40, z * f * 2.3) * 0.28 + n1(x * f * 6 + 90, z * f * 6) * 0.07
    const out = 1 - smooth(0.02, 0.5, townAt(x, z))
    const edge = Math.max(0, Math.max(-x, x - W, -z, z - H)) / margin
    const land = 1.1 + (n1(x * 0.02, z * 0.02) - 0.5) * 0.6 + Math.max(0, hill - 0.3) * 1.7 * hillAmp * out * (0.45 + edge)
    const w = waterAt(x, z)
    return land * (1 - smooth(0.12, 0.5, w)) - 3 * smooth(0.3, 0.75, w)
  }
  const GN = opts.mobile ? 180 : EW > 2500 ? 384 : 256
  const GM = Math.round((GN * EH) / EW)
  const hgrid = new Float32Array((GN + 1) * (GM + 1))
  for (let j = 0; j <= GM; j++) for (let i = 0; i <= GN; i++) hgrid[j * (GN + 1) + i] = rawHeight(x0 + (i / GN) * EW, z0 + (j / GM) * EH)
  const heightAt = (x: number, z: number): number => {
    const u = Math.max(0, Math.min(GN - 0.001, ((x - x0) / EW) * GN)), v = Math.max(0, Math.min(GM - 0.001, ((z - z0) / EH) * GM))
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, L = GN + 1
    return (hgrid[j * L + i] * (1 - fu) + hgrid[j * L + i + 1] * fu) * (1 - fv) + (hgrid[(j + 1) * L + i] * (1 - fu) + hgrid[(j + 1) * L + i + 1] * fu) * fv
  }

  // ---------- сетка занятости: столкновения, выбор здания, места для деревьев ----------
  const cell = Math.max(0.75, Math.max(W, H) / 1800)
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell)
  const grid = new Int32Array(gw * gh) // >0 здание+1, -1 стена, -2 вода, -3 настил
  const fillPoly = (r: P2[], v: number): void => {
    let a = 1e9, b = -1e9
    for (const p of r) { a = Math.min(a, p[1]); b = Math.max(b, p[1]) }
    const y0 = Math.max(0, Math.floor(a / cell)), y1 = Math.min(gh - 1, Math.ceil(b / cell))
    for (let j = y0; j <= y1; j++) {
      const y = (j + 0.5) * cell, xs: number[] = []
      for (let i = 0; i < r.length; i++) {
        const p = r[i], q = r[(i + 1) % r.length]
        if (p[1] > y !== q[1] > y) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]))
      }
      xs.sort((m, n) => m - n)
      for (let n = 0; n + 1 < xs.length; n += 2) for (let i = Math.max(0, Math.floor(xs[n] / cell)); i <= Math.min(gw - 1, Math.floor(xs[n + 1] / cell)); i++) grid[j * gw + i] = v
    }
  }
  const fillLine = (r: P2[], w: number, v: number): void => {
    for (let s = 1; s < r.length; s++) {
      const [ax, ay] = r[s - 1], [bx, by] = r[s]
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell / 2)), rr = Math.ceil(w / 2 / cell)
      for (let t = 0; t <= n; t++) {
        const cx = Math.floor((ax + ((bx - ax) * t) / n) / cell), cy = Math.floor((ay + ((by - ay) * t) / n) / cell)
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
          const gx = cx + dx, gy = cy + dy
          if (gx >= 0 && gy >= 0 && gx < gw && gy < gh && dx * dx + dy * dy <= rr * rr) grid[gy * gw + gx] = v
        }
      }
    }
  }
  if (hasWater) for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (heightAt((i + 0.5) * cell, (j + 0.5) * cell) < -0.2) grid[j * gw + i] = -2
  planks.forEach((q) => fillLine(q.r, Math.max(q.w, 3), -3))
  blds.forEach((b, i) => fillPoly(b.r, i + 1))
  const gridAt = (x: number, z: number): number => {
    const i = Math.floor(x / cell), j = Math.floor(z / cell)
    return i < 0 || j < 0 || i >= gw || j >= gh ? 0 : grid[j * gw + i]
  }

  // ---------- земля: всё плоское рисуется на холсте ----------
  const texMax = Math.min(opts.maxTexture, opts.mobile ? 2048 : W > 900 ? 4096 : 2048)
  const tc = document.createElement('canvas')
  tc.width = texMax
  tc.height = Math.round((texMax * EH) / EW)
  const g = tc.getContext('2d')!
  const pxPerM = tc.width / EW
  const groundFill = S.rocky ? mixHex(st.grass, '#8d8a78', 0.45) : st.grass
  g.fillStyle = groundFill
  g.fillRect(0, 0, tc.width, tc.height)
  const RT = rng(hashOf(seedName) + 5)
  for (let i = 0; i < 2600; i++) {
    const x = RT() * tc.width, y = RT() * tc.height, r = (6 + RT() * 60) * (tc.width / 2048)
    g.fillStyle = RT() < 0.5 ? st.grass2 : mixHex(groundFill, '#39482a', 0.35)
    g.globalAlpha = 0.09 + RT() * 0.14
    g.beginPath()
    g.ellipse(x, y, r, r * (0.5 + RT() * 0.5), RT() * 3, 0, 7)
    g.fill()
  }
  g.globalAlpha = 1
  g.save()
  g.translate(margin * pxPerM, margin * pxPerM)
  g.scale(pxPerM, pxPerM)
  g.lineCap = g.lineJoin = 'round'
  // поля: борозды по длинной стороне
  const FIELD = S.style === 'styria' ? ['#7c7a58', '#6c6d4c', '#857a5a', '#5f6846'] : S.style === 'south' ? ['#c9b264', '#a9a85a', '#d0b878', '#8f9a50'] : ['#c7b35e', '#a8ab55', '#8fa24c', '#b99f58', '#7f9a48']
  fields.forEach((r, i) => {
    const col = FIELD[i % FIELD.length]
    g.save()
    trace(g, r)
    g.fillStyle = col
    g.fill()
    g.clip()
    let best = 0, ang = 0
    r.forEach((p, n) => { const q = r[(n + 1) % r.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; ang = Math.atan2(q[1] - p[1], q[0] - p[0]) } })
    const [cx, cy] = centerOf(r)
    g.translate(cx, cy)
    g.rotate(ang)
    g.strokeStyle = mixHex(col, '#3f3a20', 0.32)
    g.lineWidth = 0.55
    g.beginPath()
    const span = Math.max(best * 1.4, 40)
    for (let y = -span; y < span; y += 1.7) { g.moveTo(-span, y); g.lineTo(span, y) }
    g.stroke()
    g.restore()
    trace(g, r)
    g.strokeStyle = mixHex(col, '#3f3a20', 0.45)
    g.lineWidth = 0.8
    g.stroke()
  })
  greens.forEach((r) => { trace(g, r); g.fillStyle = mixHex(st.grass, '#2f4a22', 0.35); g.fill() })
  // берег
  const sand = S.style === 'styria' ? '#6d675a' : '#d6c79a'
  waters.forEach((r) => { trace(g, r); g.strokeStyle = sand; g.lineWidth = 7; g.stroke() })
  rivers.forEach((q) => { trace(g, q.r, false); g.strokeStyle = sand; g.lineWidth = q.w + 5; g.stroke() })
  // земля кварталов и площади: утоптанная земля и мостовая
  dists.forEach((r) => { trace(g, r); g.fillStyle = st.dirt; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1 })
  const speck = (r: P2[], n: number, col: string, alpha: number, size: number): void => {
    g.save()
    trace(g, r)
    g.clip()
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9
    for (const p of r) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]) }
    g.fillStyle = col
    g.globalAlpha = alpha
    for (let i = 0; i < n; i++) { const s = size * (0.5 + RT()); g.fillRect(a + RT() * (b - a), c + RT() * (d - c), s, s * 0.7) }
    g.restore()
  }
  dists.forEach((r) => speck(r, Math.min(5000, Math.abs(areaOf(r)) / 6), mixHex(st.dirt, '#3a3020', 0.4), 0.22, 0.9))
  squares.forEach((r) => {
    trace(g, r)
    g.fillStyle = st.pave
    g.fill()
    g.strokeStyle = mixHex(st.pave, '#000', 0.3)
    g.lineWidth = 0.8
    g.stroke()
    speck(r, Math.min(9000, Math.abs(areaOf(r))), mixHex(st.pave, '#000', 0.25), 0.4, 0.8)
  })
  // дороги: обочина, полотно, две колеи
  const road = mixHex(st.dirt, st.grass, 0.08), rut = mixHex(st.dirt, '#2c2418', 0.45)
  for (const q of roads) {
    const w = Math.max(q.w, 3.6)
    trace(g, q.r, false)
    g.strokeStyle = mixHex(st.dirt, st.grass, 0.55)
    g.lineWidth = w + 2
    g.stroke()
    trace(g, q.r, false)
    g.strokeStyle = road
    g.lineWidth = w
    g.stroke()
    for (const off of [-0.75, 0.75]) {
      g.beginPath()
      q.r.forEach((p, i) => {
        const a = q.r[Math.max(0, i - 1)], b = q.r[Math.min(q.r.length - 1, i + 1)]
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const x = p[0] - ((b[1] - a[1]) / l) * off, y = p[1] + ((b[0] - a[0]) / l) * off
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      })
      g.strokeStyle = rut
      g.globalAlpha = 0.55
      g.lineWidth = 0.28
      g.stroke()
      g.globalAlpha = 1
    }
  }
  rivers.forEach((q) => { trace(g, q.r, false); g.strokeStyle = '#3f7488'; g.lineWidth = q.w; g.stroke() })
  // тень у основания домов: читается даже там, где нет настоящих теней
  g.strokeStyle = 'rgba(25,18,10,.3)'
  g.lineWidth = 1.5
  blds.forEach((b) => { trace(g, b.r); g.stroke() })
  g.restore()

  const groundTex = new THREE.CanvasTexture(tc)
  groundTex.colorSpace = THREE.SRGBColorSpace
  groundTex.anisotropy = 8
  const scene = new THREE.Scene()
  const disposable: { dispose: () => void }[] = [groundTex]
  const groundGeo = new THREE.BufferGeometry()
  {
    const n = (GN + 1) * (GM + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3)
    const rock = C('#8b8878'), shore = C(sand), white = new THREE.Color(1, 1, 1), tmp = new THREE.Color()
    for (let j = 0; j <= GM; j++)
      for (let i = 0; i <= GN; i++) {
        const q = j * (GN + 1) + i, x = x0 + (i / GN) * EW, z = z0 + (j / GM) * EH, y = hgrid[q]
        pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z
        uv[q * 2] = i / GN; uv[q * 2 + 1] = 1 - j / GM
        tmp.copy(white)
        if (y > 12) tmp.lerp(rock, smooth(12, 30, y) * 0.85)
        if (y < 0.55 && hasWater) tmp.lerp(shore, 0.75 * smooth(0.55, 0.1, y))
        if (y < -0.3) tmp.multiplyScalar(0.55)
        col[q * 3] = tmp.r; col[q * 3 + 1] = tmp.g; col[q * 3 + 2] = tmp.b
      }
    const idx = new Uint32Array(GN * GM * 6)
    let e = 0
    for (let j = 0; j < GM; j++)
      for (let i = 0; i < GN; i++) {
        const a = j * (GN + 1) + i, b = a + 1, c = a + GN + 1, d = c + 1
        idx[e++] = a; idx[e++] = c; idx[e++] = b; idx[e++] = b; idx[e++] = c; idx[e++] = d
      }
    groundGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    groundGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    groundGeo.setIndex(new THREE.BufferAttribute(idx, 1))
    groundGeo.computeVertexNormals()
  }
  const groundMat = new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.receiveShadow = true
  scene.add(ground)
  disposable.push(groundGeo, groundMat)

  // ---------- материалы и куски города ----------
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  const tileTex = tileTexture()
  const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: tileTex })
  const glowMat = new THREE.MeshBasicMaterial({ color: '#39464f', toneMapped: false, side: THREE.DoubleSide, fog: true })
  disposable.push(solidMat, roofMat, glowMat, tileTex)
  const CHUNK = Math.max(90, radius / 3)
  interface Chunk { solid: Bucket; roof: Bucket; glow: Bucket }
  const chunks = new Map<string, Chunk>()
  const chunkAt = (x: number, z: number): Chunk => {
    const key = `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`
    let c = chunks.get(key)
    if (!c) chunks.set(key, (c = { solid: new Bucket(), roof: new Bucket(), glow: new Bucket() }))
    return c
  }
  // детальность по размеру: столица в десять тысяч домов и деревня строятся по-разному
  const N = blds.length
  const detail = opts.mobile ? (N > 1500 ? 0 : N > 400 ? 1 : 2) : N > 5000 ? 0 : N > 1800 ? 1 : 2

  const marks = new Map<number, string>((plan.landmarks ?? []).map((l) => [l.b, l.name]))
  const kindOf = (i: number): string => {
    const n = marks.get(i) ?? ''
    if (/храм|собор|церк|часовн|капелл|сан-|санта-/i.test(n)) return 'temple'
    if (/замок|кастра|цитадел|гнездо|крепост|кастелян/i.test(n)) return 'keep'
    if (/ратуш|палат|совет|дворец|губернатор|подест|магистрат|дом /i.test(n)) return 'civic'
    if (/мельниц/i.test(n)) return 'mill'
    if (blds[i].special) return S.citadel >= 0 && pointIn(centerOf(blds[i].r), wallLines[S.citadel].r) ? 'keep' : 'temple'
    return ''
  }
  function pointIn([x, y]: P2, r: P2[]): boolean {
    let c = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c
    return c
  }

  const tops = new Float32Array(N)
  const crenel = (ch: Chunk, a: P2, b: P2, y: number, col: string, t: number, step = 2.1): void => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[1] - a[1], b[0] - a[0])
    const n = Math.max(1, Math.floor(len / step))
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n
      ch.solid.box(a[0] + (b[0] - a[0]) * f, y, a[1] + (b[1] - a[1]) * f, (len / n) * 0.55, 1.1, t, col, rot)
    }
  }

  blds.forEach((b, idx) => {
    let r = b.r.filter((p, i) => { const q = b.r[(i + 1) % b.r.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.25 })
    if (r.length < 3) { r = b.r; if (r.length < 3) return }
    const ctr = centerOf(r)
    const ch = chunkAt(ctr[0], ctr[1])
    const base = heightAt(ctr[0], ctr[1])
    const area = Math.abs(areaOf(r))
    const kind = kindOf(idx)
    const rv = (): number => R()
    const orient = areaOf(r) > 0 ? 1 : -1

    // ось конька — длинная сторона наименьшего описанного прямоугольника
    let best = 1e18, ux = 1, uz = 0, u0 = 0, u1 = 0, v0 = 0, v1 = 0
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length]
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
      const ax = (q[0] - p[0]) / l, az = (q[1] - p[1]) / l
      let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9
      for (const w of r) {
        const u = w[0] * ax + w[1] * az, v = -w[0] * az + w[1] * ax
        a0 = Math.min(a0, u); a1 = Math.max(a1, u); c0 = Math.min(c0, v); c1 = Math.max(c1, v)
      }
      const s = (a1 - a0) * (c1 - c0)
      if (s < best) {
        best = s
        if (a1 - a0 >= c1 - c0) { ux = ax; uz = az; u0 = a0; u1 = a1; v0 = c0; v1 = c1 } else { ux = -az; uz = ax; u0 = c0; u1 = c1; v0 = -a1; v1 = -a0 }
      }
    }
    const vc = (v0 + v1) / 2, hw = Math.max(0.8, (v1 - v0) / 2)
    const toUV = (p: P2): P2 => [p[0] * ux + p[1] * uz, -p[0] * uz + p[1] * ux - vc]
    const fromUV = (u: number, v: number): P2 => [u * ux - (v + vc) * uz, u * uz + (v + vc) * ux]

    let floors = 1 + (area > 55 ? 1 : 0) + (area > 110 && rv() < 0.55 ? 1 : 0)
    if (rv() < 0.25) floors = Math.max(1, floors - 1)
    if (N > 200 && dists.length) floors += st.floors
    const plaster = st.plaster[Math.floor(rv() * st.plaster.length)]
    const pal = S.droof[b.d] ?? S.roof ?? st.roof
    const roofCol = kind === 'temple' ? st.tower : kind === 'keep' ? mixHex(st.stone, '#000', 0.2) : pal[Math.floor(rv() * pal.length)]
    const stoneBody = kind === 'temple' || kind === 'keep' || kind === 'civic'
    const wallCol = stoneBody ? mixHex(st.wall, st.plaster[0], 0.3) : plaster
    const eave = kind === 'temple' ? Math.min(16, 8 + Math.sqrt(area) * 0.2) : kind === 'keep' ? Math.min(22, 11 + Math.sqrt(area) * 0.3) : kind === 'civic' ? 3.3 * Math.max(floors, 3) : 0.5 + floors * 3
    const rise = Math.min(hw * st.pitch, kind === 'keep' ? 0 : hw > 8 ? 7 : 99)
    const pitch = rise / hw
    const topAt = (p: P2): number => { const v = Math.abs(toUV(p)[1]); return base + eave + Math.max(-1.5, rise - v * pitch) }
    tops[idx] = base + eave + rise

    // стены: каждую сторону делим на коньке, чтобы щипец вышел ровным
    const edges: { a: P2; b: P2; n: P2; len: number; hidden: boolean }[] = []
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length]
      const va = toUV(a)[1], vb = toUV(c)[1]
      const parts: P2[] = [a]
      if (va > 0 !== vb > 0 && va !== vb && kind !== 'keep') { const t = va / (va - vb); parts.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]) }
      parts.push(c)
      for (let s = 0; s + 1 < parts.length; s++) {
        const p = parts[s], q = parts[s + 1]
        const tp = kind === 'keep' ? base + eave : topAt(p), tq = kind === 'keep' ? base + eave : topAt(q)
        ch.solid.quad([p[0], base - 2, p[1]], [q[0], base - 2, q[1]], [q[0], tq, q[1]], [p[0], tp, p[1]], wallCol)
      }
      const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1
      const nx = ((c[1] - a[1]) / l) * orient, nz = (-(c[0] - a[0]) / l) * orient
      const mx = (a[0] + c[0]) / 2 + nx * 1.1, mz = (a[1] + c[1]) / 2 + nz * 1.1
      const other = gridAt(mx, mz)
      edges.push({ a, b: c, n: [nx, nz], len: l, hidden: other > 0 && other !== idx + 1 })
      // цоколь
      if (detail >= 1 && !edges[edges.length - 1].hidden) {
        const off = 0.07
        ch.solid.quad([a[0] + nx * off, base - 0.5, a[1] + nz * off], [c[0] + nx * off, base - 0.5, c[1] + nz * off], [c[0] + nx * off, base + 0.55, c[1] + nz * off], [a[0] + nx * off, base + 0.55, a[1] + nz * off], st.stone)
      }
    }

    // крыша: два ската по контуру со свесом; плоская — у цитадельных башен
    if (kind === 'keep') {
      const flat = r.map(toUV)
      const tris = THREE.ShapeUtils.triangulateShape(flat.map(([u, v]) => new THREE.Vector2(u, v)), [])
      for (const [i, j, m] of tris) ch.solid.tri([r[i][0], base + eave, r[i][1]], [r[j][0], base + eave, r[j][1]], [r[m][0], base + eave, r[m][1]], roofCol)
      for (const e of edges) crenel(ch, e.a, e.b, base + eave, wallCol, 0.7, 2.2)
      for (const p of r) if (r.length <= 10) ch.solid.cyl(p[0], base, p[1], 2.2, eave + 2.2, 8, wallCol)
      if (area > 90) {
        const s = Math.sqrt(area) * 0.42
        ch.solid.cyl(ctr[0], base + eave - 1, ctr[1], s * 0.6, 7, 10, mixHex(wallCol, '#000', 0.06))
        for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; ch.solid.box(ctr[0] + Math.cos(a) * s * 0.6, base + eave + 6, ctr[1] + Math.sin(a) * s * 0.6, 0.9, 1, 0.6, wallCol, a + 1.57) }
        ch.solid.box(ctr[0], base + eave + 6, ctr[1], 0.1, 5, 0.1, '#2a2420')
        ch.solid.box(ctr[0] + 0.8, base + eave + 9.8, ctr[1], 1.6, 1, 0.05, S.style === 'styria' ? '#2a1a2a' : '#8f2f2f')
      }
    } else {
      const over = grow(r, kind ? 0.5 : 0.35)
      const uv = over.map(toUV)
      const LIFT = 0.02
      for (const sgn of [1, -1]) {
        const half = clipHalf(uv, sgn)
        if (half.length < 3) continue
        const tris = THREE.ShapeUtils.triangulateShape(half.map(([u, v]) => new THREE.Vector2(u, v)), [])
        const P = (q: P2): V3 => { const w = fromUV(q[0], q[1]); return [w[0], base + eave + rise - Math.abs(q[1]) * pitch + LIFT, w[1]] }
        const slope = Math.sqrt(1 + pitch * pitch)
        for (const [i, j, m] of tris) {
          const A = half[i], B = half[j], D = half[m]
          ch.roof.tri(P(A), P(B), P(D), roofCol, S.style === 'styria' ? 1.5 : 1, [A[0] / 2.4, (Math.abs(A[1]) * slope) / 2.4, B[0] / 2.4, (Math.abs(B[1]) * slope) / 2.4, D[0] / 2.4, (Math.abs(D[1]) * slope) / 2.4])
        }
      }
      // конёк
      if (detail >= 1) {
        const a = fromUV(u0 - 0.3, 0), c = fromUV(u1 + 0.3, 0), y = base + eave + rise + 0.02
        ch.solid.box((a[0] + c[0]) / 2, y - 0.08, (a[1] + c[1]) / 2, Math.hypot(c[0] - a[0], c[1] - a[1]), 0.18, 0.28, mixHex(roofCol, '#000', 0.35), Math.atan2(c[1] - a[1], c[0] - a[0]))
      }
    }

    // окна, двери, фахверк
    const shutter = st.shutter[Math.floor(rv() * st.shutter.length)]
    const litHere = kind === 'temple' ? 0.9 : st.lit
    const wq = (e: (typeof edges)[number], t0: number, t1: number, y0: number, y1: number, off: number): [V3, V3, V3, V3] => {
      const ax = e.a[0] + (e.b[0] - e.a[0]) * t0 + e.n[0] * off, az = e.a[1] + (e.b[1] - e.a[1]) * t0 + e.n[1] * off
      const bx = e.a[0] + (e.b[0] - e.a[0]) * t1 + e.n[0] * off, bz = e.a[1] + (e.b[1] - e.a[1]) * t1 + e.n[1] * off
      return [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]]
    }
    const visible = edges.filter((e) => !e.hidden && e.len > 1.6)
    let door: (typeof edges)[number] | null = null
    if (visible.length) door = visible.reduce((a, e) => (e.len > a.len ? e : a), visible[0])
    if (detail >= 1) {
      const storeys = kind === 'temple' ? 1 : kind === 'keep' ? Math.floor(eave / 4) : kind === 'civic' ? 3 : floors
      const fh = kind === 'temple' ? eave - 1 : kind === 'keep' ? 4 : (eave - 0.5) / Math.max(1, storeys)
      for (const e of visible) {
        const count = Math.max(0, Math.min(kind === 'temple' ? 6 : 6, Math.floor(e.len / (kind === 'temple' ? 3.4 : 2.7))))
        for (let fl = 0; fl < storeys; fl++) {
          const wy = kind === 'temple' ? base + 2.2 : base + 0.5 + fl * fh + fh * 0.32
          const wh = kind === 'temple' ? eave - 4 : Math.min(1.25, fh * 0.45)
          if (wy + wh > base + eave - 0.2) continue
          for (let i = 0; i < count; i++) {
            const c = (i + 0.5) / count
            if (e === door && fl === 0 && Math.abs(c - 0.5) < 1.1 / e.len + 0.02) continue
            const hwn = (kind === 'temple' ? 0.45 : kind === 'keep' ? 0.25 : 0.42) / e.len
            const lit = rv() < litHere
            const ce = (i * 2 + fl) % 3 === 0 && count > 1 && detail < 2
            if (ce) continue
            if (detail >= 2 && !kind) {
              ch.solid.quad(...wq(e, c - hwn - 0.08 / e.len, c + hwn + 0.08 / e.len, wy - 0.08, wy + wh + 0.08, 0.05), st.timber)
              ch.solid.quad(...wq(e, c - hwn - 0.42 / e.len, c - hwn - 0.08 / e.len, wy - 0.02, wy + wh + 0.02, 0.06), shutter)
              ch.solid.quad(...wq(e, c + hwn + 0.08 / e.len, c + hwn + 0.42 / e.len, wy - 0.02, wy + wh + 0.02, 0.06), shutter)
            }
            const q = wq(e, c - hwn, c + hwn, wy, wy + wh, 0.08)
            if (lit) ch.glow.quad(...q, '#ffffff')
            else ch.solid.quad(...q, '#2b333b')
          }
        }
        // фахверк: балки между этажами, стойки, раскосы верхнего этажа
        if (detail >= 2 && st.framed && !kind) {
          for (let fl = 1; fl <= floors; fl++) {
            const y = base + 0.5 + fl * fh
            if (y > base + eave + 0.05) break
            ch.solid.quad(...wq(e, 0, 1, y - 0.1, y + 0.1, 0.05), st.timber)
          }
          ch.solid.quad(...wq(e, 0, 0.16 / e.len, base + 0.5, base + eave, 0.05), st.timber)
          ch.solid.quad(...wq(e, 1 - 0.16 / e.len, 1, base + 0.5, base + eave, 0.05), st.timber)
          if (floors > 1 && e.len > 3.5) {
            for (const f of [0.34, 0.66]) ch.solid.quad(...wq(e, f - 0.06 / e.len, f + 0.06 / e.len, base + 0.5, base + eave, 0.05), st.timber)
          }
        }
      }
      if (door && !stoneBody) {
        const hd = 0.55 / door.len
        ch.solid.quad(...wq(door, 0.5 - hd - 0.1 / door.len, 0.5 + hd + 0.1 / door.len, base, base + 2.2, 0.05), st.timber)
        ch.solid.quad(...wq(door, 0.5 - hd, 0.5 + hd, base, base + 2.1, 0.08), mixHex(st.timber, '#6b3f22', 0.5))
        if (detail >= 2) {
          const cx = (door.a[0] + door.b[0]) / 2 + door.n[0] * 0.9, cz = (door.a[1] + door.b[1]) / 2 + door.n[1] * 0.9
          const rot = Math.atan2(door.b[1] - door.a[1], door.b[0] - door.a[0])
          // навес над дверью, столбики, бочка или ящик рядом
          ch.solid.box(cx, base + 2.55, cz, 2.1, 0.14, 1.9, mixHex(roofCol, st.timber, 0.3), rot)
          if (rv() < 0.6) for (const s of [-0.9, 0.9]) ch.solid.box(cx + Math.cos(rot) * s + door.n[0] * 0.75, base, cz + Math.sin(rot) * s + door.n[1] * 0.75, 0.13, 2.55, 0.13, st.timber)
          if (gridAt(cx + door.n[0] * 1.2, cz + door.n[1] * 1.2) === 0 && rv() < 0.5) {
            const sx = cx + Math.cos(rot) * 1.4 + door.n[0] * 0.2, sz = cz + Math.sin(rot) * 1.4 + door.n[1] * 0.2
            if (rv() < 0.5) ch.solid.cyl(sx, base, sz, 0.36, 0.95, 7, '#6e4a2c')
            else ch.solid.box(sx, base, sz, 0.8, 0.7, 0.8, '#8a6a42', rot)
          }
        }
      }
    }
    // дымоход
    if (!kind && detail >= 1 && rv() < 0.55 && hw < 7) {
      const u = u0 + (u1 - u0) * (0.2 + rv() * 0.6), v = (rv() - 0.5) * hw * 0.5
      const [cx, cz] = fromUV(u, v)
      const y = base + eave + rise - Math.abs(v) * pitch - 0.4
      ch.solid.box(cx, y, cz, 0.75, 1.9, 0.75, st.stone, Math.atan2(uz, ux))
      ch.solid.box(cx, y + 1.9, cz, 0.95, 0.16, 0.95, mixHex(st.stone, '#000', 0.3), Math.atan2(uz, ux))
    }
    // башня с шатром у храма, башенка с часами у ратуши, крылья у мельницы
    if (kind === 'temple') {
      const [tx, tz] = fromUV(u0 + Math.min(hw, (u1 - u0) / 4), 0)
      const s = Math.max(3.4, Math.min(9, hw * 1.25)), th = eave + rise + 8 + Math.sqrt(area) * 0.3, rot = Math.atan2(uz, ux)
      ch.solid.box(tx, base, tz, s, th, s, wallCol, rot)
      ch.solid.cyl(tx, base + th, tz, s * 0.72, s * 2, 4, st.tower, 0, false, rot + Math.PI / 4)
      ch.solid.box(tx, base + th + s * 2, tz, 0.16, 2.4, 0.16, S.style === 'styria' ? '#111' : '#d8c070')
      ch.solid.box(tx, base + th + s * 2 + 1.4, tz, 1.2, 0.16, 0.16, S.style === 'styria' ? '#111' : '#d8c070', rot)
      for (let i = 0; i < 4; i++) {
        const a = rot + (i * Math.PI) / 2
        const wx = tx + (Math.cos(a) * s) / 2, wz = tz + (Math.sin(a) * s) / 2
        const perp = a + Math.PI / 2
        const P = (d: number, y: number): V3 => [wx + Math.cos(perp) * d + Math.cos(a) * 0.06, y, wz + Math.sin(perp) * d + Math.sin(a) * 0.06]
        ch.glow.quad(P(-0.5, base + th - 3.4), P(0.5, base + th - 3.4), P(0.5, base + th - 1), P(-0.5, base + th - 1), '#ffffff')
      }
      tops[idx] = Math.max(tops[idx], base + th + s * 2)
    }
    if (kind === 'civic') {
      const s = Math.min(5, hw), rot = Math.atan2(uz, ux)
      ch.solid.box(ctr[0], base + eave, ctr[1], s, rise + 6, s, wallCol, rot)
      ch.solid.cyl(ctr[0], base + eave + rise + 6, ctr[1], s * 0.72, s * 1.2, 4, roofCol, 0, false, rot + Math.PI / 4)
      tops[idx] = base + eave + rise + 6 + s * 1.2
    }
    if (kind === 'mill') {
      ch.solid.cyl(ctr[0], base + eave, ctr[1], 2.2, 4, 8, wallCol, 1.6)
      ch.solid.cyl(ctr[0], base + eave + 4, ctr[1], 1.9, 2, 8, roofCol, 0, false)
      const rot = Math.atan2(uz, ux)
      const hx = ctr[0] + Math.cos(rot) * 2.1, hz = ctr[1] + Math.sin(rot) * 2.1, hy = base + eave + 4.5
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.4, dx = -Math.sin(rot) * Math.cos(a), dz = Math.cos(rot) * Math.cos(a), dy = Math.sin(a)
        ch.solid.quad([hx, hy, hz], [hx + dx * 7, hy + dy * 7, hz + dz * 7], [hx + dx * 7 + Math.sin(a) * 0, hy + dy * 7 + 1, hz + dz * 7], [hx, hy + 1, hz], '#d9cfb4')
      }
    }
  })

  // ---------- стены города: зубцы, башни, ворота там, где стену пересекает дорога ----------
  const wallColor = st.wall
  const segCross = (a: P2, b: P2, c: P2, d: P2): number | null => {
    const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
    if (Math.abs(r) < 1e-6) return null
    const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r
    const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
  }
  wallLines.forEach((w, wi) => {
    const r = w.r
    if (r.length < 2) return
    const isCit = wi === S.citadel
    const wh = (isCit ? 9 : 7) * (S.style === 'styria' ? 1.15 : 1)
    const th = Math.max(1.8, Math.min(3.2, w.w / 2))
    const towerR = Math.max(2.4, Math.min(4.4, S.tower / k * 0.9))
    const closed = true
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length]
      if (!closed && i === r.length - 1) break
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.5) continue
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, nx = -uz, nz = ux
      // ворота на этом участке
      const gates: number[] = []
      for (const q of roads) for (let s = 1; s < q.r.length; s++) { const t = segCross(a, b, q.r[s - 1], q.r[s]); if (t !== null) gates.push(t * len) }
      for (const q of planks) for (let s = 1; s < q.r.length; s++) { const t = segCross(a, b, q.r[s - 1], q.r[s]); if (t !== null) gates.push(t * len) }
      gates.sort((m, n) => m - n)
      const GATE = 4.2
      const spans: [number, number][] = []
      let cur = 0
      for (const g0 of gates) { if (g0 - GATE > cur) spans.push([cur, g0 - GATE]); cur = Math.max(cur, g0 + GATE) }
      if (cur < len) spans.push([cur, len])
      for (const [s0, s1] of spans) {
        const L = s1 - s0, n = Math.max(1, Math.ceil(L / 7))
        for (let j = 0; j < n; j++) {
          const f0 = s0 + (L * j) / n, f1 = s0 + (L * (j + 1)) / n
          const A: P2 = [a[0] + ux * f0, a[1] + uz * f0], B: P2 = [a[0] + ux * f1, a[1] + uz * f1]
          const ya = heightAt(A[0], A[1]), yb = heightAt(B[0], B[1])
          const ch = chunkAt(A[0], A[1])
          const o = th / 2
          const A1: V3 = [A[0] + nx * o, ya, A[1] + nz * o], B1: V3 = [B[0] + nx * o, yb, B[1] + nz * o], A2: V3 = [A[0] - nx * o, ya, A[1] - nz * o], B2: V3 = [B[0] - nx * o, yb, B[1] - nz * o]
          const up = (v: V3, h: number): V3 => [v[0], v[1] + h, v[2]]
          const dn = (v: V3): V3 => [v[0], v[1] - 2, v[2]]
          ch.solid.quad(dn(A1), dn(B1), up(B1, wh), up(A1, wh), wallColor)
          ch.solid.quad(dn(A2), dn(B2), up(B2, wh), up(A2, wh), mixHex(wallColor, '#000', 0.08))
          ch.solid.quad(up(A1, wh), up(B1, wh), up(B2, wh), up(A2, wh), mixHex(wallColor, '#000', 0.2))
          if (detail >= 1) {
            for (const sd of [1, -1]) crenel(ch, [A[0] + nx * o * sd, A[1] + nz * o * sd], [B[0] + nx * o * sd, B[1] + nz * o * sd], (ya + yb) / 2 + wh, wallColor, 0.4)
          }
          fillLine([A, B], th + 0.6, -1)
        }
      }
      // надвратные башни
      for (const g0 of gates) {
        const cx = a[0] + ux * g0, cz = a[1] + uz * g0, y = heightAt(cx, cz), ch = chunkAt(cx, cz), rot = Math.atan2(uz, ux)
        for (const sd of [-1, 1]) {
          const tx = cx + ux * sd * 4.2, tz = cz + uz * sd * 4.2
          ch.solid.cyl(tx, y - 2, tz, towerR * 0.85, wh + 5, 10, wallColor)
          for (let m = 0; m < 8; m++) { const q = (m / 8) * 6.283; ch.solid.box(tx + Math.cos(q) * towerR * 0.85, y + wh + 3, tz + Math.sin(q) * towerR * 0.85, 1, 1, 0.5, wallColor, q + 1.57) }
          fillLine([[tx, tz], [tx + 0.1, tz]], towerR * 1.7, -1)
        }
        // свод над проездом и герб над аркой
        ch.solid.box(cx, y + wh - 2.2, cz, 8.4, 3.6, th + 1, mixHex(wallColor, '#000', 0.05), rot)
        for (const sd of [1, -1]) crenel(ch, [cx - ux * 4.2 + nx * (th / 2 + 0.3) * sd, cz - uz * 4.2 + nz * (th / 2 + 0.3) * sd], [cx + ux * 4.2 + nx * (th / 2 + 0.3) * sd, cz + uz * 4.2 + nz * (th / 2 + 0.3) * sd], y + wh + 1.4, wallColor, 0.4)
        ch.solid.box(cx + nx * (th / 2 + 0.56), y + wh - 1.2, cz + nz * (th / 2 + 0.56), 1.1, 1.5, 0.08, S.style === 'styria' ? '#2a1a2a' : '#8f2f2f', rot)
      }
      // угловая башня
      const ty = heightAt(a[0], a[1]), ch = chunkAt(a[0], a[1])
      ch.solid.cyl(a[0], ty - 2, a[1], towerR, wh + 4.5, detail ? 12 : 8, wallColor)
      if (i % 3 === 0 && S.style !== 'south') ch.solid.cyl(a[0], ty + wh + 2.5, a[1], towerR * 1.15, towerR * 2.1, 12, st.tower, 0, false)
      else if (detail >= 1) for (let m = 0; m < 10; m++) { const q = (m / 10) * 6.283; ch.solid.box(a[0] + Math.cos(q) * towerR, ty + wh + 2.5, a[1] + Math.sin(q) * towerR, 1, 1.1, 0.5, wallColor, q + 1.57) }
      fillLine([a, [a[0] + 0.1, a[1]]], towerR * 2, -1)
    }
  })

  // ---------- мосты и причалы ----------
  const DECK = 1.5
  planks.forEach((q) => {
    const w = Math.max(q.w, 3.2)
    for (let s = 1; s < q.r.length; s++) {
      const a = q.r[s - 1], b = q.r[s], ch = chunkAt(a[0], a[1])
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[1] - a[1], b[0] - a[0])
      const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2
      ch.solid.box(cx, DECK - 0.2, cz, len + 0.2, 0.2, w, '#6b4f33', rot)
      const n = Math.max(1, Math.floor(len / 4))
      for (let i = 0; i <= n; i++) {
        const f = i / n, px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f
        for (const sd of [-1, 1]) {
          const ox = -Math.sin(rot) * (w / 2) * sd, oz = Math.cos(rot) * (w / 2) * sd
          ch.solid.box(px + ox, -3, pz + oz, 0.28, DECK + 3.8, 0.28, '#4a3522')
        }
      }
      for (const sd of [-1, 1]) ch.solid.box(cx - Math.sin(rot) * (w / 2) * sd, DECK + 0.7, cz + Math.cos(rot) * (w / 2) * sd, len, 0.1, 0.1, '#4a3522', rot)
    }
  })

  // ---------- площади: колодец, прилавки ----------
  const AWN = S.style === 'styria' ? ['#2a2230', '#3a2c3a', '#40303a'] : ['#b03a2e', '#d9b44a', '#3f6a8a', '#5d8a4a']
  squares.forEach((r, si) => {
    const [cx, cz] = centerOf(r), area = Math.abs(areaOf(r)), y = heightAt(cx, cz), ch = chunkAt(cx, cz)
    ch.solid.cyl(cx, y, cz, 1.3, 0.9, 10, st.stone)
    fillLine([[cx, cz], [cx + 0.1, cz]], 3.4, N + 2 + si)
    ch.solid.cyl(cx, y + 0.9, cz, 0.95, 0.02, 10, '#26404d')
    for (const s of [-1, 1]) ch.solid.box(cx + s * 1.1, y + 0.8, cz, 0.15, 2.1, 0.15, st.timber)
    ch.solid.cyl(cx, y + 2.9, cz, 1.8, 1, 4, mixHex(st.roof[0], '#000', 0.1), 0, false, Math.PI / 4)
    const stalls = Math.min(detail >= 1 ? 14 : 0, Math.floor(Math.sqrt(area) / 3.2))
    const rad = Math.sqrt(area) * 0.3
    for (let i = 0; i < stalls; i++) {
      const a = (i / stalls) * 6.283 + si, sx = cx + Math.cos(a) * rad, sz = cz + Math.sin(a) * rad
      if (!pointIn([sx, sz], r) || gridAt(sx, sz) !== 0) continue
      const rot = a + Math.PI / 2, col = AWN[i % AWN.length]
      ch.solid.box(sx, y, sz, 2.6, 0.85, 1.1, '#7a5a38', rot)
      for (const s of [-1.2, 1.2]) for (const t of [-0.5, 0.5]) ch.solid.box(sx + Math.cos(rot) * s - Math.sin(rot) * t, y, sz + Math.sin(rot) * s + Math.cos(rot) * t, 0.08, 2.2, 0.08, st.timber)
      ch.solid.box(sx, y + 2.2, sz, 2.9, 0.1, 1.5, col, rot)
      ch.solid.box(sx, y + 0.85, sz, 2, 0.18, 0.7, ['#c9843a', '#8fa04a', '#c94a3a', '#d8c070'][i % 4], rot)
      fillLine([[sx, sz], [sx + 0.1, sz]], 2, si + N + 2)
    }
  })

  // ---------- деревья, кусты, скалы ----------
  const treeSpots: { x: number; z: number; y: number; h: number; t: number }[] = []
  const cap = opts.mobile ? 900 : 2800
  const forest = Math.min(1, S.forest * 2.6)
  const paved = sampler(canvasMask((c) => {
    dists.forEach((r) => { trace(c, r); c.fill() })
    fields.forEach((r) => { trace(c, r); c.fill() })
    squares.forEach((r) => { trace(c, r); c.fill() })
    roads.forEach((q) => { trace(c, q.r, false); c.lineWidth = q.w + 4; c.stroke() })
    rivers.forEach((q) => { trace(c, q.r, false); c.lineWidth = q.w + 6; c.stroke() })
  }, 1, 0))
  const coniferP = S.rocky ? 0.9 : st.conifer
  for (let i = 0; i < cap * 8 && treeSpots.length < cap; i++) {
    const far = R() < 0.7
    const x = far ? center[0] + (R() - 0.5) * Math.min(EW, radius * 7) : R() * W
    const z = far ? center[1] + (R() - 0.5) * Math.min(EH, radius * 7) : R() * H
    if (x < x0 || z < z0 || x > x0 + EW || z > z0 + EH) continue
    const y = heightAt(x, z)
    if (y < 0.5 || y > 34 || gridAt(x, z) !== 0) continue
    const inPlan = x >= 0 && z >= 0 && x <= W && z <= H
    if (inPlan && paved(x, z) > 0.25) continue
    const d = Math.hypot(x - center[0], z - center[1]) / radius
    const clump = n1(x * 0.018 + 7, z * 0.018 + 3)
    if (R() > forest * (0.25 + clump * 1.6) * Math.min(1.4, 0.35 + d * 0.5)) continue
    treeSpots.push({ x, z, y, h: 5 + R() * 6, t: R() < coniferP ? 1 : 0 })
  }
  greens.forEach((r) => {
    const [cx, cz] = centerOf(r)
    const n = Math.min(14, Math.floor(Math.abs(areaOf(r)) / 90))
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * Math.sqrt(Math.abs(areaOf(r))), z = cz + (R() - 0.5) * Math.sqrt(Math.abs(areaOf(r)))
      if (pointIn([x, z], r) && gridAt(x, z) === 0) treeSpots.push({ x, z, y: heightAt(x, z), h: 3.5 + R() * 3, t: 0 })
    }
  })
  const instanced: THREE.InstancedMesh[] = []
  const addTrees = (t: number): void => {
    const list = treeSpots.filter((q) => q.t === t)
    if (!list.length) return
    const b = new Bucket()
    if (t === 0) {
      // лиственное: ствол и две шапки; тёмно-зелёное — в цвете экземпляра
      b.cyl(0, 0, 0, 0.09, 0.45, 5, '#5a4632', 0.06, false)
      const blob = new THREE.IcosahedronGeometry(0.34, 0).toNonIndexed()
      const add = (ox: number, oy: number, oz: number, sc: number): void => {
        const p = blob.attributes.position
        for (let i = 0; i < p.count; i += 3) {
          const V = (j: number): V3 => [p.getX(j) * sc + ox, p.getY(j) * sc + oy, p.getZ(j) * sc + oz]
          b.tri(V(i), V(i + 1), V(i + 2), '#ffffff')
        }
      }
      add(0, 0.65, 0, 1)
      add(0.14, 0.5, 0.08, 0.68)
      blob.dispose()
    } else {
      b.cyl(0, 0, 0, 0.07, 0.25, 5, '#4a3a2a', 0.05, false)
      b.cyl(0, 0.18, 0, 0.3, 0.42, 7, '#ffffff', 0, false)
      b.cyl(0, 0.42, 0, 0.23, 0.36, 7, '#e8e8e8', 0, false)
      b.cyl(0, 0.66, 0, 0.15, 0.34, 7, '#d8d8d8', 0, false)
    }
    const geo = b.geometry()!
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
    const m = new THREE.InstancedMesh(geo, mat, list.length)
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color()
    const greensOf = S.style === 'styria' ? ['#3f4f35', '#4a5a3a', '#37452f'] : S.style === 'south' ? ['#6a8440', '#7c8f45', '#5d7a3a'] : ['#4f8038', '#5f9040', '#3f7234', '#6f9a44']
    list.forEach((q, i) => {
      const w = q.h * (t ? 0.8 + R() * 0.3 : 0.85 + R() * 0.45)
      Q.setFromAxisAngle(UP, R() * 6.28)
      M.compose(new THREE.Vector3(q.x, q.y - 0.1, q.z), Q, new THREE.Vector3(w, q.h, w))
      m.setMatrixAt(i, M)
      m.setColorAt(i, col.set(t ? mixHex(greensOf[i % greensOf.length], '#1f3a2a', 0.4) : greensOf[i % greensOf.length]))
    })
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
    instanced.push(m)
    disposable.push(geo, mat)
  }
  addTrees(0)
  addTrees(1)
  if (S.rocky || S.hills) {
    const b = chunkAt(center[0], center[1]).solid
    for (let i = 0; i < (S.rocky ? 160 : 50); i++) {
      const x = R() * W, z = R() * H
      if (gridAt(x, z) !== 0 || paved(x, z) > 0.2) continue
      const s = 0.6 + R() * 2.2
      b.cyl(x, heightAt(x, z) - 0.2, z, s, s * 1.1, 5, '#8a8678', s * 0.35, true, R() * 3)
    }
  }

  // фонари вдоль дорог и на площадях: столб и огонёк, ночью — мягкое свечение
  const glows: number[] = []
  const lamp = (x: number, z: number): void => {
    if (gridAt(x, z) !== 0) return
    const y = heightAt(x, z), ch = chunkAt(x, z)
    ch.solid.box(x, y, z, 0.13, 3.1, 0.13, '#2a2420')
    ch.solid.box(x, y + 3.1, z, 0.34, 0.08, 0.34, '#2a2420')
    ch.glow.box(x, y + 2.7, z, 0.26, 0.4, 0.26, '#ffffff')
    glows.push(x, y + 2.9, z)
  }
  const LAMP_STEP = S.style === 'styria' ? 68 : 34
  if (detail >= 1) {
    for (const q of roads) {
      let run = 0
      for (let s = 1; s < q.r.length; s++) {
        const a = q.r[s - 1], b = q.r[s], l = Math.hypot(b[0] - a[0], b[1] - a[1])
        for (let t = LAMP_STEP - run; t < l; t += LAMP_STEP) {
          const x = a[0] + ((b[0] - a[0]) * t) / l, z = a[1] + ((b[1] - a[1]) * t) / l
          if (Math.hypot(x - center[0], z - center[1]) > radius * 1.25 || glows.length > 540) continue
          const off = q.w / 2 + 1.2
          lamp(x - ((b[1] - a[1]) / l) * off, z + ((b[0] - a[0]) / l) * off)
        }
        run = (run + l) % LAMP_STEP
      }
    }
    squares.forEach((r) => r.forEach((p, i) => { if (i % 2 === 0) lamp(p[0] + (centerOf(r)[0] - p[0]) * 0.08, p[1] + (centerOf(r)[1] - p[1]) * 0.08) }))
  }
  const dot = softDot()
  const glowGeo = new THREE.BufferGeometry()
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glows, 3))
  const glowPts = new THREE.PointsMaterial({ map: dot, color: '#ffb864', size: 5.5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false })
  scene.add(new THREE.Points(glowGeo, glowPts))
  disposable.push(dot, glowGeo, glowPts)

  // сборка кусков в меши
  for (const ch of chunks.values()) {
    const add = (b: Bucket, m: THREE.Material, shadow: boolean): void => {
      const geo = b.geometry()
      if (!geo) return
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, m)
      mesh.castShadow = shadow
      mesh.receiveShadow = shadow
      scene.add(mesh)
      disposable.push(geo)
    }
    add(ch.solid, solidMat, true)
    add(ch.roof, roofMat, true)
    add(ch.glow, glowMat, false)
    ch.solid.p = ch.solid.c = ch.roof.p = ch.roof.c = ch.roof.uv = ch.glow.p = ch.glow.c = []
  }

  // ---------- вода ----------
  const waterUni = { uT: { value: 0 }, uDeep: { value: new THREE.Color('#2c6580') }, uSky: { value: new THREE.Color('#9fc8d8') }, uFog: { value: new THREE.Color() }, uNear: { value: 1 }, uFar: { value: 2 }, uDay: { value: 1 } }
  if (hasWater) {
    const geo = new THREE.PlaneGeometry(EW * 1.5, EH * 1.5)
    geo.rotateX(-Math.PI / 2)
    geo.translate(W / 2, 0, H / 2)
    const mat = new THREE.ShaderMaterial({
      uniforms: waterUni,
      transparent: true,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uT,uNear,uFar,uDay; uniform vec3 uDeep,uSky,uFog; varying vec3 vW;
        void main(){
          vec3 v = cameraPosition - vW; float d = length(v); v /= d;
          float a = sin(vW.x*0.35+uT*0.9)+sin(vW.z*0.42-uT*0.7)+0.6*sin((vW.x+vW.z)*0.9+uT*1.4)+0.35*sin((vW.x-vW.z)*2.1-uT*1.9);
          vec3 n = normalize(vec3(cos(vW.x*0.35+uT)*0.04, 1.0, cos(vW.z*0.42-uT)*0.04));
          float f = pow(1.0-max(dot(v,n),0.0),3.0);
          float near = exp(-d/260.0);
          vec3 c = mix(uDeep, uSky, clamp(f*0.9+a*0.035*near,0.0,1.0));
          c += vec3(0.9)*uDay*smoothstep(2.05,2.5,a)*0.16*near;
          float fg = clamp((d-uNear)/(uFar-uNear),0.0,1.0);
          gl_FragColor = vec4(mix(c,uFog,fg), mix(0.9,1.0,fg));
          #include <colorspace_fragment>
        }`
    })
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = 2
    scene.add(m)
    disposable.push(geo, mat)
    // лодки у берега
    const b = new Bucket()
    for (let i = 0, made = 0; i < 300 && made < 7; i++) {
      const x = R() * W, z = R() * H
      const h = heightAt(x, z)
      if (h > -0.5 || h < -2.8 || heightAt(x + 12, z) < -1.6 === heightAt(x - 12, z) < -1.6 && heightAt(x, z + 12) < -1.6 === heightAt(x, z - 12) < -1.6) continue
      const rot = R() * 6.28
      b.box(x, 0.02, z, 4.4, 0.55, 1.5, '#5e4128', rot)
      b.box(x, 0.56, z, 3.6, 0.08, 1.1, '#7a5a38', rot)
      made++
    }
    const bg = b.geometry()
    if (bg) { const bm = new THREE.Mesh(bg, solidMat); bm.castShadow = true; scene.add(bm); disposable.push(bg) }
  }

  // ---------- небо, солнце, звёзды, облака ----------
  const skyUni = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSunK: { value: 1 } }
  const skyGeo = new THREE.SphereGeometry(1, 24, 16)
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUni,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position*10.0,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 uTop,uHor,uSun,uSunCol; uniform float uSunK; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        vec3 c = mix(uHor, uTop, pow(clamp(d.y*1.35,0.0,1.0),0.62));
        float s = max(dot(d,uSun),0.0);
        c += uSunCol*(pow(s,420.0)*1.4 + pow(s,9.0)*0.2)*uSunK;
        gl_FragColor = vec4(c,1.0);
        #include <colorspace_fragment>
      }`
  })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  sky.renderOrder = -10
  sky.frustumCulled = false
  scene.add(sky)
  disposable.push(skyGeo, skyMat)

  const starPos: number[] = []
  for (let i = 0; i < 700; i++) {
    const a = R() * 6.283, y = 0.05 + R() * 0.95, q = Math.sqrt(1 - y * y)
    starPos.push(Math.cos(a) * q, y, Math.sin(a) * q)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false })
  const stars = new THREE.Points(starGeo, starMat)
  stars.scale.setScalar(4000)
  stars.renderOrder = -9
  stars.frustumCulled = false
  scene.add(stars)
  disposable.push(starGeo, starMat)

  const cloudMat = new THREE.SpriteMaterial({ map: dot, color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, fog: false })
  disposable.push(cloudMat)
  const clouds = new THREE.Group()
  const skyH = Math.max(160, radius * 0.9)
  for (let i = 0; i < (opts.mobile ? 14 : 30); i++) {
    const cx = center[0] + (R() - 0.5) * (radius * 6 + 800), cz = center[1] + (R() - 0.5) * (radius * 6 + 800), cy = skyH + R() * 60
    const puffs = 3 + Math.floor(R() * 4), w = 60 + R() * 110
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Sprite(cloudMat)
      s.position.set(cx + (R() - 0.5) * w, cy + (R() - 0.5) * 8, cz + (R() - 0.5) * w * 0.5)
      s.scale.set(w * (0.6 + R() * 0.6), w * (0.22 + R() * 0.15), 1)
      clouds.add(s)
    }
  }
  scene.add(clouds)

  // ---------- люди ----------
  const walkers: { x: number; z: number; a: number; v: number; ph: number; rest: number }[] = []
  const WN = Math.min(opts.mobile ? 60 : 180, Math.round(N / 3) + 8)
  for (let i = 0, tries = 0; i < WN && tries < 8000; tries++) {
    const x = center[0] + (R() - 0.5) * radius * 1.9, z = center[1] + (R() - 0.5) * radius * 1.9
    if (gridAt(x, z) !== 0 || paved(x, z) < 0.3 || heightAt(x, z) < 0.3) continue
    walkers.push({ x, z, a: R() * 6.28, v: 1 + R() * 0.6, ph: R() * 6.28, rest: 0 })
    i++
  }
  const body = new Bucket()
  body.box(-0.1, 0, 0, 0.13, 0.82, 0.16, '#3a332c')
  body.box(0.1, 0, 0, 0.13, 0.82, 0.16, '#3a332c')
  body.box(0, 0.8, 0, 0.42, 0.62, 0.24, '#ffffff')
  body.box(-0.27, 0.86, 0, 0.1, 0.55, 0.12, '#f0f0f0')
  body.box(0.27, 0.86, 0, 0.1, 0.55, 0.12, '#f0f0f0')
  const bodyGeo = body.geometry()!
  const headB = new Bucket()
  headB.box(0, 1.42, 0, 0.23, 0.26, 0.23, '#ecc8ae')
  headB.box(0, 1.64, 0, 0.27, 0.07, 0.27, '#5b4630')
  const headGeo = headB.geometry()!
  const pplMat = new THREE.MeshLambertMaterial({ vertexColors: true })
  const bodies = new THREE.InstancedMesh(bodyGeo, pplMat, Math.max(1, walkers.length))
  const heads = new THREE.InstancedMesh(headGeo, pplMat, Math.max(1, walkers.length))
  const CLOTH = S.style === 'styria' ? ['#2a2630', '#3a3540', '#322a30', '#4a4048'] : ['#7a3b2e', '#3f5f7a', '#6a7a3a', '#8a6a3a', '#5a4a6a', '#a8a08a', '#3f6a4a']
  walkers.forEach((_, i) => bodies.setColorAt(i, new THREE.Color(CLOTH[i % CLOTH.length])))
  bodies.count = heads.count = walkers.length
  bodies.castShadow = true
  bodies.frustumCulled = heads.frustumCulled = false
  scene.add(bodies, heads)
  disposable.push(bodyGeo, headGeo, pplMat)
  let shown = 1
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1), YUP = new THREE.Vector3(0, 1, 0)

  // ---------- свет и время суток ----------
  const hemi = new THREE.HemisphereLight('#ffffff', '#7a8a5a', 1)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#ffffff', 3)
  sun.castShadow = !(opts.mobile && N > 500)
  sun.shadow.mapSize.setScalar(opts.mobile ? 1024 : 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.25
  scene.add(sun, sun.target)
  scene.fog = new THREE.Fog('#ffffff', 300, 1500)
  const fog = scene.fog as THREE.Fog
  fog.near = Math.max(280, radius * 1.1)
  fog.far = Math.max(1100, radius * 4.2)
  waterUni.uNear.value = fog.near
  waterUni.uFar.value = fog.far

  const KEY = {
    day: { top: '#5a9bd8', hor: '#d5e6ea', sun: '#fff0d8', sunK: 2.9, hemiK: 1.55, sky: '#d6e6ff', gnd: '#8a9a68' },
    gold: { top: '#465f96', hor: '#f4b37c', sun: '#ffa564', sunK: 2.4, hemiK: 0.95, sky: '#d8c0c0', gnd: '#6a5a4a' },
    night: { top: '#060c1e', hor: '#16233f', sun: '#9db4ff', sunK: 0.95, hemiK: 0.72, sky: '#4a5a98', gnd: '#20263a' }
  }
  const lerpKey = (a: typeof KEY.day, b: typeof KEY.day, t: number): typeof KEY.day => ({ top: mixHex(a.top, b.top, t), hor: mixHex(a.hor, b.hor, t), sun: mixHex(a.sun, b.sun, t), sunK: a.sunK + (b.sunK - a.sunK) * t, hemiK: a.hemiK + (b.hemiK - a.hemiK) * t, sky: mixHex(a.sky, b.sky, t), gnd: mixHex(a.gnd, b.gnd, t) })
  const setTime = (hour: number, focus: THREE.Vector3): void => {
    const ph = ((hour - 6) / 14) * Math.PI
    const elev = Math.sin(ph) // > 0 — солнце над горизонтом (6:00–20:00)
    const k = elev > 0.28 ? KEY.day : elev > 0 ? lerpKey(KEY.gold, KEY.day, elev / 0.28) : elev > -0.2 ? lerpKey(KEY.night, KEY.gold, 1 + elev / 0.2) : KEY.night
    const nightK = smooth(0.16, -0.14, elev)
    skyUni.uTop.value.set(k.top)
    skyUni.uHor.value.set(k.hor)
    skyUni.uSunCol.value.set(k.sun)
    skyUni.uSunK.value = 1 - nightK * 0.7
    fog.color.set(k.hor)
    waterUni.uFog.value.copy(fog.color)
    waterUni.uSky.value.set(mixHex(k.hor, k.top, 0.3))
    waterUni.uDeep.value.set(mixHex('#2c6580', k.top, 0.4 + nightK * 0.4)).multiplyScalar(1 - nightK * 0.6)
    waterUni.uDay.value = 1 - nightK
    hemi.color.set(k.sky)
    hemi.groundColor.set(k.gnd)
    hemi.intensity = k.hemiK * (S.style === 'styria' ? 1 + nightK * 0.7 : 1)
    // ночью светит луна с другой стороны неба
    const az = ph * 0.9 + 0.5
    const up = elev > 0.02 ? Math.max(0.12, elev) : 0.62
    const flip = elev > 0.02 ? 1 : -1
    const dir = new THREE.Vector3(Math.cos(az) * flip, up * 1.15, Math.sin(az) * 0.6 * flip + 0.35).normalize()
    skyUni.uSun.value.copy(dir)
    sun.color.set(k.sun)
    sun.intensity = k.sunK
    const span = Math.min(radius * 1.25 + 60, focus.y > 30 ? radius * 1.25 + 60 : 200)
    const cam = sun.shadow.camera
    cam.left = cam.bottom = -span
    cam.right = cam.top = span
    cam.near = 1
    cam.far = span * 4 + 400
    cam.updateProjectionMatrix()
    // смещение тени под размер её клетки, иначе на стенах появляются полосы
    sun.shadow.normalBias = ((span * 2) / sun.shadow.mapSize.x) * 2.2
    sun.shadow.bias = -0.0004
    sun.target.position.set(focus.x, 0, focus.z)
    sun.position.copy(sun.target.position).addScaledVector(dir, span * 1.5 + 200)
    sun.target.updateMatrixWorld()
    // окна и фонари
    glowMat.color.set('#39464f').lerp(new THREE.Color(1.0, 0.72, 0.36).multiplyScalar(1.5), nightK * 0.95 + smooth(0.3, 0.05, elev) * 0.2)
    glowPts.opacity = nightK * 0.8
    starMat.opacity = nightK
    cloudMat.color.set(k.hor).lerp(new THREE.Color('#ffffff'), 0.65 * (1 - nightK))
    cloudMat.opacity = 0.62 - nightK * 0.46
    shown = nightK > 0.6 ? 0.25 : 1
  }

  // ---------- кадр ----------
  const tick = (dt: number, t: number, cam: THREE.Camera): void => {
    waterUni.uT.value = t
    clouds.position.x = ((t * 1.1) % 800) - 400
    sky.position.copy(cam.position)
    stars.position.copy(cam.position)
    const n = Math.floor(walkers.length * shown)
    bodies.count = heads.count = n
    for (let i = 0; i < n; i++) {
      const w = walkers[i]
      if (w.rest > 0) w.rest -= dt
      else {
        const nx = w.x + Math.cos(w.a) * w.v * dt, nz = w.z + Math.sin(w.a) * w.v * dt
        const lx = w.x + Math.cos(w.a) * 2.2, lz = w.z + Math.sin(w.a) * 2.2
        if (gridAt(lx, lz) !== 0 || paved(lx, lz) < 0.25 || heightAt(lx, lz) < 0.2) {
          w.a += 0.9 + Math.random() * 2.2
          if (Math.random() < 0.12) w.rest = 1 + Math.random() * 4
        } else {
          w.x = nx
          w.z = nz
          w.ph += dt * 7
          if (Math.random() < dt * 0.1) w.a += (Math.random() - 0.5) * 1.4
        }
      }
      tmpQ.setFromAxisAngle(YUP, -w.a + Math.PI / 2)
      tmpP.set(w.x, heightAt(w.x, w.z) + Math.abs(Math.sin(w.ph)) * 0.05, w.z)
      tmpM.compose(tmpP, tmpQ, tmpS)
      bodies.setMatrixAt(i, tmpM)
      heads.setMatrixAt(i, tmpM)
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true
  }

  const pick = (o: THREE.Vector3, d: THREE.Vector3): number | null => {
    const step = cell * 0.7
    const maxD = radius * 8
    for (let s = 1; s < maxD; s += step) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s
      if (y < heightAt(x, z)) return null
      const v = gridAt(x, z)
      if (v > 0 && v <= N && y <= tops[v - 1]) return v - 1
    }
    return null
  }

  return {
    scene,
    sun,
    center,
    radius,
    size: [W, H],
    k,
    heightAt,
    walkable: (x, z) => { const v = gridAt(x, z); return v === 0 || v === -3 },
    deckAt: (x, z) => (gridAt(x, z) === -3 ? DECK : null),
    pick,
    buildingTop: (i) => { const b = blds[i]; if (!b) return null; const c = centerOf(b.r); return [c[0], tops[i], c[1]] },
    spawn: () => {
      const s = squares[0] ? centerOf(squares[0]) : roads[0]?.r.length ? roads[0].r[Math.floor(roads[0].r.length / 2)] : center
      // свободное место с запасом вокруг, чтобы не начать прогулку носом в колодец или прилавок
      const clear = (x: number, z: number): boolean => { for (let i = 0; i < 8; i++) if (gridAt(x + Math.cos(i * 0.785) * 3, z + Math.sin(i * 0.785) * 3) !== 0) return false; return gridAt(x, z) === 0 && heightAt(x, z) > 0.2 }
      for (let rad = 5; rad < radius * 2; rad += cell) for (let i = 0; i < 16; i++) {
        const x = s[0] + (Math.cos((i / 16) * 6.283) * rad), z = s[1] + (Math.sin((i / 16) * 6.283) * rad)
        if (clear(x, z)) return [x, z]
      }
      return s
    },
    setTime,
    tick,
    dispose: () => {
      instanced.forEach((m) => m.dispose())
      bodies.dispose()
      heads.dispose()
      disposable.forEach((d) => d.dispose())
    }
  }
}
