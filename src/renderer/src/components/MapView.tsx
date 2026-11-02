import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { useStore, applyTemporal, uid } from '../store'
import { existsAt, regionOwner, resolve } from '../temporal'
import { PLACE_TYPES } from '../constants'
import { labelPoint, newPlace, ringArea } from '../model'
import { assetUrl } from './ui'
import { GlowRenderer, type GlowOptions } from './glowRenderer'
import { ProvinceRenderer, SettlementRenderer, TextRenderer, type SettlementItem, type TextLabel } from './provinceRenderer'
import { onSpritesReady, SETTLEMENT_SCALE, SPRITE_LOGICAL, type SettlementType } from '../settlements3d'
import { buildLut, computeStateLabels as provinceStateLabels, loadRaster, ownerAt, provinceAt, type ProvinceRaster } from '../provinces'
import type { MapDef, Region, WorldData, WorldDate } from '../types'

type XY = [number, number]
const toLL = ([x, y]: XY): L.LatLng => L.latLng(-y, x)
const fromLL = (ll: L.LatLng): XY => [Math.round(ll.lng * 10) / 10, Math.round(-ll.lat * 10) / 10]
const boundsOf = (m: MapDef): L.LatLngBoundsExpression => [
  [-m.height, 0],
  [0, m.width]
]

const MAX_HANDLES = 1500

/** Какие места автора получают объёмную модель */
const PLACE_MODEL: Partial<Record<string, SettlementType>> = {
  capital: 'capital',
  city: 'city',
  town: 'town',
  village: 'village',
  castle: 'castle',
  port: 'port',
  temple: 'temple',
  tower: 'tower',
  ruins: 'ruins'
}

interface LabelInfo {
  el: HTMLElement
  units: number
}

interface PlaceMarker {
  marker: L.Marker
  minZoom: number
  group: string
  key: string
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Подписи государств: самая крупная часть территории, размер шрифта — от площади. */
function computeStateLabels(world: WorldData, mapId: string, date: WorldDate) {
  const perState = new Map<string, { ring: XY[]; area: number; total: number }>()
  for (const r of world.regions) {
    if (r.mapId !== mapId || !existsAt(r, date)) continue
    const owner = regionOwner(r, date)
    if (!owner) continue
    for (const ring of r.rings) {
      if (ring.length < 3) continue
      const a = ringArea(ring)
      const cur = perState.get(owner)
      if (!cur) perState.set(owner, { ring, area: a, total: a })
      else {
        cur.total += a
        if (a > cur.area) {
          cur.ring = ring
          cur.area = a
        }
      }
    }
  }
  return perState
}

function pointInRing([x, y]: XY, ring: XY[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function insideOwned(world: WorldData, mapId: string, date: WorldDate, stateId: string, pt: XY): boolean {
  return world.regions.some(
    (r) => r.mapId === mapId && existsAt(r, date) && regionOwner(r, date) === stateId && r.rings.some((ring) => pointInRing(pt, ring))
  )
}

export function MapView() {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const g = useRef<{
    base?: L.ImageOverlay
    tiles?: L.TileLayer
    ref?: L.ImageOverlay
    regions: L.LayerGroup
    labels: L.LayerGroup
    geo: L.LayerGroup
    places: L.LayerGroup
    edit: L.LayerGroup
    draw: L.LayerGroup
  } | null>(null)
  const polys = useRef(new Map<string, { poly: L.Polygon; rings: Region['rings'] }>())
  const labelEls = useRef<LabelInfo[]>([])
  const geoEls = useRef<LabelInfo[]>([])
  const placeMarkers = useRef(new Map<string, PlaceMarker>())
  const drawPts = useRef<XY[]>([])
  const [drawCount, setDrawCount] = useState(0)
  const [zoom, setZoom] = useState(0)
  const rasterRef = useRef<ProvinceRaster | null>(null)
  const [rasterTick, setRasterTick] = useState(0)
  const [hoverTick, setHoverTick] = useState(0)

  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mapId = useStore((s) => s.mapId)
  const layers = useStore((s) => s.layers)
  const selection = useStore((s) => s.selection)
  const tool = useStore((s) => s.tool)
  const openMap = useStore((s) => s.openMap)
  const mapDef = world.maps.find((m) => m.id === mapId) ?? world.maps[0]

  // Видимость подписей и меток в зависимости от приближения
  const refreshZoomStyles = (): void => {
    const map = mapRef.current
    if (!map) return
    const z = map.getZoom()
    const scale = Math.pow(2, z)
    const { layers } = useStore.getState()
    for (const l of labelEls.current) {
      // подпись «нарисована» на карте: растёт вместе с ней, мелкие прячем, огромные растворяем
      const px = l.units * scale
      l.el.style.fontSize = `${px}px`
      l.el.style.letterSpacing = `${px * 0.14}px`
      // вблизи названия стран уходят, как у Paradox, — остаются провинции и поселения
      l.el.style.display = px < 7 || px > 130 || !layers.stateLabels ? 'none' : ''
      l.el.style.opacity = String(px < 10 ? 0.6 : px > 70 ? Math.max(0, 0.92 * (1 - (px - 70) / 60)) : 0.92)
    }
    for (const l of geoEls.current) {
      const px = l.units * scale
      l.el.style.fontSize = `${px}px`
      l.el.style.display = px < 6 || px > 140 || !layers.geoLabels ? 'none' : ''
      l.el.style.opacity = String(px > 80 ? Math.max(0, 0.9 * (1 - (px - 80) / 60)) : 0.9)
    }
    for (const pm of placeMarkers.current.values()) {
      const el = pm.marker.getElement()
      if (!el) continue
      const groupOn = layers[pm.group as 'cities' | 'settlements' | 'poi']
      el.style.display = groupOn && z >= pm.minZoom ? '' : 'none'
      el.classList.toggle('pm-compact', z < pm.minZoom + 0.75)
    }
    setZoom(z)
  }

  // --- создание карты ---
  useEffect(() => {
    const map = L.map(divRef.current!, {
      crs: L.CRS.Simple,
      minZoom: -4,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 110,
      attributionControl: false,
      zoomControl: false,
      doubleClickZoom: false,
      renderer: new GlowRenderer({ padding: 0.6, tolerance: 2 })
    })
    mapRef.current = map
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) Object.assign(window, { __map: map, __store: useStore }) // для отладки в браузере
    g.current = {
      regions: L.layerGroup().addTo(map),
      labels: L.layerGroup().addTo(map),
      geo: L.layerGroup().addTo(map),
      places: L.layerGroup().addTo(map),
      edit: L.layerGroup().addTo(map),
      draw: L.layerGroup().addTo(map)
    }
    map.createPane('labels').style.zIndex = '450'
    map.createPane('geo').style.zIndex = '440'
    map.getPane('labels')!.style.pointerEvents = 'none'
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    map.on('zoomend', refreshZoomStyles)
    return () => {
      map.remove()
      mapRef.current = null
      polys.current.clear()
      placeMarkers.current.clear()
    }
  }, [])

  // --- подложка и калька ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapDef || !g.current) return
    g.current.base?.remove()
    g.current.tiles?.remove()
    g.current.tiles = undefined
    g.current.ref?.remove()
    const b = boundsOf(mapDef)
    // превью всей карты — мгновенно, ПОД плитками высокого разрешения (своя панель ниже tilePane);
    // если оно лежит сверху, растянутые 4096 px размывают всю карту в кашу
    if (!map.getPane('basePreview')) map.createPane('basePreview').style.zIndex = '150'
    g.current.base = L.imageOverlay(assetUrl(mapDef.image), b, { className: 'map-base', pane: 'basePreview' }).addTo(map)
    if (mapDef.tiles) {
      const t = mapDef.tiles
      g.current.tiles = L.tileLayer(`${window.api.assetBase}${t.path}/{z}/{x}_{y}.webp`, {
        tileSize: t.size,
        minNativeZoom: t.minZoom,
        maxNativeZoom: t.maxZoom,
        minZoom: -10,
        maxZoom: 10,
        bounds: L.latLngBounds(b as L.LatLngBoundsLiteral),
        noWrap: true,
        keepBuffer: 3,
        className: 'map-base map-tiles'
      }).addTo(map)
    }
    if (mapDef.reference) g.current.ref = L.imageOverlay(assetUrl(mapDef.reference), b, { className: 'map-ref' })
    const lb = L.latLngBounds(b as L.LatLngBoundsLiteral)
    map.setMaxBounds(lb.pad(0.25))
    map.fitBounds(lb)
    map.setMinZoom(map.getBoundsZoom(lb) - 1)
    polys.current.forEach((p) => p.poly.remove())
    polys.current.clear()
    refreshZoomStyles()
  }, [mapDef?.id, mapDef?.image, mapDef?.reference, mapDef?.width, mapDef?.height, mapDef?.tiles?.path])

  useEffect(() => {
    const map = mapRef.current
    const ref = g.current?.ref
    g.current?.base?.setOpacity(layers.base ? 1 : 0.15)
    g.current?.tiles?.setOpacity(layers.base ? 1 : 0)
    if (!map || !ref) return
    if (layers.reference) ref.addTo(map).setOpacity(layers.referenceOpacity)
    else ref.remove()
  }, [layers.base, layers.reference, layers.referenceOpacity, mapDef?.reference])

  // --- план города: здания можно выбрать и сделать локацией ---
  const planRef = useRef<{ layer: L.LayerGroup; polys: L.Polygon[] } | null>(null)
  const [plan, setPlan] = useState<{ id: string; buildings: number[][] } | null>(null)
  useEffect(() => {
    setPlan(null)
    if (!mapDef?.plan) return
    let alive = true
    fetch(assetUrl(mapDef.plan))
      .then((r) => r.json())
      .then((p) => alive && setPlan({ id: mapDef.id, buildings: p.buildings }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mapDef?.id, mapDef?.plan])
  const buildingPlaces = world.places.filter((p) => p.mapId === mapDef?.id && p.building != null)
  const selBuilding = selection?.type === 'building' ? selection.id : selection?.type === 'place' ? (() => { const p = world.places.find((x) => x.id === selection.id); return p?.building != null ? `${p.mapId}#${p.building}` : '' })() : ''
  useEffect(() => {
    const map = mapRef.current
    planRef.current?.layer.remove()
    planRef.current = null
    if (!map || !plan || plan.id !== mapDef.id) return
    const renderer = L.canvas({ padding: 0.5, tolerance: 1 })
    const layer = L.layerGroup().addTo(map)
    const byBuilding = new Map(buildingPlaces.map((p) => [p.building!, p.id]))
    const base = (i: number): L.PathOptions => {
      const key = `${plan.id}#${i}`
      const isSel = key === selBuilding
      const isPlace = byBuilding.has(i)
      return { renderer, weight: isSel ? 3 : isPlace ? 1.6 : 0, color: isSel ? '#fff3c4' : '#e8cd8e', fillColor: '#e8cd8e', fillOpacity: isSel ? 0.35 : isPlace ? 0.12 : 0, opacity: 1 }
    }
    const list = plan.buildings.map((b, i) => {
      const pts: L.LatLngExpression[] = []
      for (let k = 2; k < b.length; k += 2) pts.push(toLL([b[k], b[k + 1]]))
      const poly = L.polygon(pts, base(i)).addTo(layer)
      poly.on('mouseover', () => poly.setStyle({ weight: 2, color: '#fff3c4', fillOpacity: 0.25 }))
      poly.on('mouseout', () => poly.setStyle(base(i)))
      poly.on('click', (e) => {
        if (useStore.getState().tool.kind !== 'select') return
        L.DomEvent.stopPropagation(e)
        const pid = byBuilding.get(i)
        useStore.getState().select(pid ? { type: 'place', id: pid } : { type: 'building', id: `${plan.id}#${i}` })
      })
      return poly
    })
    planRef.current = { layer, polys: list }
  }, [plan, mapDef?.id, selBuilding, buildingPlaces.map((p) => `${p.id}:${p.building}`).join(',')])

  // --- клики по карте ---
  const handleMapClick = (ll: L.LatLng, regionId?: string): void => {
    const s = useStore.getState()
    const t = s.tool
    const md = s.world!.maps.find((m) => m.id === s.mapId)!
    const [x, y] = fromLL(ll)
    if (x < 0 || y < 0 || x > md.width || y > md.height) return
    if (t.kind === 'place') {
      const p = newPlace(md.id, x, y, t.placeType)
      if (s.editMode === 'dated') p.from = s.date
      s.mutate((w) => {
        w.places.push(p)
      })
      s.select({ type: 'place', id: p.id })
      s.setTool({ kind: 'select' })
    } else if (t.kind === 'draw') {
      drawPts.current.push([x, y])
      setDrawCount(drawPts.current.length)
    } else if (t.kind === 'paint' && md.provinceMap) {
      // кисть по провинциям обрабатывается при нажатии мыши
    } else if (t.kind === 'paint' && regionId) {
      s.mutate((w) => {
        const r = w.regions.find((r) => r.id === regionId)
        if (!r) return
        const at = s.editMode === 'dated' ? s.date : null
        const existing = r.owners.find((o) => o.date === at)
        if (existing) existing.stateId = t.stateId
        else r.owners.push({ date: at, stateId: t.stateId })
      })
    } else if (t.kind === 'label') {
      const id = uid()
      s.mutate((w) => {
        w.mapLabels = [...(w.mapLabels ?? []), { id, mapId: md.id, text: 'Новая подпись', kind: 'region', x, y, angle: 0, size: 60 }]
      })
      s.select({ type: 'label', id })
      s.setTool({ kind: 'select' })
    } else if (t.kind === 'select') {
      // клик по объёмному поселению: место автора или поселение провинции
      const hit = settleLayer.current?.hit(x, y)
      if (hit?.key?.startsWith('place:')) {
        s.select({ type: 'place', id: hit.key.slice(6) })
        return
      }
      if (hit?.key?.startsWith('prov:')) {
        s.select({ type: 'province', id: Number(hit.key.slice(5)) })
        return
      }
      const raster = rasterRef.current
      const pid = raster && md.provinceMap ? provinceAt(raster, md.width, md.height, x, y) : 0
      if (pid && !regionId) s.select({ type: 'province', id: pid })
      else s.select(regionId ? { type: 'region', id: regionId } : null)
    }
  }

  useEffect(() => {
    const map = mapRef.current!
    const onClick = (e: L.LeafletMouseEvent): void => handleMapClick(e.latlng)
    const onDbl = (): void => {
      if (useStore.getState().tool.kind === 'draw') finishDraw()
    }
    map.on('click', onClick)
    map.on('dblclick', onDbl)
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDbl)
    }
  }, [])

  // --- рисование нового участка ---
  const finishDraw = (): void => {
    const pts = drawPts.current
    const s = useStore.getState()
    // двойной клик добавляет лишнюю точку-дубликат
    const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1)
    if (clean.length >= 3) {
      const at = s.editMode === 'dated' ? s.date : null
      const stateId = s.selection?.type === 'state' ? s.selection.id : null
      const region: Region = { id: uid(), mapId: s.mapId, rings: [clean], owners: [{ date: at, stateId }], from: at }
      s.mutate((w) => {
        w.regions.push(region)
      })
      s.select({ type: 'region', id: region.id })
    }
    drawPts.current = []
    setDrawCount(0)
  }

  useEffect(() => {
    const layer = g.current!.draw
    layer.clearLayers()
    if (tool.kind !== 'draw' || !drawPts.current.length) return
    const lls = drawPts.current.map(toLL)
    L.polyline(lls, { color: '#e3c787', weight: 2, dashArray: '6 4', interactive: false }).addTo(layer)
    lls.forEach((ll, i) =>
      L.circleMarker(ll, { radius: i === 0 ? 6 : 4, color: '#e3c787', fillColor: '#16120a', fillOpacity: 1, weight: 2, interactive: i === 0 })
        .on('click', (e) => {
          L.DomEvent.stop(e)
          if (i === 0) finishDraw()
        })
        .addTo(layer)
    )
  }, [drawCount, tool.kind])

  useEffect(() => {
    if (tool.kind !== 'draw') {
      drawPts.current = []
      setDrawCount(0)
    }
    divRef.current?.classList.toggle('tool-crosshair', tool.kind === 'draw' || tool.kind === 'place')
    divRef.current?.classList.toggle('tool-paint', tool.kind === 'paint')
  }, [tool.kind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const s = useStore.getState()
      if (s.tool.kind === 'draw') {
        if (e.key === 'Enter') finishDraw()
        if (e.key === 'Backspace') {
          drawPts.current.pop()
          setDrawCount(drawPts.current.length)
        }
      }
      if (e.key === 'Escape') {
        drawPts.current = []
        setDrawCount(0)
        s.setTool({ kind: 'select' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // --- участки (политический слой) ---
  const hovered = useRef<string | null>(null)
  const styleFor = (r: Region, owner: string | null, color: string, selected: boolean, z: number): GlowOptions => {
    const scale = Math.pow(2, z)
    const hover = hovered.current === owner && owner !== null
    const glow = layers.political && owner ? 3 + 11 * Math.sqrt(Math.min(scale, 1.5)) : 0
    return {
      color: selected ? '#f6dc8f' : shade(color, 0.35),
      casingColor: '#0b0906',
      weight: !layers.borders && !selected ? 0 : selected ? 2.4 : Math.max(0.8, Math.min(1.8, 1.6 * Math.sqrt(scale) + 0.6)),
      opacity: layers.borders || selected ? 0.85 : 0,
      fillColor: color,
      fillOpacity: layers.political ? (owner ? layers.politicalOpacity : 0.08) + (selected ? 0.14 : hover ? 0.08 : 0) : 0,
      glowWidth: glow * (selected ? 1.4 : 1),
      glowColor: selected ? '#f6dc8f' : shade(color, 0.15),
      glowOpacity: selected ? 0.85 : hover ? 0.7 : 0.45,
      dashArray: owner ? undefined : '4 4'
    }
  }

  useEffect(() => {
    const group = g.current!.regions
    const seen = new Set<string>()
    const stateColor = new Map<string, string>()
    for (const st of world.states) if (existsAt(st, date)) stateColor.set(st.id, resolve(st, date).color)
    const selRegion = selection?.type === 'region' ? selection.id : null
    const selState = selection?.type === 'state' ? selection.id : null

    for (const r of world.regions) {
      if (r.mapId !== mapDef.id || !existsAt(r, date)) continue
      seen.add(r.id)
      const owner = regionOwner(r, date)
      const color = (owner && stateColor.get(owner)) || '#6b6b6b'
      const selected = r.id === selRegion || (owner !== null && owner === selState)
      const style = styleFor(r, owner, color, selected, zoom)
      let entry = polys.current.get(r.id)
      if (!entry) {
        const poly = L.polygon(r.rings.map((ring) => [ring.map(toLL)]), { ...style, bubblingMouseEvents: false, smoothFactor: 0.5 })
        poly.on('click', (e) => handleMapClick(e.latlng, r.id))
        poly.on('dblclick', () => {
          const s = useStore.getState()
          const o = regionOwner(s.world!.regions.find((x) => x.id === r.id)!, s.date)
          if (o && s.tool.kind === 'select') s.openStateCard(o)
        })
        poly.on('mouseover', () => {
          const s = useStore.getState()
          hovered.current = regionOwner(s.world!.regions.find((x) => x.id === r.id)!, s.date)
          setHoverTick((t) => t + 1)
        })
        poly.on('mouseout', () => {
          hovered.current = null
          setHoverTick((t) => t + 1)
        })
        poly.addTo(group)
        entry = { poly, rings: r.rings }
        polys.current.set(r.id, entry)
      } else {
        if (entry.rings !== r.rings) {
          entry.poly.setLatLngs(r.rings.map((ring) => [ring.map(toLL)]))
          entry.rings = r.rings
        }
        entry.poly.setStyle(style)
      }
      const tipName = owner ? world.states.find((s) => s.id === owner) : undefined
      const name = tipName ? resolve(tipName, date).name : 'Ничья земля'
      if (entry.poly.getTooltip()?.getContent() !== name) entry.poly.unbindTooltip().bindTooltip(name, { sticky: true, className: 'region-tip', direction: 'top', offset: [0, -8] })
    }
    for (const [id, e] of polys.current) {
      if (!seen.has(id)) {
        e.poly.remove()
        polys.current.delete(id)
      }
    }
  }, [world.regions, world.states, date, layers.political, layers.borders, layers.politicalOpacity, mapDef.id, selection, zoom, hoverTick])

  // --- провинции: владельцы на дату ---
  const provinces = mapDef.provinceMap ? world.provinces : undefined
  const owners = useMemo(() => {
    const arr: (string | null)[] = []
    for (const p of provinces ?? []) arr[p.id] = ownerAt(p, date)
    return arr
  }, [provinces, date])
  const ownersKey = useMemo(() => owners.join('|'), [owners])

  // --- подписи государств ---
  useEffect(() => {
    const lg = g.current!.labels
    lg.clearLayers()
    labelEls.current = []
    const add = (stateId: string, x: number, y: number, size: number, angle: number): void => {
      const st = world.states.find((s) => s.id === stateId)
      if (!st || !existsAt(st, date)) return
      const name = resolve(st, date).name
      const icon = L.divIcon({
        className: 'state-label-wrap',
        html: `<div class="state-label" style="--angle:${angle}deg">${escapeHtml(name)}</div>`,
        iconSize: [0, 0]
      })
      const m = L.marker(toLL([x, y]), { icon, interactive: false, pane: 'labels', keyboard: false }).addTo(lg)
      const el = m.getElement()?.querySelector('.state-label') as HTMLElement | null
      if (el) labelEls.current.push({ el, units: size })
    }
    if (provinces) {
      const raster = rasterRef.current
      for (const spot of provinceStateLabels(provinces, owners)) {
        const st = world.states.find((s) => s.id === spot.stateId)
        if (!st) continue
        const name = resolve(st, date).name
        // подпись с исходной карты — пока её точка на земле этой страны
        const lb = st.label
        const own = lb && raster && owners[provinceAt(raster, mapDef.width, mapDef.height, lb.x, lb.y)] === st.id ? lb : null
        // размер — по нынешней территории: подпись с исходной карты рассчитана на страну в полной силе
        // (в ранние годы Империя — маленькое Княжество Дагерфорд, и её надпись была бы на полкарты)
        const auto = Math.min(spot.size / (name.length * 0.95 + 2), spot.size * 0.12, 120)
        if (own && own.size <= auto * 1.5) add(st.id, own.x, own.y, own.size, own.angle)
        else add(st.id, spot.x, spot.y, auto, spot.angle)
      }
    } else {
      for (const [stateId, info] of computeStateLabels(world, mapDef.id, date)) {
        const st = world.states.find((s) => s.id === stateId)
        if (!st) continue
        const name = resolve(st, date).name
        const own = st.label && mapDef.kind === 'world' && insideOwned(world, mapDef.id, date, stateId, [st.label.x, st.label.y]) ? st.label : null
        const [lx, ly] = own ? [own.x, own.y] : labelPoint(info.ring)
        add(stateId, lx, ly, own ? own.size : Math.min((Math.sqrt(info.area) / Math.max(name.length, 4)) * 1.5, Math.sqrt(info.area) * 0.3), own ? own.angle : 0)
      }
    }
    refreshZoomStyles()
  }, [world.regions, world.states, date, layers.stateLabels, mapDef.id, ownersKey, rasterTick])

  // --- провинции: WebGL-слой, режимы карты, наведение, кисть ---
  const mapMode = useStore((s) => s.mapMode)
  const provLayer = useRef<InstanceType<typeof ProvinceRenderer> | null>(null)
  const textLayer = useRef<InstanceType<typeof TextRenderer> | null>(null)
  const lutKeys = useRef<(string | null)[]>([])
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapDef.provinceMap) return
    let cancelled = false
    loadRaster(assetUrl(mapDef.provinceMap)).then((raster) => {
      if (cancelled || !mapRef.current) return
      rasterRef.current = raster
      if (!map.getPane('provinces')) {
        map.createPane('provinces').style.zIndex = '405'
        map.createPane('provtext').style.zIndex = '445'
        map.getPane('provtext')!.style.pointerEvents = 'none'
      }
      try {
        provLayer.current = new ProvinceRenderer(mapDef.width, mapDef.height, raster.image, { pane: 'provinces' })
        map.addLayer(provLayer.current)
      } catch (e) {
        console.error('Слой провинций не запустился', e)
      }
      textLayer.current = new TextRenderer({ pane: 'provtext' })
      map.addLayer(textLayer.current)
      setRasterTick((t) => t + 1)
    })
    return () => {
      cancelled = true
      if (provLayer.current) map.removeLayer(provLayer.current)
      if (textLayer.current) map.removeLayer(textLayer.current)
      provLayer.current = null
      textLayer.current = null
      rasterRef.current = null
    }
  }, [mapDef.id, mapDef.provinceMap])

  // --- походы армий: маршрут, пройденный путь и знамя армии на нужную дату ---
  const armyLayer = useRef<L.LayerGroup | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!map.getPane('armies')) map.createPane('armies').style.zIndex = '640'
    armyLayer.current = L.layerGroup([], { pane: 'armies' }).addTo(map)
    return () => {
      armyLayer.current?.remove()
      armyLayer.current = null
    }
  }, [mapDef.id])
  useEffect(() => {
    const layer = armyLayer.current
    if (!layer) return
    layer.clearLayers()
    if (!layers.armies) return
    const ll = (p: { x: number; y: number }): L.LatLngExpression => [-p.y, p.x]
    for (const a of world.armies ?? []) {
      if (a.mapId !== mapDef.id || a.waypoints.length < 2) continue
      const wp = a.waypoints
      const first = wp[0].date, last = wp[wp.length - 1].date
      // знамя видно от выступления до месяца после прихода
      if (date < first || date > last + 60) continue
      let i = 0
      while (i < wp.length - 2 && date >= wp[i + 1].date) i++
      const t = Math.max(0, Math.min(1, (date - wp[i].date) / Math.max(1, wp[i + 1].date - wp[i].date)))
      const pos = { x: wp[i].x + (wp[i + 1].x - wp[i].x) * t, y: wp[i].y + (wp[i + 1].y - wp[i].y) * t }
      const done = [...wp.slice(0, i + 1), pos]
      L.polyline(wp.map(ll), { pane: 'armies', color: a.color, weight: 2, opacity: 0.55, dashArray: '6 7', interactive: false }).addTo(layer)
      L.polyline(done.map(ll), { pane: 'armies', color: '#120d08', weight: 7, opacity: 0.45, interactive: false }).addTo(layer)
      L.polyline(done.map(ll), { pane: 'armies', color: a.color, weight: 4, opacity: 0.95, interactive: false }).addTo(layer)
      // направление движения — к следующей точке
      const nx = date > last ? wp[wp.length - 1] : wp[i + 1]
      const prev = date > last ? wp[wp.length - 2] : wp[i]
      const ang = (Math.atan2(nx.y - prev.y, nx.x - prev.x) * 180) / Math.PI
      const marching = date <= last
      L.marker(ll(pos), {
        pane: 'armies',
        interactive: false,
        icon: L.divIcon({
          className: 'army-wrap',
          iconSize: [0, 0],
          html: `<div class="army ${marching ? 'army-marching' : ''}" style="--c:${a.color}"><div class="army-arrow" style="transform:rotate(${ang}deg)"></div><div class="army-banner"></div><div class="army-name">${escapeHtml(a.name)}</div></div>`
        })
      }).addTo(layer)
    }
  }, [world.armies, date, layers.armies, mapDef.id])

  // --- объёмные поселения ---
  const settleLayer = useRef<InstanceType<typeof SettlementRenderer> | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapDef.provinceMap) return
    if (!map.getPane('settlements')) {
      map.createPane('settlements').style.zIndex = '444'
      map.getPane('settlements')!.style.pointerEvents = 'none'
    }
    settleLayer.current = new SettlementRenderer({ pane: 'settlements' })
    map.addLayer(settleLayer.current)
    onSpritesReady(() => settleLayer.current?.redraw())
    return () => {
      if (settleLayer.current) map.removeLayer(settleLayer.current)
      settleLayer.current = null
    }
  }, [mapDef.id, mapDef.provinceMap])
  useEffect(() => {
    const layer = settleLayer.current
    if (!layer) return
    if (!layers.models) {
      layer.setItems([])
      return
    }
    const items: SettlementItem[] = []
    for (const p of provinces ?? [])
      if (p.settlement)
        items.push({
          x: p.settlement.x,
          y: p.settlement.y,
          type: p.settlement.type,
          culture: p.culture,
          variant: p.id,
          key: `prov:${p.id}`,
          // в горах и снегах — маленькие хутора
          scale: p.terrain === 4 || p.terrain === 5 ? 0.72 : 1
        })
    const raster = rasterRef.current
    const byId = new Map((provinces ?? []).map((p) => [p.id, p]))
    for (const pl of world.places) {
      if (pl.mapId !== mapDef.id || !existsAt(pl, date)) continue
      const type = (pl.model as SettlementType | undefined) ?? PLACE_MODEL[resolve(pl, date).type]
      if (!type) continue
      const pid = raster ? provinceAt(raster, mapDef.width, mapDef.height, pl.x, pl.y) : 0
      items.push({ x: pl.x, y: pl.y, type, culture: byId.get(pid)?.culture ?? 'imperial', variant: pl.id.length * 7 + pl.id.charCodeAt(0), key: `place:${pl.id}` })
    }
    layer.setItems(items)
  }, [rasterTick, provinces, world.places, date, layers.models, mapDef.id])

  // таблица цветов: дата, режим, выделение, наведение
  useEffect(() => {
    if (!provLayer.current || !provinces) return
    const { data, width, keys } = buildLut(
      {
        world,
        date,
        mode: mapMode,
        selectedProvince: selection?.type === 'province' ? selection.id : null,
        selectedState: selection?.type === 'state' ? selection.id : null,
        hoverKey
      },
      owners
    )
    lutKeys.current = keys
    provLayer.current.setLut(data, width)
  }, [rasterTick, ownersKey, world.states, mapMode, selection, hoverKey, provinces])

  // вид слоя: заливка, границы, линии провинций при приближении
  useEffect(() => {
    provLayer.current?.setView({
      // вблизи политические цвета тают, чтобы были видны горы, леса и реки
      // вблизи заливка почти исчезает (как у Paradox): остаются границы и лёгкое свечение, видна сама земля
      opacity: (mapMode === 'political' ? (layers.political ? layers.politicalOpacity : 0) : 0.62) * (zoom <= -1 ? 1 : zoom >= 0.8 ? 0.12 : 1 - 0.88 * ((zoom + 1) / 1.8)),
      borders: layers.borders || mapMode !== 'political',
      provLines: mapMode === 'provinces' ? 0.8 : zoom >= 0.5 ? Math.min(0.7, zoom - 0.5) : 0,
      glowPx: mapMode === 'political' ? 8 + 10 * Math.min(1, Math.max(0, zoom + 2) / 3) : 4
    })
  }, [rasterTick, layers.political, layers.politicalOpacity, layers.borders, zoom, mapMode])

  // подписи провинций, областей, регионов
  useEffect(() => {
    if (!textLayer.current || !provinces) return
    const admin = world.adminRegions ?? []
    const labels: TextLabel[] = []
    const centers = new Map<string, { x: number; y: number; w: number }>()
    const areaToRegion = new Map(admin.filter((a) => a.level === 'area').map((a) => [a.id, a.parentId ?? '']))
    const regionToCont = new Map(admin.filter((a) => a.level === 'region').map((a) => [a.id, a.parentId ?? '']))
    const acc = (id: string, p: { x: number; y: number; px: number }): void => {
      const c = centers.get(id) ?? { x: 0, y: 0, w: 0 }
      c.x += p.x * p.px; c.y += p.y * p.px; c.w += p.px
      centers.set(id, c)
    }
    for (const p of provinces) {
      acc(p.areaId, p)
      const r = areaToRegion.get(p.areaId) ?? ''
      acc(r, p)
      acc(regionToCont.get(r) ?? '', p)
    }
    const at = (id: string): { x: number; y: number } => { const c = centers.get(id)!; return { x: c.x / c.w, y: c.y / c.w } }
    if (mapMode === 'regions' || mapMode === 'continents') {
      for (const a of admin) {
        if (a.level !== (mapMode === 'regions' ? 'region' : 'continent') || !centers.get(a.id)) continue
        labels.push({ ...at(a.id), text: a.name, size: a.level === 'region' ? 70 : 200, color: '#fff4dc', caps: true, minPx: 8 })
      }
    }
    if (mapMode === 'areas' || mapMode === 'provinces') {
      for (const a of admin) {
        if (a.level !== 'area' || !centers.get(a.id)) continue
        labels.push({ ...at(a.id), text: a.name, size: 30, color: '#fff4dc', italic: true, minPx: 9 })
      }
    }
    // места автора (города, крепости) подписаны сами — название провинции рядом с ними не дублируем
    const own = world.places.filter((pl) => pl.mapId === mapDef.id)
    for (const p of provinces) {
      const st = p.settlement
      const x = st?.x ?? p.x
      const y = st ? st.y + SPRITE_LOGICAL * SETTLEMENT_SCALE[st.type] * 0.22 : p.y
      if (own.some((pl) => Math.abs(pl.x - x) < 40 && Math.abs(pl.y - y) < 30)) continue
      labels.push({ x, y, text: p.name, size: 11, color: '#f3ead2', minPx: 11 })
    }
    textLayer.current.setLabels(labels)
  }, [rasterTick, provinces, world.adminRegions, world.places, mapMode])

  // наведение, выбор и кисть по провинциям
  useEffect(() => {
    const map = mapRef.current
    if (!map || !provinces) return
    const byId = new Map(provinces.map((p) => [p.id, p]))
    let painting = false
    let first = true
    const painted = new Set<number>()
    const pick = (ll: L.LatLng): number => {
      const r = rasterRef.current
      if (!r) return 0
      const [x, y] = fromLL(ll)
      return provinceAt(r, mapDef.width, mapDef.height, x, y)
    }
    const paint = (id: number, e: L.LeafletMouseEvent): void => {
      const s = useStore.getState()
      if (s.tool.kind !== 'paint' || !id) return
      const target = s.tool.stateId
      const ev = e.originalEvent as MouseEvent
      const src = byId.get(id)!
      const admin = s.world!.adminRegions ?? []
      const regionOf = (areaId: string): string => admin.find((a) => a.id === areaId)?.parentId ?? ''
      const group = ev.shiftKey
        ? provinces.filter((p) => p.areaId === src.areaId)
        : ev.ctrlKey
          ? provinces.filter((p) => regionOf(p.areaId) === regionOf(src.areaId))
          : [src]
      const ids = group.map((p) => p.id).filter((pid) => !painted.has(pid))
      if (!ids.length) return
      ids.forEach((pid) => painted.add(pid))
      const at = s.editMode === 'dated' ? s.date : null
      s.mutate(
        (w) => {
          for (const pid of ids) {
            const pr = w.provinces!.find((q) => q.id === pid)!
            if (at === null) pr.owners = [[null, target], ...pr.owners.filter((o) => o[0] !== null)]
            else {
              const i = pr.owners.findIndex((o) => o[0] === at)
              if (i >= 0) pr.owners[i][1] = target
              else {
                pr.owners.push([at, target])
                pr.owners.sort((a, b) => (a[0] ?? -Infinity) - (b[0] ?? -Infinity))
              }
            }
          }
        },
        { skipHistory: !first }
      )
      first = false
    }
    let raf = 0
    const onMove = (e: L.LeafletMouseEvent): void => {
      if (painting) paint(pick(e.latlng), e)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const id = pick(e.latlng)
        const key = id ? lutKeys.current[id] ?? null : null
        setHoverKey((k) => (k === key ? k : key))
        const tip = tipRef.current
        if (!tip) return
        if (!id) {
          tip.style.display = 'none'
          return
        }
        const s = useStore.getState()
        const p = byId.get(id)!
        const o = ownerAt(p, s.date)
        const st = s.world!.states.find((x) => x.id === o)
        const area = s.world!.adminRegions?.find((a) => a.id === p.areaId)
        tip.innerHTML = `<b>${escapeHtml(p.name)}</b><span>${escapeHtml(area?.name ?? '')}</span><span class="tip-owner">${escapeHtml(st ? resolve(st, s.date).name : 'Ничья земля')}</span>`
        tip.style.display = 'flex'
        tip.style.left = `${e.containerPoint.x + 16}px`
        tip.style.top = `${e.containerPoint.y + 14}px`
      })
    }
    const onOut = (): void => {
      setHoverKey(null)
      if (tipRef.current) tipRef.current.style.display = 'none'
    }
    const onDown = (e: L.LeafletMouseEvent): void => {
      const s = useStore.getState()
      if (s.tool.kind !== 'paint' || (e.originalEvent as MouseEvent).button !== 0) return
      painting = true
      first = true
      painted.clear()
      paint(pick(e.latlng), e)
    }
    const onUp = (): void => {
      painting = false
    }
    map.on('mousemove', onMove)
    map.on('mouseout', onOut)
    map.on('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onOut)
      map.off('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      cancelAnimationFrame(raf)
    }
  }, [provinces, mapDef.id])

  // кисть: карту не таскаем, пока рисуем
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (tool.kind === 'paint' && provinces) map.dragging.disable()
    else map.dragging.enable()
  }, [tool.kind, provinces])

  // --- подписи географии ---
  useEffect(() => {
    const layer = g.current!.geo
    layer.clearLayers()
    geoEls.current = []
    const selLabel = selection?.type === 'label' ? selection.id : null
    for (const lb of world.mapLabels ?? []) {
      if (lb.mapId !== mapDef.id) continue
      const sel = lb.id === selLabel
      const icon = L.divIcon({
        className: 'geo-label-wrap',
        html: `<div class="geo-label geo-${lb.kind} ${sel ? 'geo-selected' : ''}" style="--angle:${lb.angle}deg">${escapeHtml(lb.text)}</div>`,
        iconSize: [0, 0]
      })
      const m = L.marker(toLL([lb.x, lb.y]), { icon, pane: 'geo', keyboard: false, draggable: sel && tool.kind === 'select' && useStore.getState().masterMode })
      m.on('click', (e) => {
        L.DomEvent.stop(e)
        const s = useStore.getState()
        if (s.tool.kind === 'select') s.select({ type: 'label', id: lb.id })
        else handleMapClick(e.latlng)
      })
      m.on('dragend', () => {
        const [x, y] = fromLL(m.getLatLng())
        useStore.getState().mutate((w) => {
          const l = w.mapLabels?.find((q) => q.id === lb.id)
          if (l) Object.assign(l, { x, y })
        })
      })
      m.addTo(layer)
      const el = m.getElement()?.querySelector('.geo-label') as HTMLElement | null
      if (el) geoEls.current.push({ el, units: lb.size })
    }
    refreshZoomStyles()
  }, [world.mapLabels, mapDef.id, selection, tool.kind, layers.geoLabels])

  // --- места ---
  useEffect(() => {
    const group = g.current!.places
    const seen = new Set<string>()
    const selPlace = selection?.type === 'place' ? selection.id : null
    for (const p of world.places) {
      if (p.mapId !== mapDef.id || !existsAt(p, date)) continue
      seen.add(p.id)
      const f = resolve(p, date)
      const meta = PLACE_TYPES[f.type] ?? PLACE_TYPES.landmark
      const selected = p.id === selPlace
      const key = `${f.name}|${f.type}|${selected}|${p.innerMapId ?? ''}|${p.x},${p.y}|${tool.kind}|${layers.models}`
      const existing = placeMarkers.current.get(p.id)
      if (existing && existing.key === key) continue
      existing?.marker.remove()
      const modelled = layers.models && Boolean(PLACE_MODEL[f.type]) && Boolean(mapDef.provinceMap)
      const html = `<div class="pm pm-${f.type} ${selected ? 'pm-selected' : ''} ${p.innerMapId ? 'pm-hasmap' : ''} ${modelled ? 'pm-model' : ''}" style="--s:${meta.size}px">
        <span class="pm-icon"><svg viewBox="0 0 24 24" width="${meta.size * 0.62}" height="${meta.size * 0.62}"><path d="${meta.glyph}"/></svg></span>
        <span class="pm-name">${escapeHtml(f.name)}</span></div>`
      const marker = L.marker(toLL([p.x, p.y]), {
        icon: L.divIcon({ className: 'pm-wrap', html, iconSize: [meta.size, meta.size], iconAnchor: [meta.size / 2, meta.size / 2] }),
        draggable: selected && tool.kind === 'select' && useStore.getState().masterMode,
        riseOnHover: true,
        zIndexOffset: meta.group === 'cities' ? 1000 : 0
      })
      marker.on('click', (e) => {
        L.DomEvent.stop(e)
        const s = useStore.getState()
        if (s.tool.kind === 'select') s.select({ type: 'place', id: p.id })
        else handleMapClick(e.latlng)
      })
      marker.on('dblclick', (e) => {
        L.DomEvent.stop(e)
        if (p.innerMapId) useStore.getState().openMap(p.innerMapId)
      })
      marker.on('dragend', () => {
        const [x, y] = fromLL(marker.getLatLng())
        useStore.getState().mutate((w) => {
          const pl = w.places.find((q) => q.id === p.id)
          if (pl) Object.assign(pl, { x, y })
        })
      })
      marker.addTo(group)
      placeMarkers.current.set(p.id, { marker, minZoom: selected ? -99 : meta.minZoom, group: meta.group, key })
    }
    for (const [id, pm] of placeMarkers.current) {
      if (!seen.has(id)) {
        pm.marker.remove()
        placeMarkers.current.delete(id)
      }
    }
    refreshZoomStyles()
  }, [world.places, date, mapDef.id, selection, tool.kind, layers.cities, layers.settlements, layers.poi, layers.models])

  // --- правка вершин выбранного участка ---
  const region = selection?.type === 'region' ? world.regions.find((r) => r.id === selection.id && r.mapId === mapDef.id) : undefined
  const vertexCount = region ? region.rings.reduce((s, r) => s + r.length, 0) : 0
  const vertexEdit = useStore((s) => s.vertexEdit)
  useEffect(() => {
    const layer = g.current!.edit
    layer.clearLayers()
    if (!region || !vertexEdit || tool.kind !== 'select' || vertexCount > MAX_HANDLES) return
    const rings = region.rings.map((r) => r.map((p) => [...p] as XY))
    const redraw = (): void => {
      polys.current.get(region.id)?.poly.setLatLngs(rings.map((ring) => [ring.map(toLL)]))
    }
    const commit = (): void =>
      useStore.getState().mutate((w) => {
        const r = w.regions.find((x) => x.id === region.id)
        if (r) r.rings = rings
      })
    const handleIcon = L.divIcon({ className: 'vertex-handle', iconSize: [10, 10] })
    const midIcon = L.divIcon({ className: 'vertex-mid', iconSize: [8, 8] })
    rings.forEach((ring, ri) => {
      ring.forEach((pt, vi) => {
        const m = L.marker(toLL(pt), { icon: handleIcon, draggable: true, keyboard: false, zIndexOffset: 2000 })
        m.on('drag', () => {
          rings[ri][vi] = fromLL(m.getLatLng())
          redraw()
        })
        m.on('dragend', commit)
        m.on('click', (e) => {
          L.DomEvent.stop(e)
          if ((e.originalEvent as MouseEvent).altKey && ring.length > 3) {
            ring.splice(vi, 1)
            commit()
          }
        })
        m.addTo(layer)
        const next = ring[(vi + 1) % ring.length]
        const mid: XY = [(pt[0] + next[0]) / 2, (pt[1] + next[1]) / 2]
        L.marker(toLL(mid), { icon: midIcon, keyboard: false, zIndexOffset: 1900 })
          .on('click', (e) => {
            L.DomEvent.stop(e)
            ring.splice(vi + 1, 0, mid)
            commit()
          })
          .addTo(layer)
      })
    })
  }, [region?.id, region?.rings, tool.kind, vertexEdit])

  // приблизиться к выбранному
  useEffect(() => {
    const map = mapRef.current
    if (!map || selection?.type !== 'place') return
    const p = world.places.find((x) => x.id === selection.id)
    if (p && p.mapId === mapDef.id && !map.getBounds().pad(-0.15).contains(toLL([p.x, p.y]))) map.panTo(toLL([p.x, p.y]))
  }, [selection])

  return (
    <div className="map-shell">
      <div ref={divRef} className="map-canvas" />
      <div ref={tipRef} className="prov-tip" />
      {mapDef.kind !== 'world' && (() => {
        // назад — на карту, где стоит место с этой картой (здание → город → мир)
        const owner = world.places.find((p) => p.innerMapId === mapDef.id)
        const parent = world.maps.find((m) => m.id === owner?.mapId) ?? world.maps.find((m) => m.kind === 'world')!
        return (
          <div className="map-breadcrumb">
            <button onClick={() => openMap(parent.id)}>← {parent.kind === 'world' ? 'Карта мира' : parent.name.replace(/ — план города$/, '')}</button>
            <span>{mapDef.name}</span>
          </div>
        )
      })()}
      {tool.kind === 'draw' && (
        <div className="map-hint">
          Кликайте по карте, чтобы ставить точки границы ({drawCount}). Двойной клик, Enter или клик по первой точке завершают
          участок. Backspace убирает последнюю точку, Esc отменяет.
        </div>
      )}
      {tool.kind === 'paint' && <div className="map-hint">Кликайте по участкам, чтобы передать их выбранному государству.</div>}
      {tool.kind === 'label' && <div className="map-hint">Кликните по карте, чтобы поставить подпись: море, хребет, реку, лес или землю.</div>}
      {tool.kind === 'place' && <div className="map-hint">Кликните по карте, чтобы поставить метку: «{PLACE_TYPES[tool.placeType].label}».</div>}
      {region && vertexEdit && tool.kind === 'select' && vertexCount <= MAX_HANDLES && (
        <div className="map-hint subtle">Тяните вершины. Клик по полупрозрачной точке добавляет вершину, Alt+клик удаляет.</div>
      )}
      <div className="zoom-indicator">×{Math.pow(2, zoom).toFixed(2)}</div>
    </div>
  )
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
