import * as THREE from 'three'

/**
 * 3D-миниатюры особых мест на карте мира: Серебряная Ива и Стена Отчаяния.
 * Модель собирается из тел Three.js, освещается солнцем с тенью и один раз рендерится в картинку.
 * Ива — значок-спрайт; Стена — картинка, натянутая на свой участок карты (растёт вместе с картой).
 */

const ELEV = Math.atan2(20, 18) // наклон камеры как у значков поселений

function lambert(color: number, emissive = 0, ei = 0): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei, flatShading: true })
}
function add(g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.castShadow = true
  o.receiveShadow = true
  g.add(o)
  return o
}

/** Рендер модели ортокамерой под наклоном; halfW/halfH — полуразмеры кадра в единицах модели */
function shoot(model: THREE.Object3D, w: number, h: number, halfW: number, halfH: number, cx: number, cz: number, shadowR: number): HTMLCanvasElement {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(w, h)
  r.shadowMap.enabled = true
  r.shadowMap.type = THREE.PCFSoftShadowMap
  r.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const dist = 200
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, dist * 3)
  cam.position.set(cx, Math.sin(ELEV) * dist, cz + Math.cos(ELEV) * dist)
  cam.lookAt(cx, 0, cz)
  scene.add(new THREE.HemisphereLight(0xf2ead8, 0x4a4436, 1.3))
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.4)
  sun.position.set(cx - 10 * shadowR / 16, 18 * shadowR / 16, cz + 6 * shadowR / 16)
  sun.target.position.set(cx, 0, cz)
  scene.add(sun.target)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -shadowR
  sun.shadow.camera.right = shadowR
  sun.shadow.camera.top = shadowR
  sun.shadow.camera.bottom = -shadowR
  sun.shadow.camera.far = shadowR * 4
  sun.shadow.radius = 3
  scene.add(sun)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(shadowR * 4, shadowR * 4), new THREE.ShadowMaterial({ opacity: 0.32 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(cx, 0, cz)
  ground.receiveShadow = true
  scene.add(ground)
  scene.add(model)
  r.render(scene, cam)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(r.domElement, 0, 0)
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
  })
  r.dispose()
  r.forceContextLoss()
  return c
}

// ---------- Серебряная Ива ----------
let willowUrl: { url: string; ax: number; ay: number } | null = null
/** Картинка Ивы и точка её корня (в долях картинки) */
export function willowSprite(): { url: string; ax: number; ay: number } {
  if (willowUrl) return willowUrl
  const g = new THREE.Group()
  const bark = lambert(0x6a5644)
  const leaf = [lambert(0xa9cbb2, 0xbfe6cc, 0.18), lambert(0xc6e0cc, 0xd8f2e0, 0.2), lambert(0x93b89e, 0xa8d8b8, 0.14)]
  const strand = lambert(0xd6eadb, 0xe6fff0, 0.3)
  // ствол и корни
  add(g, new THREE.CylinderGeometry(0.55, 1.0, 5.2, 9), bark, 0, 2.6, 0)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    const root = add(g, new THREE.CylinderGeometry(0.12, 0.35, 1.8, 6), bark, Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9)
    root.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1)
  }
  // ветви
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const br = add(g, new THREE.CylinderGeometry(0.12, 0.28, 3.2, 6), bark, Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1)
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9)
  }
  // крона — несколько сплюснутых шаров
  const crowns: [number, number, number, number][] = [
    [0, 7.0, 0, 3.4], [-2.3, 6.4, 0.6, 2.4], [2.3, 6.5, -0.4, 2.5], [0.4, 6.3, 2.0, 2.3], [-0.5, 6.4, -2.0, 2.3], [0, 8.3, 0, 2.2]
  ]
  crowns.forEach(([x, y, z, s], i) => {
    const m = add(g, new THREE.IcosahedronGeometry(s, 1), leaf[i % 3], x, y, z)
    m.scale.set(1, 0.62, 1)
  })
  // свисающие серебряные пряди
  let seed = 7
  const rnd = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.2
    const rad = 2.6 + rnd() * 1.6
    const len = 3.2 + rnd() * 2.6
    const top = 6.4 + rnd() * 0.6
    add(g, new THREE.CylinderGeometry(0.07, 0.13, len, 4), i % 3 ? strand : leaf[1], Math.cos(a) * rad, top - len / 2, Math.sin(a) * rad)
  }
  const W = 256
  const half = 7.5
  const c = shoot(g, W, W, half, half, 0, 0, 12)
  // корень (0,0,0) в кадре: камера смотрит на центр кадра — точка земли под центром
  willowUrl = { url: c.toDataURL('image/png'), ax: 0.5, ay: 0.5 }
  return willowUrl
}

// ---------- Стена Отчаяния ----------
export interface WallImage {
  url: string
  /** Прямоугольник карты (x0,y0)-(x1,y1), на который натягивается картинка */
  x0: number
  y0: number
  x1: number
  y1: number
}
const wallCache = new Map<string, WallImage>()
/**
 * Стена по точкам (координаты карты), разрывы — где broken[i] у отрезка i→i+1.
 * Высота преувеличена, чтобы стену было видно на карте мира.
 */
export function wallImage(pts: [number, number][], broken: boolean[]): WallImage {
  const key = JSON.stringify([pts, broken])
  const hit = wallCache.get(key)
  if (hit) return hit
  const H = 7 // высота стены в единицах карты
  const T = 3.2 // толщина
  const g = new THREE.Group()
  const stone = lambert(0xb9b4aa)
  const top = lambert(0xd9d5cc)
  const dark = lambert(0x6f6a62)
  const ruin = lambert(0x8f8a80)
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const ang = -Math.atan2(bz - az, bx - ax)
    const seg = new THREE.Group()
    seg.position.set((ax + bx) / 2, 0, (az + bz) / 2)
    seg.rotation.y = ang
    g.add(seg)
    if (broken[i]) {
      // Пролом: обломки и низкие куски кладки
      let s = i * 97 + 3
      const rnd = (): number => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
      for (let k = 0; k < 14; k++) {
        const x = (rnd() - 0.5) * len * 0.9
        const h = 0.8 + rnd() * (Math.abs(x) > len * 0.3 ? H * 0.6 : 1.4)
        add(seg, new THREE.BoxGeometry(2 + rnd() * 3, h, T * (0.6 + rnd() * 0.5)), ruin, x, h / 2, (rnd() - 0.5) * 3).rotation.y = rnd() - 0.5
      }
      continue
    }
    add(seg, new THREE.BoxGeometry(len + T, H, T), stone, 0, H / 2, 0)
    add(seg, new THREE.BoxGeometry(len + T, 0.5, T + 0.8), top, 0, H + 0.25, 0)
    // зубцы
    const n = Math.max(2, Math.floor(len / 3.2))
    for (let k = 0; k < n; k++) {
      const x = -len / 2 + (k + 0.5) * (len / n)
      add(seg, new THREE.BoxGeometry(1.5, 1.4, 0.9), top, x, H + 1.2, T / 2)
      add(seg, new THREE.BoxGeometry(1.5, 1.4, 0.9), top, x, H + 1.2, -T / 2)
    }
    // контрфорсы со стороны юга
    for (let k = 1; k < Math.floor(len / 18); k++) {
      add(seg, new THREE.BoxGeometry(1.6, H * 0.8, 1.8), dark, -len / 2 + k * 18, H * 0.4, T / 2 + 0.8)
    }
  }
  // башни в каждой точке (Поющие Камни)
  pts.forEach(([x, z], i) => {
    const nearBreach = (i > 0 && broken[i - 1]) || broken[i]
    const th = nearBreach ? H * 1.15 : H * 1.7
    add(g, new THREE.CylinderGeometry(3.0, 3.4, th, 10), stone, x, th / 2, z)
    add(g, new THREE.CylinderGeometry(3.5, 3.5, 0.7, 10), top, x, th + 0.35, z)
    if (!nearBreach) add(g, new THREE.ConeGeometry(3.6, 4.2, 10), lambert(0x55606e), x, th + 2.8, z)
  })
  // кадр: прямоугольник земли с запасом под высоту
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  const pad = 12
  const x0 = Math.min(...xs) - pad
  const x1 = Math.max(...xs) + pad
  const tall = H * 1.7 + 8 // самая высокая точка модели
  // на экране: z земли сжимается в sin(ELEV), высота — в cos(ELEV); сверху добавляем место под высоту
  const z0 = Math.min(...zs) - pad - tall * Math.cos(ELEV) / Math.sin(ELEV)
  const z1 = Math.max(...zs) + pad
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const halfW = (x1 - x0) / 2
  const halfH = ((z1 - z0) / 2) * Math.sin(ELEV)
  const W = Math.min(4096, Math.round((x1 - x0) * 3))
  const Hpx = Math.max(64, Math.round((W * halfH) / halfW))
  const c = shoot(g, W, Hpx, halfW, halfH, cx, cz, Math.max(halfW, z1 - z0) + 10)
  const res = { url: c.toDataURL('image/png'), x0, y0: z0, x1, y1: z1 }
  wallCache.set(key, res)
  return res
}
