import { resolve } from './temporal'
import type { AdminRegion, Province, WorldData, WorldDate } from './types'
import type { MapMode } from './store'

export const CULTURE_INFO: Record<string, { name: string; color: string }> = {
  imperial: { name: 'Имперцы (гладры)', color: '#b5473a' },
  church: { name: 'Имперцы Святого архипелага', color: '#e8e1c8' },
  romance: { name: 'Южане', color: '#d08a3c' },
  kaltrans: { name: 'Кальтранцы', color: '#7a8f3a' },
  nordic: { name: 'Норды', color: '#4f7fa8' },
  dwarven: { name: 'Дварфы и гномы', color: '#8c8a96' },
  eluin: { name: 'Элуины', color: '#e0c45c' },
  eleon: { name: 'Элеоны', color: '#c9b13b' },
  elven: { name: 'Эльфы', color: '#3f8f4f' },
  yut: { name: 'Юты', color: '#c76b9b' },
  desert: { name: 'Нарги и дукулиты', color: '#c9a25a' },
  zlatay: { name: 'Златайцы', color: '#e3b52e' },
  orcish: { name: 'Орки и кланы юга', color: '#6f8f3f' },
  cin: { name: 'Цинь', color: '#a64f8f' },
  dark: { name: 'Земли Тьмы', color: '#4a3a5a' }
}
export const TERRAIN_INFO = [
  { name: 'Море', color: '#16303f' },
  { name: 'Равнины', color: '#a3b35c' },
  { name: 'Леса', color: '#2f6b35' },
  { name: 'Холмы', color: '#9a8458' },
  { name: 'Горы', color: '#7a746e' },
  { name: 'Снега', color: '#e8ecf0' },
  { name: 'Пустыня', color: '#d9b56a' }
]
const RELIGION_COLOR: Record<string, string> = {
  'lore-house-light': '#e6c25a',
  'lore-house-dark': '#5a2a7a',
  'lore-house-chaos': '#a8322f',
  'lore-house-freedom': '#4f9a8a'
}
export const MAP_MODES: { value: MapMode; label: string }[] = [
  { value: 'political', label: 'Политическая' },
  { value: 'provinces', label: 'Провинции' },
  { value: 'areas', label: 'Области' },
  { value: 'regions', label: 'Регионы' },
  { value: 'continents', label: 'Континенты' },
  { value: 'cultures', label: 'Культуры' },
  { value: 'religions', label: 'Религии' },
  { value: 'terrain', label: 'Местность' }
]

/** Владелец провинции на дату */
export function ownerAt(p: Province, date: WorldDate): string | null {
  let o: string | null = null
  for (const [d, s] of p.owners) {
    if (d === null || d <= date) o = s
    else break
  }
  return o
}

/** Последняя смена владельца не позже даты: когда и у кого провинция была до неё (для плавной смены и фронтов) */
export function lastChange(p: Province, date: WorldDate): { at: WorldDate | null; prev: string | null } {
  let at: WorldDate | null = null
  let prev: string | null = null
  let cur: string | null = null
  for (const [d, s] of p.owners) {
    if (d !== null && d > date) break
    if (d !== null && s !== cur) {
      at = d
      prev = cur
    }
    cur = s
  }
  return { at, prev }
}

// ---------- растр провинций (номер под каждым пикселем) ----------
export interface ProvinceRaster {
  width: number
  height: number
  ids: Uint16Array
  image: HTMLImageElement
}
const rasterCache = new Map<string, Promise<ProvinceRaster>>()
export function loadRaster(url: string): Promise<ProvinceRaster> {
  let p = rasterCache.get(url)
  if (!p) {
    p = (async () => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height).data
      const ids = new Uint16Array(c.width * c.height)
      for (let i = 0; i < ids.length; i++) ids[i] = data[i * 4 + 3] ? (data[i * 4] << 8) | data[i * 4 + 1] : 0
      return { width: c.width, height: c.height, ids, image: img }
    })()
    rasterCache.set(url, p)
  }
  return p
}

/** Номер провинции в логической точке карты */
export function provinceAt(r: ProvinceRaster, mapW: number, mapH: number, x: number, y: number): number {
  const rx = Math.floor((x / mapW) * r.width)
  const ry = Math.floor((y / mapH) * r.height)
  if (rx < 0 || ry < 0 || rx >= r.width || ry >= r.height) return 0
  return r.ids[ry * r.width + rx]
}

// ---------- таблица цветов для шейдера ----------
function hex(c: string): [number, number, number] {
  const n = parseInt(c.replace('#', '').slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function hashColor(s: string): [number, number, number] {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h >>>= 0
  const hue = h % 360
  const sat = 0.35 + ((h >>> 9) % 30) / 100
  const lig = 0.42 + ((h >>> 17) % 22) / 100
  const k = (n: number): number => (n + hue / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number): number => Math.round(255 * (lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return [f(0), f(8), f(4)]
}

export interface LutInput {
  world: WorldData
  date: WorldDate
  mode: MapMode
  selectedProvince: number | null
  selectedState: string | null
  hoverKey: string | null
}

/** Строк в таблице цветов провинций */
export const LUT_ROWS = 5
/** Смена владельца давнее этого (в днях) таблице не нужна */
const NO_CHANGE = -32767

/**
 * Таблица шириной (число провинций + 1), пять строк:
 * 0 — цвет заливки и её сила, 1 — ключ группы (страна/область/культура…) для границ + флаги подсветки,
 * 2 — ключ владельца (для толстых границ стран во всех режимах),
 * 3 — цвет прежнего владельца, 4 — дней от даты таблицы до последней смены владельца (int16) и ключ группы прежнего
 * владельца: по ним шейдер плавно перекрашивает захваченные провинции и рисует линии фронта.
 */
export function buildLut(inp: LutInput, owners: (string | null)[]): { data: Uint8Array; width: number; keys: (string | null)[] } {
  const { world, date, mode } = inp
  const provs = world.provinces ?? []
  const width = provs.length + 1
  const data = new Uint8Array(width * LUT_ROWS * 4)
  // смена владельца видна в политическом режиме и в режиме религий; в остальных (культуры, местность…) её нет
  const changes = mode === 'political' || mode === 'religions'
  const keyIds = new Map<string, number>()
  const keyNum = (k: string | null): number => {
    if (k === null) return 0
    let n = keyIds.get(k)
    if (n === undefined) {
      n = keyIds.size + 1
      keyIds.set(k, n)
    }
    return n
  }
  const stateColor = new Map<string, [number, number, number]>()
  const stateRel = new Map<string, string>()
  for (const s of world.states) {
    const f = resolve(s, date)
    stateColor.set(s.id, hex(f.color))
    stateRel.set(s.id, f.religionId)
  }
  const admin = new Map<string, AdminRegion>((world.adminRegions ?? []).map((a) => [a.id, a]))
  const keys: (string | null)[] = new Array(width).fill(null)
  for (let i = 0; i < provs.length; i++) {
    const p = provs[i]
    const id = p.id
    const owner = owners[id]
    let key: string | null
    let color: [number, number, number]
    let alpha = 255
    const area = admin.get(p.areaId)
    const region = area ? admin.get(area.parentId ?? '') : undefined
    const continent = region ? admin.get(region.parentId ?? '') : undefined
    switch (mode) {
      case 'provinces':
        key = `p${id}`
        color = hashColor(key)
        break
      case 'areas':
        key = p.areaId
        color = hashColor(key)
        break
      case 'regions':
        key = region?.id ?? null
        color = hashColor(key ?? 'none')
        break
      case 'continents':
        key = continent?.id ?? null
        color = hashColor((key ?? 'none') + 'c')
        break
      case 'cultures':
        key = p.culture
        color = hex(CULTURE_INFO[p.culture]?.color ?? '#888888')
        break
      case 'terrain':
        key = `t${p.terrain}`
        color = hex(TERRAIN_INFO[p.terrain]?.color ?? '#888888')
        break
      case 'religions': {
        const rel = owner ? stateRel.get(owner) ?? '' : ''
        key = rel || 'none'
        color = hex(RELIGION_COLOR[rel] ?? '#77736a')
        if (!rel) alpha = 110
        break
      }
      default:
        key = owner
        color = owner ? stateColor.get(owner) ?? [110, 110, 110] : [110, 110, 110]
        if (!owner) alpha = 60
    }
    keys[id] = key
    const o = id * 4
    data[o] = color[0]
    data[o + 1] = color[1]
    data[o + 2] = color[2]
    data[o + 3] = alpha
    const k = keyNum(key)
    const r1 = (width + id) * 4
    data[r1] = k & 255
    data[r1 + 1] = (k >> 8) & 255
    const selected = id === inp.selectedProvince || (owner !== null && owner === inp.selectedState)
    const hovered = key !== null && key === inp.hoverKey
    data[r1 + 2] = selected ? 255 : 0
    data[r1 + 3] = hovered ? 255 : 0
    const ok = keyNum(owner ? `o:${owner}` : null)
    const r2 = (width * 2 + id) * 4
    data[r2] = ok & 255
    data[r2 + 1] = (ok >> 8) & 255
    const ch = changes ? lastChange(p, date) : null
    const prevKey = ch?.at != null ? (mode === 'religions' ? (ch.prev ? stateRel.get(ch.prev) || 'none' : 'none') : ch.prev) : null
    const prevColor: [number, number, number] =
      mode === 'religions' ? hex(RELIGION_COLOR[ch?.prev ? stateRel.get(ch.prev) ?? '' : ''] ?? '#77736a') : ch?.prev ? stateColor.get(ch.prev) ?? [110, 110, 110] : [110, 110, 110]
    const r3 = (width * 3 + id) * 4
    data[r3] = prevColor[0]
    data[r3 + 1] = prevColor[1]
    data[r3 + 2] = prevColor[2]
    data[r3 + 3] = ch?.prev ? 255 : 60
    const delta = ch?.at != null ? Math.max(NO_CHANGE, Math.round(ch.at - date)) : NO_CHANGE
    const r4 = (width * 4 + id) * 4
    const u = delta & 0xffff
    data[r4] = u & 255
    data[r4 + 1] = (u >> 8) & 255
    const pk = prevKey !== null ? keyNum(prevKey) : 0
    data[r4 + 2] = pk & 255
    data[r4 + 3] = (pk >> 8) & 255
  }
  return { data, width, keys }
}

// ---------- подписи стран по провинциям ----------
export interface StateLabelSpot {
  stateId: string
  x: number
  y: number
  angle: number
  size: number
}

/** Для каждой страны: крупнейшая связная часть, точка «глубже всего внутри», наклон по главной оси */
export function computeStateLabels(provs: Province[], owners: (string | null)[]): StateLabelSpot[] {
  const byId = new Map(provs.map((p) => [p.id, p]))
  const seen = new Set<number>()
  const best = new Map<string, { list: Province[]; px: number }>()
  for (const p of provs) {
    const o = owners[p.id]
    if (!o || seen.has(p.id)) continue
    const comp: Province[] = []
    const stack = [p]
    seen.add(p.id)
    let px = 0
    while (stack.length) {
      const q = stack.pop()!
      comp.push(q)
      px += q.px
      for (const n of q.neighbors) {
        if (seen.has(n) || owners[n] !== o) continue
        seen.add(n)
        stack.push(byId.get(n)!)
      }
    }
    const cur = best.get(o)
    if (!cur || px > cur.px) best.set(o, { list: comp, px })
  }
  const out: StateLabelSpot[] = []
  for (const [stateId, { list }] of best) {
    // глубина: шаги от края территории (провинция у чужих или у моря — край)
    const inSet = new Set(list.map((p) => p.id))
    const depth = new Map<number, number>()
    let frontier = list.filter((p) => p.neighbors.length < 4 || p.neighbors.some((n) => !inSet.has(n)))
    if (!frontier.length) frontier = [list[0]]
    frontier.forEach((p) => depth.set(p.id, 0))
    for (let d = 0; frontier.length; d++) {
      const next: Province[] = []
      for (const p of frontier)
        for (const n of p.neighbors)
          if (inSet.has(n) && !depth.has(n)) {
            depth.set(n, d + 1)
            next.push(byId.get(n)!)
          }
      frontier = next
    }
    let w = 0, cx = 0, cy = 0
    for (const p of list) { w += p.px; cx += p.x * p.px; cy += p.y * p.px }
    cx /= w
    cy /= w
    let sxx = 0, syy = 0, sxy = 0
    for (const p of list) {
      const dx = p.x - cx, dy = p.y - cy
      sxx += dx * dx * p.px; syy += dy * dy * p.px; sxy += dx * dy * p.px
    }
    sxx /= w; syy /= w; sxy /= w
    let angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const l1 = (sxx + syy) / 2 + Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy)
    const l2 = (sxx + syy) / 2 - Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy)
    const elong = Math.sqrt(l1 / Math.max(l2, 1))
    if (elong < 1.35) angle = 0
    if (angle > Math.PI / 2) angle -= Math.PI
    if (angle < -Math.PI / 2) angle += Math.PI
    angle = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, angle))
    const maxDepth = Math.max(...list.map((p) => depth.get(p.id) ?? 0))
    const deep = list.filter((p) => (depth.get(p.id) ?? 0) >= maxDepth - 1)
    const anchor = deep.reduce((a, b) => (Math.hypot(a.x - cx, a.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? a : b))
    // размер букв — от протяжённости вдоль оси и ширины поперёк
    const ca = Math.cos(angle), sa = Math.sin(angle)
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
    for (const p of list) {
      const a = (p.x - cx) * ca + (p.y - cy) * sa
      const b = -(p.x - cx) * sa + (p.y - cy) * ca
      minA = Math.min(minA, a); maxA = Math.max(maxA, a); minB = Math.min(minB, b); maxB = Math.max(maxB, b)
    }
    const len = maxA - minA + 60
    const wid = maxB - minB + 60
    out.push({ stateId, x: (anchor.x + cx) / 2, y: (anchor.y + cy) / 2, angle: (angle * 180) / Math.PI, size: Math.min(len, wid * 2.2) })
  }
  return out
}
