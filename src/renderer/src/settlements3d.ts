import * as THREE from 'three'

/**
 * Процедурные «миниатюры» поселений: собираются из простых тел Three.js, освещаются солнцем, отбрасывают тень
 * и рендерятся в картинку (спрайт). На карте спрайты рисуются в своей точке и растут вместе с масштабом.
 * Облик зависит от культуры, вариант (раскладка домов) — от номера поселения.
 */

export type SettlementType = 'village' | 'fishing' | 'town' | 'city' | 'capital' | 'castle' | 'port' | 'temple' | 'ruins' | 'tower' | 'grandport'

type Shape = 'gable' | 'flat' | 'hut' | 'pagoda' | 'spire'
interface Style {
  wall: number
  roof: number
  stone: number
  shape: Shape
}
const STYLES: Record<string, Style> = {
  imperial: { wall: 0xd8c8a6, roof: 0xa5432f, stone: 0x9b958a, shape: 'gable' },
  church: { wall: 0xf0ebe0, roof: 0x56677f, stone: 0xc9c4b8, shape: 'gable' },
  romance: { wall: 0xe6cb9c, roof: 0xc4683c, stone: 0xb7a888, shape: 'gable' },
  kaltrans: { wall: 0xa3a184, roof: 0x5d6b3a, stone: 0x7d7b68, shape: 'flat' },
  nordic: { wall: 0x6e4c33, roof: 0x5b7340, stone: 0x7f7a74, shape: 'gable' },
  dwarven: { wall: 0x8e8a83, roof: 0x4b4b52, stone: 0x77736d, shape: 'flat' },
  eluin: { wall: 0xece8dc, roof: 0x3f8088, stone: 0xd8d2c4, shape: 'spire' },
  eleon: { wall: 0xddd6c4, roof: 0x2f5f7a, stone: 0xa8a294, shape: 'gable' },
  elven: { wall: 0xd8e6c8, roof: 0x3f7a4a, stone: 0xb9c4a8, shape: 'spire' },
  yut: { wall: 0xe8dcc4, roof: 0x3a3a46, stone: 0x9a948a, shape: 'pagoda' },
  desert: { wall: 0xd6b37c, roof: 0xc9a36a, stone: 0xb89a6a, shape: 'flat' },
  dark: { wall: 0x6c5c70, roof: 0x3d2f45, stone: 0x5a5060, shape: 'flat' },
  zlatay: { wall: 0xeadaa6, roof: 0xc9a12e, stone: 0xa89a7a, shape: 'gable' },
  orcish: { wall: 0x8a6a4a, roof: 0x5c4a30, stone: 0x6f665a, shape: 'hut' },
  cin: { wall: 0xe2d2b2, roof: 0x8f2f2f, stone: 0x9c9382, shape: 'pagoda' }
}

/** Сколько логических единиц карты занимает спрайт по ширине */
export const SPRITE_LOGICAL = 46
const SIZE = 256
const VIEW = 11 // половина ширины кадра в единицах модели

export interface Sprite {
  canvas: HTMLCanvasElement
  /** Точка земли (центр поселения) в долях спрайта */
  ax: number
  ay: number
}

// ---------- сборка моделей ----------
const matCache = new Map<string, THREE.MeshLambertMaterial>()
function mat(color: number, tint = 0): THREE.MeshLambertMaterial {
  const c = new THREE.Color(color)
  // приглушённая палитра: модели не спорят с картой
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s * 0.6, hsl.l * 0.9 + tint)
  const key = c.getHexString()
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c })
    matCache.set(key, m)
  }
  return m
}
function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.rotation.y = ry
  o.castShadow = true
  o.receiveShadow = true
  return o
}
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}
function gableRoof(w: number, d: number, h: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2 - 0.15, 0)
  shape.lineTo(w / 2 + 0.15, 0)
  shape.lineTo(0, h)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false })
  g.translate(0, 0, -(d + 0.3) / 2)
  return g
}

function house(st: Style, r: () => number, x: number, z: number, scale = 1, floors = 1): THREE.Group {
  const g = new THREE.Group()
  const w = (1.1 + r() * 0.7) * scale
  const d = (1.4 + r() * 0.9) * scale
  const h = (0.9 + r() * 0.3) * scale * floors
  const tint = (r() - 0.5) * 0.08
  const ry = Math.floor(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.3
  switch (st.shape) {
    case 'hut': {
      const rad = w * 0.65
      g.add(mesh(new THREE.CylinderGeometry(rad, rad, h * 0.7, 9), mat(st.wall, tint), 0, h * 0.35, 0))
      g.add(mesh(new THREE.ConeGeometry(rad * 1.25, h * 1.1, 9), mat(st.roof, tint), 0, h * 0.7 + h * 0.55, 0))
      break
    }
    case 'flat': {
      g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(st.wall, tint), 0, h / 2, 0))
      g.add(mesh(new THREE.BoxGeometry(w + 0.12, 0.12, d + 0.12), mat(st.roof, tint), 0, h + 0.06, 0))
      if (r() < 0.3) g.add(mesh(new THREE.SphereGeometry(w * 0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(st.roof, 0.05), 0, h + 0.1, 0))
      break
    }
    case 'pagoda': {
      g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(st.wall, tint), 0, h / 2, 0))
      g.add(mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.85, h * 0.55, 4), mat(st.roof, tint), 0, h + h * 0.27, 0, Math.PI / 4))
      break
    }
    case 'spire': {
      g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(st.wall, tint), 0, h / 2, 0))
      g.add(mesh(gableRoof(w, d, h * 0.6), mat(st.roof, tint), 0, h, 0))
      if (r() < 0.35) g.add(mesh(new THREE.ConeGeometry(0.25 * scale, h * 1.6, 8), mat(st.roof, 0.05), w * 0.3, h + h * 0.8, 0))
      break
    }
    default: {
      g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(st.wall, tint), 0, h / 2, 0))
      g.add(mesh(gableRoof(w, d, h * (st.wall === STYLES.nordic.wall ? 0.95 : 0.65)), mat(st.roof, tint), 0, h, 0))
    }
  }
  g.position.set(x, 0, z)
  g.rotation.y = ry
  return g
}

function tree(r: () => number, x: number, z: number, culture: string): THREE.Group {
  const g = new THREE.Group()
  const h = 0.8 + r() * 0.6
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, h * 0.5, 5), mat(0x5a4028), 0, h * 0.25, 0))
  const green = culture === 'desert' || culture === 'dark' ? 0x7a8a3a : culture === 'nordic' ? 0x2f5a3a : 0x3f6e2e
  if (culture === 'nordic' || culture === 'dwarven' || r() < 0.4) g.add(mesh(new THREE.ConeGeometry(0.5 + r() * 0.2, h * 1.2, 7), mat(green, (r() - 0.5) * 0.1), 0, h * 0.5 + h * 0.55, 0))
  else g.add(mesh(new THREE.IcosahedronGeometry(0.55 + r() * 0.25, 0), mat(green, (r() - 0.5) * 0.1), 0, h * 0.75, 0))
  g.position.set(x, 0, z)
  return g
}

function tower(st: Style, x: number, z: number, rad: number, h: number, roof = true): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(rad, rad * 1.08, h, 10), mat(st.stone), 0, h / 2, 0))
  if (roof) g.add(mesh(new THREE.ConeGeometry(rad * 1.3, h * 0.45, 10), mat(st.roof), 0, h + h * 0.22, 0))
  else g.add(mesh(new THREE.CylinderGeometry(rad * 1.15, rad * 1.15, 0.25, 10), mat(st.stone, -0.05), 0, h + 0.12, 0))
  g.position.set(x, 0, z)
  return g
}

function wall(st: Style, x1: number, z1: number, x2: number, z2: number, h: number): THREE.Mesh {
  const len = Math.hypot(x2 - x1, z2 - z1)
  const m = mesh(new THREE.BoxGeometry(len, h, 0.35), mat(st.stone), (x1 + x2) / 2, h / 2, (z1 + z2) / 2)
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
  return m
}

function boat(x: number, z: number, ry: number, s = 1): THREE.Group {
  const g = new THREE.Group()
  const hull = new THREE.Shape()
  hull.moveTo(-1.2 * s, 0)
  hull.lineTo(1.2 * s, 0)
  hull.lineTo(0.9 * s, -0.35 * s)
  hull.lineTo(-0.9 * s, -0.35 * s)
  hull.closePath()
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.6 * s, bevelEnabled: false })
  hg.translate(0, 0.3 * s, -0.3 * s)
  g.add(mesh(hg, mat(0x6b4a2e)))
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8 * s, 5), mat(0x4a3420), 0, 1.2 * s, 0))
  const sail = mesh(new THREE.PlaneGeometry(1.0 * s, 1.1 * s), new THREE.MeshLambertMaterial({ color: 0xeee6d2, side: THREE.DoubleSide }), 0.05, 1.3 * s, 0)
  sail.rotation.y = Math.PI / 2
  g.add(sail)
  g.position.set(x, 0, z)
  g.rotation.y = ry
  return g
}

/** Раскладка: дома не налезают друг на друга */
function scatter(r: () => number, n: number, radius: number, minDist: number, avoid: [number, number, number][] = []): [number, number][] {
  const pts: [number, number][] = []
  for (let t = 0; t < n * 30 && pts.length < n; t++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * radius
    const x = Math.cos(a) * d, z = Math.sin(a) * d
    if (pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < minDist)) continue
    if (avoid.some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar)) continue
    pts.push([x, z])
  }
  return pts
}

function build(type: SettlementType, culture: string, variant: number): THREE.Group {
  const st = STYLES[culture] ?? STYLES.imperial
  const r = rng(variant * 7919 + type.length * 104729 + culture.length * 31)
  const g = new THREE.Group()
  const addHouses = (n: number, radius: number, minDist: number, scale = 1, floors = 1, avoid: [number, number, number][] = []): void => {
    for (const [x, z] of scatter(r, n, radius, minDist, avoid)) g.add(house(st, r, x, z, scale, floors + (r() < 0.25 ? 1 : 0) * (floors > 1 ? 1 : 0)))
  }
  const addTrees = (n: number, rMin: number, rMax: number): void => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = rMin + r() * (rMax - rMin)
      g.add(tree(r, Math.cos(a) * d, Math.sin(a) * d, culture))
    }
  }
  switch (type) {
    case 'village': {
      addHouses(4 + Math.floor(r() * 3), 3.2, 1.9)
      addTrees(3, 3.5, 5)
      break
    }
    case 'fishing': {
      for (const [x, z] of scatter(r, 5, 3.2, 1.9)) g.add(house(st, r, x, z - 1.5))
      g.add(mesh(new THREE.BoxGeometry(0.8, 0.12, 4.5), mat(0x6b4a2e), 1.5, 0.15, 3.5))
      g.add(boat(3.2, 4.5, 0.3, 0.8))
      break
    }
    case 'town': {
      const church = new THREE.Group()
      church.add(mesh(new THREE.BoxGeometry(1.8, 2.4, 3.2), mat(st.stone)))
      church.children[0].position.y = 1.2
      church.add(mesh(gableRoof(1.8, 3.2, 1.2), mat(st.roof), 0, 2.4, 0))
      church.add(tower(st, 0, -1.9, 0.55, 4.2))
      g.add(church)
      addHouses(12 + Math.floor(r() * 5), 5.6, 1.7, 1, 1, [[0, 0, 2.6]])
      addTrees(4, 6, 8)
      break
    }
    case 'city':
    case 'capital': {
      const big = type === 'capital'
      const R = big ? 10 : 8.6
      // низкая стена — только у столицы; обычный город — плотная россыпь крыш вокруг цитадели
      if (big) {
        const corners = 11
        for (let i = 0; i < corners; i++) {
          const a1 = (i / corners) * Math.PI * 2, a2 = ((i + 1) / corners) * Math.PI * 2
          const r1 = R * (0.92 + r() * 0.12), r2 = R * (0.92 + r() * 0.12)
          g.add(wall(st, Math.cos(a1) * r1, Math.sin(a1) * r1, Math.cos(a2) * r2, Math.sin(a2) * r2, 0.6))
        }
      }
      // цитадель / собор в центре
      const keep = new THREE.Group()
      keep.add(mesh(new THREE.BoxGeometry(2.6, big ? 3.6 : 2.8, 2.6), mat(st.stone), 0, big ? 1.8 : 1.4, 0))
      keep.add(mesh(new THREE.ConeGeometry(2.0, 1.5, 4), mat(st.roof), 0, (big ? 3.6 : 2.8) + 0.75, 0, Math.PI / 4))
      if (big) keep.add(tower(st, 1.4, -1.4, 0.5, 4.6))
      g.add(keep)
      addHouses(big ? 44 : 30, R - 1.1, 1.45, 1.0, 1, [[0, 0, 3]])
      break
    }
    case 'castle': {
      const y0 = 0
      const k = new THREE.Group()
      k.add(mesh(new THREE.BoxGeometry(2.8, 4.6, 2.8), mat(st.stone), 0, 2.3, 0))
      k.add(mesh(new THREE.ConeGeometry(2.2, 1.8, 4), mat(st.roof), 0, 5.5, 0, Math.PI / 4))
      k.position.y = y0
      g.add(k)
      const c = 2.8
      for (const [x, z] of [[-c, -c], [c, c]]) {
        const t = tower(st, x, z, 0.6, 2.6, false)
        t.position.y = y0
        g.add(t)
      }
      for (const [a, b] of [[[-c, -c], [c, -c]], [[c, -c], [c, c]], [[c, c], [-c, c]], [[-c, c], [-c, -c]]] as [number, number][][]) {
        const w = wall(st, a[0] * 0.82, a[1] * 0.82, b[0] * 0.82, b[1] * 0.82, 1.2)
        w.position.y += y0
        g.add(w)
      }
      addTrees(3, 6, 8)
      break
    }
    case 'port': {
      addHouses(10, 4.6, 1.6, 1, 1, [[2, 4, 3]])
      g.add(mesh(new THREE.BoxGeometry(1, 0.15, 7), mat(0x6b4a2e), 3, 0.15, 5.5))
      g.add(mesh(new THREE.BoxGeometry(4, 0.15, 0.9), mat(0x6b4a2e), 2, 0.15, 3.2))
      g.add(boat(5.2, 6.5, 0.2))
      g.add(boat(1.2, 7.4, -0.4, 0.85))
      g.add(tower(st, -3.5, 4.5, 0.55, 4.2, false))
      break
    }
    case 'grandport': {
      // Аурхафен: город на берегу (сзади), полукруглый волнолом с маяком, три бассейна, верфи и корабли (спереди — море)
      addHouses(46, 7.5, 1.35, 1.0, 1, [[0, 6, 6]])
      for (const [x, z] of [[-6.5, -3], [6.5, -3], [0, -7.5]]) g.add(tower(st, x, z, 0.55, 3.2))
      // набережная и склады
      g.add(mesh(new THREE.BoxGeometry(17, 0.25, 1.2), mat(st.stone), 0, 0.12, 2.6))
      for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(2, 1.1, 1.3), mat(st.wall, -0.06), -6.2 + i * 2.5, 0.55, 1.4))
      // волнолом дугой и маяк Сандры
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI * (0.08 + (0.84 * i) / 14)
        g.add(mesh(new THREE.BoxGeometry(1.25, 0.45, 0.75), mat(st.stone, -0.04), Math.cos(a) * 9.2, 0.22, 3 + Math.sin(a) * 7.2, -a))
      }
      const lh = tower(st, 0, 0, 0.6, 6.5, false)
      lh.position.set(0, 0, 10.2)
      g.add(lh)
      g.add(mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 0, 7.0, 10.2))
      // причалы-пирсы, делящие гавань на бассейны
      for (const x of [-3.2, 3.2]) g.add(mesh(new THREE.BoxGeometry(0.7, 0.18, 5.5), mat(0x6b4a2e), x, 0.15, 5.6))
      // стапель с недостроенным кораблём
      g.add(mesh(new THREE.BoxGeometry(1.6, 0.4, 3.6), mat(0x8a6a44), -7.6, 0.2, 4.2, 0.3))
      // корабли в бассейнах
      for (const [x, z, r, sc] of [[-5.2, 5, 0.2, 1], [-1.6, 6.4, -0.3, 0.9], [1.4, 4.6, 0.4, 1.1], [5, 6, -0.1, 1], [6.8, 3.8, 0.6, 0.8], [-0.2, 8.4, 1.5, 0.85]]) g.add(boat(x, z, r, sc))
      break
    }
    case 'temple': {
      g.add(mesh(new THREE.BoxGeometry(5, 0.5, 6.5), mat(st.stone), 0, 0.25, 0))
      g.add(mesh(new THREE.BoxGeometry(4.2, 0.4, 5.7), mat(st.stone, 0.05), 0, 0.7, 0))
      for (let i = 0; i < 6; i++)
        for (const x of [-1.8, 1.8]) g.add(mesh(new THREE.CylinderGeometry(0.22, 0.25, 2.6, 8), mat(0xe9e2d0), x, 2.2, -2.4 + i * 0.96))
      if (st.shape === 'flat' || st.shape === 'hut') g.add(mesh(new THREE.SphereGeometry(2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(st.roof), 0, 3.5, 0))
      else g.add(mesh(gableRoof(4.4, 5.6, 1.3), mat(st.roof), 0, 3.5, 0))
      addTrees(3, 4.5, 6)
      break
    }
    case 'tower': {
      g.add(tower(st, 0, 0, 1.0, 7))
      g.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 10), mat(st.stone, -0.06), 0, 5.1, 0))
      g.add(house(st, r, 2.4, 1.6))
      addTrees(2, 3.5, 5)
      break
    }
    case 'ruins': {
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, d = 1 + r() * 3.5
        const h = 0.4 + r() * 2.2
        const m = mesh(new THREE.BoxGeometry(0.4, h, 1.6 + r() * 2), mat(0x8f8a80, (r() - 0.5) * 0.1), Math.cos(a) * d, h / 2, Math.sin(a) * d, r() * 3)
        g.add(m)
      }
      for (let i = 0; i < 4; i++) {
        const c = mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 8), mat(0xb8b1a2), (r() - 0.5) * 6, 0.25, (r() - 0.5) * 6, r() * 3)
        c.rotation.z = Math.PI / 2
        g.add(c)
      }
      for (let i = 0; i < 10; i++) g.add(mesh(new THREE.BoxGeometry(0.3 + r() * 0.4, 0.3, 0.3 + r() * 0.4), mat(0x7a756c), (r() - 0.5) * 7, 0.15, (r() - 0.5) * 7, r() * 3))
      addTrees(3, 3, 6)
      break
    }
  }
  return g
}

// ---------- рендер в спрайты ----------
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.OrthographicCamera
let anchor = { x: 0.5, y: 0.62 }
function setup(): void {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(SIZE, SIZE)
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x000000, 0)
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 0.1, 100)
  camera.position.set(0, 20, 18)
  camera.lookAt(0, 0, 0)
  const hemi = new THREE.HemisphereLight(0xf2ead8, 0x3a3428, 1.15)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.7)
  sun.position.set(-10, 18, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -16
  sun.shadow.camera.right = 16
  sun.shadow.camera.top = 16
  sun.shadow.camera.bottom = -16
  sun.shadow.radius = 3
  scene.add(sun)
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.38 }))
  shadowPlane.rotation.x = -Math.PI / 2
  shadowPlane.receiveShadow = true
  scene.add(shadowPlane)
  // матрицы камеры обновляются только при рендере — без этого точка привязки уезжала на пол-спрайта вверх
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const p = new THREE.Vector3(0, 0, 0).project(camera)
  anchor = { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }
}

const cache = new Map<string, Sprite>()
const queue: [string, SettlementType, string, number][] = []
const queued = new Set<string>()
let scheduled = false
let onReady: (() => void) | null = null
export function onSpritesReady(cb: () => void): void {
  onReady = cb
}

function renderOne(type: SettlementType, culture: string, variant: number): Sprite {
  if (!renderer) setup()
  const model = build(type, culture, variant)
  scene.add(model)
  renderer!.render(scene, camera)
  scene.remove(model)
  model.traverse((o) => {
    if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose()
  })
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  c.getContext('2d')!.drawImage(renderer!.domElement, 0, 0)
  return { canvas: c, ax: anchor.x, ay: anchor.y }
}

function pump(): void {
  scheduled = false
  const t0 = performance.now()
  let made = 0
  while (queue.length && performance.now() - t0 < 14) {
    const [key, type, culture, variant] = queue.shift()!
    cache.set(key, renderOne(type, culture, variant))
    made++
  }
  if (made) onReady?.()
  if (queue.length) {
    scheduled = true
    setTimeout(pump, 16)
  }
}

export const VARIANTS = 3

/** Спрайт поселения; если ещё не готов — ставится в очередь и вернётся null */
export function getSprite(type: SettlementType, culture: string, variant: number): Sprite | null {
  const v = variant % VARIANTS
  const key = `${type}|${culture}|${v}`
  const s = cache.get(key)
  if (s) return s
  if (!queued.has(key)) {
    queued.add(key)
    // крупные поселения — в начало очереди
    if (type === 'capital' || type === 'city') queue.unshift([key, type, culture, v])
    else queue.push([key, type, culture, v])
    if (!scheduled) {
      scheduled = true
      setTimeout(pump, 0)
    }
  }
  return null
}

/** Масштаб модели на карте по типу */
export const SETTLEMENT_SCALE: Record<SettlementType, number> = {
  village: 0.9,
  fishing: 0.9,
  town: 1.05,
  city: 1.25,
  capital: 1.5,
  castle: 1.0,
  port: 1.1,
  temple: 0.9,
  ruins: 0.9,
  tower: 0.95,
  grandport: 1.6
}
/** С какого экранного размера спрайта поселение видно */
export const SETTLEMENT_MIN_PX: Record<SettlementType, number> = {
  village: 80,
  fishing: 80,
  town: 60,
  city: 40,
  capital: 30,
  castle: 64,
  port: 56,
  temple: 72,
  ruins: 72,
  tower: 64,
  grandport: 16
}
