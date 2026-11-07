import { useState } from 'react'
import type { Entry } from '../types'

type VaultData = NonNullable<Entry['base']['vault']>

/**
 * «Весы Свода» Фарвольской лиги: Перепись Наковальни раз в семь лет перевешивает места Палаты Камня (дварфы, по щитам)
 * и Палаты Шестерни (гномы, по долям); Скамья Поверхности (люди) не пересчитывается. Чаши весов, столбцы всех переписей
 * с имперских времён и Выборы под Молотом с голосами по палатам.
 */
export function VaultView({ data, onOpen }: { data: VaultData; onOpen: (id: string) => void }) {
  const [ci, setCi] = useState(data.counts.length - 1)
  const c = data.counts[ci]
  const ch = (k: string) => data.chambers.find((x) => x.key === k)!
  const stone = c.seats.stone ?? 0, gear = c.seats.gear ?? 0, surf = c.seats.surface ?? 0
  const total = stone + gear + surf
  const need = Math.floor(total / 2) + 1
  const ruler = stone >= need ? 'stone' : gear >= need ? 'gear' : 'surface'
  // перевес гномов клонит правую чашу вниз
  const tilt = Math.max(-13, Math.min(13, ((gear - stone) / Math.max(1, stone + gear)) * 40))
  const rad = (tilt * Math.PI) / 180
  const P = (side: number): [number, number] => [300 + side * 190 * Math.cos(rad), 70 + side * 190 * Math.sin(rad)]
  const pan = (side: number, k: string, n: number) => {
    const [x, y] = P(side)
    const py = y + 92
    const col = ch(k)
    const items = Array.from({ length: n }, (_, i) => i)
    const perRow = 9
    return (
      <g>
        <line x1={x} y1={y} x2={x - 58} y2={py} className="vault-rope" />
        <line x1={x} y1={y} x2={x + 58} y2={py} className="vault-rope" />
        <path d={`M${x - 70} ${py} Q${x} ${py + 26} ${x + 70} ${py} Z`} fill={col.color} stroke={col.light} strokeWidth="1.5" />
        {items.map((i) => {
          const row = Math.floor(i / perRow), col2 = i % perRow
          const cx = x - 52 + col2 * 13 + (row % 2) * 6, cy = py - 6 - row * 11
          return k === 'gear'
            ? <circle key={i} cx={cx} cy={cy} r="5.2" fill={col.light} stroke={col.color} strokeWidth="2" strokeDasharray="2 1.4" />
            : <rect key={i} x={cx - 5.5} y={cy - 5} width="11" height="10" rx="1.5" fill={col.light} stroke={col.color} strokeWidth="1.2" />
        })}
        <text x={x} y={py + 34} textAnchor="middle" className="vault-num" fill={col.light}>{n}</text>
        <text x={x} y={py + 50} textAnchor="middle" className="vault-lbl">{col.name}</text>
      </g>
    )
  }
  const max = Math.max(...data.counts.map((x) => Object.values(x.seats).reduce((s, v) => s + v, 0)))
  return (
    <div className="vault">
      <div className="vault-head">
        <div>
          <small>Перепись Наковальни</small>
          <b>{c.title}, {Math.floor(c.year)} г.</b>
        </div>
        <div className={`vault-status ${ruler}`}>
          {ruler === 'surface' ? <>Большинства ({need}) нет ни у кого — <b>решают {surf} голосов людей</b></> : <><b>{ch(ruler).name}</b> правит одна: {ruler === 'stone' ? stone : gear} из {total}</>}
        </div>
      </div>
      <svg viewBox="0 0 600 270" className="vault-scales">
        <path d="M300 70 L300 236 M250 248 h100 l-12 -12 h-76 z" className="vault-post" />
        <g transform={`rotate(${tilt} 300 70)`}>
          <rect x="106" y="65" width="388" height="10" rx="4" className="vault-beam" />
        </g>
        <circle cx="300" cy="70" r="9" className="vault-pivot" />
        {pan(-1, 'stone', stone)}
        {pan(1, 'gear', gear)}
        <g className={ruler === 'surface' ? 'vault-surf hot' : 'vault-surf'}>
          <line x1="300" y1="79" x2="300" y2="128" className="vault-rope" />
          <path d="M286 128h28l6 30h-40z" fill={ch('surface').color} stroke={ch('surface').light} strokeWidth="1.5" />
          <text x="300" y="150" textAnchor="middle" className="vault-num small" fill={ch('surface').light}>{surf}</text>
          <text x="300" y="176" textAnchor="middle" className="vault-lbl">{ch('surface').name}</text>
        </g>
      </svg>
      {c.note && <p className="vault-note">{c.note}</p>}
      <div className="vault-cols" role="tablist">
        {data.counts.map((x, i) => {
          const s = x.seats
          const t = Object.values(s).reduce((a, v) => a + v, 0)
          const h = (v: number) => `${(v / max) * 100}%`
          const needX = Math.floor(t / 2) + 1
          const r = (s.stone ?? 0) >= needX ? 'stone' : (s.gear ?? 0) >= needX ? 'gear' : 'surface'
          return (
            <button key={x.year} className={`vault-col ${i === ci ? 'on' : ''}`} onClick={() => setCi(i)} title={`${x.title}: Камень ${s.stone}, Шестерня ${s.gear}, Поверхность ${s.surface}`}>
              <span className="vault-bar">
                <i style={{ height: h(s.gear ?? 0), background: ch('gear').color }} />
                <i style={{ height: h(s.surface ?? 0), background: ch('surface').color }} />
                <i style={{ height: h(s.stone ?? 0), background: ch('stone').color }} />
              </span>
              <span className={`vault-mark ${r}`} />
              <small>{Math.floor(x.year)}</small>
            </button>
          )
        })}
      </div>
      <div className="vault-legend">
        {data.chambers.map((x) => <span key={x.key}><i style={{ background: x.color }} />{x.name} — {x.who}</span>)}
      </div>
      <h4 className="vault-h">Выбор под Молотом</h4>
      {data.elections.map((e) => {
        const t = e.candidates.reduce((s, k) => s + Object.values(k.votes).reduce((a, v) => a + v, 0), 0)
        const width = Math.max(61, t)
        return (
          <div key={e.year} className="vault-elect">
            <div className="vault-elect-head"><b>{Math.floor(e.year)}</b> {e.title}</div>
            {e.candidates.map((k) => {
              const sum = Object.values(k.votes).reduce((a, v) => a + v, 0)
              const win = k.name === e.winner
              return (
                <div key={k.name} className={`vault-cand ${win ? 'win' : ''}`}>
                  <span className="vault-cand-name">
                    {k.id ? <button className="link-btn" onClick={() => onOpen(k.id!)}>{k.name}</button> : k.name}
                    <small>{k.race}</small>
                  </span>
                  <span className="vault-votes">
                    {data.chambers.map((x) => (k.votes[x.key] ? <i key={x.key} style={{ width: `${(k.votes[x.key] / width) * 100}%`, background: x.color }} title={`${x.name}: ${k.votes[x.key]}`}>{k.votes[x.key]}</i> : null))}
                    <em style={{ left: `${(31 / width) * 100}%` }} />
                  </span>
                  <b className="vault-sum">{sum}{win ? ' ♛' : ''}</b>
                </div>
              )
            })}
            <p className="vault-note">{e.note}</p>
          </div>
        )
      })}
      <ul className="vault-rules">{data.rules.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  )
}
