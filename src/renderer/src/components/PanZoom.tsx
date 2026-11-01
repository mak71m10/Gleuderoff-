import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Полотно, которое тянут мышью (или пальцем) и приближают колесом. Короткий щелчок остаётся щелчком —
 * по карточкам внутри можно нажимать. inline: колесо приближает только с Ctrl, чтобы не мешать прокрутке страницы.
 */
export function PanZoom({ children, inline = false, resetKey }: { children: ReactNode; inline?: boolean; resetKey?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; id: number } | null>(null)
  const pinch = useRef(new Map<number, { x: number; y: number }>())

  // вписать целиком; при открытии — не мельче 0.6, по центру (там корень древа), сверху
  const fit = (min = 0.15): void => {
    const b = box.current, c = inner.current
    if (!b || !c) return
    const w = c.scrollWidth, h = c.scrollHeight
    const k = Math.max(min, Math.min(1, (b.clientWidth - 24) / w, min === 0.15 ? (b.clientHeight - 24) / h : 1))
    setView({ k, x: (b.clientWidth - w * k) / 2, y: 12 })
  }
  useLayoutEffect(() => fit(0.6), [resetKey])

  const zoomAt = (px: number, py: number, factor: number): void =>
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.15, v.k * factor))
      const f = k / v.k
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    })

  useEffect(() => {
    const b = box.current
    if (!b) return
    const onWheel = (e: WheelEvent): void => {
      if (inline && !e.ctrlKey) return
      e.preventDefault()
      const r = b.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))
    }
    b.addEventListener('wheel', onWheel, { passive: false })
    return () => b.removeEventListener('wheel', onWheel)
  }, [inline])

  return (
    <div
      ref={box}
      className="panzoom"
      onPointerDown={(e) => {
        pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, id: e.pointerId }
      }}
      onPointerMove={(e) => {
        const pts = pinch.current
        if (pts.has(e.pointerId) && pts.size === 2) {
          // два пальца — приближение
          const [a, c] = [...pts.values()]
          const before = Math.hypot(a.x - c.x, a.y - c.y)
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
          const [a2, c2] = [...pts.values()]
          const after = Math.hypot(a2.x - c2.x, a2.y - c2.y)
          const r = box.current!.getBoundingClientRect()
          if (before > 0) zoomAt((a2.x + c2.x) / 2 - r.left, (a2.y + c2.y) / 2 - r.top, after / before)
          return
        }
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        const dx = e.clientX - d.x, dy = e.clientY - d.y
        if (!d.moved && Math.hypot(dx, dy) < 5) return
        if (!d.moved) box.current?.setPointerCapture(e.pointerId)
        d.moved = true
        setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
      }}
      onPointerUp={(e) => {
        pinch.current.delete(e.pointerId)
        if (drag.current?.id === e.pointerId) setTimeout(() => (drag.current = null))
      }}
      onPointerCancel={(e) => {
        pinch.current.delete(e.pointerId)
        drag.current = null
      }}
      onClickCapture={(e) => {
        // перетаскивание — не щелчок по карточке
        if (drag.current?.moved) {
          e.stopPropagation()
          e.preventDefault()
        }
      }}
    >
      <div ref={inner} className="panzoom-inner" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {children}
      </div>
      <div className="panzoom-tools">
        <button title="Приблизить" onClick={() => zoomAt((box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2, 1.25)}>+</button>
        <button title="Отдалить" onClick={() => zoomAt((box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2, 0.8)}>−</button>
        <button title="Вписать целиком" onClick={() => fit()}>
          <Icon name="target" size={15} />
        </button>
      </div>
    </div>
  )
}

/** Окно на весь экран поверх приложения. */
export function Fullscreen({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fullscreen">
      <header className="fullscreen-head">
        <div className="fullscreen-title">{title}</div>
        <button className="modal-close" onClick={onClose} title="Закрыть (Esc)">
          <Icon name="x" size={18} />
        </button>
      </header>
      <div className="fullscreen-body">{children}</div>
    </div>,
    document.body
  )
}
