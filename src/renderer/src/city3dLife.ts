import * as THREE from 'three'
import { Bucket } from './city3d'
import type { Streets } from './city3dStreets'
import type { Feat, Race } from './city3dRaces'
import { createPeople, type Look } from './city3dPeople'
import { phrase, type Role } from './city3dSpeech'

type P2 = [number, number]
const enum K { Man, Woman, Child, Guard, Vendor }

interface Person {
  kind: K
  x: number
  z: number
  a: number
  ph: number
  speed: number
  side: number
  scale: number
  path: Float32Array | null
  seg: number
  along: number
  rest: number
  home: P2
  /** Показан ли сейчас: тот, кто вошёл в дом, исчезает до следующего выхода */
  inside: boolean
  race: Race
  /** Особые черты: номер меша и место в нём */
  slots: [number, number][]
  shown: boolean
  y: number
  /** Бродит сам по себе, а не идёт по маршруту: иначе все сходятся на главную улицу */
  wander: boolean
  /** Где нарисован на этом кадре (со сдвигом от оси улицы) и идёт ли */
  dx: number
  dz: number
  moving: boolean
  look: Look | null
}
export interface PersonInfo { race: Race; role: string; say: string }
export interface Speech { id: number; text: string; x: number; y: number; z: number }

const CLOTHES: Record<string, string[]> = {
  styria: ['#2a2630', '#3a3540', '#322a30', '#4a4048', '#3a3028', '#2e2e36'],
  church: ['#d8d2c2', '#8a8678', '#3f4f6a', '#a89f8a', '#6a7a8a', '#c9c2ae'],
  south: ['#b8553a', '#d9a23c', '#3f7a7a', '#8a3f5a', '#cdb88a', '#5a7a3a', '#c97a3a'],
  kalt: ['#6a6a48', '#7d5f3a', '#4a5a3a', '#8a7a52', '#5a4a30'],
  argus: ['#5a4038', '#3f4a5a', '#6a5a40', '#4a4a4a', '#7a6a58'],
  empire: ['#7a3b2e', '#3f5f7a', '#6a7a3a', '#8a6a3a', '#5a4a6a', '#a8a08a', '#3f6a4a', '#9a5f3a']
}
const GUARD: Record<string, string> = { styria: '#1e1a22', church: '#e6e0d0', south: '#7a2f2f', kalt: '#4a5230', argus: '#3a3a40', empire: '#8f2f2f' }

export interface Life {
  tick: (dt: number, t: number, night: number, focus: THREE.Vector3, boost: number) => void
  setMarks: (on: boolean) => void
  pick: (o: THREE.Vector3, d: THREE.Vector3, maxT: number) => PersonInfo | null
  /** Ближайший житель впереди (до range м), который «заговаривает»; после реплики молчит 30 с */
  speak: (o: THREE.Vector3, d: THREE.Vector3, range: number, t: number) => Speech | null
  /** Сколько жителей какого народа сейчас в городе */
  census: { race: Race; count: number }[]
  dispose: () => void
}

/** Жители поселения: ходят по улицам от двери к двери, торгуют, стоят в карауле; повозки, куры, собаки, овцы. */
export function createLife(o: {
  scene: THREE.Scene
  streets: Streets | null
  heightAt: (x: number, z: number) => number
  gridAt: (x: number, z: number) => number
  doors: P2[]
  pois: P2[]
  gates: P2[]
  vendors: { x: number; z: number; a: number }[]
  center: P2
  radius: number
  size: P2
  style: string
  buildings: number
  mobile: boolean
  rnd: () => number
  dot: THREE.Texture
  population: { race: Race; weight: number }[]
  state?: string
  culture?: string
  gov?: string
}): Life {
  const { scene, streets, heightAt, gridAt, doors, pois, gates, rnd: R } = o
  const clothes = CLOTHES[o.style] ?? CLOTHES.empire
  const N = o.buildings
  const pick = <T,>(a: T[]): T => a[Math.floor(R() * a.length)]
  const disposable: { dispose: () => void }[] = []
  const meshes: THREE.InstancedMesh[] = []
  const pMat = new THREE.MeshLambertMaterial({ vertexColors: true })
  disposable.push(pMat)

  const people: Person[] = []
  // раса: сперва по одному из самых заметных народов, чтобы в большом городе встречались все, затем по долям
  const total = o.population.reduce((a, q) => a + q.weight, 0) || 1
  const drawRace = (filter?: (r: Race) => boolean): Race => {
    const list = filter ? o.population.filter((q) => filter(q.race)) : o.population
    const sum = list.reduce((a, q) => a + q.weight, 0)
    let x = R() * sum
    for (const q of list) { x -= q.weight; if (x <= 0) return q.race }
    return list[0]?.race ?? o.population[0].race
  }
  const guaranteed: Race[] = N > 150 ? o.population.map((q) => q.race).slice(0, Math.min(o.population.length, 60)) : o.population.filter((q) => q.weight / total > 0.02).map((q) => q.race)
  const add = (kind: K, x: number, z: number, a: number, race = drawRace()): Person => {
    const small = kind === K.Child
    const p: Person = { kind, x, z, a, ph: R() * 6.28, speed: (1 + R() * 0.55) * (0.75 + race.h * 0.3), side: (R() - 0.5) * (N > 150 ? 3.6 : 1.7), scale: small ? 0.62 : 0.94 + R() * 0.12, path: null, seg: 0, along: 0, rest: 0, home: [x, z], inside: false, race, slots: [], shown: true, y: 0, wander: false, dx: x, dz: z, moving: false, look: null }
    if (small) p.speed *= 1.25
    people.push(p)
    return p
  }

  // ---- кто живёт в городе ----
  const walkers = Math.min(o.mobile ? 140 : 620, Math.round(N * (o.mobile ? 0.35 : 0.65)) + 10)
  const focusNow = new THREE.Vector3(o.center[0], 0, o.center[1])
  let nearR = Math.max(90, Math.min(220, o.radius * 0.6))
  const nearDoor = (): P2 => {
    let d = pick(doors)
    for (let i = 0; i < 14; i++) {
      if (Math.hypot(d[0] - focusNow.x, d[1] - focusNow.z) < nearR) return d
      d = pick(doors)
    }
    return d
  }
  const nextTrip = (p: Person, teleport = false): void => {
    if (!streets || !doors.length) return
    // кто вышел из дома — выходит рядом с тем местом, куда смотрят: большой город не кажется пустым
    const from: P2 = p.path && !teleport ? [p.x, p.z] : nearDoor()
    // чаще всего — к соседям: по переулкам, а не всем скопом по главной улице
    const roll = R()
    let to = roll < 0.15 && pois.length ? pick(pois) : nearDoor()
    if (roll >= 0.15 && roll < 0.8) for (let i = 0; i < 20; i++) {
      const d = pick(doors)
      if (Math.hypot(d[0] - from[0], d[1] - from[1]) < 45) { to = d; break }
    }
    p.path = streets.trip(from, to) ?? streets.trip(nearDoor(), nearDoor()) ?? streets.trip(pick(doors), pick(doors))
    p.seg = 0
    p.along = 0
    if (p.path) { p.x = p.path[0]; p.z = p.path[1] }
  }
  for (let i = 0; i < walkers && doors.length; i++) {
    const r = R()
    const race = i < guaranteed.length ? guaranteed[i] : drawRace()
    const p = add(r < 0.42 ? K.Man : r < 0.86 ? K.Woman : K.Child, 0, 0, 0, race)
    nextTrip(p)
    if (!p.path) { people.pop(); continue }
    if (i % 5 < 3) {
      p.wander = true
      const d = pick(doors)
      p.x = d[0]; p.z = d[1]; p.a = R() * 6.283; p.path = null
      continue
    }
    // часть уже в пути: город живой с первого кадра
    p.seg = Math.floor(R() * (p.path.length / 2 - 1)) * 2
    p.x = p.path[p.seg]
    p.z = p.path[p.seg + 1]
  }
  for (const v of o.vendors) add(K.Vendor, v.x, v.z, v.a)
  const guardRace = (r: Race): boolean => r.h >= 0.72 && !r.feats?.includes('wings') && !r.feats?.includes('crab')
  // караул у ворот и обходы
  for (const g of gates) for (const sd of [-1, 1]) {
    const x = g[0] + sd * 1.6, z = g[1] + sd * 1.1
    if (gridAt(x, z) === 0) add(K.Guard, x, z, R() * 6.28, drawRace(guardRace))
  }
  const patrols = Math.min(o.mobile ? 8 : 30, Math.floor(N / 40))
  for (let i = 0; i < patrols; i++) {
    const p = add(K.Guard, 0, 0, 0, drawRace(guardRace))
    nextTrip(p)
    if (!p.path) { people.pop(); continue }
    p.speed = 1.05
  }

  // ---- модели ----
  const inst = (g: THREE.BufferGeometry, n: number, shadow = false): THREE.InstancedMesh => {
    const m = new THREE.InstancedMesh(g, pMat, Math.max(1, n))
    m.frustumCulled = false
    m.castShadow = shadow
    scene.add(m)
    meshes.push(m)
    disposable.push(g)
    return m
  }
  const part = (f: (b: Bucket) => void): THREE.BufferGeometry => { const b = new Bucket(); f(b); return b.geometry()! }
  const torsoG = part((b) => {
    b.box(0, 0.8, 0, 0.44, 0.62, 0.25, '#ffffff')
    b.box(-0.28, 0.88, 0, 0.11, 0.54, 0.13, '#ececec')
    b.box(0.28, 0.88, 0, 0.11, 0.54, 0.13, '#ececec')
  })
  const skirtG = part((b) => b.cyl(0, 0.02, 0, 0.36, 0.82, 8, '#ffffff', 0.2, false))
  const legG = part((b) => b.box(0, -0.82, 0, 0.15, 0.82, 0.18, '#ffffff'))
  const headG = part((b) => b.box(0, 1.42, 0, 0.27, 0.27, 0.27, '#ffffff'))
  const hairG = part((b) => b.box(0, 1.63, -0.015, 0.3, 0.12, 0.3, '#ffffff'))
  const longG = part((b) => b.box(0, 1.1, -0.15, 0.27, 0.56, 0.08, '#ffffff'))
  const gearG = part((b) => {
    b.cyl(0, 1.64, 0, 0.2, 0.2, 6, '#8a8a90', 0.04, false)
    b.box(0.38, 0, 0.1, 0.05, 2.25, 0.05, '#4a3522')
    b.cyl(0.38, 2.25, 0.1, 0.06, 0.26, 4, '#b8b8c0', 0, false)
    b.box(-0.35, 0.72, 0.1, 0.06, 0.68, 0.46, '#7a2f2f')
  })
  const FEAT: Record<Feat, THREE.BufferGeometry> = {
    earsLong: part((b) => { for (const s of [-1, 1]) { b.tri([s * 0.13, 1.5, 0], [s * 0.13, 1.62, 0], [s * 0.48, 1.76, -0.05], '#ffffff'); b.tri([s * 0.13, 1.5, 0.02], [s * 0.13, 1.62, 0.02], [s * 0.48, 1.76, -0.03], '#ffffff') } }),
    earsBig: part((b) => { for (const s of [-1, 1]) { b.tri([s * 0.13, 1.44, 0], [s * 0.13, 1.66, 0], [s * 0.52, 1.6, 0], '#ffffff'); b.tri([s * 0.13, 1.44, 0.03], [s * 0.13, 1.66, 0.03], [s * 0.52, 1.6, 0.03], '#ffffff') } }),
    earsCat: part((b) => { for (const s of [-1, 1]) b.cyl(s * 0.1, 1.72, 0, 0.08, 0.2, 4, '#ffffff', 0, false) }),
    beard: part((b) => b.box(0, 1.2, 0.12, 0.25, 0.28, 0.08, '#ffffff')),
    beardBig: part((b) => { b.box(0, 0.86, 0.14, 0.32, 0.62, 0.12, '#ffffff'); b.box(0, 1.34, 0.14, 0.28, 0.12, 0.05, '#ffffff') }),
    horns: part((b) => { for (const s of [-1, 1]) b.cyl(s * 0.09, 1.7, -0.05, 0.05, 0.26, 5, '#d8cdb0', 0, false) }),
    hornsBig: part((b) => { for (const s of [-1, 1]) { b.cyl(s * 0.13, 1.68, 0, 0.08, 0.16, 6, '#d8cdb0', 0.06, false); b.cyl(s * 0.2, 1.82, -0.02, 0.06, 0.34, 6, '#d8cdb0', 0, false) } }),
    tail: part((b) => { b.quad([-0.05, 0.9, -0.12], [0.05, 0.9, -0.12], [0.03, 0.42, -0.85], [-0.03, 0.42, -0.85], '#ffffff'); b.quad([0, 0.95, -0.12], [0, 0.85, -0.12], [0, 0.38, -0.85], [0, 0.46, -0.85], '#ffffff'); b.quad([0.03, 0.42, -0.85], [-0.03, 0.42, -0.85], [0, 0.62, -1.2], [0, 0.62, -1.2], '#ffffff') }),
    tailThick: part((b) => { b.quad([-0.14, 0.85, -0.12], [0.14, 0.85, -0.12], [0.02, 0.12, -1.25], [-0.02, 0.12, -1.25], '#ffffff'); b.quad([0, 0.98, -0.12], [0, 0.7, -0.12], [0, 0.08, -1.25], [0, 0.14, -1.25], '#ffffff') }),
    tusks: part((b) => { for (const s of [-1, 1]) b.cyl(s * 0.09, 1.42, 0.14, 0.035, 0.18, 4, '#efe8d0', 0, false) }),
    snout: part((b) => { b.box(0, 1.44, 0.22, 0.2, 0.15, 0.24, '#ffffff'); b.box(0, 1.42, 0.24, 0.16, 0.05, 0.22, '#d8d8d8') }),
    beak: part((b) => { const t: [number, number, number] = [0, 1.46, 0.46]; const a: [number, number, number] = [-0.1, 1.56, 0.13], c: [number, number, number] = [0.1, 1.56, 0.13], d: [number, number, number] = [0.1, 1.42, 0.13], e: [number, number, number] = [-0.1, 1.42, 0.13]; b.tri(a, c, t, '#d9a23c'); b.tri(c, d, t, '#c9902c'); b.tri(d, e, t, '#b8802a'); b.tri(e, a, t, '#c9902c') }),
    wings: part((b) => { for (const s of [-1, 1]) { b.quad([s * 0.16, 1.32, -0.13], [s * 0.82, 1.62, -0.3], [s * 0.78, 0.78, -0.3], [s * 0.2, 0.84, -0.13], '#ffffff'); b.quad([s * 0.16, 1.33, -0.15], [s * 0.82, 1.63, -0.32], [s * 0.78, 0.79, -0.32], [s * 0.2, 0.85, -0.15], '#ffffff') } }),
    leaves: part((b) => { b.cyl(0, 1.62, 0, 0.3, 0.26, 7, '#4f8a38', 0.05, false); b.cyl(0, 1.74, 0, 0.2, 0.22, 7, '#5f9a40', 0, false); for (const s of [-1, 1]) b.cyl(s * 0.3, 1.26, 0, 0.17, 0.2, 6, '#4f8a38', 0.02, false) }),
    crab: part((b) => { b.cyl(0, 0.84, 0, 0.5, 0.42, 9, '#ffffff', 0.34); for (const s of [-1, 1]) { b.box(s * 0.56, 0.96, 0.2, 0.14, 0.14, 0.42, '#ececec'); b.box(s * 0.56, 0.93, 0.5, 0.25, 0.22, 0.24, '#ffffff') } })
  }
  const FEAT_NAMES = Object.keys(FEAT) as Feat[]
  // у рас с чешуёй, мехом или корой женщины без юбок: своя одежда не прячет ноги
  const skirted = (p: Person): boolean => p.kind === K.Woman && !p.race.feats?.some((f) => f === 'crab' || f === 'snout' || f === 'beak' || f === 'leaves')
  const women = people.filter(skirted)
  const legged = people.filter((p) => !skirted(p))
  const guards = people.filter((p) => p.kind === K.Guard)
  const longHaired = people.filter((p) => p.kind === K.Woman && !p.race.bald && !p.race.feats?.includes('crab'))
  const torso = inst(torsoG, people.length, true), skirt = inst(skirtG, women.length, true), legs = inst(legG, legged.length * 2, true), head = inst(headG, people.length), hair = inst(hairG, people.length), gear = inst(gearG, guards.length, true), longM = inst(longG, longHaired.length)
  const col = new THREE.Color()
  const hairOf = new Map<Person, string>()
  const skinOf = new Map<Person, string>()
  // особые черты: только у тех, кому положены; бород нет у женщин и детей
  const featOf = (p: Person): Feat[] => (p.race.feats ?? []).filter((f) => !((f === 'beard' || f === 'beardBig') && p.kind !== K.Man && p.kind !== K.Guard && p.kind !== K.Vendor))
  const featCount = new Map<Feat, number>()
  people.forEach((p) => featOf(p).forEach((f) => featCount.set(f, (featCount.get(f) ?? 0) + 1)))
  const featMeshes = new Map<Feat, THREE.InstancedMesh>()
  for (const f of FEAT_NAMES) {
    const n = featCount.get(f)
    if (n) featMeshes.set(f, inst(FEAT[f], n, f === 'wings' || f === 'crab'))
    else FEAT[f].dispose()
  }
  const featList = [...featMeshes.keys()]
  const featUsed = new Map<Feat, number>()
  const leg2 = new Map<Person, number>()
  let lIdx = 0
  people.forEach((p, i) => {
    const r = p.race
    const skin = pick(r.skin), hc = pick(r.hair)
    skinOf.set(p, skin)
    hairOf.set(p, hc)
    const cl = r.cloth ? pick(r.cloth) : pick(clothes)
    const c0 = p.kind === K.Guard && !r.feats?.includes('crab') ? GUARD[o.style] ?? GUARD.empire : cl
    torso.setColorAt(i, col.set(c0))
    head.setColorAt(i, col.set(skin))
    hair.setColorAt(i, col.set(p.kind === K.Guard ? '#55555c' : r.bald ? skin : hc))
    // ноги: у чешуйчатых, пушистых и древесных — в цвет кожи
    const legC = r.feats?.some((f) => f === 'snout' || f === 'beak' || f === 'crab' || f === 'leaves') || r.id === 'tabaxi' ? skin : (r.id === 'orcs' || r.id === 'ogres' || r.id === 'goliaths') ? '#2e2620' : '#3a332c'
    if (!skirted(p)) { leg2.set(p, lIdx); legs.setColorAt(lIdx++, col.set(legC)); legs.setColorAt(lIdx++, col.set(legC)) }
    const role = p.kind === K.Woman ? 'woman' : p.kind === K.Child ? 'child' : p.kind === K.Guard ? 'guard' : p.kind === K.Vendor ? 'vendor' : 'man'
    p.look = { race: r, role, skin, hair: hc, cloth: c0, legs: legC, skirt: null, seed: (i * 2654435761) >>> 0 }
    p.slots = featOf(p).map((f) => {
      const slot = featUsed.get(f) ?? 0
      featUsed.set(f, slot + 1)
      const m = featMeshes.get(f)!
      // цвет черты: борода и крылья как волосы, рога и бивни — свои белёсые, остальное как кожа
      if (f === 'beard' || f === 'beardBig' || f === 'wings') m.setColorAt(slot, col.set(hc))
      else if (f === 'horns' || f === 'hornsBig' || f === 'tusks' || f === 'leaves' || f === 'beak') m.setColorAt(slot, col.set('#ffffff'))
      else m.setColorAt(slot, col.set(skin))
      return [featList.indexOf(f), slot] as [number, number]
    })
  })
  women.forEach((p, i) => {
    const c = p.race.cloth ? pick(p.race.cloth) : pick(clothes)
    skirt.setColorAt(i, col.set(c))
    if (p.look) p.look.skirt = c
  })
  // самые близкие к камере жители — подробные модели с лицом, причёской и суставами
  const DETAIL = o.mobile ? 6 : 16
  const detailed = createPeople(scene, DETAIL)
  let near: Person[] = []
  let nearCheck = 0
  longHaired.forEach((p, i) => longM.setColorAt(i, col.set(hairOf.get(p)!)))
  guards.forEach((_, i) => gear.setColorAt(i, col.set('#ffffff')))
  const skirtIdx = new Map(women.map((p, i) => [p, i]))
  const longIdx = new Map(longHaired.map((p, i) => [p, i]))
  const gearIdx = new Map(guards.map((p, i) => [p, i]))

  // метки рас: цветной круг под ногами в режиме «Расы»
  const discG = new THREE.CircleGeometry(0.62, 14)
  discG.rotateX(-Math.PI / 2)
  const discMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, fog: false })
  const discs = new THREE.InstancedMesh(discG, discMat, Math.max(1, people.length))
  discs.frustumCulled = false
  discs.visible = false
  discs.renderOrder = 5
  people.forEach((p, i) => discs.setColorAt(i, col.set(p.race.mark)))
  scene.add(discs)
  meshes.push(discs)
  disposable.push(discG, discMat)

  // ---- повозки ----
  interface Cart { path: Float32Array; seg: number; dir: number; x: number; z: number; a: number; along: number }
  const carts: Cart[] = []
  if (streets && N > 60) {
    const from = gates.length ? gates : doors.slice(0, 6)
    const to = pois.length ? pois : doors
    const count = Math.min(o.mobile ? 2 : 7, Math.floor(N / 60) + 1)
    for (let i = 0; i < count; i++) {
      const path = streets.trip(pick(from), pick(to))
      if (!path || path.length < 12) continue
      const seg = Math.floor(R() * (path.length / 2 - 1)) * 2
      carts.push({ path, seg, dir: 1, x: path[seg], z: path[seg + 1], a: 0, along: 0 })
    }
  }
  const cartG = part((b) => {
    b.box(0, 0.62, -0.5, 1.25, 0.14, 2.1, '#7a5a38')
    for (const sd of [-1, 1]) {
      b.box(sd * 0.62, 0.76, -0.5, 0.07, 0.42, 2.1, '#6a4a2c')
      for (const f of [-1.2, 0.2]) b.cyl(sd * 0.72, 0.42 + 0, f, 0.42, 0.08, 10, '#4a3522', 0.42)
    }
    b.box(0, 0.8, -0.8, 0.9, 0.42, 0.9, '#c9b57a')
    // лошадь
    const h = '#6e4a2c'
    b.box(0, 0.86, 2, 0.5, 0.56, 1.45, h)
    for (const u of [-0.18, 0.18]) for (const v of [1.45, 2.55]) b.box(u, 0, v, 0.14, 0.9, 0.14, '#4a3020')
    b.box(0, 1.3, 2.85, 0.28, 0.72, 0.36, h)
    b.box(0, 1.82, 3.05, 0.26, 0.28, 0.58, h)
    b.box(0, 1.2, 1.2, 0.08, 0.5, 0.08, '#2a1e14')
    b.box(0, 0.8, 0.9, 0.12, 0.1, 1.4, '#4a3522')
  })
  const cartM = inst(cartG, carts.length, true)

  // ---- животные ----
  interface Beast { x: number; z: number; a: number; v: number; rest: number; type: number; home: P2 }
  const beasts: Beast[] = []
  const small = Math.min(o.mobile ? 24 : 70, Math.round(N * 0.35) + 6)
  for (let i = 0; i < small && doors.length; i++) {
    const d = pick(doors)
    beasts.push({ x: d[0] + (R() - 0.5) * 5, z: d[1] + (R() - 0.5) * 5, a: R() * 6.28, v: 0, rest: R() * 3, type: R() < 0.8 ? 0 : 1, home: d })
  }
  // овцы и коровы пасутся за околицей
  for (let i = 0, g = 0; g < (o.mobile ? 2 : 5) && i < 400; i++) {
    const a = R() * 6.283, d = o.radius * (1.1 + R() * 0.9)
    const x = o.center[0] + Math.cos(a) * d, z = o.center[1] + Math.sin(a) * d
    if (x < 0 || z < 0 || x > o.size[0] || z > o.size[1] || gridAt(x, z) !== 0 || heightAt(x, z) < 0.5) continue
    const type = R() < 0.7 ? 2 : 3
    for (let k = 0; k < 7; k++) beasts.push({ x: x + (R() - 0.5) * 14, z: z + (R() - 0.5) * 14, a: R() * 6.28, v: 0, rest: R() * 8, type, home: [x, z] })
    g++
  }
  const GEO: THREE.BufferGeometry[] = [
    part((b) => { b.box(0, 0.08, 0, 0.17, 0.17, 0.27, '#ffffff'); b.box(0, 0.2, 0.13, 0.09, 0.12, 0.09, '#ffffff'); b.box(0, 0.24, 0.2, 0.04, 0.03, 0.05, '#d9a23c'); b.box(0, 0.32, 0.13, 0.03, 0.05, 0.07, '#c0392b') }),
    part((b) => { b.box(0, 0.26, 0, 0.2, 0.22, 0.58, '#ffffff'); b.box(0, 0.42, 0.33, 0.17, 0.17, 0.22, '#ffffff'); for (const u of [-0.07, 0.07]) for (const v of [-0.22, 0.22]) b.box(u, 0, v, 0.05, 0.27, 0.05, '#ffffff'); b.box(0, 0.42, -0.34, 0.04, 0.05, 0.22, '#ffffff') }),
    part((b) => { b.box(0, 0.38, 0, 0.5, 0.42, 0.85, '#ffffff'); b.box(0, 0.56, 0.5, 0.22, 0.24, 0.28, '#3a332c'); for (const u of [-0.16, 0.16]) for (const v of [-0.28, 0.28]) b.box(u, 0, v, 0.08, 0.4, 0.08, '#3a332c') }),
    part((b) => { b.box(0, 0.68, 0, 0.62, 0.62, 1.5, '#ffffff'); b.box(0, 0.98, 0.9, 0.34, 0.36, 0.42, '#ffffff'); for (const u of [-0.22, 0.22]) for (const v of [-0.52, 0.52]) b.box(u, 0, v, 0.12, 0.7, 0.12, '#3a2c20') })
  ]
  const TINT = [['#e8e0d0', '#c9843a', '#3a3a3a', '#a85a30'], ['#6e4a2c', '#3a3028', '#b8a888'], ['#e6e0d2', '#d8d2c4', '#c9c2b2'], ['#7a5a3c', '#d8cdbc', '#3a3028']]
  const bm = GEO.map((g, t) => inst(g, beasts.filter((b) => b.type === t).length, t > 1))
  const byType = GEO.map((_, t) => beasts.filter((b) => b.type === t))
  byType.forEach((list, t) => list.forEach((_, i) => bm[t].setColorAt(i, col.set(pick(TINT[t])))))

  // факелы караула ночью
  const torchGeo = new THREE.BufferGeometry()
  const torchPos = new Float32Array(guards.length * 3)
  torchGeo.setAttribute('position', new THREE.BufferAttribute(torchPos, 3))
  const torchMat = new THREE.PointsMaterial({ map: o.dot, color: '#ffa04a', size: 3.4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  const torchPts = new THREE.Points(torchGeo, torchMat)
  torchPts.frustumCulled = false
  scene.add(torchPts)
  disposable.push(torchGeo, torchMat)

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Pos = new THREE.Vector3(), Sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), RX = new THREE.Vector3(1, 0, 0), L = new THREE.Vector3()
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  const ID = new THREE.Quaternion()
  const groundY = (x: number, z: number): number => heightAt(x, z)

  const hideProxy = (i: number, p: Person): void => {
    torso.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); hair.setMatrixAt(i, ZERO)
    const si = skirtIdx.get(p), li = longIdx.get(p), gi = gearIdx.get(p), l2 = leg2.get(p)
    if (si !== undefined) skirt.setMatrixAt(si, ZERO)
    if (li !== undefined) longM.setMatrixAt(li, ZERO)
    if (l2 !== undefined) { legs.setMatrixAt(l2, ZERO); legs.setMatrixAt(l2 + 1, ZERO) }
    if (gi !== undefined) gear.setMatrixAt(gi, ZERO)
    for (const [m, s] of p.slots) featMeshes.get(featList[m])!.setMatrixAt(s, ZERO)
  }
  const index = new Map(people.map((p, i) => [p, i]))
  let nightNow = 0

  const tick = (dt: number, t: number, night: number, focus: THREE.Vector3, boost: number): void => {
    focusNow.copy(focus)
    nightNow = night
    // сверху фигуры лишь чуть крупнее настоящих, чтобы не вырастали выше домов; заметными издали их делают круги режима «Расы»
    const body = 1 + (boost - 1) * 0.1
    // жители стягиваются туда, куда смотрят: дальних незаметно переселяем ближе, и улицы вокруг камеры не пустеют
    nearR = Math.min(o.radius * 1.4, 70 + 16 * boost * boost + (boost > 1 ? 60 : 0))
    for (let c = 0; c < 14 && people.length; c++) {
      const i = Math.floor(R() * people.length), p = people[i]
      if ((!p.path && !p.wander) || i % 6 === 0) continue
      if (Math.hypot(p.x - focus.x, p.z - focus.z) < nearR * 1.8) continue
      if (p.wander) {
        const d = nearDoor()
        p.x = d[0]; p.z = d[1]; p.rest = 0
        continue
      }
      nextTrip(p, true)
      if (p.path) {
        p.seg = Math.floor(R() * Math.max(0, p.path.length / 2 - 1)) * 2
        p.x = p.path[p.seg]
        p.z = p.path[p.seg + 1]
        p.inside = false
        p.rest = 0
      }
    }
    const out = night > 0.55
    for (let i = 0; i < people.length; i++) {
      const p = people[i]
      let moving = false
      // ночью по домам: остаётся примерно четверть прохожих, торговцы закрываются; вампиры, наоборот, выходят только ночью
      const hiddenByNight = p.race.id === 'vampires' ? !out : out && ((p.kind === K.Vendor) || (p.kind !== K.Guard && i % 4 !== 0))
      if (p.rest > 0) p.rest -= dt
      else if (p.wander) {
        const st = p.speed * dt, ax = Math.sin(p.a), az = Math.cos(p.a)
        if (gridAt(p.x + ax * 1.6, p.z + az * 1.6) !== 0 || groundY(p.x + ax * 1.6, p.z + az * 1.6) < 0.2) {
          p.a += 0.8 + R() * 2.4
          if (R() < 0.08) p.rest = 1 + R() * 5
        } else {
          p.x += ax * st; p.z += az * st
          p.ph += dt * 7.5 * p.speed
          moving = true
          if (R() < dt * 0.25) p.a += (R() - 0.5) * 1.6
          if (R() < dt * 0.04) p.rest = 2 + R() * 7
        }
      } else if (p.path) {
        let left = p.speed * dt
        while (left > 0 && p.path) {
          const nx = p.path[p.seg + 2], nz = p.path[p.seg + 3]
          if (nx === undefined) {
            // пришёл: зашёл в дом или постоял на площади
            p.inside = p.kind !== K.Guard && R() < 0.6
            p.rest = p.inside ? 3 + R() * 18 : 2 + R() * 8
            const keep = p.path
            nextTrip(p, p.inside)
            if (!p.path) p.path = keep
            break
          }
          const dx = nx - p.x, dz = nz - p.z, l = Math.hypot(dx, dz)
          if (l <= left || l < 1e-3) {
            p.x = nx; p.z = nz; p.seg += 2; left -= l
          } else {
            p.x += (dx / l) * left; p.z += (dz / l) * left; left = 0
            let da = Math.atan2(dx, dz) - p.a
            while (da > Math.PI) da -= 6.283
            while (da < -Math.PI) da += 6.283
            p.a += da * Math.min(1, dt * 6)
            moving = true
          }
        }
        if (moving) { p.ph += dt * 7.5 * p.speed; p.inside = false }
      }
      const gone = hiddenByNight || (p.inside && p.rest > 0)
      p.shown = !gone
      const si = skirtIdx.get(p), li = longIdx.get(p), gi = gearIdx.get(p), l2 = leg2.get(p)
      if (gone) {
        torso.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); hair.setMatrixAt(i, ZERO); discs.setMatrixAt(i, ZERO)
        if (si !== undefined) skirt.setMatrixAt(si, ZERO)
        if (li !== undefined) longM.setMatrixAt(li, ZERO)
        if (l2 !== undefined) { legs.setMatrixAt(l2, ZERO); legs.setMatrixAt(l2 + 1, ZERO) }
        if (gi !== undefined) { gear.setMatrixAt(gi, ZERO); torchPos[gi * 3 + 1] = -99 }
        for (const [m, s] of p.slots) featMeshes.get(featList[m])!.setMatrixAt(s, ZERO)
        continue
      }
      // шаг в сторону от оси улицы, чтобы не ходили гуськом
      const sa = p.a + 1.5708
      const x = p.x + (p.path ? Math.sin(sa) * p.side : 0), z = p.z + (p.path ? Math.cos(sa) * p.side : 0)
      const y = groundY(x, z) + (moving ? Math.abs(Math.sin(p.ph)) * 0.04 : 0)
      p.y = y
      p.dx = x
      p.dz = z
      p.moving = moving
      Q.setFromAxisAngle(UP, p.a)
      const sh = p.scale * p.race.h * body, sw = p.scale * p.race.w * body
      Sc.set(sw, sh, sw)
      Pos.set(x, y, z)
      M.compose(Pos, Q, Sc)
      torso.setMatrixAt(i, M); head.setMatrixAt(i, M); hair.setMatrixAt(i, M)
      if (si !== undefined) skirt.setMatrixAt(si, M)
      if (li !== undefined) longM.setMatrixAt(li, M)
      for (const [m, s] of p.slots) featMeshes.get(featList[m])!.setMatrixAt(s, M)
      if (gi !== undefined) {
        gear.setMatrixAt(gi, M)
        torchPos[gi * 3] = x + Math.cos(p.a) * 0.4 * sw
        torchPos[gi * 3 + 1] = y + 1.9 * sh
        torchPos[gi * 3 + 2] = z - Math.sin(p.a) * 0.4 * sw
      }
      if (l2 !== undefined) {
        const swing = moving ? Math.sin(p.ph) * 0.55 : 0
        for (const sd of [-1, 1]) {
          Q2.setFromAxisAngle(RX, swing * sd)
          Q2.premultiply(Q)
          L.set(sd * 0.11 * sw, 0.82 * sh, 0).applyQuaternion(Q).add(Pos)
          M.compose(L, Q2, Sc)
          legs.setMatrixAt(l2 + (sd > 0 ? 1 : 0), M)
        }
      }
      if (discs.visible) {
        const dk = Math.max(boost, 1.2) * Math.max(0.8, p.race.w)
        Sc.set(dk, 1, dk)
        Pos.set(x, y + 0.12, z)
        M.compose(Pos, ID, Sc)
        discs.setMatrixAt(i, M)
      }
    }
    // подробные модели: только когда камера низко, для ближайших к ней видимых жителей
    nearCheck -= dt
    if (nearCheck <= 0) {
      nearCheck = 0.25
      near = boost < 2.2
        ? people.filter((p) => p.shown && p.look && (p.dx - focus.x) ** 2 + (p.dz - focus.z) ** 2 < 45 * 45).sort((a, b) => (a.dx - focus.x) ** 2 + (a.dz - focus.z) ** 2 - ((b.dx - focus.x) ** 2 + (b.dz - focus.z) ** 2)).slice(0, DETAIL)
        : []
    }
    const live = near.filter((p) => p.shown)
    for (const p of live) hideProxy(index.get(p)!, p)
    detailed.show(live.map((p) => ({ key: p, look: p.look!, x: p.dx, y: groundY(p.dx, p.dz), z: p.dz, a: p.a, scale: p.scale, moving: p.moving, ph: p.ph })), t)
    if (discs.visible) discs.instanceMatrix.needsUpdate = true
    longM.instanceMatrix.needsUpdate = true
    for (const m of featMeshes.values()) m.instanceMatrix.needsUpdate = true
    for (const m of [torso, head, hair, skirt, legs, gear]) m.instanceMatrix.needsUpdate = true
    torchMat.opacity = night * 0.85
    torchGeo.attributes.position.needsUpdate = true

    carts.forEach((c, i) => {
      let left = 1.5 * dt
      while (left > 0) {
        const n = c.seg + c.dir * 2
        if (n < 0 || n + 1 >= c.path.length) { c.dir *= -1; break }
        const nx = c.path[n], nz = c.path[n + 1], dx = nx - c.x, dz = nz - c.z, l = Math.hypot(dx, dz)
        if (l <= left || l < 1e-3) { c.x = nx; c.z = nz; c.seg = n; left -= l } else {
          c.x += (dx / l) * left; c.z += (dz / l) * left; left = 0
          let da = Math.atan2(dx, dz) - c.a
          while (da > Math.PI) da -= 6.283
          while (da < -Math.PI) da += 6.283
          c.a += da * Math.min(1, dt * 2.2)
        }
      }
      Q.setFromAxisAngle(UP, c.a)
      Pos.set(c.x, groundY(c.x, c.z), c.z)
      Sc.setScalar(body)
      M.compose(Pos, Q, Sc)
      cartM.setMatrixAt(i, M)
    })
    cartM.instanceMatrix.needsUpdate = true

    byType.forEach((list, t) => {
      list.forEach((b, i) => {
        if (b.rest > 0) b.rest -= dt
        else {
          const step = (t === 0 ? 0.5 : t === 1 ? 1.5 : 0.28) * dt
          const nx = b.x + Math.sin(b.a) * step, nz = b.z + Math.cos(b.a) * step
          const far = Math.hypot(nx - b.home[0], nz - b.home[1]) > (t > 1 ? 22 : 9)
          if (far || gridAt(nx + Math.sin(b.a) * 0.6, nz + Math.cos(b.a) * 0.6) !== 0) b.a += 1 + R() * 2.5
          else { b.x = nx; b.z = nz }
          if (R() < dt * 0.5) { b.rest = 1 + R() * (t > 1 ? 14 : 5); b.a += (R() - 0.5) * 2.5 }
        }
        Q.setFromAxisAngle(UP, b.a)
        Pos.set(b.x, groundY(b.x, b.z), b.z)
        Sc.setScalar(body)
        M.compose(Pos, Q, Sc)
        bm[t].setMatrixAt(i, out && t < 2 ? ZERO : M)
      })
      bm[t].instanceMatrix.needsUpdate = true
    })
  }

  // первая расстановка, чтобы не мелькало в нуле
  tick(0.001, 0, 0, focusNow, 1)

  const census = o.population.map((q) => ({ race: q.race, count: people.filter((p) => p.race === q.race).length })).filter((q) => q.count > 0).sort((a, b) => b.count - a.count)
  const ROLE: Record<number, string> = { [K.Man]: 'горожанин', [K.Woman]: 'горожанка', [K.Child]: 'ребёнок', [K.Guard]: 'стражник', [K.Vendor]: 'торговец' }
  const SROLE: Record<number, Role> = { [K.Man]: 'man', [K.Woman]: 'woman', [K.Child]: 'child', [K.Guard]: 'guard', [K.Vendor]: 'vendor' }
  // реплики: у каждого жителя своя (по номеру), меняются со временем суток; свой генератор — не трогает случайность города
  const cool = new Map<Person, number>()
  const said = new Map<Person, { text: string; dusk: boolean }>()
  const sayOf = (p: Person, fresh: boolean): string => {
    const dusk = nightNow > 0.35
    const had = said.get(p)
    if (had && had.dusk === dusk && !fresh) return had.text
    let s = ((index.get(p) ?? 0) * 2654435761 + (fresh ? Math.floor(Math.random() * 1e6) : 0)) >>> 0
    const rnd = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
    const text = phrase({ style: o.style, culture: o.culture ?? '', state: o.state ?? '', gov: o.gov ?? '', role: SROLE[p.kind] ?? 'man', night: nightNow, rnd })
    said.set(p, { text, dusk })
    return text
  }

  return {
    tick,
    census,
    setMarks: (on) => { discs.visible = on },
    pick: (ro, rd, maxT) => {
      let best: Person | null = null, bt = maxT
      for (let i = 0; i < people.length; i++) {
        const p = people[i]
        if (!p.shown) continue
        torso.getMatrixAt(i, M)
        Sc.setFromMatrixScale(M)
        // подробная модель рядом с камерой: её фигурка спрятана, рост берём у самого жителя
        const h = (Sc.y || p.scale * p.race.h) * 1.7, cx = p.dx, cy = p.y + h / 2, cz = p.dz
        const dx = cx - ro.x, dy = cy - ro.y, dz = cz - ro.z
        const t = dx * rd.x + dy * rd.y + dz * rd.z
        if (t < 0 || t > bt) continue
        const px = ro.x + rd.x * t - cx, py = ro.y + rd.y * t - cy, pz = ro.z + rd.z * t - cz
        const tol = Math.max(0.55, h * 0.55)
        if (px * px + py * py + pz * pz < tol * tol) { bt = t; best = p }
      }
      return best ? { race: best.race, role: ROLE[best.kind], say: sayOf(best, true) } : null
    },
    speak: (ro, rd, range, t) => {
      let best: Person | null = null, bd = range
      for (let i = 0; i < people.length; i++) {
        const p = people[i]
        if (!p.shown) continue
        const dx = p.dx - ro.x, dz = p.dz - ro.z, d = Math.hypot(dx, dz)
        if (d > bd || d < 0.01) continue
        if ((dx * rd.x + dz * rd.z) / (d * Math.hypot(rd.x, rd.z) || 1) < 0.55) continue
        if ((cool.get(p) ?? -99) > t) continue
        bd = d; best = p
      }
      if (!best) return null
      cool.set(best, t + 30)
      const h = best.scale * best.race.h * 1.7
      return { id: index.get(best) ?? 0, text: sayOf(best, true), x: best.dx, y: best.y + h + 0.12, z: best.dz }
    },
    dispose: () => {
      detailed.dispose()
      meshes.forEach((m) => m.dispose())
      disposable.forEach((d) => d.dispose())
    }
  }
}
