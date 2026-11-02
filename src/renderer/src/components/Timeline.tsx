import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { addMonths, addYears, eraOf, formatDate, formatYear, toParts, weekday, yearLength, yearStart } from '../calendar'
import { changeDates } from '../temporal'
import { Icon } from './Icon'
import { DateField } from './ui'
import type { WorldDate } from '../types'

type Speed = 'day' | 'month' | 'year'
const NICE_YEARS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

export function Timeline() {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const setDate = useStore((s) => s.setDate)
  const cal = world.calendar
  const len = yearLength(cal)
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1000)
  const [view, setView] = useState<[number, number]>(() => [yearStart(cal, cal.rangeFrom), yearStart(cal, cal.rangeTo)])
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('month')
  const [picker, setPicker] = useState(false)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    if (trackRef.current) ro.observe(trackRef.current)
    return () => ro.disconnect()
  }, [])

  // держим текущую дату в поле зрения
  useEffect(() => {
    const [a, b] = view
    if (date < a || date > b) {
      const span = b - a
      setView([date - span / 2, date + span / 2])
    }
  }, [date])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const s = useStore.getState()
      const c = s.world!.calendar
      s.setDate(speed === 'day' ? s.date + 1 : speed === 'month' ? addMonths(c, s.date, 1) : addYears(c, s.date, 1))
    }, 120)
    return () => clearInterval(t)
  }, [playing, speed])

  const [v0, v1] = view
  const span = Math.max(v1 - v0, 10)
  const x = (d: number): number => ((d - v0) / span) * width
  const dateAt = (px: number): WorldDate => Math.round(v0 + (px / width) * span)

  const ticks = useMemo(() => {
    const out: { d: number; label: string; major: boolean }[] = []
    const pxPerDay = width / span
    const pxPerYear = pxPerDay * len
    if (pxPerYear >= 600 && pxPerDay * 30 >= 60) {
      // месяцы (и дни при сильном приближении)
      let d = yearStart(cal, toParts(cal, v0).year)
      const showDays = pxPerDay >= 22
      while (d <= v1) {
        const p = toParts(cal, d)
        if (d >= v0) {
          if (p.day === 1) out.push({ d, label: `${cal.months[p.month].name}${p.month === 0 ? ` ${formatYear(cal, p.year)}` : ''}`, major: true })
          else if (showDays) out.push({ d, label: String(p.day), major: false })
        }
        d = showDays ? d + 1 : addMonths(cal, d, 1)
      }
      return out
    }
    const step = NICE_YEARS.find((s) => s * pxPerYear >= 80) ?? 10000
    const yFrom = Math.floor(v0 / len) - 1
    const yTo = Math.ceil(v1 / len) + 1
    for (let k = Math.ceil(yFrom / step); k * step <= yTo; k++) {
      const yr = k * step
      if (yr === 0) continue
      const d = yearStart(cal, yr)
      if (d >= v0 && d <= v1) out.push({ d, label: formatYear(cal, yr), major: true })
    }
    return out
  }, [v0, v1, width, cal])

  const markers = useMemo(() => {
    const set = new Set<number>()
    for (const s of world.states) changeDates(s).forEach((d) => set.add(d))
    for (const p of world.places) changeDates(p).forEach((d) => set.add(d))
    for (const r of world.regions) r.owners.forEach((o) => o.date !== null && set.add(o.date))
    for (const p of world.provinces ?? []) for (const [d] of p.owners) if (d !== null) set.add(d)
    return [...set].sort((a, b) => a - b)
  }, [world.states, world.places, world.regions, world.provinces])

  const onWheel = (e: React.WheelEvent): void => {
    const rect = trackRef.current!.getBoundingClientRect()
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const shift = ((e.deltaX || e.deltaY) / width) * span
      setView([v0 + shift, v1 + shift])
      return
    }
    const anchor = dateAt(e.clientX - rect.left)
    const k = e.deltaY > 0 ? 1.25 : 0.8
    const nextSpan = Math.min(Math.max(span * k, 20), len * 20000)
    const ratio = (anchor - v0) / span
    setView([anchor - ratio * nextSpan, anchor + (1 - ratio) * nextSpan])
  }

  // мышь: перетаскивание ставит дату (средняя/правая кнопка или Alt — сдвиг шкалы);
  // палец: одним — ставит дату, двумя — щипок масштабирует и сдвигает шкалу
  const dragRef = useRef<{ mode: 'set' | 'pan'; startX: number; v0: number; v1: number } | null>(null)
  const touches = useRef(new Map<number, number>())
  const pinchRef = useRef<{ a: number; dist: number; v0: number; v1: number } | null>(null)
  const startPinch = (): void => {
    const [xa, xb] = [...touches.current.values()]
    const rect = trackRef.current!.getBoundingClientRect()
    const mid = (xa + xb) / 2 - rect.left
    pinchRef.current = { a: v0 + (mid / width) * span, dist: Math.max(Math.abs(xa - xb), 20), v0, v1 }
    dragRef.current = null
  }
  const onPointerDown = (e: React.PointerEvent): void => {
    const rect = trackRef.current!.getBoundingClientRect()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, e.clientX)
      if (touches.current.size === 2) return startPinch()
    }
    if (e.button === 1 || e.button === 2 || e.altKey) dragRef.current = { mode: 'pan', startX: e.clientX, v0, v1 }
    else {
      dragRef.current = { mode: 'set', startX: e.clientX, v0, v1 }
      setDate(dateAt(e.clientX - rect.left))
    }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const rect = trackRef.current!.getBoundingClientRect()
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, e.clientX)
      const pz = pinchRef.current
      if (pz && touches.current.size >= 2) {
        const [xa, xb] = [...touches.current.values()]
        const k = pz.dist / Math.max(Math.abs(xa - xb), 20)
        const nextSpan = Math.min(Math.max((pz.v1 - pz.v0) * k, 20), len * 20000)
        const mid = (xa + xb) / 2 - rect.left
        const from = pz.a - (mid / width) * nextSpan
        setView([from, from + nextSpan])
        return
      }
    }
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'set') setDate(dateAt(Math.max(0, Math.min(width, e.clientX - rect.left))))
    else {
      const shift = ((d.startX - e.clientX) / width) * (d.v1 - d.v0)
      setView([d.v0 + shift, d.v1 + shift])
    }
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    touches.current.delete(e.pointerId)
    if (touches.current.size < 2) pinchRef.current = null
    dragRef.current = null
  }
  const zoomBy = (k: number): void => {
    const nextSpan = Math.min(Math.max(span * k, 20), len * 20000)
    const ratio = Math.min(Math.max((date - v0) / span, 0), 1)
    setView([date - ratio * nextSpan, date + (1 - ratio) * nextSpan])
  }

  const step = (fn: (d: number) => number) => () => setDate(fn(date))
  const p = toParts(cal, date)

  return (
    <div className="timeline">
      <div className="tl-controls">
        <button onClick={step((d) => addYears(cal, d, -1))} title="Год назад">«Г</button>
        <button onClick={step((d) => addMonths(cal, d, -1))} title="Месяц назад">‹М</button>
        <button className="tl-wide" onClick={step((d) => d - 1)} title="День назад">‹Д</button>
        <button className="tl-date" onClick={() => setPicker(!picker)} title="Выбрать дату">
          <span className="tl-date-main">
            {p.day} {cal.months[p.month]?.name}
          </span>
          <span className="tl-date-year">{formatYear(cal, p.year)}</span>
          <span className="tl-weekday">
            {[weekday(cal, date), eraOf(cal, p.year)].filter(Boolean).join(' · ')}
          </span>
        </button>
        <button className="tl-wide" onClick={step((d) => d + 1)} title="День вперёд">Д›</button>
        <button onClick={step((d) => addMonths(cal, d, 1))} title="Месяц вперёд">М›</button>
        <button onClick={step((d) => addYears(cal, d, 1))} title="Год вперёд">Г»</button>
        <span className="tl-sep tl-wide" />
        <button className={playing ? 'active' : ''} onClick={() => setPlaying(!playing)} title="Проиграть историю">
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        <select className="tl-wide" value={speed} onChange={(e) => setSpeed(e.target.value as Speed)} title="Шаг проигрывания">
          <option value="day">по дням</option>
          <option value="month">по месяцам</option>
          <option value="year">по годам</option>
        </select>
        <button className="tl-wide" onClick={() => setDate(cal.present)} title="Настоящее время лора">
          Сейчас
        </button>
        <span className="tl-zoom">
          <button onClick={() => zoomBy(1.6)} aria-label="Отдалить шкалу">−</button>
          <button onClick={() => zoomBy(0.6)} aria-label="Приблизить шкалу">+</button>
        </span>
        {picker && (
          <div className="tl-picker">
            <DateField label="Перейти к дате" value={date} allowEmpty={false} onChange={(d) => d !== null && setDate(d)} />
            <div className="tl-picker-row">
              <button onClick={step((d) => d - 1)}>‹ день</button>
              <button onClick={step((d) => d + 1)}>день ›</button>
              <button onClick={() => setDate(cal.present)}>Сейчас</button>
            </div>
            <label className="tl-picker-row">
              <span className="muted small">Проигрывать</span>
              <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
                <option value="day">по дням</option>
                <option value="month">по месяцам</option>
                <option value="year">по годам</option>
              </select>
            </label>
            <button className="tl-picker-close" onClick={() => setPicker(false)}>Готово</button>
          </div>
        )}
      </div>
      <div
        ref={trackRef}
        className="tl-track"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        title="Колесо мыши: масштаб. Shift + колесо или правая кнопка: прокрутка"
      >
        {ticks.map((t) => (
          <div key={t.d} className={`tl-tick ${t.major ? 'major' : ''}`} style={{ left: x(t.d) }}>
            <span>{t.label}</span>
          </div>
        ))}
        {(cal.eras ?? []).map((e) => {
          const d = yearStart(cal, e.from)
          return d > v0 && d < v1 && e.from !== 1 ? (
            <div key={e.name} className="tl-era" style={{ left: x(d) }}>
              <span>{e.name}</span>
            </div>
          ) : null
        })}
        {0 >= v0 && 0 <= v1 && (
          <div className="tl-epoch" style={{ left: x(0) }} title="Смерть последнего дракона">
            <span>☬ Смерть последнего дракона</span>
          </div>
        )}
        {(() => {
          // одна засечка на пиксель шкалы — смен владельцев тысячи
          let last = -1
          return markers.map((d) => {
            if (d < v0 || d > v1) return null
            const px = Math.round(x(d))
            if (px === last) return null
            last = px
            return <div key={d} className="tl-change" style={{ left: px }} title={formatDate(cal, d)} />
          })
        })()}
        {world.entries.map((ev) =>
          ev.kind === 'event' && ev.from != null && ev.from >= v0 && ev.from <= v1 ? (
            <div
              key={ev.id}
              className="tl-event"
              style={{ left: x(ev.from) }}
              title={`${formatDate(cal, ev.from)}: ${ev.base.name}`}
              onPointerDown={(e) => {
                e.stopPropagation()
                setDate(ev.from!)
              }}
            />
          ) : null
        )}
        {cal.present >= v0 && cal.present <= v1 && <div className="tl-present" style={{ left: x(cal.present) }} title="Настоящее" />}
        <div className="tl-cursor" style={{ left: x(date) }} />
      </div>
    </div>
  )
}
