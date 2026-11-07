import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type TingData = NonNullable<Entry['base']['ting']>

const KIND: Record<string, string> = { election: 'Выборы Седых', duel: 'Вызов щита', denied: 'В круг не пустили' }

/**
 * Каменный круг Земель Севера: девять камней Седых вокруг Щита Хьяльмара, в середине — конунг Круга выбранного года.
 * Камни, положенные в этот год за выбор или за вызов, светятся и тянутся к щиту. Ниже — все вызовы и выборы.
 */
export function TingView({ data, onOpen }: { data: TingData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const [year, setYear] = useState(data.years[data.years.length - 1])
  const byId = useMemo(() => new Map(world.entries.map((e) => [e.id, e])), [world.entries])
  const name = (id: string | null): string => (id ? byId.get(id)?.base.name.replace(/ «.*»$/, '') ?? '—' : '—')
  const head = data.heads.find((h) => h.from <= year && (h.to == null || year < h.to)) ?? data.heads[0]
  const ev = data.challenges.find((c) => c.year === year)
  const laid = new Set(ev?.stones ?? [])
  const W = 720, H = 520, cx = W / 2, cy = 262, RX = 250, RY = 178
  const stones = data.clans.map((c, i) => {
    const a = -Math.PI / 2 + (i / data.clans.length) * Math.PI * 2
    const elder = c.elders.find((e) => e.from <= year && (e.to == null || year < e.to))
    return { ...c, elder, x: cx + Math.cos(a) * RX, y: cy + Math.sin(a) * RY, px: cx + Math.cos(a) * (RX + 62), py: cy + Math.sin(a) * (RY + 52), lit: laid.has(c.key), own: head?.clan === c.key }
  })
  const face = (id: string | null | undefined, cls: string) => {
    const src = id ? byId.get(id)?.base.image : ''
    return <span className={cls}>{src ? <img src={assetUrl(src)} alt="" /> : name(id ?? null)[0]}</span>
  }
  return (
    <div className="ting">
      <div className="ting-head">
        <div>
          <b>{year} год</b> · конунг Круга: <button className="link-btn" onClick={() => head && onOpen(head.id)}>{name(head?.id ?? null)}</button>
        </div>
        {head && <div className="ting-how">{head.how}</div>}
      </div>
      <div className="ting-stage" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="ting-svg">
          <defs>
            <radialGradient id="ting-ground" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#2c3a30" stopOpacity="0.95" />
              <stop offset="0.7" stopColor="#1a221d" stopOpacity="0.6" />
              <stop offset="1" stopColor="#0c100e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ting-fire" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ff8a3a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={cx} cy={cy} rx={RX + 90} ry={RY + 80} fill="url(#ting-ground)" />
          <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none" stroke="#56634f" strokeWidth={10} opacity={0.35} />
          {/* камни, положенные в этот год, тянутся к щиту */}
          {stones.filter((s) => s.lit).map((s) => (
            <line key={`l-${s.key}`} x1={s.x} y1={s.y} x2={cx} y2={cy} stroke={ev?.kind === 'denied' ? '#8a8a8a' : '#e2c27a'} strokeWidth={2.5} strokeDasharray={ev?.kind === 'denied' ? '5 6' : undefined} opacity={0.8} />
          ))}
          {stones.map((s) => (
            <g key={s.key} transform={`translate(${s.x} ${s.y})`}>
              <path d="M-15 26 L-18 -18 Q-14 -40 0 -44 Q14 -40 17 -16 L15 26 Z" fill={s.lit ? '#8f8a78' : '#5f6158'} stroke={s.lit ? '#f0d898' : '#2a2c28'} strokeWidth={s.lit ? 3 : 1.5} />
              <rect x={-15} y={-6} width={30} height={7} fill={s.color} opacity={0.95} />
              <text y={-18} textAnchor="middle" className="ting-rune">ᚱ</text>
              {s.own && <circle r={5} cy={16} fill="#e2c27a" />}
            </g>
          ))}
          {/* Щит Хьяльмара на центральном камне */}
          <g transform={`translate(${cx} ${cy})`}>
            <circle r={70} fill="url(#ting-fire)" />
            <circle r={44} fill="#4a3424" stroke="#a88a5a" strokeWidth={4} />
            <circle r={44} fill="none" stroke="#2a1c12" strokeWidth={1} strokeDasharray="2 9" />
            <circle r={9} fill="#9a9a9a" stroke="#4a4a4a" />
            <text y={66} textAnchor="middle" className="ting-label">Щит Хьяльмара</text>
          </g>
        </svg>
        {stones.map((s) => (
          <button key={s.key} className={`ting-elder ${s.lit ? 'lit' : ''}`} style={{ left: `${(s.px / W) * 100}%`, top: `${(s.py / H) * 100}%`, ['--clan' as string]: s.color }} onClick={() => s.elder && onOpen(s.elder.id)} title={s.nick}>
            {face(s.elder?.id, 'ting-face')}
            <span className="ting-name">{s.elder ? name(s.elder.id) : '—'}</span>
            <span className="ting-clan">{s.name}</span>
          </button>
        ))}
        {head && (
          <button className="ting-king" style={{ left: '50%', top: `${((cy - 4) / H) * 100}%` }} onClick={() => onOpen(head.id)}>
            {face(head.id, 'ting-face king')}
          </button>
        )}
      </div>
      <input className="ting-year" type="range" min={data.years[0]} max={data.years[data.years.length - 1]} value={year} onChange={(e) => setYear(Number(e.target.value))} />
      {ev ? (
        <div className={`ting-event ${ev.kind}`}>
          <b>{KIND[ev.kind]}</b>
          {ev.by && (
            <>
              {' '}— <button className="link-btn" onClick={() => onOpen(ev.by!)}>{name(ev.by)}</button> против <button className="link-btn" onClick={() => onOpen(ev.against!)}>{name(ev.against)}</button>
            </>
          )}
          . Камней {ev.stones.length} из {data.clans.length}
          {ev.kind !== 'election' && `, нужно ${data.need}`}. <span>{ev.note}</span>
        </div>
      ) : (
        <div className="muted ting-event">В этот год Альтинг прошёл без вызова: никто не ударил в щит.</div>
      )}
      <div className="ting-list">
        <div className="field-label">Выборы и вызовы щита</div>
        {data.challenges.map((c) => (
          <button key={c.year} className={`ting-row ${c.year === year ? 'active' : ''} ${c.kind}`} onClick={() => setYear(c.year)}>
            <b>{c.year}</b> {KIND[c.kind]}: {c.kind === 'election' ? name(c.winner) : `${name(c.by)} → ${name(c.against)}`}
            <i>{'●'.repeat(c.stones.length)}{'○'.repeat(Math.max(0, data.clans.length - c.stones.length))}</i>
          </button>
        ))}
      </div>
    </div>
  )
}
