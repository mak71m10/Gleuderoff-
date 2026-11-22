import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['tower']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const fmt = (v: number | null): string => (v == null ? 'по сей день' : String(Math.floor(v)))

/**
 * «Великое испытание» Северной Башни: башня в разрезе — двенадцать ярусов-кафедр; на самом верху светится окно Магистра.
 * Ползунок лет 977–1010 меняет Магистра и показывает прошедшее испытание: столбцы баллов у черты 210; ниже 210 — пустой экзамен
 * и окно Хранителя гаснет жёлтым. Клик по ярусу — кафедра и держатель.
 */
export function ExamView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<number | null>(null)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const ruler = [...data.rulers].reverse().find((r) => r.from <= year + 0.5) ?? data.rulers[0]
  const rImg = img.get(ruler.id)
  const exam = [...data.exams].reverse().find((e) => e.y <= year) ?? null
  const keeper = /Хранитель/.test(ruler.name)
  const chair = sel ? data.chairs.find((c) => c.floor === sel) : null
  const W = 280, H = 420
  const floorH = 30, base = H - 22
  const wAt = (f: number): number => 190 - f * 7 // башня сужается кверху
  return (
    <div className="ntx">
      <div className="ntx-head">
        <div>
          <small>Башня в {year} г.</small>
          <b>{ruler.name}</b>
          <span className="ntx-sub">{exam ? `последнее испытание: ${exam.title} (${exam.y})` : 'до Первого испытания'}</span>
        </div>
        <div className="ntx-status" style={{ borderColor: keeper ? '#e8a04a' : '#c8c8e8', color: keeper ? '#e8a04a' : '#c8c8e8' }}>{keeper ? 'Хранитель правит' : year < 980 ? 'Старейшая Коллегия' : 'Магистр у власти'}</div>
      </div>
      <div className="ntx-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
      <div className="ntx-main">
        <svg viewBox={`0 0 ${W} ${H}`} className="ntx-tower">
          <defs><linearGradient id="ntx-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e1220" /><stop offset="1" stopColor="#2a3040" /></linearGradient></defs>
          <rect width={W} height={H} fill="url(#ntx-sky)" rx="8" />
          <path d={`M0 ${base} L${W} ${base} L${W} ${H} L0 ${H} Z`} fill="#26262c" />
          {data.chairs.map((c) => {
            const y = base - c.floor * floorH, w = wAt(c.floor), x = (W - w) / 2
            const on = sel === c.floor
            return (
              <g key={c.key} className="ntx-floor" onClick={() => setSel(on ? null : c.floor)}>
                <rect x={x} y={y} width={w} height={floorH - 1} fill="#3a3a44" stroke={on ? '#fff' : '#18181e'} strokeWidth={on ? 2.2 : 1} />
                <rect x={x + 4} y={y + 3} width={w - 8} height="4" fill={c.color} opacity=".75" />
                {[0.2, 0.4, 0.6, 0.8].map((k) => <rect key={k} x={x + w * k - 4} y={y + 12} width="8" height="11" fill={c.floor === 12 ? (keeper ? '#e8a04a' : '#f0e4a0') : '#cfcfe0'} opacity=".8" />)}
                <text x={W / 2} y={y + 24} textAnchor="middle" className="ntx-fl">{c.floor}. {c.name}</text>
              </g>
            )
          })}
          {rImg && <image href={assetUrl(rImg)} x={W - 52} y="8" width="42" height="42" preserveAspectRatio="xMidYMid slice" style={{ clipPath: 'circle(50%)' }} />}
          <text x={W - 31} y="60" textAnchor="middle" className="ntx-yr">{year}</text>
        </svg>
        <div className="ntx-card">
          {chair ? (
            <div className="ntx-card-text">
              <small>Ярус {chair.floor}</small>
              <b>Кафедра {chair.name}</b>
              <span className="ntx-line">{chair.desc}</span>
              <div className="ntx-btns">{chair.holder && <button onClick={() => onOpen(chair.holder as string)}>держатель</button>}<button onClick={() => setSel(null)}>к Магистру</button></div>
            </div>
          ) : (
            <div className="ntx-card-text">
              <small>Магистр · {fmt(ruler.from)} — {fmt(ruler.to)}</small>
              <b>{ruler.name}</b>
              <p>{ruler.note}</p>
              <div className="ntx-btns"><button onClick={() => onOpen(ruler.id)}>открыть</button></div>
            </div>
          )}
        </div>
      </div>
      <h4 className="ntx-h">Испытания и баллы (проходной {data.passScore} из {data.maxScore})</h4>
      <div className="ntx-exams">
        {data.exams.map((e) => (
          <div key={e.y} className={`ntx-exam ${exam?.y === e.y ? 'on' : ''}`} onClick={() => setYear(e.y)}>
            <b>{e.y} · {e.title}</b>
            {e.pending ? <span className="ntx-res" style={{ color: '#e8c860' }}>идёт</span> : <span className="ntx-res" style={{ color: e.passed ? '#6aaa7a' : '#d0604a' }}>{e.passed ? 'Магистр избран' : 'пустой экзамен'}</span>}
            <div className="ntx-bars">
              {e.top.map((t, i) => (
                <div key={i} className="ntx-bar" onClick={(ev) => { ev.stopPropagation(); if (t.id) onOpen(t.id) }}>
                  <span className="ntx-n">{t.name}</span>
                  <span className="ntx-track"><i style={{ width: `${(t.score / data.maxScore) * 100}%`, background: t.score >= data.passScore ? '#6aaa7a' : '#a86a5a' }} /><u style={{ left: `${(data.passScore / data.maxScore) * 100}%` }} /></span>
                  <span className="ntx-s">{e.pending ? '?' : t.score}</span>
                </div>
              ))}
            </div>
            <small>{e.note}</small>
          </div>
        ))}
      </div>
      <ul className="ntx-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
