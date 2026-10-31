import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import { nanoid } from 'nanoid'
import type { EntryKind, PlaceType, Temporal, WorldData, WorldDate } from './types'

export type View = 'map' | 'states' | EntryKind | 'timeline' | 'settings'

export type Selection =
  | { type: 'state'; id: string }
  | { type: 'place'; id: string }
  | { type: 'region'; id: string }
  | { type: 'entry'; id: string }
  | { type: 'label'; id: string }
  | { type: 'province'; id: number }
  | null

export type Tool =
  | { kind: 'select' }
  | { kind: 'place'; placeType: PlaceType }
  | { kind: 'draw' }
  | { kind: 'paint'; stateId: string | null }
  | { kind: 'label' }

export interface Layers {
  base: boolean
  political: boolean
  borders: boolean
  stateLabels: boolean
  geoLabels: boolean
  armies: boolean
  models: boolean
  cities: boolean
  settlements: boolean
  poi: boolean
  reference: boolean
  referenceOpacity: number
  politicalOpacity: number
}

export type MapMode = 'political' | 'provinces' | 'areas' | 'regions' | 'continents' | 'cultures' | 'terrain' | 'religions'

/** 'base' — правка «всегда», 'dated' — изменение с текущей даты */
export type EditMode = 'base' | 'dated'

interface Store {
  world: WorldData | null
  worldDir: string
  date: WorldDate
  view: View
  mapId: string
  selection: Selection
  stateCardOpen: string | null
  tool: Tool
  layers: Layers
  editMode: EditMode
  /** Режим правки вершин выбранного участка */
  vertexEdit: boolean
  /** Режим мастера: показывать тайное знание */
  masterMode: boolean
  mapMode: MapMode
  saveState: 'saved' | 'dirty' | 'saving' | 'error'
  past: WorldData[]
  future: WorldData[]

  load: () => Promise<void>
  mutate: (fn: (w: Draft<WorldData>) => void, opts?: { skipHistory?: boolean }) => void
  undo: () => void
  redo: () => void
  setDate: (d: WorldDate) => void
  setView: (v: View) => void
  openMap: (id: string) => void
  select: (s: Selection) => void
  openStateCard: (id: string | null) => void
  setTool: (t: Tool) => void
  setLayer: <K extends keyof Layers>(k: K, v: Layers[K]) => void
  setEditMode: (m: EditMode) => void
  setVertexEdit: (v: boolean) => void
  setMasterMode: (v: boolean) => void
  setMapMode: (m: MapMode) => void
}

export const uid = (): string => nanoid(10)

const LAYERS_KEY = 'gleuderoff.layers'
const defaultLayers: Layers = {
  base: true,
  political: true,
  borders: true,
  stateLabels: true,
  geoLabels: true,
  armies: true,
  models: true,
  cities: true,
  settlements: true,
  poi: true,
  reference: false,
  referenceOpacity: 0.5,
  politicalOpacity: 0.32
}

function loadLayers(): Layers {
  try {
    return { ...defaultLayers, ...JSON.parse(localStorage.getItem(LAYERS_KEY) || '{}') }
  } catch {
    return defaultLayers
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<Store>((set, get) => {
  const scheduleSave = (): void => {
    clearTimeout(saveTimer)
    set({ saveState: 'dirty' })
    saveTimer = setTimeout(async () => {
      const w = get().world
      if (!w) return
      set({ saveState: 'saving' })
      try {
        await window.api.saveWorld(w)
        if (get().world === w) set({ saveState: 'saved' })
      } catch (e) {
        console.error(e)
        set({ saveState: 'error' })
      }
    }, 700)
  }

  return {
    world: null,
    worldDir: '',
    date: 0,
    view: 'map',
    mapId: '',
    selection: null,
    stateCardOpen: null,
    tool: { kind: 'select' },
    layers: loadLayers(),
    editMode: 'base',
    vertexEdit: false,
    mapMode: 'political',
    masterMode: (() => {
      try {
        return localStorage.getItem('gleuderoff.master') !== '0'
      } catch {
        return true
      }
    })(),
    saveState: 'saved',
    past: [],
    future: [],

    load: async () => {
      const { dir, data } = await window.api.loadWorld()
      const world = data as WorldData
      const worldMap = world.maps.find((m) => m.kind === 'world') ?? world.maps[0]
      set({ world, worldDir: dir, date: world.calendar.present, mapId: worldMap?.id ?? '' })
    },

    mutate: (fn, opts) => {
      const prev = get().world
      if (!prev || !get().masterMode) return
      const next = produce(prev, fn)
      if (next === prev) return
      set({
        world: next,
        past: opts?.skipHistory ? get().past : [...get().past.slice(-99), prev],
        future: opts?.skipHistory ? get().future : []
      })
      scheduleSave()
    },

    undo: () => {
      const { past, world, future } = get()
      if (!past.length || !world || !get().masterMode) return
      set({ world: past[past.length - 1], past: past.slice(0, -1), future: [world, ...future] })
      scheduleSave()
    },

    redo: () => {
      const { past, world, future } = get()
      if (!future.length || !world || !get().masterMode) return
      set({ world: future[0], future: future.slice(1), past: [...past, world] })
      scheduleSave()
    },

    setDate: (date) => set({ date }),
    setView: (view) => set({ view }),
    openMap: (mapId) => set({ mapId, view: 'map', selection: null }),
    select: (selection) => set({ selection, vertexEdit: false }),
    openStateCard: (stateCardOpen) => set({ stateCardOpen }),
    setTool: (tool) => set({ tool }),
    setLayer: (k, v) => {
      const layers = { ...get().layers, [k]: v }
      localStorage.setItem(LAYERS_KEY, JSON.stringify(layers))
      set({ layers })
    },
    setEditMode: (editMode) => set({ editMode }),
    setVertexEdit: (vertexEdit) => set({ vertexEdit }),
    setMapMode: (mapMode) => set({ mapMode }),
    setMasterMode: (masterMode) => {
      try {
        localStorage.setItem('gleuderoff.master', masterMode ? '1' : '0')
      } catch {
        /* без сохранения */
      }
      set({ masterMode })
    }
  }
})

/** Применяет правку к сущности с историей: к базе или как изменение с даты. */
export function applyTemporal<T>(t: Draft<Temporal<T>>, patch: Partial<T>, date: WorldDate, mode: EditMode): void {
  if (mode === 'base') {
    Object.assign(t.base as object, patch)
    return
  }
  const existing = t.history.find((c) => c.date === date)
  if (existing) Object.assign(existing.patch as object, patch)
  else t.history.push({ id: uid(), date, patch } as Draft<Temporal<T>>['history'][number])
}

/** Удобный хук: id → сущность из мира */
export const findById = <T extends { id: string }>(list: T[] | undefined, id: string | null | undefined): T | undefined =>
  id ? list?.find((x) => x.id === id) : undefined
