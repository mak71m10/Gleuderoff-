import polylabel from 'polylabel'
import { uid } from './store'
import type { Entry, EntryKind, Place, PlaceType, StateFields, WorldState } from './types'

export function newStateFields(name = 'Новое государство', color = '#8a5a3c'): StateFields {
  return {
    name,
    fullName: '',
    color,
    flag: '',
    motto: '',
    ruler: '',
    rulerTitle: '',
    rulerId: '',
    government: '',
    ideology: '',
    religion: '',
    religionId: '',
    capitalId: '',
    population: '',
    army: '',
    navy: '',
    economy: '',
    treasury: '',
    laws: '',
    culture: '',
    languages: '',
    stability: 50,
    description: '',
    dynastyId: '',
    overlordId: '',
    diplomacy: '',
    customFields: []
  }
}

export function newState(name?: string, color?: string): WorldState {
  return { id: uid(), base: newStateFields(name, color), history: [], factions: [], from: null, to: null }
}

export function newPlace(mapId: string, x: number, y: number, type: PlaceType): Place {
  return {
    id: uid(),
    mapId,
    x,
    y,
    base: { name: 'Новое место', type, stateId: '', population: '', ruler: '', description: '', image: '' },
    history: [],
    from: null,
    to: null
  }
}

export function newEntry(kind: EntryKind, name = 'Без имени'): Entry {
  return {
    id: uid(),
    kind,
    base: { name, title: '', image: '', summary: '', body: '', tags: [], props: {}, links: {} },
    history: [],
    from: null,
    to: null
  }
}

/** Случайный приятный цвет для нового государства */
export function randomColor(): string {
  const h = Math.floor(Math.random() * 360)
  const s = 45 + Math.random() * 25
  const l = 38 + Math.random() * 14
  const a = (s * Math.min(l, 100 - l)) / 10000
  const f = (n: number): string => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function ringArea(ring: [number, number][]): number {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  return Math.abs(a / 2)
}

const labelCache = new Map<[number, number][], [number, number]>()

/** Точка внутри многоугольника, наиболее удалённая от краёв — для подписи */
export function labelPoint(ring: [number, number][]): [number, number] {
  const cached = labelCache.get(ring)
  if (cached) return cached
  const p = polylabel([ring], 4) as unknown as [number, number]
  labelCache.set(ring, p)
  return p
}
