import * as THREE from 'three'
import type { Feat, Race } from './city3dRaces'

/**
 * Подробные жители рядом с камерой (по образцу «Семиземья»): лицо с глазами и бровями, причёски и бороды,
 * суставы в плечах, локтях, бёдрах и коленях, походка, дыхание, моргание, черты народов. Издалека жители
 * остаются простыми фигурками; самые близкие к камере подменяются этими моделями.
 */
export type Role = 'man' | 'woman' | 'child' | 'guard' | 'vendor'

export interface Look {
  race: Race
  role: Role
  skin: string
  hair: string
  cloth: string
  legs: string
  skirt: string | null
  seed: number
}

interface Rig {
  root: THREE.Group
  body: THREE.Group
  hips: THREE.Group[]
  knees: THREE.Group[]
  shoulders: THREE.Group[]
  elbows: THREE.Group[]
  head: THREE.Group
  eyes: THREE.Group[]
  tail: THREE.Group | null
  wings: THREE.Group[]
  blinkAt: number
  lookAt: number
  lookTo: number
}

// общие формы: одна на всех, размер задаёт масштаб меша
const G = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  cap: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
  taper: new THREE.CylinderGeometry(0.78, 1, 1, 10, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  // туловище: талия уже груди, плечи скруглены
  torso: new THREE.LatheGeometry([0.13, 0.15, 0.155, 0.165, 0.185, 0.205, 0.21, 0.16, 0.0].map((r, i) => new THREE.Vector2(r, i / 8)), 14),
  // юбка или подол кафтана
  skirt: new THREE.LatheGeometry([0.32, 0.29, 0.25, 0.21, 0.17].map((r, i) => new THREE.Vector2(r, i / 4)), 14)
}
// цилиндры подвешены за верх: так их удобно вращать в суставе
const limb = G.taper.clone().translate(0, -0.5, 0)
const plane = new THREE.PlaneGeometry(1, 1)

export function createPeople(scene: THREE.Scene, max: number): {
  show: (list: { key: object; look: Look; x: number; y: number; z: number; a: number; scale: number; moving: boolean; ph: number }[], t: number) => void
  dispose: () => void
} {
  const mats = new Map<string, THREE.MeshLambertMaterial>()
  const mat = (c: string): THREE.MeshLambertMaterial => {
    let m = mats.get(c)
    if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
    return m
  }
  const dark = (c: string, k: number): string => '#' + new THREE.Color(c).multiplyScalar(k).getHexString()
  const models = new Map<object, Rig>()
  const used = new Map<object, number>()
  const group = new THREE.Group()
  scene.add(group)

  const build = (L: Look): Rig => {
    const r = L.race
    let s = L.seed
    const rnd = (): number => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
    const feats = new Set<Feat>(r.feats ?? [])
    const female = L.role === 'woman'
    const child = L.role === 'child'
    const W = r.w * (female ? 0.92 : 1)
    const root = new THREE.Group()
    const body = new THREE.Group()
    root.add(body)
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat(color))
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      parent.add(m)
      return m
    }
    const pivot = (parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group => {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      parent.add(g)
      return g
    }
    const crab = feats.has('crab'), scaly = feats.has('snout') || feats.has('beak'), bark = feats.has('leaves')
    const boots = scaly || bark || crab || r.id === 'tabaxi' ? L.skin : dark(L.legs, 0.6)

    // ноги: бедро → колено → голень → ступня
    const hipY = 0.9, thigh = 0.43, shin = 0.42
    const hips: THREE.Group[] = [], knees: THREE.Group[] = []
    for (const sd of [-1, 1]) {
      const hip = pivot(body, sd * 0.1 * W, hipY, 0)
      add(hip, limb, L.legs, 0, 0, 0, 0.095 * W, thigh, 0.1 * W)
      const knee = pivot(hip, 0, -thigh, 0)
      add(knee, limb, scaly ? L.skin : L.legs, 0, 0, 0, 0.075 * W, shin, 0.08 * W)
      add(knee, G.box, boots, 0, -shin - 0.02, 0.05, 0.12 * W, 0.08, 0.24)
      hips.push(hip)
      knees.push(knee)
    }
    // туловище, пояс, подол
    if (crab) {
      add(body, G.sphere, L.skin, 0, 1.15, -0.05, 0.36 * W, 0.34, 0.3)
      add(body, G.sphere, dark(L.skin, 0.8), 0, 1.22, -0.12, 0.3 * W, 0.26, 0.24)
    } else add(body, G.torso, L.cloth, 0, 0.86, 0, W, 0.62, W * 0.7)
    add(body, G.cyl, dark(L.cloth, 0.55), 0, 0.98, 0, 0.165 * W, 0.05, 0.12 * W)
    if (L.skirt) add(body, G.skirt, L.skirt, 0, 0.32, 0, W * 1.02, 0.66, W * 0.82)
    else if (L.role === 'vendor') add(body, G.box, '#d9cfb4', 0, 0.62, 0.11 * W, 0.26 * W, 0.42, 0.02)
    if (L.role === 'guard') {
      add(body, G.box, dark(L.cloth, 1.1), 0, 0.98, 0.115 * W, 0.24 * W, 0.42, 0.02)
      add(body, G.sphere, '#9a9aa2', 0, 1.36, 0, 0.21 * W, 0.12, 0.15 * W)
    }
    // руки: плечо → локоть → предплечье → кисть
    const shoulders: THREE.Group[] = [], elbows: THREE.Group[] = []
    for (const sd of [-1, 1]) {
      const sh = pivot(body, sd * 0.215 * W, 1.38, 0)
      add(sh, G.sphere, L.cloth, 0, -0.01, 0, 0.058 * W, 0.058, 0.058 * W)
      add(sh, limb, L.cloth, 0, 0, 0, 0.062 * W, 0.28, 0.066 * W)
      const el = pivot(sh, 0, -0.28, 0)
      add(el, limb, female || child ? L.skin : L.cloth, 0, 0, 0, 0.045 * W, 0.24, 0.05 * W)
      add(el, G.sphere, L.skin, 0, -0.27, 0.01, 0.045 * W, 0.06, 0.035 * W)
      if (crab) add(el, G.sphere, L.skin, 0, -0.3, 0.06, 0.1, 0.07, 0.12)
      shoulders.push(sh)
      elbows.push(el)
    }
    // караул: копьё в правой руке, щит на левой
    if (L.role === 'guard') {
      add(elbows[1], G.cyl, '#5a4028', 0, 0.35, 0.05, 0.02, 2.0, 0.02)
      add(elbows[1], G.cone, '#c8c8d0', 0, 1.42, 0.05, 0.04, 0.2, 0.04)
      add(elbows[0], G.cyl, dark(L.cloth, 0.9), -0.05, -0.12, 0.06, 0.2, 0.04, 0.2).rotation.z = Math.PI / 2
    }
    // крылья и хвост
    const wings: THREE.Group[] = []
    if (feats.has('wings')) for (const sd of [-1, 1]) {
      const w = pivot(body, sd * 0.08, 1.32, -0.12)
      const m = add(w, plane, dark(L.hair, 0.9), sd * 0.42, -0.12, -0.08, 0.8, 0.95, 1)
      m.rotation.y = sd * 0.5
      ;(m.material as THREE.Material).side = THREE.DoubleSide
      wings.push(w)
    }
    let tail: THREE.Group | null = null
    if (feats.has('tail') || feats.has('tailThick')) {
      tail = pivot(body, 0, 0.92, -0.12)
      const thick = feats.has('tailThick')
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.25, -0.25), new THREE.Vector3(0.05, -0.42, -0.62), new THREE.Vector3(0.12, thick ? -0.85 : -0.3, thick ? -1.0 : -0.95)])
      const geo = new THREE.TubeGeometry(curve, 12, thick ? 0.09 : 0.03, 6, false)
      tail.add(new THREE.Mesh(geo, mat(L.skin)))
      tailGeos.push(geo)
    }

    // голова: лицо, глаза с бровями, нос, рот, уши, волосы
    const neck = 1.52
    add(body, G.cyl, L.skin, 0, neck - 0.04, 0, 0.055 * W, 0.12, 0.055 * W)
    const head = pivot(body, 0, neck + 0.12, 0)
    const hr = 0.115
    if (feats.has('snout')) {
      add(head, G.sphere, L.skin, 0, 0, -0.01, hr, hr * 1.05, hr * 1.1)
      add(head, G.box, L.skin, 0, -0.03, 0.12, 0.11, 0.09, 0.17)
      add(head, G.box, dark(L.skin, 0.7), 0, -0.065, 0.13, 0.1, 0.02, 0.16)
    } else if (feats.has('beak')) {
      add(head, G.sphere, L.skin, 0, 0, 0, hr * 1.05, hr * 1.05, hr)
      const b = add(head, G.cone, '#d9a23c', 0, -0.02, 0.15, 0.04, 0.13, 0.04)
      b.rotation.x = Math.PI / 2
    } else {
      add(head, G.sphere, L.skin, 0, 0, 0, hr * 0.92, hr * 1.12, hr)
      add(head, G.sphere, L.skin, 0, -0.07, 0.025, hr * 0.68, hr * 0.5, hr * 0.8)
      const nose = add(head, G.cone, dark(L.skin, 0.93), 0, -0.005, hr * 0.98, 0.018, 0.05, 0.022)
      nose.rotation.x = Math.PI / 2 + 0.25
      add(head, G.box, dark(L.skin, 0.62), 0, -0.058, hr * 0.9, 0.045, 0.008, 0.01)
    }
    const eyes: THREE.Group[] = []
    for (const sd of [-1, 1]) {
      const eg = pivot(head, sd * 0.042, 0.022, hr * (feats.has('snout') ? 0.82 : 0.9))
      add(eg, G.sphereLo, '#f4f0e8', 0, 0, 0, 0.022, 0.015, 0.01)
      add(eg, G.sphereLo, r.id === 'vampires' || r.id === 'demons' ? '#b01818' : r.id === 'tabaxi' ? '#c9a020' : '#3a2e24', 0, 0, 0.007, 0.011, 0.012, 0.006)
      add(eg, G.sphereLo, '#ffffff', -0.004, 0.004, 0.012, 0.003, 0.003, 0.002)
      eyes.push(eg)
      if (!feats.has('beak')) {
        const brow = add(head, G.box, r.bald ? dark(L.skin, 0.75) : L.hair, sd * 0.043, 0.05, hr * 0.92, 0.045, 0.01, 0.012)
        brow.rotation.z = sd * -0.12
      }
    }
    // уши по народу
    if (feats.has('earsLong')) for (const sd of [-1, 1]) {
      const e = add(head, G.cone, L.skin, sd * hr * 1.0, 0.02, -0.01, 0.025, 0.2, 0.015)
      e.rotation.z = sd * -1.05
      e.rotation.x = -0.25
    } else if (feats.has('earsBig')) for (const sd of [-1, 1]) {
      const e = add(head, G.cone, L.skin, sd * hr * 1.25, 0.0, 0, 0.06, 0.2, 0.012)
      e.rotation.z = sd * -1.5
    } else if (feats.has('earsCat')) for (const sd of [-1, 1]) add(head, G.cone, r.id === 'orcs' ? L.skin : L.hair, sd * 0.06, hr * 1.02, -0.01, 0.035, 0.09, 0.025)
    else if (!feats.has('snout') && !feats.has('beak')) for (const sd of [-1, 1]) add(head, G.sphereLo, L.skin, sd * hr * 0.92, -0.005, 0, 0.018, 0.035, 0.02)
    if (feats.has('tusks')) for (const sd of [-1, 1]) add(head, G.cone, '#efe8d0', sd * 0.035, -0.07, hr * 0.85, 0.012, 0.05, 0.012)
    if (feats.has('horns') || feats.has('hornsBig')) for (const sd of [-1, 1]) {
      const big = feats.has('hornsBig')
      const h = add(head, G.cone, '#d8cdb0', sd * 0.06, hr * 0.95, -0.02, big ? 0.03 : 0.022, big ? 0.22 : 0.13, big ? 0.03 : 0.022)
      h.rotation.z = sd * -0.45
      h.rotation.x = -0.35
    }
    // волосы и причёски
    if (bark) {
      for (let i = 0; i < 7; i++) add(head, G.sphereLo, i % 2 ? '#4f8a38' : '#5f9a40', Math.cos(i * 0.9) * 0.08, 0.1 + (i % 3) * 0.03, Math.sin(i * 0.9) * 0.06 - 0.02, 0.07, 0.05, 0.07)
    } else if (L.role === 'guard') {
      add(head, G.cap, '#8a8a92', 0, 0.005, 0, hr * 1.12, hr * 1.2, hr * 1.12)
      add(head, G.box, '#6a6a72', 0, -0.02, hr * 1.05, 0.016, 0.1, 0.012)
    } else if (!r.bald && !feats.has('beak') && !feats.has('snout')) {
      // шапка волос откинута назад: лоб открыт, на затылке волосы ниже
      const capM = add(head, G.cap, L.hair, 0, 0.018, -0.012, hr * 1.0, hr * 1.2, hr * 1.06)
      capM.rotation.x = -0.42
      const style = female ? ['long', 'bun', 'ponytail', 'braids', 'long'][Math.floor(rnd() * 5)] : child ? 'short' : ['short', 'short', 'crop', 'long', 'tied'][Math.floor(rnd() * 5)]
      if (style === 'long') add(head, G.box, L.hair, 0, -0.12, -0.07, 0.2, 0.3, 0.07)
      else if (style === 'bun') add(head, G.sphere, L.hair, 0, 0.07, -0.11, 0.055, 0.055, 0.055)
      else if (style === 'ponytail') add(head, limb, L.hair, 0, 0.04, -0.12, 0.03, 0.3, 0.03).rotation.x = 0.35
      else if (style === 'braids') for (const sd of [-1, 1]) add(head, limb, L.hair, sd * 0.085, -0.02, -0.02, 0.022, 0.3, 0.022)
      else if (style === 'tied') add(head, G.sphereLo, L.hair, 0, 0.01, -0.12, 0.035, 0.035, 0.035)
    }
    // бороды: у дварфов большая, у остальных мужчин — по случаю
    const man = L.role === 'man' || L.role === 'guard' || L.role === 'vendor'
    if (man && !feats.has('snout') && !feats.has('beak')) {
      if (feats.has('beardBig')) {
        add(head, G.sphere, L.hair, 0, -0.12, hr * 0.55, 0.1, 0.15, 0.06)
        add(head, G.cone, L.hair, 0, -0.27, hr * 0.55, 0.07, 0.16, 0.05).rotation.x = Math.PI
      } else if (feats.has('beard') || rnd() < 0.3) add(head, G.sphere, L.hair, 0, -0.085, hr * 0.62, 0.075, 0.07, 0.045)
      else if (rnd() < 0.25) add(head, G.box, L.hair, 0, -0.04, hr * 0.95, 0.06, 0.012, 0.01)
    }
    // рост и ширина народа, дети меньше
    const k = 1.0 * r.h
    root.scale.setScalar(1)
    body.scale.set(k, k, k)
    root.visible = false
    group.add(root)
    return { root, body, hips, knees, shoulders, elbows, head, eyes, tail, wings, blinkAt: rnd() * 5, lookAt: 0, lookTo: 0 }
  }
  const tailGeos: THREE.BufferGeometry[] = []

  const show: ReturnType<typeof createPeople>['show'] = (list, t) => {
    const keep = new Set<object>()
    for (const p of list) {
      let rig = models.get(p.key)
      if (!rig) {
        rig = build(p.look)
        models.set(p.key, rig)
      }
      keep.add(p.key)
      used.set(p.key, t)
      rig.root.visible = true
      rig.root.position.set(p.x, p.y, p.z)
      rig.root.rotation.y = p.a
      rig.root.scale.setScalar(p.scale)
      // шаг: бёдра и руки навстречу, колено сгибается на подъёме, тело чуть подпрыгивает
      const sw = p.moving ? Math.sin(p.ph) : 0
      rig.hips[0].rotation.x = sw * 0.5
      rig.hips[1].rotation.x = -sw * 0.5
      rig.knees[0].rotation.x = p.moving ? Math.max(0, -Math.sin(p.ph)) * 0.75 : 0
      rig.knees[1].rotation.x = p.moving ? Math.max(0, Math.sin(p.ph)) * 0.75 : 0
      rig.shoulders[0].rotation.x = -sw * 0.38
      rig.shoulders[1].rotation.x = sw * 0.38
      rig.shoulders[0].rotation.z = -0.07
      rig.shoulders[1].rotation.z = 0.07
      rig.elbows[0].rotation.x = -0.25 - (p.moving ? Math.max(0, sw) * 0.3 : Math.sin(t * 1.3 + p.ph) * 0.03)
      rig.elbows[1].rotation.x = -0.25 - (p.moving ? Math.max(0, -sw) * 0.3 : Math.sin(t * 1.2 + p.ph) * 0.03)
      rig.body.position.y = p.moving ? Math.abs(Math.cos(p.ph)) * 0.035 : Math.sin(t * 1.6 + p.ph) * 0.004
      // взгляд: время от времени поворачивает голову
      if (t > rig.lookAt) { rig.lookAt = t + 2 + Math.random() * 4; rig.lookTo = p.moving ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 1.2 }
      rig.head.rotation.y += (rig.lookTo - rig.head.rotation.y) * 0.06
      // моргание раз в несколько секунд
      if (t > rig.blinkAt + 0.13) rig.blinkAt = t + 2.5 + Math.random() * 4
      const blink = t > rig.blinkAt ? 0.1 : 1
      for (const e of rig.eyes) e.scale.y = blink
      if (rig.tail) { rig.tail.rotation.y = Math.sin(t * 1.4 + p.ph) * 0.3; rig.tail.rotation.x = Math.sin(t * 0.9) * 0.08 }
      rig.wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.15 + Math.sin(t * 0.8 + p.ph) * 0.06)))
    }
    for (const [key, rig] of models) {
      if (keep.has(key)) continue
      rig.root.visible = false
      // давно не нужные модели разбираем, чтобы память не росла
      if (models.size > max * 2 && t - (used.get(key) ?? 0) > 20) {
        group.remove(rig.root)
        models.delete(key)
        used.delete(key)
      }
    }
  }
  return {
    show,
    dispose: () => {
      scene.remove(group)
      mats.forEach((m) => m.dispose())
      tailGeos.forEach((g) => g.dispose())
    }
  }
}
