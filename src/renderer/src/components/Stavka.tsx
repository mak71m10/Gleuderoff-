import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type StavkaData = NonNullable<Entry['base']['stavka']>

/**
 * Сабельная ставка: генералы вокруг Пустого трона. Длина жезла — сколько у генерала сабель в выбранный год,
 * золотой жезл — у местоблюстителя. Ниже — набеги этого года: добыча делится по саблям и двигает власть.
 */
export function StavkaView({ data, onOpen }: { data: StavkaData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const [year, setYear] = useState(data.years[data.years.length - 1])
  const yi = data.years.indexOf(year)
  const present = data.members.map((m) => ({ ...m, now: m.sabres[yi] ?? 0 })).filter((m) => m.now > 0).sort((a, b) => b.now - a.now)
  const total = present.reduce((s, m) => s + m.now, 0)
  const max = Math.max(1, ...present.map((m) => m.now))
  const locum = data.locum.find((l) => l.from <= year && (l.to == null || year < l.to))
  const raids = data.raids.filter((r) => r.year <= year && r.year > year - 4).sort((a, b) => b.year - a.year)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const W = 720, H = 500, cx = W / 2, cy = 245, RX = 285, RY = 200
  // генералы по кругу, местоблюститель — напротив зрителя, у трона
  const order = locum ? [...present.filter((m) => m.id === locum.id), ...present.filter((m) => m.id !== locum.id)] : present
  const placed = order.map((m, i) => {
    const a = Math.PI / 2 + (i / Math.max(1, order.length)) * Math.PI * 2
    return { ...m, x: cx + Math.cos(a) * RX, y: cy + Math.sin(a) * RY, a }
  })
  return (
    <div className="stavka">
      <div className="stavka-head">
        <div>
          <b>{year} год</b> · на Смотре {total.toLocaleString('ru-RU')} сабель · генералов {present.length}
        </div>
        {locum && <div className="stavka-locum">Жезл местоблюстителя: {world.entries.find((e) => e.id === locum.id)?.base.name.replace(/ «.*»$/, '') ?? '—'}</div>}
      </div>
      <div className="stavka-stage" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="stavka-svg">
          <defs>
            <radialGradient id="stv-floor" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#3a1a16" stopOpacity="0.9" />
              <stop offset="1" stopColor="#140c0a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="stv-gold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f4e2b0" />
              <stop offset="1" stopColor="#a8822e" />
            </linearGradient>
          </defs>
          <ellipse cx={cx} cy={cy} rx={RX + 60} ry={RY + 50} fill="url(#stv-floor)" />
          <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none" stroke="#6a2a22" strokeDasharray="3 7" />
          {/* жезлы: от генерала к трону, длина — доля сабель */}
          {placed.map((m) => {
            const k = 0.25 + 0.6 * (m.now / max)
            const x2 = m.x + (cx - m.x) * k, y2 = m.y + (cy - m.y) * k
            const gold = locum?.id === m.id
            return <line key={m.id} x1={m.x} y1={m.y} x2={x2} y2={y2} stroke={gold ? 'url(#stv-gold)' : '#8a3a2e'} strokeWidth={gold ? 7 : 3 + 4 * (m.now / max)} strokeLinecap="round" opacity={0.95} />
          })}
          {/* Пустой трон под алым сукном */}
          <g transform={`translate(${cx} ${cy - 10})`}>
            <rect x={-34} y={-62} width={68} height={92} rx={6} fill="#2a1612" stroke="#c9a45c" strokeWidth={2} />
            <path d="M-30 -58 L30 -58 L26 26 L-26 26 Z" fill="#7a1a16" />
            <path d="M-30 -58 Q0 -40 30 -58" fill="none" stroke="#c9a45c" strokeWidth={1.5} />
            <rect x={-44} y={22} width={88} height={12} rx={3} fill="#3a2016" stroke="#c9a45c" strokeWidth={1.5} />
            <path d="M-16 -82 L0 -96 L16 -82 L10 -66 L-10 -66 Z" fill="#c9a45c" opacity={0.85} />
            <text y={56} textAnchor="middle" className="stavka-throne-label">Пустой трон</text>
          </g>
        </svg>
        {placed.map((m) => {
          const src = img.get(m.id)
          const gold = locum?.id === m.id
          return (
            <button key={m.id} className={`stavka-gen ${gold ? 'locum' : ''}`} style={{ left: `${(m.x / W) * 100}%`, top: `${(m.y / H) * 100}%` }} onClick={() => onOpen(m.id)} title={m.name}>
              <span className="stavka-face">{src ? <img src={assetUrl(src)} alt="" /> : m.name[0]}</span>
              <span className="stavka-name">{m.name.replace(/ «.*»$/, '')}</span>
              <span className="stavka-sabres">{m.now.toLocaleString('ru-RU')} сабель</span>
            </button>
          )
        })}
      </div>
      <input className="stavka-year" type="range" min={data.years[0]} max={data.years[data.years.length - 1]} value={year} onChange={(e) => setYear(Number(e.target.value))} />
      <div className="stavka-raids">
        <div className="field-label">Набеги за последние годы</div>
        {raids.length ? (
          raids.map((r) => (
            <div key={r.year + r.title} className="stavka-raid">
              <b>{r.year}</b> {r.title} — {r.target}. <span>{r.note}</span> <i>{r.loot.toLocaleString('ru-RU')} марок</i>
            </div>
          ))
        ) : (
          <div className="muted">В эти годы больших набегов не было.</div>
        )}
      </div>
    </div>
  )
}
