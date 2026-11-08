import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type WallData = NonNullable<Entry['base']['wall']>
type Cent = WallData['centuries'][number]

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const KIND: Record<string, string> = { accept: 'признание герцога', law: 'закон', tax: 'налог', war: 'война', inscribe: 'Вписание', honor: 'суд Чести', reform: 'реформа' }
const RES: Record<string, [string, string]> = { passed: ['принято', '#6aaa7a'], failed: ['отклонено', '#d0604a'], pending: ['голосуют', '#c9a24a'] }
const hash = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

/** сколько живых Имён в Сотне на год (между снимками 980/990/1000/1010) */
function aliveAt(c: Cent, snap: number[], year: number): number {
  const a = c.alive
  if (year <= snap[0]) return a[snap[0]]
  for (let i = 1; i < snap.length; i++) if (year <= snap[i]) { const y0 = snap[i - 1], y1 = snap[i]; return Math.round(a[y0] + ((year - y0) / (y1 - y0)) * (a[y1] - a[y0])) }
  return a[snap[snap.length - 1]]
}

/** Сотня — плита из 100 табличек 10×10: горят те, за которыми жив потомок (или цвет голоса на Сборе) */
function Slab({ c, x, y, alive, color, vote, sel, onPick }: { c: Cent; x: number; y: number; alive: number; color: string; vote?: string; sel: boolean; onPick: () => void }) {
  const order = useMemo(() => Array.from({ length: 100 }, (_, i) => i).sort((a, b) => (hash(`${c.key}${a}`) % 997) - (hash(`${c.key}${b}`) % 997)), [c.key])
  const lit = useMemo(() => new Set(order.slice(0, alive)), [order, alive])
  const fill = vote === 'yes' ? '#6aaa7a' : vote === 'no' ? '#d0604a' : vote === 'abstain' ? '#9a9a8a' : color
  return (
    <g className="wall-slab" onClick={onPick} transform={`translate(${x} ${y})`}>
      <rect x="-3" y="-3" width="46" height="62" rx="3" className={sel ? 'wall-slab-bg sel' : 'wall-slab-bg'} />
      {Array.from({ length: 100 }, (_, i) => (
        <rect key={i} x={(i % 10) * 4} y={Math.floor(i / 10) * 4} width="3" height="3" fill={vote ? fill : lit.has(i) ? fill : '#242018'} opacity={vote ? (lit.has(i) ? 1 : 0.35) : 1} />
      ))}
      <text x="20" y="53" textAnchor="middle" className="wall-slab-n">{c.n}</text>
    </g>
  )
}

/**
 * «Стена Трёх Тысяч» Протектората Лирия: тридцать Сотен по сто табличек (светятся те, за которыми жив потомок), Сбор Сотен голосует
 * Сотнями (закон — 16, война — 20), Вписания возвращают погасшие таблички. Вкладки: «Стена», «Сборы», «Вписания».
 */
export function WallView({ data, onOpen }: { data: WallData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'wall' | 'votes' | 'inscr'>('wall')
  const [year, setYear] = useState(1010)
  const [sel, setSel] = useState<string | null>(null)
  const [ai, setAi] = useState(data.assemblies.length - 1)
  const side = new Map(data.sides.map((s) => [s.key, s]))
  const lit = data.centuries.reduce((s, c) => s + aliveAt(c, data.snap, year), 0)
  const asm = data.assemblies[Math.min(ai, data.assemblies.length - 1)]
  const yes = Object.values(asm.votes).filter((v) => v === 'yes').length
  const picked = data.centuries.find((c) => c.key === sel) ?? null
  const Y0 = 978, Y1 = 1010
  const grid = (mode: 'alive' | 'vote'): ReactNode => (
    <svg viewBox="0 0 690 150" className="wall-svg">
      <rect x="0" y="0" width="690" height="150" rx="8" className="wall-bg" />
      {data.centuries.map((c, i) => {
        const col = i % 15, row = Math.floor(i / 15)
        return <Slab key={c.key} c={c} x={14 + col * 45.5} y={12 + row * 70} alive={aliveAt(c, data.snap, mode === 'alive' ? year : 1010)} color={side.get(c.side)?.color ?? '#aaa'} vote={mode === 'vote' ? asm.votes[c.key] : undefined} sel={sel === c.key} onPick={() => setSel(sel === c.key ? null : c.key)} />
      })}
    </svg>
  )
  const total = data.total
  const maxLit = Math.max(...data.snap.map((y) => data.centuries.reduce((s, c) => s + aliveAt(c, data.snap, y), 0)))
  return (
    <div className="wall">
      <div className="wall-head">
        <div>
          <small>{tab === 'votes' ? `Сбор ${Math.floor(asm.year)} г.` : `Стена Трёх Тысяч в ${year} г.`}</small>
          <b>{tab === 'votes' ? asm.title : `Горит ${lit.toLocaleString('ru')} из ${total.toLocaleString('ru')} табличек`}</b>
        </div>
        <div className={`wall-status ${tab === 'votes' ? (asm.result) : ''}`}>
          {tab === 'votes' ? <>{RES[asm.result]?.[0]} · за {yes} из {data.centuries.length}, нужно {asm.need}</> : <>Погасло {(total - lit).toLocaleString('ru')} · безымянных шесть из семи</>}
        </div>
      </div>
      <div className="wall-tabs">
        {([['wall', 'Стена'], ['votes', 'Сборы'], ['inscr', 'Вписания']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'wall' && (
        <>
          {grid('alive')}
          <div className="wall-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
        </>
      )}
      {tab === 'votes' && (
        <>
          {grid('vote')}
          <div className="wall-decs">
            {data.assemblies.map((a, i) => <button key={i} className={i === ai ? 'on' : ''} onClick={() => setAi(i)}><small>{Math.floor(a.year)}</small> {a.title} <span style={{ color: RES[a.result]?.[1] }}>· {RES[a.result]?.[0]}</span></button>)}
          </div>
          <p className="wall-note"><b>{KIND[asm.kind] ?? asm.kind}</b> · нужно {asm.need} из {data.centuries.length}, за {yes}, воздержались {asm.abstain}. {asm.note}</p>
        </>
      )}
      {tab === 'inscr' && (
        <div className="wall-inscr">
          <svg viewBox="0 0 420 170" className="wall-chart">
            {(() => {
              const X = (y: number): number => 30 + ((y - data.snap[0]) / (data.snap[data.snap.length - 1] - data.snap[0])) * 370
              const Yv = (v: number): number => 150 - (v / (maxLit * 1.05)) * 130
              const pts = [978, ...data.snap].map((y) => [X(Math.max(y, data.snap[0])), Yv(data.centuries.reduce((s, c) => s + aliveAt(c, data.snap, y), 0))])
              return (
                <>
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} className="wall-line" />
                  {data.snap.map((y, i) => <g key={y}><circle cx={pts[i + 1][0]} cy={pts[i + 1][1]} r="4" fill="#e8c860" /><text x={pts[i + 1][0]} y="166" textAnchor="middle" className="wall-axis">{y}</text></g>)}
                  {data.inscriptions.map((v) => <g key={v.year}><line x1={X(Math.min(v.year, 1010))} x2={X(Math.min(v.year, 1010))} y1="150" y2={150 - Math.min(v.count, 400) / 5} className={v.year === 1010 ? 'wall-ins pending' : 'wall-ins'} /><text x={X(Math.min(v.year, 1010))} y={146 - Math.min(v.count, 400) / 5} textAnchor="middle" className="wall-axis">+{v.count}</text></g>)}
                </>
              )
            })()}
          </svg>
          <div className="wall-inlist">
            {data.inscriptions.map((v) => <div key={v.year}><b>{v.year} г.</b> · {v.count} имён — {v.note}</div>)}
          </div>
        </div>
      )}

      {picked && (
        <div className="wall-card">
          <div className="wall-card-text">
            <small>Сотня №{picked.n} · {side.get(picked.side)?.name} · {picked.seat}</small>
            <b>{picked.name}</b>
            <span>{[978, 990, 1000, 1010].map((y) => `${y}: ${aliveAt(picked, data.snap, y)}`).join(' · ')} — живых Имён</span>
            {tab === 'votes' && <span>На Сборе «{asm.title}»: {asm.votes[picked.key] === 'yes' ? 'за' : asm.votes[picked.key] === 'no' ? 'против' : 'воздержалась'}</span>}
          </div>
          <button className="wall-leader" disabled={!picked.leaderId} onClick={() => picked.leaderId && onOpen(picked.leaderId)}>
            <span className="wall-face">{picked.leaderId && img.get(picked.leaderId) ? <img src={assetUrl(img.get(picked.leaderId)!)} alt="" /> : picked.leader[0]}</span>
            <span><small>Центурион</small><b>{picked.leader}</b></span>
          </button>
        </div>
      )}
      <div className="wall-legend">{data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="wall-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
