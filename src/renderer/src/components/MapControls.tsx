import { useRef, useState } from 'react'
import { useStore } from '../store'
import { PLACE_TYPES } from '../constants'
import { existsAt, resolve } from '../temporal'
import { Icon } from './Icon'
import type { PlaceType } from '../types'
import type { Layers } from '../store'
import { MAP_MODES } from '../provinces'

export function MapToolbar() {
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const [menu, setMenu] = useState<'place' | 'paint' | null>(null)

  const states = world.states
    .filter((s) => existsAt(s, date))
    .map((s) => ({ id: s.id, ...resolve(s, date) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const paintState = tool.kind === 'paint' ? states.find((s) => s.id === tool.stateId) : undefined

  return (
    <div className="map-toolbar">
      <button className={`tool ${tool.kind === 'select' ? 'active' : ''}`} onClick={() => setTool({ kind: 'select' })} title="Выбор и правка (Esc)">
        <Icon name="cursor" />
      </button>
      <div className="tool-group">
        <button className={`tool ${tool.kind === 'place' ? 'active' : ''}`} onClick={() => setMenu(menu === 'place' ? null : 'place')} title="Поставить метку">
          <Icon name="pin" />
        </button>
        {menu === 'place' && (
          <div className="tool-menu">
            {(Object.keys(PLACE_TYPES) as PlaceType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTool({ kind: 'place', placeType: t })
                  setMenu(null)
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" className="menu-glyph">
                  <path d={PLACE_TYPES[t].glyph} />
                </svg>
                {PLACE_TYPES[t].label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className={`tool ${tool.kind === 'label' ? 'active' : ''}`} onClick={() => setTool({ kind: 'label' })} title="Подпись географии: море, горы, река, лес, земля">
        <Icon name="scroll" />
      </button>
      <button className={`tool ${tool.kind === 'draw' ? 'active' : ''}`} onClick={() => setTool({ kind: 'draw' })} title="Нарисовать участок территории">
        <Icon name="pen" />
      </button>
      <div className="tool-group">
        <button
          className={`tool ${tool.kind === 'paint' ? 'active' : ''}`}
          onClick={() => setMenu(menu === 'paint' ? null : 'paint')}
          title="Кисть владения: передать участки государству"
          style={paintState ? { boxShadow: `inset 0 -3px 0 ${paintState.color}` } : undefined}
        >
          <Icon name="brush" />
        </button>
        {menu === 'paint' && (
          <div className="tool-menu tool-menu-scroll">
            <button
              onClick={() => {
                setTool({ kind: 'paint', stateId: null })
                setMenu(null)
              }}
            >
              <span className="swatch" style={{ background: '#555' }} /> Ничья земля
            </button>
            {states.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setTool({ kind: 'paint', stateId: s.id })
                  setMenu(null)
                }}
              >
                <span className="swatch" style={{ background: s.color }} /> {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Режимы карты, как в играх Paradox: одна карта провинций — разные раскраски */
export function MapModeBar() {
  const mode = useStore((s) => s.mapMode)
  const setMode = useStore((s) => s.setMapMode)
  const has = useStore((s) => Boolean(s.world?.provinces?.length) && s.world?.maps.find((m) => m.id === s.mapId)?.provinceMap)
  if (!has) return null
  return (
    <div className="map-modes">
      {MAP_MODES.map((m) => (
        <button key={m.value} className={mode === m.value ? 'active' : ''} onClick={() => setMode(m.value)}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

const LAYER_ROWS: { key: keyof Layers; label: string }[] = [
  { key: 'base', label: 'Подложка карты' },
  { key: 'models', label: 'Объёмные поселения' },
  { key: 'political', label: 'Политическая заливка' },
  { key: 'borders', label: 'Границы' },
  { key: 'stateLabels', label: 'Названия государств' },
  { key: 'geoLabels', label: 'География: моря, горы, реки' },
  { key: 'cities', label: 'Города и крепости' },
  { key: 'settlements', label: 'Посёлки, деревни, порты' },
  { key: 'poi', label: 'Точки интереса' },
  { key: 'reference', label: 'Калька: старая политическая карта' }
]

const PANEL_POS_KEY = 'gleuderoff.layersPanel'

function loadPanelState(): { x: number | null; y: number | null; open: boolean } {
  // на телефоне панель стоит на месте и по умолчанию свёрнута
  const phone = window.innerWidth <= 760
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || '{}')
    return phone ? { x: null, y: null, open: false } : { x: null, y: null, open: true, ...saved }
  } catch {
    return { x: null, y: null, open: !phone }
  }
}

/** Панель слоёв: перетаскивается за заголовок, сворачивается, положение запоминается. Двойной клик по заголовку — на место. */
export function LayersPanel() {
  const layers = useStore((s) => s.layers)
  const setLayer = useStore((s) => s.setLayer)
  const inspectorOpen = useStore((s) => s.selection !== null && s.selection.type !== 'entry')
  const [state, setState] = useState(loadPanelState)
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const save = (next: typeof state): void => {
    setState(next)
    try {
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify(next))
    } catch {
      /* без сохранения позиции */
    }
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return
    const panel = ref.current!
    const parent = panel.offsetParent as HTMLElement
    const pr = parent.getBoundingClientRect()
    const r = panel.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    setDragging(true)
    const move = (ev: PointerEvent): void => {
      const x = Math.max(0, Math.min(pr.width - r.width, ev.clientX - pr.left - dx))
      const y = Math.max(0, Math.min(pr.height - 40, ev.clientY - pr.top - dy))
      panel.style.left = `${x}px`
      panel.style.top = `${y}px`
      panel.style.right = 'auto'
    }
    const up = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(false)
      const x = Math.max(0, Math.min(pr.width - r.width, ev.clientX - pr.left - dx))
      const y = Math.max(0, Math.min(pr.height - 40, ev.clientY - pr.top - dy))
      save({ ...state, x, y })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const moved = state.x !== null && state.y !== null
  return (
    <div
      ref={ref}
      className={`layers-panel ${state.open ? '' : 'collapsed'} ${inspectorOpen ? 'shifted' : ''} ${moved ? 'moved' : ''} ${dragging ? 'dragging' : ''}`}
      style={moved ? { left: state.x!, top: state.y!, right: 'auto' } : undefined}
    >
      <div
        className="layers-head"
        onPointerDown={onPointerDown}
        onDoubleClick={() => save({ ...state, x: null, y: null })}
        title="Перетащите, чтобы сдвинуть. Двойной клик — вернуть на место"
      >
        <span className="grip">⋮⋮</span>
        <Icon name="layers" size={16} />
        <span className="title">Слои</span>
        <button onClick={() => save({ ...state, open: !state.open })} title={state.open ? 'Свернуть' : 'Развернуть'}>
          <Icon name={state.open ? 'back' : 'next'} size={14} className={state.open ? 'rot-up' : 'rot-down'} />
        </button>
      </div>
      {state.open && (
        <div className="layers-body">
          {LAYER_ROWS.map((r) => (
            <label key={r.key} className="layer-row">
              <input type="checkbox" checked={layers[r.key] as boolean} onChange={(e) => setLayer(r.key, e.target.checked as never)} />
              <span>{r.label}</span>
            </label>
          ))}
          <label className="layer-slider">
            <span>Насыщенность стран</span>
            <input
              type="range"
              min={0.05}
              max={0.9}
              step={0.05}
              value={layers.politicalOpacity}
              onChange={(e) => setLayer('politicalOpacity', Number(e.target.value))}
            />
          </label>
          {layers.reference && (
            <label className="layer-slider">
              <span>Прозрачность кальки</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={layers.referenceOpacity}
                onChange={(e) => setLayer('referenceOpacity', Number(e.target.value))}
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
